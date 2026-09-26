"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useConfig } from "../../_lib/config";
import type { Etapa } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { Alternador, CaixaSelecao, Entrada, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Popover } from "../../_ui/Sobreposicoes";
import { Pilula } from "../../_ui/Visuais";
import { Aviso, BotoesOrdem, mover, SecaoAdmin, SeletorCor, useAdmin, valorDe } from "./comum";

/** Campo de texto que salva ao sair (Enter confirma, Esc desfaz). */
export function TextoInline({ valor, aoSalvar, rotulo, placeholder, className = "" }: { valor: string | null; aoSalvar: (v: string) => void; rotulo: string; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      aria-label={rotulo}
      defaultValue={valor ?? ""}
      key={valor ?? ""}
      placeholder={placeholder}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== (valor ?? "").trim()) aoSalvar(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          (e.target as HTMLInputElement).value = valor ?? "";
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-crm-linha focus:border-crm-folha focus:bg-white focus:outline-none ${className}`}
    />
  );
}

export function BotaoCor({ cor, aoAlterar, rotulo }: { cor: string | null; aoAlterar: (c: string) => void; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={`${rotulo}: alterar cor`}
        aria-expanded={aberto}
        className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_#CFC7B8] transition-transform hover:scale-110"
        style={{ backgroundColor: cor ?? "#A1A1AA" }}
      />
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={260} rotulo={`Cor de ${rotulo}`}>
        <div className="p-3">
          <SeletorCor
            valor={cor}
            rotulo={`Cor de ${rotulo}`}
            aoAlterar={(c) => {
              aoAlterar(c);
              setAberto(false);
            }}
          />
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Etapas do funil de leads e fases dos casos
// ---------------------------------------------------------------------------

const CATEGORIAS_LEAD = [
  { valor: "aberta", rotulo: "Em andamento" },
  { valor: "ganha", rotulo: "Contratado (ganho)" },
  { valor: "perdida", rotulo: "Não convertido (perda)" },
];

function EditorEtapas({ funil }: { funil: "lead" | "caso" }) {
  const config = useConfig();
  const { salvar, excluir, reordenar } = useAdmin();
  const [nova, setNova] = useState("");
  const etapas = config.etapasDe(funil, true).slice().sort((a, b) => a.ordem - b.ordem);
  const ativas = etapas.filter((e) => e.ativo);
  const faltaGanha = funil === "lead" && !ativas.some((e) => e.categoria === "ganha");
  const faltaPerdida = funil === "lead" && !ativas.some((e) => e.categoria === "perdida");

  const atualizar = (e: Etapa, dados: Record<string, unknown>, msg?: string) => salvar("etapas", dados, { id: e.id }, msg);
  const alternar = async (e: Etapa, ativo: boolean) => {
    if (!ativo && !(await confirmarSimples({ titulo: `Arquivar “${e.nome}”?`, mensagem: "Os registros que estão nesta etapa continuam nela (nada é apagado). A etapa deixa de ser oferecida para novas movimentações até ser reativada.", confirmar: "Arquivar" }))) return;
    await atualizar(e, { ativo }, ativo ? "Etapa reativada." : "Etapa arquivada.");
  };
  const remover = async (e: Etapa) => {
    if (!(await confirmarSimples({ titulo: `Excluir “${e.nome}”?`, mensagem: "Só é possível excluir etapas nunca utilizadas. Se houver registros vinculados, arquive em vez de excluir.", confirmar: "Excluir", perigo: true }))) return;
    await excluir("etapas", { id: e.id }, "Etapa excluída.");
  };
  const adicionar = async () => {
    if (!nova.trim()) return;
    const ok = await salvar("etapas", { funil, nome: nova.trim(), ordem: (etapas.length + 1) * 10, categoria: "aberta", cor: "#3E5C8A" }, undefined, "Etapa criada.");
    if (ok) setNova("");
  };

  return (
    <div className="flex flex-col gap-2">
      {(faltaGanha || faltaPerdida) && (
        <Aviso tom="alerta">
          O funil precisa de pelo menos uma etapa ativa de {faltaGanha ? "“Contratado (ganho)”" : ""}
          {faltaGanha && faltaPerdida ? " e uma de " : ""}
          {faltaPerdida ? "“Não convertido (perda)”" : ""} para a conversão e os relatórios funcionarem.
        </Aviso>
      )}
      <ol className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
        {etapas.map((e, i) => (
          <li key={e.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${e.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
            <BotoesOrdem
              rotulo={e.nome}
              primeiro={i === 0}
              ultimo={i === etapas.length - 1}
              aoSubir={() => reordenar("etapas", mover(etapas, i, i - 1).map((x) => ({ id: x.id })))}
              aoDescer={() => reordenar("etapas", mover(etapas, i, i + 1).map((x) => ({ id: x.id })))}
            />
            <span className="w-5 text-right text-xs tabular-nums text-crm-tinta-3">{i + 1}</span>
            <BotaoCor cor={e.cor} rotulo={e.nome} aoAlterar={(cor) => atualizar(e, { cor })} />
            <TextoInline valor={e.nome} rotulo={`Nome da etapa ${e.nome}`} aoSalvar={(v) => v && atualizar(e, { nome: v }, "Etapa renomeada.")} className="w-56 font-semibold" />
            <TextoInline valor={e.descricao} rotulo={`Descrição da etapa ${e.nome}`} placeholder="Descrição (opcional)" aoSalvar={(v) => atualizar(e, { descricao: v || null })} className="min-w-40 flex-1 text-crm-tinta-2" />
            {funil === "lead" && (
              <Selecao aria-label={`Tipo da etapa ${e.nome}`} value={e.categoria} onChange={(ev) => atualizar(e, { categoria: ev.target.value })} className="h-8 max-w-56 text-xs">
                {CATEGORIAS_LEAD.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </Selecao>
            )}
            <Alternador ativo={e.ativo} aoAlterar={(v) => alternar(e, v)} rotulo={`${e.ativo ? "Ativa" : "Arquivada"}: ${e.nome}`} />
            <button type="button" onClick={() => remover(e)} className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo" aria-label={`Excluir etapa ${e.nome}`}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ol>
      <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); adicionar(); }}>
        <Entrada aria-label={`Nova etapa (${funil === "lead" ? "funil de leads" : "fases dos casos"})`} placeholder="Nome da nova etapa" value={nova} onChange={(ev) => setNova(ev.target.value)} className="max-w-sm" />
        <Botao type="submit" tamanho="sm" icone={<Plus size={14} />} disabled={!nova.trim()}>
          Adicionar
        </Botao>
      </form>
    </div>
  );
}

export function AdminFunis() {
  return (
    <div className="flex flex-col gap-8">
      <SecaoAdmin titulo="Funil de leads" descricao="Etapas do atendimento comercial. Renomeie, reordene, mude cores ou arquive sem perder o histórico dos leads.">
        <EditorEtapas funil="lead" />
      </SecaoAdmin>
      <SecaoAdmin titulo="Fases dos casos" descricao="Fases usadas no quadro de casos, no Kanban e na ficha do caso.">
        <EditorEtapas funil="caso" />
      </SecaoAdmin>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tipos de demanda
// ---------------------------------------------------------------------------

export function AdminTiposDemanda() {
  const config = useConfig();
  const { salvar, reordenar } = useAdmin();
  const [novo, setNovo] = useState("");
  const tipos = config.tiposDemanda.slice().sort((a, b) => a.ordem - b.ordem);
  const adicionar = async () => {
    if (!novo.trim()) return;
    if (await salvar("tipos_demanda", { nome: novo.trim(), ordem: (tipos.length + 1) * 10 }, undefined, "Tipo de demanda criado.")) setNovo("");
  };
  return (
    <SecaoAdmin titulo="Tipos de demanda" descricao="Cada tipo pode sugerir um modelo de checklist de documentos e um modelo de tarefas de preparação da ação.">
      <ol className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
        {tipos.map((t, i) => (
          <li key={t.id} className={`flex flex-col gap-2 px-3 py-3 ${t.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <BotoesOrdem
                rotulo={t.nome}
                primeiro={i === 0}
                ultimo={i === tipos.length - 1}
                aoSubir={() => reordenar("tipos_demanda", mover(tipos, i, i - 1).map((x) => ({ id: x.id })))}
                aoDescer={() => reordenar("tipos_demanda", mover(tipos, i, i + 1).map((x) => ({ id: x.id })))}
              />
              <BotaoCor cor={t.cor} rotulo={t.nome} aoAlterar={(cor) => salvar("tipos_demanda", { cor }, { id: t.id })} />
              <TextoInline valor={t.nome} rotulo={`Nome do tipo ${t.nome}`} aoSalvar={(v) => v && salvar("tipos_demanda", { nome: v }, { id: t.id }, "Tipo renomeado.")} className="min-w-56 flex-1 font-semibold" />
              <Alternador ativo={t.ativo} aoAlterar={(v) => salvar("tipos_demanda", { ativo: v }, { id: t.id }, v ? "Tipo reativado." : "Tipo arquivado (casos existentes mantêm o tipo).")} rotulo={`${t.ativo ? "Ativo" : "Arquivado"}: ${t.nome}`} />
            </div>
            <div className="grid gap-2 pl-8 sm:grid-cols-3">
              <TextoInline valor={t.descricao} rotulo={`Descrição de ${t.nome}`} placeholder="Descrição (opcional)" aoSalvar={(v) => salvar("tipos_demanda", { descricao: v || null }, { id: t.id })} className="text-crm-tinta-2 sm:col-span-3" />
              <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
                Modelo de checklist
                <Selecao value={t.modelo_checklist_id ?? ""} onChange={(e) => salvar("tipos_demanda", { modelo_checklist_id: e.target.value || null }, { id: t.id }, "Modelo vinculado.")} className="h-8 text-xs">
                  <option value="">Nenhum</option>
                  {config.modelosChecklist.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                      {m.ativo ? "" : " (inativo)"}
                    </option>
                  ))}
                </Selecao>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
                Modelo de tarefas
                <Selecao value={t.modelo_tarefas_id ?? ""} onChange={(e) => salvar("tipos_demanda", { modelo_tarefas_id: e.target.value || null }, { id: t.id }, "Modelo vinculado.")} className="h-8 text-xs">
                  <option value="">Nenhum</option>
                  {config.modelosTarefas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                      {m.ativo ? "" : " (inativo)"}
                    </option>
                  ))}
                </Selecao>
              </label>
            </div>
          </li>
        ))}
      </ol>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
        <Entrada aria-label="Novo tipo de demanda" placeholder="Nome do novo tipo de demanda" value={novo} onChange={(e) => setNovo(e.target.value)} className="max-w-sm" />
        <Botao type="submit" tamanho="sm" icone={<Plus size={14} />} disabled={!novo.trim()}>
          Adicionar
        </Botao>
      </form>
    </SecaoAdmin>
  );
}

// ---------------------------------------------------------------------------
// Listas de opções e etiquetas
// ---------------------------------------------------------------------------

export const LISTAS: { id: string; rotulo: string; descricao: string }[] = [
  { id: "prioridade", rotulo: "Prioridades", descricao: "Usadas em leads, casos, tarefas e prazos." },
  { id: "origem", rotulo: "Origens de leads e clientes", descricao: "Canais de entrada (quiz do site, indicação, Instagram…)." },
  { id: "motivo_perda", rotulo: "Motivos de não conversão", descricao: "Exigidos ao mover um lead para uma etapa de perda." },
  { id: "tipo_interacao", rotulo: "Tipos de contato", descricao: "Registro de ligações, mensagens e reuniões." },
  { id: "tipo_compromisso", rotulo: "Tipos de compromisso", descricao: "Reuniões, audiências e outros eventos da agenda." },
  { id: "tipo_andamento", rotulo: "Tipos de andamento", descricao: "Classificação das movimentações dos processos." },
  { id: "tipo_parte", rotulo: "Qualificação das partes", descricao: "Autor, impetrante, autoridade coatora…" },
  { id: "origem_prazo", rotulo: "Origem dos prazos", descricao: "De onde veio a informação do prazo." },
  { id: "forma_pagamento", rotulo: "Formas de pagamento", descricao: "Registro de pagamentos e reembolsos." },
  { id: "forma_contratacao", rotulo: "Formas de contratação", descricao: "Contratos de honorários." },
];

export function AdminListas() {
  const config = useConfig();
  const { salvar, reordenar } = useAdmin();
  const [lista, setLista] = useState(LISTAS[0].id);
  const [novo, setNovo] = useState("");
  const opcoes = config.opcoesDe(lista, true).slice().sort((a, b) => a.ordem - b.ordem);
  const def = LISTAS.find((l) => l.id === lista)!;
  const adicionar = async () => {
    const rotulo = novo.trim();
    if (!rotulo) return;
    let valor = valorDe(rotulo);
    const existentes = new Set(opcoes.map((o) => o.valor));
    for (let n = 2; existentes.has(valor); n++) valor = `${valorDe(rotulo)}_${n}`;
    if (await salvar("opcoes", { lista, valor, rotulo, ordem: (opcoes.length + 1) * 10, cor: lista === "prioridade" || lista === "tipo_compromisso" ? "#3E5C8A" : null }, undefined, "Opção adicionada.")) setNovo("");
  };
  return (
    <div className="flex flex-col gap-8">
      <SecaoAdmin titulo="Listas de opções" descricao="O identificador interno de cada opção é fixo (mantém os registros antigos); o nome exibido pode ser alterado a qualquer momento.">
        <label className="flex max-w-md flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
          Lista
          <Selecao value={lista} onChange={(e) => setLista(e.target.value)}>
            {LISTAS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.rotulo}
              </option>
            ))}
          </Selecao>
        </label>
        <p className="text-xs text-crm-tinta-3">{def.descricao}</p>
        <ol className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
          {opcoes.map((o, i) => (
            <li key={o.valor} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${o.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
              <BotoesOrdem
                rotulo={o.rotulo}
                primeiro={i === 0}
                ultimo={i === opcoes.length - 1}
                aoSubir={() => reordenar("opcoes", mover(opcoes, i, i - 1).map((x) => ({ lista, valor: x.valor })))}
                aoDescer={() => reordenar("opcoes", mover(opcoes, i, i + 1).map((x) => ({ lista, valor: x.valor })))}
              />
              <BotaoCor cor={o.cor} rotulo={o.rotulo} aoAlterar={(cor) => salvar("opcoes", { cor }, { lista, valor: o.valor })} />
              <TextoInline valor={o.rotulo} rotulo={`Nome da opção ${o.rotulo}`} aoSalvar={(v) => v && salvar("opcoes", { rotulo: v }, { lista, valor: o.valor }, "Opção renomeada.")} className="min-w-48 flex-1" />
              <code className="hidden text-[11px] text-crm-tinta-3 sm:inline">{o.valor}</code>
              {o.sistema ? (
                <span className="text-[11px] font-semibold text-crm-tinta-3" title="Usada por regras do sistema: pode ser renomeada, mas não arquivada.">
                  do sistema
                </span>
              ) : (
                <Alternador ativo={o.ativo} aoAlterar={(v) => salvar("opcoes", { ativo: v }, { lista, valor: o.valor }, v ? "Opção reativada." : "Opção arquivada (registros existentes mantêm o valor).")} rotulo={`${o.ativo ? "Ativa" : "Arquivada"}: ${o.rotulo}`} />
              )}
            </li>
          ))}
        </ol>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <Entrada aria-label={`Nova opção em ${def.rotulo}`} placeholder="Nova opção" value={novo} onChange={(e) => setNovo(e.target.value)} className="max-w-sm" />
          <Botao type="submit" tamanho="sm" icone={<Plus size={14} />} disabled={!novo.trim()}>
            Adicionar
          </Botao>
        </form>
      </SecaoAdmin>
      <AdminEtiquetas />
    </div>
  );
}

const ESCOPOS = [
  { id: "lead", rotulo: "Leads" },
  { id: "cliente", rotulo: "Clientes" },
  { id: "caso", rotulo: "Casos" },
  { id: "tarefa", rotulo: "Tarefas" },
];

function AdminEtiquetas() {
  const config = useConfig();
  const { salvar, excluir } = useAdmin();
  const [nova, setNova] = useState("");
  const etiquetas = config.etiquetas;
  return (
    <SecaoAdmin titulo="Etiquetas" descricao="Marcadores coloridos aplicáveis a leads, clientes, casos e tarefas.">
      <ul className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
        {etiquetas.map((e) => (
          <li key={e.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${e.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
            <BotaoCor cor={e.cor} rotulo={e.nome} aoAlterar={(cor) => salvar("etiquetas", { cor }, { id: e.id })} />
            <Pilula cor={e.cor} preenchida={false}>
              {e.nome}
            </Pilula>
            <TextoInline valor={e.nome} rotulo={`Nome da etiqueta ${e.nome}`} aoSalvar={(v) => v && salvar("etiquetas", { nome: v }, { id: e.id }, "Etiqueta renomeada.")} className="w-48" />
            <span className="flex flex-wrap gap-3">
              {ESCOPOS.map((s) => (
                <CaixaSelecao
                  key={s.id}
                  marcado={e.escopos.includes(s.id)}
                  rotulo={s.rotulo}
                  aoAlterar={(v) => salvar("etiquetas", { escopos: v ? [...new Set([...e.escopos, s.id])] : e.escopos.filter((x) => x !== s.id) }, { id: e.id })}
                />
              ))}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <Alternador ativo={e.ativo} aoAlterar={(v) => salvar("etiquetas", { ativo: v }, { id: e.id })} rotulo={`${e.ativo ? "Ativa" : "Arquivada"}: ${e.nome}`} />
              <button
                type="button"
                onClick={async () => {
                  if (await confirmarSimples({ titulo: `Excluir a etiqueta “${e.nome}”?`, mensagem: "Ela será removida da lista de etiquetas. Registros que já a usam passam a exibir a etiqueta como removida. Prefira arquivar.", confirmar: "Excluir", perigo: true }))
                    excluir("etiquetas", { id: e.id }, "Etiqueta excluída.");
                }}
                className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                aria-label={`Excluir etiqueta ${e.nome}`}
              >
                <Trash2 size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (nova.trim() && (await salvar("etiquetas", { nome: nova.trim() }, undefined, "Etiqueta criada."))) setNova("");
        }}
      >
        <Entrada aria-label="Nova etiqueta" placeholder="Nome da nova etiqueta" value={nova} onChange={(e) => setNova(e.target.value)} className="max-w-sm" />
        <Botao type="submit" tamanho="sm" icone={<Plus size={14} />} disabled={!nova.trim()}>
          Adicionar
        </Botao>
      </form>
    </SecaoAdmin>
  );
}
