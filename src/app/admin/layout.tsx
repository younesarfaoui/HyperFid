import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";
import { requireSuperAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin HyperFid" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireSuperAdmin();

  return (
    <AppShell
      area="Super admin"
      email={session.email}
      nav={[
        { href: "/admin", label: "Vue d'ensemble", exact: true },
        { href: "/admin/merchants", label: "Commerçants" },
      ]}
    >
      {children}
    </AppShell>
  );
}
