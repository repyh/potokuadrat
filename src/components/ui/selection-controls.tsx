"use client";

import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  invalid?: boolean;
}

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  legend: string;
  name: string;
  value: string;
  onChange: (nextValue: string) => void;
  options: RadioOption[];
  disabled?: boolean;
  error?: string;
}

export interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Checkbox({
  id,
  label,
  description,
  invalid = false,
  disabled = false,
  className = "",
  ...rest
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`ui-choice-row ${disabled ? "ui-choice-disabled" : ""} ${className}`.trim()}
    >
      <span className="ui-checkbox-box-wrap">
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={`ui-checkbox-input ${invalid ? "ui-choice-invalid" : ""}`.trim()}
          {...rest}
        />
        <svg className="ui-checkbox-mark" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M3 7.2L5.8 10L11 4.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="ui-choice-copy">
        <span className="ui-choice-label">{label}</span>
        {description && <span className="ui-choice-description">{description}</span>}
      </span>
    </label>
  );
}

export function RadioGroup({
  legend,
  name,
  value,
  onChange,
  options,
  disabled = false,
  error,
}: RadioGroupProps) {
  return (
    <fieldset className="ui-radio-fieldset" disabled={disabled}>
      <legend className="ui-fieldset-legend">{legend}</legend>
      <div className="ui-radio-list">
        {options.map((opt) => {
          const isChecked = value === opt.value;
          const isOptDisabled = disabled || Boolean(opt.disabled);
          const inputId = `${name}-${opt.value}`;

          return (
            <label
              key={opt.value}
              htmlFor={inputId}
              className={`ui-choice-row ${isOptDisabled ? "ui-choice-disabled" : ""}`.trim()}
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={opt.value}
                checked={isChecked}
                disabled={isOptDisabled}
                onChange={() => onChange(opt.value)}
                className="ui-radio-input"
              />
              <span className="ui-choice-copy">
                <span className="ui-choice-label">{opt.label}</span>
                {opt.description && (
                  <span className="ui-choice-description">{opt.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="ui-field-error" role="alert">
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}

export function Switch({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchProps) {
  return (
    <div className={`ui-switch-row ${disabled ? "ui-choice-disabled" : ""}`.trim()}>
      <div className="ui-choice-copy">
        <label htmlFor={id} className="ui-choice-label">
          {label}
        </label>
        {description && <span className="ui-choice-description">{description}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`ui-switch-track ${checked ? "ui-switch-checked" : ""}`.trim()}
      >
        <span className="ui-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}
