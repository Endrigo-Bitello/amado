"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../_lib/auth";
import { opcoesLista, opcoesUsuarios } from "../_lib/colunas";
import { useConfig } from "../_lib/config";
import { hojeSP, instanteSP, dataSP, horaSP } from "../_lib/datas";
import { useGravacao } from "../_lib/dados";
import type { Compromisso } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../_ui/Campos";
import { confirmarSimples } from "../_ui/Dialogos";
import { SeletorCampo, SeletorMultiplo } from "../_ui/Seletores";
import { Modal } from "../_ui/Sobreposicoes";
import { SeletorRegistro, type RegistroSelecionado } from "./SeletorRegistro";
import type { VinculoTarefa } from "./FormTarefa";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  vinculo?: VinculoTarefa;
  dataInicial?: string;
  compromisso?: Compromisso | null;
  tipoInicial?: string;
}

const LEMBRETES = [
  { valor: 0, rotulo: "Sem lembrete" },
  { valor: 15, rotulo: "15 minutos antes" },
  { valor: 60, rotulo: "1 hora antes" },
  { valor: 1440, rotulo: "1 dia antes" },
];

export function FormCompromisso({ aberto, aoFechar, vinculo, dataInicial, compromisso, tipoInicial }: Props) {
  const { perfil, pode, desenvolvedor } = useAuth();
  const config = useConfig();
  const { inserir, atualizar, excluir } = useGravacao();
  const [tipo, setTipo] = useState<string | null>("reuniao");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(hojeSP());
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("10:00");
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [local, setLocal] = useState("");
  const [link, setLink] = useState("");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [registro, setRegistro] = useState<RegistroSelecionado | null>(null);
  const [descricao, setDescricao] = useState("");
  const [lembrete, setLembrete] = useState(60);
  const [status, setStatus] = useState("agendado");
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
    setErro(null);
    if (compromisso) {
      setTipo(compromisso.tipo);
      setTitulo(compromisso.titulo);
      setData(dataSP(compromisso.inicio));
      setInicio(horaSP(compromisso.inicio));
      setFim(compromisso.fim ? horaSP(compromisso.fim) : horaSP(compromisso.inicio));
      setDiaInteiro(compromisso.dia_inteiro);
      setLocal(compromisso.local ?? "");
      setLink(compromisso.link_reuniao ?? "");
      setResponsavel(compromisso.responsavel_id);
      setParticipantes(compromisso.participantes);
      setDescricao(compromisso.descricao ?? "");
      setLembrete(compromisso.lembrete_minutos ?? 0);
      setStatus(compromisso.status);
      setRegistro(null);
      return;
    }
    setTipo(tipoInicial ?? "reuniao");
    setTitulo("");
    setData(dataInicial ?? hojeSP());
    setInicio("09:00");
    setFim("10:00");
    setDiaInteiro(false);
    setLocal("");
    setLink("");
    setResponsavel(perfil?.id ?? null);
    setParticipantes([]);
    setRegistro(vinculoFixo);
    setDescricao("");
    setLembrete(60);
    setStatus("agendado");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, compromisso]);

  const salvar = async () => {
    if (!titulo.trim()) return setErro("Informe o título.");
    if (!diaInteiro && fim < inicio) return setErro("O horário de término deve ser após o início.");
    if (link && !/^https?:\/\//i.test(link)) return setErro("O link da videochamada deve começar com https://");
    setSalvando(true);
    const dados = {
      tipo: tipo ?? "reuniao",
      titulo: titulo.trim(),
      inicio: diaInteiro ? instanteSP(data, "00:00") : instanteSP(data, inicio),
      fim: diaInteiro ? instanteSP(data, "23:59") : instanteSP(data, fim),
      dia_inteiro: diaInteiro,
      local: local.trim() || null,
      link_reuniao: link.trim() || null,
      responsavel_id: pode("agenda.editar") ? responsavel : perfil?.id,
      participantes,
      descricao: descricao.trim() || null,
      lembrete_minutos: lembrete || null,
      status,
    };
    try {
      if (compromisso) {
        await atualizar("compromissos", compromisso.id, dados, { chaves: ["compromissos", "agenda", "painel"], mensagemSucesso: "Compromisso atualizado." });
      } else {
        await inserir(
          "compromissos",
          {
            ...dados,
            lead_id: registro?.tipo === "lead" ? registro.id : null,
            cliente_id: registro?.tipo === "cliente" ? registro.id : null,
            caso_id: registro?.tipo === "caso" ? registro.id : null,
          },
          { chaves: ["compromissos", "agenda", "painel", "eventos"], mensagemSucesso: "Compromisso agendado." },
        );
      }
      aoFechar();
    } catch {
      /* aviso exibido pela camada de dados */
    } finally {
      setSalvando(false);
    }
  };

  const excluirCompromisso = async () => {
    if (!compromisso) return;
    if (!(await confirmarSimples({ titulo: "Excluir compromisso?", mensagem: `“${compromisso.titulo}” será apagado da agenda. Esta ação não pode ser desfeita.`, confirmar: "Excluir definitivamente", perigo: true }))) return;
    try {
      await excluir("compromissos", compromisso.id, { chaves: ["compromissos", "agenda", "painel", "eventos"], mensagemSucesso: "Compromisso excluído." });
      aoFechar();
    } catch {
      /* aviso exibido pela camada de dados */
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={compromisso ? "Editar compromisso" : "Novo compromisso"}
      descricao="Horários no fuso de Brasília (America/Sao_Paulo)."
      largura="md"
      rodape={
        <>
          {compromisso && desenvolvedor && (
            <Botao variante="perigo" icone={<Trash2 size={14} />} onClick={excluirCompromisso} className="sm:mr-auto">
              Excluir
            </Botao>
          )}
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            {compromisso ? "Salvar" : "Agendar"}
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
        <GrupoCampo rotulo="Tipo">
          {(p) => <SeletorCampo {...p} rotulo="Tipo" valor={tipo} estilo="pilula" opcoes={opcoesLista(config, "tipo_compromisso")} aoAlterar={setTipo} permitirVazio={false} />}
        </GrupoCampo>
        {compromisso ? (
          <GrupoCampo rotulo="Situação">
            {(p) => (
              <Selecao {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="agendado">Agendado</option>
                <option value="realizado">Realizado</option>
                <option value="remarcado">Remarcado</option>
                <option value="nao_compareceu">Não compareceu</option>
                <option value="cancelado">Cancelado</option>
              </Selecao>
            )}
          </GrupoCampo>
        ) : (
          <div />
        )}
        <GrupoCampo rotulo="Título" obrigatorio erro={erro} className="sm:col-span-2">
          {(p) => <Entrada {...p} data-autofoco value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião inicial com a cliente" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Data" obrigatorio>
          {(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}
        </GrupoCampo>
        <div className="flex items-end">
          <CaixaSelecao marcado={diaInteiro} aoAlterar={setDiaInteiro} rotulo="Dia inteiro" />
        </div>
        {!diaInteiro && (
          <>
            <GrupoCampo rotulo="Início">
              {(p) => <Entrada {...p} type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />}
            </GrupoCampo>
            <GrupoCampo rotulo="Término">
              {(p) => <Entrada {...p} type="time" value={fim} onChange={(e) => setFim(e.target.value)} />}
            </GrupoCampo>
          </>
        )}
        <GrupoCampo rotulo="Local">
          {(p) => <Entrada {...p} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Escritório, fórum, endereço…" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Link da videochamada">
          {(p) => <Entrada {...p} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Responsável">
          {(p) => (
            <SeletorCampo {...p} rotulo="Responsável" valor={responsavel} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={setResponsavel} desabilitado={!pode("agenda.editar")} />
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Lembrete">
          {(p) => (
            <Selecao {...p} value={lembrete} onChange={(e) => setLembrete(Number(e.target.value))}>
              {LEMBRETES.map((l) => (
                <option key={l.valor} value={l.valor}>
                  {l.rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Participantes da equipe" className="sm:col-span-2">
          {(p) => (
            <SeletorMultiplo
              id={p.id}
              rotulo="Participantes"
              estilo="pessoa"
              valores={participantes}
              opcoes={opcoesUsuarios(config, false).filter((u) => u.valor !== responsavel)}
              aoAlterar={setParticipantes}
            />
          )}
        </GrupoCampo>
        {!compromisso && (
          <GrupoCampo rotulo="Vinculado a" className="sm:col-span-2">
            {(p) => <SeletorRegistro {...p} valor={registro} aoAlterar={setRegistro} desabilitado={Boolean(vinculoFixo)} />}
          </GrupoCampo>
        )}
        <GrupoCampo rotulo="Observações" className="sm:col-span-2">
          {(p) => <AreaTexto {...p} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}
        </GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
