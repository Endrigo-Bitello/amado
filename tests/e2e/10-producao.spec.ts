import { expect, test } from "@playwright/test";
import { credenciais, entrar, execucao, supabaseComo } from "./apoio";

// Fluxo 10 — acesso direto e recarregamento de rotas profundas do /crm (como
// na hospedagem), cabeçalhos de privacidade e permissões por perfil.
// Rode também contra o build de produção:  E2E_BASE_URL=http://localhost:3006

test("rotas profundas do /crm funcionam em acesso direto e ao recarregar", async ({ page, request }) => {
  const x = execucao();
  const advogado = await supabaseComo("advogado");
  const { data: cliente } = await advogado.from("clientes").insert({ nome: `Cliente Rotas ${x}`, origem: "manual" }).select("id").single();
  const { data: casoId } = await advogado.rpc("criar_caso", {
    p: { cliente_id: cliente!.id, titulo: `Caso Rotas ${x}`, natureza: "interno", equipe: [], prioridade: "media", objeto: "", aplicar_checklist: false, aplicar_tarefas: false },
  });

  // Cabeçalhos: sem indexação e sem cache para o CRM; robots.txt bloqueia a área.
  const resp = await request.get("/crm/login");
  expect(resp.status()).toBe(200);
  expect(resp.headers()["x-robots-tag"]).toContain("noindex");
  expect(resp.headers()["cache-control"]).toMatch(/no-store|no-cache/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/crm/);
  expect(robots).toMatch(/Disallow: \/enviar-documentos/);

  // Acesso direto a uma rota profunda sem sessão → login → volta exatamente para ela.
  const profunda = `/crm/casos/${casoId}?aba=andamentos`;
  await page.goto(profunda);
  await page.waitForURL(/\/crm\/login/);
  await page.getByLabel("E-mail").fill(credenciais("advogado").email);
  await page.getByLabel("Senha").fill(credenciais("advogado").senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname === `/crm/casos/${casoId}` && u.searchParams.get("aba") === "andamentos");
  await expect(page.getByRole("heading", { level: 1, name: `Caso Rotas ${x}` })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Andamentos" })).toHaveAttribute("aria-selected", "true");

  // Recarregar rotas profundas de vários módulos não gera 404.
  for (const rota of [profunda, `/crm/clientes/${cliente!.id}?aba=casos`, "/crm/casos?aba=prazos", "/crm/documentos?aba=validade", "/crm/relatorios?aba=casos&periodo=90d", "/crm/agenda?modo=mes"]) {
    const r = await page.goto(rota);
    expect(r?.status(), rota).toBe(200);
    await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
    await expect(page.getByText("Página não encontrada")).toHaveCount(0);
  }
  await page.goto("/crm/modulo-que-nao-existe");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});

test("permissões por perfil: advogado vê o financeiro sem poder lançar; administrador administra", async ({ page }) => {
  await entrar(page, "advogado", "/crm/financeiro");
  await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo lançamento" })).toHaveCount(0);
  const menu = page.getByRole("complementary", { name: "Menu principal" });
  await expect(menu.getByRole("link", { name: "Relatórios" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Administração" })).toHaveCount(0);
  await page.goto("/crm/admin/usuarios");
  await expect(page.getByText(/Acesso restrito/).first()).toBeVisible();

  // Sessão nova com o administrador.
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL(/\/crm\/login/);
  await entrar(page, "admin", "/crm/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();
  await expect(page.getByText(credenciais("advogado").email)).toBeVisible();
});
