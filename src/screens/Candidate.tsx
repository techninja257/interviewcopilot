import { Button, EmptyState, Icon } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CandidateForm } from './CandidateForm';
import './screens.css';

/**
 * Step 3 as its own screen.
 *
 * The same form is also available as a drawer over the briefing pack, for
 * tailoring without leaving the guide. This is the deliberate route for
 * someone working through the steps in order; the drawer is the shortcut.
 */
export function Candidate() {
  const { roleSetup, questions, candidateName, goTo } = useApp();
  const personalized = questions.filter((q) => q.source === 'personalized');

  // Tailoring needs a guide to attach personalized questions to.
  if (!roleSetup || questions.length === 0) {
    return (
      <div className="candidate-page">
        <EmptyState icon="person_search" title="Generate a guide first">
          Candidate tailoring adds resume-specific questions to an existing interview guide, so
          there needs to be a guide to add them to.
        </EmptyState>
        <div className="candidate-actions">
          <Button variant="primary" icon="arrow_back" onClick={() => goTo(1)}>
            Go to role setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-page">
      <div className="candidate-intro">
        <h2>Tailor for a candidate</h2>
        <p>
          Upload or paste a resume and we'll write questions that verify what it claims and test it
          against {roleSetup.jobTitle}. These are added to the guide alongside the standard
          questions, which stay the same for every candidate.
        </p>
      </div>

      {personalized.length > 0 && (
        <div className="candidate-existing">
          <div className="candidate-existing-head">
            <strong>
              {personalized.length} resume question{personalized.length === 1 ? '' : 's'} already in
              the guide{candidateName ? ` for ${candidateName}` : ''}
            </strong>
            <Button variant="ghost" size="sm" trailingIcon="arrow_forward" onClick={() => goTo(2)}>
              View in guide
            </Button>
          </div>
          <ul>
            {personalized.map((q) => (
              <li key={q.id}>{q.question}</li>
            ))}
          </ul>
          <p className="helper" style={{ marginTop: 'var(--sm)' }}>
            <Icon name="info" /> Generating again replaces these with questions for the new resume.
          </p>
        </div>
      )}

      <CandidateForm
        onDone={() => goTo(2)}
        submitLabel={
          personalized.length > 0 ? 'Replace resume questions' : 'Generate resume questions'
        }
      />
    </div>
  );
}
