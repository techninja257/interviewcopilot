export const SENIORITY_LEVELS = [
  'Junior',
  'Mid-Level',
  'Senior',
  'Staff',
  'Principal',
  'Director',
] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const INTERVIEW_ROUNDS = [
  'Screening',
  'Technical Deep-Dive',
  'Behavioral',
  'System Design',
  'Bar-Raiser',
  'Leadership',
] as const;
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export interface RoleSetupInput {
  jobTitle: string;
  seniorityLevel: SeniorityLevel;
  department?: string;
  teamContext?: string;
  jobDescription: string;
  interviewRound: InterviewRound;
  numQuestions: number;
}

export interface Competency {
  name: string;
  jdEvidence: string;
  category: 'technical' | 'behavioral' | 'leadership';
}

export interface ScoringRubric {
  score1: string;
  score3: string;
  score5: string;
}

export interface BiasCheck {
  status: 'pass' | 'warning';
  note: string | null;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  competency: string;
  reasoning: string;
  /** Verbatim quote from the submitted JD. Validated client-side — see grounding.ts */
  jdEvidence: string;
  followUps: string[];
  scoringRubric: ScoringRubric;
  redFlags: string[];
  estimatedMinutes: number;
  biasCheck: BiasCheck;
  source: 'standard' | 'personalized';
  /** Present only on personalized questions */
  resumeEvidence?: string;
}

export type HiringRecommendation = 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire';

export interface InterviewFeedback {
  candidateName: string;
  /**
   * Scored per question, against that question's own 1/3/5 rubric — the
   * anchors are what make scores comparable across candidates, and they only
   * exist at question level.
   */
  questionScores?: {
    questionId: string;
    question: string;
    competency: string;
    score: number;
    evidence?: string;
  }[];
  /**
   * Derived by averaging the questions that assess each competency. Kept as a
   * first-class field because the feedback agent reasons at competency level
   * and the ATS record is written at competency level.
   */
  competencyScores: { competency: string; score: number; notes?: string }[];
  /**
   * Absent until the interviewer picks one, and deliberately not defaulted.
   * The consistency check runs *before* this is chosen, so any placeholder
   * here would be a hiring decision the tool authored and then attributed to
   * the human — which is the one thing this product must never do.
   */
  overallRecommendation?: HiringRecommendation;
  overallNotes?: string;
}

export interface FeedbackAnalysis {
  summary: string[];
  inconsistencies: string[];
  /**
   * Factors for the interviewer to weigh before finalising their own call.
   * There is deliberately no `recommendation` here — the tool audits the
   * human's decision rather than issuing one of its own.
   */
  considerations: string[];
  biasFlags: string[];
  atsSafeSummary: string;
}

/** Per-agent wall-clock timing, surfaced in the stats bar and used in Day 4 evaluation. */
export interface AgentTiming {
  agent: string;
  ms: number;
}

export interface GroundingReport {
  total: number;
  grounded: number;
  ungrounded: { questionId: string; claimedEvidence: string }[];
}

export interface Session {
  id: string;
  createdAt: string;
  roleSetup: RoleSetupInput;
  competencies: Competency[];
  questions: GeneratedQuestion[];
  candidateName?: string;
  resumeText?: string;
  /** Name of the uploaded PDF, kept so the upload survives a reload. */
  resumeFileName?: string;
  feedback?: InterviewFeedback;
  feedbackAnalysis?: FeedbackAnalysis;
  timings: AgentTiming[];
  grounding?: GroundingReport;
  resumeGrounding?: GroundingReport;
}

export type GenerationStage =
  | 'idle'
  | 'parsing'
  | 'generating'
  | 'auditing'
  | 'personalizing'
  | 'analyzing';
