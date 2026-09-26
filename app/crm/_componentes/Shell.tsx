"use client";

import {
  AlertCircle,
  CalendarPlus,
  Check,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  Gavel,
  KeyRound,
  Loader2,
  LogOut,
  Magnet,
  Menu as IconeMenu,
  Plus,
  Scale,
  Search,
  ListChecks,
  UserPlus,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../_lib/auth";
import { useEstadoSalvamento, aviso } from "../_lib/avisos";
import { DESTAQUES } from "../_lib/cores";
import { useConfig } from "../_lib/config";
import { mensagemErro, useTempoReal } from "../_lib/dados";
import { Link, navegar, useRota } from "../_lib/rotas";
import { supabase } from "../_lib/supabase";
import { Botao } from "../_ui/Botao";
import { Entrada, GrupoCampo } from "../_ui/Campos";
import { AreaAvisos, DialogoConfirmacao } from "../_ui/Dialogos";
import { Menu, Modal } from "../_ui/Sobreposicoes";
import { Avatar, Carregando, Kbd, Vazio } from "../_ui/Visuais";
import { BuscaGlobal, abrirBuscaGlobal } from "./BuscaGlobal";
import { MODULOS, moduloPermitido } from "./modulos";
import { Notificacoes } from "./Notificacoes";

const carregando = () => <Carregando />;
const Hoje = dynamic(() => import("../_modulos/hoje/Hoje"), { loading: carregando });
const Leads = dynamic(() => import("../_modulos/leads/Leads"), { loading: carregando });
const Clientes = dynamic(() => import("../_modulos/clientes/Clientes"), { loading: carregando });
const Casos = dynamic(() => import("../_modulos/casos/Casos"), { loading: carregando });
const Tarefas = dynamic(() => import("../_modulos/tarefas/Tarefas"), { loading: carregando });
const Agenda = dynamic(() => import("../_modulos/agenda/Agenda"), { loading: carregando });
const Documentos = dynamic(() => import("../_modulos/documentos/Documentos"), { loading: carregando });
const Financeiro = dynamic(() => import("../_modulos/financeiro/Financeiro"), { loading: carregando });
const Relatorios = dynamic(() => import("../_modulos/relatorios/Relatorios"), { loading: carregando });
const Admin = dynamic(() => import("../_modulos/admin/Admin"), { loading: carregando });

const COMPONENTES: Record<string, React.ComponentType> = {
  hoje: Hoje,
  leads: Leads,
  clientes: Clientes,
  casos: Casos,
  tarefas: Tarefas,
  agenda: Agenda,
  documentos: Documentos,
  financeiro: Financeiro,
  relatorios: Relatorios,
  admin: Admin,
};

function lerPreferencia(chave: string, padrao: boolean): boolean {
  try {
    const v = window.localStorage.getItem(chave);
    return v === null ? padrao : v === "1";
  } catch {
    return padrao;
  }
}

function gravarPreferencia(chave: string, valor: boolean) {
  try {
    window.localStorage.setItem(chave, valor ? "1" : "0");
  } catch {
    /* armazenamento indisponível: mantém apenas na sessão */
  }
}

export function Shell() {
  const { pode } = useAuth();
  const config = useConfig();
  const { modulo } = useRota();
  const [recolhida, setRecolhida] = useState(false);
  const [menuMovel, setMenuMovel] = useState(false);
  useTempoReal(true);

  useEffect(() => setRecolhida(lerPreferencia("crm.menuRecolhido", false)), []);
  useEffect(() => setMenuMovel(false), [modulo]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrirBuscaGlobal();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const aparencia = config.cfg<{ destaque?: string; densidade?: string }>("aparencia", {});
  const destaque = DESTAQUES[aparencia.destaque ?? "floresta"] ?? DESTAQUES.floresta;
  const definicao = MODULOS.find((m) => m.id === modulo);
  const Componente = definicao ? COMPONENTES[definicao.id] : null;
  const permitido = definicao ? moduloPermitido(definicao, pode) : false;

  useEffect(() => {
    const nome = definicao ? config.nome(definicao.chaveNome) : "CRM";
    document.title = `${nome} | CRM Amado & Amado Jr.`;
  }, [definicao, config]);

  return (
    <div
      className="crm-root flex h-dvh overflow-hidden"
      data-densidade={aparencia.densidade === "compacta" ? "compacta" : "confortavel"}
      style={{ ["--crm-destaque" as string]: destaque.cor, ["--crm-destaque-hover" as string]: destaque.hover }}
    >
      <a
        href="#crm-principal"
        className="sr-only z-[100] rounded-lg bg-white px-4 py-2 font-semibold text-crm-tinta focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>

      <BarraLateral
        recolhida={recolhida}
        aoAlternar={() => {
          setRecolhida((r) => {
            gravarPreferencia("crm.menuRecolhido", !r);
            return !r;
          });
        }}
        className="hidden lg:flex"
      />

      {menuMovel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-crm-tinta/40" onClick={() => setMenuMovel(false)} aria-hidden />
          <BarraLateral recolhida={false} aoFechar={() => setMenuMovel(false)} className="relative flex h-full w-72 shadow-crm-flutuante" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior aoAbrirMenu={() => setMenuMovel(true)} />
        <main id="crm-principal" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto pb-20 outline-none lg:pb-0">
          {!definicao || !Componente ? (
            <Vazio
              titulo="Página não encontrada"
              descricao="O endereço acessado não existe no CRM."
              acao={
                <Link href="/crm" className="text-sm font-semibold text-crm-folha underline">
                  Voltar para Hoje
                </Link>
              }
            />
          ) : !permitido ? (
            <Vazio
              titulo="Acesso restrito"
              descricao="Seu perfil não tem permissão para esta área. Se precisar, peça ao administrador do escritório."
            />
          ) : (
            <Componente />
          )}
        </main>
        <NavegacaoMovel aoAbrirMenu={() => setMenuMovel(true)} />
      </div>

      <div id="crm-sobreposicoes" />
      <BuscaGlobal />
      <AreaAvisos />
      <DialogoConfirmacao />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu lateral
// ---------------------------------------------------------------------------

function Marca({ recolhida }: { recolhida: boolean }) {
  return (
    <Link href="/crm" className="flex items-center gap-2.5 rounded-lg px-1 py-1" aria-label="Amado & Amado Jr. — início do CRM">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-crm-ouro/60 bg-[#1C2E22] font-serif text-sm font-bold text-crm-ouro-claro">
        A&amp;A
      </span>
      {!recolhida && (
        <span className="leading-tight">
          <span className="block font-serif text-[15px] font-medium tracking-wide text-white">
            Amado <span className="font-light text-crm-ouro-claro">&amp; Amado Jr.</span>
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#A9BCAE]">CRM jurídico</span>
        </span>
      )}
    </Link>
  );
}

function BarraLateral({ recolhida, aoAlternar, aoFechar, className = "" }: { recolhida: boolean; aoAlternar?: () => void; aoFechar?: () => void; className?: string }) {
  const { pode, perfil } = useAuth();
  const config = useConfig();
  const { modulo } = useRota();
  const visiveis = MODULOS.filter((m) => moduloPermitido(m, pode));
  return (
    <aside
      className={`${className} flex-col border-r-2 border-crm-tinta bg-crm-verde text-[#E7EFE9] transition-[width] duration-200 ${recolhida ? "w-[76px]" : "w-64"}`}
      aria-label="Menu principal"
    >
      <div className={`flex items-center justify-between gap-2 px-3.5 pt-4 pb-3 ${recolhida ? "flex-col" : ""}`}>
        <Marca recolhida={recolhida} />
        {aoFechar && (
          <button type="button" onClick={aoFechar} className="rounded-lg p-1.5 text-[#A9BCAE] hover:bg-white/10 hover:text-white" aria-label="Fechar menu">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mx-3.5 mb-2 h-px bg-gradient-to-r from-transparent via-crm-ouro/50 to-transparent" aria-hidden />
      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        <ul className="flex flex-col gap-0.5">
          {visiveis.map((m) => {
            const ativo = m.id === modulo;
            const Icone = m.icone;
            const nome = config.nome(m.chaveNome);
            return (
              <li key={m.id}>
                <Link
                  href={m.id === "hoje" ? "/crm" : `/crm/${m.id}`}
                  aria-current={ativo ? "page" : undefined}
                  title={recolhida ? nome : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    ativo ? "bg-crm-ouro-claro/12 text-crm-ouro-claro" : "text-[#C9D6CD] hover:bg-white/6 hover:text-white"
                  } ${recolhida ? "justify-center" : ""}`}
                >
                  {ativo && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-crm-ouro" aria-hidden />}
                  <Icone size={19} className="shrink-0" aria-hidden />
                  {!recolhida && <span className="truncate">{nome}</span>}
                  {recolhida && <span className="sr-only">{nome}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-2.5">
        {!recolhida && perfil && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <Avatar nome={perfil.nome} cor={perfil.cor} tamanho={30} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">{perfil.nome}</span>
              <span className="block truncate text-xs text-[#A9BCAE]">{perfil.perfil_nome}</span>
            </span>
          </div>
        )}
        {aoAlternar && (
          <button
            type="button"
            onClick={aoAlternar}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#A9BCAE] hover:bg-white/6 hover:text-white ${recolhida ? "justify-center" : ""}`}
            aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!recolhida}
          >
            {recolhida ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            {!recolhida && "Recolher menu"}
          </button>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Barra superior
// ---------------------------------------------------------------------------

function IndicadorSalvamento() {
  const { pendentes, ultimoErro, salvoEm } = useEstadoSalvamento();
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (pendentes > 0 || ultimoErro) {
      setVisivel(true);
      return;
    }
    if (salvoEm) {
      setVisivel(true);
      const t = window.setTimeout(() => setVisivel(false), 2500);
      return () => window.clearTimeout(t);
    }
  }, [pendentes, ultimoErro, salvoEm]);
  if (!visivel) return <span className="sr-only" aria-live="polite" />;
  return (
    <span aria-live="polite" className="hidden items-center gap-1.5 text-xs font-semibold sm:inline-flex">
      {pendentes > 0 ? (
        <>
          <Loader2 size={14} className="animate-spin text-crm-folha" aria-hidden />
          <span className="text-crm-tinta-2">Salvando…</span>
        </>
      ) : ultimoErro ? (
        <>
          <AlertCircle size={14} className="text-crm-perigo" aria-hidden />
          <span className="text-crm-perigo">Falha ao salvar</span>
        </>
      ) : (
        <>
          <Check size={14} className="text-crm-folha" aria-hidden />
          <span className="text-crm-tinta-2">Alterações salvas</span>
        </>
      )}
    </span>
  );
}

function NovoRapido() {
  const { pode } = useAuth();
  const itens = [
    pode("leads.editar") && { rotulo: "Lead", icone: <Magnet size={15} />, aoSelecionar: () => navegar("/crm/leads?novo=1") },
    pode("clientes.editar") && { rotulo: "Cliente", icone: <UserPlus size={15} />, aoSelecionar: () => navegar("/crm/clientes?novo=1") },
    pode("casos.editar") && { rotulo: "Caso", icone: <Scale size={15} />, aoSelecionar: () => navegar("/crm/casos?novo=1") },
    { rotulo: "Tarefa", icone: <ListChecks size={15} />, aoSelecionar: () => navegar("/crm/tarefas?novo=1") },
    { rotulo: "Compromisso", icone: <CalendarPlus size={15} />, aoSelecionar: () => navegar("/crm/agenda?novo=1") },
    pode("prazos.editar") && { rotulo: "Prazo processual", icone: <Gavel size={15} />, aoSelecionar: () => navegar("/crm/casos?aba=prazos&novo=1") },
  ].filter(Boolean) as { rotulo: string; icone: ReactNode; aoSelecionar: () => void }[];
  return (
    <Menu
      rotulo="Criar novo"
      itens={itens}
      gatilho={(p) => (
        <Botao {...p} variante="primario" tamanho="sm" icone={<Plus size={15} />} aria-label="Criar novo">
          <span className="hidden sm:inline">Novo</span>
        </Botao>
      )}
    />
  );
}

function MenuUsuario() {
  const { perfil, sair } = useAuth();
  const [senhaAberta, setSenhaAberta] = useState(false);
  if (!perfil) return null;
  return (
    <>
      <Menu
        rotulo="Conta"
        itens={[
          { rotulo: `${perfil.nome} · ${perfil.perfil_nome}`, icone: <CircleUserRound size={15} />, aoSelecionar: () => undefined, desabilitado: true },
          { rotulo: "Alterar minha senha", icone: <KeyRound size={15} />, aoSelecionar: () => setSenhaAberta(true), separadorAntes: true },
          { rotulo: "Sair", icone: <LogOut size={15} />, aoSelecionar: sair, perigo: true },
        ]}
        gatilho={(p) => (
          <button {...p} type="button" className="rounded-full p-0.5 hover:ring-2 hover:ring-crm-linha-forte" aria-label="Menu da conta">
            <Avatar nome={perfil.nome} cor={perfil.cor} tamanho={32} />
          </button>
        )}
      />
      <AlterarSenha aberto={senhaAberta} aoFechar={() => setSenhaAberta(false)} />
    </>
  );
}

function AlterarSenha({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setSenha("");
      setConfirmacao("");
      setErro(null);
    }
  }, [aberto]);
  const salvar = async () => {
    if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      setErro("Use ao menos 10 caracteres, com letras e números.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro(/different|same/i.test(error.message) ? "A nova senha deve ser diferente da atual." : mensagemErro(error));
      return;
    }
    aviso.sucesso("Senha alterada.");
    aoFechar();
  };
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura="sm"
      titulo="Alterar minha senha"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            Salvar nova senha
          </Botao>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <GrupoCampo rotulo="Nova senha" ajuda="Mínimo de 10 caracteres, com letras e números." obrigatorio>
          {(p) => <Entrada {...p} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Confirme a nova senha" erro={erro} obrigatorio>
          {(p) => <Entrada {...p} type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />}
        </GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function BarraSuperior({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const refBusca = useRef<HTMLButtonElement>(null);
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-crm-linha bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <button type="button" onClick={aoAbrirMenu} className="rounded-lg p-2 text-crm-tinta-2 hover:bg-crm-suave lg:hidden" aria-label="Abrir menu">
        <IconeMenu size={20} />
      </button>
      <button
        ref={refBusca}
        type="button"
        onClick={abrirBuscaGlobal}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-crm-linha-forte bg-crm-fundo px-3.5 text-left text-sm text-crm-tinta-3 transition-colors hover:border-crm-tinta-3 sm:max-w-md"
        aria-label="Busca global (Ctrl+K)"
      >
        <Search size={16} className="shrink-0" aria-hidden />
        <span className="truncate">Buscar leads, clientes, casos…</span>
        <span className="ml-auto hidden items-center gap-0.5 md:inline-flex" aria-hidden>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        <IndicadorSalvamento />
        <NovoRapido />
        <Notificacoes />
        <MenuUsuario />
      </div>
    </header>
  );
}

function NavegacaoMovel({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const { pode } = useAuth();
  const config = useConfig();
  const { modulo } = useRota();
  const itens = MODULOS.filter((m) => m.movel && moduloPermitido(m, pode)).slice(0, 4);
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-crm-tinta bg-white lg:hidden">
      <ul className="flex">
        {itens.map((m) => {
          const Icone = m.icone;
          const ativo = m.id === modulo;
          return (
            <li key={m.id} className="flex-1">
              <Link
                href={m.id === "hoje" ? "/crm" : `/crm/${m.id}`}
                aria-current={ativo ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${ativo ? "text-crm-verde" : "text-crm-tinta-3"}`}
              >
                <Icone size={20} aria-hidden />
                <span className="max-w-full truncate px-1">{config.nome(m.chaveNome).split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button type="button" onClick={aoAbrirMenu} className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-crm-tinta-3">
            <IconeMenu size={20} aria-hidden />
            Mais
          </button>
        </li>
      </ul>
    </nav>
  );
}
