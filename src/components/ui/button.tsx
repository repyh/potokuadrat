import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

function LoadingStroke() {
  return (
    <svg
      className="ui-spinner"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <LoadingStroke />
      ) : (
        iconLeft && <span className="ui-btn-icon" aria-hidden="true">{iconLeft}</span>
      )}
      <span className="ui-btn-label">{children}</span>
      {!loading && iconRight && (
        <span className="ui-btn-icon" aria-hidden="true">{iconRight}</span>
      )}
    </button>
  );
}

export function IconButton({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`ui-icon-btn ui-btn-${variant} ui-icon-btn-${size} ${className}`.trim()}
      {...rest}
    >
      {loading ? <LoadingStroke /> : children}
    </button>
  );
}
