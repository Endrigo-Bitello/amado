import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { entrar, escolherOpcao, execucao, supabaseComo, telefoneUnico } from "./apoio";

// Fluxo 4 — lead cadastrado manualmente é convertido em cliente (com o primeiro
// caso); um segundo caso é aberto para a mesma pessoa; a carteira mostra ambos.

function cpfValido(): string {
  const base = Array.from(randomBytes(9), (b) => b % 10);
  const dv = (nums: number[]) => {
    const soma = nums.reduce((t, n, i) => t + n * (nums.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

test("conversão do lead em cliente e carteira com dois casos", async ({ page }) => {
  const nome = `Cliente Carteira ${execucao()}`;
  await entrar(page, "advogado", "/crm/leads");

  // Cadastro manual do lead.
  await page.getByRole("button", { name: "Novo lead" }).first().click();
  const novo = page.getByRole("dialog", { name: "Novo lead" });
  await novo.getByLabel("Nome").fill(nome);
  await novo.getByLabel("WhatsApp").fill(telefoneUnico());
  await novo.getByLabel("UF").fill("SC");
  await novo.getByLabel("Município").fill("Florianópolis");
  await novo.getByRole("button", { name: /Cadastrar/ }).click();
  await expect(page.getByRole("button", { name: "Converter em cliente" })).toBeVisible();

  // Conversão com abertura do primeiro caso (processo judicial).
  await page.getByRole("button", { name: "Converter em cliente" }).click();
  const conv = page.getByRole("dialog", { name: new RegExp(`Converter ${nome} em cliente`) });
  await conv.getByLabel("CPF ou CNPJ").fill(cpfValido());
  await escolherOpcao(page, conv.getByRole("button", { name: "Tipo de demanda" }), /Habeas corpus preventivo/);
  await conv.getByLabel("Título do caso").fill("HC preventivo — cultivo");
  await conv.getByLabel("Natureza").selectOption("judicial");
  await conv.getByRole("button", { name: "Converter em cliente" }).click();
  await page.waitForURL(/\/crm\/casos\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: "HC preventivo — cultivo" })).toBeVisible();

  // Ficha do cliente → segundo caso para a mesma pessoa.
  await page.getByRole("navigation", { name: "Navegação" }).getByRole("link", { name: nome }).click();
  await page.waitForURL(/\/crm\/clientes\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Novo caso" }).first().click();
  const formCaso = page.getByRole("dialog", { name: "Novo caso" });
  await escolherOpcao(page, formCaso.getByRole("button", { name: "Tipo de demanda" }), /Mandado de segurança/);
  await formCaso.getByLabel("Título do caso").fill("MS — fornecimento pelo Estado");
  await formCaso.getByRole("button", { name: "Criar caso" }).click();
  await page.waitForURL(/\/crm\/casos\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: "MS — fornecimento pelo Estado" })).toBeVisible();

  // Carteira: a ficha do cliente lista os dois casos.
  await page.getByRole("navigation", { name: "Navegação" }).getByRole("link", { name: nome }).click();
  await page.getByRole("tab", { name: /Casos/ }).click();
  await expect(page.getByRole("link", { name: /HC preventivo — cultivo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /MS — fornecimento pelo Estado/ })).toBeVisible();

  // Quadro de casos: resumo por cliente mostra a carteira da pessoa.
  await page.goto("/crm/casos");
  await page.getByRole("button", { name: "Resumo" }).click();
  await page.getByLabel("Resumir por").selectOption({ label: "Cliente" });
  await expect(page.getByText(nome).first()).toBeVisible();

  // Banco: lead contratado e vinculado; dois casos do mesmo cliente.
  const admin = await supabaseComo("admin");
  const { data: lead } = await admin.from("leads").select("cliente_id, convertido_em, etapa:etapas(categoria)").eq("nome", nome).single();
  expect(lead?.cliente_id).toBeTruthy();
  expect(lead?.convertido_em).toBeTruthy();
  expect((lead as unknown as { etapa: { categoria: string } }).etapa.categoria).toBe("ganha");
  const { data: casos } = await admin.from("casos").select("titulo, natureza").eq("cliente_id", lead!.cliente_id!);
  expect(casos).toHaveLength(2);
  expect(casos!.find((c) => c.titulo === "HC preventivo — cultivo")?.natureza).toBe("judicial");
});
