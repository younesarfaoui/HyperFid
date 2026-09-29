import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/guards";

import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Choisir un mot de passe" };

export default async function SetPasswordPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login?error=link_invalid");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo />
          <p className="mt-2 text-sm text-ink-2">Choisissez votre mot de passe pour {session.email}</p>
        </div>
        <Card className="p-6">
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}
