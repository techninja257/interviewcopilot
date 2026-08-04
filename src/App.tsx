import { useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { AppProvider, useApp, type StepId } from './context/AppContext';
import { checkLiveReady, type LiveStatus } from './agents/client';
import { BriefingPack } from './screens/BriefingPack';
import { Candidate } from './screens/Candidate';
import { Interview } from './screens/Interview';
import { Assessment } from './screens/Assessment';
import { RoleSetup } from './screens/RoleSetup';
import './components/layout/layout.css';

const TITLES: Record<StepId, { title: string; crumbs: string[] }> = {
  1: { title: 'Role setup', crumbs: ['Interview guides', 'New guide'] },
  2: { title: 'Interviewer briefing pack', crumbs: ['Interview guides', 'Briefing pack'] },
  3: { title: 'Candidate tailoring', crumbs: ['Interview guides', 'Candidate'] },
  4: { title: 'Interview', crumbs: ['Interview guides', 'Interview'] },
  5: { title: 'Assessment', crumbs: ['Interview guides', 'Assessment'] },
};

function Shell() {
  const {
    currentStep,
    completedSteps,
    isDemo,
    roleSetup,
    recentSessions,
    goTo,
    loadSessionById,
    reset,
    setDemo,
  } = useApp();
  const [live, setLive] = useState<LiveStatus>({
    ready: false,
    provider: null,
    model: null,
    error: null,
  });

  // Persisted separately from session state: it is a display preference, not
  // part of the interview record, and it should outlive a reset.
  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem('ic.navCollapsed') === '1',
  );
  useEffect(() => {
    localStorage.setItem('ic.navCollapsed', navCollapsed ? '1' : '0');
  }, [navCollapsed]);

  useEffect(() => {
    checkLiveReady().then(setLive);
  }, []);

  // ?step=3 deep-links into a screen — useful for demos and screenshots.
  useEffect(() => {
    const step = Number(new URLSearchParams(window.location.search).get('step'));
    if (step >= 1 && step <= 5) goTo(step as StepId);
  }, [goTo]);

  const meta = TITLES[currentStep];
  const title =
    currentStep === 2 && roleSetup ? `${roleSetup.jobTitle} — briefing pack` : meta.title;

  return (
    <div className="shell">
      <Sidebar
        currentStep={currentStep}
        completedSteps={completedSteps}
        onNavigate={goTo}
        recentSessions={recentSessions}
        onLoadSession={loadSessionById}
        isDemo={isDemo}
        collapsed={navCollapsed}
        onToggleCollapsed={() => setNavCollapsed((c) => !c)}
      />
      <main className="main">
        <TopBar
          breadcrumb={meta.crumbs}
          title={title}
          isDemo={isDemo}
          liveReady={live.ready}
          providerLabel={live.model}
          liveError={live.error}
          onToggleMode={() => setDemo(!isDemo)}
          onReset={reset}
        />
        <div className="main-scroll">
          {currentStep === 1 && <RoleSetup />}
          {currentStep === 2 && <BriefingPack />}
          {currentStep === 3 && <Candidate />}
          {currentStep === 4 && <Interview />}
          {currentStep === 5 && <Assessment />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
