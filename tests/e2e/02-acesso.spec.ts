import { expect, test } from "@playwright/test";
import { chamarFuncao, credenciais, entrar, supabaseComo } from "./apoio";

// Fluxo 2 — login, persistência da sessão, logout e bloqueio de acesso não autorizado.

test("login, persistência da sessão e logout", async ({ page, context }) => {
  // Sem sessão: /crm redireciona para o login preservando o destino.
  await page.goto("/crm/casos?aba=prazos");
  await page.waitForURL(/\/crm\/login\?proximo=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("proximo") ?? "")).toBe("/crm/casos?aba=prazos");

  // Senha errada: mensagem clara, sem revelar se o e-mail existe.
  const { email } = credenciais("advogado");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-incorreta-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();

  // Login correto leva ao destino original.
  await page.getByLabel("Senha").fill(credenciais("advogado").senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/crm\/casos\?aba=prazos/);
  await expect(page.getByRole("tab", { name: /Prazos processuais/ })).toHaveAttribute("aria-selected", "true");

  // A sessão persiste ao recarregar e em uma nova aba.
  await page.reload();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  const aba = await context.newPage();
  await aba.goto("/crm/leads");
  await expect(aba.getByRole("heading", { name: "Leads" })).toBeVisible();
  await aba.close();

  // Logout encerra a sessão; o CRM volta a exigir login.
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL(/\/crm\/login/);
  await page.goto("/crm/clientes");
  await page.waitForURL(/\/crm\/login\?proximo=/);
});

test("perfil de atendimento não acessa financeiro, relatórios nem administração", async ({ page }) => {
  await entrar(page, "atendimento", "/crm");
  const menu = page.getByRole("complementary", { name: "Menu principal" });
  await expect(menu.getByRole("link", { name: "Leads" })).toBeVisible();
  for (const nome of ["Financeiro", "Relatórios", "Administração"]) {
    await expect(menu.getByRole("link", { name: nome })).toHaveCount(0);
  }
  // Acesso direto pela URL também é bloqueado na interface…
  for (const rota of ["/crm/financeiro", "/crm/admin/usuarios", "/crm/relatorios"]) {
    await page.goto(rota);
    await expect(page.getByText(/não tem permissão|Acesso restrito/).first()).toBeVisible();
  }

  // …e no servidor (RLS e Edge Functions), independentemente da interface.
  const atendimento = await supabaseComo("atendimento");
  const { data: cobrancas } = await atendimento.from("cobrancas").select("id").limit(5);
  expect(cobrancas ?? []).toHaveLength(0);
  const { data: auditoria } = await atendimento.from("auditoria").select("id").limit(5);
  expect(auditoria ?? []).toHaveLength(0);
  const { error: erroConfig } = await atendimento.from("configuracoes").update({ valor: {} }).eq("chave", "textos").select();
  const { data: textos } = await (await supabaseComo("admin")).from("configuracoes").select("valor").eq("chave", "textos").single();
  expect(erroConfig !== null || Object.keys((textos?.valor as object) ?? {}).length > 0).toBeTruthy();
  await expect(chamarFuncao(atendimento, "crm-admin", { acao: "listar_usuarios" })).rejects.toThrow(/403/);
  await expect(chamarFuncao(atendimento, "crm-financeiro", { acao: "registrar_pagamento", dados: {} })).rejects.toThrow(/40[13]/);
});
