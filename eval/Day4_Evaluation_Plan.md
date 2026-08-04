# Day 4 — Evaluate with HR Data

This is the test matrix, not the results — you run it and fill in the outcome columns. Each section names exactly what synthetic data to generate, what to do with it in the app, and what "hallucinated" or "made sense" concretely means for that test, so the judgment call is checkable rather than a vibe.

The app measures two things automatically, both in the briefing pack stats bar:

- **`N/M JD-grounded`** — every question's cited JD evidence, checked against the job description you pasted.
- **`N/M resume-grounded`** — every personalized probe's cited resume evidence, checked against the resume. Turns amber when any quote fails.

Both use the same substring + 8-word-run match, which tolerates typographic drift but not invention. These numbers are counted, not your opinion. Everything else below needs your eye.

---

## 1. Synthetic data to generate

Ask your AI generator for exactly these. Keep them realistic-messy — real JDs have redundant bullets, real resumes have gaps and inflated titles. Clean synthetic data under-tests the product.

### 1a. Five job descriptions (one per scenario below)
Each needs: job title, 150–400 word JD with responsibilities and requirements, seniority level (pick from: `Junior, Mid-Level, Senior, Staff, Principal, Director`), and a short team-context line. Vary interview round too (pick from: `Screening, Technical Deep-Dive, Behavioral, System Design, Bar-Raiser, Leadership`) — you already validated round-differentiation, so this test matrix doesn't need to re-prove that, but touching 2–3 different rounds keeps the sample honest.

### 1b. Five resumes, matched 1:1 to the JDs, each testing a different failure mode
This is the part worth being deliberate about — don't generate five generic resumes. Generate exactly these five *kinds*:

| # | Resume type | What it's testing |
|---|---|---|
| 1 | **Strong, clean match** | Baseline — does the system perform well when there's nothing to trip on? |
| 2 | **Career switcher** — adjacent field, transferable skills, no direct title match | Does the personalizer invent experience the resume doesn't contain, to force a fit? |
| 3 | **Embellished / buzzword-heavy** — inflated titles, vague achievement claims, no specifics | Does the system take the claims at face value, or does a probe surface the vagueness? |
| 4 | **Sparse / early-career** — short resume, thin on detail, real gaps | Does grounding fail gracefully (fewer probes, honest evidence) or does it fabricate detail to fill space? |
| 5 | **Adversarial** — one clearly fabricated, checkable claim (e.g. "Led a team of 40 engineers" for what's otherwise a 2-year-experience resume, or a claimed metric that doesn't fit the rest of the timeline) | Does anything in the pipeline flag the internal inconsistency, or does it get treated as fact and quoted approvingly? |

### 1c. One mock interview transcript → scored answers
Pick **one** of the five roles above. Ask your AI generator for a transcript of answers to that role's questions (you'll get the actual questions from the app in Test 3, then generate answers to match). Include a deliberate mix:
- 2 strong answers
- 2 weak/vague answers
- 1 answer that contradicts something in the resume

You'll use this to type into the Interview screen's evidence boxes and to test the Assessment consistency check.

---

## 2. Test cases

Run these in order — later tests depend on guides generated in earlier ones.

**Before you start, two practical notes.**

*Rate limits.* This matrix is ~12 live generations. Groq's free tier caps both per-minute and per-day tokens, and the daily cap is **per organisation, not per key** — making a new key on the same account will not reset it. If you hit the daily limit mid-run, the app says so specifically and demo mode keeps working, but you'll lose live results for the rest of that day. Mitigations: leave a gap between generations, or add a `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` to `.env` as a fallback (the server hot-reloads, no restart needed).

*Save each guide before moving on.* The working session is overwritten when you start a new one. Saved guides are capped at 5 but the sidebar only lists the **most recent 3**, so with 5 JDs the earliest two will not be clickable even though they're stored. Practical consequence: **copy the results you need into this file as you go** rather than planning to come back to guide #1 at the end — re-reading it would mean re-generating it, which costs tokens you may not have.

### Test 1 — Competency extraction (Role Setup → Briefing Pack)
For each of the 5 JDs: paste it in, generate, record the JD-grounded score from the stats bar.

**Checkable hallucination test:** open each competency's source quote. Does it appear in the JD you pasted, or close to verbatim? The stats bar already tells you the aggregate (`N/M grounded`) — spot-check 2 competencies per JD by eye to catch cases where the substring match is technically true but the *quote is misleading* (grounding can pass mechanically while still being a weak citation).

**Also watch for:** duplicate/overlapping competencies from one JD (this happened during Day 3 build — two rows for what was really one skill, e.g. "Operator ability" and "Beta learner pipeline / Operator ability" both appearing, splitting the score). Note if it recurs.

| # | Role / seniority / round | Competencies | JD-grounded | Dupes? | Misleading quotes (of 2 checked) | Gen time |
|---|---|---|---|---|---|---|
| 1 |  |  |  /  |  |  |  s |
| 2 |  |  |  /  |  |  |  s |
| 3 |  |  |  /  |  |  |  s |
| 4 |  |  |  /  |  |  |  s |
| 5 |  |  |  /  |  |  |  s |

### Test 2 — Resume personalization (Candidate step)
For each of the 5 resumes, paired to its JD: upload/paste, generate personalized probes.

**Checkable hallucination test, per resume type:**
- **#1 (clean):** do probes cite real specifics from the resume?
- **#2 (career switcher):** does any probe claim the resume says something it doesn't — invented prior experience, a skill not listed?
- **#3 (embellished):** does a probe actually interrogate the vague claim ("you said you 'drove significant impact' — what was the metric?"), or does it just restate the buzzword as fact?
- **#4 (sparse):** fewer probes is a **pass**, not a failure — check nothing is invented to compensate for thin material.
- **#5 (adversarial):** does the fabricated claim get quoted as `resumeEvidence` without comment, or does anything push back on it? (Today: nothing will — no fact-checking exists. This test's job is to confirm that gap explicitly, not to find a working defense.)

Record the `N/M resume-grounded` number per resume alongside your manual read. Note that grounding and *usefulness* are different things — a probe can quote the resume perfectly (grounded) and still be a weak question. Grounding catches invention, not quality; resume #3 (embellished) is where you'll see that gap most clearly.

| # | Resume type | Probes | Resume-grounded | Invented content? | Probe actually interrogates the weak claim? |
|---|---|---|---|---|---|
| 1 | Clean match |  |  /  |  |  |
| 2 | Career switcher |  |  /  |  |  |
| 3 | Embellished |  |  /  |  |  |
| 4 | Sparse |  |  /  |  |  |
| 5 | Adversarial |  |  /  |  |  |

The two rightmost columns are the ones that matter. A row reading `3/3 grounded` with "invented content: no" and "interrogates: no" is a **finding**, not a pass — it means the system is quoting faithfully and still asking soft questions.

### Test 3 — Interview flow (Interview screen)
Using the transcript from 1c: walk through the questions, paste in the scored answers as evidence, pick scores.

**What "made sense" means here:** does the rubric anchor you're scoring against actually match what a 1 / 3 / 5 answer to *this specific question* would sound like, or is it generic enough to fit any question in the guide? The test for "generic" is concrete — could you paste this rubric under a different question in the same guide and have it still read as sensible? If yes, it isn't doing its job.

| Q | Rubric specific to this question, or generic? | Did the anchors help you pick a score? | Score you gave |
|---|---|---|---|
|  |  |  |  /5 |
|  |  |  |  /5 |
|  |  |  |  /5 |

Also note: for the answer from 1c that **contradicts the resume**, did anything on screen help you notice the contradiction, or did you have to remember it yourself? (Today, nothing cross-references the resume during the interview — confirming that gap is the point.)

### Test 4 — Consistency check (Assessment screen)
Using the scores + evidence from Test 3, deliberately create one contradiction before running the check (e.g. score a weak answer 5/5, or write final notes that say "no concerns" when your evidence has a contradiction from 1c).

**Checkable test:** does `Run consistency check` catch the contradiction you planted? Does it quote your actual evidence text back at you, or does it produce a generic-sounding flag that could apply to any interview?

**Regression checks — the P0 bug found in the Day 3 audit.** A default was silently authoring a hiring recommendation and attributing it to the interviewer. It's fixed and verified in demo mode, but this is the first run against the live model on real data, so confirm all four hold:

| Check | Expected |
|---|---|
| Before picking a recommendation, is any of the four buttons highlighted? | **No** — none pre-selected |
| Does the analysis critique a recommendation you never made? | **No** — no "does not support a Hire" language |
| Does the ATS summary name a recommendation before you pick one? | **No** — summary is hidden until you choose |
| After picking one, then changing it, does the ATS text follow? | **Yes** — text updates to match the new choice |

Also: does the analysis ever state or imply a hire/no-hire verdict of its own? It must not — that's a hard product requirement, not a preference.

**Regression check — the P1 data-loss bug.** Type evidence into a question and click **Finish interview** immediately, without pausing. The evidence must appear in the "What you recorded" panel on the Assessment screen. (It was being discarded by the 400ms autosave debounce.)

### Test 5 — Bias audit (runs automatically in Tests 1 and 2)
No separate run needed. The stats bar shows `N compliance flags` per guide, and each flagged question carries its reason as a note on the card — so you can collect these while doing Tests 1 and 2.

**Checkable test:** for each warning, is the flagged language actually a proxy for a protected characteristic or an impression-based judgment, or is it a false positive on ordinary phrasing? Then the harder half: for each guide with *zero* flags, read 1 question you'd expect to be borderline — did anything slip through?

| Guide | Flags raised | Flag text | Justified or false positive? | Anything missed? |
|---|---|---|---|---|
| JD 1 |  |  |  |  |
| JD 2 |  |  |  |  |
| JD 3 |  |  |  |  |
| JD 4 |  |  |  |  |
| JD 5 |  |  |  |  |
| Probes 1–5 |  |  |  |  |

False positives and misses are both worth reporting. A bias audit that flags everything is as useless as one that flags nothing — the Day 3 build note already argues that "a guide where everything is flagged is a guide the interviewer stops reading," so evidence either way is useful.

---

## 3. UX adjustments — capture as you go, don't wait until the end

Note anywhere you had to stop and think "wait, what does this mean," "why did I have to do that manually," or "the app didn't tell me X and I wanted it to." Small friction moments are what this section wants — not feature requests, just where the flow didn't match how you were actually thinking while doing the task. Write them down *during* the run; they're almost impossible to reconstruct afterwards, because by then you've adapted to the friction.

| Where | What I expected | What happened | Worth fixing? |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

---

## 4. Baseline comparison

You need one real number for the "manual takes X, this takes Y" line. Pick **one**:

- **Time-based (easiest to produce):** time yourself (or estimate from experience) doing the equivalent manual task — writing a structured interview guide with rubrics from one of your 5 JDs by hand — and compare to the `generated in Xs` figure the app already shows in the stats bar. This is the cleanest version of the example format in the assignment ("manual screening takes 5 min, this does it in 10s").
- **Accuracy-based:** use the grounding rates directly — they're measured percentages, not estimates: *"Across 5 job descriptions, **N/M** questions cited evidence verbatim from the submitted JD; across 5 resumes, **N/M** probes cited evidence verbatim from the resume."* Total the columns from the Test 1 and Test 2 tables. This is the strongest number you have because it's mechanically checked rather than judged. State the limit plainly: grounding proves the quote is real, not that the question is good.
- **Both**, if you have 15 extra minutes — this is the strongest version for the write-up, since it gives you a speed number and an accuracy number instead of picking one.

Whichever you pick, write the caveat next to it. "85% accuracy" without saying accuracy *at what, measured how* is the kind of claim that doesn't survive a follow-up question in a debrief.

**Fill this in at the end:**

| Metric | Manual baseline | InterviewCopilot | Source of the number |
|---|---|---|---|
| Time to produce one structured guide |  min |  s | Stats bar `generated in Xs` |
| Questions citing verifiable JD evidence | — |  /  | Sum of Test 1 grounding column |
| Probes citing verifiable resume evidence | — |  /  | Sum of Test 2 grounding column |
| Compliance issues surfaced before the interview | 0 (nothing checks) |  | Sum of Test 5 flags |

The last row is the one with no manual equivalent — unstructured interviewing has no bias-review step at all, so "N issues flagged before the interview happened" is a capability comparison rather than a speed one. Worth stating separately from the time saving.

---

## 5. What to hand back to me

Fill in the tables above and paste the file back, plus anything that looked wrong that the tables don't have a column for. I'll turn it into the Day 4 write-up, sort findings into *fix now* versus *documented known-limitation*, and implement the fixes we agree on before Day 5.

**Findings I'd expect this matrix to produce, based on what's already known about the build.** Listing them so you can confirm or contradict them rather than rediscover them — and if a prediction turns out wrong, that's the more interesting result:

1. **JD-grounding will be high (likely 100%).** It measured 6/6 during the Day 3 build. If it stays perfect across 5 varied JDs that's a real result, but say what it means: the quote is verbatim, which is not the same as the question being well-chosen.
2. **The adversarial resume (#5) will pass grounding while quoting the fabricated claim approvingly.** There is no fact-checking layer — grounding only asks "is this text in the resume," not "is this claim plausible." Expect `N/N grounded` on a resume containing a lie. That contrast is the single clearest limitation to document.
3. **Competency duplication may recur** (Test 1). The prompt has no dedup instruction; it produced overlapping competencies at least once during the build, which splits a competency's score across two rows and quietly weakens the average.
4. **The sparse resume (#4) is the one most likely to produce invention**, since there's least material to work from.

If all four hold, you have a coherent write-up: strong on grounding and structure, no defence against confident falsehood — with the honest framing that the tool verifies *sourcing*, not *truth*, and that the human is still the fact-checker.
