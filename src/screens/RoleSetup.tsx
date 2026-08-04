import { useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Input,
  SegmentedControl,
  Select,
  Slider,
  TextArea,
} from '../components/ui';
import { SAMPLE_ROLE_SETUP } from '../data/sampleSession';
import { useApp } from '../context/AppContext';
import { runRoleChain } from '../agents/chain';
import { checkGrounding } from '../agents/grounding';
import { INTERVIEW_ROUNDS, SENIORITY_LEVELS } from '../types';
import type { InterviewRound, RoleSetupInput, SeniorityLevel } from '../types';
import './screens.css';

const BLANK: RoleSetupInput = {
  jobTitle: '',
  seniorityLevel: 'Senior',
  department: '',
  teamContext: '',
  jobDescription: '',
  interviewRound: 'Technical Deep-Dive',
  numQuestions: 6,
};

export function RoleSetup() {
  const { roleSetup, questions, competencies, isDemo, isGenerating, stage, error, dispatch, goTo } =
    useApp();
  const [form, setForm] = useState<RoleSetupInput>(roleSetup ?? BLANK);
  const [touched, setTouched] = useState(false);

  const jdTooShort = form.jobDescription.trim().length < 100;
  const titleTooShort = form.jobTitle.trim().length < 3;
  const invalid = jdTooShort || titleTooShort;

  function update<K extends keyof RoleSetupInput>(key: K, value: RoleSetupInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerate() {
    setTouched(true);
    if (invalid) return;

    dispatch({ type: 'SET_ROLE_SETUP', data: form });
    dispatch({ type: 'SET_ERROR', error: null });
    dispatch({ type: 'SET_GENERATING', isGenerating: true, stage: 'parsing' });

    try {
      const result = await runRoleChain(form, (s) =>
        dispatch({ type: 'SET_GENERATING', isGenerating: true, stage: s }),
      );
      dispatch({
        type: 'SET_GENERATION',
        competencies: result.competencies,
        questions: result.questions,
      });
      dispatch({ type: 'SET_TIMINGS', timings: result.timings });
      dispatch({
        type: 'SET_GROUNDING',
        grounding: checkGrounding(result.questions, form.jobDescription),
      });
      for (const entry of result.raw) {
        dispatch({ type: 'LOG_RAW', agent: entry.agent, response: entry.response });
      }
      dispatch({ type: 'SET_GENERATING', isGenerating: false });
      dispatch({ type: 'COMPLETE_STEP', step: 1 });
      goTo(2);
    } catch (e) {
      dispatch({
        type: 'SET_ERROR',
        error: e instanceof Error ? e.message : 'Generation failed. Please try again.',
      });
    }
  }

  return (
    <div className="split">
      {/* Left: form */}
      <section className="split-form">
        <header className="screen-head">
          <h1 className="screen-title">Create an interview guide</h1>
          <p className="screen-sub">
            Paste a job description and we'll extract the competencies, then write questions with
            reasoning, rubrics, and a compliance check.
          </p>
        </header>

        <div className="card form-card">
          <Input
            id="jobTitle"
            label="Job title"
            placeholder="e.g. Senior Backend Engineer"
            value={form.jobTitle}
            onChange={(e) => update('jobTitle', e.target.value)}
            error={touched && titleTooShort ? 'Enter at least 3 characters.' : undefined}
          />

          <Select
            id="seniority"
            label="Seniority level"
            value={form.seniorityLevel}
            onChange={(e) => update('seniorityLevel', e.target.value as SeniorityLevel)}
          >
            {SENIORITY_LEVELS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>

          <Input
            id="team"
            label="Team context"
            placeholder="e.g. Platform Team — 8 engineers, microservices on Kubernetes"
            hint="Helps calibrate questions to how the team actually works."
            value={form.teamContext}
            onChange={(e) => update('teamContext', e.target.value)}
          />

          <TextArea
            id="jd"
            label="Job description"
            placeholder="Paste the full job description here…"
            rows={9}
            value={form.jobDescription}
            onChange={(e) => update('jobDescription', e.target.value)}
            error={
              touched && jdTooShort
                ? 'Paste at least 100 characters so there is enough to ground questions in.'
                : undefined
            }
            hint={`${form.jobDescription.trim().length} characters`}
          />

          <SegmentedControl
            label="Interview round"
            options={INTERVIEW_ROUNDS}
            value={form.interviewRound}
            onChange={(v) => update('interviewRound', v as InterviewRound)}
          />

          <Slider
            label="Number of standard questions"
            min={4}
            max={10}
            value={form.numQuestions}
            onChange={(v) => update('numQuestions', v)}
          />

          {error && (
            <div className="inline-error">
              <Icon name="error" filled />
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            full
            icon="auto_awesome"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate interview guide'}
          </Button>

          <button className="text-link" onClick={() => setForm(SAMPLE_ROLE_SETUP)}>
            Load the sample Senior Backend Engineer role
          </button>
        </div>
      </section>

      {/* Right: live preview */}
      <aside className="split-preview">
        <div className="preview">
          <div className="preview-head">
            <span className="preview-title">
              <Icon name="neurology" /> Live preview
            </span>
            {questions.length > 0 && !isGenerating && (
              <Button variant="ghost" size="sm" trailingIcon="arrow_forward" onClick={() => goTo(2)}>
                Open guide
              </Button>
            )}
          </div>

          <div className="preview-body">
            <div className="preview-dots" />

            {isGenerating ? (
              <GenerationProgress stage={stage} />
            ) : questions.length > 0 ? (
              <div className="preview-stack">
                <div className="chip-row">
                  {competencies.slice(0, 5).map((c) => (
                    <Chip key={c.name} tone="flame">
                      {c.name}
                    </Chip>
                  ))}
                </div>
                {questions.slice(0, 4).map((q, i) => (
                  <div key={q.id} className="peek">
                    <span className="peek-num">{i + 1}</span>
                    <div>
                      <p className="peek-q">{q.question}</p>
                      <p className="peek-meta">
                        {q.competency} · {q.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                ))}
                {questions.length > 4 && (
                  <p className="peek-more">+{questions.length - 4} more in the full guide</p>
                )}
              </div>
            ) : (
              <EmptyState icon="draft" title="Your guide will appear here">
                {isDemo
                  ? 'Demo data is loaded — open the guide to see a finished briefing pack.'
                  : 'Fill in the role details and generate to see questions, rubrics, and the bias audit.'}
              </EmptyState>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

const STAGES = [
  { id: 'parsing', label: 'Reading the job description' },
  { id: 'generating', label: 'Writing questions and rubrics' },
  { id: 'auditing', label: 'Auditing for bias and compliance' },
];

function GenerationProgress({ stage }: { stage: string }) {
  const activeIndex = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className="preview-stack">
      <div className="progress">
        {STAGES.map((s, i) => {
          const done = activeIndex > i;
          const active = activeIndex === i;
          return (
            <div
              key={s.id}
              className={`progress-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
            >
              {done ? <Icon name="check_circle" filled /> : active ? <span className="spinner" /> : <Icon name="circle" />}
              {s.label}
            </div>
          );
        })}
      </div>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="helper" style={{ textAlign: 'center' }}>
        Usually 30–60 seconds.
      </p>
    </div>
  );
}
