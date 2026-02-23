import { z } from "zod";

const envSchema = z.object({
  DB_PROVIDER: z.enum(["postgresql", "sqlite"]).default("postgresql"),
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = envSchema.parse({
  DB_PROVIDER: process.env.DB_PROVIDER,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
