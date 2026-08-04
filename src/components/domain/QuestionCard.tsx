import { useState } from 'react';
import { Chip, Icon, StarRating } from '../ui';
import type { GeneratedQuestion } from '../../types';
import './domain.css';

export function QuestionCard({
  question,
  index,
  score,
  onScore,
  onRemove,
  collapsible = true,
  defaultOpen = true,
}: {
  question: GeneratedQuestion;
  index: number;
  score?: number;
  onScore?: (v: number) => void;
  onRemove?: () => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const personalized = question.source === 'personalized';
  const flagged = question.biasCheck.status === 'warning';

  return (
    <article className={`qcard${personalized ? ' qcard--personalized' : ''}`}>
      <div className="qcard-rail" />

      <header className="qcard-head">
        <div className="qcard-num">{index}</div>
        <div className="qcard-headtext">
          <h3 className="qcard-question">{question.question}</h3>
          <div className="qcard-meta">
            <span className="qcard-competency">{question.competency}</span>
            <span className="qcard-dot">•</span>
            <span>{question.estimatedMinutes} min</span>
            {personalized && (
              <>
                <span className="qcard-dot">•</span>
                <span className="qcard-tag-personalized">
                  <Icon name="person" /> Candidate-specific
                </span>
              </>
            )}
          </div>
        </div>
        <div className="qcard-actions">
          {onRemove && (
            <button className="icon-btn" onClick={onRemove} aria-label="Remove question">
              <Icon name="delete" />
            </button>
          )}
          {collapsible && (
            <button
              className={`icon-btn chevron${open ? ' chevron--open' : ''}`}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              <Icon name="expand_more" />
            </button>
          )}
        </div>
      </header>

      {/* Always rendered, hidden with CSS when collapsed. Unmounting it would
          remove it from the DOM, and the print stylesheet cannot bring back
          what was never rendered — a collapsed guide would export blank. */}
      <div className={`qcard-body${open ? '' : ' qcard-body--collapsed'}`}>
          <section className="qblock qblock--why">
            <h4 className="qblock-title">
              <Icon name="psychology" /> Why this question
            </h4>
            <p className="qblock-text">{question.reasoning}</p>
            {question.jdEvidence && (
              <blockquote className="evidence">
                <span className="evidence-label">From the job description</span>
                <span className="evidence-quote">“{question.jdEvidence}”</span>
              </blockquote>
            )}
            {question.resumeEvidence && (
              <blockquote className="evidence evidence--resume">
                <span className="evidence-label">From the candidate's resume</span>
                <span className="evidence-quote">“{question.resumeEvidence}”</span>
              </blockquote>
            )}
          </section>

          <section className="qblock">
            <h4 className="qblock-title">
              <Icon name="alt_route" /> Follow-ups
            </h4>
            <ul className="qlist">
              {question.followUps.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </section>

          <section className="qblock">
            <h4 className="qblock-title">
              <Icon name="straighten" /> Scoring rubric
            </h4>
            <div className="rubric">
              <div className="rubric-row">
                <span className="rubric-score rubric-score--low">1</span>
                <p>{question.scoringRubric.score1}</p>
              </div>
              <div className="rubric-row">
                <span className="rubric-score rubric-score--mid">3</span>
                <p>{question.scoringRubric.score3}</p>
              </div>
              <div className="rubric-row">
                <span className="rubric-score rubric-score--high">5</span>
                <p>{question.scoringRubric.score5}</p>
              </div>
            </div>
          </section>

          <section className="qblock">
            <h4 className="qblock-title qblock-title--warn">
              <Icon name="flag" /> Red flags
            </h4>
            <ul className="qlist qlist--warn">
              {question.redFlags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </section>

          {/*
            Only the warning is shown. A green "passed" chip on every question
            read as noise once most questions passed, and it asserted a legal
            clearance the audit cannot actually give — the aggregate count in
            the stats bar carries the clean result instead.
          */}
          {(flagged || onScore) && (
            <footer className="qcard-foot">
              {flagged && (
                <Chip tone="warning">
                  <Icon name="warning" filled />
                  Compliance warning
                </Chip>
              )}
              {flagged && question.biasCheck.note && (
                <p className="bias-note">{question.biasCheck.note}</p>
              )}
              {onScore && (
                <div className="qcard-score">
                  <span className="label" style={{ marginBottom: 0 }}>
                    Score
                  </span>
                  <StarRating value={score ?? 0} onChange={onScore} />
                </div>
              )}
            </footer>
          )}
      </div>
    </article>
  );
}
