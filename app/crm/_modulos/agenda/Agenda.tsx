"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Gavel, ListChecks, Stethoscope, Users, MessageSquare, CalendarClock, Scale } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../_lib/auth";
import { opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { fimDiaSP, hojeSP, inicioDiaSP, inicioMes, inicioSemana, situacaoVencimento, somarDias } from "../../_lib/datas";
import { executar } from "../../_lib/dados";
import { navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Compromisso, PrazoComRelacoes, Tarefa } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { SeletorCampo } from "../../_ui/Seletores";
import { CabecalhoPagina, ErroCarga } from "../../_ui/Visuais";
import { Calendario, type EventoCalendario, type ModoCalendario } from "../../_componentes/Calendario";
import { FormCompromisso } from "../../_componentes/FormCompromisso";
import { STATUS_TAREFA } from "../../_componentes/Relacionados";

const ICONES_TIPO: Record<string, ReactNode> = {
  reuniao: <Users size={11} />,
  audiencia: <Scale size={11} />,
  atendimento: <MessageSquare size={11} />,
  pericia: <Stethoscope size={11} />,
  compromisso: <CalendarClock size={11} />,
};

type Camada = "compromissos" | "tarefas" | "prazos";

export default function Agenda() {
  const { perfil, pode } = useAuth();
  const config = useConfig();
  const { parametro, definirParametros } = useRota();
  const modo = (parametro("modo") as ModoCalendario) || "semana";
  const data = parametro("data") || hojeSP();
  const itemId = parametro("item");
  const novo = parametro("novo") === "1";
  const [dataNovo, setDataNovo] = useState<string | undefined>();
  const [pessoa, setPessoa] = useState<string | null>(null);
  const [camadas, setCamadas] = useState<Set<Camada>>(new Set(["compromissos", "tarefas", "prazos"]));

  useEffect(() => {
    if (!pode("agenda.ver_todas")) setPessoa(perfil?.id ?? null);
  }, [pode, perfil?.id]);

  const [inicio, fim] = useMemo(() => {
    if (modo === "mes") {
      const i = inicioSemana(inicioMes(data));
      return [i, somarDias(i, 42)];
    }
    if (modo === "semana") {
      const i = inicioSemana(data);
      return [i, somarDias(i, 7)];
    }
    return [data, somarDias(data, 1)];
  }, [modo, data]);

  const consulta = useQuery({
    queryKey: ["agenda", inicio, fim, pessoa, pode("prazos.ver")],
    queryFn: async () => {
      const s = supabase();
      const de = inicioDiaSP(inicio);
      const ate = fimDiaSP(somarDias(fim, -1));
      let qc = s.from("compromissos").select("*").gte("inicio", de).lte("inicio", ate).neq("status", "cancelado");
      let qt = s.from("tarefas").select("*").gte("prazo", de).lte("prazo", ate).is("arquivado_em", null).neq("status", "cancelada");
      let qp = s.from("prazos").select("*, caso:casos(id, titulo, codigo, cliente_id, cliente:clientes(id, nome)), processo:processos(id, numero, tribunal)").gte("vencimento", de).lte("vencimento", ate).neq("status", "cancelado");
      if (pessoa) {
        qc = qc.or(`responsavel_id.eq.${pessoa},participantes.cs.{${pessoa}}`);
        qt = qt.eq("responsavel_id", pessoa);
        qp = qp.eq("responsavel_id", pessoa);
      }
      const [compromissos, tarefas, prazos] = await Promise.all([
        executar(qc.order("inicio")),
        executar(qt.order("prazo")),
        pode("prazos.ver") ? executar(qp.order("vencimento")) : Promise.resolve([]),
      ]);
      return { compromissos: (compromissos ?? []) as Compromisso[], tarefas: (tarefas ?? []) as Tarefa[], prazos: (prazos ?? []) as unknown as PrazoComRelacoes[] };
    },
  });

  const compromissoAberto = useQuery({
    queryKey: ["compromissos", "item", itemId],
    enabled: Boolean(itemId),
    queryFn: async () => (await executar(supabase().from("compromissos").select("*").eq("id", itemId!).maybeSingle())) as Compromisso | null,
  });

  const eventos = useMemo<EventoCalendario[]>(() => {
    const d = consulta.data;
    if (!d) return [];
    const lista: EventoCalendario[] = [];
    if (camadas.has("compromissos")) {
      for (const c of d.compromissos) {
        lista.push({
          id: `c-${c.id}`,
          titulo: c.titulo,
          inicio: c.inicio,
          fim: c.fim,
          diaInteiro: c.dia_inteiro,
          cor: config.corOpcao("tipo_compromisso", c.tipo) ?? "#1F6E76",
          tipo: config.rotulo("tipo_compromisso", c.tipo),
          icone: ICONES_TIPO[c.tipo] ?? <CalendarDays size={11} />,
          concluido: c.status === "realizado",
          detalhe: [c.local, c.link_reuniao ? "videochamada" : null, config.usuario(c.responsavel_id)?.nome].filter(Boolean).join(" · "),
          aoAbrir: () => definirParametros({ item: c.id }),
        });
      }
    }
    if (camadas.has("tarefas")) {
      for (const t of d.tarefas) {
        const concluida = t.status === "concluida";
        lista.push({
          id: `t-${t.id}`,
          titulo: t.titulo,
          inicio: t.prazo!,
          diaInteiro: t.prazo_dia_inteiro,
          cor: "#7A8B2E",
          tipo: "Tarefa",
          icone: <ListChecks size={11} />,
          concluido: concluida,
          alerta: !concluida && situacaoVencimento(t.prazo, t.prazo_dia_inteiro) === "vencido" ? "vencido" : null,
          detalhe: `${STATUS_TAREFA.find((s) => s.valor === t.status)?.rotulo} · ${config.usuario(t.responsavel_id)?.nome ?? "sem responsável"}`,
          aoAbrir: () => navegar(`/crm/tarefas?item=${t.id}`),
        });
      }
    }
    if (camadas.has("prazos")) {
      for (const p of d.prazos) {
        lista.push({
          id: `p-${p.id}`,
          titulo: `${p.titulo}${p.conferido ? "" : " (a conferir)"}`,
          inicio: p.vencimento,
          cor: "#8E2C3D",
          tipo: "Prazo processual",
          icone: <Gavel size={11} />,
          concluido: p.status === "cumprido",
          alerta: p.status === "pendente" && situacaoVencimento(p.vencimento) === "vencido" ? "vencido" : null,
          detalhe: [p.caso?.codigo, p.caso?.cliente?.nome, p.processo?.numero].filter(Boolean).join(" · "),
          aoAbrir: () => navegar(`/crm/casos/${p.caso_id}?aba=prazos&prazo=${p.id}`),
        });
      }
    }
    return lista;
  }, [consulta.data, camadas, config, definirParametros]);

  const alternarCamada = (c: Camada) =>
    setCamadas((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const legenda = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Camadas da agenda">
      {(
        [
          ["compromissos", "Reuniões e compromissos", <Users key="c" size={13} />, "#1F6E76"],
          ["tarefas", "Tarefas", <ListChecks key="t" size={13} />, "#7A8B2E"],
          ...(pode("prazos.ver") ? [["prazos", "Prazos processuais", <Gavel key="p" size={13} />, "#8E2C3D"]] : []),
        ] as [Camada, string, ReactNode, string][]
      ).map(([id, rotulo, icone, cor]) => (
        <button
          key={id}
          type="button"
          aria-pressed={camadas.has(id)}
          onClick={() => alternarCamada(id)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${camadas.has(id) ? "border-crm-tinta bg-white text-crm-tinta" : "border-crm-linha bg-crm-suave text-crm-tinta-3 line-through"}`}
        >
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cor }} aria-hidden />
          {icone}
          {rotulo}
        </button>
      ))}
      <div className="ml-auto w-56">
        <SeletorCampo
          rotulo="Pessoa"
          valor={pessoa}
          estilo="pessoa"
          opcoes={opcoesUsuarios(config, false)}
          aoAlterar={setPessoa}
          rotuloVazio="Toda a equipe"
          desabilitado={!pode("agenda.ver_todas")}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina
        icone={<CalendarDays size={20} />}
        titulo={config.nome("agenda")}
        subtitulo="Reuniões, audiências, compromissos, tarefas e prazos — horário de Brasília."
        acoes={
          <Botao variante="primario" tamanho="sm" icone={<CalendarPlus size={15} />} onClick={() => { setDataNovo(undefined); definirParametros({ novo: "1" }); }}>
            Novo compromisso
          </Botao>
        }
      />
      {consulta.error ? (
        <ErroCarga aoTentarNovamente={() => consulta.refetch()} />
      ) : (
        <Calendario
          eventos={eventos}
          modo={modo}
          data={data}
          carregando={consulta.isLoading}
          aoMudarModo={(m) => definirParametros({ modo: m }, { substituir: true })}
          aoMudarData={(d) => definirParametros({ data: d }, { substituir: true })}
          aoCriarNoDia={(dia) => {
            setDataNovo(dia);
            definirParametros({ novo: "1" });
          }}
          legenda={legenda}
        />
      )}
      <FormCompromisso aberto={novo} aoFechar={() => definirParametros({ novo: null })} dataInicial={dataNovo} />
      <FormCompromisso aberto={Boolean(itemId && compromissoAberto.data)} aoFechar={() => definirParametros({ item: null })} compromisso={compromissoAberto.data ?? null} />
    </div>
  );
}
