"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { importAllData } from "@/app/settings/_actions/settings-actions";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function ImportDataCard() {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Le fichier doit être au format JSON");
      resetInput();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Le fichier est trop volumineux (max 50 Mo)");
      resetInput();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      setFileName(file.name);
      setDialogOpen(true);
    };
    reader.readAsText(file);
  }

  function resetInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFileContent(null);
    setFileName(null);
  }

  async function handleImport() {
    if (!fileContent) return;

    setDialogOpen(false);
    setLoading(true);
    try {
      const result = await importAllData(fileContent);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        const summary = Object.entries(result.counts)
          .filter(([, count]) => count > 0)
          .map(([table, count]) => `${table}: ${count}`)
          .join(", ");
        toast.success(`Import réussi — ${summary}`);
      }
    } catch {
      toast.error("Erreur lors de l'import des données");
    } finally {
      setLoading(false);
      resetInput();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer des données</CardTitle>
        <CardDescription>
          Importer un fichier JSON préalablement exporté. Toutes les données existantes
          seront remplacées par celles du fichier.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            disabled={loading}
            className="max-w-sm"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardContent>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l&apos;import ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les données existantes seront supprimées et remplacées par celles
              du fichier <span className="font-medium">{fileName}</span>.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetInput}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
