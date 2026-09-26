import { expect, test, type Page } from "@playwright/test";
import { entrar, execucao, supabaseComo } from "./apoio";

// Fluxo 6 — tarefa, prazo processual e reunião criados pela interface aparecem
// na agenda (fuso de São Paulo) e nos indicadores do painel Hoje.

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function criarPeloMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Criar novo" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("tarefa, prazo e reunião aparecem na agenda e no painel", async ({ page }) => {
  const x = execucao();
  const advogado = await supabaseComo("advogado");
  const { data: cliente } = await advogado.from("clientes").insert({ nome: `Cliente Agenda ${x}`, origem: "manual" }).select("id").single();
  const { data: casoId } = await advogado.rpc("criar_caso", {
    p: { cliente_id: cliente!.id, titulo: `Caso Agenda ${x}`, natureza: "judicial", equipe: [], prioridade: "alta", objeto: "", aplicar_checklist: false, aplicar_tarefas: false },
  });

  await entrar(page, "advogado", "/crm");
  const hoje = hojeSP();

  // Tarefa com prazo hoje.
  await criarPeloMenu(page, "Tarefa");
  const tarefa = page.getByRole("dialog", { name: "Nova tarefa" });
  await tarefa.getByLabel("Título").fill(`Revisar minuta ${x}`);
  await tarefa.getByLabel("Prazo").fill(hoje);
  await tarefa.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(tarefa).toBeHidden();

  // Reunião hoje.
  await criarPeloMenu(page, "Compromisso");
  const reuniao = page.getByRole("dialog", { name: "Novo compromisso" });
  await reuniao.getByLabel("Título").fill(`Reunião com a cliente ${x}`);
  await reuniao.getByLabel("Data").fill(hoje);
  await reuniao.getByLabel("Início").fill("23:30");
  await reuniao.getByLabel("Término").fill("23:50");
  await reuniao.getByRole("button", { name: "Agendar" }).click();
  await expect(reuniao).toBeHidden();

  // Prazo processual (na ficha do caso), vencendo hoje às 23:59, conferido.
  await page.goto(`/crm/casos/${casoId}?aba=prazos`);
  await page.getByRole("button", { name: "Novo prazo" }).first().click();
  const prazo = page.getByRole("dialog", { name: "Novo prazo processual" });
  await prazo.getByLabel("Prazo (o que deve ser feito)").fill(`Contrarrazões ${x}`);
  await prazo.getByLabel("Vencimento (data)").fill(hoje);
  await prazo.getByText("Conferi este prazo").click();
  await prazo.getByRole("button", { name: "Cadastrar prazo" }).click();
  await expect(page.getByText(`Contrarrazões ${x}`)).toBeVisible();

  // Agenda do dia: os três itens, cada um com seu tipo.
  await page.goto(`/crm/agenda?modo=dia&data=${hoje}`);
  const itemDoDia = (texto: string) => page.locator("li, article, div").filter({ hasText: texto }).last();
  await expect(page.getByText(`Revisar minuta ${x}`)).toBeVisible();
  await expect(itemDoDia(`Reunião com a cliente ${x}`)).toContainText("23:30");
  await expect(itemDoDia(`Contrarrazões ${x}`)).toContainText(/Prazo processual/i);
  // Na semana, cada item traz tipo e horário no título (visível ao passar o mouse).
  await page.goto(`/crm/agenda?modo=semana&data=${hoje}`);
  await expect(page.getByTitle(new RegExp(`Reunião com a cliente ${x} às 23:30`))).toBeVisible();
  await expect(page.getByTitle(new RegExp(`Prazo processual: Contrarrazões ${x}`))).toBeVisible();

  // Painel Hoje ("Meus itens"): indicadores contam os itens e abrem a lista filtrada.
  await page.goto("/crm");
  const indicador = (nome: string) => page.getByRole("link", { name: new RegExp(`^${nome}: [1-9]\\d*\\.`) });
  await expect(indicador("Tarefas de hoje")).toBeVisible();
  await expect(indicador("Prazos próximos")).toBeVisible();
  await expect(indicador("Compromissos de hoje")).toBeVisible();
  await indicador("Tarefas de hoje").click();
  await page.waitForURL(/\/crm\/tarefas\?preset=tarefas_hoje/);
  await expect(page.getByText("Filtro do painel: Tarefas de hoje")).toBeVisible();
  await expect(page.getByRole("button", { name: `Abrir Revisar minuta ${x}` })).toBeVisible();

  await page.goto("/crm");
  await indicador("Prazos próximos").click();
  await page.waitForURL(/\/crm\/casos\?aba=prazos&preset=prazos_proximos/);
  await expect(page.getByRole("button", { name: `Abrir Contrarrazões ${x}` })).toBeVisible();
});
