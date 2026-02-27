import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").default("dev-secret-change-me-in-production-at-least-32-chars"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_PASSWORD: z.string().optional(),
  LDAP_SEARCH_BASE: z.string().optional(),
  LDAP_SEARCH_FILTER: z.string().default("(uid={{identifier}})"),
  REGISTRATION_ENABLED: z.string().default("true").transform((v) => v !== "false"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  LDAP_URL: process.env.LDAP_URL,
  LDAP_BIND_DN: process.env.LDAP_BIND_DN,
  LDAP_BIND_PASSWORD: process.env.LDAP_BIND_PASSWORD,
  LDAP_SEARCH_BASE: process.env.LDAP_SEARCH_BASE,
  LDAP_SEARCH_FILTER: process.env.LDAP_SEARCH_FILTER,
  REGISTRATION_ENABLED: process.env.REGISTRATION_ENABLED,
  LOG_LEVEL: process.env.LOG_LEVEL,
});
