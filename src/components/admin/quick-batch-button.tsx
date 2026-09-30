"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { QUICK_BATCH_SIZE } from "@/lib/batches";

const REFRESH_AFTER_MS = 4000;

/**
 * Plain HTML form post to the quick-batch Route Handler: the response is a
 * CSV attachment, so the browser downloads it and stays on the page.
 */
export function QuickBatchButton({ merchantId, size = "sm" }: { merchantId: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <form
      method="post"
      action={`/admin/merchants/${merchantId}/qr-batch`}
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        setPending(true);
        // A download fires no completion event: re-enable and refresh counts shortly after.
        window.setTimeout(() => {
          setPending(false);
          router.refresh();
        }, REFRESH_AFTER_MS);
      }}
    >
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        title={`Crée ${QUICK_BATCH_SIZE} QR codes à usage unique et télécharge le CSV d'impression`}
        className={buttonClass("secondary", size)}
      >
        {pending ? "Génération…" : `Générer ${QUICK_BATCH_SIZE} QR (CSV)`}
      </button>
    </form>
  );
}
