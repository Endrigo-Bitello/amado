"use client";

import { AlertTriangle, Clock, FileWarning, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "../../_lib/auth";
import { colunasPersonalizadas, useSalvarValorPersonalizado, useValoresPersonalizados } from "../../_lib/campos";
import { colunaEtiquetas, colunaPrioridade, colunaResponsavel, opcoesEtapas, opcoesTiposDemanda, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarDataHora, situacaoVencimento } from "../../_lib/datas";
import { Link } from "../../_lib/rotas";
import type { Caso, Cliente, Processo } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { STATUS_CASO } from "./constantes";

export type CasoQuadro = Caso & {
  cliente: Pick<Cliente, "id" | "nome" | "codigo"> | null;
  processos: Pick<Processo, "id" | "numero" | "tribunal" | "principal" | "orgao" | "classe" | "situacao">[];
};

export interface PendenciasCaso {
  proximoPrazo: string | null;
  prazosVencidos: number;
  prazosAConferir: number;
  docsFaltantes: number;
}

export const NATUREZAS = [
  { valor: "interno", rotulo: "Caso interno", cor: "#6B746D" },
  { valor: "judicial", rotulo: "Processo judicial", cor: "#2B5A8A" },
];

export function processoPrincipal(c: Pick<CasoQuadro, "processos">) {
  return c.processos.find((p) => p.principal) ?? c.processos[0] ?? null;
}

/** Caso judicial sem nenhum número de processo cadastrado. */
export function semNumeroProcesso(c: Pick<CasoQuadro, "natureza" | "processos">) {
  return c.natureza === "judicial" && !c.processos.some((p) => p.numero);
}

export function useColunasCasos(
  salvar: (c: CasoQuadro, alt: Record<string, unknown>) => Promise<void>,
  pendencias: Map<string, PendenciasCaso>,
): ColunaQuadro<CasoQuadro>[] {
  const config = useConfig();
  const { pode } = useAuth();
  const podeEditar = pode("casos.editar");
  const valores = useValoresPersonalizados("caso");
  const salvarValor = useSalvarValorPersonalizado("caso");
  const ed = podeEditar ? salvar : undefined;

  return useMemo<ColunaQuadro<CasoQuadro>[]>(() => {
    const cols: ColunaQuadro<CasoQuadro>[] = [
      {
        id: "titulo",
        titulo: config.nome("caso"),
        tipo: "texto",
        valor: (c) => c.titulo,
        texto: (c) => `${c.titulo} ${c.codigo ?? ""} ${c.cliente?.nome ?? ""} ${c.processos.map((p) => p.numero ?? "").join(" ")}`,
        exibir: (c) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{c.titulo}</span>
            <span className="shrink-0 font-mono text-[10px] font-semibold text-crm-tinta-3">{c.codigo}</span>
          </span>
        ),
        editar: ed ? (c, v) => salvar(c, { titulo: v }) : undefined,
        largura: 280,
        obrigatoria: true,
      },
      {
        id: "cliente",
        titulo: config.nome("cliente"),
        tipo: "texto",
        valor: (c) => c.cliente?.nome ?? null,
        exibir: (c) =>
          c.cliente ? (
            <Link href={`/crm/clientes/${c.cliente.id}`} onClick={(e) => e.stopPropagation()} className="truncate text-crm-info hover:underline">
              {c.cliente.nome}
            </Link>
          ) : (
            "—"
          ),
        agrupavel: true,
        largura: 200,
      },
      {
        id: "natureza",
        titulo: "Natureza",
        tipo: "selecao",
        valor: (c) => c.natureza,
        opcoes: NATUREZAS,
        editar: ed ? (c, v) => salvar(c, { natureza: v ?? "interno" }) : undefined,
        agrupavel: true,
        largura: 150,
        descricao: "Caso interno (sem processo) ou processo judicial.",
      },
      {
        id: "tipo_demanda_id",
        titulo: "Tipo de demanda",
        tipo: "selecao",
        valor: (c) => c.tipo_demanda_id,
        opcoes: opcoesTiposDemanda(config),
        editar: ed ? (c, v) => salvar(c, { tipo_demanda_id: v }) : undefined,
        agrupavel: true,
        largura: 200,
      },
      {
        id: "fase_id",
        titulo: "Fase",
        tipo: "status",
        valor: (c) => c.fase_id,
        opcoes: opcoesEtapas(config, "caso"),
        editar: ed ? (c, v) => salvar(c, { fase_id: v }) : undefined,
        podeEditar: () => podeEditar,
        agrupavel: true,
        resumo: "distribuicao",
        largura: 210,
      },
      {
        id: "status",
        titulo: "Situação",
        tipo: "selecao",
        valor: (c) => c.status,
        opcoes: Object.entries(STATUS_CASO).map(([valor, s]) => ({ valor, rotulo: s.rotulo, cor: s.cor })),
        editar: ed ? (c, v) => salvar(c, { status: v ?? "ativo" }) : undefined,
        agrupavel: true,
        resumo: "distribuicao",
        largura: 120,
      },
      colunaResponsavel<CasoQuadro>(config, ed, "Advogado responsável"),
      {
        id: "equipe",
        titulo: "Equipe",
        tipo: "pessoas",
        valor: (c) => c.equipe,
        opcoes: opcoesUsuarios(config),
        editar: ed ? (c, v) => salvar(c, { equipe: (v as string[] | null) ?? [] }) : undefined,
        largura: 130,
      },
      {
        id: "processo",
        titulo: "Nº do processo",
        tipo: "texto",
        valor: (c) => processoPrincipal(c)?.numero ?? null,
        texto: (c) => c.processos.map((p) => p.numero ?? "sem número").join(", "),
        exibir: (c) => {
          const p = processoPrincipal(c);
          if (p?.numero)
            return (
              <span className="truncate tabular-nums" title={c.processos.length > 1 ? `${c.processos.length} processos vinculados` : undefined}>
                {p.numero}
                {c.processos.length > 1 && <span className="ml-1 text-[11px] text-crm-tinta-3">+{c.processos.length - 1}</span>}
              </span>
            );
          if (c.natureza === "judicial")
            return (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-alerta">
                <AlertTriangle size={13} aria-hidden /> Sem número
              </span>
            );
          return <span className="text-[13px] text-crm-tinta-3">Não se aplica</span>;
        },
        largura: 230,
      },
      {
        id: "tribunal",
        titulo: "Tribunal",
        tipo: "texto",
        valor: (c) => processoPrincipal(c)?.tribunal ?? null,
        agrupavel: true,
        largura: 110,
      },
      {
        id: "orgao",
        titulo: "Órgão / vara",
        tipo: "texto",
        valor: (c) => processoPrincipal(c)?.orgao ?? null,
        largura: 180,
        oculta: true,
      },
      {
        id: "proximo_prazo",
        titulo: "Próximo prazo",
        tipo: "data_hora",
        valor: (c) => pendencias.get(c.id)?.proximoPrazo ?? null,
        alertaVencimento: () => true,
        exibir: (c) => {
          const p = pendencias.get(c.id);
          if (!p?.proximoPrazo) return <span className="text-crm-tinta-3/70">—</span>;
          return (
            <span className="flex min-w-0 items-center gap-1.5">
              <DataPrazo valor={p.proximoPrazo} />
              {p.prazosAConferir > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-crm-alerta" title={`${p.prazosAConferir} prazo(s) a conferir`}>
                  <ShieldAlert size={12} aria-hidden />
                  <span className="sr-only">{p.prazosAConferir} a conferir</span>
                </span>
              )}
            </span>
          );
        },
        largura: 170,
        descricao: "Prazo processual pendente mais próximo (inclui vencidos).",
      },
      {
        id: "docs_faltantes",
        titulo: "Docs faltantes",
        tipo: "numero",
        valor: (c) => pendencias.get(c.id)?.docsFaltantes ?? 0,
        exibir: (c) => {
          const n = pendencias.get(c.id)?.docsFaltantes ?? 0;
          if (!n) return <span className="text-[13px] text-crm-tinta-3">Nenhum</span>;
          return (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-alerta">
              <FileWarning size={13} aria-hidden /> {n} {n === 1 ? "documento" : "documentos"}
            </span>
          );
        },
        alinhamento: "esquerda",
        largura: 140,
        descricao: "Documentos obrigatórios não recebidos ou rejeitados.",
      },
      colunaPrioridade<CasoQuadro>(config, ed),
      { id: "data_abertura", titulo: "Abertura", tipo: "data", valor: (c) => c.data_abertura, editar: ed ? (c, v) => salvar(c, { data_abertura: v }) : undefined, largura: 120 },
      { id: "data_protocolo", titulo: "Protocolo", tipo: "data", valor: (c) => c.data_protocolo, editar: ed ? (c, v) => salvar(c, { data_protocolo: v }) : undefined, largura: 120 },
      { id: "fase_alterada_em", titulo: "Na fase desde", tipo: "data_hora", valor: (c) => c.fase_alterada_em, largura: 150, oculta: true },
      { id: "data_encerramento", titulo: "Encerramento", tipo: "data", valor: (c) => c.data_encerramento, largura: 120, oculta: true },
      { id: "valor_causa", titulo: "Valor da causa", tipo: "moeda", valor: (c) => c.valor_causa, editar: ed ? (c, v) => salvar(c, { valor_causa: v }) : undefined, alinhamento: "direita", largura: 140, oculta: true },
      { id: "segredo_justica", titulo: "Segredo de justiça", tipo: "checkbox", valor: (c) => c.segredo_justica, editar: ed ? (c, v) => salvar(c, { segredo_justica: Boolean(v) }) : undefined, largura: 110, oculta: true, agrupavel: true },
      colunaEtiquetas<CasoQuadro>(config, "caso", ed),
    ];
    return [...cols, ...colunasPersonalizadas<CasoQuadro>(config.camposDe("caso"), valores.data, salvarValor, podeEditar)];
  }, [config, ed, salvar, pendencias, valores.data, salvarValor, podeEditar]);
}

export function DataPrazo({ valor }: { valor: string }) {
  const situacao = situacaoVencimento(valor);
  const texto = formatarDataHora(valor);
  if (situacao === "vencido")
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-crm-perigo" title="Vencido">
        <AlertTriangle size={13} aria-hidden />
        <span className="tabular-nums">{texto}</span>
        <span className="sr-only">(vencido)</span>
      </span>
    );
  if (situacao === "hoje")
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-crm-alerta" title="Vence hoje">
        <Clock size={13} aria-hidden />
        <span className="tabular-nums">{texto}</span>
        <span className="sr-only">(vence hoje)</span>
      </span>
    );
  return <span className="tabular-nums">{texto}</span>;
}
