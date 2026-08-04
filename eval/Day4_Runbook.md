# Day 4 — Run Sheet

Click-by-click. Follow top to bottom. Budget ~90 minutes.

Source data: `../../eval_synthetic_data.md`
Record results in: the Test Execution Tracker at the bottom of that same file.

---

## Before you start

**1. Both servers running.**
```bash
cd "/Users/victoranderson/Desktop/AI Product builder/interviewcopilot"
npm run dev
```
Open http://localhost:5173. Top-right must show a green dot and a model name (e.g. `openai/gpt-oss-120b`) — **not** "Demo mode". If it says Demo mode and won't switch, the key check failed; the error explains why.

**2. Clear old state.** You have demo/test sessions in localStorage from the build. Click **New guide** (top right) before Scenario 1 so nothing carries over.

**3. Have three things open side by side:**
- The app
- `eval_synthetic_data.md` (to copy from)
- The tracker at the bottom of that file (to write into)

**4. Token budget.** This is 10 live generations. Groq's free tier is 200k tokens/day, **per organisation — a new key on the same account will not reset it**. Each guide is roughly 4–7k tokens. You have room, but if you hit the cap the app will say so specifically and you'll be blocked until it resets. Don't burn generations re-running scenarios unnecessarily.

**5. Record as you go — not at the end.** Only the 3 most recent guides appear in the sidebar. By Scenario 5, guides 1 and 2 are unreachable without regenerating them.

---

## PART A — Scenarios 1 to 5 (Tests 1, 2 and 5)

Repeat this whole block five times, once per scenario. ~10 min each.

Scenario → round mapping (from your data):

| # | Candidate | Round to select | Resume type |
|---|---|---|---|
| 1 | Alex Chen | Technical Deep-Dive | Strong clean match |
| 2 | Maya Rodriguez | Behavioral | Career switcher |
| 3 | Jordan Kim | System Design | Embellished |
| 4 | Sam Okafor | Screening | Sparse |
| 5 | Chris Thompson | Bar-Raiser | Adversarial |

All five are **Staff** seniority.

### A1 — Generate the guide (Test 1)

1. **New guide** → Step 1 Role Setup.
2. Fill in from the scenario's JD section:
   - **Job title** — e.g. `Staff Engineer, Growth Platform`
   - **Seniority** — `Staff`
   - **Team context** — the "Team Context" line from the scenario header
   - **Job description** — paste the whole JD body
   - **Interview round** — per the table above
   - **Number of standard questions** — leave at default; keep it identical across all 5 or the comparison is meaningless
3. Click **Generate**. Takes 20–60s.

### A2 — Record Test 1 results

The stats bar is the **pale blue strip at the bottom of the top card**, directly under the TARGET COMPETENCIES chips:

```
 6 questions │ ⚠ 1 compliance flag │ 6/6 JD-grounded │ ⚡ generated in 42.0s
```

- `N/M JD-grounded` → tracker column **JD-Grounding Score**
- `N compliance flags` → tracker column **Bias Flags**
- `generated in Xs` → note it; you need it for the baseline

`generated in Xs` is total agent time and now **includes the personalizer**, so re-read it after step A3 rather than before — the number rises once probes are added.

Questions are **collapsed by default**; click a card to open it, or **Expand all** in the section header. Printing always exports the full guide regardless of what's collapsed.

Then **spot-check 2 competencies by eye**. Open the question cards and read the quoted JD evidence. You're not re-checking whether the quote exists — the app did that. You're checking whether it's a *sensible* citation. A quote can be verbatim and still be a weak justification for the question. Note any that are.

**Also check:** any two competencies that are really the same skill? (This happened during the build — "Operator ability" and "Beta learner pipeline / Operator ability" appeared as separate rows, splitting the score.) Note if it recurs.

### A3 — Tailor to the resume (Test 2)

1. Sidebar → **Candidate** (step 3).
2. **Candidate name** — from the scenario.
3. **Resume text** — paste the whole resume body. (Pasting is fine; the PDF path is a separate feature, not what Day 4 measures.)
4. Leave probe count at default.
5. **Generate**.

### A4 — Record Test 2 results

Back on the briefing pack, the stats bar now also shows `N/M resume-grounded`. That number goes in the tracker.

Then read the personalized probes — they're marked `resume-specific`. For each, ask the question that matches this scenario's failure mode:

| # | What to look for specifically |
|---|---|
| 1 Alex Chen | Do probes cite real specifics, or drift into generic Staff-engineer questions? |
| 2 Maya Rodriguez | Does any probe assert PM experience the resume doesn't claim? Her resume explicitly says *no ownership* of the ML lifecycle. |
| 3 Jordan Kim | Does a probe **interrogate** the buzzwords ("you said 'drove significant impact' — what was the metric?") or just repeat them as fact? |
| 4 Sam Okafor | Thin resume → fewer/shorter probes is a **pass**. Invented detail to fill space is a **fail**. |
| 5 Chris Thompson | The resume claims leading 35 engineers at an 80-person company as a Software Engineer II. Does any probe quote that approvingly as established fact? |

**Expect a specific result on #5:** it will likely score `N/N resume-grounded` *while quoting the fabricated claim*. That is not a bug — grounding asks "is this text in the resume", never "is this claim true". That contrast is the single most valuable finding in this whole exercise. Capture the exact probe text.

### A5 — Test 5 comes free

Every compliance flag you recorded in A2 is Test 5. For each flag, read the note on the card and judge: genuine bias risk, or false positive on ordinary phrasing? For guides with **zero** flags, read one question you'd expect to be borderline and check nothing slipped through.

### A6 — Move on

**There is no "Save guide" button** — I got that wrong in an earlier draft. Guides only reach "Recent guides" via the Assessment screen (after running a consistency check or copying the ATS summary). The working session auto-saves to localStorage, but clicking **New guide** overwrites it.

So: **make sure the tracker row is filled in before you start the next scenario.** Then click **New guide**. Don't plan to come back — you can't.

---

## PART B — Interview and Assessment (Tests 3 and 4)

Do this **once**, after all five scenarios. Use **Scenario 5 (Chris Thompson)** — it has the adversarial resume *and* a planted contradiction in Q1, so it exercises the most at once.

Load Scenario 5's guide from **Recent guides** in the sidebar.

### B1 — Regression check first (30 seconds, do it before anything else)

This tests the P1 data-loss bug fixed after the audit:

1. Go to **Interview** (step 4).
2. Type anything into the evidence box on question 1.
3. **Immediately** click **Finish interview** — do not pause.
4. On the Assessment screen, your text **must** appear in the "What you recorded" panel.

If it's missing, tell me — the fix regressed.

Then go back to step 4 and continue.

### B2 — Walk the interview (Test 3)

For each question, paste the matching answer from Interview Transcript 5 into the evidence box and pick a score using the rubric pane on the right.

While doing this, spot-check 3 questions for rubric quality. The concrete test for "too generic": **could you paste this rubric under a different question in the same guide and have it still read sensibly?** If yes, it isn't doing its job.

Also note — for the planted contradiction (Chris Thompson, **Q1**: leading 35 engineers at an 80-person company) — did anything on screen help you spot it, or did you have to remember it from the resume yourself? Nothing currently cross-references the resume mid-interview. Confirming that gap is the point.

### B3 — Plant one more contradiction, deliberately

Before running the check, create a score/evidence mismatch: score a clearly weak answer **5/5**, or write final notes saying "no concerns" when your evidence records a contradiction.

### B4 — Run the consistency check (Test 4)

Go to **Assessment** (step 5), write final interview notes (20+ characters), click **Run consistency check**.

Record:
- Did it catch the mismatch you planted in B3?
- Did it **quote your actual evidence text**, or produce generic filler that would fit any interview?
- Did it catch the Q1 fabrication contradiction?

### B5 — P0 regression checks

This is the phantom-recommendation bug from the audit. All four must hold:

| Check | Required |
|---|---|
| Before you pick anything, is any of the 4 recommendation buttons highlighted? | **No** |
| Does the analysis criticise a recommendation you never made? | **No** |
| Is the ATS summary visible before you pick one? | **No** |
| Pick "Strong No Hire", then switch to "Strong Hire" — does the ATS text follow? | **Yes** |

Also: does the analysis ever state or imply its own hire/no-hire verdict? It must not.

---

## PART C — Baseline (15 min)

Your template already estimates manual guide-writing at 2–3 hours. That's plausible but it's an *estimate*, and estimates get challenged. Strengthen it one of two ways:

**Option 1 (fast, honest):** keep the estimate but say where it comes from — "based on writing a structured guide with per-question rubrics by hand, which the Day 1 research found teams rarely do at all."

**Option 2 (stronger, 15 min):** actually write one guide by hand. Take JD 1, set a timer, and write 3 questions with 1/3/5 rubrics yourself. Don't finish all six — extrapolate from three and say so. A measured partial beats a guessed total.

Then fill the baseline table. Average your five `generated in Xs` figures for the app-side number.

**Do not write "85% accuracy."** Write what was actually measured:
> *"N/M questions cited evidence verbatim from the submitted JD (mechanically verified). Grounding confirms the quote is real; it does not confirm the question is good, and it does not detect false claims in a resume — see Scenario 5."*

---

## What to hand back

The filled tracker, plus:
- The exact probe text for Scenario 5's fabricated-claim result
- Any invented content from Scenarios 2 and 4
- Whether the buzzwords in Scenario 3 got interrogated or repeated
- Every compliance flag, marked justified / false positive
- Your UX friction notes

I'll turn it into the Day 4 write-up and sort findings into *fix before Day 5* versus *document as known limitation*.

---

## Known limits of this evaluation — state these, don't hide them

Worth saying explicitly in the write-up; a reviewer will spot them anyway and it reads better if you got there first:

1. **All five scenarios are Staff level.** Seniority calibration is untested. The failure-mode coverage is deliberate and good; the seniority range is not covered.
2. **All five are engineering or technical-PM roles.** Consistent with the stated persona (tech hiring managers), but it means non-technical hiring is untested.
3. **n=5.** Enough to surface qualitative failure modes, not enough for a statistical accuracy claim. Say "5 scenarios", never "85% accurate" without the denominator.
4. **The transcripts are synthetic and written to contain known contradictions.** That makes the consistency check testable, but it also means the check is being tested against contradictions of a kind the test author already had in mind.
