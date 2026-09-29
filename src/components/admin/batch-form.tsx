"use client";

import { useActionState } from "react";

import { generateBatch } from "@/app/admin/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function BatchForm({ merchantId }: { merchantId: string }) {
  const [state, action] = useActionState(generateBatch, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="merchant_id" value={merchantId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Libellé du lot" htmlFor="label" hint="Ex. « Gobelets 12oz – Octobre »">
          <Input id="label" name="label" maxLength={80} defaultValue={state?.fields?.label} />
        </Field>
        <Field label="Quantité" htmlFor="quantity">
          <Input id="quantity" name="quantity" type="number" min={1} max={5000} defaultValue={state?.fields?.quantity ?? 500} required />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Génération…">Générer les QR codes</SubmitButton>
    </form>
  );
}
