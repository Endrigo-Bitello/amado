#!/usr/bin/env node
// Gera .env.local apontando o site para o Supabase LOCAL (npx supabase start).
// Não use em produção: lá as variáveis ficam na hospedagem (Vercel).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const linhas = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
};

let atual = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
for (const [chave, valor] of Object.entries(linhas)) {
  const regra = new RegExp(`^${chave}=.*$`, "m");
  atual = regra.test(atual) ? atual.replace(regra, `${chave}=${valor}`) : `${atual.trimEnd()}\n${chave}=${valor}\n`;
}
writeFileSync(".env.local", atual.trimStart());
console.log(".env.local atualizado para o Supabase local:", status.API_URL);
