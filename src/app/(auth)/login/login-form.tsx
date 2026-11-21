"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="auth-form" noValidate>
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <Field htmlFor="email" label="Email">
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

      <Field htmlFor="password" label="Password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </Field>

      {state.error && (
        <Alert tone="danger" title="Sign-in failed">
          {state.error}
        </Alert>
      )}

      <Button type="submit" loading={pending} disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
