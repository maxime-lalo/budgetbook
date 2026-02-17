import { defineConfig } from "drizzle-kit";

const provider = process.env.DB_PROVIDER ?? "postgresql";

export default provider === "sqlite"
  ? defineConfig({
      schema: "./src/lib/db/schema/sqlite.ts",
      out: "./drizzle/sqlite",
      dialect: "sqlite",
      dbCredentials: {
        url: (process.env.DATABASE_URL ?? "file:./dev.db").replace("file:", ""),
      },
    })
  : defineConfig({
      schema: "./src/lib/db/schema/pg.ts",
      out: "./drizzle/pg",
      dialect: "postgresql",
      dbCredentials: {
        url: process.env.DATABASE_URL ?? "postgresql://comptes:comptes@localhost:5432/comptes",
      },
    });
