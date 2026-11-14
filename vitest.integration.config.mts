import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integration tests share one disposable Postgres, so they run one file at a time. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    passWithNoTests: true,
  },
});
