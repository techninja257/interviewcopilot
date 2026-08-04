import type {
  Competency,
  GeneratedQuestion,
  InterviewFeedback,
  InterviewRound,
  RoleSetupInput,
} from '../types';

/**
 * Shared preamble. Kept byte-stable so it stays a cacheable prefix across
 * all four agents — see the caching note in chain.ts.
 */
export const SYSTEM_PREAMBLE = `You are InterviewCopilot, an expert at designing structured interviews for technical hiring teams.

You work the way a good interviewing coach does: every question you write is anchored to something the role actually requires, and every question comes with a way to tell a strong answer from a weak one.

Principles:

1. Ground everything. Each question traces to a specific requirement in the job description. When you cite that requirement, quote it verbatim — copy the exact words from the source text, character for character. Never paraphrase a quote, and never invent a requirement that is not in the text you were given. If the job description does not support a question you want to ask, do not ask it.

2. Calibrate to seniority. A question for a Junior engineer and a question for a Staff engineer differ in kind, not just difficulty. Junior questions probe fundamentals and learning; senior questions probe judgment, tradeoffs, and what the candidate learned from being wrong.

3. Make rubrics discriminating. A rubric level should describe what an answer at that level actually sounds like for this specific question — not generic phrases like "demonstrates strong knowledge." The 1 and the 5 should be recognisably different to someone who has never interviewed before.

4. Stay compliant. Never write a question that touches age, family or marital status, national origin, religion, disability, pregnancy, or any other protected characteristic. Do not use graduation years or total years of experience as proxies for age. Questions about role scope, motivation, and past work are fine.

5. Write for a busy human. The interviewer reads this fifteen minutes before the call. Be direct and concrete. No filler, no restating the question inside the reasoning.`;

export function buildCompetencyPrompt(input: RoleSetupInput): string {
  return `Extract the competencies this interview should assess, using only the job description below.

Role: ${input.jobTitle}
Seniority: ${input.seniorityLevel}
${input.department ? `Department: ${input.department}\n` : ''}${input.teamContext ? `Team context: ${input.teamContext}\n` : ''}
Job description:
"""
${input.jobDescription}
"""

Identify 4-6 competencies that this specific role depends on. For each one, quote verbatim the sentence or clause from the job description above that establishes it.

Derive every competency from the text itself. Do not fall back on a standard list of engineering competencies, and do not add one because it is common for this job title — if the job description does not support it, leave it out. Two roles with the same title should produce different competencies here when their job descriptions differ.

Name each competency in the job description's own vocabulary rather than a generic label: prefer the specific capability the text describes over a broad category it might fall under. Prefer competencies the job description emphasises or repeats over ones it mentions in passing.

The team context above, if present, tells you how the role operates day to day. Use it to judge which requirements matter most — but never as a source of competencies on its own.`;
}

/**
 * What each round is actually for. Without this the round name is just a
 * string in the prompt, and the model leans on the phrase alone — which works
 * for "System Design" but not for "Bar-Raiser" or "Screening", where measured
 * output was near-identical. Each entry fixes the stance (hypothetical vs
 * retrospective), the depth, and — critically — what a 5 means, since a 5 at
 * screening and a 5 at a bar-raiser are not the same bar.
 */
const ROUND_BRIEFS: Record<InterviewRound, string> = {
  Screening: `This is a first-pass filter, usually 30 minutes, often run by a recruiter or a busy engineer. Its only job is to decide whether this candidate is worth a deep technical round — not to grade them finely.

Ask broad questions that a qualified candidate answers comfortably in 3-5 minutes and an unqualified one cannot fake. Confirm the basics are real: have they actually done this work, at roughly this scale? Stay on claims that are quick to verify. Do not run a deep architectural exercise, and do not chase edge cases.

Rubric bar: a 5 means "clearly clears the bar, advance them" — solid, specific, first-hand experience. It does NOT mean world-class. A 3 is "plausible but thin, probe further". A 1 is a genuine disqualifier: they cannot describe the work concretely at all.`,

  'Technical Deep-Dive': `This is a focused technical examination of work the candidate has actually done, usually 60 minutes with an engineer who knows the domain.

Anchor each question in the candidate's real experience, then go deep: mechanism, tradeoffs, what they measured, what they would do differently. The interesting part is always the second and third layer, so the follow-ups should push toward specifics — numbers, failure modes, the option they rejected and why.

Rubric bar: a 5 requires demonstrated depth — precise mechanics, honest tradeoffs, evidence they understood the system rather than operated it. Surface-level fluency is a 3.`,

  Behavioral: `This is about how the candidate works with people and handles difficulty, usually 45 minutes.

Every question must be retrospective and about a specific past situation, not a hypothetical. Target collaboration, conflict, ownership, influence without authority, and how they respond to being wrong. Technical content is only the setting — what you are assessing is the behaviour inside it. Follow-ups should pull for the candidate's own role ("what did YOU do") and for what they learned.

Rubric bar: a 5 shows self-awareness and takes real responsibility, including for what went badly. Answers where everything went well and nothing was the candidate's fault are a 2 at best, however polished.`,

  'System Design': `This is a forward-looking design exercise, usually 60 minutes at a whiteboard.

Pose hypothetical design problems grounded in the scale the job description names. Ask the candidate to design something, not to recall something. Good questions here are open-ended with no single right answer, and they should force explicit tradeoffs — consistency vs availability, cost vs latency, build vs buy. Follow-ups should add constraints and see whether the design survives.

Rubric bar: a 5 drives the design themselves, states assumptions unprompted, and reasons quantitatively about capacity and failure. Naming technologies without justifying them is a 2.`,

  'Bar-Raiser': `This is the round that protects the hiring bar, run by an experienced interviewer outside the hiring team who is explicitly empowered to say no. It is the LAST round, not the first — the candidate has already passed the technical screens, so re-verifying basics is wasted time.

Probe judgment under ambiguity and the ceiling of the candidate's ability. The best questions here surface how they behave when the answer is not clean: a decision they got wrong and how they discovered it, a tradeoff with no good option, where they think their own approach breaks down. Push past the rehearsed answer — every question should have a follow-up the candidate cannot have prepared.

Rubric bar: a 5 means "this person raises the average of the team" — strong evidence of judgment, intellectual honesty about their own limits, and depth that holds up under pressure. Competent-but-unremarkable is a 3, and a 3 here is not a hire.`,

  Leadership: `This is about scope of influence beyond the candidate's own output, usually 45-60 minutes, for senior and above.

Target the things that only show up at scale: setting technical direction, growing engineers, driving decisions across teams that do not report to them, and choosing what NOT to do. Ask about outcomes they owned rather than tasks they completed. Where a technical competency is in play, ask about it at the level of strategy and delegation rather than implementation.

Rubric bar: a 5 shows durable impact through other people — engineers who grew, standards that outlived the project, decisions that held. Describing personal technical output, however strong, is a 2 for this round.`,
};

export function buildQuestionPrompt(input: RoleSetupInput, competencies: Competency[]): string {
  return `Write ${input.numQuestions} interview questions for this role.

Role: ${input.jobTitle} (${input.seniorityLevel})
Interview round: ${input.interviewRound}
${input.teamContext ? `Team context: ${input.teamContext}\n` : ''}
Competencies to assess, with the job description text each came from:
${competencies.map((c) => `- ${c.name} [${c.category}] — from the JD: "${c.jdEvidence}"`).join('\n')}

Full job description for reference:
"""
${input.jobDescription}
"""

What a ${input.interviewRound} round is for:
${ROUND_BRIEFS[input.interviewRound]}

Cover the competencies above; it is fine for one competency to get two questions if the role clearly weights it heavily.

Write every question for this round specifically. The same competency asked at two different rounds should produce genuinely different questions — different framing, different depth, different follow-ups — not the same question with a different opening verb. Before you write each one, ask yourself what this round needs that the others do not, and let that decide the question.

Apply the round's rubric bar above when writing the 1/3/5 levels. The rubric describes what an answer sounds like at THIS round, so the same answer can be a 5 in one round and a 3 in another — do not write rubrics that would be interchangeable across rounds.

For each question, quote verbatim in jdEvidence the exact sentence or clause from the job description that motivates it. Copy the text character for character from the job description above.

Estimated minutes should be realistic for the question plus its follow-ups, and should sum to a sensible length for this round.`;
}

export function buildPersonalizePrompt({
  input,
  competencies,
  standardQuestions,
  resumeText,
  candidateName,
  count,
}: {
  input: RoleSetupInput;
  competencies: Competency[];
  standardQuestions: GeneratedQuestion[];
  resumeText: string;
  candidateName: string;
  count: number;
}): string {
  return `Write ${count} candidate-specific interview questions for ${candidateName}.

Role: ${input.jobTitle} (${input.seniorityLevel})

Competencies for this role:
${competencies.map((c) => `- ${c.name} — from the JD: "${c.jdEvidence}"`).join('\n')}

Standard questions already in the guide (do NOT duplicate these — your questions must cover different ground):
${standardQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}

Candidate resume:
"""
${resumeText}
"""

Write questions that do something the standard questions cannot: verify a specific claim the candidate made, test a gap between the resume and the role's requirements, or press on an accomplishment whose costs the resume does not mention.

The best questions here are the ones a hiring manager would think of after reading the resume carefully — they name a specific project, number, or transition from the resume and ask what the resume does not say.

For each question, quote verbatim in resumeEvidence the exact line from the resume it draws on, and in jdEvidence the exact job description requirement it connects to.

If you notice a resume signal that is sensitive to ask about — a career gap, a title change, a non-linear path — you may ask about role scope, motivation, or the work itself, but never about the reasons a person might have been away from work.`;
}

export function buildBiasAuditPrompt(questions: { question: string; followUps: string[] }[]): string {
  return `Audit these interview questions for legal and fairness risk. You did not write them; review them as a compliance reviewer would.

Record your findings by calling the record_audit tool. Do not write the audit as prose, a table, or a summary — the only output is the tool call, with exactly one entry per question below.

${questions
  .map(
    (q, i) =>
      `[${i}] ${q.question}\n    Follow-ups: ${q.followUps.map((f) => `"${f}"`).join('; ')}`,
  )
  .join('\n\n')}

For each question, return an audit entry with its index.

Flag as "warning" if the question or any follow-up:
- touches a protected characteristic (age, family or marital status, national origin, religion, disability, pregnancy, sexual orientation)
- uses a proxy for one — graduation year, total years of experience, "culture fit", "energy", questions about personal life
- invites the interviewer into subjective impression rather than observed evidence
- would be hard to ask consistently across candidates

Mark "pass" with an empty note otherwise. Do not manufacture warnings for questions that are genuinely fine — a guide where everything is flagged is a guide the interviewer stops reading. When you do flag something, the note should say what specifically creates the risk and how to get the same signal compliantly.

Call record_audit now with one entry per question, in index order.`;
}

export function buildFeedbackPrompt({
  feedback,
  questions,
  input,
}: {
  feedback: InterviewFeedback;
  questions: GeneratedQuestion[];
  input: RoleSetupInput;
}): string {
  return `Review this interview feedback for internal consistency before it goes into the hiring record.

Role: ${input.jobTitle} (${input.seniorityLevel}) — ${input.interviewRound}
Candidate: ${feedback.candidateName}

Competency scores:
${feedback.competencyScores
  .map(
    (s) =>
      `- ${s.competency}: ${s.score > 0 ? `${s.score}/5` : 'unrated'}${s.notes ? ` — "${s.notes}"` : ''}`,
  )
  .join('\n')}

Overall recommendation: ${
    feedback.overallRecommendation ??
    'NOT YET RECORDED — the interviewer reviews this analysis before deciding. Do not assume, suggest, or infer what it will be.'
  }

The interviewer's closing summary — their own synthesis across the whole
conversation, written separately from the per-question evidence below. Where
the two disagree, that gap is exactly what you are looking for:
"""
${feedback.overallNotes ?? '(none provided)'}
"""

Per-question record — the score, the rubric it was scored against, and the
interviewer's verbatim note of what the candidate actually said. This is the
primary evidence: check each score against the note directly beneath it.
${questions
  .map((q, i) => {
    const captured = feedback.questionScores?.find((s) => s.questionId === q.id);
    const score = captured?.score ? `${captured.score}/5` : 'unscored';
    const evidence = captured?.evidence?.trim();
    return [
      `${i + 1}. ${q.question}`,
      `   Competency: ${q.competency} — scored ${score}`,
      `   Rubric: 1 = ${q.scoringRubric.score1} | 3 = ${q.scoringRubric.score3} | 5 = ${q.scoringRubric.score5}`,
      `   Evidence recorded: ${evidence ? `"""${evidence}"""` : '(nothing recorded)'}`,
    ].join('\n');
  })
  .join('\n\n')}

Your job is to catch the things a hiring manager would want caught before a debrief:

- A question score that its own recorded evidence does not support — a 5 whose note describes a thin answer, or a 1 whose note describes a strong one. Quote the score and the note together so the interviewer can see the tension.
- A score recorded with no evidence at all, or evidence too vague to justify the number.
- Evidence that sits below the level-3 rubric anchor but was scored above it, or vice versa. The anchors are the standard; use them.
- A final summary that does not follow from the per-question evidence — a conclusion the individual answers do not support, or a strong answer the summary omits entirely.
- If — and only if — a recommendation has been recorded above: one that does not follow from the individual scores. If it says NOT YET RECORDED, skip this check entirely rather than speculating about what the interviewer will choose.
- Language that describes an impression rather than a behaviour, and should be restated in terms of what the candidate actually did or said.

Be specific and quote the actual text. If the feedback is internally consistent, return an empty inconsistencies array rather than inventing a concern — a false flag costs the interviewer's trust.

You are reviewing a decision, not making one — and in most runs the decision has not been made yet, because the interviewer reads this analysis first. Any recommendation shown above belongs to them and stands as theirs: do not restate it as your own conclusion, do not endorse it, and do not propose an alternative verdict. Never write that the candidate should or should not be hired, and never guess at a verdict that has not been recorded.

In "considerations", give the interviewer what they need to weigh before they decide: evidence that cuts against the pattern in the scores, a competency the interview left unresolved, or a question the scores raise but do not answer. Phrase each one as something to weigh, not as a conclusion to accept.

"atsSafeSummary" must describe only what was assessed and what the evidence showed. Do not state, imply, or refer to a hiring recommendation in it — the recommendation is recorded separately and appended by the interviewer, and a summary that names one would put words in their mouth.`;
}
