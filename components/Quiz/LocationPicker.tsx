"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

interface UF {
  id: number;
  sigla: string;
  nome: string;
}

interface LocationValue {
  estado: string;
  municipio: string;
}

interface Props {
  onChange: (value: LocationValue) => void;
}

export default function LocationPicker({ onChange }: Props) {
  const [ufs, setUfs] = useState<UF[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [uf, setUf] = useState<UF | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [city, setCity] = useState("");

  const [ufOpen, setUfOpen] = useState(false);
  const [ufQuery, setUfQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const ufRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  // fetch states once
  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((r) => r.json())
      .then((data: UF[]) => setUfs(data))
      .catch(() => setUfs([]));
  }, []);

  // fetch cities when UF changes
  useEffect(() => {
    if (!uf) return;
    setLoadingCities(true);
    setCities([]);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.id}/municipios`)
      .then((r) => r.json())
      .then((data: { nome: string }[]) => setCities(data.map((c) => c.nome)))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [uf]);

  // close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ufRef.current && !ufRef.current.contains(e.target as Node)) setUfOpen(false);
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // notify parent
  useEffect(() => {
    onChange({ estado: uf?.sigla ?? "", municipio: city });
  }, [uf, city, onChange]);

  const filteredUfs = ufs.filter(
    (u) =>
      u.nome.toLowerCase().includes(ufQuery.toLowerCase()) ||
      u.sigla.toLowerCase().includes(ufQuery.toLowerCase())
  );

  const filteredCities = cityQuery
    ? cities.filter((c) => c.toLowerCase().includes(cityQuery.toLowerCase())).slice(0, 50)
    : cities.slice(0, 50);

  const selectUf = (u: UF) => {
    setUf(u);
    setUfOpen(false);
    setUfQuery("");
    setCity("");
    setCityQuery("");
  };

  const selectCity = (c: string) => {
    setCity(c);
    setCityQuery(c);
    setCityOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Estado — searchable dropdown */}
      <div ref={ufRef} className="relative">
        <button
          type="button"
          onClick={() => setUfOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-left outline-none transition-colors focus:border-[#263A2D] hover:border-[#263A2D]/40"
        >
          <span className={uf ? "text-zinc-700" : "text-zinc-400"}>
            {uf ? `${uf.nome} (${uf.sigla})` : "Selecione seu estado"}
          </span>
          <ChevronDown
            size={16}
            className={`text-zinc-400 transition-transform ${ufOpen ? "rotate-180" : ""}`}
          />
        </button>

        {ufOpen && (
          <div className="absolute z-30 mt-2 w-full rounded-xl border-2 border-zinc-200 bg-white shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100">
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input
                autoFocus
                value={ufQuery}
                onChange={(e) => setUfQuery(e.target.value)}
                placeholder="Buscar estado..."
                className="w-full text-sm outline-none text-zinc-700 placeholder:text-zinc-400"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filteredUfs.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => selectUf(u)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left text-zinc-700 hover:bg-[#f0f5f1] transition-colors"
                  >
                    <span>
                      {u.nome} <span className="text-zinc-400">({u.sigla})</span>
                    </span>
                    {uf?.id === u.id && <Check size={15} className="text-[#263A2D]" />}
                  </button>
                </li>
              ))}
              {filteredUfs.length === 0 && (
                <li className="px-4 py-3 text-sm text-zinc-400">Nenhum estado encontrado</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Cidade — autocomplete input */}
      <div ref={cityRef} className="relative">
        <input
          value={cityQuery}
          disabled={!uf}
          onFocus={() => uf && setCityOpen(true)}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setCity("");
            setCityOpen(true);
          }}
          placeholder={
            !uf ? "Escolha o estado primeiro" : loadingCities ? "Carregando cidades..." : "Digite sua cidade"
          }
          className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-700 outline-none transition-colors focus:border-[#263A2D] disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed placeholder:text-zinc-400"
        />

        {cityOpen && uf && !loadingCities && filteredCities.length > 0 && city !== cityQuery && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border-2 border-zinc-200 bg-white shadow-lg overflow-hidden">
            <ul className="max-h-56 overflow-y-auto py-1">
              {filteredCities.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => selectCity(c)}
                    className="w-full px-4 py-2.5 text-sm text-left text-zinc-700 hover:bg-[#f0f5f1] transition-colors"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
