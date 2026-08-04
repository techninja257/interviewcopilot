# InterviewCopilot

Turns a job description into a structured, explainable, bias-audited interview guide, then checks the interviewer's feedback for internal consistency afterward.

Built for the Day 3 prototype milestone. See `../Build_Plan.md` for the decisions behind it.

## Running it

```bash
npm install
npm run dev          # starts Vite (5173) and the agent proxy (8787)
```

Open http://localhost:5173. **The app opens on an empty Role setup form**, ready for a real job description. A reload always returns here rather than jumping into a half-finished guide, though any guide you generated is kept and stays reachable from the step navigator.

With no API key the mode toggle stays locked to Demo, which loads a frozen Senior Backend Engineer guide — six questions, rubrics, and a compliance audit — so the app is explorable offline.

For live generation, get a free key from [console.groq.com/keys](https://console.groq.com/keys):

```bash
cp .env.example .env   # add GROQ_API_KEY
```

The server verifies the key on startup with a trivial call. If it is missing or invalid, the mode toggle stays locked to Demo rather than letting you start a generation that will fail — and the health endpoint reports why.

`?step=1..5` deep-links into a screen.

## Providers

Three are supported behind one interface (`server/providers.ts`), so switching is an env change, not a code change. Groq is the default — free tier, and the fastest of the three.

| Env | Effect |
|---|---|
| `GROQ_API_KEY` | Uses Groq (the default) |
| `GEMINI_API_KEY` | Used when no Groq key is set |
| `ANTHROPIC_API_KEY` | Used when neither of the above is set |
| `LLM_PROVIDER=groq\|gemini\|anthropic` | Forces one regardless of which keys exist |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b` |
| `GEMINI_MODEL` | Defaults to `gemini-3.6-flash` |
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-5` |

The active model name is shown in the top-bar toggle, so a demo recording shows which provider produced the output.

**`.env` beats the shell.** The server deletes any ambient `*_API_KEY` before loading `.env`. Without this, a stale exported key in your shell silently outranks the one you just configured and the app talks to the wrong provider — which happened during development and is genuinely hard to diagnose from the symptoms.

**Schema differences, handled in one place.** All three take the same JSON Schema from `src/agents/schemas.ts`; each provider adapts it:

- **Groq** takes standard JSON Schema unchanged, but returns tool arguments as a JSON *string*. A truncated response therefore surfaces as a parse error, which is caught and reported as the output-length problem it usually is.
- **Gemini** rejects `additionalProperties`, `minItems`/`maxItems`, and `minimum`/`maximum`, and wants uppercase type names, so `toGeminiSchema()` converts recursively. Array-length and integer-range limits become advisory, so question count is honoured by the prompt rather than enforced.
- **Anthropic** enforces the full schema and caches the shared system preamble.

Rate limits are the common free-tier failure; errors are translated into actionable messages naming the right env var for the active provider rather than echoing a raw provider blob.

## Architecture

The browser never sees the API key. `server/index.ts` is a small Express proxy that holds it and exposes one endpoint, `POST /api/agent`, delegating to whichever provider is configured.

Four agents, each with a forced tool call whose input schema is the response contract — the model is structurally prevented from returning a shape the UI can't render:

| Agent | In | Out |
|---|---|---|
| `role-parser` | JD, title, seniority, team | 4–6 competencies, each with a verbatim JD quote |
| `question-generator` | competencies, round, count | questions with reasoning, JD evidence, 1/3/5 rubric, follow-ups, red flags, time estimate |
| `personalizer` | resume, standard questions | candidate-specific questions with verbatim resume evidence |
| `feedback-analyst` | scores, notes, questions | summary, inconsistencies, considerations, bias flags, ATS-safe summary |

The bias audit is a **separate pass** over the generated set rather than a field on the generator — a model grading its own output in the same call has an obvious conflict, and the separation is a better story for the handoff doc.

The shared system preamble is marked `cache_control: ephemeral`, so agents 2–4 read it from cache.

## Instrumentation for Day 4

Three things are already wired up so evaluation has real numbers rather than anecdotes:

- **Per-agent wall-clock timing** — recorded in state, shown in the briefing pack stats bar (`generated in 42.0s`).
- **JD grounding validator** (`src/agents/grounding.ts`) — every question's cited evidence is checked against the submitted JD via normalized substring plus an 8-word-run fallback. Ungrounded quotes are the measurable hallucination rate; the stats bar shows `6/6 JD-grounded`.
- **Raw model output** — every unparsed response is kept in `state.rawLog` for the write-up.

## Verified

- Production build and typecheck pass.
- All five screens render (screenshots taken via headless Chrome).
- Consistency flag tested on three cases: fires on high-score-plus-negative-notes and on a recommendation that contradicts the scores, catches "culture fit" as bias language, and correctly stays silent on consistent feedback.
- Print export produces a 7-page PDF with selectable text, roughly one question per page, and a scoring line appended to each card.
- **Full chain confirmed against the live Groq API**, driven through the real UI in a browser (form fill → generate → briefing pack), not just by calling the proxy directly:
  - `role-parser` → 6 competencies, every `jdEvidence` quote verbatim from the submitted JD
  - `question-generator` → 6 questions, each with a 1/3/5 rubric, follow-ups, and red flags
  - `bias-audit` → 6 audited, 0 flags
  - **6/6 JD-grounded**, 81 min total, 0 compliance flags — rendered in the stats bar from live output
- Reload returns to the step you were on, with work intact — verified on the briefing pack, mid-upload on candidate tailoring, and mid-scorecard on assessment.
- Interview → assessment sequencing verified in the browser: step 4 renders no competency scores, no recommendation and no analysis; step 5 keeps the recommendation hidden until the consistency check has run.
- Gemini `role-parser` confirmed earlier on `gemini-3.6-flash` (6 competencies, 6.5s); the converted schema was accepted. That project later ran out of credits, so Gemini is unverified beyond agent 1.

**Latency is variable on the free tier.** The same chain measured 17.9s calling the proxy directly and 56.0s through the UI minutes later, with near-identical token counts (in ~1.1k / out ~2.3–2.7k per call) — that spread is Groq free-tier queuing, not application overhead.

Model availability moves fast — `gemini-2.5-flash` was already retired for new keys during this build. If a model 404s, the health endpoint says so and names the env var to change.

## Deviations from the Day 3 PRD

Light theme over dark glassmorphism; forced tool use over GPT-4o JSON mode; server proxy over browser-side key; `@media print` over html2pdf.js; Material Symbols over Lucide. Candidate tailoring is both its own step and a drawer over the briefing pack, so it can be reached in order or without leaving the guide. Rationale for each is in `../Build_Plan.md` Part 1.

**Capture is separated from judgement.** Step 4 is used *during* the interview — one question at a time, with its 1/3/5 anchors, follow-ups and red flags pinned open in a second pane, and evidence typed above the score. The rubric is never behind a click: an interviewer listening and typing at once will not open a disclosure. There is no timer, deliberately — a running clock pushes toward finishing on time rather than probing properly.

**Scoring is anchored, not a star rating, and it sits with the rubric.** The score control is five labelled buttons, with 1/3/5 carrying the rubric's own levels and 2/4 marked explicitly as the in-between positions they are. Stars were the obvious control and the wrong one: they leave 2 and 4 undefined, and they read as satisfaction, which is exactly the impression-based judgement a behavioural rubric exists to replace. The control lives at the top of the right-hand pane, directly above the anchors it scores against, so picking a level and reading its description are one glance rather than a trip across the screen. Scoring a question with an empty evidence box raises an inline warning rather than blocking the score — the gap gets named, the interviewer decides, and the assessment step flags it again if it survives.

**The interview screen is built around one screenful.** The candidate/finish bar is pinned flush beneath the top bar and the page scrolls under it, which keeps Previous/Next on screen without scrolling at laptop heights (verified at 1440×900 and 1440×720). There is no running progress counter: during a live interview a "3 of 7 documented" tally is a pace nag, and the dots in the navigator already show which questions have notes. The workflow sidebar collapses to a 76px rail so the guide pane gets the width instead — the same rail the layout already uses below 1000px, so a manual collapse and a narrow window look identical. Step 5 happens after: competency scores derived from that evidence, then final notes, then the consistency check, then the recommendation, each revealed only once the previous is done. An interviewer who commits to a verdict first tends to write notes that justify it; sequencing the screen is what prevents that.

**The evidence is shown, not merged.** The final notes box sits beside a read-only panel replaying every per-question note verbatim, with its question and score. It is deliberately *not* prefilled with that text. The consistency check works by comparing two independently written things — what the interviewer recorded answer by answer, and what they concluded overall — so deriving the summary from the evidence would make a contradiction between them impossible by construction, which is precisely the signal worth having. Full recall, no autofill.

That evidence now also reaches the feedback agent attached to its own question, score and rubric, rather than joined into one unlabelled string per competency. The difference is not cosmetic: on a seeded case scoring 5/5 against a note reading *"could not name the primary metric… did not say what decision followed"*, plus a 4/5 with nothing recorded, the agent quoted both scores against their evidence, named the specific rubric anchor each failed, and flagged the "no concerns" summary as contradicting them. None of those were detectable before — the evidence was not in the prompt.

**The AI does not make the hiring decision — and neither does a default.** The feedback agent's tool schema has no `recommendation` field, so a hire/no-hire verdict is structurally impossible rather than merely discouraged. `overallRecommendation` is also *optional* and never defaulted: an audit found a `?? 'Hire'` fallback that fired the moment any evidence was typed, which then propagated into the stored record, into the analyst prompt as a stated decision, into the ATS summary, and back into the UI as a pre-selected button. The tool was authoring a hiring call and attributing it to the human. The ATS record is now composed at render time — analysis text plus the interviewer's current selection — so changing the recommendation changes the record rather than leaving a stale sentence behind. It returns considerations for the interviewer to weigh, flags contradictions between their scores and their notes, and catches impression language like "culture fit" — but the call, and the record of who made it, stays with the human.

## Deferred to v2

Designed and deliberately not built — see `../Build_Plan.md` Part 8 for the full rationale. Two elements of the proposed live-interview design were rejected rather than deferred: one-click "culture fit" tags, and auto-aggregating per-question scores into a recommendation.

- **Audio capture** — would let the feedback agent see what was actually said. Blocked on two-party consent law and Illinois BIPA, not on engineering time.
- **Guide reuse** — "same role, new candidate" is the most common thing this persona does, and today every guide starts from a blank form. Highest-value next build.
