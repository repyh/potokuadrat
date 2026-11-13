import type { FieldsetHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  htmlFor: string;
  label: string;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend: string;
  description?: string;
  error?: string;
  children: ReactNode;
}

function ErrorIcon() {
  return (
    <svg
      className="ui-field-error-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.75v3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function Field({
  htmlFor,
  label,
  optionalLabel,
  hint,
  error,
  className = "",
  children,
  ...rest
}: FieldProps) {
  return (
    <div className={`ui-field ${error ? "ui-field-invalid" : ""} ${className}`.trim()} {...rest}>
      <div className="ui-field-header">
        <label htmlFor={htmlFor} className="ui-field-label">
          {label}
        </label>
        {optionalLabel && <span className="ui-field-optional">{optionalLabel}</span>}
      </div>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="ui-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="ui-field-error" role="alert">
          <ErrorIcon />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function Fieldset({
  legend,
  description,
  error,
  className = "",
  children,
  ...rest
}: FieldsetProps) {
  return (
    <fieldset className={`ui-fieldset ${className}`.trim()} {...rest}>
      <legend className="ui-fieldset-legend">{legend}</legend>
      {description && <p className="ui-fieldset-description">{description}</p>}
      <div className="ui-fieldset-body">{children}</div>
      {error && (
        <p className="ui-field-error" role="alert">
          <ErrorIcon />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
