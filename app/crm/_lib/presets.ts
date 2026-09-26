"use client";

import { fimDiaSP, hojeSP, inicioDiaSP } from "./datas";

// Filtros "do painel": o mesmo critério é usado para CONTAR no painel Hoje e
// para LISTAR no quadro correspondente (garante que o número bate com a lista).

export interface ContextoPreset {
  usuarioId: string;
  somenteMeus: boolean;
  etapaInicialLead: string | null;
  etapasLeadAbertas: string[];
  horasSemRetorno: number;
  diasPrazosProximos: number;
}

// Construtor de consultas do PostgREST (tipagem mínima necessária aqui).
export interface Consulta {
  eq(coluna: string, valor: unknown): Consulta;
  neq(coluna: string, valor: unknown): Consulta;
  in(coluna: string, valores: unknown[]): Consulta;
  not(coluna: string, operador: string, valor: unknown): Consulta;
  is(coluna: string, valor: null | boolean): Consulta;
  gte(coluna: string, valor: unknown): Consulta;
  lte(coluna: string, valor: unknown): Consulta;
  lt(coluna: string, valor: unknown): Consulta;
  gt(coluna: string, valor: unknown): Consulta;
  or(filtros: string): Consulta;
}

export interface Preset {
  id: string;
  rotulo: string;
  descricao: (c: ContextoPreset) => string;
  tabela: "leads" | "tarefas" | "prazos" | "compromissos" | "documentos" | "casos" | "v_cobrancas";
  destino: (c: ContextoPreset) => string;
  aplicar: (q: Consulta, c: ContextoPreset) => Consulta;
  tom: "neutro" | "alerta" | "perigo" | "verde";
  permissao?: string;
}

const agora = () => new Date().toISOString();

const destino = (base: string, id: string, c: ContextoPreset) => `${base}${base.includes("?") ? "&" : "?"}preset=${id}${c.somenteMeus ? "&meus=1" : ""}`;

export const PRESETS: Record<string, Preset> = {
  novos_leads: {
    id: "novos_leads",
    rotulo: "Novos leads",
    descricao: () => "Leads na etapa inicial do funil, aguardando triagem.",
    tabela: "leads",
    tom: "verde",
    permissao: "leads.ver",
    destino: (c) => destino("/crm/leads", "novos_leads", c),
    aplicar: (q, c) => {
      let r = q.eq("etapa_id", c.etapaInicialLead ?? "00000000-0000-0000-0000-000000000000").is("arquivado_em", null).is("mesclado_em_id", null);
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  leads_sem_retorno: {
    id: "leads_sem_retorno",
    rotulo: "Leads sem retorno",
    descricao: (c) => `Sem primeiro contato há mais de ${c.horasSemRetorno} h ou com a próxima ação atrasada.`,
    tabela: "leads",
    tom: "alerta",
    permissao: "leads.ver",
    destino: (c) => destino("/crm/leads", "leads_sem_retorno", c),
    aplicar: (q, c) => {
      const limite = new Date(Date.now() - c.horasSemRetorno * 3600_000).toISOString();
      let r = q
        .in("etapa_id", c.etapasLeadAbertas.length ? c.etapasLeadAbertas : ["00000000-0000-0000-0000-000000000000"])
        .is("arquivado_em", null)
        .is("mesclado_em_id", null)
        .or(`and(primeiro_contato_em.is.null,created_at.lt.${limite}),proxima_acao_em.lt.${agora()}`);
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  tarefas_hoje: {
    id: "tarefas_hoje",
    rotulo: "Tarefas de hoje",
    descricao: () => "Tarefas abertas com prazo para hoje.",
    tabela: "tarefas",
    tom: "neutro",
    destino: (c) => destino("/crm/tarefas", "tarefas_hoje", c),
    aplicar: (q, c) => {
      let r = q.not("status", "in", "(concluida,cancelada)").is("arquivado_em", null).gte("prazo", inicioDiaSP(hojeSP())).lte("prazo", fimDiaSP(hojeSP()));
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  tarefas_atrasadas: {
    id: "tarefas_atrasadas",
    rotulo: "Tarefas atrasadas",
    descricao: () => "Tarefas abertas com prazo já vencido.",
    tabela: "tarefas",
    tom: "perigo",
    destino: (c) => destino("/crm/tarefas", "tarefas_atrasadas", c),
    aplicar: (q, c) => {
      let r = q.not("status", "in", "(concluida,cancelada)").is("arquivado_em", null).lt("prazo", agora());
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  prazos_proximos: {
    id: "prazos_proximos",
    rotulo: "Prazos próximos",
    descricao: (c) => `Prazos pendentes que vencem nos próximos ${c.diasPrazosProximos} dias.`,
    tabela: "prazos",
    tom: "alerta",
    permissao: "prazos.ver",
    destino: (c) => destino("/crm/casos?aba=prazos", "prazos_proximos", c),
    aplicar: (q, c) => {
      let r = q.eq("status", "pendente").gte("vencimento", agora()).lte("vencimento", new Date(Date.now() + c.diasPrazosProximos * 86400_000).toISOString());
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  prazos_vencidos: {
    id: "prazos_vencidos",
    rotulo: "Prazos vencidos",
    descricao: () => "Prazos pendentes cujo vencimento já passou (sem cumprimento registrado).",
    tabela: "prazos",
    tom: "perigo",
    permissao: "prazos.ver",
    destino: (c) => destino("/crm/casos?aba=prazos", "prazos_vencidos", c),
    aplicar: (q, c) => {
      let r = q.eq("status", "pendente").lt("vencimento", agora());
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  prazos_nao_conferidos: {
    id: "prazos_nao_conferidos",
    rotulo: "Prazos a conferir",
    descricao: () => "Prazos pendentes ainda não conferidos por profissional habilitado.",
    tabela: "prazos",
    tom: "alerta",
    permissao: "prazos.ver",
    destino: (c) => destino("/crm/casos?aba=prazos", "prazos_nao_conferidos", c),
    aplicar: (q, c) => {
      let r = q.eq("status", "pendente").eq("conferido", false);
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  reunioes_hoje: {
    id: "reunioes_hoje",
    rotulo: "Compromissos de hoje",
    descricao: () => "Reuniões, audiências e compromissos agendados para hoje.",
    tabela: "compromissos",
    tom: "neutro",
    destino: (c) => destino("/crm/agenda?modo=dia", "reunioes_hoje", c),
    aplicar: (q, c) => {
      let r = q.in("status", ["agendado", "remarcado"]).gte("inicio", inicioDiaSP(hojeSP())).lte("inicio", fimDiaSP(hojeSP()));
      if (c.somenteMeus) r = r.or(`responsavel_id.eq.${c.usuarioId},participantes.cs.{${c.usuarioId}}`);
      return r;
    },
  },
  documentos_faltantes: {
    id: "documentos_faltantes",
    rotulo: "Documentos faltantes",
    descricao: () => "Documentos obrigatórios ainda não recebidos (não solicitados, solicitados ou rejeitados).",
    tabela: "documentos",
    tom: "alerta",
    permissao: "documentos.ver",
    destino: (c) => destino("/crm/documentos", "documentos_faltantes", c),
    aplicar: (q, c) => {
      let r = q.eq("obrigatorio", true).in("status", ["nao_solicitado", "solicitado", "rejeitado"]);
      if (c.somenteMeus) r = r.eq("revisor_id", c.usuarioId);
      return r;
    },
  },
  documentos_revisar: {
    id: "documentos_revisar",
    rotulo: "Documentos para revisar",
    descricao: () => "Documentos recebidos aguardando revisão.",
    tabela: "documentos",
    tom: "neutro",
    permissao: "documentos.ver",
    destino: (c) => destino("/crm/documentos", "documentos_revisar", c),
    aplicar: (q, c) => {
      let r = q.in("status", ["recebido", "em_revisao"]);
      if (c.somenteMeus) r = r.eq("revisor_id", c.usuarioId);
      return r;
    },
  },
  casos_ativos: {
    id: "casos_ativos",
    rotulo: "Casos ativos",
    descricao: () => "Casos e processos em andamento.",
    tabela: "casos",
    tom: "verde",
    permissao: "casos.ver",
    destino: (c) => destino("/crm/casos", "casos_ativos", c),
    aplicar: (q, c) => {
      let r = q.eq("status", "ativo").is("arquivado_em", null);
      if (c.somenteMeus) r = r.eq("responsavel_id", c.usuarioId);
      return r;
    },
  },
  pagamentos_vencidos: {
    id: "pagamentos_vencidos",
    rotulo: "Pagamentos vencidos",
    descricao: () => "Parcelas de honorários ou reembolsos vencidas e não quitadas.",
    tabela: "v_cobrancas",
    tom: "perigo",
    permissao: "financeiro.ver",
    destino: () => "/crm/financeiro?preset=pagamentos_vencidos",
    aplicar: (q) => q.eq("situacao", "vencido"),
  },
};
