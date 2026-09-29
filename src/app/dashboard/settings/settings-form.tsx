"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Merchant } from "@/types/database";

import { updateSettings } from "../actions";

export function SettingsForm({ merchant }: { merchant: Merchant }) {
  const [state, action] = useActionState(updateSettings, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Récompense instantanée" htmlFor="reward_description" hint="Affichée sur la carte à gratter et dans le Wallet.">
        <Input
          id="reward_description"
          name="reward_description"
          required
          maxLength={160}
          defaultValue={state?.fields?.reward_description ?? merchant.reward_description}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tampons pour compléter la carte" htmlFor="stamps_goal">
          <Input
            id="stamps_goal"
            name="stamps_goal"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={state?.fields?.stamps_goal ?? merchant.stamps_goal}
          />
        </Field>
        <Field label="Couleur de marque" htmlFor="brand_color">
          <Input
            id="brand_color"
            name="brand_color"
            type="color"
            required
            className="p-1"
            defaultValue={state?.fields?.brand_color ?? merchant.brand_color}
          />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
