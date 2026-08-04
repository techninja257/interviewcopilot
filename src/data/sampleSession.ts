import type { Competency, GeneratedQuestion, RoleSetupInput, Session } from '../types';

export const SAMPLE_JD = `Senior Backend Engineer — Platform Team

About the role
We're looking for a Senior Backend Engineer to join our Platform team, an 8-person group that owns the core services powering our product. You'll design and operate the systems that everything else depends on.

What you'll do
- Design and build backend services handling 1M+ requests per day, with a p99 latency budget of 200ms.
- Own PostgreSQL schema design and migrations at 10k+ QPS, including zero-downtime migrations on live tables.
- Debug and resolve production incidents across a distributed microservices architecture, using distributed tracing and structured logging.
- Lead technical design reviews and mentor mid-level engineers on the team.
- Partner with Product to scope roadmap work and make build-vs-buy calls on infrastructure.
- Improve our observability tooling and reduce mean-time-to-resolution for on-call incidents.

What we're looking for
- 5+ years building production backend systems, ideally in Go or Java.
- Deep experience with distributed systems concepts: consistency models, partition tolerance, idempotency, and backpressure.
- A track record of owning services end to end, from design through on-call.
- Experience with event-driven architectures (Kafka or similar) and the tradeoffs against synchronous RPC.
- Strong written communication — we write design docs before we write code.
- Comfort operating in ambiguity and driving decisions when requirements are unclear.

Nice to have
- Experience with Kubernetes and infrastructure-as-code.
- Prior work on developer platform or internal tooling teams.`;

export const SAMPLE_RESUME = `Alex Rivera
Senior Software Engineer | alex.rivera@example.com

EXPERIENCE

Staff Engineer, Meridian Logistics (2022–Present)
- Led migration of the order-routing monolith to 6 microservices on Kubernetes, cutting deploy time from 40min to 4min.
- Designed an event-driven inventory sync using Kafka, processing 2M events/day across 14 warehouses.
- Reduced p99 API latency from 800ms to 190ms by introducing a Redis read-through cache and query optimization.
- Mentored 3 mid-level engineers; ran the team's design review process.

Senior Backend Engineer, Nimbus Data (2019–2022)
- Built and operated a multi-tenant metrics ingestion pipeline in Go handling 500k writes/min.
- Owned on-call rotation for 4 production services; drove MTTR from 45min to 12min via better runbooks and alerting.
- Migrated primary datastore from MongoDB to PostgreSQL with zero customer-visible downtime.

Backend Engineer, Corvid Health (2017–2019)
- Developed HIPAA-compliant patient record APIs in Python/Django.
- Implemented audit logging across the platform.

SKILLS
Go, Python, Java, PostgreSQL, Kafka, Redis, Kubernetes, Terraform, gRPC, distributed tracing (Jaeger)

EDUCATION
B.S. Computer Science, University of Washington`;

export const SAMPLE_ROLE_SETUP: RoleSetupInput = {
  jobTitle: 'Senior Backend Engineer',
  seniorityLevel: 'Senior',
  department: 'Platform Engineering',
  teamContext: 'Platform Team — 8 engineers, microservices architecture on Kubernetes',
  jobDescription: SAMPLE_JD,
  interviewRound: 'Technical Deep-Dive',
  numQuestions: 6,
};

export const SAMPLE_COMPETENCIES: Competency[] = [
  {
    name: 'Distributed Systems Design',
    jdEvidence: 'Design and build backend services handling 1M+ requests per day, with a p99 latency budget of 200ms.',
    category: 'technical',
  },
  {
    name: 'Data Modeling & Migrations',
    jdEvidence: 'Own PostgreSQL schema design and migrations at 10k+ QPS, including zero-downtime migrations on live tables.',
    category: 'technical',
  },
  {
    name: 'Production Debugging',
    jdEvidence: 'Debug and resolve production incidents across a distributed microservices architecture, using distributed tracing and structured logging.',
    category: 'technical',
  },
  {
    name: 'Technical Leadership',
    jdEvidence: 'Lead technical design reviews and mentor mid-level engineers on the team.',
    category: 'leadership',
  },
  {
    name: 'Ownership & Operational Rigor',
    jdEvidence: 'A track record of owning services end to end, from design through on-call.',
    category: 'behavioral',
  },
  {
    name: 'Decision-Making in Ambiguity',
    jdEvidence: 'Comfort operating in ambiguity and driving decisions when requirements are unclear.',
    category: 'behavioral',
  },
];

export const SAMPLE_QUESTIONS: GeneratedQuestion[] = [
  {
    id: 'q1',
    question:
      'Walk me through how you would design a service to handle 1M requests per day with a p99 latency budget of 200ms. Where would you expect the first bottleneck, and how would you find it before it hit production?',
    competency: 'Distributed Systems Design',
    reasoning:
      'This role owns the core services everything else depends on, so the bar is not "can you name caching strategies" but "can you reason about where a system breaks under load and instrument for it in advance." The p99 framing tests whether the candidate distinguishes average from tail latency — a common gap in engineers who have not owned a latency SLO.',
    jdEvidence:
      'Design and build backend services handling 1M+ requests per day, with a p99 latency budget of 200ms.',
    followUps: [
      'What would you measure to know the design was working, and what alert would you set on it?',
      'Where does the p99 diverge from the median in your design, and why?',
      'How would you load-test this before launch without a production traffic replay?',
    ],
    scoringRubric: {
      score1:
        'Lists technologies without connecting them to the load profile. Treats 1M/day as inherently large without computing the actual request rate (~12 req/s average) or reasoning about peak-to-average ratio.',
      score3:
        'Sketches a reasonable architecture with caching and horizontal scaling. Mentions monitoring but is vague on which metrics matter or where tail latency comes from.',
      score5:
        'Computes the real load, identifies peak multipliers, and reasons about specific tail-latency sources such as connection pool saturation, GC pauses, or a slow dependency. Names the instrumentation they would add before launch and the specific alert thresholds.',
    },
    redFlags: [
      'Reaches for microservices or Kubernetes as a default answer without a load-driven reason.',
      'Cannot articulate the difference between p50 and p99, or why the latter is what users feel.',
      'No mention of how they would validate the design before it takes real traffic.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'standard',
  },
  {
    id: 'q2',
    question:
      'Describe a schema migration you ran on a live, high-traffic table. What was the rollback plan, and at what point would you have triggered it?',
    competency: 'Data Modeling & Migrations',
    reasoning:
      'The JD calls for zero-downtime migrations at 10k+ QPS, which is a materially different skill from writing a migration file. Asking for the rollback plan and its trigger point separates engineers who have actually been on the hook for one from those who have only read about the expand-contract pattern.',
    jdEvidence:
      'Own PostgreSQL schema design and migrations at 10k+ QPS, including zero-downtime migrations on live tables.',
    followUps: [
      'How did you handle the window where old and new code both had to work against the schema?',
      'What did you do about locks — did you hit any, and how did you avoid or mitigate them?',
      'How long did the migration run, and how did you monitor it while it was in flight?',
    ],
    scoringRubric: {
      score1:
        'Describes running a migration in a maintenance window, or has only worked with migrations on low-traffic tables. No rollback plan beyond "restore from backup."',
      score3:
        'Knows the expand-contract or dual-write pattern and describes it correctly. Rollback plan exists but the trigger condition is fuzzy.',
      score5:
        'Describes the multi-phase rollout concretely, including backfill strategy and lock avoidance. Rollback plan has a specific, measurable trigger and was rehearsed. Mentions what they monitored during the migration.',
    },
    redFlags: [
      'Assumes downtime is acceptable without asking whether it is.',
      'Unaware that adding a column with a default, or an index, can lock a table in some Postgres versions.',
      'No backfill strategy for existing rows.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'standard',
  },
  {
    id: 'q3',
    question:
      'Tell me about a production incident in a distributed system where the obvious cause turned out to be wrong. How did you find the real one?',
    competency: 'Production Debugging',
    reasoning:
      'This role debugs incidents across microservices where the failing service is frequently not the broken one. Framing the question around a misleading first hypothesis tests systematic methodology rather than pattern-matching, and surfaces whether the candidate reasons from evidence or from intuition.',
    jdEvidence:
      'Debug and resolve production incidents across a distributed microservices architecture, using distributed tracing and structured logging.',
    followUps: [
      'What signal first made you doubt the initial hypothesis?',
      'What tooling did you have, and what did you wish you had?',
      'What did you change afterward so the next person would find it faster?',
    ],
    scoringRubric: {
      score1:
        'Recounts an incident without a clear methodology. The resolution sounds like guesswork or the story is really about someone else solving it.',
      score3:
        'Describes a systematic approach using logs and metrics. Found the root cause but the follow-up work is thin or was left to someone else.',
      score5:
        'Articulates a hypothesis-driven method, describes the specific evidence that disconfirmed the first theory, and connects the fix to a durable improvement in tracing, alerting, or runbooks. Takes ownership of the postmortem.',
    },
    redFlags: [
      'Blames another team or "the infrastructure" without describing their own investigation.',
      'Cannot explain how they distinguished cause from symptom in a cascading failure.',
      'No follow-up action after the incident was mitigated.',
    ],
    estimatedMinutes: 20,
    biasCheck: { status: 'pass', note: null },
    source: 'standard',
  },
  {
    id: 'q4',
    question:
      'This team writes design docs before writing code. Tell me about a design doc of yours that changed significantly because of review feedback. What was the disagreement?',
    competency: 'Technical Leadership',
    reasoning:
      'The JD explicitly names design reviews and written communication as core to how the team works. Asking specifically about a doc that changed tests whether the candidate treats review as genuine collaboration or as a rubber-stamp step, and reveals how they handle technical disagreement.',
    jdEvidence: 'Lead technical design reviews and mentor mid-level engineers on the team.',
    followUps: [
      'Who pushed back, and what was their argument?',
      'What convinced you — or if you held your position, how did you resolve it?',
      'How do you run a design review when you are the one reviewing a more junior engineer\'s doc?',
    ],
    scoringRubric: {
      score1:
        'Cannot recall a doc that changed, or frames all review feedback as obstruction. Treats design docs as a formality.',
      score3:
        'Describes incorporating feedback constructively. The example is real but the technical substance of the disagreement is thin.',
      score5:
        'Gives a specific technical disagreement with both positions represented fairly, explains what actually changed their mind, and shows a deliberate approach to reviewing others\' work that builds their skills rather than just correcting them.',
    },
    redFlags: [
      'Every story positions them as the person who was right.',
      'Describes mentoring as doing the work for someone rather than developing them.',
      'Dismissive of written design as bureaucracy.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'standard',
  },
  {
    id: 'q5',
    question:
      'Tell me about a service you owned from design through on-call. What did operating it teach you that the design phase did not anticipate?',
    competency: 'Ownership & Operational Rigor',
    reasoning:
      'The JD asks for end-to-end ownership including on-call. The second half of the question is the load-bearing part: engineers who have genuinely carried a pager can name specific surprises, while those who handed off after launch tend to answer in generalities.',
    jdEvidence: 'A track record of owning services end to end, from design through on-call.',
    followUps: [
      'What was your worst page, and what did you change because of it?',
      'How did you decide what deserved an alert versus a dashboard?',
      'What would you tell the version of yourself who wrote the original design doc?',
    ],
    scoringRubric: {
      score1:
        'Has not carried on-call for their own service, or describes ownership as writing the code and handing it off.',
      score3:
        'Owned a service through operation and can describe the experience. Lessons are real but somewhat generic.',
      score5:
        'Names specific operational surprises and the concrete design changes that followed. Shows judgment about alert fatigue and can articulate a philosophy about what a page should mean.',
    },
    redFlags: [
      'Alerting philosophy amounts to "alert on everything."',
      'No examples of the design being wrong in ways that only production revealed.',
      'Treats on-call as an imposition rather than a feedback loop.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'standard',
  },
  {
    id: 'q6',
    question:
      'Describe a time you had to make a significant technical decision without clear requirements. How did you decide, and how did you make the decision reversible?',
    competency: 'Decision-Making in Ambiguity',
    reasoning:
      'The JD explicitly asks for comfort operating in ambiguity and driving decisions when requirements are unclear. The reversibility half of the question tests engineering judgment specifically — recognizing which decisions are one-way doors is what separates senior from mid-level in ambiguous conditions.',
    jdEvidence: 'Comfort operating in ambiguity and driving decisions when requirements are unclear.',
    followUps: [
      'What information did you try to get first, and when did you decide to stop waiting for it?',
      'Which parts of the decision were hard to reverse, and did you treat those differently?',
      'How did you communicate the uncertainty to stakeholders?',
    ],
    scoringRubric: {
      score1:
        'Waited for someone else to decide, or made a call with no articulated reasoning. Does not distinguish reversible from irreversible choices.',
      score3:
        'Made a reasonable decision and can explain the reasoning. Limited consideration of reversibility or of how to revisit the call later.',
      score5:
        'Describes a deliberate process for acting under uncertainty, explicitly identifies which parts were one-way doors, and structured the work so the reversible parts could be changed cheaply. Communicated the uncertainty rather than projecting false confidence.',
    },
    redFlags: [
      'Escalated the decision upward without forming a recommendation.',
      'Treats all decisions as equally weighty, or all as equally cheap to undo.',
      'Presented an uncertain call to stakeholders as settled.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'standard',
  },
];

export const SAMPLE_PERSONALIZED: GeneratedQuestion[] = [
  {
    id: 'p1',
    question:
      'Your resume says the Meridian migration cut deploy time from 40 minutes to 4. What did that migration make worse, and how did you handle it?',
    competency: 'Distributed Systems Design',
    reasoning:
      'The candidate leads with a strong headline metric on the monolith-to-microservices migration. Splitting a monolith almost always trades deployment speed for operational complexity and cross-service latency, so asking what got worse verifies genuine ownership rather than a rehearsed win, and probes whether they measured the costs as carefully as the benefits.',
    jdEvidence:
      'Debug and resolve production incidents across a distributed microservices architecture, using distributed tracing and structured logging.',
    resumeEvidence:
      'Led migration of the order-routing monolith to 6 microservices on Kubernetes, cutting deploy time from 40min to 4min.',
    followUps: [
      'How did the incident rate change in the six months after the split?',
      'How did you decide on six services rather than three or twelve?',
      'What debugging capability did you have to build that you did not need before?',
    ],
    scoringRubric: {
      score1:
        'Only recites the benefits. Cannot name a cost or claims the migration had no downsides.',
      score3:
        'Acknowledges added complexity in general terms and describes reasonable mitigations.',
      score5:
        'Names specific regressions with data, explains the service-boundary reasoning, and describes the observability investment the split forced. Shows the tradeoff was made deliberately rather than discovered afterward.',
    },
    redFlags: [
      'Presents the migration as purely positive.',
      'Cannot explain the reasoning behind the service boundaries.',
      'Attributes the deploy-time win entirely to the architecture with no mention of CI changes.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'personalized',
  },
  {
    id: 'p2',
    question:
      'You migrated MongoDB to PostgreSQL at Nimbus with zero customer-visible downtime. Walk me through the cutover itself — what was your rollback point, and how long were you dual-writing?',
    competency: 'Data Modeling & Migrations',
    reasoning:
      'This directly matches the role\'s zero-downtime migration requirement, and the candidate claims a harder version of it — a cross-datastore migration rather than a schema change. Pressing on the cutover mechanics and dual-write window verifies the claim and surfaces how they handled consistency between two live datastores.',
    jdEvidence:
      'Own PostgreSQL schema design and migrations at 10k+ QPS, including zero-downtime migrations on live tables.',
    resumeEvidence:
      'Migrated primary datastore from MongoDB to PostgreSQL with zero customer-visible downtime.',
    followUps: [
      'How did you verify the two datastores agreed before you cut reads over?',
      'What was the document-to-relational modeling decision that gave you the most trouble?',
      'Did you have to roll back at any point, and what would have triggered it?',
    ],
    scoringRubric: {
      score1:
        'Vague on the mechanics, or it becomes clear they were a participant rather than an owner. No verification step.',
      score3:
        'Describes dual-writing and a phased read cutover correctly, with a general sense of the validation approach.',
      score5:
        'Precise on the phase sequence and duration, describes a concrete reconciliation method for detecting divergence, and can discuss the modeling decisions that did not translate cleanly from documents to relations.',
    },
    redFlags: [
      'No reconciliation or verification between the two stores.',
      'Cannot describe what happens to writes that land mid-cutover.',
      'Uses "we" throughout without ever clarifying their own role.',
    ],
    estimatedMinutes: 15,
    biasCheck: { status: 'pass', note: null },
    source: 'personalized',
  },
  {
    id: 'p3',
    question:
      'You have been a Staff Engineer for four years, and this role is scoped at Senior. How do you think about that, and what would make this the right move for you?',
    competency: 'Technical Leadership',
    reasoning:
      'The candidate is applying to a role one level below their current title, which is a real signal worth understanding — it could indicate scope preference, a company-size change, or a title-inflation difference between organizations. Asking directly and neutrally addresses a genuine role-fit question about motivation and expectations, without touching any protected characteristic.',
    jdEvidence: 'Lead technical design reviews and mentor mid-level engineers on the team.',
    resumeEvidence: 'Staff Engineer, Meridian Logistics (2022–Present)',
    followUps: [
      'What parts of the Staff role do you want to keep doing, and what would you happily drop?',
      'How much of your time recently has been hands-on versus coordination?',
      'What does the next two years look like for you if this goes well?',
    ],
    scoringRubric: {
      score1:
        'Evasive about the motivation, or the answer suggests they expect the role to be re-scoped upward immediately after joining.',
      score3:
        'Gives a plausible reason and shows genuine interest in the work itself.',
      score5:
        'Clear-eyed about what they want their next few years to contain, honest about the tradeoff, and specific about why this team and problem space fit that. Expectations about scope and growth are explicit rather than assumed.',
    },
    redFlags: [
      'Treats the role as a stopgap.',
      'Expects a promotion timeline as a condition of joining.',
      'Cannot articulate anything specific that attracts them to this team.',
    ],
    estimatedMinutes: 10,
    biasCheck: {
      status: 'warning',
      note:
        'Keep this focused on role scope and motivation. Do not follow up on years of experience, graduation dates, or anything that could serve as an age proxy — those are EEOC risks and are not what this question is assessing.',
    },
    source: 'personalized',
  },
];

export function buildSampleSession(): Session {
  return {
    id: 'sample-senior-backend',
    createdAt: new Date().toISOString(),
    roleSetup: SAMPLE_ROLE_SETUP,
    competencies: SAMPLE_COMPETENCIES,
    questions: SAMPLE_QUESTIONS,
    timings: [
      { agent: 'Role parser', ms: 4120 },
      { agent: 'Question generator', ms: 31480 },
      { agent: 'Bias audit', ms: 6350 },
    ],
    grounding: { total: 6, grounded: 6, ungrounded: [] },
  };
}
