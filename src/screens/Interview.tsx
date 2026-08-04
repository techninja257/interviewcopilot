import { useState } from 'react';
import { Button, EmptyState, Icon, ScoreScale, TextArea } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useScorecard } from './useScorecard';
import './screens.css';

/**
 * Step 4 — used *during* the interview.
 *
 * One question at a time, with its rubric anchors pinned open in a second pane
 * rather than collapsed: the interviewer is listening and typing at the same
 * time, and a rubric behind a click is a rubric nobody opens. The briefing pack
 * shows every question at once, which is right for reading beforehand and wrong
 * for conducting.
 *
 * This screen captures evidence only — no competency scores, no recommendation
 * — because judgement belongs after the evidence is down, not alongside it.
 */
export function Interview() {
  const { roleSetup, questions, candidateName, goTo, dispatch } = useApp();
  const { scores, setScores, notes, setNotes } = useScorecard();
  const [index, setIndex] = useState(0);

  if (!roleSetup || questions.length === 0) {
    return (
      <div className="candidate-page">
        <EmptyState icon="record_voice_over" title="Generate a guide first">
          The interview screen walks through the questions in your guide, so there needs to be a
          guide to walk through.
        </EmptyState>
        <div className="candidate-actions">
          <Button variant="primary" icon="arrow_back" onClick={() => goTo(1)}>
            Go to role setup
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[Math.min(index, questions.length - 1)];
  const isLast = index === questions.length - 1;

  const scoredWithoutEvidence = (scores[q.id] ?? 0) > 0 && !notes[q.id]?.trim();

  return (
    <div className="interview">
      <header className="interview-bar">
        <div className="interview-who">
          <strong>{candidateName ?? 'Candidate'}</strong>
          <span>
            {roleSetup.jobTitle} · {roleSetup.interviewRound}
          </span>
        </div>
        <Button
          variant="primary"
          size="sm"
          trailingIcon="arrow_forward"
          onClick={() => {
            dispatch({ type: 'COMPLETE_STEP', step: 4 });
            goTo(5);
          }}
        >
          Finish interview
        </Button>
      </header>

      <div className="interview-split">
        {/* Left: the question and what you record about it. */}
        <section className="interview-main">
          <article className="qstage">
            <div className="qstage-head">
              <span className="qstage-count">
                Question {index + 1} of {questions.length}
              </span>
              <span className="qstage-meta">
                {q.competency}
                {q.source === 'personalized' && ' · resume-specific'}
              </span>
            </div>

            <h2 className="qstage-q">{q.question}</h2>

            {/* Evidence above the score, deliberately: writing down what happened
                before rating it keeps the score anchored to the answer rather
                than to an overall impression of the candidate. */}
            <TextArea
              id={`evidence-${q.id}`}
              label="Evidence — what did they actually say?"
              placeholder="Quote or paraphrase the answer as you go…"
              rows={10}
              value={notes[q.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
            />

          </article>

          <nav className="interview-nav">
            <Button
              variant="ghost"
              icon="arrow_back"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              Previous
            </Button>

            <div className="interview-dots">
              {questions.map((item, i) => (
                <button
                  key={item.id}
                  className={`idot${i === index ? ' idot--active' : ''}${
                    notes[item.id]?.trim() ? ' idot--done' : ''
                  }`}
                  onClick={() => setIndex(i)}
                  title={`Question ${i + 1}${notes[item.id]?.trim() ? ' — documented' : ''}`}
                  aria-label={`Go to question ${i + 1}`}
                />
              ))}
            </div>

            <Button
              variant={isLast ? 'ghost' : 'secondary'}
              trailingIcon="arrow_forward"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={isLast}
            >
              Next
            </Button>
          </nav>

        </section>

        {/* Right: what to listen for. Always visible — this is the reference the
            interviewer is scoring against, so it never hides behind a click. */}
        <aside className="interview-guide">
          {/* The score sits directly above the anchors it is scored against, so
              choosing a level and reading its description are the same glance
              rather than a trip across the screen. */}
          <div className="guide-block guide-block--score">
            <p className="eyebrow" id={`score-label-${q.id}`}>
              <Icon name="grade" /> Score against the rubric
            </p>
            <ScoreScale
              id={`score-label-${q.id}`}
              value={scores[q.id] ?? 0}
              onChange={(v) => setScores((s) => ({ ...s, [q.id]: v }))}
            />

            {/* Warn rather than block. A score with no evidence is the exact
                failure the rubric exists to prevent, but disabling the control
                mid-conversation fights the interviewer — surface it and let
                them decide, which is the same human-in-the-loop stance the
                feedback agent takes. */}
            {scoredWithoutEvidence && (
              <p className="qscore-warn">
                <Icon name="error" />
                Scored without evidence — note what they said, or clear the score.
              </p>
            )}
          </div>

          <div className="guide-block">
            <p className="eyebrow">
              <Icon name="target" /> What the levels sound like
            </p>
            <dl className="guide-rubric">
              <dt>1</dt>
              <dd>{q.scoringRubric.score1}</dd>
              <dt>3</dt>
              <dd>{q.scoringRubric.score3}</dd>
              <dt>5</dt>
              <dd>{q.scoringRubric.score5}</dd>
            </dl>
          </div>

          {q.followUps.length > 0 && (
            <div className="guide-block">
              <p className="eyebrow">
                <Icon name="alt_route" /> Follow-ups
              </p>
              <ul className="guide-list">
                {q.followUps.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {q.redFlags.length > 0 && (
            <div className="guide-block guide-block--flags">
              <p className="eyebrow">
                <Icon name="flag" /> Red flags
              </p>
              <ul className="guide-list">
                {q.redFlags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
