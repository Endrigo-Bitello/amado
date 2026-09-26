"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as KE,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Portal({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  const alvo = document.getElementById("crm-sobreposicoes") ?? document.body;
  return createPortal(children, alvo);
}

/** Mantém o foco dentro do elemento, fecha com Esc e devolve o foco ao sair. */
function usePrenderFoco(ref: RefObject<HTMLElement | null>, ativo: boolean, fechar: () => void) {
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  }, [fechar]);

  useEffect(() => {
    if (!ativo) return;
    const el = ref.current;
    if (!el) return;
    const anterior = document.activeElement as HTMLElement | null;
    const inicial = el.querySelector<HTMLElement>("[data-autofoco]") ?? el.querySelector<HTMLElement>(SELETOR_FOCAVEL) ?? el;
    window.setTimeout(() => inicial.focus({ preventScroll: true }), 10);

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fecharRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focaveis = Array.from(el.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter((f) => f.offsetParent !== null);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    el.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
      if (anterior && document.contains(anterior)) anterior.focus({ preventScroll: true });
    };
  }, [ativo, ref]);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface PropsModal {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "sm" | "md" | "lg" | "xl";
  fecharAoClicarFora?: boolean;
}

const LARGURAS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({ aberto, aoFechar, titulo, descricao, children, rodape, largura = "md", fecharAoClicarFora = true }: PropsModal) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();
  usePrenderFoco(ref, aberto, aoFechar);
  if (!aberto) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
        <div
          className="absolute inset-0 bg-crm-tinta/45 backdrop-blur-[2px]"
          aria-hidden
          onMouseDown={() => fecharAoClicarFora && aoFechar()}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          aria-describedby={descricao ? idDescricao : undefined}
          tabIndex={-1}
          className={`relative flex max-h-[92vh] w-full ${LARGURAS[largura]} flex-col overflow-hidden rounded-t-3xl border-2 border-crm-tinta bg-white shadow-crm-flutuante outline-none sm:rounded-2xl`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-crm-linha px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={idTitulo} className="font-serif text-lg font-semibold text-crm-tinta">
                {titulo}
              </h2>
              {descricao && (
                <p id={idDescricao} className="mt-0.5 text-sm text-crm-tinta-2">
                  {descricao}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              className="-mr-1 rounded-lg p-1.5 text-crm-tinta-3 hover:bg-crm-suave hover:text-crm-tinta"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {rodape && (
            <footer className="flex flex-col-reverse gap-2 border-t border-crm-linha bg-crm-fundo px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              {rodape}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// Gaveta lateral (ficha do item)
// ---------------------------------------------------------------------------

interface PropsGaveta {
  aberto: boolean;
  aoFechar: () => void;
  rotulo: string;
  children: ReactNode;
  largura?: "md" | "lg" | "xl";
}

const LARGURAS_GAVETA = { md: "sm:max-w-xl", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

export function Gaveta({ aberto, aoFechar, rotulo, children, largura = "lg" }: PropsGaveta) {
  const ref = useRef<HTMLDivElement>(null);
  usePrenderFoco(ref, aberto, aoFechar);
  if (!aberto) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-crm-tinta/30" aria-hidden onMouseDown={aoFechar} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={rotulo}
          tabIndex={-1}
          className={`relative flex h-full w-full ${LARGURAS_GAVETA[largura]} flex-col border-l-2 border-crm-tinta bg-crm-fundo shadow-crm-flutuante outline-none animate-[crm-entrar_180ms_ease-out]`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// Popover ancorado (renderizado fora de contêineres com rolagem)
// ---------------------------------------------------------------------------

interface PropsPopover {
  aberto: boolean;
  aoFechar: () => void;
  ancora: RefObject<HTMLElement | null>;
  children: ReactNode;
  alinhamento?: "inicio" | "fim";
  largura?: number | "ancora" | "ancora-min";
  rotulo?: string;
  className?: string;
}

export function Popover({ aberto, aoFechar, ancora, children, alinhamento = "inicio", largura, rotulo, className = "" }: PropsPopover) {
  const painel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width?: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!aberto) {
      setPos(null);
      return;
    }
    const posicionar = () => {
      const a = ancora.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const p = painel.current;
      const larg = largura === "ancora" ? r.width : largura === "ancora-min" ? Math.max(240, r.width) : typeof largura === "number" ? largura : (p?.offsetWidth ?? 260);
      const alt = p?.offsetHeight ?? 240;
      const espacoAbaixo = window.innerHeight - r.bottom - 8;
      const espacoAcima = r.top - 8;
      const abrirAcima = alt > espacoAbaixo && espacoAcima > espacoAbaixo;
      const maxHeight = Math.max(160, (abrirAcima ? espacoAcima : espacoAbaixo) - 6);
      const top = abrirAcima ? Math.max(8, r.top - Math.min(alt, maxHeight) - 4) : r.bottom + 4;
      let left = alinhamento === "fim" ? r.right - larg : r.left;
      left = Math.min(Math.max(8, left), window.innerWidth - larg - 8);
      setPos({ top, left, width: largura ? larg : undefined, maxHeight });
    };
    posicionar();
    const id = window.requestAnimationFrame(posicionar);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto, ancora, alinhamento, largura]);

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (painel.current?.contains(alvo) || ancora.current?.contains(alvo)) return;
      aoFechar();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        ancora.current?.focus();
      }
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar, true);
    };
  }, [aberto, aoFechar, ancora]);

  useEffect(() => {
    if (!aberto) return;
    const t = window.setTimeout(() => {
      const alvo = painel.current?.querySelector<HTMLElement>("[data-autofoco]") ?? painel.current?.querySelector<HTMLElement>(SELETOR_FOCAVEL);
      alvo?.focus({ preventScroll: true });
    }, 20);
    return () => window.clearTimeout(t);
  }, [aberto]);

  if (!aberto) return null;
  return (
    <Portal>
      <div
        ref={painel}
        role="dialog"
        aria-label={rotulo}
        style={{
          position: "fixed",
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width: pos?.width,
          maxHeight: pos?.maxHeight,
          visibility: pos ? "visible" : "hidden",
        }}
        className={`z-[80] flex flex-col overflow-hidden rounded-xl border border-crm-linha-forte bg-white shadow-crm-flutuante ${className}`}
      >
        {children}
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// Menu de ações (botão + lista navegável pelo teclado)
// ---------------------------------------------------------------------------

export interface ItemMenu {
  rotulo: string;
  icone?: ReactNode;
  aoSelecionar: () => void;
  perigo?: boolean;
  desabilitado?: boolean;
  separadorAntes?: boolean;
  dica?: string;
}

interface PropsMenu {
  gatilho: (props: { ref: RefObject<HTMLButtonElement | null>; onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  itens: ItemMenu[];
  alinhamento?: "inicio" | "fim";
  rotulo: string;
}

export function Menu({ gatilho, itens, alinhamento = "fim", rotulo }: PropsMenu) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const visiveis = itens.filter(Boolean);

  const aoTeclar = (e: KE<HTMLDivElement>) => {
    const botoes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role=menuitem]:not([disabled])"));
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      botoes[(i + 1) % botoes.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      botoes[(i - 1 + botoes.length) % botoes.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      botoes[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      botoes[botoes.length - 1]?.focus();
    }
  };

  return (
    <>
      {gatilho({ ref, onClick: () => setAberto((a) => !a), "aria-expanded": aberto, "aria-haspopup": "menu" })}
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} alinhamento={alinhamento} rotulo={rotulo}>
        <div role="menu" aria-label={rotulo} className="min-w-52 overflow-y-auto py-1.5" onKeyDown={aoTeclar}>
          {visiveis.map((item, i) => (
            <div key={`${item.rotulo}-${i}`}>
              {item.separadorAntes && <div className="my-1.5 border-t border-crm-linha" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.desabilitado}
                title={item.dica}
                onClick={() => {
                  setAberto(false);
                  item.aoSelecionar();
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  item.perigo ? "text-crm-perigo hover:bg-crm-perigo-claro focus:bg-crm-perigo-claro" : "text-crm-tinta hover:bg-crm-suave focus:bg-crm-suave"
                } focus:outline-none`}
              >
                {item.icone && <span className="shrink-0 text-current opacity-80">{item.icone}</span>}
                {item.rotulo}
              </button>
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
