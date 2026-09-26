"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileImage, FileText, FileVideo, Loader2, Paperclip, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../_lib/auth";
import { aviso, comSalvamento } from "../_lib/avisos";
import { useConfig } from "../_lib/config";
import { formatarDataHora } from "../_lib/datas";
import { ErroCrm, executar, mensagemErro, useGravacao } from "../_lib/dados";
import { tamanhoArquivo } from "../_lib/formatos";
import { supabase } from "../_lib/supabase";
import type { Arquivo } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { confirmarSimples } from "../_ui/Dialogos";
import { Carregando, ErroCarga, Selo, Vazio } from "../_ui/Visuais";

export const TIPOS_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/csv",
];

const LIMITE_MB = 50;

export type EscopoArquivo = {
  lead_id?: string | null;
  cliente_id?: string | null;
  caso_id?: string | null;
  tarefa_id?: string | null;
  documento_id?: string | null;
};

function nomeSeguro(nome: string) {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "arquivo"
  );
}

/** Envia um arquivo ao Storage privado e registra os metadados. */
export async function enviarArquivo(
  arquivo: File,
  dados: EscopoArquivo & { tipo?: Arquivo["tipo"]; categoria_id?: string | null; descricao?: string | null; restrito?: boolean; clinico?: boolean },
): Promise<Arquivo> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new ErroCrm("Formato não aceito. Envie PDF, imagem, vídeo (MP4/MOV), Word, Excel ou texto.");
  }
  if (arquivo.size > LIMITE_MB * 1024 * 1024) throw new ErroCrm(`O arquivo excede ${LIMITE_MB} MB.`);
  return comSalvamento(async () => {
    const s = supabase();
    const caminho = `interno/${crypto.randomUUID()}/${nomeSeguro(arquivo.name)}`;
    const envio = await s.storage.from("crm-documentos").upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (envio.error) throw new ErroCrm("Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.");
    try {
      const registro = await executar(
        s
          .from("arquivos")
          .insert({
            bucket: "crm-documentos",
            caminho,
            nome: arquivo.name.slice(0, 255),
            mime: arquivo.type,
            tamanho: arquivo.size,
            tipo: dados.tipo ?? "documento",
            lead_id: dados.lead_id ?? null,
            cliente_id: dados.cliente_id ?? null,
            caso_id: dados.caso_id ?? null,
            tarefa_id: dados.tarefa_id ?? null,
            documento_id: dados.documento_id ?? null,
            categoria_id: dados.categoria_id ?? null,
            descricao: dados.descricao ?? null,
            restrito: dados.restrito ?? false,
            clinico: dados.clinico ?? false,
          })
          .select()
          .single(),
      );
      return registro as unknown as Arquivo;
    } catch (e) {
      await s.storage.from("crm-documentos").remove([caminho]);
      throw e;
    }
  });
}

export async function abrirArquivo(a: Pick<Arquivo, "bucket" | "caminho" | "nome">) {
  const { data, error } = await supabase().storage.from(a.bucket).createSignedUrl(a.caminho, 120, { download: false });
  if (error || !data) {
    aviso.erro("Não foi possível abrir o arquivo. Verifique se você tem permissão.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function IconeArquivo({ mime }: { mime: string | null }) {
  if (mime?.startsWith("image/")) return <FileImage size={18} aria-hidden />;
  if (mime?.startsWith("video/")) return <FileVideo size={18} aria-hidden />;
  return <FileText size={18} aria-hidden />;
}

interface PropsArquivos {
  escopo: EscopoArquivo;
  filtroColuna: keyof EscopoArquivo;
  tipo?: Arquivo["tipo"];
  somenteLeitura?: boolean;
  titulo?: string;
  mostrarVinculo?: boolean;
}

export function ListaArquivos({ escopo, filtroColuna, tipo, somenteLeitura, titulo = "Arquivos", mostrarVinculo = true }: PropsArquivos) {
  const { pode } = useAuth();
  const config = useConfig();
  const { atualizar, invalidar } = useGravacao();
  const [enviando, setEnviando] = useState(0);
  const [lixeira, setLixeira] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const idFiltro = escopo[filtroColuna];

  const consulta = useQuery({
    queryKey: ["arquivos", filtroColuna, idFiltro, lixeira],
    enabled: Boolean(idFiltro),
    queryFn: async () => {
      let q = supabase().from("arquivos").select("*").eq(filtroColuna, idFiltro!).eq("bucket", "crm-documentos");
      q = lixeira ? q.not("removido_em", "is", null) : q.is("removido_em", null);
      if (tipo) q = q.eq("tipo", tipo);
      return (await executar(q.order("created_at", { ascending: false }))) as Arquivo[];
    },
  });

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    for (const arquivo of Array.from(arquivos)) {
      setEnviando((n) => n + 1);
      try {
        await enviarArquivo(arquivo, { ...escopo, tipo: tipo ?? "documento" });
        aviso.sucesso(`“${arquivo.name}” enviado.`);
      } catch (e) {
        aviso.erro(mensagemErro(e));
      } finally {
        setEnviando((n) => n - 1);
      }
    }
    invalidar("arquivos", "documentos", "eventos");
    if (entrada.current) entrada.current.value = "";
  };

  const remover = async (a: Arquivo) => {
    if (!(await confirmarSimples({ titulo: "Mover arquivo para a lixeira?", mensagem: `“${a.nome}” deixará de aparecer na lista. Um administrador pode restaurá-lo ou excluí-lo definitivamente.`, confirmar: "Mover para a lixeira", perigo: true }))) return;
    await atualizar("arquivos", a.id, { removido_em: new Date().toISOString() }, { chaves: ["arquivos", "documentos"], mensagemSucesso: "Arquivo movido para a lixeira." });
  };

  const restaurar = async (a: Arquivo) => {
    await atualizar("arquivos", a.id, { removido_em: null }, { chaves: ["arquivos", "documentos"], mensagemSucesso: "Arquivo restaurado." });
  };

  const excluirDefinitivo = async (a: Arquivo) => {
    if (!(await confirmarSimples({ titulo: "Excluir definitivamente?", mensagem: `“${a.nome}” será apagado do armazenamento. Esta ação não pode ser desfeita.`, confirmar: "Excluir definitivamente", perigo: true }))) return;
    const s = supabase();
    const r = await s.storage.from("crm-documentos").remove([a.caminho]);
    if (r.error) {
      aviso.erro("Não foi possível excluir o arquivo do armazenamento.");
      return;
    }
    const { error } = await s.from("arquivos").delete().eq("id", a.id);
    if (error) aviso.erro(mensagemErro(error));
    else aviso.sucesso("Arquivo excluído definitivamente.");
    invalidar("arquivos");
  };

  const podeEnviar = !somenteLeitura && (pode("documentos.editar") || Boolean(escopo.tarefa_id));
  const lista = consulta.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-crm-tinta">{lixeira ? "Lixeira" : titulo}</h3>
        <div className="flex items-center gap-2">
          {pode("documentos.excluir") && (
            <Botao tamanho="sm" variante="fantasma" onClick={() => setLixeira((l) => !l)}>
              {lixeira ? "Ver arquivos" : "Lixeira"}
            </Botao>
          )}
          {podeEnviar && !lixeira && (
            <>
              <input ref={entrada} type="file" multiple accept={TIPOS_ACEITOS.join(",")} className="sr-only" id={`envio-${filtroColuna}-${idFiltro}`} onChange={(e) => enviar(e.target.files)} />
              <Botao tamanho="sm" variante="secundario" icone={enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} onClick={() => entrada.current?.click()} disabled={enviando > 0}>
                {enviando ? "Enviando…" : "Enviar arquivo"}
              </Botao>
            </>
          )}
        </div>
      </div>
      {podeEnviar && !lixeira && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            enviar(e.dataTransfer.files);
          }}
          className="rounded-xl border-2 border-dashed border-crm-linha-forte bg-crm-fundo px-4 py-3 text-center text-xs text-crm-tinta-3"
        >
          <Paperclip size={14} className="mr-1 inline" aria-hidden /> Arraste arquivos para cá (PDF, imagens, vídeos, Word/Excel — até {LIMITE_MB} MB)
        </div>
      )}
      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarga aoTentarNovamente={() => consulta.refetch()} />
      ) : lista.length === 0 ? (
        <Vazio compacto titulo={lixeira ? "Lixeira vazia" : "Nenhum arquivo"} />
      ) : (
        <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
          {lista.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-crm-tinta-3">
                <IconeArquivo mime={a.mime} />
              </span>
              <span className="min-w-0 flex-1">
                <button type="button" onClick={() => abrirArquivo(a)} className="block max-w-full truncate text-left text-sm font-semibold text-crm-tinta hover:underline">
                  {a.nome}
                </button>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-crm-tinta-3">
                  {formatarDataHora(a.created_at)} · {tamanhoArquivo(a.tamanho)}
                  {a.versao > 1 && <span>· versão {a.versao}</span>}
                  {a.enviado_pelo_cliente ? <Selo tom="info">Enviado pelo cliente</Selo> : a.enviado_por && <span>· {config.usuario(a.enviado_por)?.nome}</span>}
                  {a.clinico && <Selo tom="perigo">Saúde</Selo>}
                  {mostrarVinculo && a.documento_id && <Selo tom="verde">Checklist</Selo>}
                </span>
              </span>
              <Botao tamanho="icone-sm" variante="fantasma" onClick={() => abrirArquivo(a)} aria-label={`Abrir ${a.nome}`}>
                <Download size={15} />
              </Botao>
              {lixeira ? (
                <>
                  <Botao tamanho="icone-sm" variante="fantasma" onClick={() => restaurar(a)} aria-label={`Restaurar ${a.nome}`}>
                    <RotateCcw size={15} />
                  </Botao>
                  <Botao tamanho="icone-sm" variante="fantasma" onClick={() => excluirDefinitivo(a)} aria-label={`Excluir definitivamente ${a.nome}`} className="text-crm-perigo">
                    <Trash2 size={15} />
                  </Botao>
                </>
              ) : (
                !somenteLeitura &&
                pode("documentos.editar") && (
                  <Botao tamanho="icone-sm" variante="fantasma" onClick={() => remover(a)} aria-label={`Mover ${a.nome} para a lixeira`}>
                    <Trash2 size={15} />
                  </Botao>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
