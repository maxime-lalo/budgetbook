"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteAccount, deleteBucket } from "../_actions/account-actions";
import { toast } from "sonner";

export function DeleteAccountButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm("Supprimer ce compte et tous ses buckets ?")) return;
    await deleteAccount(id);
    toast.success("Compte supprimé");
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function DeleteBucketButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm("Supprimer ce bucket ?")) return;
    await deleteBucket(id);
    toast.success("Bucket supprimé");
  }

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete}>
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
