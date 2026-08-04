import { Icon } from '../ui';
import type { Session } from '../../types';
import './layout.css';

export type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; label: string; sub: string; icon: string }[] = [
  { id: 1, label: 'Role Setup', sub: 'Job description & round', icon: 'tune' },
  { id: 2, label: 'Briefing Pack', sub: 'The interview guide', icon: 'article' },
  { id: 3, label: 'Candidate', sub: 'Optional resume tailoring', icon: 'person_search' },
  { id: 4, label: 'Interview', sub: 'Capture evidence per question', icon: 'record_voice_over' },
  { id: 5, label: 'Assessment', sub: 'Scores, analysis, decision', icon: 'fact_check' },
];

export function Sidebar({
  currentStep,
  completedSteps,
  onNavigate,
  recentSessions,
  onLoadSession,
  isDemo,
  collapsed,
  onToggleCollapsed,
}: {
  currentStep: StepId;
  completedSteps: Set<number>;
  onNavigate: (step: StepId) => void;
  recentSessions: Session[];
  onLoadSession: (id: string) => void;
  isDemo: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <nav className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Icon name="communication" filled />
        </div>
        <div className="brand-text">
          <h1 className="brand-name">InterviewCopilot</h1>
          <p className="brand-tag">Structured hiring, in minutes</p>
        </div>
        {/* Collapsed, the step markers stay visible — the workflow position is
            the one thing worth keeping on screen when the pane is narrow. */}
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} />
        </button>
      </div>

      <div className="sidebar-section">
        <p className="eyebrow sidebar-heading">Workflow</p>
        <ol className="steps">
          {STEPS.map((step) => {
            const done = completedSteps.has(step.id);
            const active = currentStep === step.id;
            // Candidate tailoring (3) is optional, so Feedback (4) unlocks off
            // the briefing pack rather than off step 3 — otherwise skipping the
            // optional step would strand you before the scorecard.
            const prerequisite = step.id === 4 ? 2 : step.id - 1;
            const reachable = done || active || completedSteps.has(prerequisite);
            return (
              <li key={step.id}>
                <button
                  className={`step${active ? ' step--active' : ''}${done ? ' step--done' : ''}`}
                  disabled={!reachable}
                  onClick={() => onNavigate(step.id)}
                  aria-current={active ? 'step' : undefined}
                  title={collapsed ? `${step.label} — ${step.sub}` : undefined}
                >
                  <span className="step-marker">
                    {done && !active ? <Icon name="check" /> : <span>{step.id}</span>}
                  </span>
                  <span className="step-text">
                    <span className="step-label">{step.label}</span>
                    <span className="step-sub">{step.sub}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {recentSessions.length > 0 && (
        <div className="sidebar-section">
          <p className="eyebrow sidebar-heading">Recent guides</p>
          <ul className="recents">
            {recentSessions.slice(0, 3).map((s) => (
              <li key={s.id}>
                <button className="recent" onClick={() => onLoadSession(s.id)}>
                  <Icon name="history" />
                  <span className="recent-text">
                    <span className="recent-title">{s.roleSetup.jobTitle}</span>
                    <span className="recent-date">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sidebar-foot">
        {isDemo && (
          <div className="demo-pill">
            <Icon name="science" />
            Demo data
          </div>
        )}
        <p className="version">v0.1.0</p>
      </div>
    </nav>
  );
}
