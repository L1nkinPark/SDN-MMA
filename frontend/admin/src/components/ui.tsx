import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'text' | 'danger-text';
  size?: 'large' | 'medium' | 'small';
  busy?: boolean;
  busyLabel?: string;
};

export function Spinner() {
  return (
    <svg className="spin" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export function Button({ variant = 'primary', size = 'medium', busy = false, busyLabel, disabled, children, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}>
      {busy ? <Spinner /> : null}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
}

type FieldShellProps = { label: string; error?: string | null; invalid?: boolean; hint?: string; id: string; children: ReactNode };

function FieldShell({ label, error, invalid, hint, id, children }: FieldShellProps) {
  return (
    <div className={`field${error || invalid ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-msg`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-msg`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  /** Red label and line without a message, e.g. for wrong credentials. */
  invalid?: boolean;
  hint?: string;
};

export function TextField({ label, error, invalid, hint, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} error={error} invalid={invalid} hint={hint} id={fieldId}>
      <input
        id={fieldId}
        className="field__input"
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string | null; hint?: string };

export function TextArea({ label, error, hint, id, rows = 3, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} id={fieldId}>
      <textarea
        id={fieldId}
        rows={rows}
        className="field__input field__input--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] };

export function Select({ label, options, id, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} id={fieldId}>
      <select id={fieldId} className="field__input field__select" {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type ChoiceGroupProps<T> = {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** Square toggles: outline when off, filled ink when on. */
export function ChoiceGroup<T>({ legend, value, options, onChange, disabled }: ChoiceGroupProps<T>) {
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend className="field__label">{legend}</legend>
      <div className="choices__row">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={option.value === value}
            className={`chip${option.value === value ? ' chip--on' : ''}`}
            onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="page-header">
      <h1 className="page-header__title">{title}</h1>
      {right ? <div className="page-header__right">{right}</div> : null}
    </header>
  );
}

type FilterTabsProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

/** Underlined filter tabs; the active one has a 3px ink bar, like the app's tab bar. */
export function FilterTabs<T extends string>({ label, value, options, onChange }: FilterTabsProps<T>) {
  return (
    <div className="filter-tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`filter-tabs__tab${option.value === value ? ' filter-tabs__tab--on' : ''}`}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

type StateMessageProps = {
  heading: string;
  sentence: string;
  tone?: 'normal' | 'error';
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; busy?: boolean };
};

/** Left-aligned empty or error state: heading, one sentence, one button. */
export function StateMessage({ heading, sentence, tone = 'normal', action }: StateMessageProps) {
  return (
    <div className="state" role={tone === 'error' ? 'alert' : undefined}>
      <h2 className={`state__heading${tone === 'error' ? ' state__heading--error' : ''}`}>{heading}</h2>
      <p className="state__sentence">{sentence}</p>
      {action ? (
        <Button variant={action.variant ?? 'secondary'} onClick={action.onClick} busy={action.busy}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

const SKELETON = [
  { title: 214, line: 268 },
  { title: 186, line: 240 },
  { title: 228, line: 256 },
  { title: 200, line: 224 },
];

/** Static placeholder blocks in the row layout. */
export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, index) => {
        const row = SKELETON[index % SKELETON.length];
        return (
          <div key={index} className="skeleton" aria-hidden="true">
            <div className="skeleton__block" style={{ width: row.title, height: 16 }} />
            <div className="skeleton__block" style={{ width: row.line, height: 12 }} />
          </div>
        );
      })}
    </div>
  );
}

export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'ink' | 'muted' | 'error' }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

export function Pagination({ page, limit, total, onChange }: { page: number; limit: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Phân trang">
      <Button variant="secondary" size="small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Trang trước
      </Button>
      <span className="pagination__label">
        Trang {page}/{pages}
      </span>
      <Button variant="secondary" size="small" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Trang sau
      </Button>
    </nav>
  );
}

export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p className="form-alert" role="alert">
      {message}
    </p>
  );
}

export function Stars({ value }: { value: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <span className="stars" role="img" aria-label={`${filled} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill={star <= filled ? 'var(--ink)' : 'none'} stroke={star <= filled ? 'var(--ink)' : 'var(--field-line)'} strokeWidth="1.7" strokeLinejoin="round">
          <path d="m12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.8-6-3.4-6 3.4 1.3-6.8-5-4.7 6.8-.8L12 2.5Z" />
        </svg>
      ))}
    </span>
  );
}
