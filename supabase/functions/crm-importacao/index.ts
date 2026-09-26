// Importação de clientes existentes (CSV/XLSX lidos no navegador).
// Etapa 1 "validar": normaliza, valida e identifica duplicidades (no arquivo e
// no banco), sem gravar nada. Etapa 2 "importar": grava somente as decisões
// explícitas do usuário (criar, ignorar, completar campos vazios ou atualizar
// campos escolhidos). Nada é sobrescrito silenciosamente.

import {
  cabecalhosCors,
  erro,
  ErroValidacao,
  json,
  lerJson,
  respostaErroBanco,
  texto,
} from "../_shared/http.ts";
import { clienteServico, temPermissao, usuarioAutenticado } from "../_shared/supabase.ts";

const MAX_LINHAS = 5000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export const CAMPOS = [
  "nome", "tipo_pessoa", "cpf_cnpj", "rg", "data_nascimento", "email", "whatsapp", "telefone_secundario",
  "profissao", "estado_civil", "nacionalidade", "cep", "logradouro", "numero", "complemento", "bairro",
  "cidade", "uf", "observacoes", "responsavel_email", "caso_titulo", "tipo_demanda", "numero_processo", "tribunal",
] as const;

type Dados = Partial<Record<(typeof CAMPOS)[number], string>>;

function cpfValido(valor: string): boolean {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

// Aceita o CNPJ numérico e o alfanumérico (IN RFB 2.229/2024).
function cnpjValido(valor: string): boolean {
  const v = valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}\d{2}$/.test(v) || /^(.)\1{13}$/.test(v)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, p, i) => acc + (base.charCodeAt(i) - 48) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(v.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(v.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(v[12]) && d2 === Number(v[13]);
}

function normalizarDocumento(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function chaveTelefone(valor: string): string | null {
  let d = valor.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d.slice(2, 4) + d.slice(-8);
  return d.length < 8 ? d : d.slice(-10);
}

function dataIso(valor: string): string | null {
  const v = valor.trim();
  let a: number, m: number, d: number;
  let r = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) {
    a = Number(r[1]); m = Number(r[2]); d = Number(r[3]);
  } else {
    r = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!r) return null;
    d = Number(r[1]); m = Number(r[2]); a = Number(r[3]);
    if (a < 100) a += a > 30 ? 1900 : 2000;
  }
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  if (a < 1900 || data.getTime() > Date.now()) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface LinhaEntrada {
  linha?: number;
  dados?: Record<string, unknown>;
  acao?: string;
  cliente_id?: string;
  campos?: string[];
}

interface LinhaValidada {
  linha: number;
  dados: Dados;
  erros: string[];
  avisos: string[];
}

function validarLinha(entrada: LinhaEntrada): LinhaValidada {
  const bruto = entrada.dados ?? {};
  const dados: Dados = {};
  for (const c of CAMPOS) {
    const v = texto(bruto[c], c === "observacoes" ? 2000 : 200);
    if (v) dados[c] = v;
  }
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!dados.nome || dados.nome.length < 2) erros.push("Nome ausente.");
  if (dados.nome) dados.nome = dados.nome.replace(/\s+/g, " ");

  if (dados.cpf_cnpj) {
    const doc = normalizarDocumento(dados.cpf_cnpj);
    if (doc.length === 11 && cpfValido(doc)) {
      dados.tipo_pessoa = dados.tipo_pessoa?.toUpperCase() === "PJ" ? "PJ" : "PF";
    } else if (doc.length === 14 && cnpjValido(doc)) {
      dados.tipo_pessoa = "PJ";
    } else {
      erros.push("CPF/CNPJ inválido (confira os dígitos ou deixe a coluna vazia).");
    }
  }
  if (dados.tipo_pessoa) {
    const t = dados.tipo_pessoa.toUpperCase();
    dados.tipo_pessoa = t.startsWith("J") || t === "PJ" ? "PJ" : "PF";
  }

  if (dados.email) {
    dados.email = dados.email.toLowerCase();
    if (!EMAIL.test(dados.email)) {
      avisos.push("E-mail inválido — o campo será ignorado.");
      delete dados.email;
    }
  }
  for (const campo of ["whatsapp", "telefone_secundario"] as const) {
    if (dados[campo]) {
      const digitos = dados[campo]!.replace(/\D/g, "");
      if (digitos.length < 10 || digitos.length > 13) {
        avisos.push(`${campo === "whatsapp" ? "WhatsApp" : "Telefone"} com formato inesperado — conferir.`);
      }
    }
  }
  if (dados.data_nascimento) {
    const iso = dataIso(dados.data_nascimento);
    if (!iso) {
      avisos.push("Data de nascimento inválida — o campo será ignorado.");
      delete dados.data_nascimento;
    } else {
      dados.data_nascimento = iso;
    }
  }
  if (dados.uf) {
    dados.uf = dados.uf.toUpperCase();
    if (!UFS.has(dados.uf)) {
      avisos.push("UF inválida — o campo será ignorado.");
      delete dados.uf;
    }
  }
  if (dados.cep) {
    const cep = dados.cep.replace(/\D/g, "");
    if (cep.length === 8) dados.cep = `${cep.slice(0, 5)}-${cep.slice(5)}`;
    else avisos.push("CEP com formato inesperado.");
  }
  if (dados.responsavel_email) dados.responsavel_email = dados.responsavel_email.toLowerCase();

  return { linha: Number(entrada.linha ?? 0), dados, erros, avisos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhosCors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido.", 405);

  const servico = clienteServico();
  const usuario = await usuarioAutenticado(req, servico);
  if (!usuario) return erro(req, "Sessão expirada. Entre novamente.", 401);
  if (!(await temPermissao(servico, usuario.id, "dados.importar"))) {
    return erro(req, "Você não tem permissão para importar dados.", 403);
  }

  let pedido: { acao?: string; linhas?: LinhaEntrada[]; arquivo_nome?: string; mapeamento?: Record<string, string> };
  try {
    pedido = await lerJson(req, 8 * 1024 * 1024);
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(req, e.message, e.status);
    return erro(req, "Dados inválidos.", 400);
  }
  const linhas = Array.isArray(pedido.linhas) ? pedido.linhas : [];
  if (linhas.length === 0) return erro(req, "A planilha não possui linhas para importar.", 400);
  if (linhas.length > MAX_LINHAS) return erro(req, `Limite de ${MAX_LINHAS} linhas por importação.`, 413);

  const validadas = linhas.map(validarLinha);

  if (pedido.acao === "validar") {
    // Duplicidades dentro do próprio arquivo
    const vistos = new Map<string, number>();
    const duplicadasNoArquivo = new Map<number, number[]>();
    for (const l of validadas) {
      const chaves = [
        l.dados.cpf_cnpj ? `doc:${normalizarDocumento(l.dados.cpf_cnpj)}` : null,
        l.dados.email ? `email:${l.dados.email}` : null,
        l.dados.whatsapp ? `tel:${chaveTelefone(l.dados.whatsapp)}` : null,
      ].filter(Boolean) as string[];
      for (const k of chaves) {
        const anterior = vistos.get(k);
        if (anterior !== undefined && anterior !== l.linha) {
          duplicadasNoArquivo.set(l.linha, [...new Set([...(duplicadasNoArquivo.get(l.linha) ?? []), anterior])]);
        } else {
          vistos.set(k, l.linha);
        }
      }
    }

    // Duplicidades no banco
    const cpfs = validadas.map((l) => l.dados.cpf_cnpj && normalizarDocumento(l.dados.cpf_cnpj)).filter(Boolean);
    const emails = validadas.map((l) => l.dados.email).filter(Boolean);
    const telefones = validadas.map((l) => l.dados.whatsapp).filter(Boolean);
    const { data: existentes, error } = await servico.rpc("importar_buscar_duplicados", {
      p_cpfs: cpfs,
      p_emails: emails,
      p_telefones: telefones,
    });
    if (error) return respostaErroBanco(req, error, "crm-importacao:duplicados");
    const ex = existentes as {
      clientes: { id: string; codigo: string; nome: string; cpf: string | null; email: string | null; telefone: string | null; arquivado: boolean }[];
      leads: { id: string; codigo: string; nome: string; cpf: string | null; email: string | null; telefone: string | null }[];
    };

    const { data: usuarios } = await servico.from("usuarios").select("email").eq("ativo", true);
    const emailsUsuarios = new Set((usuarios ?? []).map((u) => String(u.email).toLowerCase()));
    const { data: tipos } = await servico.from("tipos_demanda").select("nome").eq("ativo", true);
    const nomesTipos = new Set((tipos ?? []).map((t) => String(t.nome).toLowerCase()));

    const resultado = validadas.map((l) => {
      const doc = l.dados.cpf_cnpj ? normalizarDocumento(l.dados.cpf_cnpj) : null;
      const tel = l.dados.whatsapp ? chaveTelefone(l.dados.whatsapp) : null;
      const motivos = (r: { cpf: string | null; email: string | null; telefone: string | null }) =>
        [
          doc && r.cpf === doc ? "CPF/CNPJ" : null,
          l.dados.email && r.email === l.dados.email ? "e-mail" : null,
          tel && r.telefone === tel ? "telefone" : null,
        ].filter(Boolean) as string[];
      const clientes = ex.clientes
        .map((c) => ({ tipo: "cliente", id: c.id, codigo: c.codigo, nome: c.nome, arquivado: c.arquivado, motivos: motivos(c) }))
        .filter((c) => c.motivos.length > 0);
      const leads = ex.leads
        .map((c) => ({ tipo: "lead", id: c.id, codigo: c.codigo, nome: c.nome, arquivado: false, motivos: motivos(c) }))
        .filter((c) => c.motivos.length > 0);

      if (l.dados.responsavel_email && !emailsUsuarios.has(l.dados.responsavel_email)) {
        l.avisos.push("Responsável não encontrado entre os usuários ativos — será usado você.");
      }
      if (l.dados.tipo_demanda && !nomesTipos.has(l.dados.tipo_demanda.toLowerCase())) {
        l.avisos.push("Tipo de demanda não cadastrado — o caso ficará sem tipo.");
      }
      if (leads.length > 0) l.avisos.push("Há lead em atendimento com os mesmos dados de contato.");

      const bloqueadoPorDoc = clientes.some((c) => c.motivos.includes("CPF/CNPJ") && !c.arquivado);
      return {
        ...l,
        duplicados: [...clientes, ...leads],
        duplicado_no_arquivo: duplicadasNoArquivo.get(l.linha) ?? [],
        sugestao: l.erros.length > 0 ? "ignorar" : clientes.length > 0 || bloqueadoPorDoc ? "ignorar" : "criar",
      };
    });

    return json(req, {
      ok: true,
      linhas: resultado,
      resumo: {
        total: resultado.length,
        com_erro: resultado.filter((r) => r.erros.length > 0).length,
        possiveis_duplicados: resultado.filter((r) => r.duplicados.some((d) => d.tipo === "cliente")).length,
        duplicados_no_arquivo: resultado.filter((r) => r.duplicado_no_arquivo.length > 0).length,
      },
    });
  }

  if (pedido.acao === "importar") {
    const relatorioPrevio: { linha: number; resultado: string; mensagem: string }[] = [];
    const paraGravar: { linha: number; acao: string; cliente_id: string | null; campos: string[]; dados: Dados }[] = [];
    const acoes = new Set(["criar", "ignorar", "completar", "atualizar"]);
    linhas.forEach((entrada, i) => {
      const l = validadas[i];
      const acao = acoes.has(String(entrada.acao)) ? String(entrada.acao) : "ignorar";
      if (acao !== "ignorar" && l.erros.length > 0) {
        relatorioPrevio.push({ linha: l.linha, resultado: "erro", mensagem: l.erros.join(" ") });
        return;
      }
      if ((acao === "completar" || acao === "atualizar") && !entrada.cliente_id) {
        relatorioPrevio.push({ linha: l.linha, resultado: "erro", mensagem: "Selecione o cliente existente a atualizar." });
        return;
      }
      paraGravar.push({
        linha: l.linha,
        acao,
        cliente_id: entrada.cliente_id ?? null,
        campos: Array.isArray(entrada.campos) ? entrada.campos.map(String) : [],
        dados: l.dados,
      });
    });

    if (paraGravar.length === 0) {
      return json(req, {
        ok: true,
        criados: 0,
        atualizados: 0,
        ignorados: 0,
        erros: relatorioPrevio.length,
        relatorio: relatorioPrevio,
      });
    }

    const { data, error } = await servico.rpc("importar_clientes", {
      p_ator: usuario.id,
      p: {
        arquivo_nome: texto(pedido.arquivo_nome, 200),
        mapeamento: pedido.mapeamento ?? {},
        linhas: paraGravar,
      },
    });
    if (error) return respostaErroBanco(req, error, "crm-importacao:importar");
    const r = data as { criados: number; atualizados: number; ignorados: number; erros: number; relatorio: unknown[]; importacao_id: string };
    return json(req, {
      ok: true,
      importacao_id: r.importacao_id,
      criados: r.criados,
      atualizados: r.atualizados,
      ignorados: r.ignorados,
      erros: r.erros + relatorioPrevio.length,
      relatorio: [...relatorioPrevio, ...r.relatorio],
    });
  }

  return erro(req, "Ação inválida.", 400);
});
