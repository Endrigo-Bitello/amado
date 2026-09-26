"use client";

import { Flame, Snowflake, Sun } from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "../../_lib/auth";
import { colunasPersonalizadas, useSalvarValorPersonalizado, useValoresPersonalizados } from "../../_lib/campos";
import { colunaEtiquetas, colunaPrioridade, colunaResponsavel, opcoesEtapas, opcoesLista, opcoesTiposDemanda } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarRelativo } from "../../_lib/datas";
import type { Lead } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";

export const TEMPERATURAS = [
  { valor: "quente", rotulo: "Quente", cor: "#B5532F", icone: <Flame size={12} aria-hidden /> },
  { valor: "morno", rotulo: "Morno", cor: "#C9822B", icone: <Sun size={12} aria-hidden /> },
  { valor: "frio", rotulo: "Frio", cor: "#3E5C8A", icone: <Snowflake size={12} aria-hidden /> },
];

export function useColunasLeads(
  salvar: (lead: Lead, alteracoes: Record<string, unknown>) => Promise<void>,
  mudarEtapa: (lead: Lead, etapaId: string | null) => Promise<void>,
): ColunaQuadro<Lead>[] {
  const config = useConfig();
  const { pode } = useAuth();
  const podeEditar = pode("leads.editar");
  const valores = useValoresPersonalizados("lead");
  const salvarValor = useSalvarValorPersonalizado("lead");
  const ed = podeEditar ? salvar : undefined;

  return useMemo<ColunaQuadro<Lead>[]>(() => {
    const cols: ColunaQuadro<Lead>[] = [
      {
        id: "nome",
        titulo: "Nome",
        tipo: "texto",
        valor: (l) => l.nome,
        texto: (l) => `${l.nome} ${l.codigo ?? ""}`,
        exibir: (l) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{l.nome}</span>
            <span className="shrink-0 font-mono text-[10px] font-semibold text-crm-tinta-3">{l.codigo}</span>
            {l.cliente_id && <span className="shrink-0 rounded bg-crm-verde-claro px-1 text-[10px] font-bold text-crm-verde">cliente</span>}
          </span>
        ),
        editar: ed ? (l, v) => salvar(l, { nome: v }) : undefined,
        largura: 280,
        obrigatoria: true,
        agrupavel: false,
      },
      {
        id: "etapa_id",
        titulo: "Etapa",
        tipo: "status",
        valor: (l) => l.etapa_id,
        opcoes: opcoesEtapas(config, "lead"),
        editar: podeEditar ? (l, v) => mudarEtapa(l, v as string | null) : undefined,
        agrupavel: true,
        largura: 170,
        resumo: "distribuicao",
      },
      colunaResponsavel<Lead>(config, ed),
      {
        id: "whatsapp",
        titulo: "WhatsApp",
        tipo: "telefone",
        valor: (l) => l.whatsapp,
        editar: ed ? (l, v) => salvar(l, { whatsapp: v }) : undefined,
        largura: 170,
      },
      {
        id: "temperatura",
        titulo: "Temperatura",
        tipo: "selecao",
        valor: (l) => l.temperatura,
        opcoes: TEMPERATURAS.map((t) => ({ valor: t.valor, rotulo: t.rotulo, cor: t.cor, icone: t.icone })),
        editar: ed ? (l, v) => salvar(l, { temperatura: v }) : undefined,
        agrupavel: true,
        largura: 120,
      },
      {
        id: "proxima_acao",
        titulo: "Próxima ação",
        tipo: "texto",
        valor: (l) => l.proxima_acao,
        editar: ed ? (l, v) => salvar(l, { proxima_acao: v }) : undefined,
        largura: 200,
      },
      {
        id: "proxima_acao_em",
        titulo: "Data da próxima ação",
        tipo: "data_hora",
        valor: (l) => l.proxima_acao_em,
        editar: ed ? (l, v) => salvar(l, { proxima_acao_em: v }) : undefined,
        alertaVencimento: (l) => config.etapa(l.etapa_id)?.categoria === "aberta",
        largura: 170,
      },
      {
        id: "primeiro_contato_em",
        titulo: "1º contato",
        tipo: "data_hora",
        valor: (l) => l.primeiro_contato_em,
        exibir: (l) =>
          l.primeiro_contato_em ? (
            <span className="tabular-nums">{formatarRelativo(l.primeiro_contato_em)}</span>
          ) : config.etapa(l.etapa_id)?.categoria === "aberta" ? (
            <span className="font-semibold text-crm-alerta">Sem contato ainda</span>
          ) : (
            <span className="text-crm-tinta-3">—</span>
          ),
        largura: 140,
        descricao: "Registrado automaticamente quando um contato é lançado no histórico.",
      },
      {
        id: "origem",
        titulo: "Origem",
        tipo: "selecao",
        valor: (l) => l.origem,
        opcoes: opcoesLista(config, "origem"),
        editar: ed ? (l, v) => salvar(l, { origem: v ?? "manual" }) : undefined,
        agrupavel: true,
        largura: 140,
      },
      {
        id: "tipo_demanda_id",
        titulo: "Tipo de demanda",
        tipo: "selecao",
        valor: (l) => l.tipo_demanda_id,
        opcoes: opcoesTiposDemanda(config),
        editar: ed ? (l, v) => salvar(l, { tipo_demanda_id: v }) : undefined,
        agrupavel: true,
        largura: 220,
      },
      colunaPrioridade<Lead>(config, ed),
      { id: "created_at", titulo: "Entrada", tipo: "data_hora", valor: (l) => l.created_at, largura: 150 },
      { id: "estado", titulo: "UF", tipo: "texto", valor: (l) => l.estado, editar: ed ? (l, v) => salvar(l, { estado: v }) : undefined, largura: 70, agrupavel: true },
      { id: "municipio", titulo: "Município", tipo: "texto", valor: (l) => l.municipio, editar: ed ? (l, v) => salvar(l, { municipio: v }) : undefined, largura: 150 },
      { id: "email", titulo: "E-mail", tipo: "email", valor: (l) => l.email, editar: ed ? (l, v) => salvar(l, { email: v }) : undefined, largura: 200, oculta: true },
      { id: "score", titulo: "Pontuação do quiz", tipo: "numero", valor: (l) => l.score, largura: 110, alinhamento: "direita", oculta: true },
      { id: "quiz_cultiva", titulo: "Já cultiva?", tipo: "texto", valor: (l) => l.quiz_cultiva, largura: 170, oculta: true, agrupavel: true },
      { id: "quiz_consulta_medica", titulo: "Consulta médica?", tipo: "texto", valor: (l) => l.quiz_consulta_medica, largura: 220, oculta: true, agrupavel: true },
      { id: "profissao", titulo: "Profissão", tipo: "texto", valor: (l) => l.profissao, editar: ed ? (l, v) => salvar(l, { profissao: v }) : undefined, largura: 150, oculta: true },
      { id: "faixa_renda", titulo: "Faixa de renda", tipo: "texto", valor: (l) => l.faixa_renda, largura: 170, oculta: true, agrupavel: true },
      { id: "quiz_motivacao", titulo: "Motivação", tipo: "texto", valor: (l) => l.quiz_motivacao, largura: 260, oculta: true, agrupavel: true },
      { id: "quiz_agenda", titulo: "Disponibilidade", tipo: "texto", valor: (l) => l.quiz_agenda, largura: 220, oculta: true, agrupavel: true },
      { id: "quiz_horario", titulo: "Horário preferido", tipo: "texto", valor: (l) => l.quiz_horario, largura: 220, oculta: true },
      {
        id: "motivo_perda",
        titulo: "Motivo da perda",
        tipo: "selecao",
        valor: (l) => l.motivo_perda,
        opcoes: opcoesLista(config, "motivo_perda"),
        largura: 190,
        oculta: true,
        agrupavel: true,
      },
      { id: "utm_source", titulo: "UTM origem", tipo: "texto", valor: (l) => l.utm_source, largura: 130, oculta: true, agrupavel: true },
      { id: "utm_campaign", titulo: "UTM campanha", tipo: "texto", valor: (l) => l.utm_campaign, largura: 150, oculta: true, agrupavel: true },
      { id: "ultima_atividade_em", titulo: "Última atividade", tipo: "data_hora", valor: (l) => l.ultima_atividade_em, largura: 150, oculta: true },
      colunaEtiquetas<Lead>(config, "lead", ed),
    ];
    return [...cols, ...colunasPersonalizadas<Lead>(config.camposDe("lead"), valores.data, salvarValor, podeEditar)];
  }, [config, podeEditar, valores.data, salvarValor, salvar, mudarEtapa, ed]);
}
