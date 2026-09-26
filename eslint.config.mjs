import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // No CRM, formulários em modal reiniciam o próprio estado ao abrir e telas
    // leem valores do navegador (URL, fragmento com token) após a hidratação.
    // Esses efeitos são intencionais; a regra fica como aviso para revisão.
    files: ["app/crm/**/*.{ts,tsx}", "app/enviar-documentos/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Edge Functions (Deno) e tipos gerados do banco têm verificação própria.
    "supabase/**",
    "app/crm/_lib/database.types.ts",
  ]),
]);

export default eslintConfig;
