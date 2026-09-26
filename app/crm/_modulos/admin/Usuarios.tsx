"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { useConfig } from "../../_lib/config";
import { formatarDataHora } from "../../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { chamarFuncao } from "../../_lib/edge";
import { supabase } from "../../_lib/supabase";
import type { PermissaoCatalogo, Perfil } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Menu, Modal } from "../../_ui/Sobreposicoes";
import { Avatar, Carregando, ErroCarga, Selo } from "../../_ui/Visuais";
import { Aviso, SecaoAdmin, SeletorCor, valorDe } from "./comum";

interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  perfil_id: string;
  cargo: string | null;
  oab: string | null;
  telefone: string | null;
  cor: string;
  ativo: boolean;
  permissoes_extra: string[];
  permissoes_negadas: string[];
  ultimo_acesso_em: string | null;
  ultimo_login: string | null;
  bloqueado: boolean;
  created_at: string;
}

function usePermissoesCatalogo() {
  return useQuery({
    queryKey: ["config", "permissoes-catalogo"],
    staleTime: 60 * 60_000,
    queryFn: async () => (await executar(supabase().from("permissoes_catalogo").select("*").order("ordem"))) as PermissaoCatalogo[],
  });
}

function agruparPermissoes(lista: PermissaoCatalogo[]) {
  const grupos = new Map<string, PermissaoCatalogo[]>();
  for (const p of lista) {
    if (!grupos.has(p.modulo)) grupos.set(p.modulo, []);
    grupos.get(p.modulo)!.push(p);
  }
  return [...grupos.entries()];
}

// Senha temporária forte gerada no navegador (nunca armazenada pelo CRM).
function gerarSenha(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digitos = "23456789";
  const todos = letras + digitos + "!@#%*?";
  const aleatorio = new Uint32Array(14);
  crypto.getRandomValues(aleatorio);
  const chars = Array.from(aleatorio, (n) => todos[n % todos.length]);
  chars[3] = digitos[aleatorio[3] % digitos.length];
  chars[9] = letras[aleatorio[9] % letras.length];
  return chars.join("");
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export function AdminUsuarios() {
  const config = useConfig();
  const { perfil } = useAuth();
  const { invalidar } = useGravacao();
  const [form, setForm] = useState<{ usuario: UsuarioAdmin | null } | null>(null);
  const [senha, setSenha] = useState<UsuarioAdmin | null>(null);
  const consulta = useQuery({
    queryKey: ["config", "usuarios-admin"],
    queryFn: async () => (await chamarFuncao<{ usuarios: UsuarioAdmin[] }>("crm-admin", { acao: "listar_usuarios" })).usuarios,
  });
  const lista = consulta.data ?? [];
  const ativos = lista.filter((u) => u.ativo).length;

  const alternarAtivo = async (u: UsuarioAdmin) => {
    if (u.ativo && !(await confirmarSimples({ titulo: `Desativar ${u.nome}?`, mensagem: "A pessoa perde o acesso imediatamente. Os registros e o histórico criados por ela são mantidos. Você pode reativar depois.", confirmar: "Desativar", perigo: true }))) return;
    try {
      await chamarFuncao("crm-admin", { acao: "atualizar_usuario", id: u.id, ativo: !u.ativo });
      aviso.sucesso(u.ativo ? "Usuário desativado." : "Usuário reativado.");
      invalidar("config");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };

  return (
    <SecaoAdmin
      titulo="Usuários"
      descricao="Contas de acesso ao CRM. Não há cadastro público: somente administradores criam contas. Senhas não ficam visíveis nem armazenadas pelo CRM."
      acoes={
        <Botao variante="primario" tamanho="sm" icone={<UserPlus size={14} />} onClick={() => setForm({ usuario: null })}>
          Novo usuário
        </Botao>
      }
    >
      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : (
        <>
          <p className="text-xs text-crm-tinta-3">
            {ativos} usuário(s) ativo(s) de {lista.length}. Não há limite de contas no CRM; o plano do Supabase define os limites da autenticação.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-crm-linha bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-crm-suave text-xs font-bold text-crm-tinta-2">
                <tr>
                  <th className="px-3 py-2">Pessoa</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Último acesso</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className="border-t border-crm-linha">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar nome={u.nome} cor={u.cor} tamanho={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {u.nome} {u.id === perfil?.id && <span className="text-xs font-normal text-crm-tinta-3">(você)</span>}
                          </span>
                          <span className="block truncate text-xs text-crm-tinta-3">
                            {u.email}
                            {u.cargo ? ` · ${u.cargo}` : ""}
                            {u.oab ? ` · OAB ${u.oab}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {config.perfis.find((p) => p.id === u.perfil_id)?.nome ?? u.perfil_id}
                      {(u.permissoes_extra.length > 0 || u.permissoes_negadas.length > 0) && (
                        <span className="block text-xs text-crm-tinta-3">
                          {u.permissoes_extra.length > 0 && `+${u.permissoes_extra.length} permissão(ões)`}
                          {u.permissoes_extra.length > 0 && u.permissoes_negadas.length > 0 && " · "}
                          {u.permissoes_negadas.length > 0 && `−${u.permissoes_negadas.length} restrição(ões)`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{u.ativo ? <Selo tom="sucesso" icone={<UserCheck size={11} aria-hidden />}>Ativo</Selo> : <Selo icone={<UserX size={11} aria-hidden />}>Inativo</Selo>}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-crm-tinta-2">{formatarDataHora(u.ultimo_login ?? u.ultimo_acesso_em) || "Nunca acessou"}</td>
                    <td className="px-3 py-2 text-right">
                      <Menu
                        rotulo={`Ações de ${u.nome}`}
                        itens={[
                          { rotulo: "Editar dados e permissões", icone: <Pencil size={15} />, aoSelecionar: () => setForm({ usuario: u }) },
                          { rotulo: "Definir nova senha", icone: <KeyRound size={15} />, aoSelecionar: () => setSenha(u) },
                          ...(u.id !== perfil?.id ? [{ rotulo: u.ativo ? "Desativar acesso" : "Reativar acesso", icone: u.ativo ? <UserX size={15} /> : <UserCheck size={15} />, aoSelecionar: () => alternarAtivo(u), perigo: u.ativo, separadorAntes: true }] : []),
                        ]}
                        gatilho={(g) => (
                          <button {...g} type="button" className="rounded-lg border border-crm-linha px-2 py-1 text-xs font-semibold hover:bg-crm-suave" aria-label={`Ações de ${u.nome}`}>
                            Ações
                          </button>
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <FormUsuario pedido={form} aoFechar={() => setForm(null)} aoSalvar={() => consulta.refetch()} />
      <DefinirSenha usuario={senha} aoFechar={() => setSenha(null)} />
    </SecaoAdmin>
  );
}

function FormUsuario({ pedido, aoFechar, aoSalvar }: { pedido: { usuario: UsuarioAdmin | null } | null; aoFechar: () => void; aoSalvar: () => void }) {
  const config = useConfig();
  const { invalidar } = useGravacao();
  const catalogo = usePermissoesCatalogo();
  const u = pedido?.usuario ?? null;
  const [f, setF] = useState({ nome: "", email: "", perfil_id: "atendimento", cargo: "", oab: "", telefone: "", cor: "#3D7B3E", senha: "" });
  const [extra, setExtra] = useState<string[]>([]);
  const [negadas, setNegadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!pedido) return;
    setErro(null);
    setF({ nome: u?.nome ?? "", email: u?.email ?? "", perfil_id: u?.perfil_id ?? "atendimento", cargo: u?.cargo ?? "", oab: u?.oab ?? "", telefone: u?.telefone ?? "", cor: u?.cor ?? "#3D7B3E", senha: u ? "" : gerarSenha() });
    setExtra(u?.permissoes_extra ?? []);
    setNegadas(u?.permissoes_negadas ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const perfilSel = config.perfis.find((p) => p.id === f.perfil_id);
  const doPerfil = new Set(perfilSel?.permissoes ?? []);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      if (u) {
        await chamarFuncao("crm-admin", { acao: "atualizar_usuario", id: u.id, nome: f.nome, email: f.email, perfil_id: f.perfil_id, cargo: f.cargo, oab: f.oab, telefone: f.telefone, cor: f.cor, permissoes_extra: extra, permissoes_negadas: negadas });
        aviso.sucesso("Usuário atualizado.");
      } else {
        await chamarFuncao("crm-admin", { acao: "criar_usuario", nome: f.nome, email: f.email, senha: f.senha, perfil_id: f.perfil_id, cargo: f.cargo, oab: f.oab, telefone: f.telefone, cor: f.cor, permissoes_extra: extra, permissoes_negadas: negadas });
        aviso.sucesso("Conta criada. Entregue a senha temporária à pessoa por um canal seguro.");
      }
      invalidar("config");
      aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  const alternar = (id: string, v: boolean) => {
    // Marcar = garantir a permissão; desmarcar = negar. Igual ao perfil = sem exceção.
    const noPerfil = doPerfil.has(id);
    setExtra((x) => (v && !noPerfil ? [...new Set([...x, id])] : x.filter((y) => y !== id)));
    setNegadas((x) => (!v && noPerfil ? [...new Set([...x, id])] : x.filter((y) => y !== id)));
  };
  const efetiva = (id: string) => (f.perfil_id === "admin" ? true : (doPerfil.has(id) || extra.includes(id)) && !negadas.includes(id));

  return (
    <Modal
      aberto={Boolean(pedido)}
      aoFechar={aoFechar}
      largura="xl"
      titulo={u ? `Editar ${u.nome}` : "Novo usuário"}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            {u ? "Salvar" : "Criar conta"}
          </Botao>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form className="grid content-start gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
          {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
          <GrupoCampo rotulo="Nome completo" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} data-autofoco value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="off" />}</GrupoCampo>
          <GrupoCampo rotulo="E-mail de acesso" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" />}</GrupoCampo>
          <GrupoCampo rotulo="Perfil" obrigatorio>
            {(p) => (
              <Selecao {...p} value={f.perfil_id} onChange={(e) => setF({ ...f, perfil_id: e.target.value })}>
                {config.perfis.map((pf) => (
                  <option key={pf.id} value={pf.id}>
                    {pf.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </GrupoCampo>
          <GrupoCampo rotulo="Cargo">{(p) => <Entrada {...p} value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} placeholder="Ex.: Advogada, Atendimento" />}</GrupoCampo>
          <GrupoCampo rotulo="OAB">{(p) => <Entrada {...p} value={f.oab} onChange={(e) => setF({ ...f, oab: e.target.value })} placeholder="Ex.: SC 12.345" />}</GrupoCampo>
          <GrupoCampo rotulo="Telefone">{(p) => <Entrada {...p} value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />}</GrupoCampo>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-semibold text-crm-tinta-2">Cor do avatar</span>
            <SeletorCor valor={f.cor} aoAlterar={(cor) => setF({ ...f, cor })} rotulo="Cor do avatar" />
          </div>
          {!u && (
            <GrupoCampo rotulo="Senha temporária" obrigatorio className="sm:col-span-2" ajuda="Mínimo de 10 caracteres com letras e números. Entregue por canal seguro e peça para a pessoa trocá-la em “Esqueci minha senha” (se o envio de e-mails estiver configurado) ou com o administrador.">
              {(p) => (
                <div className="flex gap-2">
                  <Entrada {...p} value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} autoComplete="new-password" className="font-mono" />
                  <Botao tamanho="sm" onClick={() => setF({ ...f, senha: gerarSenha() })}>
                    Gerar
                  </Botao>
                </div>
              )}
            </GrupoCampo>
          )}
          <button type="submit" className="hidden" />
        </form>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-crm-tinta-2">Permissões efetivas</p>
          <p className="text-xs text-crm-tinta-3">
            Vêm do perfil <strong>{perfilSel?.nome}</strong>. Marque ou desmarque para criar exceções apenas para esta pessoa.
            {f.perfil_id === "admin" && " Administradores têm acesso completo."}
          </p>
          {catalogo.isLoading ? (
            <Carregando />
          ) : (
            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-crm-linha bg-white p-3">
              {agruparPermissoes(catalogo.data ?? []).map(([modulo, perms]) => (
                <fieldset key={modulo} className="mb-3">
                  <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-crm-tinta-3">{modulo}</legend>
                  <div className="flex flex-col gap-1">
                    {perms.map((pm) => {
                      const excecao = extra.includes(pm.id) || negadas.includes(pm.id);
                      return (
                        <CaixaSelecao
                          key={pm.id}
                          marcado={efetiva(pm.id)}
                          desabilitado={f.perfil_id === "admin"}
                          aoAlterar={(v) => alternar(pm.id, v)}
                          rotulo={
                            <span>
                              {pm.descricao}
                              {excecao && <span className="ml-1 text-[11px] font-bold text-crm-alerta">(exceção)</span>}
                            </span>
                          }
                        />
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DefinirSenha({ usuario, aoFechar }: { usuario: UsuarioAdmin | null; aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (usuario) setSenha(gerarSenha());
  }, [usuario]);
  if (!usuario) return null;
  const salvar = async () => {
    setSalvando(true);
    try {
      await chamarFuncao("crm-admin", { acao: "redefinir_senha", id: usuario.id, senha });
      aviso.sucesso("Senha redefinida. Entregue-a à pessoa por um canal seguro.");
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Nova senha para ${usuario.nome}`} descricao="A senha atual deixa de funcionar. O CRM não guarda nem exibe senhas depois de fechar esta janela." rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar}>Definir senha</Botao></>}>
      <GrupoCampo rotulo="Nova senha" ajuda="Mínimo de 10 caracteres com letras e números.">
        {(p) => (
          <div className="flex gap-2">
            <Entrada {...p} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" className="font-mono" />
            <Botao tamanho="sm" onClick={() => setSenha(gerarSenha())}>
              Gerar
            </Botao>
          </div>
        )}
      </GrupoCampo>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Perfis e permissões
// ---------------------------------------------------------------------------

export function AdminPerfis() {
  const config = useConfig();
  const catalogo = usePermissoesCatalogo();
  const { invalidar } = useGravacao();
  const [editar, setEditar] = useState<{ perfil: Perfil | null } | null>(null);
  const grupos = useMemo(() => agruparPermissoes(catalogo.data ?? []), [catalogo.data]);

  const excluir = async (p: Perfil) => {
    if (!(await confirmarSimples({ titulo: `Excluir o perfil “${p.nome}”?`, mensagem: "Só é possível excluir perfis sem usuários vinculados. Perfis iniciais do sistema não podem ser excluídos.", confirmar: "Excluir", perigo: true }))) return;
    try {
      await chamarFuncao("crm-admin", { acao: "excluir_perfil", id: p.id });
      aviso.sucesso("Perfil excluído.");
      invalidar("config");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };

  return (
    <SecaoAdmin
      titulo="Perfis e permissões"
      descricao="Cada usuário recebe um perfil. As permissões valem em todo o sistema e também no banco de dados (regras de acesso por linha)."
      acoes={
        <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={() => setEditar({ perfil: null })}>
          Novo perfil
        </Botao>
      }
    >
      <Aviso>
        Dados de saúde seguem a necessidade de saber: “ver atribuídos” libera apenas clientes e casos sob responsabilidade ou equipe da pessoa; “ver todos” deve ser concedido com cautela.
      </Aviso>
      {catalogo.isLoading ? (
        <Carregando />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-crm-linha bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Matriz de permissões por perfil</caption>
            <thead className="sticky top-0 bg-crm-suave text-xs font-bold text-crm-tinta-2">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Permissão
                </th>
                {config.perfis.map((p) => (
                  <th key={p.id} scope="col" className="px-3 py-2 text-center">
                    <span className="flex flex-col items-center gap-1">
                      {p.nome}
                      <span className="flex gap-1">
                        <button type="button" onClick={() => setEditar({ perfil: p })} className="rounded p-0.5 text-crm-tinta-3 hover:bg-white hover:text-crm-tinta" aria-label={`Editar perfil ${p.nome}`}>
                          <Pencil size={12} />
                        </button>
                        {!p.sistema && (
                          <button type="button" onClick={() => excluir(p)} className="rounded p-0.5 text-crm-tinta-3 hover:bg-white hover:text-crm-perigo" aria-label={`Excluir perfil ${p.nome}`}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([modulo, perms]) => (
                <GrupoLinhas key={modulo} modulo={modulo} perms={perms} perfis={config.perfis} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FormPerfil pedido={editar} catalogo={catalogo.data ?? []} aoFechar={() => setEditar(null)} />
    </SecaoAdmin>
  );
}

function GrupoLinhas({ modulo, perms, perfis }: { modulo: string; perms: PermissaoCatalogo[]; perfis: Perfil[] }) {
  return (
    <>
      <tr className="border-t border-crm-linha bg-crm-fundo">
        <th scope="rowgroup" colSpan={perfis.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-crm-tinta-3">
          {modulo}
        </th>
      </tr>
      {perms.map((pm) => (
        <tr key={pm.id} className="border-t border-crm-linha">
          <th scope="row" className="px-3 py-1.5 text-left font-normal">
            {pm.descricao}
          </th>
          {perfis.map((p) => {
            const tem = p.id === "admin" || p.permissoes.includes(pm.id);
            return (
              <td key={p.id} className="px-3 py-1.5 text-center">
                {tem ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-crm-sucesso">
                    <ShieldCheck size={13} aria-hidden /> Sim
                  </span>
                ) : (
                  <span className="text-xs text-crm-tinta-3">Não</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function FormPerfil({ pedido, catalogo, aoFechar }: { pedido: { perfil: Perfil | null } | null; catalogo: PermissaoCatalogo[]; aoFechar: () => void }) {
  const { invalidar } = useGravacao();
  const p = pedido?.perfil ?? null;
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!pedido) return;
    setNome(p?.nome ?? "");
    setDescricao(p?.descricao ?? "");
    setPerms(p?.permissoes ?? []);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);
  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await chamarFuncao("crm-admin", { acao: "salvar_perfil", id: p?.id ?? valorDe(nome).slice(0, 40), nome, descricao, permissoes: perms });
      aviso.sucesso(p ? "Perfil atualizado. As permissões valem imediatamente." : "Perfil criado.");
      invalidar("config", "sessao");
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal
      aberto={Boolean(pedido)}
      aoFechar={aoFechar}
      largura="lg"
      titulo={p ? `Perfil: ${p.nome}` : "Novo perfil"}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            Salvar perfil
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo">{erro}</p>}
        <GrupoCampo rotulo="Nome do perfil" obrigatorio>{(x) => <Entrada {...x} data-autofoco value={nome} onChange={(e) => setNome(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Descrição">{(x) => <AreaTexto {...x} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}</GrupoCampo>
        {p?.id === "admin" ? (
          <Aviso>O perfil Administrador sempre tem acesso completo; apenas nome e descrição podem ser alterados.</Aviso>
        ) : (
          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-crm-linha bg-white p-3">
            {agruparPermissoes(catalogo).map(([modulo, lista]) => (
              <fieldset key={modulo} className="mb-3">
                <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-crm-tinta-3">{modulo}</legend>
                <div className="flex flex-col gap-1">
                  {lista.map((pm) => (
                    <CaixaSelecao
                      key={pm.id}
                      marcado={perms.includes(pm.id)}
                      aoAlterar={(v) => setPerms((x) => (v ? [...new Set([...x, pm.id])] : x.filter((y) => y !== pm.id)))}
                      rotulo={pm.descricao}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
