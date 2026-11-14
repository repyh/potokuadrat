"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";

import { setupAction, type SetupState } from "./actions";

const initialState: SetupState = {};

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupAction, initialState);

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
          required
          disabled={pending}
        />
      </Field>

      <Field htmlFor="name" label="Your name">
        <Input id="name" name="name" autoComplete="name" required disabled={pending} />
      </Field>

      <Field htmlFor="email" label="Email" hint="Used to sign in to the organizer area.">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
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
