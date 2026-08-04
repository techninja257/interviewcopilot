import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { HiringRecommendation, InterviewFeedback } from '../types';

/**
 * The scorecard draft, shared by the Interview (4) and Assessment (5) steps.
 *
 * Both screens read and write the same persisted `feedback` object, so
 * evidence captured during the interview is already there when the interviewer
 * moves on to judgement. Keeping it in one hook is what stops the two screens
 * disagreeing about what was recorded.
 */
export function useScorecard() {
  const { questions, candidateName, feedback, dispatch } = useApp();

  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries((feedback?.questionScores ?? []).map((s) => [s.questionId, s.score])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (feedback?.questionScores ?? [])
        .filter((s) => s.evidence)
        .map((s) => [s.questionId, s.evidence as string]),
    ),
  );
  const [recommendation, setRecommendation] = useState<HiringRecommendation | null>(
    feedback?.overallRecommendation ?? null,
  );
  const [overallNotes, setOverallNotes] = useState(feedback?.overallNotes ?? '');

  /**
   * Competency scores are the average of the questions that assess them —
   * derived rather than typed, so the interviewer scores against the rubric
   * anchors that only exist at question level. Unscored questions are excluded
   * rather than counted as zero, which would drag an average down for work the
   * interviewer simply has not done yet.
   */
  const competencyRollup = useMemo(() => {
    const byCompetency = new Map<string, number[]>();
    for (const q of questions) {
      const score = scores[q.id];
      if (!score) continue;
      const list = byCompetency.get(q.competency) ?? [];
      list.push(score);
      byCompetency.set(q.competency, list);
    }
    return Array.from(new Set(questions.map((q) => q.competency))).map((competency) => {
      const list = byCompetency.get(competency) ?? [];
      const average = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
      return { competency, score: average, rated: list.length };
    });
  }, [questions, scores]);

  const scoredQuestions = questions.filter((q) => scores[q.id] > 0).length;
  const documented = questions.filter((q) => notes[q.id]?.trim()).length;

  // Built in one place so the autosaved draft and the submitted scorecard can
  // never describe the interview differently.
  const buildFeedback = useCallback(
    (): InterviewFeedback => ({
      candidateName: candidateName ?? 'Candidate',
      questionScores: questions
        .filter((q) => scores[q.id] > 0 || notes[q.id]?.trim())
        .map((q) => ({
          questionId: q.id,
          question: q.question,
          competency: q.competency,
          score: scores[q.id] ?? 0,
          evidence: notes[q.id],
        })),
      competencyScores: competencyRollup.map((c) => ({
        competency: c.competency,
        score: Number(c.score.toFixed(1)),
        // The agent reads competency notes as the written record, so hand it
        // the evidence from the questions that produced the score.
        notes:
          questions
            .filter((q) => q.competency === c.competency && notes[q.id]?.trim())
            .map((q) => notes[q.id].trim())
            .join(' ') || undefined,
      })),
      // Left undefined until the interviewer picks one. A placeholder here
      // would propagate: into the stored record, into the analyst prompt as a
      // stated decision, into the ATS summary, and back into the UI as a
      // pre-selected button — a hiring call nobody made.
      overallRecommendation: recommendation ?? undefined,
      overallNotes,
    }),
    [candidateName, questions, scores, notes, competencyRollup, recommendation, overallNotes],
  );

  // Mirror the in-progress scorecard into app state, which is what gets written
  // to localStorage. Debounced so typing doesn't dispatch per keystroke, and
  // skipped while empty so an untouched form doesn't overwrite a saved one.
  const touched =
    overallNotes.trim().length > 0 ||
    recommendation !== null ||
    Object.values(scores).some((s) => s > 0) ||
    Object.values(notes).some((n) => n.trim().length > 0);

  // Whether a debounced save is still owed, plus the latest builder — so the
  // unmount flush writes what was on screen rather than whatever the effect
  // last closed over.
  const pending = useRef(false);
  const latest = useRef({ touched, buildFeedback });
  latest.current = { touched, buildFeedback };

  useEffect(() => {
    if (!touched) return;
    pending.current = true;
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_FEEDBACK', data: buildFeedback() });
      pending.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [touched, buildFeedback, dispatch]);

  // Clearing that timer on unmount would silently discard anything typed in
  // the last 400ms — and the real motion is to type the final answer and click
  // "Finish interview" immediately, so that window is exactly when it matters.
  // Flush instead of dropping.
  useEffect(() => {
    return () => {
      if (pending.current && latest.current.touched) {
        dispatch({ type: 'SET_FEEDBACK', data: latest.current.buildFeedback() });
      }
    };
  }, [dispatch]);

  /**
   * Adopt a scorecard that arrived after this hook mounted.
   *
   * The flush above runs in unmount cleanup, but React evaluates the *next*
   * screen's useState initialisers during render — which happens first. So the
   * screen being navigated to always reads the pre-flush value and would show
   * an empty scorecard for evidence that was in fact saved.
   *
   * Only adopts while this screen is still untouched, which makes it safe:
   * once the interviewer types anything here, their input owns the state and
   * nothing external can overwrite it.
   */
  useEffect(() => {
    if (touched) return;
    const captured = feedback?.questionScores ?? [];
    if (captured.length === 0 && !feedback?.overallNotes) return;

    setScores(Object.fromEntries(captured.map((s) => [s.questionId, s.score])));
    setNotes(
      Object.fromEntries(
        captured.filter((s) => s.evidence).map((s) => [s.questionId, s.evidence as string]),
      ),
    );
    setOverallNotes(feedback?.overallNotes ?? '');
    setRecommendation(feedback?.overallRecommendation ?? null);
  }, [feedback, touched]);

  return {
    scores,
    setScores,
    notes,
    setNotes,
    recommendation,
    setRecommendation,
    overallNotes,
    setOverallNotes,
    competencyRollup,
    scoredQuestions,
    documented,
    buildFeedback,
  };
}
