"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, FileSpreadsheet, Tag, UserRound, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { buscarTodos, useGravacao } from "../../_lib/dados";
import { navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import { OpcoesExibicao } from "../../_quadro/OpcoesExibicao";
import { Quadro } from "../../_quadro/Quadro";
import { Botao } from "../../_ui/Botao";
import { confirmarSimples } from "../../_ui/Dialogos";
import { ListaBusca } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { CabecalhoPagina, Carregando, Vazio } from "../../_ui/Visuais";
import { useColunasClientes, type ClienteQuadro } from "./colunasClientes";
import { FormCliente } from "./FormCliente";

const FichaCliente = dynamic(() => import("./FichaCliente"), { loading: () => <Carregando /> });
const Importacao = dynamic(() => import("./Importacao"), { loading: () => <Carregando /> });

export default function Clientes() {
  const { segmentos } = useRota();
  if (segmentos[1] === "importar") return <Importacao />;
  if (segmentos[1]) return <FichaCliente id={segmentos[1]} />;
  return <QuadroClientes />;
}

function QuadroClientes() {
  const config = useConfig();
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const { atualizar, inserir } = useGravacao();
  const [arquivados, setArquivados] = useState(false);
  const [inativos, setInativos] = useState(true);
  const [lote, setLote] = useState<{ tipo: "responsavel" | "etiqueta"; itens: ClienteQuadro[] } | null>(null);
  const novo = parametro("novo") === "1";

  const consulta = useQuery({
    queryKey: ["clientes", "quadro", { arquivados, inativos }],
    queryFn: () =>
      buscarTodos<ClienteQuadro>((de, ate) => {
        let q = supabase().from("clientes").select("*, casos(count)");
        if (!arquivados) q = q.is("arquivado_em", null);
        if (!inativos) q = q.eq("status", "ativo");
        return q.order("nome").range(de, ate) as unknown as PromiseLike<{ data: ClienteQuadro[] | null; error: unknown }>;
      }, 10000),
  });

  const salvar = useCallback(async (c: ClienteQuadro, alt: Record<string, unknown>) => {
    await atualizar("clientes", c.id, alt, { chaves: ["clientes"] });
  }, [atualizar]);
  const colunas = useColunasClientes(salvar);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina
        icone={<Users size={20} />}
        titulo={config.nome("clientes")}
        subtitulo="Ficha única por pessoa, com todos os casos, documentos, financeiro e histórico."
        acoes={
          pode("dados.importar") && (
            <Botao tamanho="sm" variante="secundario" icone={<FileSpreadsheet size={15} />} onClick={() => navegar("/crm/clientes/importar")}>
              Importar planilha
            </Botao>
          )
        }
      />
      <Quadro<ClienteQuadro>
        id="clientes"
        rotuloItens={config.nome("clientes")}
        itens={consulta.data?.linhas ?? []}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="nome"
        colunaStatus="status"
        chave={(c) => c.id}
        rotuloItem={(c) => c.nome}
        aoAbrir={(c) => navegar(`/crm/clientes/${c.id}`)}
        visualizacoes={["tabela", "resumo"]}
        configPadrao={{ tipo: "tabela", agrupamento: null, ordenacao: { coluna: "nome", direcao: "asc" } }}
        resumo={{ campos: ["casos", "status"] }}
        aoCriarRapido={
          pode("clientes.editar")
            ? async (nome) => {
                const c = await inserir<{ id: string }>("clientes", { nome, origem: "manual" }, { chaves: ["clientes"] });
                aviso.sucesso("Cliente criado. Complete a ficha.", { rotulo: "Abrir ficha", executar: () => navegar(`/crm/clientes/${c.id}`) });
              }
            : undefined
        }
        aoNovo={pode("clientes.editar") ? () => definirParametros({ novo: "1" }) : undefined}
        rotuloNovo="Novo cliente"
        acoesLote={
          pode("clientes.editar")
            ? [
                { id: "responsavel", rotulo: "Atribuir responsável", icone: <UserRound size={13} />, executar: (cs) => setLote({ tipo: "responsavel", itens: cs }) },
                { id: "etiqueta", rotulo: "Adicionar etiqueta", icone: <Tag size={13} />, executar: (cs) => setLote({ tipo: "etiqueta", itens: cs }) },
                {
                  id: "arquivar",
                  rotulo: "Arquivar",
                  icone: <Archive size={13} />,
                  executar: async (cs) => {
                    if (!(await confirmarSimples({ titulo: `Arquivar ${cs.length} cliente(s)?`, mensagem: "Clientes arquivados saem dos quadros, mas continuam acessíveis pela busca e em “Arquivados”. Nada é apagado.", confirmar: "Arquivar" }))) return;
                    await Promise.all(cs.map((c) => atualizar("clientes", c.id, { arquivado_em: new Date().toISOString() }, { silencioso: true }).catch(() => undefined)));
                    aviso.sucesso(`${cs.length} cliente(s) arquivado(s).`);
                  },
                },
              ]
            : []
        }
        extrasBarra={
          <OpcoesExibicao
            opcoes={[
              { id: "inativos", rotulo: "Clientes inativos", ativo: inativos, aoAlterar: setInativos },
              { id: "arquivados", rotulo: "Arquivados", ativo: arquivados, aoAlterar: setArquivados },
            ]}
          />
        }
        vazio={
          <Vazio
            icone={<Users size={24} />}
            titulo="Nenhum cliente cadastrado"
            descricao="Clientes são criados ao converter um lead, manualmente ou por importação de planilha."
            acao={
              <div className="flex gap-2">
                {pode("clientes.editar") && <Botao variante="primario" onClick={() => definirParametros({ novo: "1" })}>Cadastrar cliente</Botao>}
                {pode("dados.importar") && <Botao onClick={() => navegar("/crm/clientes/importar")}>Importar planilha</Botao>}
              </div>
            }
          />
        }
      />
      <FormCliente aberto={novo} aoFechar={() => definirParametros({ novo: null })} />
      {lote && (
        <Modal aberto aoFechar={() => setLote(null)} largura="sm" titulo={lote.tipo === "responsavel" ? `Atribuir ${lote.itens.length} cliente(s)` : `Etiquetar ${lote.itens.length} cliente(s)`}>
          <div className="-mx-2 max-h-80 overflow-y-auto rounded-xl border border-crm-linha">
            <ListaBusca
              opcoes={lote.tipo === "responsavel" ? [{ valor: "", rotulo: "Sem responsável" }, ...opcoesUsuarios(config, false)] : config.etiquetas.filter((e) => e.ativo && e.escopos.includes("cliente")).map((e) => ({ valor: e.id, rotulo: e.nome, cor: e.cor }))}
              selecionados={[]}
              estilo={lote.tipo === "responsavel" ? "pessoa" : "pilula"}
              aoAlternar={async (v) => {
                await Promise.all(
                  lote.itens.map((c) =>
                    atualizar("clientes", c.id, lote.tipo === "responsavel" ? { responsavel_id: v || null } : { etiquetas: [...new Set([...c.etiquetas, v])] }, { silencioso: true }).catch(() => undefined),
                  ),
                );
                aviso.sucesso(`${lote.itens.length} cliente(s) atualizado(s).`);
                setLote(null);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
