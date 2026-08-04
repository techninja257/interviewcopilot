import { Button, Icon } from '../ui';
import './layout.css';

export function TopBar({
  breadcrumb,
  title,
  isDemo,
  liveReady,
  providerLabel,
  liveError,
  onToggleMode,
  onReset,
}: {
  breadcrumb: string[];
  title: string;
  isDemo: boolean;
  liveReady: boolean;
  providerLabel?: string | null;
  liveError?: string | null;
  onToggleMode: () => void;
  onReset: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-titles">
        <nav className="crumbs" aria-label="Breadcrumb">
          {breadcrumb.map((c, i) => (
            <span key={c} className="crumb">
              {i > 0 && <Icon name="chevron_right" className="crumb-sep" />}
              <span className={i === breadcrumb.length - 1 ? 'crumb-current' : ''}>{c}</span>
            </span>
          ))}
        </nav>
        <h2 className="topbar-title">{title}</h2>
      </div>

      <div className="topbar-actions">
        <button
          className={`mode-toggle${isDemo ? '' : ' mode-toggle--live'}`}
          onClick={onToggleMode}
          disabled={isDemo && !liveReady}
          title={
            liveReady
              ? `Switch between frozen sample data and live generation${providerLabel ? ` (${providerLabel})` : ''}`
              : (liveError ??
                'Live generation needs a working API key on the server. Copy .env.example to .env and add GROQ_API_KEY.')
          }
        >
          <span className={`mode-dot${isDemo ? '' : ' mode-dot--live'}`} />
          {isDemo ? 'Demo mode' : (providerLabel ?? 'Live generation')}
          {isDemo && !liveReady && <Icon name="lock" />}
        </button>
        <Button variant="ghost" size="sm" icon="restart_alt" onClick={onReset}>
          New guide
        </Button>
      </div>

      {liveError && (
        <div className="live-banner">
          <Icon name="info" filled />
          <span>
            <strong>{isDemo ? 'Demo data.' : 'Live generation unavailable.'}</strong> {liveError}
          </span>
        </div>
      )}
    </header>
  );
}
