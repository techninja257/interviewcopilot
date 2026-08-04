import { useMemo, useState } from 'react';
import { Button, Callout, Chip, Icon } from '../components/ui';
import { QuestionCard } from '../components/domain/QuestionCard';
import { useApp } from '../context/AppContext';
import { toMarkdown } from '../utils/markdown';
import { CandidateDrawer } from './CandidateDrawer';
import './screens.css';

export function BriefingPack() {
  const {
    roleSetup,
    competencies,
    questions,
    candidateName,
    timings,
    grounding,
    resumeGrounding,
    goTo,
    dispatch,
  } =
    useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const standard = questions.filter((q) => q.source === 'standard');
  const personalized = questions.filter((q) => q.source === 'personalized');

  const warnings = questions.filter((q) => q.biasCheck.status === 'warning');
  const totalSeconds = useMemo(
    () => (timings.reduce((sum, t) => sum + t.ms, 0) / 1000).toFixed(1),
    [timings],
  );

  if (!roleSetup) return null;

  async function handleCopy() {
    if (!roleSetup) return;
    await navigator.clipboard.writeText(
      toMarkdown({ roleSetup, competencies, questions, candidateName }),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="doc">
      <div className="doc-actions no-print">
        <Button variant="secondary" size="sm" icon="print" onClick={() => window.print()}>
          Export / Print
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? 'check' : 'content_copy'}
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy as Markdown'}
        </Button>
        <Button
          variant={personalized.length ? 'secondary' : 'primary'}
          size="sm"
          icon="person_search"
          onClick={() => setDrawerOpen(true)}
        >
          {personalized.length ? 'Edit resume questions' : 'Tailor for a candidate'}
        </Button>
      </div>

      {/* Role summary */}
      <section className="role-card">
        <div className="role-card-head">
          <div>
            <h1 className="role-title">{roleSetup.jobTitle}</h1>
            <p className="role-sub">
              {roleSetup.seniorityLevel} · {roleSetup.interviewRound}
              {roleSetup.teamContext ? ` · ${roleSetup.teamContext}` : ''}
            </p>
          </div>
        </div>

        <div className="role-card-section">
          <p className="eyebrow">Target competencies</p>
          <div className="chip-row">
            {competencies.map((c) => (
              <Chip key={c.name} tone="flame">
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="stats">
          <span className="stat">
            <Icon name="quiz" />
            <strong>{questions.length}</strong> questions
          </span>
          <span className="stat">
            <Icon name={warnings.length ? 'warning' : 'verified_user'} />
            <strong>{warnings.length}</strong> compliance{' '}
            {warnings.length === 1 ? 'flag' : 'flags'}
          </span>
          {grounding && (
            <span className="stat">
              <Icon name="link" />
              <strong>
                {grounding.grounded}/{grounding.total}
              </strong>{' '}
              JD-grounded
            </span>
          )}
          {resumeGrounding && resumeGrounding.total > 0 && (
            <span
              className={`stat${resumeGrounding.grounded < resumeGrounding.total ? ' stat--warn' : ''}`}
            >
              <Icon name="link" />
              <strong>
                {resumeGrounding.grounded}/{resumeGrounding.total}
              </strong>{' '}
              resume-grounded
            </span>
          )}
          {timings.length > 0 && (
            <span className="stat">
              <Icon name="bolt" />
              generated in <strong>{totalSeconds}s</strong>
            </span>
          )}
        </div>
      </section>

      {/* Compliance */}
      <Callout tone="warning" icon="security" title="Compliance & fairness reminder">
        Ask every candidate for this role the same standard questions, and score against the rubric
        rather than overall impression.
        <ul>
          <li>
            Avoid questions about family status, age, national origin, religion, disability, or any
            other protected characteristic.
          </li>
          <li>
            Do not use graduation years or total years of experience as a proxy for age.
          </li>
          <li>
            Record specific evidence for each score — "seemed like a culture fit" is not defensible
            in an audit.
          </li>
        </ul>
      </Callout>

      {/* Standard questions */}
      <section className="doc-section">
        <div className="section-head">
          <h2 className="section-title">Interview structure</h2>
          <span className="section-note">Asked of every candidate for this role</span>
          {/* Collapsed by default so the guide can be scanned as a list. The
              key forces the cards to re-seed from defaultOpen when toggled. */}
          <button className="text-link no-print" onClick={() => setAllOpen((v) => !v)}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        <div className="qstack">
          {standard.map((q, i) => (
            <QuestionCard
              key={`${q.id}-${allOpen}`}
              question={q}
              index={i + 1}
              defaultOpen={allOpen}
              onRemove={() => dispatch({ type: 'REMOVE_QUESTION', id: q.id })}
            />
          ))}
        </div>
      </section>

      {/* Resume-specific questions */}
      {personalized.length > 0 && (
        <section className="doc-section">
          <div className="section-head">
            <h2 className="section-title">
              Resume-specific questions{candidateName ? ` — ${candidateName}` : ''}
            </h2>
            <span className="section-note">
              Grounded in the resume; ask after the standard set
            </span>
          </div>
          <div className="qstack">
            {personalized.map((q, i) => (
              <QuestionCard
                key={`${q.id}-${allOpen}`}
                question={q}
                index={standard.length + i + 1}
                defaultOpen={allOpen}
                onRemove={() => dispatch({ type: 'REMOVE_QUESTION', id: q.id })}
              />
            ))}
          </div>
        </section>
      )}

      <div className="doc-foot no-print">
        <Button variant="ghost" icon="arrow_back" onClick={() => goTo(1)}>
          Back to role setup
        </Button>
        <Button variant="primary" trailingIcon="arrow_forward" onClick={() => goTo(4)}>
          Start the interview
        </Button>
      </div>

      {drawerOpen && <CandidateDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}
