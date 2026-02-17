import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Charger .env manuellement (tsx ne le fait pas automatiquement)
function loadEnvFile() {
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

loadEnvFile();

const provider = process.env.DB_PROVIDER ?? "postgresql";

if (provider !== "postgresql" && provider !== "sqlite") {
  console.error(`DB_PROVIDER invalide: "${provider}". Valeurs acceptées: "postgresql", "sqlite"`);
  process.exit(1);
}

const basePath = join(__dirname, "..", "prisma", "schema.base.prisma");
const outPath = join(__dirname, "..", "prisma", "schema.prisma");

let schema = readFileSync(basePath, "utf-8");

if (provider === "sqlite") {
  schema = schema.replace(
    /provider\s*=\s*"postgresql"/,
    'provider = "sqlite"'
  );
  // Supprimer les annotations @db.Decimal(...) et @db.Date
  schema = schema.replace(/\s*@db\.Decimal\(\d+,\s*\d+\)/g, "");
  schema = schema.replace(/\s*@db\.Date/g, "");
}

writeFileSync(outPath, schema, "utf-8");
console.log(`prisma/schema.prisma généré (provider: ${provider})`);
