import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Carrega as variáveis públicas do .env.local (URL e chave pública do Supabase)
// quando não vierem do ambiente. Credenciais de teste vêm SOMENTE do ambiente:
//   E2E_ADMIN_EMAIL, E2E_ADMIN_SENHA  (conta administradora do ambiente de teste)
//   E2E_BASE_URL                      (padrão: http://localhost:3005)
if (existsSync(".env.local")) {
  for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*(NEXT_PUBLIC_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3005";

export default defineConfig({
  testDir: "tests/e2e",
  // Os fluxos compartilham usuários temporários criados no início da execução.
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/e2e-html" }]],
  globalSetup: "./tests/e2e/preparacao.ts",
  globalTeardown: "./tests/e2e/encerramento.ts",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  outputDir: "test-results/e2e",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
