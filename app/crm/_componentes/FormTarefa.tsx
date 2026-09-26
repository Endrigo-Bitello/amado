"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../_lib/auth";
import { opcoesLista, opcoesUsuarios } from "../_lib/colunas";
import { useConfig } from "../_lib/config";
import { fimDiaSP, instanteSP, somarDias, hojeSP } from "../_lib/datas";
import { useGravacao } from "../_lib/dados";
import { idCurto } from "../_lib/formatos";
import type { Tarefa } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo } from "../_ui/Campos";
import { SeletorCampo } from "../_ui/Seletores";
import { Modal } from "../_ui/Sobreposicoes";
import { SeletorRegistro, type RegistroSelecionado } from "./SeletorRegistro";

export interface VinculoTarefa {
  lead?: { id: string; titulo: string } | null;
  cliente?: { id: string; titulo: string } | null;
  caso?: { id: string; titulo: string } | null;
}

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  vinculo?: VinculoTarefa;
  dataInicial?: string;
  aoCriar?: (t: Tarefa) => void;
}

export function FormTarefa({ aberto, aoFechar, vinculo, dataInicial, aoCriar }: Props) {
  const { perfil, pode } = useAuth();
  const config = useConfig();
  const { inserir } = useGravacao();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [data, setData] = useState("");
  const [comHora, setComHora] = useState(false);
  const [hora, setHora] = useState("09:00");
  const [prioridade, setPrioridade] = useState<string | null>("media");
  const [registro, setRegistro] = useState<RegistroSelecionado | null>(null);
  const [checklist, setChecklist] = useState<{ id: string; texto: string; feito: boolean }[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vinculoFixo = vinculo?.caso
    ? ({ tipo: "caso", id: vinculo.caso.id, titulo: vinculo.caso.titulo } as RegistroSelecionado)
    : vinculo?.cliente
      ? ({ tipo: "cliente", id: vinculo.cliente.id, titulo: vinculo.cliente.titulo } as RegistroSelecionado)
      : vinculo?.lead
        ? ({ tipo: "lead", id: vinculo.lead.id, titulo: vinculo.lead.titulo } as RegistroSelecionado)
        : null;

  useEffect(() => {
    if (!aberto) return;
    setTitulo("");
    setDescricao("");
    setResponsavel(perfil?.id ?? null);
    setData(dataInicial ?? somarDias(hojeSP(), 1));
    setComHora(false);
    setHora("09:00");
    setPrioridade("media");
    setRegistro(vinculoFixo);
    setChecklist([]);
    setNovoItem("");
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const podeAtribuirOutros = pode("tarefas.editar");

  const salvar = async () => {
    if (!titulo.trim()) {
      setErro("Informe o título da tarefa.");
      return;
    }
    setSalvando(true);
    try {
      const criada = await inserir<Tarefa>(
        "tarefas",
        {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          responsavel_id: podeAtribuirOutros ? responsavel : perfil?.id,
          prazo: data ? (comHora ? instanteSP(data, hora) : fimDiaSP(data)) : null,
          prazo_dia_inteiro: !comHora,
          prioridade: prioridade ?? "media",
          lead_id: registro?.tipo === "lead" ? registro.id : null,
          cliente_id: registro?.tipo === "cliente" ? registro.id : null,
          caso_id: registro?.tipo === "caso" ? registro.id : null,
          checklist,
        },
        { chaves: ["tarefas", "painel", "eventos"], mensagemSucesso: "Tarefa criada." },
      );
      aoCriar?.(criada);
      aoFechar();
    } catch {
      /* aviso exibido pela camada de dados */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova tarefa"
      largura="md"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            Criar tarefa
          </Botao>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <GrupoCampo rotulo="Título" obrigatorio erro={erro} className="sm:col-span-2">
          {(p) => <Entrada {...p} data-autofoco value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para confirmar documentos" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Responsável">
          {(p) => (
            <SeletorCampo
              {...p}
              rotulo="Responsável"
              valor={responsavel}
              estilo="pessoa"
              opcoes={opcoesUsuarios(config, false)}
              aoAlterar={setResponsavel}
              desabilitado={!podeAtribuirOutros}
              rotuloVazio="Sem responsável"
            />
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Prioridade">
          {(p) => <SeletorCampo {...p} rotulo="Prioridade" valor={prioridade} estilo="pilula" opcoes={opcoesLista(config, "prioridade")} aoAlterar={setPrioridade} permitirVazio={false} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Prazo" ajuda={comHora ? "Horário de Brasília." : "Vence ao fim do dia."}>
          {(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}
        </GrupoCampo>
        <div className="flex flex-col justify-end gap-2">
          <CaixaSelecao marcado={comHora} aoAlterar={setComHora} rotulo="Definir horário" />
          {comHora && <Entrada type="time" aria-label="Horário" value={hora} onChange={(e) => setHora(e.target.value)} />}
        </div>
        <GrupoCampo rotulo="Vinculada a" className="sm:col-span-2" ajuda="Lead, cliente ou caso relacionado (opcional).">
          {(p) => <SeletorRegistro {...p} valor={registro} aoAlterar={setRegistro} desabilitado={Boolean(vinculoFixo)} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Descrição" className="sm:col-span-2">
          {(p) => <AreaTexto {...p} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}
        </GrupoCampo>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-crm-tinta-2">Checklist da tarefa</span>
          {checklist.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="flex-1 rounded-lg bg-crm-suave px-3 py-1.5 text-sm">{c.texto}</span>
              <button type="button" onClick={() => setChecklist((l) => l.filter((x) => x.id !== c.id))} className="rounded p-1 text-crm-tinta-3 hover:text-crm-perigo" aria-label={`Remover ${c.texto}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Entrada
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              placeholder="Adicionar subitem"
              aria-label="Novo subitem do checklist"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (novoItem.trim()) {
                    setChecklist((l) => [...l, { id: idCurto(), texto: novoItem.trim(), feito: false }]);
                    setNovoItem("");
                  }
                }
              }}
            />
            <Botao
              variante="secundario"
              tamanho="icone"
              aria-label="Adicionar subitem"
              onClick={() => {
                if (novoItem.trim()) {
                  setChecklist((l) => [...l, { id: idCurto(), texto: novoItem.trim(), feito: false }]);
                  setNovoItem("");
                }
              }}
            >
              <Plus size={16} />
            </Botao>
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
