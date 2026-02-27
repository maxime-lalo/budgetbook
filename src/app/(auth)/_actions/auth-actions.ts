"use server";

import { db, users, refreshTokens } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/session";
import { authenticateLdap } from "@/lib/auth/ldap";
import { seedUserDefaults } from "@/lib/auth/seed-defaults";
import { hashToken } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export async function loginAction(
  identifier: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  try {
    // 1. Essayer LDAP si configuré (identifier = pseudo ou email)
    const ldapUser = await authenticateLdap(identifier, password);
    if (ldapUser) {
      let user = await db.query.users.findFirst({
        where: eq(users.email, ldapUser.email),
      });

      if (!user) {
        const id = createId();
        await db.insert(users).values({
          id,
          email: ldapUser.email,
          name: ldapUser.name,
          passwordHash: null,
          authProvider: "ldap",
        });
        user = await db.query.users.findFirst({ where: eq(users.id, id) });
        if (user) {
          await seedUserDefaults(user.id);
        }
      }

      if (user) {
        await createSessionTokens(user);
        return { success: true };
      }
    }

    // 2. Auth locale (par email)
    const user = await db.query.users.findFirst({
      where: eq(users.email, identifier),
    });

    if (!user || !user.passwordHash) {
      return { error: "Identifiants invalides" };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { error: "Identifiants invalides" };
    }

    await createSessionTokens(user);
    return { success: true };
  } catch (e) {
    logger.error("Login error", { error: e instanceof Error ? e.message : String(e) });
    return { error: "Erreur lors de la connexion" };
  }
}

export async function registerAction(
  name: string,
  email: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  if (!env.REGISTRATION_ENABLED) {
    return { error: "Les inscriptions sont désactivées" };
  }

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      return { error: "Cet email est déjà utilisé" };
    }

    if (password.length < 8) {
      return { error: "Le mot de passe doit contenir au moins 8 caractères" };
    }

    const id = createId();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id,
      email,
      name,
      passwordHash,
      authProvider: "local",
    });

    await seedUserDefaults(id);

    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (user) {
      await createSessionTokens(user);
    }

    return { success: true };
  } catch (e) {
    logger.error("Register error", { error: e instanceof Error ? e.message : String(e) });
    return { error: "Erreur lors de l'inscription" };
  }
}

export async function logoutAction(): Promise<void> {
  try {
    // Supprimer les refresh tokens de la BDD
    // On ne peut pas facilement identifier le token actuel sans le lire
    // Pour simplifier, on clear juste les cookies
    await clearAuthCookies();
  } catch (e) {
    logger.error("Logout error", { error: e instanceof Error ? e.message : String(e) });
    await clearAuthCookies();
  }
}

async function createSessionTokens(user: {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}): Promise<void> {
  const accessToken = await signAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
  });

  const refreshTokenValue = await signRefreshToken(user.id);
  const refreshTokenHash = hashToken(refreshTokenValue);

  // Stocker le refresh token hashé en BDD
  await db.insert(refreshTokens).values({
    id: createId(),
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
  });

  await setAuthCookies(accessToken, refreshTokenValue);
}
