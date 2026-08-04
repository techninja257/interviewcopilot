import { useState } from 'react';
import { Button, Callout, EmptyState, Icon, TextArea } from '../components/ui';
import { useApp } from '../context/AppContext';
import { runFeedbackChain } from '../agents/chain';
import { useScorecard } from './useScorecard';
import type { HiringRecommendation } from '../types';
import './screens.css';

const RECOMMENDATIONS: HiringRecommendation[] = [
  'Strong Hire',
  'Hire',
  'No Hire',
  'Strong No Hire',
];

/**
 * Step 5 — after the interview.
 *
 * Deliberately sequential: competency scores (derived from the evidence), then
 * final notes, then the consistency check, and only then the recommendation.
 * Revealing the decision last is the point — an interviewer who commits to a
 * verdict first tends to write notes that justify it, which is the mechanism
 * behind non-comparable "gut-feel" evaluations.
 */
export function Assessment() {
  const { roleSetup, questions, candidateName, feedbackAnalysis, isDemo, dispatch, goTo, saveCurrent } =
    useApp();
  const {
    scores,
    notes,
    recommendation,
    setRecommendation,
    overallNotes,
    setOverallNotes,
    competencyRollup,
    scoredQuestions,
    documented,
    buildFeedback,
  } = useScorecard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!roleSetup || questions.length === 0) {
    return (
      <div className="candidate-page">
        <EmptyState icon="fact_check" title="Nothing to assess yet">
          Work through the interview first — this page turns the evidence you captured into a
          scorecard.
        </EmptyState>
        <div className="candidate-actions">
          <Button variant="primary" icon="arrow_back" onClick={() => goTo(1)}>
            Go to role setup
          </Button>
        </div>
      </div>
    );
  }

  const nothingCaptured = documented === 0 && scoredQuestions === 0;
  const canAnalyse = scoredQuestions > 0 && overallNotes.trim().length > 20;

  // Every question that was touched at all, in interview order — verbatim, so
  // the summary can be written against what was actually said rather than
  // against memory of it.
  const captured = questions
    .map((q, index) => ({
      q,
      index,
      score: scores[q.id] ?? 0,
      evidence: notes[q.id]?.trim() ?? '',
    }))
    .filter((item) => item.score > 0 || item.evidence.length > 0);

  // The ATS record is the analysis text plus the interviewer's own decision,
  // joined at render time. A summary that stated the recommendation would keep
  // asserting whatever was selected when the analysis ran.
  const atsRecord = feedbackAnalysis
    ? `${feedbackAnalysis.atsSafeSummary}${
        recommendation ? ` The interviewer recorded a recommendation of ${recommendation}.` : ''
      }`
    : '';

  async function handleAnalyse() {
    if (!roleSetup || !canAnalyse) return;
    setBusy(true);
    setError(null);

    const feedback = buildFeedback();
    dispatch({ type: 'SET_FEEDBACK', data: feedback });

    try {
      const result = await runFeedbackChain({ feedback, questions, roleSetup, isDemo });
      dispatch({ type: 'SET_ANALYSIS', data: result.analysis });
      for (const entry of result.raw) {
        dispatch({ type: 'LOG_RAW', agent: entry.agent, response: entry.response });
      }
      saveCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyse the feedback.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assessment">
      <header className="screen-head">
        <h1 className="screen-title">
          Assessment{candidateName ? ` — ${candidateName}` : ''}
        </h1>
        <p className="screen-sub">
          {roleSetup.jobTitle} · {roleSetup.interviewRound}. Scores come from the evidence you
          captured during the interview.
        </p>
      </header>

      {nothingCaptured ? (
        <div className="card form-card">
          <EmptyState icon="record_voice_over" title="No evidence captured yet">
            Go through the interview questions first — each answer you document here becomes part
            of the competency scores and the consistency check.
          </EmptyState>
          <div className="candidate-actions">
            <Button variant="primary" icon="arrow_back" onClick={() => goTo(4)}>
              Go to the interview
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 1 — What the evidence adds up to. */}
          <section className="card form-card">
            <div className="field">
              <div className="score-head-row">
                <span className="label" style={{ marginBottom: 0 }}>
                  Competency scores
                </span>
                <span className="score-progress">
                  {scoredQuestions}/{questions.length} questions scored
                </span>
              </div>
              <p className="helper" style={{ marginBottom: 'var(--sm)' }}>
                Averaged from the questions that assess each competency. This is what goes on the
                record — edit a score by revisiting the question.
              </p>
              <div className="rollup">
                {competencyRollup.map((c) => (
                  <div key={c.competency} className="rollup-row">
                    <span className="rollup-name">{c.competency}</span>
                    <span className="rollup-score">
                      {c.rated ? (
                        <>
                          <strong>{c.score.toFixed(1)}</strong>/5
                          <span className="rollup-count">
                            {' '}
                            · {c.rated} question{c.rated === 1 ? '' : 's'}
                          </span>
                        </>
                      ) : (
                        <span className="rollup-count">not yet scored</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon="arrow_back"
                onClick={() => goTo(4)}
                style={{ marginTop: 'var(--sm)' }}
              >
                Back to the questions
              </Button>
            </div>
          </section>

          {/* 2 — Final notes, which gate the analysis.
              The evidence sits alongside read-only rather than prefilling the
              box. The consistency check works by comparing two independently
              written things — what was recorded per answer, and what the
              interviewer concluded overall. Deriving one from the other would
              make a contradiction between them impossible by construction,
              which is the whole signal. So: full recall, no autofill. */}
          <section className="card form-card">
            <div className="notes-split">
              <div className="notes-write">
                <TextArea
                  id="overall"
                  label="Final interview notes"
                  placeholder="Pulling it together: what did the candidate demonstrate across the whole conversation? Cite specific answers rather than overall impressions…"
                  rows={14}
                  value={overallNotes}
                  onChange={(e) => setOverallNotes(e.target.value)}
                  hint={
                    overallNotes.trim().length > 20
                      ? `${overallNotes.trim().length} characters`
                      : 'At least 20 characters — the consistency check reads these against your scores.'
                  }
                />
              </div>

              <aside className="notes-evidence">
                <p className="eyebrow">
                  <Icon name="history_edu" /> What you recorded
                </p>
                {captured.length === 0 ? (
                  <p className="notes-empty">
                    No evidence recorded yet. Anything you type on the interview screen appears here
                    verbatim.
                  </p>
                ) : (
                  <ol className="notes-recall">
                    {captured.map(({ q, index, score, evidence }) => (
                      <li key={q.id}>
                        <p className="recall-head">
                          <span className="recall-num">Q{index + 1}</span>
                          <span className="recall-comp">{q.competency}</span>
                          <span className={`recall-score${score ? '' : ' recall-score--none'}`}>
                            {score ? `${score}/5` : 'unscored'}
                          </span>
                        </p>
                        {evidence ? (
                          <blockquote className="recall-quote">{evidence}</blockquote>
                        ) : (
                          <p className="recall-quote recall-quote--empty">Nothing recorded</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
            </div>

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
              icon="balance"
              onClick={handleAnalyse}
              disabled={!canAnalyse || busy}
            >
              {busy
                ? 'Checking for inconsistencies…'
                : feedbackAnalysis
                  ? 'Re-run consistency check'
                  : 'Run consistency check'}
            </Button>
          </section>

          {/* 3 — The check, then 4 — the decision. Both appear only once earned. */}
          {feedbackAnalysis && (
            <>
              <section className="card form-card">
                <p className="eyebrow">Consistency check</p>

                {feedbackAnalysis.inconsistencies.length > 0 ? (
                  <div className="flag">
                    <div className="flag-icon">
                      <Icon name="warning" filled />
                    </div>
                    <div>
                      <h3 className="flag-title">Worth resolving before the debrief</h3>
                      <ul className="flag-list">
                        {feedbackAnalysis.inconsistencies.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <Callout tone="success" icon="check_circle" title="Scores and notes line up">
                    Nothing in the written record contradicts the scores.
                  </Callout>
                )}

                <div className="field">
                  <p className="eyebrow">Summary</p>
                  <ul className="qlist">
                    {feedbackAnalysis.summary.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="field">
                  <p className="eyebrow">Before you decide</p>
                  <ul className="qlist">
                    {feedbackAnalysis.considerations.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                {feedbackAnalysis.biasFlags.length > 0 && (
                  <Callout tone="warning" icon="balance" title="Language to reconsider">
                    <ul>
                      {feedbackAnalysis.biasFlags.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </Callout>
                )}
              </section>

              <section className="card form-card">
                <div className="field">
                  <span className="label">Your hiring recommendation</span>
                  <p className="helper" style={{ marginBottom: 'var(--sm)' }}>
                    This is yours to make. The tool checked your reasoning — it does not have a
                    view on the outcome.
                  </p>
                  <div className="rec-row">
                    {RECOMMENDATIONS.map((r) => (
                      <button
                        key={r}
                        className={`rec${recommendation === r ? ' rec--active' : ''}`}
                        onClick={() => setRecommendation(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {recommendation && (
                  <div className="field">
                    <p className="eyebrow">ATS-safe summary</p>
                    {/* Composed at render time, never frozen. The analysis text
                        describes only what was assessed; the decision sentence
                        is appended from the current selection, so changing the
                        recommendation changes the record it produces. */}
                    <p className="panel-text">{atsRecord}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="content_copy"
                      onClick={() => {
                        navigator.clipboard.writeText(atsRecord);
                        saveCurrent();
                      }}
                    >
                      Copy for ATS
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
