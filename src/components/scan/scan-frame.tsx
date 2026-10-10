import type { ReactNode } from "react";

import { readableOn } from "@/lib/color";

/** Branded mobile frame shared by the customer-facing pages (scan, "Ma carte"). */
export function ScanFrame({
  brandColor,
  merchantName,
  category,
  children,
}: {
  brandColor: string;
  merchantName: string;
  category?: string;
  children: ReactNode;
}) {
  const ink = readableOn(brandColor);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 pb-16 pt-8 text-center" style={{ backgroundColor: brandColor, color: ink }}>
        <p className="text-xs font-medium uppercase tracking-widest opacity-80">{category ?? "Fidélité"}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">{merchantName}</p>
      </header>
      <main className="-mt-10 flex-1 px-4 pb-10">
        <div className="mx-auto w-full max-w-md rounded-3xl bg-surface p-5 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">Propulsé par HyperFid</p>
      </main>
    </div>
  );
}
