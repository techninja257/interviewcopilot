# Day 4 — Clarifying Q&A Log

Questions asked while testing, and the answers, kept verbatim for the case study writeup. Chronological.

---

### Q1: Any other scenario that needs to be highlighted?

Scenario 5 (Chris Thompson) was confirmed in detail — see the finding below. Scenarios 1–4 were only checked by their stats-bar numbers (all 100% grounded, 0 compliance flags), not by reading the actual probe/question text. That's a real gap in the evaluation's depth, caused by a real product limitation: there is no "save guide" button, and only 3 guides are kept in Recent Guides, so once you move past a scenario you can't go back and inspect it more closely without regenerating (which costs tokens and produces different output each time, live).

**This gap is itself a Day 4 finding, not just an inconvenience** — it's a session-persistence limitation worth naming in the engineering handoff.

---

### Q2: Should red flags only display when a resume is parsed? Why does a red flag show when only the JD was pasted?

**Short answer: no, that's working as designed — but the question caught something worth stating precisely.**

Red flags exist on every question, resume-based or not, because their job is the same either way: **forecast what a weak answer to *this specific question* sounds like, written in advance, before any interview happens.**

- On a **standard question** (built from the JD alone) — the red flags preview a bad answer *any* candidate might give.
- On a **personalized probe** (built from the resume) — the red flags preview a bad answer *this specific candidate* might give to a question built around their own claim.

Example from Scenario 5: the probe asked Chris Thompson to explain how he led 35 engineers (a claim from his resume). Its red flag read *"vague description of team coordination, suggesting the claim may be inflated."* That's the same mechanism as a JD-only red flag — it's just now aimed at a specific person's specific claim instead of a generic candidate.

**User's own summary, confirmed correct:** *"redflag for JD allows the HR/MH to envision what a bad answer is, while redflag for tailored CV questions allows HR/MH to see where a possible bad answer sounds like."*

More precise version for the writeup: **red flags forecast a weak answer to whichever question they're attached to — JD-based or resume-based makes no difference to what a red flag *is*, only to what specific claim it's testing.**

---

### Q3: How does "Team context" affect the questions? Think of it like a temperature knob — what does "calibrate questions to how the team actually works" truly mean?

See answer below — being tracked here for completeness, full explanation given inline in the conversation.

---

## Findings log (carried alongside the Q&A)

### Finding 1 — Scenario 5 (Chris Thompson, adversarial resume)

The resume claims: *"Led a cross-functional team of 35 engineers to redesign the entire payment infrastructure, reducing transaction failure rate from 8% to 0.4% across $2.3B in annual transaction volume."* This is fabricated (inconsistent with the rest of the resume — a Software Engineer II at an 80-person company).

The personalizer generated a probe that:
- **Quotes the claim as fact** in the question stem: *"Your resume says you 'Led a cross-functional team of 35 engineers...' Can you walk me through the technical vision you set, how you convinced 35 engineers to adopt it..."*
- Scored **2/2 resume-grounded** — correctly, because the quote *is* verbatim from the resume. Grounding checks citation accuracy, not claim truth. Those are different guarantees.
- **But** the rubric and red flags built around that question effectively function as a lie-detector: score-1 anchor is "cannot explain how 35 engineers were coordinated," and a listed red flag is "vague description of team coordination, suggesting the claim may be inflated."

**Reading:** the system didn't verify the claim, but it also didn't naively repeat it without a check — it built a question whose honest answer requires the candidate to substantiate specifics that a fabricated claim usually can't produce under follow-up. The real defense here is the human interviewer asking the follow-ups; the tool's role is to have written the right follow-ups in advance.

**Root cause, from the prompt (`src/agents/prompts.ts`, `buildPersonalizePrompt`):** the model is explicitly instructed to "verify a specific claim the candidate made" and to prefer probes that "name a specific project, number, or transition from the resume" — this is *why* it built a number-anchored probe. There is no instruction to sanity-check the number's plausibility before anchoring a question to it. That's a precise, describable gap — not a vague "AI can hallucinate" caveat.

### Finding 2 — Zero compliance flags, 100% grounding across all 5 scenarios

Consistent with things working correctly, but only lightly verified — only Scenario 5's actual content was read in depth. Documented as an honest limitation of this evaluation pass rather than a confirmed "no bias, ever" claim.

### Finding 3 — No way to revisit a completed guide

There is no "Save guide" button. Guides only reach "Recent Guides" via the Assessment screen (after running the consistency check or copying the ATS summary) — which happens at the *end* of the workflow, too late for guides you're not walking through a full interview for. Recent Guides also caps at 3 entries. Consequence: once you move to a new scenario, earlier guides are gone unless separately screenshotted/copied. This directly limited how many scenarios could be inspected in depth during this evaluation.

---

## Part B — Interview + Assessment flow (automated, Scenario 5)

Manually answering 5 questions per scenario wasn't feasible given time constraints, so Part B was automated: a script drove the real browser (not the API directly) through Role Setup → Candidate → Interview → Assessment for the Chris Thompson / Dutchie scenario, live against the Groq model, typing in answers from the pre-written synthetic transcript and clicking through the UI exactly as a human would.

### What the automation covered

- Generated the guide live from the Dutchie JD (Staff Engineer, Bar-Raiser round)
- Tailored it to Chris Thompson's resume (the adversarial one, with the fabricated "35 engineers" claim)
- Typed transcript answers into the Interview screen's evidence boxes and clicked scores
- **Deliberately planted one mismatch on purpose**: scored a genuinely weak answer 5/5, to see if the consistency check would catch it
- Wrote closing notes containing a self-contradiction ("sounds inflated... no concerns noted")
- Ran the consistency check
- Cycled all four recommendation buttons (Strong Hire / Hire / No Hire / Strong No Hire) and captured the ATS summary text at each, to confirm the earlier P0 bug fix (AI silently defaulting to "Hire") holds under all four states, not just one

### Result 1 — P0 fix (phantom recommendation bug) holds, verified across all 4 states

Before this fix, the app was found to silently default to "Hire" and pre-select it without the interviewer choosing anything. Re-tested here more thoroughly than the original manual check:

- No recommendation button was pre-selected, either before notes were written or right after the consistency check ran
- The ATS summary panel stayed hidden until a recommendation was actually picked
- All 4 recommendation values (not just one) produced **distinct** ATS text, each correctly appending "The interviewer recorded a recommendation of [X]" for whichever button was clicked
- In no case did the AI's own summary assert a hire/no-hire verdict — it only stated observed facts, then quoted the interviewer's own choice back

**Confirmed fixed**, and confirmed more rigorously than the original single-recommendation manual test.

### Result 2 — Consistency check caught real problems, including ones this test didn't plan for

Because the live model phrased the personalized probes differently than the synthetic transcript anticipated, only 2 of 9 questions matched by keyword — so 7 of 9 questions ended up with no answer typed in, and the planted "score a weak answer 5/5" landed on a different question than intended. This produced a messier, more realistic test than planned, and the consistency check still caught real issues:

- Flagged a 2/5 score as inconsistent with its own rubric anchors, given the thin evidence recorded
- Caught the self-contradiction in the closing notes — quoted "no concerns noted" back verbatim as contradicting "sounds inflated"
- Named the 4 competencies left with zero evidence as a real gap, not silently ignored
- Flagged "no concerns noted" itself as impression-language worth reconsidering — a bias-adjacent catch that wasn't specifically planned for

### Result 3 — P1 fix (evidence lost if you navigate away instantly) holds, re-verified in isolation

The first automated run showed a false alarm here — a marker string didn't appear in the recall panel. Re-tested in isolation, stripped of the confounding answer-matching issue above: typed evidence, clicked a score, clicked "Finish interview" with **zero pause** (stricter than any human could type). The evidence survived and appeared verbatim in the recall panel. **Confirmed fixed** — the first result was a test-script artifact (the marker had been appended to a question that never received a score), not a real regression.

### Honest limitation of this automated pass

The keyword-matching between the synthetic transcript's planned answers and the live model's actual (differently-phrased) questions only worked for 2 of 9 questions. This means the "adversarial resume claim scored favorably" pattern from the earlier manual Scenario 5 test (see Finding 1 above) was **not specifically re-confirmed** in this automated pass — the automation tested the *scoring and consistency-check machinery* thoroughly, but not the exact "does a probe quote the fabricated claim as fact" question a second time. That earlier manual finding still stands on its own; this automated pass is a separate, complementary check on a different part of the pipeline (Interview → Assessment, not Candidate tailoring).

---

## Baseline comparison — manual vs. InterviewCopilot

**Manual measurement:** one timed sample — 3 interview questions written by hand, each with question text, reasoning, and a full 1/3/5 scoring rubric (matching what the app produces). Took **40 minutes**.

**App measurement:** 5 live generations against the real Groq API, one per scenario (Faire Growth Platform, Faire Data PM, Airbnb Host Pricing, BlackSky AI, Dutchie), `generated in Xs` read from the stats bar: 16.1s, 21.5s, 72.6s, 78.6s, 14.1s.

| | Manual | InterviewCopilot |
|---|---|---|
| Per question (question + reasoning + 1/3/5 rubric) | **~13.3 min** (800 sec) | **~4.5–6.8 sec** |
| Speedup | — | **~120–180× faster** |
| Sample basis | 1 person, 1 sitting, 3 questions, 1 JD | 5 live API calls, 5 different JDs |

The range (4.5–6.8 sec) exists because the exact question count per scenario wasn't logged during testing — the two ends assume 6 questions/scenario (JD default: 4 standard + 2 resume-specific) versus 9 (as seen in the separately-logged Part B automated run: 6 standard + 3 personalized). Either end of the range rounds to the same headline: roughly two orders of magnitude faster.

**Caveats to keep attached to this number, not left implicit:**

1. **The manual sample is n=1** — one person, one sitting. It's a real measured number, not a guess, but it should be presented as "based on one measured sample," not as an industry average.
2. **Speed is not quality.** This number says nothing about whether the app's questions are as good as hand-written ones — that's answered separately by the grounding scores (Tests 1 & 2: 100% JD- and resume-grounded across all 5 scenarios) and by the Scenario 5 finding above (fabricated resume claims are cited as fact, not fact-checked). Present the speed number and the quality findings together, not the speed number alone.
