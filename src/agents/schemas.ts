/**
 * Tool input schemas. These are the contract between the model and the UI —
 * forcing a tool call means the model cannot return a shape the renderer
 * can't handle, which is the main failure mode we're designing against.
 */

export const competencySchema = {
  type: 'object',
  properties: {
    competencies: {
      type: 'array',
      minItems: 4,
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short competency name, 2-4 words.' },
          jdEvidence: {
            type: 'string',
            description:
              'A VERBATIM sentence or clause copied exactly from the job description that this competency comes from. Do not paraphrase.',
          },
          category: { type: 'string', enum: ['technical', 'behavioral', 'leadership'] },
        },
        required: ['name', 'jdEvidence', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['competencies'],
  additionalProperties: false,
} as const;

const questionProperties = {
  question: {
    type: 'string',
    description: 'The interview question. Open-ended, specific to this role, no compound questions.',
  },
  competency: { type: 'string', description: 'Which competency this assesses.' },
  reasoning: {
    type: 'string',
    description:
      '2-3 sentences explaining why this is the right question for this role and seniority, and what it distinguishes between candidates.',
  },
  jdEvidence: {
    type: 'string',
    description:
      'A VERBATIM sentence or clause copied exactly from the job description that motivates this question. Copy it character for character. Do not paraphrase or summarise.',
  },
  followUps: {
    type: 'array',
    minItems: 2,
    maxItems: 3,
    items: { type: 'string' },
    description: 'Follow-up questions that dig into the answer.',
  },
  scoringRubric: {
    type: 'object',
    properties: {
      score1: { type: 'string', description: 'What a weak answer looks like, specific to this question.' },
      score3: { type: 'string', description: 'What an adequate answer looks like.' },
      score5: { type: 'string', description: 'What an exceptional answer looks like at this seniority.' },
    },
    required: ['score1', 'score3', 'score5'],
    additionalProperties: false,
  },
  redFlags: {
    type: 'array',
    minItems: 2,
    maxItems: 4,
    items: { type: 'string' },
    description: 'Specific things in an answer that should concern the interviewer.',
  },
  estimatedMinutes: {
    type: 'integer',
    minimum: 5,
    maximum: 25,
    description: 'Realistic time for the question plus follow-ups.',
  },
} as const;

export const questionSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: questionProperties,
        required: [
          'question',
          'competency',
          'reasoning',
          'jdEvidence',
          'followUps',
          'scoringRubric',
          'redFlags',
          'estimatedMinutes',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
} as const;

export const personalizedSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...questionProperties,
          resumeEvidence: {
            type: 'string',
            description:
              'A VERBATIM line copied exactly from the candidate resume that this question draws on. Copy it character for character.',
          },
        },
        required: [
          'question',
          'competency',
          'reasoning',
          'jdEvidence',
          'resumeEvidence',
          'followUps',
          'scoringRubric',
          'redFlags',
          'estimatedMinutes',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
} as const;

/**
 * Bias audit runs as its own pass rather than as a field on the generator —
 * a model grading its own output in the same call has an obvious conflict.
 */
export const biasAuditSchema = {
  type: 'object',
  properties: {
    audits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Zero-based index of the question being audited.' },
          status: { type: 'string', enum: ['pass', 'warning'] },
          note: {
            type: 'string',
            description:
              'If status is warning, what the risk is and how to ask it compliantly. Empty string when status is pass.',
          },
        },
        required: ['index', 'status', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['audits'],
  additionalProperties: false,
} as const;

export const feedbackSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string' },
      description: 'Key signals from the interview — strengths and weaknesses with evidence.',
    },
    inconsistencies: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Places where the numeric scores contradict the written notes, or where a score has no supporting evidence. Empty array if none. Quote both sides of the contradiction.',
    },
    // Deliberately absent: a recommendation field. A hiring verdict attached to
    // a named person is an employment decision, and the tool must not make one —
    // it audits the interviewer's judgement instead. What the model returns here
    // are considerations for the human, never a conclusion.
    considerations: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: { type: 'string' },
      description:
        "Factors the interviewer should weigh before making THEIR recommendation — evidence that cuts against the pattern in the scores, gaps the interview did not cover, or a competency the scores leave unresolved. Usually no recommendation has been recorded yet, so never state, imply, or anticipate a hire/no-hire conclusion; raise the consideration and leave the decision open.",
    },
    biasFlags: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Subjective or non-evidence-based language in the notes (e.g. "culture fit", "not a self-starter") that should be restated as observed behaviour. Empty array if none.',
    },
    atsSafeSummary: {
      type: 'string',
      description:
        'A defensible summary suitable for the ATS record: evidence-based, no protected characteristics, no unsupported inference. Must NOT state or imply a hiring recommendation — the interviewer records that separately and it is appended to this text.',
    },
  },
  required: ['summary', 'inconsistencies', 'considerations', 'biasFlags', 'atsSafeSummary'],
  additionalProperties: false,
} as const;
