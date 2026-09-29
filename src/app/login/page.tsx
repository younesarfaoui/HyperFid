import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { getSessionProfile, homePathFor } from "@/lib/auth/guards";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  no_merchant: "Votre compte n'est rattaché à aucun commerce. Contactez HyperFid.",
  link_invalid: "Ce lien a expiré ou a déjà été utilisé. Demandez une nouvelle invitation.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const session = await getSessionProfile();
  if (session && error !== "no_merchant") redirect(homePathFor(session.profile));

  const errorMessage = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo />
          <p className="mt-2 text-sm text-ink-2">Espace commerçants et administration</p>
        </div>
        <Card className="p-6">
          {errorMessage ? (
            <p role="alert" className="mb-4 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
              {errorMessage}
            </p>
          ) : null}
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </Card>
      </div>
    </div>
  );
}
