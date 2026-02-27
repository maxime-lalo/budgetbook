"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Home,
  LayoutDashboard,
  Tags,
  Wallet,
  PiggyBank,
  Repeat,
  BarChart3,
  Settings,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useUser } from "@/components/layout/user-provider";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/_actions/auth-actions";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/transfers", label: "Virements", icon: Repeat },
  { href: "/budgets", label: "Budgets", icon: LayoutDashboard },
  { href: "/categories", label: "Catégories", icon: Tags },
  { href: "/accounts", label: "Comptes", icon: Wallet },
  { href: "/savings", label: "Économies", icon: PiggyBank },
  { href: "/statistics", label: "Statistiques", icon: BarChart3 },
  { href: "/settings", label: "Réglages", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();

  // Ne pas afficher la sidebar sur les pages auth
  if (!user) return null;

  async function handleLogout() {
    await logoutAction();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-muted/30 print:hidden">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Wallet className="h-5 w-5" />
          <span>Comptes</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {user.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}
      </nav>
      <div className="border-t p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">{user.name}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Déconnexion">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
