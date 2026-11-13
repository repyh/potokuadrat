"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="ui-dialog"
      aria-labelledby="ui-dialog-title"
    >
      <div className="ui-dialog-surface">
        <header className="ui-dialog-header">
          <div>
            <h2 id="ui-dialog-title" className="ui-dialog-title">
              {title}
            </h2>
            {description && <p className="ui-dialog-description">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="ui-overlay-close"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="ui-dialog-body">{children}</div>
        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = drawerRef.current;
    if (!el) {
      return;
    }
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={drawerRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === drawerRef.current) {
          onClose();
        }
      }}
      className="ui-drawer"
      aria-labelledby="ui-drawer-title"
    >
      <div className="ui-drawer-surface">
        <header className="ui-dialog-header">
          <div>
            <h2 id="ui-drawer-title" className="ui-dialog-title">
              {title}
            </h2>
            {description && <p className="ui-dialog-description">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="ui-overlay-close"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="ui-drawer-body">{children}</div>
        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
