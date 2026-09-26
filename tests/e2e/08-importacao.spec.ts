import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entrar, execucao, supabaseComo, telefoneUnico } from "./apoio";

// Fluxo 8 — importação de planilha: prévia, mapeamento de colunas, validação,
// duplicados sinalizados (nunca sobrescritos em silêncio) e relatório.

function cpf(): string {
  const base = Array.from(randomBytes(9), (b) => b % 10);
  const dv = (nums: number[]) => {
    const r = (nums.reduce((t, n, i) => t + n * (nums.length + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  return [...base, d1, dv([...base, d1])].join("");
}

test("importação com prévia, duplicado sinalizado e linha com erro", async ({ page }) => {
  const x = execucao();
  const cpfExistente = cpf();
  const cpfNovo = cpf();
  const admin = await supabaseComo("admin");
  const { data: existente } = await admin
    .from("clientes")
    .insert({ nome: `Cliente Existente ${x}`, origem: "manual", cpf_cnpj: cpfExistente, email: `original-${x}@exemplo.com` })
    .select("id, codigo")
    .single();

  const fone = telefoneUnico();
  const foneErro = `48 97${fone.slice(-7)}`;
  const erros: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  const csv = [
    "Nome completo,CPF,Celular,E-mail,Cidade,UF",
    `Importado Novo ${x},${cpfNovo},${fone},novo-${x}@exemplo.com,Florianópolis,SC`,
    `Cliente Existente ${x},${cpfExistente},48 96${fone.slice(-7)},outro-${x}@exemplo.com,Joinville,SC`,
    `,,${foneErro},,Blumenau,SC`,
  ].join("\n");
  const arquivo = join(tmpdir(), `importacao-${x}.csv`);
  writeFileSync(arquivo, `﻿${csv}`, "utf8");

  await entrar(page, "admin", "/crm/clientes/importar");
  await page.getByLabel("Escolher planilha").setInputFiles(arquivo);

  // Mapeamento: colunas reconhecidas automaticamente (podem ser ajustadas).
  await expect(page.getByLabel("Campo para Nome completo")).toBeVisible();
  await expect(page.getByLabel("Campo para CPF")).not.toHaveValue("");
  await page.getByRole("button", { name: "Validar e ver prévia" }).click();

  // Prévia: 1 nova, 1 possível duplicado, 1 com erro.
  await expect(page.getByRole("button", { name: "Novas (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Possíveis duplicados (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Com erro (1)" })).toBeVisible();
  await expect(page.getByText(new RegExp(`Possível duplicado de ${existente!.codigo}`))).toBeVisible();
  // O duplicado não é sobrescrito por padrão.
  await expect(page.getByLabel("Decisão para a linha 3")).toHaveValue("ignorar");
  await expect(page.getByLabel("Decisão para a linha 4").locator("option[value=criar]")).toBeDisabled();

  await page.getByRole("button", { name: /^Importar \(1 linha/ }).click();
  const criados = page.locator("div", { has: page.getByText("Criados", { exact: true }) }).last();
  await expect(criados).toContainText("1");
  await expect(page.getByRole("button", { name: "Baixar relatório (CSV)" })).toBeVisible();

  // Banco: novo cliente criado; existente preservado sem alterações silenciosas.
  const { data: novo } = await admin.from("clientes").select("nome, email, cidade, uf, origem").eq("nome", `Importado Novo ${x}`).single();
  expect(novo).toMatchObject({ email: `novo-${x}@exemplo.com`, cidade: "Florianópolis", uf: "SC", origem: "importacao" });
  const { data: antes } = await admin.from("clientes").select("email, cidade").eq("id", existente!.id).single();
  expect(antes).toMatchObject({ email: `original-${x}@exemplo.com`, cidade: null });
  const { data: registro } = await admin.from("importacoes").select("total_linhas, criados, ignorados, erros").order("created_at", { ascending: false }).limit(1).single();
  expect(registro).toMatchObject({ total_linhas: 3, criados: 1 });
  expect(erros).toEqual([]);
});
