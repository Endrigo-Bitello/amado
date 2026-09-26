"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Link2, ListPlus, Zap } from "lucide-react";
import { useState } from "react";
import { useConfig } from "../_lib/config";
import { formatarDataHora, situacaoVencimento } from "../_lib/datas";
import { executar, useGravacao } from "../_lib/dados";
import { navegar } from "../_lib/rotas";
import { supabase } from "../_lib/supabase";
import type { Compromisso, Tarefa } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { Avatar, Carregando, ErroCarga, Pilula, Selo, Vazio } from "../_ui/Visuais";
import { FormCompromisso } from "./FormCompromisso";
import { FormTarefa, type VinculoTarefa } from "./FormTarefa";

type Coluna = "lead_id" | "cliente_id" | "caso_id";

export const STATUS_TAREFA: { valor: string; rotulo: string; cor: string }[] = [
  { valor: "a_fazer", rotulo: "A fazer", cor: "#A1A1AA" },
  { valor: "em_andamento", rotulo: "Em andamento", cor: "#C9822B" },
  { valor: "aguardando", rotulo: "Aguardando", cor: "#6D5BA6" },
  { valor: "concluida", rotulo: "Concluída", cor: "#3D7B3E" },
  { valor: "cancelada", rotulo: "Cancelada", cor: "#52525B" },
];

export function TarefasRelacionadas({ coluna, id, vinculo }: { coluna: Coluna; id: string; vinculo: VinculoTarefa }) {
  const config = useConfig();
  const { atualizar } = useGravacao();
  const [nova, setNova] = useState(false);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const consulta = useQuery({
    queryKey: ["tarefas", "relacionadas", coluna, id],
    queryFn: async () => (await executar(supabase().from("tarefas").select("*").eq(coluna, id).is("arquivado_em", null).order("prazo", { ascending: true, nullsFirst: false }))) as Tarefa[],
  });
  const todas = consulta.data ?? [];
  const lista = verConcluidas ? todas : todas.filter((t) => t.status !== "concluida" && t.status !== "cancelada");
  const concluidas = todas.length - todas.filter((t) => t.status !== "concluida" && t.status !== "cancelada").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Tarefas</h3>
        <div className="flex items-center gap-2">
          {concluidas > 0 && (
            <Botao tamanho="sm" variante="fantasma" onClick={() => setVerConcluidas((v) => !v)}>
              {verConcluidas ? "Ocultar concluídas" : `Ver concluídas (${concluidas})`}
            </Botao>
          )}
          <Botao tamanho="sm" variante="secundario" icone={<ListPlus size={14} />} onClick={() => setNova(true)}>
            Nova tarefa
          </Botao>
        </div>
      </div>
      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarga aoTentarNovamente={() => consulta.refetch()} />
      ) : lista.length === 0 ? (
        <Vazio compacto titulo="Nenhuma tarefa aberta" />
      ) : (
        <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
          {lista.map((t) => {
            const situacao = t.status === "concluida" || t.status === "cancelada" ? null : situacaoVencimento(t.prazo, t.prazo_dia_inteiro);
            const resp = config.usuario(t.responsavel_id);
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={t.status === "concluida"}
                  onChange={(e) => atualizar("tarefas", t.id, { status: e.target.checked ? "concluida" : "a_fazer" }, { chaves: ["tarefas", "painel", "eventos"] }).catch(() => undefined)}
                  aria-label={`Concluir ${t.titulo}`}
                  className="h-4 w-4 accent-[#263A2D]"
                />
                <button type="button" onClick={() => navegar(`/crm/tarefas?item=${t.id}`)} className="min-w-0 flex-1 text-left">
                  <span className={`block truncate text-sm font-semibold ${t.status === "concluida" ? "text-crm-tinta-3 line-through" : "text-crm-tinta"}`}>{t.titulo}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-crm-tinta-3">
                    {t.prazo && (
                      <span className={situacao === "vencido" ? "font-bold text-crm-perigo" : situacao === "hoje" ? "font-bold text-crm-alerta" : ""}>
                        {situacao === "vencido" ? "Atrasada · " : situacao === "hoje" ? "Hoje · " : ""}
                        {formatarDataHora(t.prazo)}
                      </span>
                    )}
                    {t.origem === "automacao" && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-crm-ouro-escuro">
                        <Zap size={11} aria-hidden /> Automática
                      </span>
                    )}
                    {t.depende_de && (
                      <span className="inline-flex items-center gap-0.5">
                        <Link2 size={11} aria-hidden /> depende de outra
                      </span>
                    )}
                  </span>
                </button>
                <Pilula cor={STATUS_TAREFA.find((s) => s.valor === t.status)?.cor}>{STATUS_TAREFA.find((s) => s.valor === t.status)?.rotulo}</Pilula>
                <Avatar nome={resp?.nome} cor={resp?.cor} tamanho={24} />
              </li>
            );
          })}
        </ul>
      )}
      <FormTarefa aberto={nova} aoFechar={() => setNova(false)} vinculo={vinculo} />
    </div>
  );
}

export function CompromissosRelacionados({ coluna, id, vinculo }: { coluna: Coluna; id: string; vinculo: VinculoTarefa }) {
  const config = useConfig();
  const [editando, setEditando] = useState<Compromisso | null>(null);
  const [novo, setNovo] = useState(false);
  const consulta = useQuery({
    queryKey: ["compromissos", "relacionados", coluna, id],
    queryFn: async () => (await executar(supabase().from("compromissos").select("*").eq(coluna, id).order("inicio", { ascending: false }).limit(50))) as Compromisso[],
  });
  const lista = consulta.data ?? [];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Reuniões e compromissos</h3>
        <Botao tamanho="sm" variante="secundario" icone={<CalendarPlus size={14} />} onClick={() => setNovo(true)}>
          Agendar
        </Botao>
      </div>
      {consulta.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio compacto titulo="Nenhum compromisso" />
      ) : (
        <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setEditando(c)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-crm-suave">
                <Pilula cor={config.corOpcao("tipo_compromisso", c.tipo)}>{config.rotulo("tipo_compromisso", c.tipo)}</Pilula>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{c.titulo}</span>
                  <span className="text-xs text-crm-tinta-3">{formatarDataHora(c.inicio)}</span>
                </span>
                {c.status !== "agendado" && <Selo>{c.status === "realizado" ? "Realizado" : c.status === "cancelado" ? "Cancelado" : c.status === "remarcado" ? "Remarcado" : "Não compareceu"}</Selo>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormCompromisso aberto={novo} aoFechar={() => setNovo(false)} vinculo={vinculo} />
      <FormCompromisso aberto={Boolean(editando)} aoFechar={() => setEditando(null)} compromisso={editando} />
    </div>
  );
}
