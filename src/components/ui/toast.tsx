"use client";

import { useState } from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export interface ToastItem {
  id: string;
  tone?: ToastTone;
  title: string;
  message?: string;
  durationMs?: number;
}

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const TOAST_TONE_CLASSES: Record<
  ToastTone,
  { border: string; bg: string; text: string; badge: string }
> = {
  neutral: {
    border: "border-[var(--line)]",
    bg: "bg-[var(--paper)]",
    text: "text-[var(--ink)]",
    badge: "bg-[var(--ground)] text-[var(--ink)]",
  },
  success: {
    border: "border-[#15803d]",
    bg: "bg-[var(--paper)]",
    text: "text-[var(--ink)]",
    badge: "bg-[#dcfce7] text-[#15803d]",
  },
  warning: {
    border: "border-[#b45309]",
    bg: "bg-[var(--paper)]",
    text: "text-[var(--ink)]",
    badge: "bg-[#fef3c7] text-[#b45309]",
  },
  danger: {
    border: "border-[#b91c1c]",
    bg: "bg-[var(--paper)]",
    text: "text-[var(--ink)]",
    badge: "bg-[#fee2e2] text-[#b91c1c]",
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const tone = toast.tone ?? "neutral";
  const styles = TOAST_TONE_CLASSES[tone];

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`w-full max-w-sm p-4 border shadow-md flex items-start justify-between gap-3 ${styles.bg} ${styles.border} ${styles.text}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 font-mono ${styles.badge}`}
          >
            {tone}
          </span>
          <h4 className="text-xs font-bold font-sans">{toast.title}</h4>
        </div>
        {toast.message && <p className="text-xs text-[var(--quiet)]">{toast.message}</p>}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        className="text-[var(--quiet)] hover:text-[var(--ink)] p-1 text-xs cursor-pointer font-mono"
      >
        ×
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  className?: string;
}

export function ToastContainer({ toasts, onDismiss, className = "" }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto ${className}`.trim()}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (item: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...item, id }]);

    const duration = item.durationMs ?? 4000;
    if (duration > 0 && typeof window !== "undefined") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, dismissToast };
}
