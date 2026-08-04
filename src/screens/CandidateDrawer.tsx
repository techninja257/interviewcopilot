import { Icon } from '../components/ui';
import { CandidateForm } from './CandidateForm';
import './screens.css';

/** The tailoring form as an overlay on the briefing pack. */
export function CandidateDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tailor questions for a candidate"
      >
        <header className="drawer-head">
          <div>
            <h2 className="drawer-title">Tailor for a candidate</h2>
            <p className="drawer-sub">
              Questions that verify resume claims and test gaps against this role. They're added to
              the guide alongside the standard set.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="drawer-body">
          <CandidateForm onDone={onClose} onCancel={onClose} />
        </div>
      </aside>
    </div>
  );
}
