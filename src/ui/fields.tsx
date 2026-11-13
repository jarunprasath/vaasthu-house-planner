import { useEffect, useId, useState, type ReactNode } from 'react';
import { formatLength, parseLength } from '../model/units';
import type { DisplayUnit } from '../model/types';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-ochre disabled:opacity-50';

/**
 * Length input that accepts 12'6", 12 ft 6 in, 3.5m, 350cm … and commits on Enter or blur.
 * Invalid text is highlighted and not committed.
 */
export function LengthInput({
  valueMm,
  unit,
  onCommit,
  disabled,
  min = 0,
  ariaLabel,
}: {
  valueMm: number;
  unit: DisplayUnit;
  onCommit: (mm: number) => void;
  disabled?: boolean;
  min?: number;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(formatLength(valueMm, unit));
  const [error, setError] = useState(false);
  useEffect(() => {
    setText(formatLength(valueMm, unit));
    setError(false);
  }, [valueMm, unit]);

  const commit = () => {
    const mm = parseLength(text, unit);
    if (mm === null || mm < min) {
      setError(true);
      return;
    }
    setError(false);
    if (Math.abs(mm - valueMm) > 0.01) onCommit(mm);
    else setText(formatLength(valueMm, unit));
  };

  return (
    <input
      className={`${inputCls} ${error ? 'border-danger' : ''}`}
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={error}
      title={error ? `Not a valid length. Try 12'6", 12.5, 3.8m or 380cm` : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setText(formatLength(valueMm, unit));
          setError(false);
        }
        e.stopPropagation();
      }}
    />
  );
}

export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  suffix,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (!Number.isFinite(v) || (min !== undefined && v < min) || (max !== undefined && v > max)) {
      setText(String(value));
      return;
    }
    if (v !== value) onCommit(v);
  };
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className={inputCls}
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
      />
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onCommit,
  disabled,
  ariaLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className={inputCls}
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() && text !== value && onCommit(text.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        e.stopPropagation();
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select className={inputCls} value={value} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" className="h-4 w-4 accent-[var(--ochre)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
  className = '',
  type = 'button',
  ariaPressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
  ariaPressed?: boolean;
}) {
  const styles = {
    default: 'border border-line bg-panel text-ink hover:border-ink-soft',
    primary: 'border border-ink bg-ink text-panel hover:opacity-90',
    danger: 'border border-line bg-panel text-danger hover:border-danger',
    ghost: 'border border-transparent text-ink hover:bg-ochre-soft',
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {action}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg border border-line bg-panel shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="min-w-0 flex-1 text-lg font-bold text-ink">{title}</h2>
          <button className="shrink-0 rounded px-2 py-1 text-xl leading-none text-muted hover:text-ink" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
