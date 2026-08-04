import type {
  AgentTiming,
  BiasCheck,
  Competency,
  FeedbackAnalysis,
  GeneratedQuestion,
  GenerationStage,
  InterviewFeedback,
  RoleSetupInput,
} from '../types';
import { callAgent } from './client';
import {
  biasAuditSchema,
  competencySchema,
  feedbackSchema,
  personalizedSchema,
  questionSchema,
} from './schemas';
import {
  buildBiasAuditPrompt,
  buildCompetencyPrompt,
  buildFeedbackPrompt,
  buildPersonalizePrompt,
  buildQuestionPrompt,
  SYSTEM_PREAMBLE,
} from './prompts';

type RawEntry = { agent: string; response: string };

interface RawQuestion {
  question: string;
  competency: string;
  reasoning: string;
  jdEvidence: string;
  resumeEvidence?: string;
  followUps: string[];
  scoringRubric: { score1: string; score3: string; score5: string };
  redFlags: string[];
  estimatedMinutes: number;
}

interface BiasAudit {
  index: number;
  status: 'pass' | 'warning';
  note: string;
}

function toQuestion(
  raw: RawQuestion,
  id: string,
  source: 'standard' | 'personalized',
  biasCheck: BiasCheck,
): GeneratedQuestion {
  return {
    id,
    question: raw.question,
    competency: raw.competency,
    reasoning: raw.reasoning,
    jdEvidence: raw.jdEvidence,
    resumeEvidence: raw.resumeEvidence,
    followUps: raw.followUps,
    scoringRubric: raw.scoringRubric,
    redFlags: raw.redFlags,
    estimatedMinutes: raw.estimatedMinutes,
    biasCheck,
    source,
  };
}

async function auditBias(
  questions: RawQuestion[],
): Promise<{ checks: BiasCheck[]; ms: number; raw: string }> {
  const result = await callAgent<{ audits: BiasAudit[] }>({
    agent: 'bias-audit',
    system: SYSTEM_PREAMBLE,
    prompt: buildBiasAuditPrompt(questions),
    toolName: 'record_audit',
    toolDescription: 'Record the compliance audit for each question.',
    schema: biasAuditSchema,
    maxTokens: 3000,
  });

  const checks: BiasCheck[] = questions.map((_, i) => {
    const audit = result.data.audits.find((a) => a.index === i);
    if (!audit || audit.status === 'pass') return { status: 'pass', note: null };
    return { status: 'warning', note: audit.note || null };
  });

  return { checks, ms: result.ms, raw: result.raw };
}

/** Agent 1 → Agent 2 → bias audit. */
export async function runRoleChain(
  input: RoleSetupInput,
  onStage: (stage: GenerationStage) => void,
): Promise<{
  competencies: Competency[];
  questions: GeneratedQuestion[];
  timings: AgentTiming[];
  raw: RawEntry[];
}> {
  const timings: AgentTiming[] = [];
  const raw: RawEntry[] = [];

  onStage('parsing');
  const parsed = await callAgent<{ competencies: Competency[] }>({
    agent: 'role-parser',
    system: SYSTEM_PREAMBLE,
    prompt: buildCompetencyPrompt(input),
    toolName: 'record_competencies',
    toolDescription: 'Record the competencies extracted from the job description.',
    schema: competencySchema,
    maxTokens: 2000,
  });
  timings.push({ agent: 'Role parser', ms: parsed.ms });
  raw.push({ agent: 'role-parser', response: parsed.raw });

  onStage('generating');
  const generated = await callAgent<{ questions: RawQuestion[] }>({
    agent: 'question-generator',
    system: SYSTEM_PREAMBLE,
    prompt: buildQuestionPrompt(input, parsed.data.competencies),
    toolName: 'record_questions',
    toolDescription: 'Record the generated interview questions with rubrics.',
    schema: questionSchema,
    // Providers reserve maxTokens against the per-minute budget whether or not
    // the model uses them, and Groq's free tier allows only 8k TPM. Six
    // questions with rubrics measured ~3.6k output, so this is headroom, not a
    // guess — an oversized reservation 413s before the model ever runs.
    maxTokens: 6000,
  });
  timings.push({ agent: 'Question generator', ms: generated.ms });
  raw.push({ agent: 'question-generator', response: generated.raw });

  onStage('auditing');
  const audit = await auditBias(generated.data.questions);
  timings.push({ agent: 'Bias audit', ms: audit.ms });
  raw.push({ agent: 'bias-audit', response: audit.raw });

  const questions = generated.data.questions.map((q, i) =>
    toQuestion(q, `q-${Date.now()}-${i}`, 'standard', audit.checks[i]),
  );

  return { competencies: parsed.data.competencies, questions, timings, raw };
}

/** Agent 3 — resume-driven personalized questions, then the same independent bias audit. */
export async function runPersonalizeChain({
  roleSetup,
  competencies,
  standardQuestions,
  resumeText,
  candidateName,
  count,
}: {
  roleSetup: RoleSetupInput;
  competencies: Competency[];
  standardQuestions: GeneratedQuestion[];
  resumeText: string;
  candidateName: string;
  count: number;
}): Promise<{ questions: GeneratedQuestion[]; timings: AgentTiming[]; raw: RawEntry[] }> {
  const raw: RawEntry[] = [];
  const timings: AgentTiming[] = [];

  const result = await callAgent<{ questions: RawQuestion[] }>({
    agent: 'personalizer',
    system: SYSTEM_PREAMBLE,
    prompt: buildPersonalizePrompt({
      input: roleSetup,
      competencies,
      standardQuestions,
      resumeText,
      candidateName,
      count,
    }),
    toolName: 'record_personalized_questions',
    toolDescription: 'Record the candidate-specific interview questions.',
    schema: personalizedSchema,
    maxTokens: 5000,
  });
  timings.push({ agent: 'Personalizer', ms: result.ms });
  raw.push({ agent: 'personalizer', response: result.raw });

  const audit = await auditBias(result.data.questions);
  timings.push({ agent: 'Bias audit (personalized)', ms: audit.ms });
  raw.push({ agent: 'bias-audit-personalized', response: audit.raw });

  const questions = result.data.questions.map((q, i) =>
    toQuestion(q, `p-${Date.now()}-${i}`, 'personalized', audit.checks[i]),
  );

  return { questions, timings, raw };
}

/** Agent 4 — the consistency check. */
export async function runFeedbackChain({
  feedback,
  questions,
  roleSetup,
  isDemo,
}: {
  feedback: InterviewFeedback;
  questions: GeneratedQuestion[];
  roleSetup: RoleSetupInput;
  isDemo: boolean;
}): Promise<{ analysis: FeedbackAnalysis; raw: RawEntry[] }> {
  if (isDemo) {
    return { analysis: buildDemoAnalysis(feedback), raw: [] };
  }

  const result = await callAgent<FeedbackAnalysis>({
    agent: 'feedback-analyst',
    system: SYSTEM_PREAMBLE,
    prompt: buildFeedbackPrompt({ feedback, questions, input: roleSetup }),
    toolName: 'record_analysis',
    toolDescription: 'Record the feedback analysis and consistency check.',
    schema: feedbackSchema,
    maxTokens: 4000,
  });

  return {
    analysis: result.data,
    raw: [{ agent: 'feedback-analyst', response: result.raw }],
  };
}

/**
 * Demo-mode consistency check. Runs the same detections the model does, over
 * whatever the user actually typed, so the flag is real rather than canned.
 */
function buildDemoAnalysis(feedback: InterviewFeedback): FeedbackAnalysis {
  const notes = (feedback.overallNotes ?? '').toLowerCase();
  const rated = feedback.competencyScores.filter((s) => s.score > 0);
  const avg = rated.length ? rated.reduce((a, s) => a + s.score, 0) / rated.length : 0;

  const inconsistencies: string[] = [];

  const NEGATIVE = [
    'struggled', 'unclear', 'vague', 'could not', 'couldn\'t', 'failed', 'weak',
    'shallow', 'hesitant', 'confused', 'lacked', 'no example', 'surface',
  ];
  const POSITIVE = [
    'excellent', 'strong', 'impressive', 'clear', 'thorough', 'deep', 'sharp', 'outstanding',
  ];

  const negativeHits = NEGATIVE.filter((w) => notes.includes(w));
  const positiveHits = POSITIVE.filter((w) => notes.includes(w));

  const high = rated.filter((s) => s.score >= 4);
  const low = rated.filter((s) => s.score <= 2);

  if (high.length > 0 && negativeHits.length > 0) {
    inconsistencies.push(
      `You scored ${high.map((s) => `${s.competency} ${s.score}/5`).join(' and ')}, but the notes describe the candidate as "${negativeHits[0]}". Either the score or the note needs to change before this goes in the record — a debrief will surface the gap otherwise.`,
    );
  }

  if (low.length > 0 && positiveHits.length > 0) {
    inconsistencies.push(
      `The notes use "${positiveHits[0]}" while ${low.map((s) => `${s.competency}`).join(' and ')} scored ${low[0].score}/5. If the low score reflects a specific answer, cite it — otherwise the record reads as inconsistent.`,
    );
  }

  // Only checked when the interviewer has actually recorded one. Before that
  // there is no recommendation to contradict, and inventing one to critique
  // would be the tool making the call it exists to leave alone.
  const rec = feedback.overallRecommendation;
  if (rec && (rec === 'No Hire' || rec === 'Strong No Hire') && avg >= 3.5) {
    inconsistencies.push(
      `Competency scores average ${avg.toFixed(1)}/5, which does not support a "${rec}" recommendation. If there is a specific disqualifying signal, it needs to be in the notes.`,
    );
  }
  if (rec && (rec === 'Strong Hire' || rec === 'Hire') && avg > 0 && avg <= 2.5) {
    inconsistencies.push(
      `Competency scores average ${avg.toFixed(1)}/5, which does not support a "${rec}" recommendation.`,
    );
  }

  const unrated = feedback.competencyScores.filter((s) => s.score === 0);
  if (unrated.length > 0) {
    inconsistencies.push(
      `${unrated.map((s) => s.competency).join(', ')} ${unrated.length === 1 ? 'was' : 'were'} left unrated. An incomplete scorecard weakens the comparison against other candidates for this role.`,
    );
  }

  const BIAS_TERMS = [
    'culture fit', 'not a fit', 'energy', 'polished', 'aggressive', 'abrasive',
    'young', 'old', 'overqualified', 'personality', 'likeable', 'gut',
  ];
  const biasFlags = BIAS_TERMS.filter((t) => notes.includes(t)).map(
    (t) =>
      `"${t}" describes an impression rather than an observed behaviour. Restate it as what the candidate actually said or did, or remove it.`,
  );

  const summary = [
    rated.length
      ? `Scored ${rated.length} of ${feedback.competencyScores.length} competencies, averaging ${avg.toFixed(1)}/5.`
      : 'No competencies were scored.',
    high.length
      ? `Strongest signal: ${high.map((s) => s.competency).join(', ')}.`
      : 'No competency scored above 3.',
    low.length
      ? `Weakest signal: ${low.map((s) => s.competency).join(', ')}.`
      : 'No competency scored below 3.',
  ];

  // Things for the interviewer to weigh — never a verdict. `rec` is quoted only
  // as *their* recorded decision, never restated as the tool's own.
  const considerations: string[] = [];
  if (inconsistencies.length) {
    considerations.push(
      rec
        ? `The written record does not yet stand on its own for a "${rec}". Resolving the flags above matters most if this candidate is compared against others later.`
        : `The written record does not yet stand on its own. Resolving the flags above matters most if this candidate is compared against others later.`,
    );
  }
  if (unrated.length > 0) {
    considerations.push(
      `${unrated.map((s) => s.competency).join(', ')} went unscored — worth deciding whether that competency was genuinely untested or simply not recorded.`,
    );
  }
  if (low.length > 0) {
    considerations.push(
      `${low.map((s) => s.competency).join(' and ')} scored lowest. Consider whether that reflects the candidate's answer or a question that did not land.`,
    );
  }
  if (!considerations.length) {
    considerations.push(
      `The scores and notes line up, and every competency was rated — the record supports whatever call you record here.`,
    );
  }

  return {
    summary,
    inconsistencies,
    considerations,
    biasFlags,
    // No recommendation in this text. The interviewer's call is appended at
    // render time from the live selection — baking it in here produced an ATS
    // record that kept asserting a decision the interviewer had since changed.
    atsSafeSummary: `${feedback.candidateName} interviewed for ${rated.length ? `${rated.length} assessed competencies` : 'this role'}, averaging ${avg.toFixed(1)}/5${high.length ? `, with strongest performance in ${high.map((s) => s.competency).join(' and ')}` : ''}. Evaluation was against a role-specific rubric with identical standard questions across candidates.`,
  };
}
