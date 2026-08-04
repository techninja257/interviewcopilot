import type { GeneratedQuestion, GroundingReport } from '../types';

/**
 * Normalizes text for fuzzy substring comparison: collapses whitespace, strips
 * smart quotes and most punctuation, lowercases. The model tends to reproduce
 * evidence quotes with minor typographic drift even when instructed to quote
 * verbatim, and we don't want to flag those as hallucinations.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A quote counts as grounded if it appears in the source, or if a long enough
 * run of its words does. The word-run check tolerates the model trimming a
 * clause off either end of the sentence it quoted.
 */
export function isGrounded(claim: string, source: string): boolean {
  if (!claim.trim()) return false;

  const nClaim = normalize(claim);
  const nSource = normalize(source);
  if (!nClaim || !nSource) return false;
  if (nSource.includes(nClaim)) return true;

  const words = nClaim.split(' ');
  const windowSize = Math.min(8, words.length);
  if (windowSize < 4) return false;

  for (let i = 0; i + windowSize <= words.length; i++) {
    if (nSource.includes(words.slice(i, i + windowSize).join(' '))) return true;
  }
  return false;
}

/**
 * Checks every question's claimed JD evidence against the JD actually submitted.
 * Ungrounded quotes are the measurable hallucination rate reported in evaluation.
 */
export function checkGrounding(
  questions: GeneratedQuestion[],
  jobDescription: string,
): GroundingReport {
  const standard = questions.filter((q) => q.source === 'standard');
  const ungrounded = standard
    .filter((q) => !isGrounded(q.jdEvidence, jobDescription))
    .map((q) => ({ questionId: q.id, claimedEvidence: q.jdEvidence }));

  return {
    total: standard.length,
    grounded: standard.length - ungrounded.length,
    ungrounded,
  };
}

/** Checks a personalized question's resume quote against the submitted resume. */
export function checkResumeGrounding(
  questions: GeneratedQuestion[],
  resumeText: string,
): GroundingReport {
  const personalized = questions.filter((q) => q.source === 'personalized');
  const ungrounded = personalized
    .filter((q) => !isGrounded(q.resumeEvidence ?? '', resumeText))
    .map((q) => ({ questionId: q.id, claimedEvidence: q.resumeEvidence ?? '' }));

  return {
    total: personalized.length,
    grounded: personalized.length - ungrounded.length,
    ungrounded,
  };
}
