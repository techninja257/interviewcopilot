import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import './ui.css';

export function Icon({
  name,
  filled,
  className = '',
  ...rest
}: { name: string; filled?: boolean; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`material-symbols-outlined${filled ? ' filled' : ''} ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {name}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  trailingIcon?: string;
  full?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  full,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size}${full ? ' btn--full' : ''} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} />}
    </button>
  );
}

export function Input({
  label,
  hint,
  error,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} className={`control${error ? ' control--error' : ''}`} {...rest} />
      {error ? <p className="field-error">{error}</p> : hint ? <p className="helper">{hint}</p> : null}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <textarea id={id} className={`control control--area${error ? ' control--error' : ''}`} {...rest} />
      {error ? <p className="field-error">{error}</p> : hint ? <p className="helper">{hint}</p> : null}
    </div>
  );
}

export function Select({
  label,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="select-wrap">
        <select id={id} className="control control--select" {...rest}>
          {children}
        </select>
        <Icon name="expand_more" className="select-chevron" />
      </div>
    </div>
  );
}

export function Chip({
  children,
  selected,
  onClick,
  onRemove,
  tone = 'default',
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  tone?: 'default' | 'flame' | 'success' | 'warning' | 'danger';
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className={`chip chip--${tone}${selected ? ' chip--selected' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
      {onRemove && (
        <span
          className="chip-remove"
          role="button"
          tabIndex={0}
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          <Icon name="close" />
        </span>
      )}
    </Tag>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      {label && <span className="label">{label}</span>}
      <div className="segmented" role="tablist">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={value === opt}
            className={`segmented-item${value === opt ? ' is-active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="field">
      <div className="slider-head">
        <span className="label" style={{ marginBottom: 0 }}>
          {label}
        </span>
        <span className="slider-value">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function StarRating({
  value,
  onChange,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="stars" role="radiogroup">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of ${max}`}
          className={`star${n <= value ? ' star--on' : ''}`}
          onClick={() => onChange(n === value ? 0 : n)}
        >
          <Icon name="star" filled={n <= value} />
        </button>
      ))}
    </div>
  );
}

/**
 * The scoring control used during the interview.
 *
 * Deliberately not stars. The rubric defines anchors at 1, 3 and 5, so the
 * control names those three levels and marks 2 and 4 as the deliberate
 * in-between positions they are — an interviewer picking 4 should know they are
 * saying "better than the level-3 description, short of level 5", not nudging a
 * rating up. Stars also read as satisfaction, which is the impression-based
 * judgement the rubric exists to replace.
 */
const SCORE_LABELS: Record<number, string> = {
  1: 'Below bar',
  2: 'Between',
  3: 'Meets bar',
  4: 'Between',
  5: 'Exceeds bar',
};

export function ScoreScale({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  id?: string;
}) {
  return (
    <div className="scorescale">
      <div className="scorescale-row" role="radiogroup" aria-labelledby={id}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${SCORE_LABELS[n]}`}
            className={`scorebtn${value === n ? ' scorebtn--on' : ''}${
              n === 1 || n === 3 || n === 5 ? ' scorebtn--anchor' : ''
            }`}
            // Clicking the current value clears it, so a mis-click during an
            // interview is one click to undo rather than a stuck score.
            onClick={() => onChange(n === value ? 0 : n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="scorescale-legend">
        {value ? (
          <>
            <strong>{value}</strong> · {SCORE_LABELS[value]}
          </>
        ) : (
          'Not yet scored'
        )}
      </p>
    </div>
  );
}

export function Callout({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`callout callout--${tone}`}>
      <Icon name={icon} filled className="callout-icon" />
      <div className="callout-body">
        <h3 className="callout-title">{title}</h3>
        <div className="callout-content">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} />
      </div>
      <h3 className="empty-title">{title}</h3>
      {children && <p className="empty-text">{children}</p>}
    </div>
  );
}
