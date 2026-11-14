import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const serverOnlyImports = [
  {
    group: ["@/server", "@/server/**", "server-only"],
    message:
      "UI modules must not import server code. Go through src/contracts and a Route Handler instead.",
  },
  {
    group: ["drizzle-orm", "drizzle-orm/**", "pg", "pg-boss", "better-auth", "better-auth/**"],
    message:
      "Database, queues, and auth belong to src/server. UI modules talk to Route Handlers.",
  },
  {
    group: ["node:*"],
    message: "Node built-ins do not belong in browser UI code.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // UI boundary: features and primitives never reach into the server.
  {
    files: ["src/features/**/*.ts", "src/features/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: serverOnlyImports }],
    },
  },
  {
    files: ["src/components/ui/**/*.ts", "src/components/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...serverOnlyImports,
            {
              group: ["@/features", "@/features/**"],
              message: "Design-system primitives must not depend on a feature module.",
            },
          ],
        },
      ],
    },
  },

  // Contracts are shared by both sides, so they stay free of server, UI, and framework
  // code. Types and zod schemas only.
  {
    files: ["src/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/**",
                "@/app",
                "@/app/**",
                "@/components",
                "@/components/**",
                "@/features",
                "@/features/**",
                "next",
                "next/**",
                "react",
                "react-dom",
                "server-only",
                "node:*",
                "drizzle-orm",
                "drizzle-orm/**",
                "pg",
                "pg-boss",
                "better-auth",
                "better-auth/**",
              ],
              message:
                "Contracts are shared types and schemas; keep them independent of the server, the UI, and the framework.",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
