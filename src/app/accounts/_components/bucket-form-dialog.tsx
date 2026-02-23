"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBucket, updateBucket } from "../_actions/account-actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

type Bucket = {
  id: string;
  name: string;
  accountId: string;
  color: string | null;
  goal: number | null;
  baseAmount: number;
  sortOrder: number;
};

export function BucketFormDialog({
  accountId,
  bucket,
}: {
  accountId: string;
  bucket?: Bucket;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!bucket;

  async function handleSubmit(formData: FormData) {
    formData.set("accountId", accountId);
    const result = isEdit
      ? await updateBucket(bucket!.id, formData)
      : await createBucket(formData);

    if ("error" in result) {
      toast.error("Erreur de validation");
      return;
    }
    toast.success(isEdit ? "Bucket modifié" : "Bucket créé");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="h-3 w-3 mr-1" />
            Bucket
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le bucket" : "Nouveau bucket"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bucket-name">Nom</Label>
            <Input id="bucket-name" name="name" defaultValue={bucket?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bucket-color">Couleur</Label>
              <Input
                id="bucket-color"
                name="color"
                type="color"
                defaultValue={bucket?.color ?? "#10b981"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bucket-goal">Objectif (EUR)</Label>
              <Input
                id="bucket-goal"
                name="goal"
                type="number"
                step="0.01"
                defaultValue={bucket?.goal?.toString() ?? ""}
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bucket-baseAmount">Montant de base (EUR)</Label>
            <Input
              id="bucket-baseAmount"
              name="baseAmount"
              type="number"
              step="0.01"
              defaultValue={bucket?.baseAmount?.toString() ?? "0"}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bucket-sortOrder">Ordre</Label>
            <Input
              id="bucket-sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={bucket?.sortOrder ?? 0}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">{isEdit ? "Modifier" : "Créer"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
