"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileWarning,
  Gavel,
  ListChecks,
  Magnet,
  PhoneOff,
  Scale,
  ShieldQuestion,
  Sun,
  Wallet,
  FileSearch,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { useConfig } from "../../_lib/config";
import { fimDiaSP, formatarDataHora, formatarDiaLongo, formatarRelativo, horaSP, hojeSP, inicioDiaSP, situacaoVencimento } from "../../_lib/datas";
import { ErroCrm, executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { formatarMoeda, primeiroNome } from "../../_lib/formatos";
import { PRESETS, type Consulta, type Preset } from "../../_lib/presets";
import { Link } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Compromisso, Lead, PrazoComRelacoes, TarefaComRelacoes } from "../../_lib/tipos";
import { useContextoPreset } from "../../_lib/usePreset";
import { Carregando, ErroCarga, Pilula, Selo, Vazio } from "../../_ui/Visuais";

const ICONES: Record<string, LucideIcon> = {
  novos_leads: Magnet,
  leads_sem_retorno: PhoneOff,
  tarefas_hoje: ListChecks,
  tarefas_atrasadas: Clock,
  prazos_proximos: Gavel,
  prazos_vencidos: AlertTriangle,
  prazos_nao_conferidos: ShieldQuestion,
  reunioes_hoje: CalendarDays,
  documentos_faltantes: FileWarning,
  documentos_revisar: FileSearch,
  casos_ativos: Scale,
  pagamentos_vencidos: Wallet,
};

const PADRAO_INDICADORES = Object.keys(PRESETS).map((id) => ({ id, visivel: true }));

function saudacao() {
  const h = Number(horaSP(new Date()).slice(0, 2));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function lerMeus(padrao: boolean): boolean {
  try {
    const v = window.localStorage.getItem("crm.hoje.somenteMeus");
    return v === null ? padrao : v === "1";
  } catch {
    return padrao;
  }
}

export default function Hoje() {
  const { perfil, pode } = useAuth();
  const config = useConfig();
  const [somenteMeus, setSomenteMeus] = useState(true);
  useEffect(() => setSomenteMeus(lerMeus(perfil?.perfil_id !== "admin")), [perfil?.perfil_id]);
  const alternar = (v: boolean) => {
    setSomenteMeus(v);
    try {
      window.localStorage.setItem("crm.hoje.somenteMeus", v ? "1" : "0");
    } catch {
      /* preferência apenas na sessão */
    }
  };
  const ctx = useContextoPreset(somenteMeus);

  const indicadores = useMemo(() => {
    const cfg = config.cfg<{ indicadores?: { id: string; visivel: boolean }[] }>("painel", {}).indicadores ?? PADRAO_INDICADORES;
    return cfg
      .filter((i) => i.visivel && PRESETS[i.id])
      .map((i) => PRESETS[i.id])
      .filter((p) => !p.permissao || pode(p.permissao));
  }, [config, pode]);

  const contagens = useQuery({
    queryKey: ["painel", "contagens", indicadores.map((i) => i.id).join(","), somenteMeus],
    enabled: Boolean(ctx) && !config.carregando,
    refetchInterval: 60_000,
    queryFn: async () => {
      const resultados = await Promise.all(
        indicadores.map(async (p) => {
          const s = supabase();
          if (p.tabela === "v_cobrancas") {
            const linhas = (await executar(p.aplicar(s.from("v_cobrancas").select("saldo") as unknown as Consulta, ctx!) as unknown as PromiseLike<{ data: { saldo: number }[] | null; error: unknown }>)) ?? [];
            return [p.id, { total: linhas.length, valor: linhas.reduce((t, l) => t + Number(l.saldo), 0) }] as const;
          }
          const r = (await (p.aplicar(s.from(p.tabela).select("id", { count: "exact", head: true }) as unknown as Consulta, ctx!) as unknown as PromiseLike<{ count: number | null; error: { message?: string; code?: string } | null }>));
          if (r.error) throw new ErroCrm(mensagemErro(r.error));
          return [p.id, { total: r.count ?? 0, valor: null as number | null }] as const;
        }),
      );
      return Object.fromEntries(resultados) as Record<string, { total: number; valor: number | null }>;
    },
  });

  if (config.carregando || !ctx) return <Carregando />;
  const hoje = hojeSP();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="hidden h-11 w-11 items-center justify-center rounded-xl border-2 border-crm-tinta bg-crm-verde text-crm-ouro-claro shadow-crm-bruto sm:inline-flex">
            <Sun size={22} aria-hidden />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              {saudacao()}, {primeiroNome(perfil?.nome)}
            </h1>
            <p className="text-sm text-crm-tinta-2">{formatarDiaLongo(hoje)} · o que exige ação agora</p>
          </div>
        </div>
        <div role="group" aria-label="Escopo do painel" className="inline-flex self-start rounded-full border border-crm-linha-forte bg-white p-0.5 sm:self-auto">
          {[
            { v: true, r: "Meus itens" },
            { v: false, r: "Toda a equipe" },
          ].map((o) => (
            <button key={o.r} type="button" aria-pressed={somenteMeus === o.v} onClick={() => alternar(o.v)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${somenteMeus === o.v ? "bg-crm-verde text-white" : "text-crm-tinta-2 hover:text-crm-tinta"}`}>
              {o.r}
            </button>
          ))}
        </div>
      </div>

      {contagens.error ? (
        <div className="rounded-2xl border border-crm-linha bg-white">
          <ErroCarga mensagem={mensagemErro(contagens.error)} aoTentarNovamente={() => contagens.refetch()} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Indicadores">
          {indicadores.map((p) => (
            <li key={p.id}>
              <Indicador preset={p} dado={contagens.data?.[p.id]} carregando={contagens.isLoading} destino={p.destino(ctx)} descricao={p.descricao(ctx)} />
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {pode("prazos.ver") && <ListaPrazos somenteMeus={somenteMeus} />}
        <ListaTarefas somenteMeus={somenteMeus} />
        <ListaAgenda somenteMeus={somenteMeus} />
        {pode("leads.ver") && <ListaLeads />}
      </div>
    </div>
  );
}

function Indicador({ preset, dado, carregando, destino, descricao }: { preset: Preset; dado?: { total: number; valor: number | null }; carregando: boolean; destino: string; descricao: string }) {
  const Icone = ICONES[preset.id] ?? ListChecks;
  const total = dado?.total ?? 0;
  const atencao = (preset.tom === "perigo" || preset.tom === "alerta") && total > 0;
  const faixa = preset.tom === "perigo" ? "#B42318" : preset.tom === "alerta" ? "#A15C07" : preset.tom === "verde" ? "#3D7B3E" : "#263A2D";
  return (
    <Link
      href={destino}
      className="group flex h-full flex-col gap-2 rounded-2xl border-2 border-crm-tinta bg-white p-4 shadow-crm-bruto-verde transition-all hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_#263A2D]"
      aria-label={`${preset.rotulo}: ${carregando ? "carregando" : total}. ${descricao} Abrir a lista.`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-crm-tinta-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${faixa}14`, color: faixa }}>
            <Icone size={15} aria-hidden />
          </span>
          {preset.rotulo}
        </span>
        <ArrowRight size={16} className="text-crm-tinta-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <div className="flex items-baseline gap-2">
        {carregando ? (
          <span className="crm-esqueleto h-9 w-16" />
        ) : (
          <span className="font-sans text-4xl font-semibold text-crm-tinta">{total.toLocaleString("pt-BR")}</span>
        )}
        {dado?.valor !== null && dado?.valor !== undefined && !carregando && <span className="text-sm font-semibold text-crm-tinta-2">{formatarMoeda(dado.valor)}</span>}
      </div>
      <p className="text-xs leading-snug text-crm-tinta-3">{descricao}</p>
      {!carregando && (
        <span className="mt-auto">
          {atencao ? (
            <Selo tom={preset.tom === "perigo" ? "perigo" : "alerta"} icone={<AlertTriangle size={11} aria-hidden />}>
              Requer atenção
            </Selo>
          ) : preset.tom === "perigo" || preset.tom === "alerta" ? (
            <Selo tom="sucesso" icone={<CheckCircle2 size={11} aria-hidden />}>
              Em dia
            </Selo>
          ) : null}
        </span>
      )}
    </Link>
  );
}

function CartaoLista({ titulo, icone, verTodos, children }: { titulo: string; icone: React.ReactNode; verTodos?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-crm-linha bg-white shadow-crm-cartao">
      <header className="flex items-center justify-between gap-2 border-b border-crm-linha px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          {icone} {titulo}
        </h2>
        {verTodos && (
          <Link href={verTodos} className="text-xs font-semibold text-crm-folha hover:underline">
            Ver todos
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function ListaPrazos({ somenteMeus }: { somenteMeus: boolean }) {
  const { perfil } = useAuth();
  const consulta = useQuery({
    queryKey: ["painel", "prazos", somenteMeus],
    queryFn: async () => {
      let q = supabase()
        .from("prazos")
        .select("*, caso:casos(id, titulo, codigo, cliente_id, cliente:clientes(id, nome)), processo:processos(id, numero, tribunal)")
        .eq("status", "pendente")
        .lte("vencimento", new Date(Date.now() + 7 * 86400_000).toISOString());
      if (somenteMeus && perfil) q = q.eq("responsavel_id", perfil.id);
      return (await executar(q.order("vencimento").limit(8))) as unknown as PrazoComRelacoes[];
    },
  });
  return (
    <CartaoLista titulo="Prazos vencidos e dos próximos 7 dias" icone={<Gavel size={16} className="text-crm-verde" aria-hidden />} verTodos="/crm/casos?aba=prazos">
      {consulta.isLoading ? (
        <Carregando />
      ) : (consulta.data ?? []).length === 0 ? (
        <Vazio compacto titulo="Nenhum prazo nos próximos 7 dias" />
      ) : (
        <ul className="divide-y divide-crm-linha">
          {consulta.data!.map((p) => {
            const s = situacaoVencimento(p.vencimento);
            return (
              <li key={p.id}>
                <Link href={`/crm/casos/${p.caso_id}?aba=prazos&prazo=${p.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-crm-suave">
                  <span className={`mt-0.5 w-24 shrink-0 text-xs font-bold tabular-nums ${s === "vencido" ? "text-crm-perigo" : s === "hoje" ? "text-crm-alerta" : "text-crm-tinta-2"}`}>
                    {s === "vencido" && <AlertTriangle size={11} className="mr-0.5 inline" aria-hidden />}
                    {formatarDataHora(p.vencimento)}
                    <span className="block font-semibold">{s === "vencido" ? "Vencido" : s === "hoje" ? "Hoje" : formatarRelativo(p.vencimento)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.titulo}</span>
                    <span className="block truncate text-xs text-crm-tinta-3">
                      {p.caso?.codigo} · {p.caso?.cliente?.nome ?? p.caso?.titulo}
                      {p.processo?.numero ? ` · ${p.processo.numero}` : ""}
                    </span>
                  </span>
                  {!p.conferido && <Selo tom="alerta">A conferir</Selo>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CartaoLista>
  );
}

function ListaTarefas({ somenteMeus }: { somenteMeus: boolean }) {
  const { perfil } = useAuth();
  const config = useConfig();
  const { atualizar } = useGravacao();
  const consulta = useQuery({
    queryKey: ["painel", "tarefas", somenteMeus],
    queryFn: async () => {
      let q = supabase()
        .from("tarefas")
        .select("*, lead:leads(id, nome, codigo), cliente:clientes(id, nome, codigo), caso:casos(id, titulo, codigo)")
        .not("status", "in", "(concluida,cancelada)")
        .is("arquivado_em", null)
        .lte("prazo", fimDiaSP(hojeSP()));
      if (somenteMeus && perfil) q = q.eq("responsavel_id", perfil.id);
      return (await executar(q.order("prazo").limit(10))) as unknown as TarefaComRelacoes[];
    },
  });
  return (
    <CartaoLista titulo={somenteMeus ? "Minhas tarefas de hoje e atrasadas" : "Tarefas de hoje e atrasadas"} icone={<ListChecks size={16} className="text-crm-verde" aria-hidden />} verTodos={`/crm/tarefas?preset=tarefas_atrasadas${somenteMeus ? "&meus=1" : ""}`}>
      {consulta.isLoading ? (
        <Carregando />
      ) : (consulta.data ?? []).length === 0 ? (
        <Vazio compacto titulo="Nenhuma tarefa pendente para hoje" descricao="Bom trabalho!" />
      ) : (
        <ul className="divide-y divide-crm-linha">
          {consulta.data!.map((t) => {
            const s = situacaoVencimento(t.prazo, t.prazo_dia_inteiro);
            const vinculo = t.caso?.titulo ?? t.cliente?.nome ?? t.lead?.nome;
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label={`Concluir ${t.titulo}`}
                  onChange={() => atualizar("tarefas", t.id, { status: "concluida" }, { chaves: ["tarefas", "painel"], mensagemSucesso: "Tarefa concluída." }).catch(() => undefined)}
                  className="h-4 w-4 accent-[#263A2D]"
                />
                <Link href={`/crm/tarefas?item=${t.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold hover:underline">{t.titulo}</span>
                  <span className="block truncate text-xs text-crm-tinta-3">
                    <span className={s === "vencido" ? "font-bold text-crm-perigo" : s === "hoje" ? "font-bold text-crm-alerta" : ""}>{s === "vencido" ? "Atrasada" : "Hoje"}</span>
                    {vinculo ? ` · ${vinculo}` : ""}
                    {!somenteMeus && ` · ${config.usuario(t.responsavel_id)?.nome ?? "sem responsável"}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CartaoLista>
  );
}

function ListaAgenda({ somenteMeus }: { somenteMeus: boolean }) {
  const { perfil } = useAuth();
  const config = useConfig();
  const consulta = useQuery({
    queryKey: ["painel", "agenda", somenteMeus],
    queryFn: async () => {
      const inicio = inicioDiaSP(hojeSP());
      const fim = fimDiaSP(hojeSP());
      let q = supabase().from("compromissos").select("*").gte("inicio", inicio).lte("inicio", fim).neq("status", "cancelado");
      if (somenteMeus && perfil) q = q.or(`responsavel_id.eq.${perfil.id},participantes.cs.{${perfil.id}}`);
      return (await executar(q.order("inicio"))) as Compromisso[];
    },
  });
  return (
    <CartaoLista titulo="Agenda de hoje" icone={<CalendarDays size={16} className="text-crm-verde" aria-hidden />} verTodos="/crm/agenda?modo=dia">
      {consulta.isLoading ? (
        <Carregando />
      ) : (consulta.data ?? []).length === 0 ? (
        <Vazio compacto titulo="Nenhum compromisso hoje" />
      ) : (
        <ul className="divide-y divide-crm-linha">
          {consulta.data!.map((c) => (
            <li key={c.id}>
              <Link href={`/crm/agenda?item=${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-crm-suave">
                <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{c.dia_inteiro ? "Dia" : horaSP(c.inicio)}</span>
                <Pilula cor={config.corOpcao("tipo_compromisso", c.tipo)}>{config.rotulo("tipo_compromisso", c.tipo)}</Pilula>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.titulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CartaoLista>
  );
}

function ListaLeads() {
  const ctx = useContextoPreset(false);
  const consulta = useQuery({
    queryKey: ["painel", "leads-sem-retorno"],
    enabled: Boolean(ctx),
    queryFn: async () => {
      type Ordenavel = { order: (c: string) => { limit: (n: number) => PromiseLike<{ data: Lead[] | null; error: unknown }> } };
      const q = PRESETS.leads_sem_retorno.aplicar(supabase().from("leads").select("*") as unknown as Consulta, ctx!) as unknown as Ordenavel;
      return (await executar(q.order("created_at").limit(6))) as Lead[];
    },
  });
  return (
    <CartaoLista titulo="Leads aguardando retorno" icone={<PhoneOff size={16} className="text-crm-verde" aria-hidden />} verTodos="/crm/leads?preset=leads_sem_retorno">
      {consulta.isLoading ? (
        <Carregando />
      ) : (consulta.data ?? []).length === 0 ? (
        <Vazio compacto titulo="Nenhum lead aguardando retorno" />
      ) : (
        <ul className="divide-y divide-crm-linha">
          {consulta.data!.map((l) => (
            <li key={l.id}>
              <Link href={`/crm/leads?item=${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-crm-suave">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.nome}</span>
                  <span className="block truncate text-xs text-crm-tinta-3">
                    {l.primeiro_contato_em ? `Próxima ação atrasada: ${l.proxima_acao ?? "—"}` : `Sem contato · entrou ${formatarRelativo(l.created_at)}`}
                  </span>
                </span>
                {l.temperatura === "quente" && <Selo tom="alerta">Quente</Selo>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CartaoLista>
  );
}
