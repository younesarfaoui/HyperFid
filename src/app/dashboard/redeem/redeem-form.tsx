"use client";

import { useActionState } from "react";

import { FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

import { redeemWinByCode } from "../actions";

export function RedeemForm() {
  const [state, action] = useActionState(redeemWinByCode, null);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="code" className="block text-sm font-medium text-ink">
        Code affiché sur le téléphone du client
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="code"
          name="code"
          required
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABC234"
          defaultValue={state?.fields?.code}
          className="h-14 font-mono text-2xl uppercase tracking-[0.3em] sm:max-w-xs"
        />
        <SubmitButton size="lg" pendingLabel="Vérification…">
          Valider le gain
        </SubmitButton>
      </div>
      <FormMessage state={state} />
      <p className="text-xs text-muted">
        Vérifiez que l&apos;horloge sur l&apos;écran du client défile : une capture d&apos;écran reste figée.
      </p>
    </form>
  );
}
