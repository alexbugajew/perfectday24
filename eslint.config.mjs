import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".codex-regression-dist/**",
    ".codex-scripts-dist/**",
    ".vercel/**",
    "app/-alt/**",
    "components/Neuer Ordner/**",
    "tmp_*.js",
    "**/* - Kopie*",
    "**/*V[0-9].ts",
    "**/*V[0-9].tsx",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: [
      "app/admin/monetization/page.tsx",
      "app/p/**",
      "app/planner/helpers.ts",
      "app/planner/types.ts",
      "lib/events/quality.ts",
      "lib/monetization/public-affiliate-server.ts",
      "scripts/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
