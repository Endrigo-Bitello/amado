"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Info, Upload, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { useConfig } from "../../_lib/config";
import { formatarDataHora } from "../../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { chamarFuncao } from "../../_lib/edge";
import { baixarBlob } from "../../_lib/exportar";
import { normalizarBusca } from "../../_lib/formatos";
import { Link } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Importacao as TImportacao } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { CaixaSelecao, Selecao } from "../../_ui/Campos";
import { Modal } from "../../_ui/Sobreposicoes";
import { CabecalhoPagina, Carregando, Selo, Vazio } from "../../_ui/Visuais";

const CAMPOS: { id: string; rotulo: string; sinonimos: string[]; atualizavel?: boolean }[] = [
  { id: "nome", rotulo: "Nome (obrigatório)", sinonimos: ["nome", "nome completo", "cliente", "razao social", "paciente"], atualizavel: true },
  { id: "cpf_cnpj", rotulo: "CPF/CNPJ", sinonimos: ["cpf", "cnpj", "cpf/cnpj", "documento", "cpf cnpj"], atualizavel: true },
  { id: "tipo_pessoa", rotulo: "Tipo de pessoa (PF/PJ)", sinonimos: ["tipo pessoa", "tipo de pessoa", "pf/pj"], atualizavel: true },
  { id: "rg", rotulo: "RG", sinonimos: ["rg", "identidade"], atualizavel: true },
  { id: "data_nascimento", rotulo: "Data de nascimento", sinonimos: ["nascimento", "data de nascimento", "data nascimento", "dt nascimento"], atualizavel: true },
  { id: "whatsapp", rotulo: "WhatsApp / celular", sinonimos: ["whatsapp", "celular", "telefone", "fone", "contato", "whats"], atualizavel: true },
  { id: "telefone_secundario", rotulo: "Telefone secundário", sinonimos: ["telefone 2", "telefone secundario", "fixo", "outro telefone"], atualizavel: true },
  { id: "email", rotulo: "E-mail", sinonimos: ["email", "e-mail", "correio eletronico"], atualizavel: true },
  { id: "profissao", rotulo: "Profissão", sinonimos: ["profissao", "ocupacao"], atualizavel: true },
  { id: "estado_civil", rotulo: "Estado civil", sinonimos: ["estado civil"], atualizavel: true },
  { id: "nacionalidade", rotulo: "Nacionalidade", sinonimos: ["nacionalidade"], atualizavel: true },
  { id: "cep", rotulo: "CEP", sinonimos: ["cep"], atualizavel: true },
  { id: "logradouro", rotulo: "Endereço", sinonimos: ["endereco", "logradouro", "rua", "avenida"], atualizavel: true },
  { id: "numero", rotulo: "Número", sinonimos: ["numero", "nº", "n"], atualizavel: true },
  { id: "complemento", rotulo: "Complemento", sinonimos: ["complemento"], atualizavel: true },
  { id: "bairro", rotulo: "Bairro", sinonimos: ["bairro"], atualizavel: true },
  { id: "cidade", rotulo: "Cidade", sinonimos: ["cidade", "municipio"], atualizavel: true },
  { id: "uf", rotulo: "UF", sinonimos: ["uf", "estado"], atualizavel: true },
  { id: "observacoes", rotulo: "Observações", sinonimos: ["observacoes", "obs", "anotacoes", "notas"], atualizavel: true },
  { id: "responsavel_email", rotulo: "E-mail do responsável (usuário do CRM)", sinonimos: ["responsavel", "advogado responsavel", "email responsavel"] },
  { id: "caso_titulo", rotulo: "Título do caso", sinonimos: ["caso", "titulo do caso", "assunto"] },
  { id: "tipo_demanda", rotulo: "Tipo de demanda", sinonimos: ["tipo de demanda", "demanda", "tipo de acao", "acao"] },
  { id: "numero_processo", rotulo: "Número do processo", sinonimos: ["processo", "numero do processo", "nº do processo", "n processo", "numero processo"] },
  { id: "tribunal", rotulo: "Tribunal", sinonimos: ["tribunal", "orgao", "vara"] },
];

interface LinhaPrevia {
  linha: number;
  dados: Record<string, string>;
  erros: string[];
  avisos: string[];
  duplicados: { tipo: "cliente" | "lead"; id: string; codigo: string; nome: string; arquivado: boolean; motivos: string[] }[];
  duplicado_no_arquivo: number[];
  sugestao: "criar" | "ignorar";
}

interface Decisao {
  acao: "criar" | "ignorar" | "completar" | "atualizar";
  cliente_id?: string;
  campos?: string[];
}

function decodificarTexto(buffer: ArrayBuffer): string {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    texto = new TextDecoder("windows-1252").decode(buffer);
  }
  return texto.replace(/^﻿/, "");
}

// Cabeçalhos e sinônimos passam pela mesma normalização ("E-mail" = "email" = "e mail").
const normalizarCabecalho = (t: string) => normalizarBusca(t).replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();
const compactar = (t: string) => normalizarCabecalho(t).replace(/\s/g, "");

function sugerirCampo(cabecalho: string): string {
  const n = normalizarCabecalho(cabecalho);
  const c = compactar(cabecalho);
  const exato = CAMPOS.find((x) => x.sinonimos.some((s) => normalizarCabecalho(s) === n || compactar(s) === c));
  if (exato) return exato.id;
  const parcial = CAMPOS.find((x) => x.sinonimos.some((s) => compactar(s).length > 3 && c.includes(compactar(s))));
  return parcial?.id ?? "";
}

export default function Importacao() {
  const { pode } = useAuth();
  const [etapa, setEtapa] = useState<"arquivo" | "colunas" | "previa" | "resultado">("arquivo");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<number, string>>({});
  const [previa, setPrevia] = useState<LinhaPrevia[]>([]);
  const [decisoes, setDecisoes] = useState<Record<number, Decisao>>({});
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number; ignorados: number; erros: number; relatorio: { linha: number; resultado: string; mensagem?: string; campos?: string[] }[] } | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "erros" | "duplicados" | "novas">("todas");
  const [editandoCampos, setEditandoCampos] = useState<LinhaPrevia | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const { invalidar } = useGravacao();

  if (!pode("dados.importar")) {
    return <Vazio titulo="Acesso restrito" descricao="Seu perfil não pode importar dados." />;
  }

  const lerArquivo = async (arquivo: File) => {
    if (arquivo.size > 15 * 1024 * 1024) return aviso.erro("A planilha deve ter até 15 MB.");
    setProcessando(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await arquivo.arrayBuffer();
      const ehCsv = /\.(csv|txt)$/i.test(arquivo.name) || arquivo.type === "text/csv";
      // CSV: texto em UTF-8 ou, se não for UTF-8 válido, Windows-1252 (padrão do Excel em português).
      const livro = ehCsv
        ? XLSX.read(decodificarTexto(buffer), { type: "string", cellDates: true, dense: true })
        : XLSX.read(buffer, { type: "array", cellDates: true, dense: true });
      const planilha = livro.Sheets[livro.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json<(string | number | Date)[]>(planilha, { header: 1, raw: false, dateNF: "yyyy-mm-dd", defval: "", blankrows: false });
      const [cab, ...resto] = matriz;
      if (!cab || resto.length === 0) {
        aviso.erro("A planilha precisa ter uma linha de cabeçalho e ao menos uma linha de dados.");
        return;
      }
      if (resto.length > 5000) {
        aviso.erro("Limite de 5.000 linhas por importação. Divida a planilha.");
        return;
      }
      const cabecalho = cab.map((c) => String(c ?? "").trim());
      setCabecalhos(cabecalho);
      setLinhas(resto.map((l) => cabecalho.map((_, i) => String(l[i] ?? "").trim())));
      const sugestoes: Record<number, string> = {};
      const usados = new Set<string>();
      cabecalho.forEach((h, i) => {
        const s = sugerirCampo(h);
        if (s && !usados.has(s)) {
          sugestoes[i] = s;
          usados.add(s);
        }
      });
      setMapa(sugestoes);
      setNomeArquivo(arquivo.name);
      setEtapa("colunas");
    } catch {
      aviso.erro("Não foi possível ler o arquivo. Use CSV (separado por ; ou ,) ou Excel (.xlsx).");
    } finally {
      setProcessando(false);
    }
  };

  const montarLinhas = () =>
    linhas.map((l, i) => ({
      linha: i + 2,
      dados: Object.fromEntries(Object.entries(mapa).filter(([, campo]) => campo).map(([col, campo]) => [campo, l[Number(col)] ?? ""])),
    }));

  const validar = async () => {
    if (!Object.values(mapa).includes("nome")) return aviso.erro("Associe a coluna que contém o nome do cliente.");
    setProcessando(true);
    try {
      const r = await chamarFuncao<{ linhas: LinhaPrevia[] }>("crm-importacao", { acao: "validar", linhas: montarLinhas() });
      setPrevia(r.linhas);
      const inicial: Record<number, Decisao> = {};
      r.linhas.forEach((l) => {
        inicial[l.linha] = { acao: l.sugestao };
      });
      setDecisoes(inicial);
      setEtapa("previa");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setProcessando(false);
    }
  };

  const importar = async () => {
    setProcessando(true);
    try {
      const base = montarLinhas();
      const r = await chamarFuncao<NonNullable<typeof resultado>>("crm-importacao", {
        acao: "importar",
        arquivo_nome: nomeArquivo,
        mapeamento: Object.fromEntries(Object.entries(mapa).map(([c, campo]) => [cabecalhos[Number(c)], campo])),
        linhas: base.map((l) => ({ ...l, ...decisoes[l.linha] })),
      });
      setResultado(r);
      setEtapa("resultado");
      invalidar("clientes", "casos");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setProcessando(false);
    }
  };

  const baixarRelatorio = () => {
    if (!resultado) return;
    const linhasCsv = [["Linha da planilha", "Resultado", "Mensagem", "Campos alterados"], ...resultado.relatorio.map((r) => [String(r.linha), r.resultado, r.mensagem ?? "", (r.campos ?? []).join(", ")])];
    const csv = linhasCsv.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    baixarBlob(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }), `relatorio-importacao-${Date.now()}.csv`);
  };

  const contagem = {
    erros: previa.filter((l) => l.erros.length > 0).length,
    duplicados: previa.filter((l) => l.duplicados.some((d) => d.tipo === "cliente") || l.duplicado_no_arquivo.length > 0).length,
    novas: previa.filter((l) => l.erros.length === 0 && !l.duplicados.some((d) => d.tipo === "cliente")).length,
  };
  const visiveis = previa.filter((l) =>
    filtro === "erros" ? l.erros.length > 0 : filtro === "duplicados" ? l.duplicados.some((d) => d.tipo === "cliente") || l.duplicado_no_arquivo.length > 0 : filtro === "novas" ? l.erros.length === 0 && !l.duplicados.some((d) => d.tipo === "cliente") : true,
  );
  const acoesResumo = Object.values(decisoes).reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.acao]: (acc[d.acao] ?? 0) + 1 }), {});

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <Link href="/crm/clientes" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-crm-tinta-2 hover:text-crm-tinta">
        <ArrowLeft size={15} aria-hidden /> Clientes
      </Link>
      <CabecalhoPagina icone={<FileSpreadsheet size={20} />} titulo="Importar clientes" subtitulo="CSV ou Excel. Nada é gravado antes da sua confirmação e nenhum dado existente é sobrescrito sem escolha explícita." />

      <ol className="flex flex-wrap gap-2 text-xs font-bold" aria-label="Etapas da importação">
        {[
          ["arquivo", "1. Arquivo"],
          ["colunas", "2. Colunas"],
          ["previa", "3. Prévia e decisões"],
          ["resultado", "4. Resultado"],
        ].map(([id, r]) => (
          <li key={id} aria-current={etapa === id ? "step" : undefined} className={`rounded-full border-2 px-3 py-1 ${etapa === id ? "border-crm-tinta bg-crm-verde text-white" : "border-crm-linha bg-white text-crm-tinta-3"}`}>
            {r}
          </li>
        ))}
      </ol>

      {etapa === "arquivo" && (
        <div className="flex flex-col gap-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) lerArquivo(f);
            }}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-crm-linha-forte bg-white px-6 py-12 text-center"
          >
            <Upload size={28} className="text-crm-verde" aria-hidden />
            <p className="text-sm font-semibold">Arraste a planilha aqui ou escolha o arquivo</p>
            <p className="max-w-md text-xs text-crm-tinta-3">A primeira linha deve conter os nomes das colunas (ex.: Nome, CPF, Telefone, E-mail, Cidade, UF, Nº do processo). Até 5.000 linhas.</p>
            <input ref={entrada} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="sr-only" onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} aria-label="Escolher planilha" />
            <Botao variante="primario" carregando={processando} icone={<FileSpreadsheet size={15} />} onClick={() => entrada.current?.click()}>
              Escolher planilha
            </Botao>
          </div>
          <HistoricoImportacoes />
        </div>
      )}

      {etapa === "colunas" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-crm-tinta-2">
            <strong>{nomeArquivo}</strong> · {linhas.length} linhas. Associe cada coluna da planilha a um campo do CRM (ou ignore). Sugestões foram preenchidas automaticamente.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-crm-linha bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-crm-suave text-left text-xs font-bold text-crm-tinta-2">
                <tr>
                  <th className="px-3 py-2">Coluna da planilha</th>
                  <th className="px-3 py-2">Exemplos</th>
                  <th className="px-3 py-2">Campo no CRM</th>
                </tr>
              </thead>
              <tbody>
                {cabecalhos.map((h, i) => (
                  <tr key={i} className="border-t border-crm-linha">
                    <td className="px-3 py-2 font-semibold">{h || `(coluna ${i + 1})`}</td>
                    <td className="max-w-64 truncate px-3 py-2 text-xs text-crm-tinta-3">{linhas.slice(0, 3).map((l) => l[i]).filter(Boolean).join(" · ")}</td>
                    <td className="px-3 py-2">
                      <Selecao aria-label={`Campo para ${h}`} value={mapa[i] ?? ""} onChange={(e) => setMapa((m) => ({ ...m, [i]: e.target.value }))}>
                        <option value="">— Ignorar esta coluna —</option>
                        {CAMPOS.map((c) => (
                          <option key={c.id} value={c.id} disabled={Object.entries(mapa).some(([col, campo]) => campo === c.id && Number(col) !== i)}>
                            {c.rotulo}
                          </option>
                        ))}
                      </Selecao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-crm-tinta-3">
            <Info size={13} className="mt-0.5 shrink-0" aria-hidden /> Se houver “Nº do processo”, “Tipo de demanda” ou “Título do caso”, um caso é criado para cada cliente novo.
          </p>
          <div className="flex gap-2">
            <Botao onClick={() => setEtapa("arquivo")}>Voltar</Botao>
            <Botao variante="primario" carregando={processando} onClick={validar}>
              Validar e ver prévia
            </Botao>
          </div>
        </div>
      )}

      {etapa === "previa" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["todas", `Todas (${previa.length})`],
                ["novas", `Novas (${contagem.novas})`],
                ["duplicados", `Possíveis duplicados (${contagem.duplicados})`],
                ["erros", `Com erro (${contagem.erros})`],
              ] as const
            ).map(([id, r]) => (
              <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={`rounded-full border px-3 py-1 text-xs font-bold ${filtro === id ? "border-crm-tinta bg-crm-verde text-white" : "border-crm-linha bg-white text-crm-tinta-2"}`}>
                {r}
              </button>
            ))}
            <span className="ml-auto flex gap-2">
              <Botao tamanho="sm" onClick={() => setDecisoes((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, previa.find((l) => String(l.linha) === k)?.duplicados.some((x) => x.tipo === "cliente") ? { acao: "ignorar" as const } : v])))}>
                Ignorar todos os duplicados
              </Botao>
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-crm-linha bg-white" style={{ maxHeight: "60vh" }}>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-crm-suave text-left text-xs font-bold text-crm-tinta-2">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Decisão</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const d = decisoes[l.linha] ?? { acao: "ignorar" };
                  const clientesDup = l.duplicados.filter((x) => x.tipo === "cliente");
                  return (
                    <tr key={l.linha} className="border-t border-crm-linha align-top">
                      <td className="px-3 py-2 tabular-nums text-crm-tinta-3">{l.linha}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold">{l.dados.nome || "(sem nome)"}</span>
                        <span className="block text-xs text-crm-tinta-3">{[l.dados.cpf_cnpj, l.dados.whatsapp, l.dados.email].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1 text-xs">
                          {l.erros.length > 0 ? (
                            l.erros.map((e) => (
                              <span key={e} className="inline-flex items-center gap-1 font-semibold text-crm-perigo">
                                <XCircle size={12} aria-hidden /> {e}
                              </span>
                            ))
                          ) : clientesDup.length > 0 ? (
                            clientesDup.map((x) => (
                              <span key={x.id} className="inline-flex items-center gap-1 font-semibold text-crm-alerta">
                                <AlertTriangle size={12} aria-hidden /> Possível duplicado de{" "}
                                <Link href={`/crm/clientes/${x.id}`} className="underline" target="_blank">
                                  {x.codigo} — {x.nome}
                                </Link>{" "}
                                (mesmo {x.motivos.join(", ")})
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-crm-sucesso">
                              <CheckCircle2 size={12} aria-hidden /> Novo cliente
                            </span>
                          )}
                          {l.duplicado_no_arquivo.length > 0 && <span className="text-crm-alerta">Repete dados da(s) linha(s) {l.duplicado_no_arquivo.join(", ")} da planilha.</span>}
                          {l.avisos.map((a) => (
                            <span key={a} className="text-crm-tinta-3">• {a}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1.5">
                          <Selecao
                            aria-label={`Decisão para a linha ${l.linha}`}
                            value={d.acao}
                            onChange={(e) => {
                              const acao = e.target.value as Decisao["acao"];
                              setDecisoes((x) => ({ ...x, [l.linha]: { acao, cliente_id: acao === "completar" || acao === "atualizar" ? clientesDup[0]?.id : undefined, campos: [] } }));
                              if (acao === "atualizar") setEditandoCampos(l);
                            }}
                            className="h-8 text-xs"
                          >
                            <option value="criar" disabled={l.erros.length > 0}>Criar novo cliente</option>
                            <option value="ignorar">Ignorar esta linha</option>
                            {clientesDup.length > 0 && <option value="completar">Completar só campos vazios do existente</option>}
                            {clientesDup.length > 0 && <option value="atualizar">Atualizar campos escolhidos do existente</option>}
                          </Selecao>
                          {(d.acao === "completar" || d.acao === "atualizar") && clientesDup.length > 1 && (
                            <Selecao aria-label="Cliente existente" value={d.cliente_id} onChange={(e) => setDecisoes((x) => ({ ...x, [l.linha]: { ...d, cliente_id: e.target.value } }))} className="h-8 text-xs">
                              {clientesDup.map((x) => (
                                <option key={x.id} value={x.id}>{x.codigo} — {x.nome}</option>
                              ))}
                            </Selecao>
                          )}
                          {d.acao === "atualizar" && (
                            <button type="button" className="text-left text-xs font-semibold text-crm-folha hover:underline" onClick={() => setEditandoCampos(l)}>
                              {d.campos?.length ? `Substituir: ${d.campos.map((c) => CAMPOS.find((x) => x.id === c)?.rotulo).join(", ")}` : "Escolher campos a substituir"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Botao onClick={() => setEtapa("colunas")}>Voltar</Botao>
            <Botao variante="primario" carregando={processando} onClick={importar} disabled={!Object.values(decisoes).some((d) => d.acao !== "ignorar")}>
              Importar ({(acoesResumo.criar ?? 0) + (acoesResumo.completar ?? 0) + (acoesResumo.atualizar ?? 0)} linha(s))
            </Botao>
            <span className="text-xs text-crm-tinta-2">
              Criar: {acoesResumo.criar ?? 0} · Completar: {acoesResumo.completar ?? 0} · Atualizar: {acoesResumo.atualizar ?? 0} · Ignorar: {acoesResumo.ignorar ?? 0}
            </span>
          </div>
        </div>
      )}

      {etapa === "resultado" && resultado && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Criados", resultado.criados, "text-crm-sucesso"],
              ["Atualizados", resultado.atualizados, "text-crm-info"],
              ["Ignorados", resultado.ignorados, "text-crm-tinta-2"],
              ["Com erro", resultado.erros, resultado.erros ? "text-crm-perigo" : "text-crm-tinta-3"],
            ].map(([r, v, cor]) => (
              <div key={r as string} className="rounded-2xl border-2 border-crm-tinta bg-white p-4 shadow-crm-bruto-verde">
                <dt className="text-sm font-semibold text-crm-tinta-2">{r}</dt>
                <dd className={`text-3xl font-semibold ${cor}`}>{v as number}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Botao icone={<Download size={15} />} onClick={baixarRelatorio}>
              Baixar relatório (CSV)
            </Botao>
            <Link href="/crm/clientes" className="inline-flex h-9 items-center rounded-full border-2 border-crm-tinta bg-crm-verde px-4 text-sm font-semibold text-white shadow-crm-bruto">
              Ver clientes
            </Link>
            <Botao
              variante="fantasma"
              onClick={() => {
                setEtapa("arquivo");
                setResultado(null);
                setPrevia([]);
              }}
            >
              Nova importação
            </Botao>
          </div>
          {resultado.relatorio.filter((r) => r.resultado === "erro").length > 0 && (
            <div className="rounded-2xl border border-[#F5C2BD] bg-crm-perigo-claro p-4">
              <h2 className="mb-2 text-sm font-bold text-crm-perigo">Linhas com erro</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {resultado.relatorio
                  .filter((r) => r.resultado === "erro")
                  .map((r) => (
                    <li key={r.linha}>
                      Linha {r.linha}: {r.mensagem}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <EscolherCampos
        linha={editandoCampos}
        selecionados={editandoCampos ? decisoes[editandoCampos.linha]?.campos ?? [] : []}
        aoFechar={() => setEditandoCampos(null)}
        aoSalvar={(campos) => {
          if (!editandoCampos) return;
          setDecisoes((x) => ({ ...x, [editandoCampos.linha]: { ...x[editandoCampos.linha], acao: "atualizar", campos } }));
          setEditandoCampos(null);
        }}
      />
    </div>
  );
}

function EscolherCampos({ linha, selecionados, aoFechar, aoSalvar }: { linha: LinhaPrevia | null; selecionados: string[]; aoFechar: () => void; aoSalvar: (c: string[]) => void }) {
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const disponiveis = useMemo(() => (linha ? CAMPOS.filter((c) => c.atualizavel && linha.dados[c.id]) : []), [linha]);
  useEffect(() => {
    setEscolhidos(selecionados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linha?.linha]);
  if (!linha) return null;
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Atualizar cliente existente (linha ${linha.linha})`}
      descricao="Marque apenas os campos que devem ser SUBSTITUÍDOS pelos valores da planilha. Os demais permanecem como estão."
      rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={() => aoSalvar(escolhidos)}>Confirmar campos</Botao></>}
    >
      <div className="flex flex-col gap-2">
        {disponiveis.map((c) => (
          <CaixaSelecao
            key={c.id}
            marcado={escolhidos.includes(c.id)}
            aoAlterar={(v) => setEscolhidos((e) => (v ? [...e, c.id] : e.filter((x) => x !== c.id)))}
            rotulo={c.rotulo}
            descricao={`Novo valor: ${linha.dados[c.id]}`}
          />
        ))}
      </div>
    </Modal>
  );
}

function HistoricoImportacoes() {
  const config = useConfig();
  const consulta = useQuery({
    queryKey: ["importacoes"],
    queryFn: async () => (await executar(supabase().from("importacoes").select("*").order("created_at", { ascending: false }).limit(20))) as TImportacao[],
  });
  if (consulta.isLoading) return <Carregando />;
  const lista = consulta.data ?? [];
  if (lista.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold">Importações anteriores</h2>
      <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
        {lista.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="font-semibold">{i.arquivo_nome ?? "Planilha"}</span>
            <span className="text-xs text-crm-tinta-3">
              {formatarDataHora(i.created_at)} · {config.usuario(i.usuario_id)?.nome ?? "—"}
            </span>
            <span className="ml-auto flex gap-1.5">
              <Selo tom="sucesso">{i.criados} criados</Selo>
              <Selo tom="info">{i.atualizados} atualizados</Selo>
              {i.erros > 0 && <Selo tom="perigo">{i.erros} erros</Selo>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
