import { expect, test, type Page } from "@playwright/test";
import { entrar, execucao, supabaseComo } from "./apoio";

// Fluxo 7 — contrato com entrada e parcelas, pagamento parcial, quitação e saldo.

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const daquiDias = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + n * 86_400_000));

async function registrarPagamento(page: Page, cobranca: string, valor: string) {
  await page.getByRole("button", { name: `Ações de ${cobranca}` }).click();
  await page.getByRole("menuitem", { name: "Registrar pagamento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Registrar pagamento" });
  await dialogo.getByLabel("Valor recebido").fill(valor);
  await dialogo.getByLabel("Data do pagamento").fill(hojeSP());
  await dialogo.getByRole("button", { name: "Registrar" }).click();
  await expect(dialogo).toBeHidden();
}

test("contrato, parcelas, pagamento parcial, quitação e saldos", async ({ page }) => {
  const x = execucao();
  const admin = await supabaseComo("admin");
  const { data: cliente } = await admin.from("clientes").insert({ nome: `Cliente Financeiro ${x}`, origem: "manual" }).select("id").single();
  await admin.rpc("criar_caso", { p: { cliente_id: cliente!.id, titulo: `Caso Financeiro ${x}`, natureza: "interno", equipe: [], prioridade: "media", objeto: "", aplicar_checklist: false, aplicar_tarefas: false } });

  await entrar(page, "admin", `/crm/clientes/${cliente!.id}?aba=financeiro`);
  await page.getByRole("button", { name: "Novo contrato" }).click();
  const contrato = page.getByRole("dialog", { name: /Novo contrato de honorários/ });
  await contrato.getByLabel("Valor contratado").fill("3000");
  await contrato.getByLabel("Entrada", { exact: true }).fill("1000");
  await contrato.getByLabel("Vencimento da entrada").fill(hojeSP());
  await contrato.getByLabel("Número de parcelas").fill("2");
  await contrato.getByLabel("1º vencimento").fill(daquiDias(30));
  // Prévia: entrada + 2 parcelas de R$ 1.000,00.
  await expect(contrato.getByRole("cell", { name: "Parcela 2/2" })).toBeVisible();
  await contrato.getByRole("button", { name: "Registrar contrato" }).click();
  await expect(contrato).toBeHidden();

  const entradaDesc = "Honorários advocatícios — entrada";
  const linha = (d: string) => page.locator("tr", { has: page.getByRole("button", { name: d, exact: true }) });
  await expect(linha(entradaDesc)).toContainText("A receber");
  await expect(linha("Honorários advocatícios — parcela 1/2")).toBeVisible();
  await expect(linha("Honorários advocatícios — parcela 2/2")).toBeVisible();

  // Pagamento parcial da entrada.
  await registrarPagamento(page, entradaDesc, "400");
  await expect(linha(entradaDesc)).toContainText("Parcialmente pago");
  await expect(linha(entradaDesc)).toContainText("R$ 600,00");

  // Quitação do saldo.
  await registrarPagamento(page, entradaDesc, "600");
  await expect(linha(entradaDesc)).toContainText("Pago");
  await expect(linha(entradaDesc)).toContainText("R$ 0,00");

  // Resumo de honorários do cliente.
  const resumo = page.getByRole("region", { name: "Resumo de honorários" });
  await expect(resumo.getByText("Contratado").locator("..")).toContainText("R$ 3.000,00");
  await expect(resumo.getByText("Recebido").locator("..")).toContainText("R$ 1.000,00");
  await expect(resumo.getByText("Em aberto").locator("..")).toContainText("R$ 2.000,00");

  // Histórico de pagamentos da cobrança (quem registrou e quando).
  await page.getByRole("button", { name: entradaDesc, exact: true }).click();
  await expect(page.locator("li", { hasText: "R$ 400,00" }).filter({ hasText: "registrado por" })).toBeVisible();
  await expect(page.locator("li", { hasText: "R$ 600,00" }).filter({ hasText: "registrado por" })).toBeVisible();

  // Visão geral do financeiro: recebimentos e cobranças em aberto.
  await page.goto("/crm/financeiro?aba=pagamentos");
  await page.getByPlaceholder(/^Buscar em /).fill(`Cliente Financeiro ${x}`);
  await expect(page.getByRole("button", { name: `Abrir ${entradaDesc}` })).toHaveCount(2);

  // Banco: situação calculada e saldo.
  const { data: cobrancas } = await admin.from("v_cobrancas").select("descricao, situacao, valor_pago, saldo").eq("cliente_id", cliente!.id).order("vencimento");
  expect(cobrancas!.find((c) => c.descricao === entradaDesc)).toMatchObject({ situacao: "pago", saldo: 0 });
  expect(Number(cobrancas!.find((c) => c.descricao === entradaDesc)!.valor_pago)).toBe(1000);
  expect(cobrancas!.filter((c) => c.situacao === "a_receber")).toHaveLength(2);
  const { data: pagamentos } = await admin.from("pagamentos").select("valor, registrado_por").eq("cliente_id", cliente!.id);
  expect(pagamentos).toHaveLength(2);
  expect(pagamentos!.every((p) => p.registrado_por === pagamentos![0].registrado_por)).toBeTruthy();
});
