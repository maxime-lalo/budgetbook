"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      className="no-print"
    >
      <Printer className="h-4 w-4 mr-2" />
      Imprimer / Enregistrer en PDF
    </Button>
  );
}
