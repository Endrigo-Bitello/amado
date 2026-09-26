"use client";

import { Check } from "lucide-react";
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { formatarMoeda, lerMoeda } from "../_lib/formatos";

export const classeCampo =
  "w-full rounded-lg border border-crm-linha-forte bg-white px-3 text-sm text-crm-tinta placeholder:text-crm-tinta-3 transition-colors focus:border-crm-folha focus:outline-none focus:ring-2 focus:ring-crm-folha/20 disabled:cursor-not-allowed disabled:bg-crm-suave disabled:text-crm-tinta-3 aria-[invalid=true]:border-crm-perigo";

interface PropsGrupo {
  rotulo?: ReactNode;
  ajuda?: ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
  acessorio?: ReactNode;
}

/** Envolve um campo com rótulo, texto de ajuda e mensagem de erro acessíveis. */
export function GrupoCampo({ rotulo, ajuda, erro, obrigatorio, children, className = "", acessorio }: PropsGrupo) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const descritores = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-[13px] font-semibold text-crm-tinta-2">
            {rotulo}
            {obrigatorio && (
              <span className="ml-0.5 text-crm-perigo" aria-hidden>
                *
              </span>
            )}
            {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
          </label>
          {acessorio}
        </div>
      )}
      {children({ id, "aria-describedby": descritores, "aria-invalid": erro ? true : undefined })}
      {ajuda && !erro && (
        <p id={idAjuda} className="text-xs text-crm-tinta-3">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} role="alert" className="text-xs font-medium text-crm-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className = "", ...props },
  ref,
) {
  return <input ref={ref} className={`${classeCampo} h-9 ${className}`} {...props} />;
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto(
  { className = "", rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={`${classeCampo} py-2 leading-relaxed ${className}`} {...props} />;
});

export const Selecao = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Selecao(
  { className = "", children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={`${classeCampo} h-9 pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
});

interface PropsCaixa {
  marcado: boolean;
  aoAlterar: (v: boolean) => void;
  rotulo?: ReactNode;
  descricao?: ReactNode;
  desabilitado?: boolean;
  id?: string;
  className?: string;
}

export function CaixaSelecao({ marcado, aoAlterar, rotulo, descricao, desabilitado, id, className = "" }: PropsCaixa) {
  const idGerado = useId();
  const idFinal = id ?? idGerado;
  return (
    <label htmlFor={idFinal} className={`flex cursor-pointer items-start gap-2.5 ${desabilitado ? "cursor-not-allowed opacity-60" : ""} ${className}`}>
      <span className="relative mt-0.5 inline-flex h-4.5 w-4.5 shrink-0">
        <input
          id={idFinal}
          type="checkbox"
          checked={marcado}
          disabled={desabilitado}
          onChange={(e) => aoAlterar(e.target.checked)}
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border-2 border-crm-linha-forte bg-white transition-colors checked:border-crm-verde checked:bg-crm-verde focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crm-folha disabled:cursor-not-allowed"
        />
        <Check
          size={12}
          strokeWidth={3.5}
          className="pointer-events-none absolute left-[3px] top-[3px] text-white opacity-0 peer-checked:opacity-100"
          aria-hidden
        />
      </span>
      {(rotulo || descricao) && (
        <span className="flex flex-col">
          {rotulo && <span className="text-sm text-crm-tinta">{rotulo}</span>}
          {descricao && <span className="text-xs text-crm-tinta-3">{descricao}</span>}
        </span>
      )}
    </label>
  );
}

interface PropsAlternador {
  ativo: boolean;
  aoAlterar: (v: boolean) => void;
  rotulo: string;
  mostrarRotulo?: boolean;
  desabilitado?: boolean;
}

export function Alternador({ ativo, aoAlterar, rotulo, mostrarRotulo = false, desabilitado }: PropsAlternador) {
  return (
    <label className={`inline-flex items-center gap-2 ${desabilitado ? "opacity-60" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={mostrarRotulo ? undefined : rotulo}
        disabled={desabilitado}
        onClick={() => aoAlterar(!ativo)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors ${
          ativo ? "border-crm-verde bg-crm-verde" : "border-crm-linha-forte bg-crm-suave-2"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-[22px]" : "translate-x-[3px]"}`}
        />
      </button>
      {mostrarRotulo && <span className="text-sm text-crm-tinta">{rotulo}</span>}
    </label>
  );
}

interface PropsMoeda extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  valor: number | null;
  aoAlterar: (v: number | null) => void;
}

/** Campo monetário em reais (aceita "1.234,56"). */
export function EntradaMoeda({ valor, aoAlterar, className = "", onBlur, ...props }: PropsMoeda) {
  const [texto, setTexto] = useState<string | null>(null);
  const exibido = texto ?? (valor === null || valor === undefined ? "" : formatarMoeda(valor).replace(/^R\$\s?/, ""));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-crm-tinta-3">R$</span>
      <input
        inputMode="decimal"
        className={`${classeCampo} h-9 pl-9 tabular-nums ${className}`}
        value={exibido}
        onChange={(e) => {
          setTexto(e.target.value);
          aoAlterar(lerMoeda(e.target.value));
        }}
        onBlur={(e) => {
          setTexto(null);
          onBlur?.(e);
        }}
        {...props}
      />
    </div>
  );
}

export function Rotulo({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold text-crm-tinta-2">
      {children}
    </label>
  );
}
