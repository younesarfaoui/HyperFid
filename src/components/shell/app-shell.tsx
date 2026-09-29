import type { ReactNode } from "react";

import { NavLinks, type NavItem } from "./nav-links";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-brand text-sm text-on-brand">
        H
      </span>
      HyperFid
    </span>
  );
}

export function AppShell({
  area,
  subtitle,
  email,
  nav,
  children,
}: {
  area: string;
  subtitle?: string;
  email: string | null;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print border-b border-line bg-card md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <Logo />
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{area}</p>
            {subtitle ? <p className="mt-0.5 truncate text-sm text-ink-2">{subtitle}</p> : null}
          </div>
          <NavLinks items={nav} />
          <div className="mt-auto hidden border-t border-line pt-4 md:block">
            <p className="truncate text-xs text-muted" title={email ?? undefined}>
              {email}
            </p>
            <form action="/auth/signout" method="post" className="mt-2">
              <button type="submit" className="text-sm font-medium text-ink-2 hover:text-ink">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action="/auth/signout" method="post" className="no-print mt-10 md:hidden">
          <button type="submit" className="text-sm font-medium text-ink-2 hover:text-ink">
            Se déconnecter ({email})
          </button>
        </form>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
