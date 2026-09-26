import { expect, test } from "@playwright/test";
import { entrar, execucao, simularIbge, supabaseComo, telefoneUnico } from "./apoio";

// Fluxo 1 — quiz do site → lead no CRM com todas as respostas, origem e UTMs;
// novo envio do mesmo telefone não duplica o lead.

test("quiz do site cria lead com respostas, UTMs e consentimento; reenvio não duplica", async ({ page }) => {
  const nome = `Paciente Quiz ${execucao()}`;
  const telefone = telefoneUnico();
  await simularIbge(page);
  await page.route("**/api/quiz-lead", (r) => r.fulfill({ json: { ok: true } })); // encaminhamento legado fora do teste

  const responder = async (texto: string | RegExp) => {
    await page.getByRole("button", { name: texto }).first().click();
    await page.waitForTimeout(350);
  };

  await page.goto("/quiz?utm_source=google&utm_medium=cpc&utm_campaign=e2e-quiz");
  await responder(/Quero mais informações sobre como cultivar/);
  await page.getByRole("button", { name: "Selecione seu estado" }).click();
  await page.getByRole("button", { name: /Santa Catarina/ }).click();
  await page.getByPlaceholder("Digite sua cidade").fill("Join");
  await page.getByRole("button", { name: "Joinville" }).click();
  await responder("Continuar");
  await responder("Sim, já cultivo");
  await responder("Não, ainda não fiz consulta");
  await page.getByPlaceholder("Sua profissão").fill("Professora");
  await responder("Continuar");
  await responder("Entre R$ 4.000 e R$ 7.000");
  await responder("Quero entender se tenho direito");
  await responder("Quero receber mais informações antes");
  await page.getByPlaceholder("Nome completo").fill(nome);
  await page.getByPlaceholder(/WhatsApp com DDD/).fill(telefone);
  await page.getByText(/Autorizo o uso dos dados/).click();
  await page.getByRole("button", { name: /Enviar e confirmar/ }).click();
  await expect(page.getByText("Recebemos suas informações.")).toBeVisible();
  await expect(page.getByText(/Protocolo do seu atendimento/)).toBeVisible();

  // Conferência no banco
  const admin = await supabaseComo("admin");
  const { data: leads } = await admin.from("leads").select("*").eq("nome", nome);
  expect(leads).toHaveLength(1);
  const lead = leads![0];
  expect(lead.origem).toBe("quiz_site");
  expect(lead.estado).toBe("SC");
  expect(lead.municipio).toBe("Joinville");
  expect(lead.quiz_cultiva).toBe("Sim, já cultivo");
  expect(lead.quiz_agenda).toBe("Quero receber mais informações antes");
  expect(lead.utm_source).toBe("google");
  expect(lead.utm_campaign).toBe("e2e-quiz");
  expect(lead.score).toBe(3 + 1 + 2 + 1 + 1);
  const { data: respostas } = await admin.from("quiz_respostas").select("pergunta_id, resposta").eq("lead_id", lead.id);
  expect(respostas!.map((r) => r.pergunta_id)).toEqual(expect.arrayContaining(["welcome", "location.estado", "cultiva", "consulta", "renda", "faixaRenda", "motivacao", "agenda", "contact.nome", "contact.whatsapp"]));
  const { data: consentimentos } = await admin.from("consentimentos").select("concedido, versao").eq("lead_id", lead.id);
  expect(consentimentos).toEqual([expect.objectContaining({ concedido: true })]);

  // Novo envio pelo mesmo telefone (nova sessão) → mesmo lead, sem duplicar.
  const outra = await page.context().browser()!.newContext({ locale: "pt-BR" });
  const p2 = await outra.newPage();
  await simularIbge(p2);
  await p2.route("**/api/quiz-lead", (r) => r.fulfill({ json: { ok: true } }));
  await p2.goto("/quiz");
  const r2 = async (t: string | RegExp) => {
    await p2.getByRole("button", { name: t }).first().click();
    await p2.waitForTimeout(350);
  };
  await r2(/Quero mais informações sobre como cultivar/);
  await p2.getByRole("button", { name: "Selecione seu estado" }).click();
  await p2.getByRole("button", { name: /Santa Catarina/ }).click();
  await p2.getByPlaceholder("Digite sua cidade").fill("Join");
  await p2.getByRole("button", { name: "Joinville" }).click();
  await r2("Continuar");
  await r2("Sim, já cultivo");
  await r2("Sim, já tenho acompanhamento médico");
  await p2.getByPlaceholder("Sua profissão").fill("Professora");
  await r2("Continuar");
  await r2("Entre R$ 4.000 e R$ 7.000");
  await r2("Quero entender se tenho direito");
  await r2("Quero agendar agora");
  await r2(/Segunda a sexta, manhã/);
  await p2.getByPlaceholder("Nome completo").fill(nome);
  await p2.getByPlaceholder(/WhatsApp com DDD/).fill(telefone.replace(/\D/g, ""));
  await p2.getByText(/Autorizo o uso dos dados/).click();
  await p2.getByRole("button", { name: /Enviar e confirmar/ }).click();
  await expect(p2.getByText(/Temos um acordo/)).toBeVisible();
  await outra.close();

  const { data: depois } = await admin.from("leads").select("id, total_submissoes, quiz_horario").eq("nome", nome);
  expect(depois).toHaveLength(1);
  expect(depois![0].total_submissoes).toBe(2);
  expect(depois![0].quiz_horario).toBe("Segunda a sexta, manhã (8h–12h)");

  // O lead aparece no quadro com as respostas do quiz na ficha.
  await entrar(page, "atendimento", "/crm/leads");
  await page.getByPlaceholder(/^Buscar em /).fill(nome);
  await page.getByRole("button", { name: new RegExp(`Abrir ${nome}`) }).first().click();
  await page.getByRole("tab", { name: /Quiz/ }).click();
  await expect(page.getByText("Sim, já cultivo").first()).toBeVisible();
  await expect(page.getByText(/Quero agendar agora/).first()).toBeVisible();
});
