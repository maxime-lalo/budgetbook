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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAccount, updateAccount } from "../_actions/account-actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { ACCOUNT_TYPE_LABELS } from "@/lib/formatters";

type Account = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  linkedAccountId: string | null;
};

type CheckingAccount = {
  id: string;
  name: string;
};

export function AccountFormDialog({
  account,
  checkingAccounts = [],
}: {
  account?: Account;
  checkingAccounts?: CheckingAccount[];
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!account;

  async function handleSubmit(formData: FormData) {
    const result = isEdit
      ? await updateAccount(account!.id, formData)
      : await createAccount(formData);

    if (result.error) {
      toast.error("Erreur de validation");
      return;
    }
    toast.success(isEdit ? "Compte modifié" : "Compte créé");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau compte
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le compte" : "Nouveau compte"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" defaultValue={account?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select name="type" defaultValue={account?.type ?? "CHECKING"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Couleur</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={account?.color ?? "#3b82f6"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Ordre</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={account?.sortOrder ?? 0}
              />
            </div>
          </div>
          {checkingAccounts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="linkedAccountId">Compte lié (pour carte de crédit)</Label>
              <Select name="linkedAccountId" defaultValue={account?.linkedAccountId ?? "__none__"}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {checkingAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
