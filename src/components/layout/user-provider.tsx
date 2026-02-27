"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/types";

const UserContext = createContext<AuthUser | null>(null);

export function UserProvider({ user, children }: { user: AuthUser | null; children: React.ReactNode }) {
  return <UserContext value={user}>{children}</UserContext>;
}

export function useUser(): AuthUser | null {
  return useContext(UserContext);
}

export function useRequiredUser(): AuthUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useRequiredUser must be used within an authenticated context");
  return user;
}
