import { expect, test } from "@playwright/test";
import { entrar, execucao, supabaseComo } from "./apoio";

// Fluxo 9 — o administrador cria um campo personalizado e um modelo de
// checklist; a equipe (outra sessão já aberta) passa a usá-los sem novo deploy.

test("campo personalizado e modelo de checklist criados pelo administrador funcionam para a equipe", async ({ browser }) => {
  const x = execucao();
  const advogadoApi = await supabaseComo("advogado");
  const { data: cliente } = await advogadoApi.from("clientes").insert({ nome: `Cliente Admin ${x}`, origem: "manual" }).select("id").single();
  const { data: casoId } = await advogadoApi.rpc("criar_caso", {
    p: { cliente_id: cliente!.id, titulo: `Caso Admin ${x}`, natureza: "interno", equipe: [], prioridade: "media", objeto: "", aplicar_checklist: false, aplicar_tarefas: false },
  });

  // Sessão da advogada já aberta na ficha do cliente.
  const ctxAdv = await browser.newContext();
  const adv = await ctxAdv.newPage();
  await entrar(adv, "advogado", `/crm/clientes/${cliente!.id}`);
  await expect(adv.getByRole("heading", { level: 1, name: `Cliente Admin ${x}` })).toBeVisible();

  // Administrador cria o campo (seleção com duas opções).
  const ctxAdm = await browser.newContext();
  const adm = await ctxAdm.newPage();
  await entrar(adm, "admin", "/crm/admin/campos");
  await adm.getByRole("button", { name: "Novo campo" }).click();
  const formCampo = adm.getByRole("dialog", { name: /Novo campo em Clientes/ });
  await formCampo.getByLabel("Nome do campo").fill(`Especialidade do prescritor ${x}`);
  await formCampo.getByLabel("Tipo").selectOption("selecao");
  await formCampo.getByLabel("Seção da ficha").fill("Acompanhamento médico");
  for (const opcao of ["Neurologia", "Psiquiatria"]) {
    await formCampo.getByLabel("Nova opção").fill(opcao);
    await formCampo.getByRole("button", { name: "Adicionar opção" }).click();
  }
  await formCampo.getByRole("button", { name: "Salvar campo" }).click();
  await expect(formCampo).toBeHidden();
  await expect(adm.getByText(`Especialidade do prescritor ${x}`)).toBeVisible();

  // A advogada vê o novo campo na ficha aberta (tempo real) e preenche.
  const campo = adv.getByRole("button", { name: `Editar Especialidade do prescritor ${x} de Cliente Admin ${x}` });
  await expect(campo).toBeVisible({ timeout: 20_000 });
  await campo.click();
  await adv.getByRole("option", { name: "Neurologia" }).click();
  await expect(campo).toContainText("Neurologia");

  // Administrador cria um modelo de checklist com um grupo e um documento.
  await adm.goto("/crm/admin/checklists");
  await adm.getByRole("button", { name: "Novo modelo" }).click();
  await adm.waitForURL(/modelo=/);
  const nomeModelo = adm.getByLabel("Nome", { exact: true });
  await nomeModelo.fill(`Modelo E2E ${x}`);
  await nomeModelo.blur();
  await expect(adm.getByText("Nome salvo.")).toBeVisible();
  await adm.getByLabel("Novo grupo").fill("Documentos médicos");
  await adm.getByRole("button", { name: "Adicionar grupo" }).click();
  await expect(adm.getByLabel("Nome do grupo Documentos médicos")).toBeVisible();
  await adm.getByRole("button", { name: "Novo documento" }).click();
  const formItem = adm.getByRole("dialog", { name: "Novo documento no modelo" });
  await formItem.getByLabel("Nome do documento").fill(`Relatório do neurologista ${x}`);
  await formItem.getByLabel("O que pedir ao cliente").fill("Relatório recente com CID e justificativa.");
  await formItem.getByLabel("Prazo interno (dias após aplicar)").fill("5");
  await formItem.getByRole("button", { name: "Salvar" }).click();
  await expect(formItem).toBeHidden();
  await expect(adm.getByText(`Relatório do neurologista ${x}`)).toBeVisible();

  // A advogada aplica o novo modelo no caso.
  await adv.goto(`/crm/casos/${casoId}?aba=documentos`);
  await adv.getByRole("button", { name: "Aplicar modelo" }).click();
  await adv.getByRole("option", { name: new RegExp(`Modelo E2E ${x}`) }).click();
  await expect(adv.getByRole("button", { name: `Relatório do neurologista ${x}`, exact: true })).toBeVisible();

  // Banco: valor do campo e documento com prazo calculado a partir do modelo.
  const admin = await supabaseComo("admin");
  const { data: campoDb } = await admin.from("campos_personalizados").select("id, opcoes").eq("rotulo", `Especialidade do prescritor ${x}`).single();
  const { data: valor } = await admin.from("valores_personalizados").select("valor").eq("campo_id", campoDb!.id).eq("registro_id", cliente!.id).single();
  const neuro = (campoDb!.opcoes as { id: string; rotulo: string }[]).find((o) => o.rotulo === "Neurologia");
  expect(valor!.valor).toBe(neuro!.id);
  const { data: doc } = await admin.from("documentos").select("grupo, prazo, obrigatorio, descricao_cliente").eq("caso_id", casoId as string).eq("nome", `Relatório do neurologista ${x}`).single();
  expect(doc).toMatchObject({ grupo: "Documentos médicos", obrigatorio: true, descricao_cliente: "Relatório recente com CID e justificativa." });
  expect(doc!.prazo).toBeTruthy();

  await ctxAdv.close();
  await ctxAdm.close();
});
