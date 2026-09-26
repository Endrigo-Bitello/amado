"use client";

import { createClient } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Clock, FileUp, Loader2, Lock, RotateCcw, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Página pública do link seguro. O token vem no fragmento (#) da URL — ele não
// é enviado em requisições nem fica em logs de servidor — e é guardado apenas
// na sessão desta aba para permitir recarregar a página.

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHAVE_SESSAO = "amado.portal.token";
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;
const ACEITOS = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime";

interface DocumentoPortal {
  id: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  situacao: "pendente" | "recebido" | "aprovado" | "reenviar" | "dispensado";
  enviados: number;
  pode_enviar: boolean;
}

interface DadosPortal {
  primeiro_nome: string;
  mensagem: string | null;
  expira_em: string;
  documentos: DocumentoPortal[];
  textos: { titulo: string; instrucoes: string; rodape: string };
  tamanho_maximo_mb: number;
}

type EnvioArquivo = { id: string; nome: string; estado: "enviando" | "ok" | "erro"; mensagem?: string };

class ErroPortal extends Error {}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${URL_SUPABASE}/functions/v1/portal-cliente`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CHAVE_PUBLICA },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroPortal("Sem conexão. Verifique a internet e tente novamente.");
  }
  const json = (await r.json().catch(() => null)) as ({ ok?: boolean; erro?: string } & T) | null;
  if (!r.ok || !json || json.ok === false) throw new ErroPortal(json?.erro ?? "Não foi possível concluir agora. Tente novamente em instantes.");
  return json as T;
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const SITUACOES: Record<DocumentoPortal["situacao"], { rotulo: string; classe: string; icone: React.ReactNode }> = {
  pendente: { rotulo: "Pendente", classe: "bg-crm-alerta-claro text-crm-alerta border-[#F3D19A]", icone: <Clock size={13} aria-hidden /> },
  reenviar: { rotulo: "Precisa reenviar", classe: "bg-crm-perigo-claro text-crm-perigo border-[#F5C2BD]", icone: <RotateCcw size={13} aria-hidden /> },
  recebido: { rotulo: "Recebido — em análise", classe: "bg-crm-info-claro text-crm-info border-[#C5D8EC]", icone: <CheckCircle2 size={13} aria-hidden /> },
  aprovado: { rotulo: "Aprovado", classe: "bg-crm-sucesso-claro text-crm-sucesso border-[#BFDDC2]", icone: <ShieldCheck size={13} aria-hidden /> },
  dispensado: { rotulo: "Não é necessário", classe: "bg-crm-suave text-crm-tinta-2 border-crm-linha", icone: <XCircle size={13} aria-hidden /> },
};

export function PortalEnvio() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [dados, setDados] = useState<DadosPortal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [envios, setEnvios] = useState<Record<string, EnvioArquivo[]>>({});
  const [anuncio, setAnuncio] = useState("");
  const sequencia = useRef(0);

  useEffect(() => {
    let t = window.location.hash.replace(/^#/, "").trim();
    try {
      if (TOKEN.test(t)) window.sessionStorage.setItem(CHAVE_SESSAO, t);
      else t = window.sessionStorage.getItem(CHAVE_SESSAO) ?? "";
    } catch {
      /* sem armazenamento: segue apenas com o fragmento */
    }
    // Remove o token da barra de endereços (evita exposição em capturas de tela e histórico).
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    setToken(TOKEN.test(t) ? t : null);
  }, []);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    try {
      setDados(await chamar<DadosPortal>({ acao: "abrir", token }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o link.");
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    if (token === null) {
      setCarregando(false);
      setErro("Link inválido. Confira se o endereço está completo ou peça um novo link ao escritório.");
    } else if (token) {
      carregar();
    }
  }, [token, carregar]);

  const enviar = async (doc: DocumentoPortal, arquivos: FileList | null) => {
    if (!arquivos?.length || !token || !dados) return;
    const armazenamento = createClient(URL_SUPABASE, CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("crm-documentos");
    for (const arquivo of Array.from(arquivos)) {
      sequencia.current += 1;
      const id = `${doc.id}-${sequencia.current}`;
      const atualizar = (e: Partial<EnvioArquivo>) => setEnvios((x) => ({ ...x, [doc.id]: (x[doc.id] ?? []).map((a) => (a.id === id ? { ...a, ...e } : a)) }));
      setEnvios((x) => ({ ...x, [doc.id]: [...(x[doc.id] ?? []), { id, nome: arquivo.name, estado: "enviando" }] }));
      try {
        if (arquivo.size > dados.tamanho_maximo_mb * 1024 * 1024) throw new ErroPortal(`O arquivo excede o limite de ${dados.tamanho_maximo_mb} MB.`);
        const tipo = arquivo.type || (arquivo.name.toLowerCase().endsWith(".heic") ? "image/heic" : "");
        const prep = await chamar<{ caminho: string; token_envio: string }>({ acao: "preparar", token, documento_id: doc.id, arquivo: { nome: arquivo.name, tipo, tamanho: arquivo.size } });
        const r = await armazenamento.uploadToSignedUrl(prep.caminho, prep.token_envio, arquivo, { contentType: tipo || undefined });
        if (r.error) throw new ErroPortal("O envio foi interrompido. Verifique a conexão e tente novamente.");
        await chamar({ acao: "confirmar", token, documento_id: doc.id, caminho: prep.caminho, arquivo: { nome: arquivo.name, tipo } });
        atualizar({ estado: "ok" });
        setAnuncio(`${arquivo.name} enviado para ${doc.nome}.`);
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : "Falha no envio.";
        atualizar({ estado: "erro", mensagem });
        setAnuncio(`Falha ao enviar ${arquivo.name}: ${mensagem}`);
      }
    }
    // Atualiza as situações (sem perder a lista de envios desta sessão).
    try {
      setDados(await chamar<DadosPortal>({ acao: "abrir", token }));
    } catch {
      /* mantém a tela atual */
    }
  };

  const pendentes = dados?.documentos.filter((d) => d.pode_enviar && (d.situacao === "pendente" || d.situacao === "reenviar")) ?? [];

  return (
    <div className="crm-root relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-crm-folha opacity-10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-crm-ouro opacity-20 blur-3xl" aria-hidden />
      <main className="relative w-full max-w-2xl">
        <div className="mb-6 text-center">
          <p className="font-serif text-3xl font-medium tracking-wide text-crm-verde">
            Amado <span className="font-light text-crm-ouro-escuro">&amp; Amado Jr.</span>
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-crm-tinta-3">Advogados</p>
        </div>
        <div className="rounded-3xl border-2 border-crm-tinta bg-white p-6 shadow-[6px_6px_0_0_#263A2D] sm:p-8">
          <p className="sr-only" aria-live="polite">
            {anuncio}
          </p>
          {carregando || token === undefined ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-crm-tinta-2">
              <Loader2 size={18} className="animate-spin" aria-hidden /> Abrindo o link seguro…
            </p>
          ) : erro || !dados ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle size={28} className="text-crm-alerta" aria-hidden />
              <h1 className="font-serif text-xl font-semibold">Não foi possível abrir</h1>
              <p className="max-w-md text-sm text-crm-tinta-2">{erro}</p>
              {token && (
                <button type="button" onClick={carregar} className="mt-2 inline-flex items-center gap-2 rounded-full border border-crm-linha-forte px-4 py-2 text-sm font-semibold hover:bg-crm-suave">
                  <RotateCcw size={14} aria-hidden /> Tentar novamente
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="font-serif text-2xl font-semibold">{dados.textos.titulo}</h1>
                <p className="mt-1 text-sm text-crm-tinta-2">
                  {dados.primeiro_nome ? `Olá, ${dados.primeiro_nome}! ` : ""}
                  Este link é pessoal e vale até <strong>{fmtData.format(new Date(dados.expira_em))}</strong>.
                </p>
              </div>
              {dados.mensagem && <p className="rounded-xl border border-crm-verde-borda bg-crm-verde-claro px-4 py-3 text-sm text-crm-verde">{dados.mensagem}</p>}
              {dados.textos.instrucoes && <p className="text-sm text-crm-tinta-2">{dados.textos.instrucoes}</p>}
              <p className="text-xs text-crm-tinta-3">
                Formatos aceitos: PDF, fotos (JPG, PNG, HEIC) e vídeos (MP4, MOV) de até {dados.tamanho_maximo_mb} MB por arquivo. {pendentes.length > 0 ? `${pendentes.length} documento(s) aguardando envio.` : "Nenhum documento pendente de envio."}
              </p>
              <ul className="flex flex-col gap-3">
                {dados.documentos.map((d) => (
                  <ItemDocumento key={d.id} doc={d} envios={envios[d.id] ?? []} aoEnviar={(f) => enviar(d, f)} />
                ))}
              </ul>
              <p className="flex items-start gap-2 border-t border-crm-linha pt-4 text-xs text-crm-tinta-3">
                <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>{dados.textos.rodape || "Seus arquivos ficam armazenados de forma privada e são acessados apenas pela equipe responsável pelo seu atendimento."}</span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ItemDocumento({ doc, envios, aoEnviar }: { doc: DocumentoPortal; envios: EnvioArquivo[]; aoEnviar: (f: FileList | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const s = SITUACOES[doc.situacao];
  const enviando = envios.some((e) => e.estado === "enviando");
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-crm-linha bg-crm-fundo p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-crm-tinta">
            {doc.nome}
            {doc.obrigatorio && <span className="ml-1.5 text-xs font-bold text-crm-perigo">obrigatório</span>}
          </p>
          {doc.descricao && <p className="mt-0.5 whitespace-pre-wrap text-sm text-crm-tinta-2">{doc.descricao}</p>}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${s.classe}`}>
          {s.icone}
          {s.rotulo}
        </span>
      </div>
      {doc.situacao === "reenviar" && <p className="text-xs text-crm-perigo">O arquivo anterior não pôde ser aceito. Envie uma nova versão legível e completa.</p>}
      {doc.enviados > 0 && <p className="text-xs text-crm-tinta-3">{doc.enviados} arquivo(s) já enviado(s) por este link.</p>}
      {doc.pode_enviar && (
        <div>
          <input
            ref={entrada}
            id={`arquivo-${doc.id}`}
            type="file"
            accept={ACEITOS}
            multiple
            className="sr-only"
            onChange={(e) => {
              aoEnviar(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={`arquivo-${doc.id}`}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-crm-tinta bg-crm-verde px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_0_#1D2A21] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#1D2A21] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-crm-folha ${enviando ? "pointer-events-none opacity-60" : ""}`}
          >
            {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : doc.enviados > 0 ? <Upload size={16} aria-hidden /> : <FileUp size={16} aria-hidden />}
            {enviando ? "Enviando…" : doc.enviados > 0 ? "Enviar outro arquivo" : "Escolher arquivo"}
          </label>
        </div>
      )}
      {envios.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {envios.map((e) => (
            <li key={e.id} className={`flex items-center gap-1.5 ${e.estado === "erro" ? "text-crm-perigo" : e.estado === "ok" ? "text-crm-sucesso" : "text-crm-tinta-2"}`}>
              {e.estado === "enviando" ? <Loader2 size={12} className="animate-spin" aria-hidden /> : e.estado === "ok" ? <CheckCircle2 size={12} aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
              <span className="truncate">{e.nome}</span>
              <span>— {e.estado === "enviando" ? "enviando…" : e.estado === "ok" ? "enviado" : e.mensagem}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
