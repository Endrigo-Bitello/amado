"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Film, Link2, Lock, Plus, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../_lib/auth";
import { aviso } from "../_lib/avisos";
import { formatarDataHora } from "../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../_lib/dados";
import { supabase } from "../_lib/supabase";
import type { Midia } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { AreaTexto, Entrada, GrupoCampo, Selecao } from "../_ui/Campos";
import { confirmarSimples } from "../_ui/Dialogos";
import { Modal } from "../_ui/Sobreposicoes";
import { Carregando, Selo, Vazio } from "../_ui/Visuais";
import { abrirArquivo, enviarArquivo } from "./Arquivos";

const VISIBILIDADE = {
  equipe: { rotulo: "Toda a equipe com acesso ao cliente/caso", icone: <Users size={11} aria-hidden /> },
  saude: { rotulo: "Somente quem pode ver dados de saúde", icone: <Lock size={11} aria-hidden /> },
  responsaveis: { rotulo: "Somente responsáveis e administradores", icone: <Lock size={11} aria-hidden /> },
};

type ArquivoMidia = { id: string; bucket: string; caminho: string; nome: string };

/** Vídeos (links ou arquivos) relacionados ao cliente ou caso, com descrição e visibilidade. */
export function Midias({ clienteId, casoId }: { clienteId?: string | null; casoId?: string | null }) {
  const { pode } = useAuth();
  const { excluir } = useGravacao();
  const [novo, setNovo] = useState(false);
  const coluna = casoId ? "caso_id" : "cliente_id";
  const id = casoId ?? clienteId!;
  const consulta = useQuery({
    queryKey: ["midias", coluna, id],
    queryFn: async () => (await executar(supabase().from("midias").select("*, arquivo:arquivos(id, bucket, caminho, nome)").eq(coluna, id).order("created_at", { ascending: false }))) as unknown as (Midia & { arquivo: ArquivoMidia | null })[],
  });
  const lista = consulta.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Vídeos e mídias</h3>
        {pode("documentos.editar") && (
          <Botao tamanho="sm" variante="secundario" icone={<Plus size={14} />} onClick={() => setNovo(true)}>
            Adicionar vídeo
          </Botao>
        )}
      </div>
      {consulta.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio compacto icone={<Film size={18} />} titulo="Nenhum vídeo" descricao="Adicione links (YouTube, Drive…) ou envie arquivos de vídeo, com descrição e visibilidade." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((m) => (
            <li key={m.id} className="flex flex-col gap-1.5 rounded-xl border border-crm-linha bg-white p-3">
              <div className="flex items-start gap-2">
                <Film size={16} className="mt-0.5 shrink-0 text-crm-verde" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.titulo}</p>
                  {m.descricao && <p className="text-xs text-crm-tinta-2">{m.descricao}</p>}
                </div>
                {(pode("documentos.excluir") || pode("documentos.editar")) && (
                  <button
                    type="button"
                    className="rounded p-1 text-crm-tinta-3 hover:text-crm-perigo"
                    aria-label={`Remover ${m.titulo}`}
                    onClick={async () => {
                      if (!(await confirmarSimples({ titulo: "Remover vídeo?", mensagem: "O registro será removido. Arquivos enviados continuam na lista de arquivos.", confirmar: "Remover", perigo: true }))) return;
                      await excluir("midias", m.id, { chaves: ["midias"], mensagemSucesso: "Vídeo removido." }).catch(() => undefined);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-crm-tinta-3">
                <Selo tom={m.visibilidade === "equipe" ? "neutro" : "alerta"} icone={VISIBILIDADE[m.visibilidade as keyof typeof VISIBILIDADE]?.icone}>
                  {m.visibilidade === "equipe" ? "Equipe" : m.visibilidade === "saude" ? "Saúde" : "Restrito"}
                </Selo>
                {formatarDataHora(m.created_at)}
              </div>
              {m.tipo === "link" && m.url ? (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-crm-info hover:underline">
                  <Link2 size={13} aria-hidden /> Abrir link <ExternalLink size={12} aria-hidden />
                </a>
              ) : m.arquivo ? (
                <button type="button" onClick={() => abrirArquivo(m.arquivo!)} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-crm-info hover:underline">
                  <Film size={13} aria-hidden /> Assistir / baixar
                </button>
              ) : (
                <span className="text-xs text-crm-tinta-3">Arquivo indisponível para o seu perfil.</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <NovaMidia aberto={novo} aoFechar={() => setNovo(false)} clienteId={clienteId ?? null} casoId={casoId ?? null} />
    </div>
  );
}

function NovaMidia({ aberto, aoFechar, clienteId, casoId }: { aberto: boolean; aoFechar: () => void; clienteId: string | null; casoId: string | null }) {
  const { inserir } = useGravacao();
  const [tipo, setTipo] = useState<"link" | "arquivo">("link");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [visibilidade, setVisibilidade] = useState("equipe");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (aberto) {
      setTipo("link");
      setTitulo("");
      setDescricao("");
      setUrl("");
      setVisibilidade("equipe");
      setArquivo(null);
      setErro(null);
    }
  }, [aberto]);

  const salvar = async () => {
    if (!titulo.trim()) return setErro("Informe um título.");
    if (tipo === "link" && !/^https?:\/\//i.test(url.trim())) return setErro("Informe um link começando com https://");
    if (tipo === "arquivo" && !arquivo) return setErro("Escolha o arquivo de vídeo.");
    setSalvando(true);
    try {
      let arquivoId: string | null = null;
      if (tipo === "arquivo" && arquivo) {
        const a = await enviarArquivo(arquivo, {
          cliente_id: clienteId,
          caso_id: casoId,
          tipo: "video",
          descricao: titulo.trim(),
          clinico: visibilidade === "saude",
          restrito: visibilidade === "responsaveis",
        });
        arquivoId = a.id;
      }
      await inserir(
        "midias",
        { cliente_id: clienteId, caso_id: casoId, tipo, url: tipo === "link" ? url.trim() : null, arquivo_id: arquivoId, titulo: titulo.trim(), descricao: descricao.trim() || null, visibilidade },
        { chaves: ["midias", "arquivos"], mensagemSucesso: "Vídeo adicionado." },
      );
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Adicionar vídeo" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar}>Adicionar</Botao></>}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <div role="radiogroup" aria-label="Tipo" className="inline-flex self-start rounded-full border border-crm-linha-forte bg-white p-0.5">
          {(["link", "arquivo"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tipo === t ? "bg-crm-verde text-white" : "text-crm-tinta-2"}`}>
              {t === "link" ? <Link2 size={13} /> : <Upload size={13} />} {t === "link" ? "Link" : "Arquivo de vídeo"}
            </button>
          ))}
        </div>
        <GrupoCampo rotulo="Título" obrigatorio erro={erro}>{(p) => <Entrada {...p} data-autofoco value={titulo} onChange={(e) => setTitulo(e.target.value)} />}</GrupoCampo>
        {tipo === "link" ? (
          <GrupoCampo rotulo="Link do vídeo">{(p) => <Entrada {...p} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}</GrupoCampo>
        ) : (
          <div className="flex items-center gap-2">
            <input ref={entrada} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" id="arquivo-midia" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            <Botao variante="secundario" tamanho="sm" icone={<Upload size={14} />} onClick={() => entrada.current?.click()}>
              Escolher vídeo
            </Botao>
            <span className="truncate text-sm text-crm-tinta-2">{arquivo?.name ?? "Nenhum arquivo (MP4, MOV ou WEBM, até 50 MB)"}</span>
          </div>
        )}
        <GrupoCampo rotulo="Descrição">{(p) => <AreaTexto {...p} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: relato do paciente sobre o tratamento" />}</GrupoCampo>
        <GrupoCampo rotulo="Quem pode ver">
          {(p) => (
            <Selecao {...p} value={visibilidade} onChange={(e) => setVisibilidade(e.target.value)}>
              {Object.entries(VISIBILIDADE).map(([v, i]) => (
                <option key={v} value={v}>
                  {i.rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
