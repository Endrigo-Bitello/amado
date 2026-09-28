// Testes de integração do backend do CRM contra o Supabase LOCAL.
// Pré-requisitos: `npx supabase start` e banco recém-criado (`npx supabase db reset`).
// Execução: npm run test:backend
//
// Cobre: RLS por perfil, quiz → lead, conversão, casos, checklist, portal do
// cliente, revisão de documentos, tarefas, prazos (conferência/correção),
// financeiro (parcial/quitação), importação, campos personalizados,
// automações (deduplicação), auditoria, modo simplificado e conta de desenvolvimento.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const URL_API = status.API_URL;
const ANON = status.ANON_KEY;
const SERVICO = status.SERVICE_ROLE_KEY;
const FUNCOES = `${URL_API}/functions/v1`;

const senha = () => `Teste-${randomUUID().slice(0, 8)}-9x`;
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(URL_API, SERVICO, opcoes);
const anonimo = createClient(URL_API, ANON, opcoes);

const contas = {};
const ctx = {};

async function entrar(email, pw) {
  const c = createClient(URL_API, ANON, opcoes);
  const { data, error } = await c.auth.signInWithPassword({ email, password: pw });
  assert.ifError(error);
  c.token = data.session.access_token;
  return c;
}

async function funcao(nome, corpo, token) {
  const resp = await fetch(`${FUNCOES}/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  });
  return { status: resp.status, corpo: await resp.json() };
}

function ok(resultado, contexto) {
  assert.ifError(resultado.error, contexto);
  return resultado.data;
}

before(async () => {
  const { count } = await servico.from("usuarios").select("*", { count: "exact", head: true });
  assert.equal(count, 0, "Os testes exigem um banco recém-criado: rode `npx supabase db reset`.");

  contas.admin = { email: "admin@teste.local", senha: senha() };
  const { data, error } = await servico.auth.admin.createUser({
    email: contas.admin.email,
    password: contas.admin.senha,
    email_confirm: true,
  });
  assert.ifError(error);
  ok(await servico.rpc("admin_bootstrap", { p_usuario: data.user.id, p_nome: "Admin Teste", p_email: contas.admin.email }));
  ctx.admin = await entrar(contas.admin.email, contas.admin.senha);
  ctx.adminId = data.user.id;
});

test("admin cria usuários pelos perfis iniciais (Edge Function crm-admin)", async () => {
  for (const [perfil, email] of [["advogado", "advogado@teste.local"], ["atendimento", "atendimento@teste.local"]]) {
    contas[perfil] = { email, senha: senha() };
    const r = await funcao("crm-admin", { acao: "criar_usuario", nome: `Usuário ${perfil}`, email, senha: contas[perfil].senha, perfil_id: perfil }, ctx.admin.token);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    ctx[`${perfil}Id`] = r.corpo.id;
    ctx[perfil] = await entrar(email, contas[perfil].senha);
  }
  const fraca = await funcao("crm-admin", { acao: "criar_usuario", nome: "X", email: "x@teste.local", senha: "123", perfil_id: "atendimento" }, ctx.admin.token);
  assert.equal(fraca.status, 400);
  const semPermissao = await funcao("crm-admin", { acao: "listar_usuarios" }, ctx.atendimento.token);
  assert.equal(semPermissao.status, 403);
  const lista = await funcao("crm-admin", { acao: "listar_usuarios" }, ctx.admin.token);
  assert.equal(lista.corpo.usuarios.length, 3);
  const perfil = ok(await ctx.atendimento.rpc("meu_perfil"));
  assert.equal(perfil.perfil_id, "atendimento");
  assert.ok(!perfil.permissoes.includes("financeiro.ver"));
});

test("acesso anônimo às tabelas do CRM é bloqueado", async () => {
  const { data, error } = await anonimo.from("leads").select("id");
  assert.ok(error || (data ?? []).length === 0);
  const rpc = await anonimo.rpc("quiz_registrar", { p: {} });
  assert.ok(rpc.error, "anon não pode chamar funções de serviço");
});

test("quiz do site cria lead com todas as respostas, consentimento e tarefa automática", async () => {
  const corpo = {
    submissao_id: randomUUID(),
    respostas: {
      welcome: "Quero mais informações sobre como cultivar cannabis legalmente",
      estado: "SC",
      municipio: "Florianópolis",
      cultiva: "Não, ainda não cultivo",
      consulta: "Sim, já tenho acompanhamento médico",
      profissao: "Professora",
      faixaRenda: "Entre R$ 4.000 e R$ 7.000",
      motivacao: "Quero iniciar um tratamento com segurança",
      agenda: "Quero agendar agora",
      datetime: "Sábado, manhã (9h–12h)",
    },
    contato: { nome: "Paciente Quiz", whatsapp: "48 98888-7777", email: "paciente.quiz@example.com" },
    lgpd: { aceito: true, texto: "Autorizo o uso dos dados informados para contato, análise inicial da demanda e registro interno, nos termos da LGPD.", versao: "2026-05-site" },
    score: 11,
    meta: { pagina: "/quiz", utm_source: "google", utm_medium: "cpc", utm_campaign: "teste", iniciado_em: new Date(Date.now() - 90_000).toISOString() },
    website: "",
  };
  const r = await funcao("quiz-lead", corpo);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.match(r.corpo.protocolo, /^L-\d{5}$/);

  const repetido = await funcao("quiz-lead", corpo);
  assert.equal(repetido.corpo.protocolo, r.corpo.protocolo, "reenvio com o mesmo id é idempotente");

  const invalido = await funcao("quiz-lead", { ...corpo, submissao_id: randomUUID(), contato: { nome: "A", whatsapp: "12", email: "" } });
  assert.equal(invalido.status, 400);

  const lead = ok(await ctx.atendimento.from("leads").select("*").eq("codigo", r.corpo.protocolo).single());
  assert.equal(lead.origem, "quiz_site");
  assert.equal(lead.score, 11);
  assert.equal(lead.temperatura, "morno");
  assert.equal(lead.quiz_horario, "Sábado, manhã (9h–12h)");
  assert.equal(lead.utm_source, "google");
  const respostas = ok(await ctx.atendimento.from("quiz_respostas").select("*").eq("lead_id", lead.id));
  assert.equal(respostas.length, 13);
  const consent = ok(await ctx.atendimento.from("consentimentos").select("*").eq("lead_id", lead.id));
  assert.equal(consent[0].concedido, true);
  const tarefas = ok(await ctx.atendimento.from("tarefas").select("*").eq("lead_id", lead.id));
  assert.equal(tarefas.length, 1);
  assert.equal(tarefas[0].origem, "automacao");
  ctx.lead = lead;
});

test("etapas: mover para 'Não convertido' exige motivo; contato registra primeiro contato", async () => {
  const etapas = ok(await ctx.atendimento.from("etapas").select("*").eq("funil", "lead").order("ordem"));
  const perdida = etapas.find((e) => e.categoria === "perdida");
  const emAtendimento = etapas.find((e) => e.chave === "lead_atendimento");
  const semMotivo = await ctx.atendimento.from("leads").update({ etapa_id: perdida.id }).eq("id", ctx.lead.id);
  assert.ok(semMotivo.error);
  assert.match(semMotivo.error.message, /motivo/i);
  ok(await ctx.atendimento.from("leads").update({ etapa_id: emAtendimento.id }).eq("id", ctx.lead.id));
  ok(await ctx.atendimento.from("interacoes").insert({ lead_id: ctx.lead.id, tipo: "whatsapp", resumo: "Primeiro contato pelo WhatsApp" }));
  const lead = ok(await ctx.atendimento.from("leads").select("primeiro_contato_em, etapa_id").eq("id", ctx.lead.id).single());
  assert.ok(lead.primeiro_contato_em);
  const eventos = ok(await ctx.atendimento.from("eventos").select("tipo").eq("lead_id", ctx.lead.id));
  assert.ok(eventos.some((e) => e.tipo === "etapa") && eventos.some((e) => e.tipo === "contato"));
});

test("conversão em cliente e dois casos para a mesma pessoa, com checklist", async () => {
  const tipos = ok(await ctx.advogado.from("tipos_demanda").select("*").order("ordem"));
  const hc = tipos.find((t) => t.nome.startsWith("Habeas"));
  const ms = tipos.find((t) => t.nome.startsWith("Mandado"));
  const conv = ok(await ctx.advogado.rpc("converter_lead", {
    p_lead: ctx.lead.id,
    p_dados: {
      cpf_cnpj: "529.982.247-25",
      caso: { titulo: "HC preventivo — cultivo", tipo_demanda_id: hc.id, aplicar_checklist: true, aplicar_tarefas: true },
    },
  }));
  assert.ok(conv.cliente_id && conv.caso_id);
  ctx.clienteId = conv.cliente_id;
  ctx.caso1 = conv.caso_id;

  const dup = await ctx.advogado.rpc("converter_lead", { p_lead: ctx.lead.id, p_dados: {} });
  assert.ok(dup.error, "lead já convertido");

  ctx.caso2 = ok(await ctx.advogado.rpc("criar_caso", {
    p: { cliente_id: ctx.clienteId, titulo: "Mandado de segurança — fornecimento", tipo_demanda_id: ms.id, natureza: "judicial", numero_processo: "5001234-56.2026.8.24.0023", tribunal: "TJSC" },
  }));
  const casos = ok(await ctx.advogado.from("casos").select("id, natureza, cliente_id").eq("cliente_id", ctx.clienteId));
  assert.equal(casos.length, 2);
  assert.ok(casos.find((c) => c.id === ctx.caso2).natureza === "judicial");

  const lead = ok(await ctx.advogado.from("leads").select("cliente_id, etapa_id").eq("id", ctx.lead.id).single());
  assert.equal(lead.cliente_id, ctx.clienteId);
  const docs = ok(await ctx.advogado.from("documentos").select("*").eq("caso_id", ctx.caso1));
  assert.ok(docs.length >= 20, `checklist aplicado (${docs.length})`);
  const representante = docs.filter((d) => d.nome.includes("responsável legal") || d.nome.includes("representação"));
  assert.ok(representante.every((d) => d.status === "dispensado"), "itens condicionais dispensados (sem representante)");
  const tarefas = ok(await ctx.advogado.from("tarefas").select("id, depende_de, origem").eq("caso_id", ctx.caso1));
  assert.equal(tarefas.length, 6);
  assert.ok(tarefas.filter((t) => t.depende_de).length >= 4, "dependências do modelo");
  ctx.docs = docs;
});

test("dados de saúde: atendimento não atribuído não vê documentos clínicos", async () => {
  const doAdvogado = ok(await ctx.advogado.from("documentos").select("id, clinico").eq("caso_id", ctx.caso1));
  const doAtendimento = ok(await ctx.atendimento.from("documentos").select("id, clinico").eq("caso_id", ctx.caso1));
  assert.ok(doAdvogado.some((d) => d.clinico));
  assert.ok(!doAtendimento.some((d) => d.clinico), "clínicos ocultos");
  assert.ok(doAtendimento.length < doAdvogado.length);
  const financeirosAtendimento = doAtendimento.filter((d) => d.financeiro);
  assert.equal(financeirosAtendimento.length, 0, "documentos financeiros ocultos sem financeiro.ver");
});

test("portal do cliente: link individual, envio, revisão e aprovação", async () => {
  const laudo = ctx.docs.find((d) => d.nome === "Laudo ou relatório médico");
  const identidade = ctx.docs.find((d) => d.nome === "Documento de identidade com foto");
  const link = await funcao("crm-documentos", {
    acao: "criar_link", caso_id: ctx.caso1, documentos_ids: [laudo.id, identidade.id], validade_dias: 7, mensagem: "Envie por favor",
  }, ctx.advogado.token);
  assert.equal(link.status, 200, JSON.stringify(link.corpo));
  const token = link.corpo.url.split("#")[1];
  assert.ok(token.length >= 40);

  const semPerm = await funcao("crm-documentos", { acao: "criar_link", caso_id: ctx.caso1, documentos_ids: [laudo.id] }, ctx.atendimento.token);
  assert.notEqual(semPerm.status, 200, "atendimento não pode incluir documento clínico que não vê");

  const aberto = await funcao("portal-cliente", { acao: "abrir", token });
  assert.equal(aberto.status, 200, JSON.stringify(aberto.corpo));
  assert.equal(aberto.corpo.documentos.length, 2);
  assert.equal(aberto.corpo.primeiro_nome, "Paciente");
  assert.ok(!JSON.stringify(aberto.corpo).includes("instrucao"), "instruções internas não aparecem");

  const invalido = await funcao("portal-cliente", { acao: "abrir", token: "x".repeat(43) });
  assert.equal(invalido.status, 404);

  const pdf = new Blob(["%PDF-1.4\n% teste\n"], { type: "application/pdf" });
  const prep = await funcao("portal-cliente", { acao: "preparar", token, documento_id: laudo.id, arquivo: { nome: "laudo médico.pdf", tipo: "application/pdf", tamanho: pdf.size } });
  assert.equal(prep.status, 200, JSON.stringify(prep.corpo));
  const envio = await anonimo.storage.from("crm-documentos").uploadToSignedUrl(prep.corpo.caminho, prep.corpo.token_envio, pdf, { contentType: "application/pdf" });
  assert.ifError(envio.error);
  const conf = await funcao("portal-cliente", { acao: "confirmar", token, documento_id: laudo.id, caminho: prep.corpo.caminho, arquivo: { nome: "laudo médico.pdf" } });
  assert.equal(conf.status, 200, JSON.stringify(conf.corpo));

  const doc = ok(await ctx.advogado.from("documentos").select("*").eq("id", laudo.id).single());
  assert.equal(doc.status, "recebido");
  assert.equal(doc.enviado_pelo_cliente, true);
  const arquivos = ok(await ctx.advogado.from("arquivos").select("*").eq("documento_id", laudo.id));
  assert.equal(arquivos.length, 1);
  const url = await ctx.advogado.storage.from("crm-documentos").createSignedUrl(arquivos[0].caminho, 60);
  assert.ifError(url.error);
  const urlAtendimento = await ctx.atendimento.storage.from("crm-documentos").createSignedUrl(arquivos[0].caminho, 60);
  assert.ok(urlAtendimento.error, "atendimento não baixa documento clínico");

  ok(await ctx.advogado.from("documentos").update({ status: "em_revisao" }).eq("id", laudo.id));
  ok(await ctx.advogado.from("documentos").update({ status: "aprovado" }).eq("id", laudo.id));
  const aprovado = ok(await ctx.advogado.from("documentos").select("*").eq("id", laudo.id).single());
  assert.equal(aprovado.aprovado_por, ctx.advogadoId);
  assert.ok(aprovado.valido_ate, "validade calculada");
  const hist = ok(await ctx.advogado.from("documentos_historico").select("para, via").eq("documento_id", laudo.id).order("created_at"));
  assert.deepEqual(hist.map((h) => h.para), ["nao_solicitado", "solicitado", "recebido", "em_revisao", "aprovado"]);
  assert.equal(hist[2].via, "portal");

  const semRevisao = await ctx.atendimento.from("documentos").update({ status: "aprovado" }).eq("id", identidade.id).select();
  assert.ok(semRevisao.error, "atendimento não aprova documentos");

  const revogar = await funcao("crm-documentos", { acao: "revogar_link", id: link.corpo.id }, ctx.advogado.token);
  assert.equal(revogar.status, 200);
  const revogado = await funcao("portal-cliente", { acao: "abrir", token });
  assert.equal(revogado.status, 410);
});

test("prazos: conferência por profissional, correção exige motivo e gera histórico", async () => {
  const venc = new Date(Date.now() + 10 * 86400_000).toISOString();
  const semPerm = await ctx.atendimento.from("prazos").insert({ caso_id: ctx.caso2, titulo: "Manifestação", vencimento: venc });
  assert.ok(semPerm.error, "atendimento não cadastra prazos");
  const prazo = ok(await ctx.advogado.from("prazos").insert({ caso_id: ctx.caso2, titulo: "Manifestação sobre informações", vencimento: venc, conferido: true, responsavel_id: ctx.advogadoId }).select().single());
  assert.equal(prazo.conferido_por, ctx.advogadoId);
  const semMotivo = await ctx.advogado.from("prazos").update({ vencimento: new Date(Date.now() + 12 * 86400_000).toISOString() }).eq("id", prazo.id);
  assert.ok(semMotivo.error);
  ok(await ctx.advogado.from("prazos").update({ vencimento: new Date(Date.now() + 12 * 86400_000).toISOString(), motivo_alteracao: "Republicação da intimação" }).eq("id", prazo.id));
  const atual = ok(await ctx.advogado.from("prazos").select("*").eq("id", prazo.id).single());
  assert.equal(atual.conferido, false, "correção exige nova conferência");
  assert.equal(atual.motivo_alteracao, null);
  const hist = ok(await ctx.advogado.from("prazos_historico").select("campo, motivo").eq("prazo_id", prazo.id));
  assert.ok(hist.some((h) => h.campo === "vencimento" && h.motivo === "Republicação da intimação"));
  ok(await ctx.advogado.from("prazos").update({ status: "cumprido" }).eq("id", prazo.id));
  ctx.prazoId = prazo.id;
});

test("tarefas com dependência e compromisso na agenda", async () => {
  const t1 = ok(await ctx.atendimento.from("tarefas").insert({ titulo: "Separar documentos", caso_id: ctx.caso2, responsavel_id: ctx.atendimentoId }).select().single());
  const t2 = ok(await ctx.atendimento.from("tarefas").insert({ titulo: "Enviar ao advogado", caso_id: ctx.caso2, responsavel_id: ctx.atendimentoId, depende_de: t1.id }).select().single());
  const bloqueada = await ctx.atendimento.from("tarefas").update({ status: "concluida" }).eq("id", t2.id);
  assert.ok(bloqueada.error, "dependência impede conclusão");
  ok(await ctx.atendimento.from("tarefas").update({ status: "concluida" }).eq("id", t1.id));
  ok(await ctx.atendimento.from("tarefas").update({ status: "concluida" }).eq("id", t2.id));
  const inicio = new Date(Date.now() + 2 * 3600_000).toISOString();
  const reuniao = ok(await ctx.atendimento.from("compromissos").insert({ tipo: "reuniao", titulo: "Reunião inicial", inicio, caso_id: ctx.caso2, responsavel_id: ctx.advogadoId }).select().single());
  assert.equal(reuniao.cliente_id, ctx.clienteId, "cliente herdado do caso");
  const notif = ok(await ctx.advogado.from("notificacoes").select("tipo, titulo"));
  assert.ok(notif.some((n) => n.titulo.includes("Reunião inicial")));
});

test("financeiro: contrato, parcela, pagamento parcial, quitação e permissões", async () => {
  // Data de hoje no fuso do escritório (o sistema recusa pagamentos com data futura).
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const r = await funcao("crm-financeiro", {
    acao: "criar_contrato",
    dados: { cliente_id: ctx.clienteId, caso_id: ctx.caso1, valor_total: 3000, entrada: { valor: 1000, data: hoje }, parcelas: { quantidade: 2, primeiro_vencimento: hoje }, forma_contratacao: "parcelado" },
  }, ctx.admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const cobrancas = ok(await ctx.admin.from("v_cobrancas").select("*").eq("contrato_id", r.corpo.resultado.contrato_id).order("parcela_numero"));
  assert.equal(cobrancas.length, 3);
  assert.equal(cobrancas.reduce((s, c) => s + Number(c.valor), 0), 3000);
  const entrada = cobrancas[0];

  const advogadoTenta = await funcao("crm-financeiro", { acao: "registrar_pagamento", dados: { cobranca_id: entrada.id, valor: 100, data_pagamento: hoje, forma: "pix" } }, ctx.advogado.token);
  assert.equal(advogadoTenta.status, 403);
  const atendimentoLe = ok(await ctx.atendimento.from("cobrancas").select("id"));
  assert.equal(atendimentoLe.length, 0, "atendimento não vê valores");
  const direto = await ctx.admin.from("pagamentos").insert({ cobranca_id: entrada.id, cliente_id: ctx.clienteId, valor: 1, data_pagamento: hoje, registrado_por: ctx.adminId });
  assert.ok(direto.error, "escrita direta bloqueada (somente Edge Function)");

  const parcial = await funcao("crm-financeiro", { acao: "registrar_pagamento", dados: { cobranca_id: entrada.id, valor: 400, data_pagamento: hoje, forma: "pix" } }, ctx.admin.token);
  assert.equal(parcial.status, 200, JSON.stringify(parcial.corpo));
  assert.equal(parcial.corpo.resultado.situacao, "parcial");
  assert.equal(Number(parcial.corpo.resultado.saldo), 600);
  const excesso = await funcao("crm-financeiro", { acao: "registrar_pagamento", dados: { cobranca_id: entrada.id, valor: 700, data_pagamento: hoje, forma: "pix" } }, ctx.admin.token);
  assert.equal(excesso.status, 400);
  const quitacao = await funcao("crm-financeiro", { acao: "registrar_pagamento", dados: { cobranca_id: entrada.id, valor: 600, data_pagamento: hoje, forma: "boleto" } }, ctx.admin.token);
  assert.equal(quitacao.corpo.resultado.situacao, "pago");

  const despesa = await funcao("crm-financeiro", { acao: "registrar_despesa", dados: { cliente_id: ctx.clienteId, caso_id: ctx.caso2, categoria: "custas", descricao: "Custas iniciais", valor: 150, data: hoje, pago_por: "escritorio", reembolsavel: true, gerar_cobranca: true } }, ctx.admin.token);
  assert.equal(despesa.status, 200, JSON.stringify(despesa.corpo));
  const todas = ok(await ctx.admin.from("v_cobrancas").select("categoria, saldo, situacao").eq("cliente_id", ctx.clienteId));
  const honorariosAbertos = todas.filter((c) => c.categoria === "honorarios").reduce((s, c) => s + Number(c.saldo), 0);
  assert.equal(honorariosAbertos, 2000, "saldo de honorários não mistura custas");
  assert.equal(todas.filter((c) => c.categoria === "reembolso_despesas").length, 1);

  const rel = ok(await ctx.admin.rpc("relatorio_financeiro", { p: {} }));
  assert.equal(Number(rel.honorarios_recebidos_periodo), 1000);
  const relAtendimento = await ctx.atendimento.rpc("relatorio_financeiro", { p: {} });
  assert.ok(relAtendimento.error);
});

test("importação: prévia com duplicidade e erros, gravação conforme decisões", async () => {
  const linhas = [
    { linha: 2, dados: { nome: "Cliente Duplicado", cpf_cnpj: "529.982.247-25" } },
    { linha: 3, dados: { nome: "Cliente CPF Inválido", cpf_cnpj: "111.111.111-11" } },
    { linha: 4, dados: { nome: "Cliente Novo Importado", cpf_cnpj: "168.995.350-09", email: "novo@example.com", whatsapp: "(11) 91234-5678", data_nascimento: "10/03/1985", uf: "sp", tipo_demanda: "Mandado de segurança — cannabis medicinal", numero_processo: "0001111-22.2025.8.26.0100" } },
  ];
  const semPerm = await funcao("crm-importacao", { acao: "validar", linhas }, ctx.advogado.token);
  assert.equal(semPerm.status, 403);
  const previa = await funcao("crm-importacao", { acao: "validar", linhas }, ctx.admin.token);
  assert.equal(previa.status, 200, JSON.stringify(previa.corpo));
  const [dup, inval, novo] = previa.corpo.linhas;
  assert.ok(dup.duplicados.some((d) => d.tipo === "cliente" && d.motivos.includes("CPF/CNPJ")));
  assert.equal(dup.sugestao, "ignorar");
  assert.ok(inval.erros.length > 0);
  assert.equal(novo.sugestao, "criar");
  assert.equal(novo.dados.data_nascimento, "1985-03-10");

  const imp = await funcao("crm-importacao", {
    acao: "importar",
    arquivo_nome: "clientes.xlsx",
    linhas: [
      { ...linhas[0], acao: "completar", cliente_id: ctx.clienteId },
      { ...linhas[1], acao: "criar" },
      { ...linhas[2], acao: "criar" },
    ],
  }, ctx.admin.token);
  assert.equal(imp.status, 200, JSON.stringify(imp.corpo));
  assert.equal(imp.corpo.criados, 1);
  assert.equal(imp.corpo.atualizados, 1);
  assert.equal(imp.corpo.erros, 1);
  const cliente = ok(await ctx.admin.from("clientes").select("nome").eq("id", ctx.clienteId).single());
  assert.equal(cliente.nome, "Paciente Quiz", "completar não sobrescreve o nome existente");
  const importado = ok(await ctx.admin.from("clientes").select("id, uf, origem").eq("email", "novo@example.com").single());
  assert.equal(importado.uf, "SP");
  const casoImportado = ok(await ctx.admin.from("casos").select("natureza, processos(numero)").eq("cliente_id", importado.id));
  assert.equal(casoImportado[0].natureza, "judicial");
});

test("administração: campo personalizado e modelo de checklist aparecem para a equipe", async () => {
  const semPerm = await ctx.atendimento.from("campos_personalizados").insert({ entidade: "cliente", rotulo: "X", tipo: "texto" });
  assert.ok(semPerm.error);
  const campo = ok(await ctx.admin.from("campos_personalizados").insert({
    entidade: "cliente", rotulo: "Associação de pacientes", tipo: "selecao",
    opcoes: [{ id: "abc", rotulo: "Associação A" }, { id: "def", rotulo: "Associação B" }],
  }).select().single());
  ok(await ctx.atendimento.from("valores_personalizados").upsert({ campo_id: campo.id, registro_id: ctx.clienteId, entidade: "cliente", valor: "def" }));
  const valor = ok(await ctx.advogado.from("valores_personalizados").select("valor").eq("registro_id", ctx.clienteId).eq("campo_id", campo.id).single());
  assert.equal(valor.valor, "def");
  const trocaTipo = await ctx.admin.from("campos_personalizados").update({ tipo: "numero" }).eq("id", campo.id);
  assert.ok(trocaTipo.error, "não troca tipo de campo com valores");

  const modelo = ok(await ctx.admin.from("modelos_checklist").insert({ nome: "Checklist MS específico" }).select().single());
  ok(await ctx.admin.from("modelos_checklist_itens").insert({ modelo_id: modelo.id, nome: "Negativa do plano por escrito", obrigatoriedade: "obrigatorio" }));
  const n = ok(await ctx.advogado.rpc("aplicar_checklist", { p_modelo: modelo.id, p_caso: ctx.caso2 }));
  assert.equal(n, 1);
  const repetido = ok(await ctx.advogado.rpc("aplicar_checklist", { p_modelo: modelo.id, p_caso: ctx.caso2 }));
  assert.equal(repetido, 0, "não duplica itens já aplicados");
});

test("automações: execução manual sem notificações duplicadas; auditoria restrita", async () => {
  const semPerm = await ctx.advogado.rpc("executar_automacoes_agora");
  assert.ok(semPerm.error);
  ok(await ctx.admin.rpc("executar_automacoes_agora"));
  const { count: antes } = await servico.from("notificacoes").select("*", { count: "exact", head: true });
  ok(await ctx.admin.rpc("executar_automacoes_agora"));
  const { count: depois } = await servico.from("notificacoes").select("*", { count: "exact", head: true });
  assert.equal(depois, antes, "sem duplicidade");

  const aud = ok(await ctx.admin.from("auditoria").select("tabela, acao").in("tabela", ["prazos", "pagamentos", "usuarios"]));
  assert.ok(aud.some((a) => a.tabela === "prazos") && aud.some((a) => a.tabela === "pagamentos"));
  const audAtendimento = ok(await ctx.atendimento.from("auditoria").select("id"));
  assert.equal(audAtendimento.length, 0);
});

test("relatórios e busca global respeitam permissões", async () => {
  const leads = ok(await ctx.admin.rpc("relatorio_leads", { p: {} }));
  assert.ok(leads.total >= 1 && leads.convertidos >= 1);
  const casos = ok(await ctx.admin.rpc("relatorio_casos", { p: {} }));
  assert.ok(casos.casos_total >= 3);
  const busca = ok(await ctx.atendimento.rpc("busca_global", { p_termo: "Paciente" }));
  assert.ok(busca.some((r) => r.tipo === "cliente"));
  const semRel = await ctx.atendimento.rpc("relatorio_leads", { p: {} });
  assert.ok(semRel.error, "atendimento sem relatorios.ver");
});

test("modo simplificado: cria e edita, mas não exclui (nem com permissão de exclusão)", async () => {
  contas.simplificado = { email: "simplificado@teste.local", senha: senha() };
  const r = await funcao("crm-admin", {
    acao: "criar_usuario", nome: "Usuário simplificado", email: contas.simplificado.email, senha: contas.simplificado.senha,
    perfil_id: "advogado", permissoes_extra: ["casos.excluir"], modo_simplificado: true,
  }, ctx.admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const id = r.corpo.id;
  const c = await entrar(contas.simplificado.email, contas.simplificado.senha);

  const perfil = ok(await c.rpc("meu_perfil"));
  assert.equal(perfil.modo_simplificado, true);
  assert.ok(!perfil.permissoes.some((p) => p.endsWith(".excluir")), "nenhuma permissão de exclusão");
  assert.ok(perfil.permissoes.includes("casos.editar") && perfil.permissoes.includes("tarefas.editar"));

  const tarefa = ok(await c.from("tarefas").insert({ titulo: "Conferir agenda", caso_id: ctx.caso2, responsavel_id: id }).select().single());
  ok(await c.from("tarefas").update({ titulo: "Conferir agenda da semana" }).eq("id", tarefa.id));
  const inicio = new Date(Date.now() + 26 * 3600_000).toISOString();
  const reuniao = ok(await c.from("compromissos").insert({ tipo: "reuniao", titulo: "Reunião de equipe", inicio, responsavel_id: id }).select().single());
  assert.equal(ok(await c.from("tarefas").delete().eq("id", tarefa.id).select("id")).length, 0, "tarefa não é excluída");
  assert.equal(ok(await c.from("compromissos").delete().eq("id", reuniao.id).select("id")).length, 0, "compromisso não é excluído");

  const desligar = await funcao("crm-admin", { acao: "atualizar_usuario", id, modo_simplificado: false }, ctx.admin.token);
  assert.equal(desligar.status, 200, JSON.stringify(desligar.corpo));
  assert.ok(ok(await c.rpc("meu_perfil")).permissoes.includes("casos.excluir"), "exceção volta a valer fora do modo");
  assert.equal(ok(await c.from("tarefas").delete().eq("id", tarefa.id).select("id")).length, 1, "fora do modo a exclusão volta a valer");
});

test("conta de desenvolvimento: exclui em cascata e dispensa as travas", async () => {
  contas.dev = { email: "dev@amadoeamadojr.com.br", senha: senha() };
  const r = await funcao("crm-admin", { acao: "criar_usuario", nome: "Desenvolvimento", email: contas.dev.email, senha: contas.dev.senha, perfil_id: "atendimento" }, ctx.admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const dev = await entrar(contas.dev.email, contas.dev.senha);
  const perfil = ok(await dev.rpc("meu_perfil"));
  assert.equal(perfil.desenvolvedor, true);
  assert.ok(perfil.permissoes.includes("clientes.excluir") && perfil.permissoes.includes("financeiro.contratos"), "todas as permissões, apesar do perfil");

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const amanha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 2 * 86400_000));
  const cli = ok(await dev.from("clientes").insert({ nome: "Cliente para excluir" }).select().single());
  ok(await dev.from("casos").insert({ cliente_id: cli.id, titulo: "Caso para excluir" }).select().single());
  const ct = await funcao("crm-financeiro", { acao: "criar_contrato", dados: { cliente_id: cli.id, valor_total: 1000, entrada: { valor: 0, data: null }, parcelas: { quantidade: 1, primeiro_vencimento: hoje }, forma_contratacao: "parcelado" } }, dev.token);
  assert.equal(ct.status, 200, JSON.stringify(ct.corpo));
  const [parcela] = ok(await dev.from("cobrancas").select("id").eq("contrato_id", ct.corpo.resultado.contrato_id));
  const futuro = await funcao("crm-financeiro", { acao: "registrar_pagamento", dados: { cobranca_id: parcela.id, valor: 1500, data_pagamento: amanha, forma: "pix" } }, dev.token);
  assert.equal(futuro.status, 200, "data futura e acima do saldo: " + JSON.stringify(futuro.corpo));
  const futuroAdmin = await funcao("crm-financeiro", { acao: "registrar_pagamento", dados: { cobranca_id: parcela.id, valor: 1, data_pagamento: amanha, forma: "pix" } }, ctx.admin.token);
  assert.equal(futuroAdmin.status, 400, "para as demais contas a trava continua");

  const bloqueado = await ctx.admin.from("clientes").delete().eq("id", cli.id);
  assert.equal(bloqueado.error?.code, "23503", "admin comum esbarra nos vínculos");
  const negado = await ctx.admin.rpc("dev_excluir", { p_tipo: "cliente", p_id: cli.id });
  assert.equal(negado.error?.code, "42501", "somente a conta de desenvolvimento");
  ok(await dev.rpc("dev_excluir", { p_tipo: "cliente", p_id: cli.id }));
  for (const tabela of ["clientes", "casos", "contratos", "cobrancas", "pagamentos"]) {
    const coluna = tabela === "clientes" ? "id" : "cliente_id";
    assert.equal(ok(await servico.from(tabela).select("id").eq(coluna, cli.id)).length, 0, `${tabela} apagados`);
  }

  const aud = ok(await dev.from("auditoria").select("id").limit(1).single());
  assert.equal((await ctx.admin.from("auditoria").delete().eq("id", aud.id).select("id")).data?.length ?? 0, 0, "admin comum não apaga auditoria");
  assert.equal(ok(await dev.from("auditoria").delete().eq("id", aud.id).select("id")).length, 1, "conta de desenvolvimento apaga auditoria");
  const outra = ok(await servico.from("cobrancas").select("id, cliente_id").limit(1).single());
  const direto = await ctx.admin.from("pagamentos").insert({ cobranca_id: outra.id, cliente_id: outra.cliente_id, valor: 1, data_pagamento: hoje, registrado_por: ctx.adminId });
  assert.equal(direto.error?.code, "42501", "escrita direta no financeiro segue bloqueada para as demais contas");
});

test("usuário desativado perde o acesso imediatamente", async () => {
  const r = await funcao("crm-admin", { acao: "atualizar_usuario", id: ctx.atendimentoId, ativo: false }, ctx.admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const leads = ok(await ctx.atendimento.from("leads").select("id"));
  assert.equal(leads.length, 0);
  const ultimoAdmin = await funcao("crm-admin", { acao: "atualizar_usuario", id: ctx.adminId, perfil_id: "advogado" }, ctx.admin.token);
  assert.equal(ultimoAdmin.status, 400, "mantém ao menos um administrador");
});
