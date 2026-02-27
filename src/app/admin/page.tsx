import { requireAdmin } from "@/lib/auth/session";
import { getUsers, getGlobalStats } from "@/app/admin/_actions/admin-actions";
import { UserList } from "@/app/admin/_components/user-list";

export default async function AdminPage() {
  await requireAdmin();

  const [users, globalStats] = await Promise.all([getUsers(), getGlobalStats()]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Administration</h1>
      <UserList users={users} globalStats={globalStats} />
    </div>
  );
}
