"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass } from "./button";

type Props = {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function SubmitButton({ children, pendingLabel = "Enregistrement…", variant, size, className }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
