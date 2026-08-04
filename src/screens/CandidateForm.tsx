import { useRef, useState } from 'react';
import { Button, Icon, Input, Slider, TextArea } from '../components/ui';
import { useApp } from '../context/AppContext';
import { runPersonalizeChain } from '../agents/chain';
import { SAMPLE_RESUME } from '../data/sampleSession';
import { extractPdfText, guessCandidateName, PdfExtractionError } from '../utils/pdf';
import { checkResumeGrounding } from '../agents/grounding';
import './screens.css';

/** Timing labels produced by the personalize chain — see agents/chain.ts. */
const PERSONALIZE_AGENTS = new Set(['Personalizer', 'Bias audit (personalized)']);

/**
 * The resume-tailoring form itself, without any surrounding chrome.
 *
 * It is rendered in two places — the drawer over the briefing pack, and the
 * standalone Candidate step — so the logic lives here rather than in either
 * one. Duplicating it would mean the PDF handling and validation drifting
 * apart the first time one of them changes.
 */
export function CandidateForm({
  onDone,
  onCancel,
  submitLabel = 'Generate questions',
}: {
  onDone: () => void;
  /** Rendered as a Cancel button when provided — the drawer wants one, the page does not. */
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const {
    roleSetup,
    competencies,
    questions,
    candidateName,
    resumeText,
    resumeFileName,
    isDemo,
    timings,
    loadDemoCandidate,
    dispatch,
  } = useApp();
  const [name, setName] = useState(candidateName ?? '');
  const [resume, setResume] = useState(resumeText ?? '');
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  // Seeded from state so a reload still shows which PDF the text came from.
  const [sourceFile, setSourceFile] = useState<string | null>(resumeFileName ?? null);
  const [nameGuessed, setNameGuessed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const canGenerate = name.trim().length > 1 && resume.trim().length > 80;

  async function ingestFile(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Only PDF files can be read here. For other formats, paste the text below.');
      return;
    }
    setReading(true);
    setError(null);
    try {
      const text = await extractPdfText(file);
      setResume(text);
      setSourceFile(file.name);
      // The extracted text stays editable — pdf.js output is good but not
      // perfect on multi-column layouts, and the user should be able to fix it
      // before the personalizer quotes from it.

      // Fill the name from the resume, but never overwrite one already typed:
      // the guess is heuristic and the human's entry always outranks it.
      const guessed = guessCandidateName(text);
      const resolvedName = guessed && !name.trim() ? guessed : name;
      if (guessed && !name.trim()) {
        setName(guessed);
        setNameGuessed(true);
      }

      // Commit to app state immediately rather than waiting for Generate — a
      // reload after uploading should not silently discard the parsed resume.
      dispatch({
        type: 'SET_CANDIDATE',
        name: resolvedName.trim(),
        resume: text,
        fileName: file.name,
      });
    } catch (e) {
      setSourceFile(null);
      setError(
        e instanceof PdfExtractionError
          ? e.message
          : 'Could not read that PDF. Paste the resume text instead.',
      );
    } finally {
      setReading(false);
    }
  }

  async function handleGenerate() {
    if (!roleSetup || !canGenerate) return;
    setBusy(true);
    setError(null);

    if (isDemo) {
      loadDemoCandidate(sourceFile);
      setBusy(false);
      onDone();
      return;
    }

    try {
      dispatch({ type: 'SET_CANDIDATE', name: name.trim(), resume, fileName: sourceFile });
      const result = await runPersonalizeChain({
        roleSetup,
        competencies,
        standardQuestions: questions.filter((q) => q.source === 'standard'),
        resumeText: resume,
        candidateName: name.trim(),
        count,
      });
      dispatch({ type: 'ADD_PERSONALIZED', questions: result.questions });
      dispatch({
        type: 'SET_RESUME_GROUNDING',
        grounding: checkResumeGrounding(result.questions, resume),
      });
      // Appended, not replaced: the personalizer and its bias audit are real
      // agent time. Dropping them made "generated in Xs" report only the
      // JD chain, understating the work the app actually did. Prior
      // personalized-question timings are dropped first so re-tailoring
      // replaces rather than double-counts — ADD_PERSONALIZED discards the
      // old personalized questions too.
      dispatch({
        type: 'SET_TIMINGS',
        timings: [...timings.filter((t) => !PERSONALIZE_AGENTS.has(t.agent)), ...result.timings],
      });
      for (const entry of result.raw) {
        dispatch({ type: 'LOG_RAW', agent: entry.agent, response: entry.response });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate personalized questions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Blocks the whole surface while an agent is running. The Generate
          button was already disabled, but the resume box and file picker were
          not — so the text could be changed mid-flight and the returned
          questions would quote a resume no longer on screen. */}
      {busy && (
        <div className="gen-blocker" role="alert" aria-busy="true">
          <div className="gen-blocker-card">
            <span className="spinner" />
            <p className="gen-blocker-title">Analysing {name.trim() || 'the candidate'}'s resume</p>
            <p className="gen-blocker-sub">
              Writing resume-specific questions, then auditing them for compliance. Usually 20–60
              seconds — editing is locked so the questions match what you submitted.
            </p>
          </div>
        </div>
      )}

      <div className="candidate-fields">
        <Input
          id="candidate"
          label="Candidate name"
          placeholder="e.g. Alex Rivera"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameGuessed) setNameGuessed(false);
          }}
          hint={nameGuessed ? 'Read from the resume — correct it if it is wrong.' : undefined}
        />

        <div className="field">
          <span className="label">Resume PDF</span>
          <div
            className={`dropzone${dragging ? ' dropzone--over' : ''}${reading ? ' dropzone--busy' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void ingestFile(file);
            }}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click();
            }}
          >
            <Icon name={reading ? 'hourglass_top' : sourceFile ? 'task' : 'upload_file'} />
            <span>
              {reading
                ? 'Reading PDF…'
                : sourceFile
                  ? `${sourceFile} — text extracted below`
                  : 'Drop a resume PDF here, or click to choose'}
            </span>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void ingestFile(file);
              // Reset so re-selecting the same file fires onChange again.
              e.target.value = '';
            }}
          />
        </div>

        <TextArea
          id="resume"
          label="Resume text"
          placeholder="Paste the candidate's resume, or upload a PDF above…"
          rows={12}
          value={resume}
          onChange={(e) => {
            setResume(e.target.value);
            if (sourceFile) setSourceFile(null);
          }}
          hint={
            sourceFile
              ? `${resume.trim().length} characters extracted — edit if the layout came through wrong`
              : `${resume.trim().length} characters`
          }
        />

        <Slider
          label="Number of resume-specific questions"
          min={2}
          max={5}
          value={count}
          onChange={setCount}
        />

        {error && (
          <div className="inline-error">
            <Icon name="error" filled />
            {error}
          </div>
        )}

        <button
          className="text-link"
          onClick={() => {
            setName('Alex Rivera');
            setResume(SAMPLE_RESUME);
          }}
        >
          Load the sample candidate resume
        </button>
      </div>

      <div className="candidate-actions">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          icon="auto_awesome"
          onClick={handleGenerate}
          disabled={!canGenerate || busy || reading}
        >
          {busy ? 'Analysing resume…' : submitLabel}
        </Button>
      </div>
    </>
  );
}
