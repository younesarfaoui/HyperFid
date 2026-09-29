"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input, Select, type FormState } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { STATUS_LABELS } from "@/lib/format";
import type { Merchant } from "@/types/database";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function MerchantForm({ action, merchant }: { action: Action; merchant?: Merchant }) {
  const [state, formAction] = useActionState(action, null);
  // After a failed submit, keep what the user typed (React resets the form).
  const v = (key: keyof Merchant, fallback?: string | number) =>
    state?.fields?.[key] ?? (merchant ? String(merchant[key]) : fallback);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du commerce" htmlFor="name">
          <Input id="name" name="name" required maxLength={120} defaultValue={v("name")} />
        </Field>
        <Field label="Catégorie" htmlFor="category">
          <Input id="category" name="category" required maxLength={60} defaultValue={v("category")} placeholder="Cafe" />
        </Field>
      </div>

      <Field label="Récompense instantanée" htmlFor="reward_description">
        <Input
          id="reward_description"
          name="reward_description"
          required
          maxLength={160}
          defaultValue={v("reward_description")}
          placeholder="1 Café Express gratuit"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Taux de gain (%)" htmlFor="win_rate" hint="Probabilité de gain à chaque scan.">
          <Input
            id="win_rate"
            name="win_rate"
            type="number"
            min={0}
            max={100}
            step={0.01}
            required
            defaultValue={v("win_rate", 10)}
          />
        </Field>
        <Field label="Tampons pour la carte" htmlFor="stamps_goal">
          <Input
            id="stamps_goal"
            name="stamps_goal"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={v("stamps_goal", 10)}
          />
        </Field>
        <Field label="Couleur de marque" htmlFor="brand_color">
          <Input
            id="brand_color"
            name="brand_color"
            type="color"
            required
            className="p-1"
            defaultValue={v("brand_color", "#6f4e37")}
          />
        </Field>
      </div>

      <Field label="Abonnement" htmlFor="subscription_status" hint="Hors essai/actif, les scans sont refusés sans consommer le code.">
        <Select id="subscription_status" name="subscription_status" defaultValue={v("subscription_status", "trial")}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <FormMessage state={state} />
      <SubmitButton>{merchant ? "Enregistrer" : "Créer le commerçant"}</SubmitButton>
    </form>
  );
}
