"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="primary" size="sm" onClick={() => window.print()}>
      Imprimer
    </Button>
  );
}
