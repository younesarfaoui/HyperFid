"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

import { setPassword } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState(setPassword, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirmation" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Activer mon compte</SubmitButton>
    </form>
  );
}
