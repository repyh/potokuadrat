import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  currentLength?: number;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
}

export function Input({
  invalid = false,
  prefix,
  suffix,
  disabled = false,
  className = "",
  ...rest
}: InputProps) {
  return (
    <div
      className={`ui-input-shell ${invalid ? "ui-input-invalid" : ""} ${
        disabled ? "ui-input-disabled" : ""
      } ${className}`.trim()}
    >
      {prefix && <span className="ui-input-affix ui-input-prefix">{prefix}</span>}
      <input
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="ui-input-control"
        {...rest}
      />
      {suffix && <span className="ui-input-affix ui-input-suffix">{suffix}</span>}
    </div>
  );
}

export function Textarea({
  invalid = false,
  disabled = false,
  maxLength,
  currentLength,
  className = "",
  ...rest
}: TextareaProps) {
  return (
    <div className={`ui-textarea-wrap ${className}`.trim()}>
      <textarea
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        className={`ui-textarea-control ${invalid ? "ui-input-invalid" : ""}`.trim()}
        {...rest}
      />
      {typeof maxLength === "number" && typeof currentLength === "number" && (
        <div className="ui-textarea-counter" aria-live="polite">
          {currentLength} / {maxLength}
        </div>
      )}
    </div>
  );
}

export function Select({
  options,
  placeholder,
  invalid = false,
  disabled = false,
  className = "",
  ...rest
}: SelectProps) {
  return (
    <div
      className={`ui-select-shell ${invalid ? "ui-input-invalid" : ""} ${
        disabled ? "ui-input-disabled" : ""
      } ${className}`.trim()}
    >
      <select
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="ui-select-control"
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="ui-select-chevron" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M4 6.5L8 10.5L12 6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
