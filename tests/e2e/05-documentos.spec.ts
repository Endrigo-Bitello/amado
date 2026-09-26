import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entrar, execucao, supabaseComo, telefoneUnico } from "./apoio";

// Fluxo 5 — checklist de documentos: solicitar ao cliente, receber pelo link
// seguro, revisar, aprovar e rejeitar (com motivo), com histórico.

test("checklist: solicitação, envio pelo cliente, revisão e aprovação", async ({ page, browser }) => {
  const advogado = await supabaseComo("advogado");
  const { data: cliente, error } = await advogado.from("clientes").insert({ nome: `Cliente Documentos ${execucao()}`, origem: "manual", whatsapp: telefoneUnico() }).select("id").single();
  expect(error).toBeNull();
  const { data: tipos } = await advogado.from("tipos_demanda").select("id, nome").ilike("nome", "Habeas corpus%").limit(1);
  const { data: casoId, error: erroCaso } = await advogado.rpc("criar_caso", {
    p: { cliente_id: cliente!.id, titulo: "Caso com checklist", tipo_demanda_id: tipos![0].id, natureza: "interno", equipe: [], prioridade: "media", objeto: "", aplicar_checklist: true, aplicar_tarefas: false },
  });
  expect(erroCaso).toBeNull();

  await entrar(page, "advogado", `/crm/casos/${casoId}?aba=documentos`);
  const doc = "Documento de identidade com foto";
  await expect(page.getByRole("button", { name: `Situação de ${doc}: Não solicitado. Alterar` })).toBeVisible();

  // Solicitar ao cliente: gera o link seguro (o endereço só aparece nesta hora).
  await page.getByRole("button", { name: "Solicitar ao cliente" }).click();
  const solicitar = page.getByRole("dialog", { name: "Solicitar documentos ao cliente" });
  await solicitar.getByRole("button", { name: "Gerar link seguro" }).click();
  const url = await page.getByRole("dialog", { name: "Link gerado" }).locator("code").innerText();
  expect(url).toMatch(/\/enviar-documentos#[A-Za-z0-9_-]{40,}/);
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("button", { name: `Situação de ${doc}: Solicitado. Alterar` })).toBeVisible();

  // Cliente envia pelo link (sessão anônima, outra janela).
  const arquivo = join(tmpdir(), `identidade-${execucao()}.pdf`);
  writeFileSync(arquivo, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  const anonimo = await browser.newContext();
  const portal = await anonimo.newPage();
  await portal.goto(url.replace(/^https?:\/\/[^/]+/, page.url().match(/^https?:\/\/[^/]+/)![0]));
  const item = portal.locator("li", { hasText: doc }).first();
  await expect(item).toBeVisible();
  const idInput = await item.locator("input[type=file]").getAttribute("id");
  await portal.locator(`#${idInput}`).setInputFiles(arquivo);
  await expect(item.getByText("— enviado")).toBeVisible();
  await anonimo.close();

  // Equipe: documento recebido → em revisão → aprovado.
  await page.reload();
  const situacao = (s: string) => page.getByRole("button", { name: `Situação de ${doc}: ${s}. Alterar` });
  await expect(situacao("Recebido")).toBeVisible();
  await situacao("Recebido").click();
  await page.getByRole("option", { name: "Em revisão" }).click();
  await expect(situacao("Em revisão")).toBeVisible();
  await situacao("Em revisão").click();
  await page.getByRole("option", { name: "Aprovado" }).click();
  await expect(situacao("Aprovado")).toBeVisible();

  // Rejeição exige motivo (fica no histórico).
  const outro = "Comprovante de residência";
  await page.getByRole("button", { name: `Situação de ${outro}: Solicitado. Alterar` }).click();
  await page.getByRole("option", { name: "Rejeitado" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Rejeitar documento" });
  await confirmacao.getByLabel("Motivo").fill("Imagem ilegível");
  await confirmacao.getByRole("button", { name: "Rejeitar" }).click();
  await expect(page.getByRole("button", { name: `Situação de ${outro}: Rejeitado. Alterar` })).toBeVisible();

  // Histórico do documento aprovado mostra cada etapa e quem fez.
  await page.getByRole("button", { name: doc, exact: true }).click();
  const detalhe = page.getByRole("dialog", { name: doc });
  await detalhe.getByRole("tab", { name: /Histórico/ }).click();
  await expect(detalhe.getByText("pelo cliente (link)")).toBeVisible();
  await expect(detalhe.getByText("Aprovado").first()).toBeVisible();

  // Banco: responsáveis e datas de cada etapa.
  const admin = await supabaseComo("admin");
  const { data: d } = await admin.from("documentos").select("status, enviado_pelo_cliente, solicitado_em, recebido_em, aprovado_em, aprovado_por").eq("caso_id", casoId as string).eq("nome", doc).single();
  expect(d).toMatchObject({ status: "aprovado", enviado_pelo_cliente: true, aprovado_por: process.env.E2E_ADVOGADO_ID });
  expect(d!.solicitado_em && d!.recebido_em && d!.aprovado_em).toBeTruthy();
  const { data: r } = await admin.from("documentos").select("status, rejeitado_motivo").eq("caso_id", casoId as string).eq("nome", outro).single();
  expect(r).toMatchObject({ status: "rejeitado", rejeitado_motivo: "Imagem ilegível" });
});
