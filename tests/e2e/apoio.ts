import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export type PerfilTeste = "admin" | "advogado" | "atendimento";

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sufixo único por chamada (execução + aleatório): evita colisão entre testes e repetições. */
export const execucao = () => `${process.env.E2E_EXECUCAO ?? "local"}${randomBytes(2).toString("hex")}`;

export function credenciais(perfil: PerfilTeste): { email: string; senha: string } {
  const chave = perfil === "admin" ? "ADMIN" : perfil === "advogado" ? "ADVOGADO" : "ATENDIMENTO";
  const email = process.env[`E2E_${chave}_EMAIL`];
  const senha = process.env[`E2E_${chave}_SENHA`];
  if (!email || !senha) throw new Error(`Credenciais de teste ausentes para o perfil ${perfil}.`);
  return { email, senha };
}

/** Senha aleatória forte gerada em tempo de execução (nunca gravada em arquivo). */
export function senhaAleatoria(): string {
  return `${randomBytes(12).toString("base64url")}a7`;
}

export async function supabaseComo(perfil: PerfilTeste): Promise<SupabaseClient> {
  const cliente = createClient(URL_SUPABASE, CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } });
  const { email, senha } = credenciais(perfil);
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar o perfil ${perfil} no Supabase.`);
  return cliente;
}

export async function chamarFuncao<T = Record<string, unknown>>(cliente: SupabaseClient, nome: string, corpo: unknown, origem = "http://localhost:3005"): Promise<T> {
  const { data } = await cliente.auth.getSession();
  const r = await fetch(`${URL_SUPABASE}/functions/v1/${nome}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CHAVE_PUBLICA, Authorization: `Bearer ${data.session?.access_token}`, Origin: origem },
    body: JSON.stringify(corpo),
  });
  const json = (await r.json()) as T & { ok?: boolean; erro?: string };
  if (!r.ok || json.ok === false) throw new Error(`Função ${nome} falhou: ${r.status} ${json.erro ?? ""}`);
  return json;
}

export async function entrar(page: Page, perfil: PerfilTeste, destino = "/crm") {
  const { email, senha } = credenciais(perfil);
  await page.goto(`/crm/login?proximo=${encodeURIComponent(destino)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/crm/login"), { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible({ timeout: 30_000 });
}

/** Seleciona uma opção em um seletor do CRM (lista com busca). */
export async function escolherOpcao(page: Page, gatilho: ReturnType<Page["getByRole"]>, opcao: string | RegExp) {
  await gatilho.click();
  await page.getByRole("option", { name: opcao }).first().click();
}

/** Respostas fixas da API do IBGE (estados/cidades) para o quiz não depender da internet. */
export async function simularIbge(page: Page) {
  await page.route("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome", (r) =>
    r.fulfill({ json: [{ id: 42, sigla: "SC", nome: "Santa Catarina" }, { id: 35, sigla: "SP", nome: "São Paulo" }] }),
  );
  await page.route("https://servicodados.ibge.gov.br/api/v1/localidades/estados/42/municipios", (r) => r.fulfill({ json: [{ nome: "Florianópolis" }, { nome: "Joinville" }] }));
  await page.route("https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios", (r) => r.fulfill({ json: [{ nome: "São Paulo" }, { nome: "Campinas" }] }));
}

/** Telefone celular válido e único para a execução. */
export function telefoneUnico(): string {
  const n = `${Date.now()}`.slice(-8);
  return `48 9${n.slice(0, 4)}-${n.slice(4)}`;
}

/** Espera o aviso (toast) de sucesso com o texto informado. */
export async function esperarAviso(page: Page, texto: string | RegExp) {
  await expect(page.getByText(texto).first()).toBeVisible();
}
