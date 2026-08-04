import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type {
  AgentTiming,
  Competency,
  FeedbackAnalysis,
  GeneratedQuestion,
  GenerationStage,
  GroundingReport,
  InterviewFeedback,
  RoleSetupInput,
  Session,
} from '../types';
import { buildSampleSession, SAMPLE_PERSONALIZED, SAMPLE_RESUME } from '../data/sampleSession';
import { checkResumeGrounding } from '../agents/grounding';

export type StepId = 1 | 2 | 3 | 4 | 5;

interface AppState {
  currentStep: StepId;
  completedSteps: Set<number>;
  isDemo: boolean;
  roleSetup: RoleSetupInput | null;
  competencies: Competency[];
  questions: GeneratedQuestion[];
  candidateName: string | null;
  resumeText: string | null;
  resumeFileName: string | null;
  feedback: InterviewFeedback | null;
  feedbackAnalysis: FeedbackAnalysis | null;
  isGenerating: boolean;
  stage: GenerationStage;
  error: string | null;
  timings: AgentTiming[];
  grounding: GroundingReport | null;
  /** Same check as `grounding`, run against the resume for personalized questions. */
  resumeGrounding: GroundingReport | null;
  recentSessions: Session[];
  /** Raw model responses, kept for the dev panel and evaluation write-up. */
  rawLog: { agent: string; response: string }[];
}

type Action =
  | { type: 'SET_STEP'; step: StepId }
  | { type: 'COMPLETE_STEP'; step: number }
  | { type: 'SET_DEMO'; isDemo: boolean }
  | { type: 'SET_ROLE_SETUP'; data: RoleSetupInput }
  | { type: 'SET_GENERATION'; competencies: Competency[]; questions: GeneratedQuestion[] }
  | { type: 'SET_CANDIDATE'; name: string; resume: string; fileName?: string | null }
  | { type: 'ADD_PERSONALIZED'; questions: GeneratedQuestion[] }
  | { type: 'REMOVE_QUESTION'; id: string }
  | { type: 'SET_FEEDBACK'; data: InterviewFeedback }
  | { type: 'SET_ANALYSIS'; data: FeedbackAnalysis }
  | { type: 'SET_GENERATING'; isGenerating: boolean; stage?: GenerationStage }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_TIMINGS'; timings: AgentTiming[] }
  | { type: 'SET_GROUNDING'; grounding: GroundingReport | null }
  | { type: 'SET_RESUME_GROUNDING'; grounding: GroundingReport | null }
  | { type: 'LOG_RAW'; agent: string; response: string }
  | { type: 'LOAD_SESSION'; session: Session }
  | { type: 'SET_RECENTS'; sessions: Session[] }
  | { type: 'RESET' };

/**
 * Bump when the persisted session shape changes. Old entries are dropped
 * rather than migrated — a stale guide restoring into a newer UI is more
 * confusing than starting fresh.
 */
const SCHEMA = 'v6';
const RECENTS_KEY = `interviewcopilot.recents.${SCHEMA}`;
const CURRENT_KEY = `interviewcopilot.current.${SCHEMA}`;

/** Clears entries written by earlier schema versions. */
function pruneStaleStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('interviewcopilot.') && !key.endsWith(`.${SCHEMA}`)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable — nothing to prune */
  }
}

function emptyState(isDemo: boolean): AppState {
  return {
    currentStep: 1,
    completedSteps: new Set(),
    isDemo,
    roleSetup: null,
    competencies: [],
    questions: [],
    candidateName: null,
    resumeText: null,
    resumeFileName: null,
    feedback: null,
    feedbackAnalysis: null,
    isGenerating: false,
    stage: 'idle',
    error: null,
    timings: [],
    grounding: null,
    resumeGrounding: null,
    recentSessions: [],
    rawLog: [],
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'COMPLETE_STEP':
      return { ...state, completedSteps: new Set(state.completedSteps).add(action.step) };
    case 'SET_DEMO': {
      if (action.isDemo) {
        const sample = buildSampleSession();
        return {
          ...emptyState(true),
          // The sample arrives with a finished guide, so the briefing pack (2)
          // counts as reached — otherwise the optional Candidate step and the
          // scorecard stay locked in demo mode.
          completedSteps: new Set([1, 2]),
          roleSetup: sample.roleSetup,
          competencies: sample.competencies,
          questions: sample.questions,
          timings: sample.timings,
          grounding: sample.grounding ?? null,
          resumeGrounding: sample.resumeGrounding ?? null,
          recentSessions: state.recentSessions,
        };
      }
      return { ...emptyState(false), recentSessions: state.recentSessions };
    }
    case 'SET_ROLE_SETUP':
      return { ...state, roleSetup: action.data };
    case 'SET_GENERATION':
      return {
        ...state,
        competencies: action.competencies,
        questions: action.questions,
        // Generating the guide completes role setup (1) and produces the
        // briefing pack (2) in one action.
        completedSteps: new Set(state.completedSteps).add(1).add(2),
      };
    case 'SET_CANDIDATE':
      return {
        ...state,
        candidateName: action.name,
        resumeText: action.resume,
        resumeFileName: action.fileName ?? null,
      };
    case 'ADD_PERSONALIZED':
      return {
        ...state,
        questions: [
          ...state.questions.filter((q) => q.source === 'standard'),
          ...action.questions,
        ],
        completedSteps: new Set(state.completedSteps).add(3),
      };
    case 'REMOVE_QUESTION':
      return { ...state, questions: state.questions.filter((q) => q.id !== action.id) };
    case 'SET_FEEDBACK': {
      // Any captured evidence means the interview step has been started, which
      // is what makes the assessment reachable.
      const captured = (action.data.questionScores ?? []).length > 0;
      return {
        ...state,
        feedback: action.data,
        completedSteps: captured
          ? new Set(state.completedSteps).add(4)
          : state.completedSteps,
      };
    }
    case 'SET_ANALYSIS':
      return {
        ...state,
        feedbackAnalysis: action.data,
        // Producing an analysis means the interview was captured (4) and the
        // assessment completed (5).
        completedSteps: new Set(state.completedSteps).add(4).add(5),
      };
    case 'SET_GENERATING':
      return {
        ...state,
        isGenerating: action.isGenerating,
        stage: action.stage ?? (action.isGenerating ? state.stage : 'idle'),
      };
    case 'SET_ERROR':
      return { ...state, error: action.error, isGenerating: false, stage: 'idle' };
    case 'SET_TIMINGS':
      return { ...state, timings: action.timings };
    case 'SET_GROUNDING':
      return { ...state, grounding: action.grounding };
    case 'SET_RESUME_GROUNDING':
      return { ...state, resumeGrounding: action.grounding };
    case 'LOG_RAW':
      return {
        ...state,
        rawLog: [...state.rawLog, { agent: action.agent, response: action.response }],
      };
    case 'LOAD_SESSION': {
      const s = action.session;
      const completed = new Set<number>([1, 2]);
      if (s.questions.some((q) => q.source === 'personalized')) completed.add(3);
      if (s.feedbackAnalysis) completed.add(4).add(5);
      return {
        ...state,
        currentStep: 2,
        completedSteps: completed,
        roleSetup: s.roleSetup,
        competencies: s.competencies,
        questions: s.questions,
        candidateName: s.candidateName ?? null,
        resumeText: s.resumeText ?? null,
        resumeFileName: s.resumeFileName ?? null,
        feedback: s.feedback ?? null,
        feedbackAnalysis: s.feedbackAnalysis ?? null,
        timings: s.timings,
        grounding: s.grounding ?? null,
        resumeGrounding: s.resumeGrounding ?? null,
        error: null,
      };
    }
    case 'SET_RECENTS':
      return { ...state, recentSessions: action.sessions };
    case 'RESET':
      return { ...emptyState(state.isDemo), recentSessions: state.recentSessions };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  dispatch: React.Dispatch<Action>;
  goTo: (step: StepId) => void;
  loadDemoCandidate: (fileName?: string | null) => void;
  saveCurrent: () => void;
  loadSessionById: (id: string) => void;
  reset: () => void;
  setDemo: (isDemo: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readRecents(): Session[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

pruneStaleStorage();

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    // A refresh keeps the generated guide — losing it would mean paying for the
    // same generation twice — and returns to the step the user was actually on,
    // so a reload while reading the briefing pack is a no-op rather than a
    // trip back to the form. Falls back to step 1 when nothing was recorded.
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Session & { isDemo?: boolean; currentStep?: StepId };
        if (saved.questions?.length) {
          const completed = new Set<number>([1, 2]);
          if (saved.questions.some((q) => q.source === 'personalized')) completed.add(3);
          // Captured evidence means the interview step was worked on, which is
          // what makes the assessment reachable after a reload.
          if ((saved.feedback?.questionScores ?? []).length > 0) completed.add(4);
          if (saved.feedbackAnalysis) completed.add(4).add(5);
          // Reachability, not completion, decides where a reload lands. Steps
          // 1-3 are always reachable once a guide exists (it does, or we would
          // not be in this branch) and 4 follows the briefing pack; only the
          // assessment needs the interview to have been started.
          const savedStep = saved.currentStep;
          const reachable = (step: StepId) => (step === 5 ? completed.has(4) : true);
          const restoredStep: StepId =
            savedStep && savedStep >= 1 && savedStep <= 5 && reachable(savedStep) ? savedStep : 2;
          return {
            ...emptyState(saved.isDemo ?? false),
            currentStep: restoredStep,
            completedSteps: completed,
            roleSetup: saved.roleSetup,
            competencies: saved.competencies,
            questions: saved.questions,
            candidateName: saved.candidateName ?? null,
            resumeText: saved.resumeText ?? null,
            resumeFileName: saved.resumeFileName ?? null,
            feedback: saved.feedback ?? null,
            feedbackAnalysis: saved.feedbackAnalysis ?? null,
            timings: saved.timings ?? [],
            grounding: saved.grounding ?? null,
            resumeGrounding: saved.resumeGrounding ?? null,
            recentSessions: readRecents(),
          };
        }
      }
    } catch {
      /* fall through to a clean start */
    }
    return { ...emptyState(false), recentSessions: readRecents() };
  });

  // Persist the working session on every meaningful change.
  useEffect(() => {
    if (!state.roleSetup || state.questions.length === 0) return;
    const session: Session & { isDemo: boolean; currentStep: StepId } = {
      id: 'current',
      createdAt: new Date().toISOString(),
      isDemo: state.isDemo,
      currentStep: state.currentStep,
      roleSetup: state.roleSetup,
      competencies: state.competencies,
      questions: state.questions,
      candidateName: state.candidateName ?? undefined,
      resumeText: state.resumeText ?? undefined,
      resumeFileName: state.resumeFileName ?? undefined,
      feedback: state.feedback ?? undefined,
      feedbackAnalysis: state.feedbackAnalysis ?? undefined,
      timings: state.timings,
      grounding: state.grounding ?? undefined,
      resumeGrounding: state.resumeGrounding ?? undefined,
    };
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(session));
    } catch {
      /* quota exceeded — non-fatal, the session just isn't restorable */
    }
  }, [
    state.roleSetup,
    state.competencies,
    state.questions,
    state.candidateName,
    state.resumeText,
    state.resumeFileName,
    state.feedback,
    state.feedbackAnalysis,
    state.timings,
    state.grounding,
    state.resumeGrounding,
    state.isDemo,
    state.currentStep,
  ]);

  const goTo = useCallback((step: StepId) => dispatch({ type: 'SET_STEP', step }), []);

  // fileName is passed through so a demo run started from a real upload keeps
  // showing which PDF it came from.
  const loadDemoCandidate = useCallback((fileName?: string | null) => {
    dispatch({ type: 'SET_CANDIDATE', name: 'Alex Rivera', resume: SAMPLE_RESUME, fileName });
    dispatch({ type: 'ADD_PERSONALIZED', questions: SAMPLE_PERSONALIZED });
    // Real check against the fixture, not a canned number — demo mode should
    // show the same evidence a live run would, including the grounding stat.
    dispatch({
      type: 'SET_RESUME_GROUNDING',
      grounding: checkResumeGrounding(SAMPLE_PERSONALIZED, SAMPLE_RESUME),
    });
  }, []);

  const saveCurrent = useCallback(() => {
    if (!state.roleSetup || state.questions.length === 0) return;
    const session: Session = {
      id: `s-${Date.now()}`,
      createdAt: new Date().toISOString(),
      roleSetup: state.roleSetup,
      competencies: state.competencies,
      questions: state.questions,
      candidateName: state.candidateName ?? undefined,
      resumeText: state.resumeText ?? undefined,
      resumeFileName: state.resumeFileName ?? undefined,
      feedback: state.feedback ?? undefined,
      feedbackAnalysis: state.feedbackAnalysis ?? undefined,
      timings: state.timings,
      grounding: state.grounding ?? undefined,
      resumeGrounding: state.resumeGrounding ?? undefined,
    };
    const next = [session, ...readRecents()].slice(0, 5);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* quota exceeded */
    }
    dispatch({ type: 'SET_RECENTS', sessions: next });
  }, [state]);

  const loadSessionById = useCallback((id: string) => {
    const found = readRecents().find((s) => s.id === id);
    if (found) dispatch({ type: 'LOAD_SESSION', session: found });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(CURRENT_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  const setDemo = useCallback((isDemo: boolean) => {
    localStorage.removeItem(CURRENT_KEY);
    dispatch({ type: 'SET_DEMO', isDemo });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      dispatch,
      goTo,
      loadDemoCandidate,
      saveCurrent,
      loadSessionById,
      reset,
      setDemo,
    }),
    [state, goTo, loadDemoCandidate, saveCurrent, loadSessionById, reset, setDemo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
