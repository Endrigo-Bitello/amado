import { expect, test, type Page } from "@playwright/test";
import { entrar, execucao, supabaseComo } from "./apoio";

// Fluxo 3 — mudança de etapa na tabela (seletor) e no Kanban (arrastar e
// menu acessível), com motivo obrigatório ao marcar como não convertido.

async function etapaDoLead(nome: string) {
  const admin = await supabaseComo("admin");
  const { data } = await admin.from("leads").select("motivo_perda, etapa:etapas(nome)").eq("nome", nome).single();
  return data as unknown as { motivo_perda: string | null; etapa: { nome: string } };
}

async function arrastar(page: Page, origem: ReturnType<Page["locator"]>, destino: ReturnType<Page["locator"]>) {
  const a = await origem.boundingBox();
  const b = await destino.boundingBox();
  if (!a || !b) throw new Error("Elemento fora da tela");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 4, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 70, { steps: 20 });
  await page.mouse.up();
}

test("etapa muda pela tabela e pelo Kanban, e persiste", async ({ page }) => {
  const nome = `Lead Etapas ${execucao()}`;
  await entrar(page, "atendimento", "/crm/leads");
  await page.getByRole("button", { name: "Tabela" }).click();

  // Criação rápida no grupo "Novo".
  const campo = page.getByLabel("Adicionar item em Novo");
  await campo.fill(nome);
  await campo.press("Enter");
  await expect(page.getByRole("button", { name: `Abrir ${nome}` })).toBeVisible();

  // Tabela: seletor de etapa na célula.
  await page.getByRole("button", { name: `Editar Etapa de ${nome}` }).click();
  await page.getByRole("option", { name: "Em atendimento" }).click();
  await expect.poll(async () => (await etapaDoLead(nome)).etapa.nome).toBe("Em atendimento");

  // Kanban: arrastar o cartão para outra coluna.
  await page.getByRole("button", { name: "Kanban" }).click();
  const alca = page.getByRole("button", { name: `Arrastar ${nome}` });
  await expect(alca).toBeVisible();
  // Coluna vizinha, longe da borda (a rolagem automática do quadro não interfere).
  const colunaContatar = page.locator("section[aria-label^='Coluna A contatar']");
  await alca.scrollIntoViewIfNeeded();
  await arrastar(page, alca, colunaContatar);
  await expect.poll(async () => (await etapaDoLead(nome)).etapa.nome, { timeout: 15_000 }).toBe("A contatar");
  await expect(colunaContatar.getByRole("button", { name: nome, exact: true })).toBeVisible();

  // Alternativa acessível ao arrastar: menu "Mover para…".
  await page.getByRole("button", { name: `Mover ${nome} para outra coluna` }).click();
  await page.getByRole("menuitem", { name: "Proposta enviada" }).click();
  await expect.poll(async () => (await etapaDoLead(nome)).etapa.nome).toBe("Proposta enviada");

  // Não convertido exige motivo.
  await page.getByRole("button", { name: `Mover ${nome} para outra coluna` }).click();
  await page.getByRole("menuitem", { name: "Não convertido" }).click();
  const dialogo = page.getByRole("dialog", { name: /Mover para “Não convertido”/ });
  await expect(dialogo.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialogo.getByRole("button", { name: "Motivo" }).click();
  await page.getByRole("option").first().click();
  await dialogo.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(async () => (await etapaDoLead(nome)).etapa.nome).toBe("Não convertido");
  expect((await etapaDoLead(nome)).motivo_perda).toBeTruthy();

  // Persistência após recarregar (inclusive a visualização escolhida).
  await page.reload();
  await expect(page.locator("section[aria-label^='Coluna Não convertido']").getByRole("button", { name: nome, exact: true })).toBeVisible();
});
