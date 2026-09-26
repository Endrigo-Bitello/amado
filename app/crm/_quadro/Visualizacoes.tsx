"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronDown, Save, Share2, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../_lib/auth";
import { executar, useGravacao } from "../_lib/dados";
import { supabase } from "../_lib/supabase";
import type { Visualizacao } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { CaixaSelecao, Entrada, GrupoCampo } from "../_ui/Campos";
import { confirmarSimples } from "../_ui/Dialogos";
import { Modal, Popover } from "../_ui/Sobreposicoes";
import { Selo } from "../_ui/Visuais";
import type { ConfigVisualizacao } from "./tipos";

interface PropsVisualizacoes {
  quadro: string;
  ativa: string | null;
  modificada: boolean;
  configAtual: ConfigVisualizacao;
  aoAplicar: (v: Visualizacao | null) => void;
}

export function useVisualizacoes(quadro: string) {
  const { perfil } = useAuth();
  return useQuery({
    queryKey: ["visualizacoes", quadro, perfil?.id],
    enabled: Boolean(perfil),
    queryFn: async () => {
      const s = supabase();
      const [lista, favoritas] = await Promise.all([
        executar(s.from("visualizacoes").select("*").eq("quadro", quadro).order("ordem").order("nome")),
        executar(s.from("visualizacoes_favoritas").select("visualizacao_id")),
      ]);
      return { lista: (lista ?? []) as Visualizacao[], favoritas: new Set((favoritas ?? []).map((f) => f.visualizacao_id)) };
    },
  });
}

export function SeletorVisualizacoes({ quadro, ativa, modificada, configAtual, aoAplicar }: PropsVisualizacoes) {
  const { perfil, pode } = useAuth();
  const podeCompartilhar = pode("admin.configuracoes");
  const consulta = useVisualizacoes(quadro);
  const { inserir, atualizar, excluir, invalidar } = useGravacao();
  const [aberto, setAberto] = useState(false);
  const [salvarComo, setSalvarComo] = useState(false);
  const [nome, setNome] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);
  const [padrao, setPadrao] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const lista = consulta.data?.lista ?? [];
  const favoritas = consulta.data?.favoritas ?? new Set<string>();
  const atual = lista.find((v) => v.id === ativa) ?? null;
  const podeSalvarAtual = atual && (atual.dono_id === perfil?.id || podeCompartilhar);
  const ordenadas = [...lista].sort((a, b) => Number(favoritas.has(b.id)) - Number(favoritas.has(a.id)) || Number(b.padrao) - Number(a.padrao));

  const alternarFavorita = async (v: Visualizacao) => {
    const s = supabase();
    if (favoritas.has(v.id)) await s.from("visualizacoes_favoritas").delete().eq("visualizacao_id", v.id);
    else await s.from("visualizacoes_favoritas").insert({ visualizacao_id: v.id });
    invalidar("visualizacoes");
  };

  const salvarNova = async () => {
    if (!nome.trim()) return;
    const criada = await inserir<Visualizacao>(
      "visualizacoes",
      {
        quadro,
        nome: nome.trim(),
        tipo: configAtual.tipo,
        config: configAtual as unknown as Record<string, unknown>,
        compartilhada: podeCompartilhar && compartilhar,
        padrao: podeCompartilhar && compartilhar && padrao,
      },
      { chaves: ["visualizacoes"], mensagemSucesso: "Visualização salva." },
    );
    if (podeCompartilhar && compartilhar && padrao) {
      await Promise.all(lista.filter((v) => v.padrao).map((v) => atualizar("visualizacoes", v.id, { padrao: false }, { silencioso: true })));
    }
    setSalvarComo(false);
    setNome("");
    aoAplicar(criada);
  };

  const salvarAtual = async () => {
    if (!atual) return;
    await atualizar("visualizacoes", atual.id, { config: configAtual, tipo: configAtual.tipo }, { chaves: ["visualizacoes"], mensagemSucesso: "Visualização atualizada." });
  };

  const remover = async (v: Visualizacao) => {
    if (!(await confirmarSimples({ titulo: "Excluir visualização?", mensagem: `A visualização “${v.nome}” será excluída. Os dados do quadro não são afetados.`, confirmar: "Excluir", perigo: true }))) return;
    await excluir("visualizacoes", v.id, { chaves: ["visualizacoes"], mensagemSucesso: "Visualização excluída." });
    if (v.id === ativa) aoAplicar(null);
  };

  const definirPadrao = async (v: Visualizacao) => {
    await Promise.all(lista.filter((x) => x.padrao && x.id !== v.id).map((x) => atualizar("visualizacoes", x.id, { padrao: false }, { silencioso: true })));
    await atualizar("visualizacoes", v.id, { padrao: true, compartilhada: true }, { chaves: ["visualizacoes"], mensagemSucesso: "Definida como padrão do quadro para a equipe." });
  };

  return (
    <>
      <Botao ref={ref} tamanho="sm" variante="secundario" icone={<Bookmark size={14} />} onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-haspopup="dialog">
        <span className="max-w-40 truncate">{atual?.nome ?? "Visualização padrão"}</span>
        {modificada && <span className="h-2 w-2 rounded-full bg-crm-ouro" title="Alterações não salvas" aria-label="alterações não salvas" />}
        <ChevronDown size={14} aria-hidden />
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={340} rotulo="Visualizações salvas">
        <div className="flex max-h-[70vh] flex-col">
          <div className="border-b border-crm-linha px-4 py-3">
            <h3 className="text-sm font-bold">Visualizações</h3>
            <p className="text-xs text-crm-tinta-3">Guarde filtros, colunas e agrupamentos para usar depois.</p>
          </div>
          <ul className="flex-1 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { aoAplicar(null); setAberto(false); }} className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-crm-suave ${!ativa ? "font-bold" : ""}`}>
                Visualização padrão
              </button>
            </li>
            {ordenadas.map((v) => (
              <li key={v.id} className="group flex items-center gap-1 pr-2 hover:bg-crm-suave">
                <button type="button" onClick={() => { aoAplicar(v); setAberto(false); }} className={`flex min-w-0 flex-1 items-center gap-2 px-4 py-2 text-left text-sm ${v.id === ativa ? "font-bold" : ""}`}>
                  <span className="truncate">{v.nome}</span>
                  {v.padrao && <Selo tom="verde">Padrão</Selo>}
                  {v.compartilhada && !v.padrao && <Selo tom="info">Equipe</Selo>}
                </button>
                <button type="button" onClick={() => alternarFavorita(v)} className="rounded p-1 text-crm-tinta-3 hover:text-crm-ouro-escuro" aria-label={favoritas.has(v.id) ? `Remover ${v.nome} dos favoritos` : `Favoritar ${v.nome}`} aria-pressed={favoritas.has(v.id)}>
                  <Star size={14} className={favoritas.has(v.id) ? "fill-crm-ouro text-crm-ouro-escuro" : ""} />
                </button>
                {podeCompartilhar && !v.padrao && (
                  <button type="button" onClick={() => definirPadrao(v)} className="rounded p-1 text-crm-tinta-3 opacity-0 hover:text-crm-tinta focus:opacity-100 group-hover:opacity-100" aria-label={`Definir ${v.nome} como padrão da equipe`} title="Definir como padrão da equipe">
                    <Share2 size={14} />
                  </button>
                )}
                {(v.dono_id === perfil?.id || podeCompartilhar) && (
                  <button type="button" onClick={() => remover(v)} className="rounded p-1 text-crm-tinta-3 opacity-0 hover:text-crm-perigo focus:opacity-100 group-hover:opacity-100" aria-label={`Excluir ${v.nome}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5 border-t border-crm-linha p-3">
            {podeSalvarAtual && modificada && (
              <Botao tamanho="sm" variante="sutil" icone={<Save size={14} />} onClick={async () => { await salvarAtual(); setAberto(false); }}>
                Salvar alterações em “{atual!.nome}”
              </Botao>
            )}
            <Botao tamanho="sm" variante="secundario" icone={<Bookmark size={14} />} onClick={() => { setAberto(false); setSalvarComo(true); }}>
              Salvar como nova visualização
            </Botao>
          </div>
        </div>
      </Popover>
      <Modal
        aberto={salvarComo}
        aoFechar={() => setSalvarComo(false)}
        largura="sm"
        titulo="Salvar visualização"
        descricao="Filtros, busca, colunas, agrupamento e tipo de visualização atuais serão guardados."
        rodape={
          <>
            <Botao onClick={() => setSalvarComo(false)}>Cancelar</Botao>
            <Botao variante="primario" onClick={salvarNova} disabled={!nome.trim()}>
              Salvar
            </Botao>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); salvarNova(); }}>
          <GrupoCampo rotulo="Nome da visualização" obrigatorio>
            {(p) => <Entrada {...p} data-autofoco value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Leads quentes sem contato" />}
          </GrupoCampo>
          {podeCompartilhar && (
            <>
              <CaixaSelecao marcado={compartilhar} aoAlterar={setCompartilhar} rotulo="Compartilhar com a equipe" descricao="Todos os usuários verão esta visualização." />
              {compartilhar && <CaixaSelecao marcado={padrao} aoAlterar={setPadrao} rotulo="Usar como padrão do quadro" descricao="Será aberta automaticamente por toda a equipe." />}
            </>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </>
  );
}
