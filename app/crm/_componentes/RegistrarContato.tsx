"use client";

import { useEffect, useState } from "react";
import { opcoesLista } from "../_lib/colunas";
import { useConfig } from "../_lib/config";
import { dataSP, horaSP, instanteSP } from "../_lib/datas";
import { useGravacao } from "../_lib/dados";
import { Botao } from "../_ui/Botao";
import { AreaTexto, Entrada, GrupoCampo, Selecao } from "../_ui/Campos";
import { SeletorCampo } from "../_ui/Seletores";
import { Modal } from "../_ui/Sobreposicoes";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  vinculo: { lead_id?: string | null; cliente_id?: string | null; caso_id?: string | null };
  /** Para leads: permite atualizar a próxima ação no mesmo passo. */
  proximaAcao?: boolean;
}

export function RegistrarContato({ aberto, aoFechar, vinculo, proximaAcao }: Props) {
  const config = useConfig();
  const { inserir, atualizar } = useGravacao();
  const [tipo, setTipo] = useState<string | null>("whatsapp");
  const [direcao, setDirecao] = useState("saida");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [resumo, setResumo] = useState("");
  const [resultado, setResultado] = useState("");
  const [acao, setAcao] = useState("");
  const [acaoData, setAcaoData] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const agora = new Date().toISOString();
    setTipo("whatsapp");
    setDirecao("saida");
    setData(dataSP(agora));
    setHora(horaSP(agora));
    setResumo("");
    setResultado("");
    setAcao("");
    setAcaoData("");
    setErro(null);
  }, [aberto]);

  const salvar = async () => {
    if (!resumo.trim()) return setErro("Descreva brevemente o contato.");
    setSalvando(true);
    try {
      await inserir(
        "interacoes",
        {
          tipo: tipo ?? "nota",
          direcao: tipo === "nota" ? null : direcao,
          resumo: resumo.trim(),
          resultado: resultado.trim() || null,
          ocorrida_em: instanteSP(data, hora || "12:00"),
          lead_id: vinculo.lead_id ?? null,
          cliente_id: vinculo.cliente_id ?? null,
          caso_id: vinculo.caso_id ?? null,
        },
        { chaves: ["interacoes", "eventos", "leads", "painel"], mensagemSucesso: "Contato registrado no histórico." },
      );
      if (proximaAcao && vinculo.lead_id && (acao.trim() || acaoData)) {
        await atualizar(
          "leads",
          vinculo.lead_id,
          { proxima_acao: acao.trim() || null, proxima_acao_em: acaoData ? instanteSP(acaoData, "09:00") : null },
          { chaves: ["leads", "painel"] },
        );
      }
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
      titulo="Registrar contato"
      descricao="O registro entra no histórico cronológico e conta para o indicador de primeiro contato."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            Registrar
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
        <GrupoCampo rotulo="Tipo de contato">
          {(p) => <SeletorCampo {...p} rotulo="Tipo" valor={tipo} opcoes={opcoesLista(config, "tipo_interacao")} aoAlterar={setTipo} permitirVazio={false} estilo="pilula" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Direção">
          {(p) => (
            <Selecao {...p} value={direcao} onChange={(e) => setDirecao(e.target.value)} disabled={tipo === "nota"}>
              <option value="saida">Escritório → pessoa</option>
              <option value="entrada">Pessoa → escritório</option>
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Data">{(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Hora">{(p) => <Entrada {...p} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Resumo" obrigatorio erro={erro} className="sm:col-span-2">
          {(p) => <AreaTexto {...p} data-autofoco rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="O que foi conversado?" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Resultado" className="sm:col-span-2" ajuda="Ex.: agendou reunião, pediu retorno, sem resposta.">
          {(p) => <Entrada {...p} value={resultado} onChange={(e) => setResultado(e.target.value)} />}
        </GrupoCampo>
        {proximaAcao && (
          <>
            <GrupoCampo rotulo="Próxima ação">{(p) => <Entrada {...p} value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Ex.: enviar proposta" />}</GrupoCampo>
            <GrupoCampo rotulo="Data da próxima ação">{(p) => <Entrada {...p} type="date" value={acaoData} onChange={(e) => setAcaoData(e.target.value)} />}</GrupoCampo>
          </>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
