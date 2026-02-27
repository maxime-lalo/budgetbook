"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteUser, toggleAdmin } from "@/app/admin/_actions/admin-actions";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  email: string;
  name: string;
  authProvider: string;
  isAdmin: boolean;
  createdAt: string;
  transactionCount: number;
  accountCount: number;
  isCurrentUser: boolean;
};

export function UserList({ users, globalStats }: { users: UserRow[]; globalStats: { users: number; transactions: number; accounts: number; categories: number } }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Utilisateurs" value={globalStats.users} />
        <StatCard title="Transactions" value={globalStats.transactions} />
        <StatCard title="Comptes" value={globalStats.accounts} />
        <StatCard title="Catégories" value={globalStats.categories} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs</CardTitle>
          <CardDescription>Gestion des utilisateurs et de leurs droits</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Comptes</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} onRefresh={() => router.refresh()} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function UserRow({ user, onRefresh }: { user: UserRow; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleToggleAdmin() {
    startTransition(async () => {
      const result = await toggleAdmin(user.id, !user.isAdmin);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(user.isAdmin ? "Droits admin retirés" : "Droits admin accordés");
        onRefresh();
      }
    });
  }

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Utilisateur supprimé");
        onRefresh();
      }
      setDeleteDialogOpen(false);
    });
  }

  const createdDate = new Date(user.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <TableRow>
      <TableCell className="font-medium">
        {user.name}
        {user.isCurrentUser && (
          <Badge variant="outline" className="ml-2 text-xs">
            vous
          </Badge>
        )}
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <Badge variant={user.authProvider === "ldap" ? "secondary" : "outline"}>
          {user.authProvider}
        </Badge>
        {user.isAdmin && (
          <Badge variant="default" className="ml-1">
            admin
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">{user.transactionCount}</TableCell>
      <TableCell className="text-right">{user.accountCount}</TableCell>
      <TableCell>{createdDate}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleAdmin}
            disabled={isPending || user.isCurrentUser}
            title={user.isAdmin ? "Retirer admin" : "Rendre admin"}
          >
            {user.isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </Button>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending || user.isCurrentUser}
                title="Supprimer l'utilisateur"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {user.name} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes les données de cet utilisateur seront supprimées de manière irréversible
                  ({user.transactionCount} transactions, {user.accountCount} comptes).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
