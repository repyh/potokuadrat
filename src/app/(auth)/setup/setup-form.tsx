"use client";

import { useActionState, useState } from "react";

import { ACCENT_PRESETS } from "@/contracts/branding";
import { BrandMark } from "@/components/brand-mark";
import { Alert, Button, Field, Input } from "@/components/ui";

import { setupAction, type SetupState } from "./actions";

const initialState: SetupState = {};

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupAction, initialState);
  const [orgName, setOrgName] = useState(state.fields?.organizationName ?? "");
  const [accent, setAccent] = useState(state.fields?.accent ?? "");
  const [logo, setLogo] = useState(state.fields?.logo ?? "");

  return (
    <form action={formAction} className="auth-form" noValidate>
      <Field
        htmlFor="organizationName"
        label="Organization name"
        hint="Shown in the admin header and on share pages."
      >
        <Input
          id="organizationName"
          name="organizationName"
          autoComplete="organization"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          disabled={pending}
        />
      </Field>

      <Field
        htmlFor="accent"
        label="Brand accent color"
        optionalLabel="Optional"
        hint="Six-digit hex color used for guest folio actions."
      >
        <div className="admin-dialog-stack">
          <div className="admin-input-row">
            <Input
              id="accent"
              name="accent"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#d9ef63"
              disabled={pending}
            />
            <span
              className="brand-accent-preview"
              style={{ backgroundColor: accent.trim() || "#d9ef63" }}
              aria-hidden="true"
            />
          </div>

          <div className="brand-accent-presets" role="group" aria-label="Accent presets">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                className={`brand-accent-swatch ${
                  accent.trim().toLowerCase() === preset.hex ? "is-active" : ""
                }`.trim()}
                onClick={() => setAccent(preset.hex)}
                disabled={pending}
                title={`${preset.label} (${preset.hex})`}
              >
                <span
                  className="brand-accent-dot"
                  style={{ backgroundColor: preset.hex }}
                  aria-hidden="true"
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Field>

      <Field
        htmlFor="logo"
        label="Studio logo URL"
        optionalLabel="Optional"
        hint="Leave blank to use your studio initial. Local upload is also available in Settings."
      >
        <div className="brand-preview-row">
          <BrandMark title={orgName || "Potokuadrat"} logo={logo} />
          <Input
            id="logo"
            name="logo"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://example.com/logo.png"
            disabled={pending}
          />
        </div>
      </Field>

      <Field htmlFor="name" label="Your name">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={state.fields?.name}
          required
          disabled={pending}
        />
      </Field>

      <Field htmlFor="email" label="Email" hint="Used to sign in to the organizer area.">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.fields?.email}
          required
          disabled={pending}
        />
      </Field>

      <Field htmlFor="password" label="Password" hint="At least 10 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          disabled={pending}
        />
      </Field>

      {state.error && (
        <Alert tone="danger" title="Setup failed">
          {state.error}
        </Alert>
      )}

      <Button type="submit" loading={pending} disabled={pending}>
        Create organizer account
      </Button>
    </form>
  );
}
