"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileWarning, Gavel, Lock, ShieldAlert, Users, Wallet } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useAuth } from "../../_lib/auth";
import { opcoesLista, opcoesTiposDemanda, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { fimMes, formatarData, hojeSP, inicioMes, lerYmd, somarDias, somarMeses } from "../../_lib/datas";
import { executar, mensagemErro } from "../../_lib/dados";
import { formatarMoeda, formatarNumero } from "../../_lib/formatos";
import { Link, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import { Abas } from "../../_ui/Abas";
import { Botao } from "../../_ui/Botao";
import { Entrada, Selecao } from "../../_ui/Campos";
import { CabecalhoPagina, Carregando, ErroCarga, Vazio } from "../../_ui/Visuais";
import { BarrasHorizontais, CartaoGrafico, Colunas, FaixasOrdenadas, Indicador } from "./Graficos";

// ---------------------------------------------------------------------------
// Filtros (uma linha, acima de tudo o que filtram; ficam na URL)
// ---------------------------------------------------------------------------

const PERIODOS: { id: string; rotulo: string }[] = [
  { id: "7d", rotulo: "Últimos 7 dias" },
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "90d", rotulo: "Últimos 90 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_anterior", rotulo: "Mês anterior" },
  { id: "ano", rotulo: "Este ano" },
  { id: "personalizado", rotulo: "Personalizado…" },
];

function intervalo(periodo: string, inicio: string | null, fim: string | null): { inicio: string; fim: string } {
  const hoje = hojeSP();
  switch (periodo) {
    case "7d":
      return { inicio: somarDias(hoje, -6), fim: hoje };
    case "90d":
      return { inicio: somarDias(hoje, -89), fim: hoje };
    case "mes":
      return { inicio: inicioMes(hoje), fim: hoje };
    case "mes_anterior": {
      const ref = somarMeses(inicioMes(hoje), -1);
      return { inicio: ref, fim: fimMes(ref) };
    }
    case "ano":
      return { inicio: `${lerYmd(hoje).ano}-01-01`, fim: hoje };
    case "personalizado":
      return { inicio: inicio ?? somarDias(hoje, -29), fim: fim ?? hoje };
    default:
      return { inicio: somarDias(hoje, -29), fim: hoje };
  }
}

function useFiltros() {
  const { parametro, definirParametros } = useRota();
  const periodo = parametro("periodo") ?? "30d";
  const { inicio, fim } = intervalo(periodo, parametro("inicio"), parametro("fim"));
  const origem = parametro("origem");
  const resp = parametro("resp");
  const tipo = parametro("tipo");
  const p = useMemo(() => ({ inicio, fim, origem: origem ?? "", responsavel_id: resp ?? "", tipo_demanda_id: tipo ?? "" }), [inicio, fim, origem, resp, tipo]);
  return { periodo, inicio, fim, origem, resp, tipo, p, definir: (alt: Record<string, string | null>) => definirParametros(alt, { substituir: true }) };
}

type Filtros = ReturnType<typeof useFiltros>;

function BarraFiltros({ f }: { f: Filtros }) {
  const config = useConfig();
  const invalido = f.periodo === "personalizado" && f.fim < f.inicio;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-crm-linha bg-white p-3" role="group" aria-label="Filtros dos relatórios">
      <label className="flex min-w-[170px] flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
        Período
        <Selecao value={f.periodo} onChange={(e) => f.definir({ periodo: e.target.value === "30d" ? null : e.target.value, ...(e.target.value === "personalizado" ? { inicio: f.inicio, fim: f.fim } : { inicio: null, fim: null }) })}>
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </Selecao>
      </label>
      {f.periodo === "personalizado" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
            De
            <Entrada type="date" value={f.inicio} max={f.fim} onChange={(e) => e.target.value && f.definir({ inicio: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
            Até
            <Entrada type="date" value={f.fim} min={f.inicio} onChange={(e) => e.target.value && f.definir({ fim: e.target.value })} />
          </label>
        </>
      )}
      <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-semibold text-crm-tinta-2 sm:max-w-[220px]">
        Origem
        <Selecao value={f.origem ?? ""} onChange={(e) => f.definir({ origem: e.target.value || null })}>
          <option value="">Todas</option>
          {opcoesLista(config, "origem").map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Selecao>
      </label>
      <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-semibold text-crm-tinta-2 sm:max-w-[220px]">
        Responsável
        <Selecao value={f.resp ?? ""} onChange={(e) => f.definir({ resp: e.target.value || null })}>
          <option value="">Toda a equipe</option>
          {opcoesUsuarios(config).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Selecao>
      </label>
      <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-semibold text-crm-tinta-2 sm:max-w-[260px]">
        Tipo de demanda
        <Selecao value={f.tipo ?? ""} onChange={(e) => f.definir({ tipo: e.target.value || null })}>
          <option value="">Todos</option>
          {opcoesTiposDemanda(config).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Selecao>
      </label>
      {(f.origem || f.resp || f.tipo || f.periodo !== "30d") && (
        <Botao tamanho="sm" variante="fantasma" onClick={() => f.definir({ periodo: null, inicio: null, fim: null, origem: null, resp: null, tipo: null })}>
          Limpar filtros
        </Botao>
      )}
      <p className="w-full text-xs text-crm-tinta-3" aria-live="polite">
        {invalido ? (
          <span className="font-semibold text-crm-perigo">A data final deve ser posterior à inicial.</span>
        ) : (
          <>
            Período: {formatarData(f.inicio)} a {formatarData(f.fim)} (horário de Brasília). Os números consideram apenas os dados que o seu perfil pode ver.
          </>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function Relatorios() {
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const f = useFiltros();
  const abas = [
    { id: "leads", rotulo: "Leads e conversão" },
    { id: "casos", rotulo: "Clientes e casos" },
    { id: "produtividade", rotulo: "Produtividade" },
    ...(pode("prazos.ver") ? [{ id: "prazos", rotulo: "Prazos" }] : []),
    ...(pode("documentos.ver") ? [{ id: "documentos", rotulo: "Pendências documentais" }] : []),
    ...(pode("financeiro.ver") ? [{ id: "financeiro", rotulo: "Financeiro" }] : []),
  ];
  const aba = abas.some((a) => a.id === parametro("aba")) ? parametro("aba")! : "leads";

  if (!pode("relatorios.ver")) {
    return (
      <div className="p-6">
        <Vazio icone={<Lock size={24} />} titulo="Acesso restrito" descricao="Seu perfil não tem acesso aos relatórios gerenciais." />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina icone={<BarChart3 size={20} />} titulo="Relatórios" subtitulo="Indicadores do escritório por período, origem, responsável e tipo de demanda." />
      <BarraFiltros f={f} />
      <Abas abas={abas} ativa={aba} aoTrocar={(a) => definirParametros({ aba: a === "leads" ? null : a }, { substituir: true })} rotulo="Relatórios disponíveis" />
      <div role="tabpanel">
        {aba === "leads" && <RelatorioLeads f={f} />}
        {aba === "casos" && <RelatorioCasos f={f} />}
        {aba === "produtividade" && <RelatorioProdutividade f={f} />}
        {aba === "prazos" && <RelatorioPrazos f={f} />}
        {aba === "documentos" && <RelatorioDocumentos f={f} />}
        {aba === "financeiro" && <RelatorioFinanceiro f={f} />}
      </div>
    </div>
  );
}

function useRelatorio<T>(nome: string, f: Filtros) {
  return useQuery({
    queryKey: ["relatorios", nome, f.p],
    enabled: f.fim >= f.inicio,
    placeholderData: keepPreviousData,
    queryFn: async () => (await executar(supabase().rpc(nome as never, { p: f.p } as never) as never)) as T,
  });
}

function Estado({ consulta, children }: { consulta: { isLoading: boolean; error: unknown; data: unknown; refetch: () => void }; children: () => ReactNode }) {
  if (consulta.isLoading && !consulta.data) return <Carregando texto="Calculando indicadores…" />;
  if (consulta.error && !consulta.data) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  if (!consulta.data) return null;
  return <>{children()}</>;
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const horas = (h: number | null) => (h === null || h === undefined ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${formatarNumero(h)} h` : `${formatarNumero(Math.round((h / 24) * 10) / 10)} dias`);
const semRotulo = (r: string | null | undefined, padrao: string) => (r && r !== "—" ? r : padrao);
const rotuloSemana = (s: string) => {
  const { dia, mes } = lerYmd(s);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  return `${MESES[mm - 1]}/${String(a).slice(2)}`;
};
const moedaCompacta = (n: number) => (n >= 1_000_000 ? `R$ ${formatarNumero(Math.round(n / 100_000) / 10)} mi` : n >= 1000 ? `R$ ${formatarNumero(Math.round(n / 100) / 10)} mil` : formatarMoeda(n));

// ---------------------------------------------------------------------------
// Leads e conversão
// ---------------------------------------------------------------------------

interface RelLeads {
  total: number;
  convertidos: number;
  perdidos: number;
  em_aberto: number;
  por_etapa: { rotulo: string; cor: string; total: number }[];
  por_origem: { chave: string; rotulo: string; total: number; convertidos: number }[];
  por_responsavel: { id: string | null; rotulo: string | null; total: number; convertidos: number }[];
  motivos_perda: { chave: string | null; rotulo: string | null; total: number }[];
  por_semana: { semana: string; total: number; convertidos: number }[];
  primeiro_contato: { com_contato: number; sem_contato: number; media_horas: number | null; mediana_horas: number | null; ate_1h: number; ate_24h: number; mais_24h: number };
}

function RelatorioLeads({ f }: { f: Filtros }) {
  const consulta = useRelatorio<RelLeads>("relatorio_leads", f);
  const atualizando = consulta.isFetching && !consulta.isLoading;
  return (
    <Estado consulta={consulta}>
      {() => {
        const r = consulta.data!;
        const pc = r.primeiro_contato;
        return (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Leads no período" valor={formatarNumero(r.total)} icone={<Users size={14} aria-hidden />} />
              <Indicador rotulo="Convertidos em clientes" valor={formatarNumero(r.convertidos)} detalhe={`Taxa de conversão: ${pct(r.convertidos, r.total)}`} tom="sucesso" icone={<CheckCircle2 size={14} aria-hidden />} />
              <Indicador rotulo="Em atendimento" valor={formatarNumero(r.em_aberto)} detalhe={`${pct(r.em_aberto, r.total)} do total`} />
              <Indicador rotulo="Não convertidos" valor={formatarNumero(r.perdidos)} detalhe={`${pct(r.perdidos, r.total)} do total`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <CartaoGrafico
                titulo="Entradas e conversões por semana"
                descricao="Leads criados em cada semana (início na segunda-feira) e quantos deles já foram convertidos."
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "leads-por-semana",
                  linhas: r.por_semana,
                  colunas: [
                    { titulo: "Semana de", valor: (x) => formatarData(x.semana) },
                    { titulo: "Leads", valor: (x) => x.total, numerico: true },
                    { titulo: "Convertidos", valor: (x) => x.convertidos, numerico: true },
                    { titulo: "Conversão", valor: (x) => pct(x.convertidos, x.total), numerico: true },
                  ],
                }}
              >
                <Colunas
                  series={[
                    { id: "total", rotulo: "Leads" },
                    { id: "convertidos", rotulo: "Convertidos" },
                  ]}
                  pontos={r.por_semana.map((s) => ({ chave: s.semana, rotulo: rotuloSemana(s.semana), rotuloLongo: `Semana de ${formatarData(s.semana)}`, valores: { total: s.total, convertidos: s.convertidos } }))}
                />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Tempo até o primeiro contato"
                descricao={`Média ${horas(pc.media_horas)} · mediana ${horas(pc.mediana_horas)} · ${formatarNumero(pc.com_contato)} lead(s) com contato registrado.`}
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "primeiro-contato",
                  linhas: [
                    { faixa: "Até 1 hora", n: pc.ate_1h },
                    { faixa: "De 1 a 24 horas", n: pc.ate_24h },
                    { faixa: "Mais de 24 horas", n: pc.mais_24h },
                    { faixa: "Sem contato registrado", n: pc.sem_contato },
                  ],
                  colunas: [
                    { titulo: "Faixa", valor: (x) => x.faixa },
                    { titulo: "Leads", valor: (x) => x.n, numerico: true },
                  ],
                }}
              >
                <FaixasOrdenadas
                  unidade="leads"
                  itens={[
                    { rotulo: "Até 1 hora", valor: pc.ate_1h },
                    { rotulo: "De 1 a 24 horas", valor: pc.ate_24h },
                    { rotulo: "Mais de 24 horas", valor: pc.mais_24h },
                    { rotulo: "Sem contato registrado", valor: pc.sem_contato },
                  ]}
                />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Leads por origem"
                descricao="Quantidade de leads por canal de entrada; a conversão de cada canal aparece ao passar o mouse e na tabela."
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "leads-por-origem",
                  linhas: r.por_origem,
                  colunas: [
                    { titulo: "Origem", valor: (x) => semRotulo(x.rotulo, "Não informada") },
                    { titulo: "Leads", valor: (x) => x.total, numerico: true },
                    { titulo: "Convertidos", valor: (x) => x.convertidos, numerico: true },
                    { titulo: "Conversão", valor: (x) => pct(x.convertidos, x.total), numerico: true },
                  ],
                }}
              >
                <BarrasHorizontais
                  unidade="leads"
                  itens={r.por_origem.map((o) => ({ chave: o.chave ?? "sem", rotulo: semRotulo(o.rotulo, "Não informada"), valor: o.total, detalhe: `${o.convertidos} convertido(s) — ${pct(o.convertidos, o.total)}` }))}
                />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Leads por etapa atual"
                descricao="Onde estão hoje os leads que entraram no período."
                atualizando={atualizando}
                tabela={{ nomeArquivo: "leads-por-etapa", linhas: r.por_etapa, colunas: [{ titulo: "Etapa", valor: (x) => x.rotulo }, { titulo: "Leads", valor: (x) => x.total, numerico: true }] }}
              >
                <BarrasHorizontais unidade="leads" ordenar={false} maxItens={20} itens={r.por_etapa.map((e) => ({ chave: e.rotulo, rotulo: e.rotulo, valor: e.total }))} />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Conversão por responsável"
                atualizando={atualizando}
                somenteTabela
                tabela={{
                  nomeArquivo: "leads-por-responsavel",
                  linhas: r.por_responsavel,
                  colunas: [
                    { titulo: "Responsável", valor: (x) => semRotulo(x.rotulo, "Sem responsável") },
                    { titulo: "Leads", valor: (x) => x.total, numerico: true },
                    { titulo: "Convertidos", valor: (x) => x.convertidos, numerico: true },
                    { titulo: "Conversão", valor: (x) => pct(x.convertidos, x.total), numerico: true },
                  ],
                }}
              />
              <CartaoGrafico
                titulo="Motivos de não conversão"
                atualizando={atualizando}
                tabela={{ nomeArquivo: "motivos-perda", linhas: r.motivos_perda, colunas: [{ titulo: "Motivo", valor: (x) => semRotulo(x.rotulo, "Não informado") }, { titulo: "Leads", valor: (x) => x.total, numerico: true }] }}
              >
                <BarrasHorizontais unidade="leads" vazio="Nenhum lead não convertido no período." itens={r.motivos_perda.map((m) => ({ chave: m.chave ?? "sem", rotulo: semRotulo(m.rotulo, "Não informado"), valor: m.total }))} />
              </CartaoGrafico>
            </div>
          </div>
        );
      }}
    </Estado>
  );
}

// ---------------------------------------------------------------------------
// Clientes e casos
// ---------------------------------------------------------------------------

interface RelCasos {
  clientes_total: number;
  clientes_novos: number;
  clientes_por_origem: { chave: string; rotulo: string; total: number }[];
  casos_total: number;
  ativos: number;
  suspensos: number;
  concluidos: number;
  judiciais: number;
  internos: number;
  sem_numero: number;
  abertos_periodo: number;
  concluidos_periodo: number;
  por_fase: { rotulo: string; cor: string | null; total: number }[];
  por_tipo: { rotulo: string; cor: string | null; total: number }[];
  por_responsavel: { id: string | null; rotulo: string | null; total: number; ativos: number }[];
  por_tribunal: { rotulo: string; total: number }[];
}

function RelatorioCasos({ f }: { f: Filtros }) {
  const config = useConfig();
  const consulta = useRelatorio<RelCasos>("relatorio_casos", f);
  const atualizando = consulta.isFetching && !consulta.isLoading;
  return (
    <Estado consulta={consulta}>
      {() => {
        const r = consulta.data!;
        return (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-crm-tinta-3">Situação atual da carteira (casos não arquivados). “No período” considera o filtro de datas.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Clientes" valor={formatarNumero(r.clientes_total)} detalhe={`${formatarNumero(r.clientes_novos)} novo(s) no período`} href="/crm/clientes" />
              <Indicador rotulo="Casos ativos" valor={formatarNumero(r.ativos)} detalhe={`${formatarNumero(r.casos_total)} no total · ${formatarNumero(r.judiciais)} judiciais · ${formatarNumero(r.internos)} internos`} href="/crm/casos?situacao=ativo" />
              <Indicador rotulo="Suspensos / concluídos" valor={`${formatarNumero(r.suspensos)} / ${formatarNumero(r.concluidos)}`} detalhe={`${formatarNumero(r.abertos_periodo)} aberto(s) e ${formatarNumero(r.concluidos_periodo)} concluído(s) no período`} />
              <Indicador
                rotulo="Sem número de processo"
                valor={formatarNumero(r.sem_numero)}
                detalhe="Casos judiciais ainda sem nº cadastrado"
                tom={r.sem_numero > 0 ? "alerta" : "neutro"}
                icone={r.sem_numero > 0 ? <AlertTriangle size={14} aria-hidden /> : undefined}
                href="/crm/casos?situacao=sem_numero"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <CartaoGrafico titulo="Casos em andamento por fase" atualizando={atualizando} tabela={{ nomeArquivo: "casos-por-fase", linhas: r.por_fase, colunas: [{ titulo: "Fase", valor: (x) => x.rotulo }, { titulo: "Casos", valor: (x) => x.total, numerico: true }] }}>
                <BarrasHorizontais
                  unidade="casos"
                  ordenar={false}
                  maxItens={20}
                  itens={r.por_fase.map((x) => {
                    const fase = config.etapasDe("caso", true).find((e) => e.nome === x.rotulo);
                    return { chave: x.rotulo, rotulo: x.rotulo, valor: x.total, href: fase ? `/crm/casos?fase=${fase.id}` : undefined };
                  })}
                />
              </CartaoGrafico>
              <CartaoGrafico titulo="Casos por tipo de demanda" atualizando={atualizando} tabela={{ nomeArquivo: "casos-por-tipo", linhas: r.por_tipo, colunas: [{ titulo: "Tipo", valor: (x) => x.rotulo }, { titulo: "Casos", valor: (x) => x.total, numerico: true }] }}>
                <BarrasHorizontais
                  unidade="casos"
                  itens={r.por_tipo.map((x) => {
                    const t = config.tiposDemanda.find((y) => y.nome === x.rotulo);
                    return { chave: x.rotulo, rotulo: x.rotulo, valor: x.total, href: t ? `/crm/casos?tipo=${t.id}` : undefined };
                  })}
                />
              </CartaoGrafico>
              <CartaoGrafico titulo="Processos por tribunal" atualizando={atualizando} tabela={{ nomeArquivo: "processos-por-tribunal", linhas: r.por_tribunal, colunas: [{ titulo: "Tribunal", valor: (x) => x.rotulo }, { titulo: "Processos", valor: (x) => x.total, numerico: true }] }}>
                <BarrasHorizontais unidade="processos" itens={r.por_tribunal.map((x) => ({ chave: x.rotulo, rotulo: x.rotulo, valor: x.total, href: x.rotulo !== "Não informado" ? `/crm/casos?tribunal=${encodeURIComponent(x.rotulo)}` : undefined }))} />
              </CartaoGrafico>
              <CartaoGrafico titulo="Novos clientes por origem (no período)" atualizando={atualizando} tabela={{ nomeArquivo: "clientes-por-origem", linhas: r.clientes_por_origem, colunas: [{ titulo: "Origem", valor: (x) => semRotulo(x.rotulo, "Não informada") }, { titulo: "Clientes", valor: (x) => x.total, numerico: true }] }}>
                <BarrasHorizontais unidade="clientes" itens={r.clientes_por_origem.map((x) => ({ chave: x.chave ?? "sem", rotulo: semRotulo(x.rotulo, "Não informada"), valor: x.total }))} />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Carteira por advogado responsável"
                somenteTabela
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "casos-por-responsavel",
                  linhas: r.por_responsavel,
                  colunas: [
                    { titulo: "Responsável", valor: (x) => (x.id ? <Link href={`/crm/casos?advogado=${x.id}`} className="text-crm-info hover:underline">{semRotulo(x.rotulo, "—")}</Link> : "Sem responsável"), exportar: (x) => semRotulo(x.rotulo, "Sem responsável") },
                    { titulo: "Casos", valor: (x) => x.total, numerico: true },
                    { titulo: "Ativos", valor: (x) => x.ativos, numerico: true },
                  ],
                }}
              />
            </div>
          </div>
        );
      }}
    </Estado>
  );
}

// ---------------------------------------------------------------------------
// Produtividade
// ---------------------------------------------------------------------------

interface LinhaProdutividade {
  id: string;
  nome: string;
  cor: string;
  tarefas_concluidas: number;
  tarefas_no_prazo: number;
  tarefas_atrasadas: number;
  contatos: number;
  leads_convertidos: number;
  prazos_cumpridos: number;
  documentos_revisados: number;
  andamentos: number;
}

function RelatorioProdutividade({ f }: { f: Filtros }) {
  const consulta = useRelatorio<{ usuarios: LinhaProdutividade[] }>("relatorio_produtividade", f);
  const atualizando = consulta.isFetching && !consulta.isLoading;
  return (
    <Estado consulta={consulta}>
      {() => {
        const lista = consulta.data!.usuarios;
        return (
          <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <CartaoGrafico
              titulo="Tarefas concluídas no período"
              descricao="Por pessoa que concluiu a tarefa."
              atualizando={atualizando}
              tabela={{
                nomeArquivo: "tarefas-concluidas",
                linhas: lista,
                colunas: [
                  { titulo: "Pessoa", valor: (x) => x.nome },
                  { titulo: "Concluídas", valor: (x) => x.tarefas_concluidas, numerico: true },
                  { titulo: "No prazo", valor: (x) => pct(x.tarefas_no_prazo, x.tarefas_concluidas), numerico: true },
                ],
              }}
            >
              <BarrasHorizontais unidade="tarefas" maxItens={15} vazio="Nenhuma tarefa concluída no período." itens={lista.map((u) => ({ chave: u.id, rotulo: u.nome, valor: u.tarefas_concluidas, detalhe: `${pct(u.tarefas_no_prazo, u.tarefas_concluidas)} no prazo` }))} />
            </CartaoGrafico>
            <CartaoGrafico
              titulo="Resumo por pessoa"
              descricao="Tarefas atrasadas consideram a situação atual; demais colunas, o período."
              somenteTabela
              atualizando={atualizando}
              tabela={{
                nomeArquivo: "produtividade",
                linhas: lista,
                colunas: [
                  { titulo: "Pessoa", valor: (x) => x.nome },
                  { titulo: "Tarefas concluídas", valor: (x) => x.tarefas_concluidas, numerico: true },
                  { titulo: "No prazo", valor: (x) => pct(x.tarefas_no_prazo, x.tarefas_concluidas), numerico: true },
                  { titulo: "Atrasadas hoje", valor: (x) => x.tarefas_atrasadas, numerico: true },
                  { titulo: "Contatos", valor: (x) => x.contatos, numerico: true },
                  { titulo: "Leads convertidos", valor: (x) => x.leads_convertidos, numerico: true },
                  { titulo: "Prazos cumpridos", valor: (x) => x.prazos_cumpridos, numerico: true },
                  { titulo: "Docs revisados", valor: (x) => x.documentos_revisados, numerico: true },
                  { titulo: "Andamentos", valor: (x) => x.andamentos, numerico: true },
                ],
              }}
            />
          </div>
        );
      }}
    </Estado>
  );
}

// ---------------------------------------------------------------------------
// Prazos
// ---------------------------------------------------------------------------

interface RelPrazos {
  total: number;
  cumpridos: number;
  cumpridos_no_prazo: number;
  cumpridos_apos: number;
  pendentes: number;
  vencidos_pendentes: number;
  cancelados: number;
  nao_conferidos: number;
  por_responsavel: { id: string | null; rotulo: string | null; total: number; cumpridos: number; vencidos: number }[];
}

function RelatorioPrazos({ f }: { f: Filtros }) {
  const consulta = useRelatorio<RelPrazos>("relatorio_prazos", f);
  const atualizando = consulta.isFetching && !consulta.isLoading;
  return (
    <Estado consulta={consulta}>
      {() => {
        const r = consulta.data!;
        return (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-crm-tinta-3">Prazos com vencimento dentro do período selecionado.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Prazos no período" valor={formatarNumero(r.total)} icone={<Gavel size={14} aria-hidden />} detalhe={`${formatarNumero(r.cancelados)} cancelado(s)`} />
              <Indicador rotulo="Cumpridos no prazo" valor={formatarNumero(r.cumpridos_no_prazo)} tom="sucesso" icone={<CheckCircle2 size={14} aria-hidden />} detalhe={`${formatarNumero(r.cumpridos_apos)} cumprido(s) após o vencimento`} />
              <Indicador
                rotulo="Vencidos sem cumprimento"
                valor={formatarNumero(r.vencidos_pendentes)}
                tom={r.vencidos_pendentes > 0 ? "perigo" : "neutro"}
                icone={<AlertTriangle size={14} aria-hidden />}
                href="/crm/casos?aba=prazos&preset=prazos_vencidos"
              />
              <Indicador
                rotulo="Pendentes a conferir"
                valor={formatarNumero(r.nao_conferidos)}
                detalhe={`${formatarNumero(r.pendentes)} pendente(s) a vencer`}
                tom={r.nao_conferidos > 0 ? "alerta" : "neutro"}
                icone={<ShieldAlert size={14} aria-hidden />}
                href="/crm/casos?aba=prazos&preset=prazos_nao_conferidos"
              />
            </div>
            <CartaoGrafico
              titulo="Prazos por responsável"
              somenteTabela
              atualizando={atualizando}
              tabela={{
                nomeArquivo: "prazos-por-responsavel",
                linhas: r.por_responsavel,
                colunas: [
                  { titulo: "Responsável", valor: (x) => semRotulo(x.rotulo, "Sem responsável") },
                  { titulo: "Prazos", valor: (x) => x.total, numerico: true },
                  { titulo: "Cumpridos", valor: (x) => x.cumpridos, numerico: true },
                  { titulo: "Vencidos sem cumprimento", valor: (x) => x.vencidos, numerico: true },
                ],
              }}
            />
          </div>
        );
      }}
    </Estado>
  );
}

// ---------------------------------------------------------------------------
// Pendências documentais
// ---------------------------------------------------------------------------

interface RelDocumentos {
  exigidos: number;
  recebidos: number;
  aprovados: number;
  faltantes: number;
  em_revisao: number;
  rejeitados: number;
  vencendo: number;
  faltantes_por_categoria: { rotulo: string; total: number }[];
  casos_com_pendencias: { id: string; codigo: string; titulo: string; faltantes: number }[];
  aprovados_periodo: number;
  recebidos_periodo: number;
}

function RelatorioDocumentos({ f }: { f: Filtros }) {
  const consulta = useRelatorio<RelDocumentos>("relatorio_documentos", f);
  const atualizando = consulta.isFetching && !consulta.isLoading;
  return (
    <Estado consulta={consulta}>
      {() => {
        const r = consulta.data!;
        return (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-crm-tinta-3">Checklists de casos em andamento e documentos gerais. Recebidos e aprovados “no período” seguem o filtro de datas.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Documentos exigidos" valor={formatarNumero(r.exigidos)} detalhe={`${formatarNumero(r.aprovados)} aprovado(s) · ${pct(r.aprovados, r.exigidos)}`} />
              <Indicador
                rotulo="Faltantes"
                valor={formatarNumero(r.faltantes)}
                tom={r.faltantes > 0 ? "alerta" : "neutro"}
                icone={<FileWarning size={14} aria-hidden />}
                detalhe={`${formatarNumero(r.rejeitados)} rejeitado(s) aguardando reenvio`}
                href="/crm/documentos?preset=documentos_faltantes"
              />
              <Indicador rotulo="Aguardando revisão" valor={formatarNumero(r.em_revisao)} icone={<Clock size={14} aria-hidden />} href="/crm/documentos?preset=documentos_revisar" />
              <Indicador rotulo="Validade em até 30 dias" valor={formatarNumero(r.vencendo)} detalhe={`${formatarNumero(r.recebidos_periodo)} recebido(s) e ${formatarNumero(r.aprovados_periodo)} aprovado(s) no período`} href="/crm/documentos?aba=validade" />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <CartaoGrafico titulo="Faltantes por categoria" atualizando={atualizando} tabela={{ nomeArquivo: "faltantes-por-categoria", linhas: r.faltantes_por_categoria, colunas: [{ titulo: "Categoria", valor: (x) => x.rotulo }, { titulo: "Faltantes", valor: (x) => x.total, numerico: true }] }}>
                <BarrasHorizontais unidade="documentos" vazio="Nenhum documento obrigatório faltante." itens={r.faltantes_por_categoria.map((x) => ({ chave: x.rotulo, rotulo: x.rotulo, valor: x.total }))} />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Casos com mais pendências"
                somenteTabela
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "casos-com-pendencias",
                  linhas: r.casos_com_pendencias,
                  colunas: [
                    { titulo: "Caso", valor: (x) => <Link href={`/crm/casos/${x.id}?aba=documentos`} className="text-crm-info hover:underline">{x.codigo} · {x.titulo}</Link>, exportar: (x) => `${x.codigo} · ${x.titulo}` },
                    { titulo: "Faltantes", valor: (x) => x.faltantes, numerico: true },
                  ],
                }}
              />
            </div>
          </div>
        );
      }}
    </Estado>
  );
}

// ---------------------------------------------------------------------------
// Financeiro (exige financeiro.ver — também verificado no banco)
// ---------------------------------------------------------------------------

interface RelFinanceiro {
  contratado_periodo: number;
  contratos_periodo: number;
  honorarios_recebidos_periodo: number;
  reembolsos_despesas_recebidos_periodo: number;
  em_aberto: number;
  vencido: number;
  vencido_reembolsos: number;
  a_vencer_30d: number;
  clientes_inadimplentes: number;
  devolvido_clientes_periodo: number;
  custas_periodo: number;
  despesas_periodo: number;
  adiantado_escritorio_periodo: number;
  recebido_por_mes: { mes: string; honorarios: number | null; reembolsos: number | null }[];
  maiores_saldos: { cliente_id: string; nome: string; saldo: number; vencido: number | null }[];
}

function RelatorioFinanceiro({ f }: { f: Filtros }) {
  const { pode } = useAuth();
  const consulta = useRelatorio<RelFinanceiro>("relatorio_financeiro", f);
  const atualizando = consulta.isFetching && !consulta.isLoading;
  if (!pode("financeiro.ver")) return <Vazio icone={<Lock size={22} />} titulo="Acesso restrito" descricao="Seu perfil não tem permissão para ver valores financeiros." />;
  return (
    <Estado consulta={consulta}>
      {() => {
        const r = consulta.data!;
        return (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Contratado no período" valor={formatarMoeda(r.contratado_periodo)} detalhe={`${formatarNumero(r.contratos_periodo)} contrato(s)`} icone={<Wallet size={14} aria-hidden />} />
              <Indicador rotulo="Honorários recebidos" valor={formatarMoeda(r.honorarios_recebidos_periodo)} tom="sucesso" icone={<CheckCircle2 size={14} aria-hidden />} detalhe={`+ ${formatarMoeda(r.reembolsos_despesas_recebidos_periodo)} em reembolsos de custas`} href="/crm/financeiro?aba=pagamentos" />
              <Indicador rotulo="Honorários em aberto" valor={formatarMoeda(r.em_aberto)} detalhe={`${formatarMoeda(r.a_vencer_30d)} vencem em até 30 dias`} href="/crm/financeiro" />
              <Indicador
                rotulo="Vencido (inadimplência)"
                valor={formatarMoeda(r.vencido)}
                tom={r.vencido > 0 ? "perigo" : "neutro"}
                icone={<AlertTriangle size={14} aria-hidden />}
                detalhe={`${formatarNumero(r.clientes_inadimplentes)} cliente(s) · reembolsos vencidos ${formatarMoeda(r.vencido_reembolsos)}`}
                href="/crm/financeiro?preset=pagamentos_vencidos"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Custas no período" valor={formatarMoeda(r.custas_periodo)} />
              <Indicador rotulo="Despesas no período" valor={formatarMoeda(r.despesas_periodo)} />
              <Indicador rotulo="Adiantado pelo escritório" valor={formatarMoeda(r.adiantado_escritorio_periodo)} detalhe="Custas e despesas pagas pelo escritório" />
              <Indicador rotulo="Devolvido a clientes" valor={formatarMoeda(r.devolvido_clientes_periodo)} detalhe="Reembolsos registrados no período" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <CartaoGrafico
                titulo="Recebimentos por mês"
                descricao="Pagamentos registrados (sem estornos), por data do pagamento."
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "recebimentos-por-mes",
                  linhas: r.recebido_por_mes,
                  colunas: [
                    { titulo: "Mês", valor: (x) => rotuloMes(x.mes) },
                    { titulo: "Honorários", valor: (x) => formatarMoeda(x.honorarios ?? 0), exportar: (x) => Number(x.honorarios ?? 0), numerico: true },
                    { titulo: "Reembolsos de custas", valor: (x) => formatarMoeda(x.reembolsos ?? 0), exportar: (x) => Number(x.reembolsos ?? 0), numerico: true },
                  ],
                }}
              >
                <Colunas
                  modo="empilhado"
                  formatar={formatarMoeda}
                  formatarEixo={moedaCompacta}
                  series={[
                    { id: "honorarios", rotulo: "Honorários" },
                    { id: "reembolsos", rotulo: "Reembolsos de custas" },
                  ]}
                  pontos={r.recebido_por_mes.map((m) => ({ chave: m.mes, rotulo: rotuloMes(m.mes), valores: { honorarios: Number(m.honorarios ?? 0), reembolsos: Number(m.reembolsos ?? 0) } }))}
                />
              </CartaoGrafico>
              <CartaoGrafico
                titulo="Maiores saldos em aberto"
                somenteTabela
                atualizando={atualizando}
                tabela={{
                  nomeArquivo: "maiores-saldos",
                  linhas: r.maiores_saldos,
                  colunas: [
                    { titulo: "Cliente", valor: (x) => <Link href={`/crm/clientes/${x.cliente_id}?aba=financeiro`} className="text-crm-info hover:underline">{x.nome}</Link>, exportar: (x) => x.nome },
                    { titulo: "Saldo", valor: (x) => formatarMoeda(x.saldo), exportar: (x) => Number(x.saldo), numerico: true },
                    {
                      titulo: "Vencido",
                      valor: (x) =>
                        Number(x.vencido ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-crm-perigo">
                            <AlertTriangle size={12} aria-hidden /> {formatarMoeda(x.vencido)}
                          </span>
                        ) : (
                          "—"
                        ),
                      exportar: (x) => Number(x.vencido ?? 0),
                      numerico: true,
                    },
                  ],
                }}
              />
            </div>
          </div>
        );
      }}
    </Estado>
  );
}
