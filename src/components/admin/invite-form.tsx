"use client";

import { useActionState } from "react";

import { inviteMerchantAdmin } from "@/app/admin/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function InviteForm({ merchantId }: { merchantId: string }) {
  const [state, action] = useActionState(inviteMerchantAdmin, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="merchant_id" value={merchantId} />
      <Field label="E-mail du gérant" htmlFor="invite-email">
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={state?.fields?.email}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Envoi…" variant="secondary">
        Envoyer l&apos;invitation
      </SubmitButton>
    </form>
  );
}
