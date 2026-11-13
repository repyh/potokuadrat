import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // `drizzle-kit generate` works offline; commands that touch the database still
  // need MIGRATION_DATABASE_URL or DATABASE_URL.
  ...(url ? { dbCredentials: { url } } : {}),
  strict: true,
  verbose: true,
});
