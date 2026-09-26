"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { aviso, comSalvamento } from "../../_lib/avisos";
import { opcoesLista, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { idCurto } from "../../_lib/formatos";
import { useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { ModeloTarefas } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { Alternador, AreaTexto, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Carregando, ErroCarga, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { BotoesOrdem, mover, SecaoAdmin, useAdmin } from "./comum";

interface ItemModelo {
  id: string;
  titulo: string;
  descricao?: string;
  prazo_dias?: number | null;
  prioridade?: string;
  responsavel?: { tipo: "responsavel_caso" | "usuario" | "perfil"; valor?: string };
  depende_de?: string | null;
  checklist?: string[];
}

export function AdminModelosTarefas() {
  const { parametro, definirParametros } = useRota();
  const id = parametro("modelo_tarefas");
  if (id) return <EditorModeloTarefas id={id} aoVoltar={() => definirParametros({ modelo_tarefas: null })} />;
  return <ListaModelosTarefas aoAbrir={(i) => definirParametros({ modelo_tarefas: i })} />;
}

function ListaModelosTarefas({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const config = useConfig();
  const { salvar } = useAdmin();
  const { invalidar } = useGravacao();
  const consulta = useQuery({
    queryKey: ["modelos", "tarefas", "lista"],
    queryFn: async () => (await executar(supabase().from("modelos_tarefas").select("*").order("nome"))) as ModeloTarefas[],
  });
  const criar = async () => {
    try {
      const novo = (await comSalvamento(() => executar(supabase().from("modelos_tarefas").insert({ nome: "Novo modelo de tarefas", itens: [] }).select("id").single()))) as { id: string };
      invalidar("config", "modelos");
      aoAbrir(novo.id);
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  const lista = consulta.data ?? [];
  return (
    <SecaoAdmin
      titulo="Modelos de tarefas e etapas de preparação da ação"
      descricao="Sequências de tarefas criadas automaticamente ao abrir um caso (quando o tipo de demanda tem o modelo vinculado) ou aplicadas manualmente. Prazos contam em dias a partir da criação."
      acoes={
        <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={criar}>
          Novo modelo
        </Botao>
      }
    >
      {lista.length === 0 ? (
        <Vazio compacto titulo="Nenhum modelo de tarefas" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((m) => {
            const itens = (Array.isArray(m.itens) ? m.itens : []) as unknown as ItemModelo[];
            return (
              <li key={m.id} className={`flex flex-col gap-2 rounded-2xl border border-crm-linha bg-white p-4 ${m.ativo ? "" : "opacity-75"}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.nome}</p>
                    <p className="text-xs text-crm-tinta-3">
                      {itens.length} tarefa(s) · {config.tiposDemanda.filter((t) => t.modelo_tarefas_id === m.id).map((t) => t.nome).join(", ") || "não vinculado a tipo de demanda"}
                    </p>
                  </div>
                  {m.ativo ? <Selo tom="sucesso">Ativo</Selo> : <Selo>Inativo</Selo>}
                </div>
                {m.descricao && <p className="text-sm text-crm-tinta-2">{m.descricao}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Botao tamanho="sm" icone={<Pencil size={13} />} onClick={() => aoAbrir(m.id)}>
                    Editar
                  </Botao>
                  <Alternador ativo={m.ativo} mostrarRotulo rotulo={m.ativo ? "Disponível" : "Indisponível"} aoAlterar={(v) => salvar("modelos_tarefas", { ativo: v }, { id: m.id }, v ? "Modelo ativado." : "Modelo desativado.", ["config", "modelos"])} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SecaoAdmin>
  );
}

function EditorModeloTarefas({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const config = useConfig();
  const { salvar } = useAdmin();
  const consulta = useQuery({
    queryKey: ["modelos", "tarefas", id],
    queryFn: async () => (await executar(supabase().from("modelos_tarefas").select("*").eq("id", id).maybeSingle())) as ModeloTarefas | null,
  });
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [itens, setItens] = useState<ItemModelo[]>([]);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const m = consulta.data;

  useEffect(() => {
    if (!m) return;
    setNome(m.nome);
    setDescricao(m.descricao ?? "");
    setTipo(m.tipo_demanda_id ?? "");
    setItens(((Array.isArray(m.itens) ? m.itens : []) as unknown as ItemModelo[]).map((i) => ({ ...i, id: i.id || idCurto() })));
    setAlterado(false);
  }, [m]);

  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  if (!m) return <Vazio titulo="Modelo não encontrado" acao={<Botao onClick={aoVoltar}>Voltar</Botao>} />;

  const mudar = (i: number, alt: Partial<ItemModelo>) => {
    setItens((x) => x.map((y, j) => (j === i ? { ...y, ...alt } : y)));
    setAlterado(true);
  };
  const salvarTudo = async () => {
    if (!nome.trim()) return;
    const validos = itens.filter((i) => i.titulo.trim());
    setSalvando(true);
    const ok = await salvar(
      "modelos_tarefas",
      {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        tipo_demanda_id: tipo || null,
        itens: validos.map((i) => ({
          id: i.id,
          titulo: i.titulo.trim(),
          ...(i.descricao?.trim() ? { descricao: i.descricao.trim() } : {}),
          ...(i.prazo_dias !== null && i.prazo_dias !== undefined && !Number.isNaN(i.prazo_dias) ? { prazo_dias: i.prazo_dias } : {}),
          prioridade: i.prioridade ?? "media",
          responsavel: i.responsavel ?? { tipo: "responsavel_caso" },
          ...(i.depende_de && validos.some((v) => v.id === i.depende_de) ? { depende_de: i.depende_de } : {}),
          ...(i.checklist?.filter((c) => c.trim()).length ? { checklist: i.checklist.filter((c) => c.trim()) } : {}),
        })),
      },
      { id: m.id },
      "Modelo de tarefas salvo. Vale para os próximos casos.",
      ["config", "modelos"],
    );
    setSalvando(false);
    if (ok) setAlterado(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={async () => {
          if (!alterado || (await confirmarSimples({ titulo: "Sair sem salvar?", mensagem: "As alterações feitas neste modelo serão perdidas.", confirmar: "Sair sem salvar", perigo: true }))) aoVoltar();
        }}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-crm-tinta-2 hover:text-crm-tinta"
      >
        <ArrowLeft size={15} aria-hidden /> Modelos de tarefas
      </button>
      <SecaoAdmin
        titulo="Editar modelo de tarefas"
        acoes={
          <Botao variante="primario" tamanho="sm" carregando={salvando} onClick={salvarTudo} disabled={!alterado}>
            {alterado ? "Salvar alterações" : "Tudo salvo"}
          </Botao>
        }
      >
        <div className="grid gap-4 rounded-2xl border border-crm-linha bg-white p-4 sm:grid-cols-2">
          <GrupoCampo rotulo="Nome" obrigatorio>{(p) => <Entrada {...p} value={nome} onChange={(e) => { setNome(e.target.value); setAlterado(true); }} />}</GrupoCampo>
          <GrupoCampo rotulo="Tipo de demanda (referência)">
            {(p) => (
              <Selecao {...p} value={tipo} onChange={(e) => { setTipo(e.target.value); setAlterado(true); }}>
                <option value="">Nenhum</option>
                {config.tiposDemanda.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </GrupoCampo>
          <GrupoCampo rotulo="Descrição" className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={descricao} onChange={(e) => { setDescricao(e.target.value); setAlterado(true); }} />}</GrupoCampo>
          <p className="text-xs text-crm-tinta-3 sm:col-span-2">Para aplicar este modelo automaticamente, vincule-o a um tipo de demanda em Administração → Tipos de demanda.</p>
        </div>
        <ol className="flex flex-col gap-3">
          {itens.map((it, i) => (
            <li key={it.id} className="flex gap-2 rounded-2xl border border-crm-linha bg-white p-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-crm-verde text-xs font-bold text-white">{i + 1}</span>
                <BotoesOrdem rotulo={it.titulo || `tarefa ${i + 1}`} primeiro={i === 0} ultimo={i === itens.length - 1} aoSubir={() => { setItens((x) => mover(x, i, i - 1)); setAlterado(true); }} aoDescer={() => { setItens((x) => mover(x, i, i + 1)); setAlterado(true); }} />
              </div>
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-4">
                <GrupoCampo rotulo="Tarefa" obrigatorio className="sm:col-span-4">{(p) => <Entrada {...p} value={it.titulo} onChange={(e) => mudar(i, { titulo: e.target.value })} />}</GrupoCampo>
                <GrupoCampo rotulo="Prazo (dias)">{(p) => <Entrada {...p} type="number" min={0} max={365} value={it.prazo_dias ?? ""} onChange={(e) => mudar(i, { prazo_dias: e.target.value === "" ? null : Number(e.target.value) })} />}</GrupoCampo>
                <GrupoCampo rotulo="Prioridade">
                  {(p) => (
                    <Selecao {...p} value={it.prioridade ?? "media"} onChange={(e) => mudar(i, { prioridade: e.target.value })}>
                      {opcoesLista(config, "prioridade").map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </GrupoCampo>
                <GrupoCampo rotulo="Responsável">
                  {(p) => (
                    <Selecao
                      {...p}
                      value={it.responsavel?.tipo === "usuario" ? `u:${it.responsavel.valor}` : it.responsavel?.tipo === "perfil" ? `p:${it.responsavel.valor}` : "caso"}
                      onChange={(e) => {
                        const v = e.target.value;
                        mudar(i, { responsavel: v === "caso" ? { tipo: "responsavel_caso" } : v.startsWith("u:") ? { tipo: "usuario", valor: v.slice(2) } : { tipo: "perfil", valor: v.slice(2) } });
                      }}
                    >
                      <option value="caso">Responsável pelo caso</option>
                      <optgroup label="Perfil">
                        {config.perfis.map((pf) => (
                          <option key={pf.id} value={`p:${pf.id}`}>
                            Alguém do perfil {pf.nome}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Pessoa">
                        {opcoesUsuarios(config, false).map((u) => (
                          <option key={u.valor} value={`u:${u.valor}`}>
                            {u.rotulo}
                          </option>
                        ))}
                      </optgroup>
                    </Selecao>
                  )}
                </GrupoCampo>
                <GrupoCampo rotulo="Depende de">
                  {(p) => (
                    <Selecao {...p} value={it.depende_de ?? ""} onChange={(e) => mudar(i, { depende_de: e.target.value || null })}>
                      <option value="">Nenhuma</option>
                      {itens.slice(0, i).map((x, j) => (
                        <option key={x.id} value={x.id}>
                          {j + 1}. {x.titulo || "(sem título)"}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </GrupoCampo>
                <GrupoCampo rotulo="Descrição" className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={it.descricao ?? ""} onChange={(e) => mudar(i, { descricao: e.target.value })} />}</GrupoCampo>
                <GrupoCampo rotulo="Checklist da tarefa" ajuda="Um item por linha." className="sm:col-span-2">
                  {(p) => <AreaTexto {...p} rows={2} value={(it.checklist ?? []).join("\n")} onChange={(e) => mudar(i, { checklist: e.target.value.split("\n") })} />}
                </GrupoCampo>
              </div>
              <button
                type="button"
                onClick={() => {
                  setItens((x) => x.filter((_, j) => j !== i).map((y) => (y.depende_de === it.id ? { ...y, depende_de: null } : y)));
                  setAlterado(true);
                }}
                className="self-start rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                aria-label={`Remover tarefa ${it.titulo || i + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ol>
        <Botao
          tamanho="sm"
          icone={<Plus size={14} />}
          className="self-start"
          onClick={() => {
            setItens((x) => [...x, { id: idCurto(), titulo: "", prazo_dias: null, prioridade: "media", responsavel: { tipo: "responsavel_caso" }, depende_de: x.length ? x[x.length - 1].id : null, checklist: [] }]);
            setAlterado(true);
          }}
        >
          Adicionar tarefa
        </Botao>
        <p className="text-xs text-crm-tinta-3">
          <Pilula cor="#E9E1D0">Dependências</Pilula> indicam a ordem de execução: a tarefa só deve começar após a anterior ser concluída (o quadro de tarefas destaca a dependência).
        </p>
      </SecaoAdmin>
    </div>
  );
}
