-- =============================================================================
-- CRM Amado & Amado Jr. — 14. Segurança: funções de acesso, Row Level Security
-- e privilégios
--
-- Princípios:
--   * Nenhuma tabela do CRM é acessível ao papel "anon".
--   * Usuário inativo ou sem cadastro em "usuarios" não acessa nada.
--   * Dados de saúde (categorias clínicas, dados_clinicos, campos sensíveis)
--     exigem saude.ver_todos ou saude.ver_atribuidos (responsável/equipe).
--   * Financeiro: leitura com financeiro.ver; escrita apenas pela Edge Function.
--   * Funções executáveis por "authenticated" constam de uma lista explícita.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções de acesso
-- -----------------------------------------------------------------------------

create or replace function public.eh_responsavel(p_cliente uuid, p_caso uuid default null, p_lead uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_atual() is not null and (
    exists (select 1 from public.clientes c where c.id = p_cliente and c.responsavel_id = public.usuario_atual())
    or exists (select 1 from public.casos k
               where (k.id = p_caso or (p_cliente is not null and k.cliente_id = p_cliente))
                 and (k.responsavel_id = public.usuario_atual() or public.usuario_atual() = any (k.equipe)))
    or exists (select 1 from public.leads l where l.id = p_lead and l.responsavel_id = public.usuario_atual())
  )
$$;

-- Acesso a dados de saúde: todos (saude.ver_todos) ou somente onde é
-- responsável/equipe (saude.ver_atribuidos).
create or replace function public.pode_ver_saude(p_cliente uuid, p_lead uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tem_permissao('saude.ver_todos')
      or (public.tem_permissao('saude.ver_atribuidos') and public.eh_responsavel(p_cliente, null, p_lead))
$$;

create or replace function public.pode_ver_saude_registro(p_entidade text, p_registro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entidade
    when 'lead' then public.pode_ver_saude(null, p_registro)
    when 'cliente' then public.pode_ver_saude(p_registro, null)
    when 'caso' then public.tem_permissao('saude.ver_todos')
                  or (public.tem_permissao('saude.ver_atribuidos')
                      and public.eh_responsavel((select k.cliente_id from public.casos k where k.id = p_registro), p_registro, null))
    else false
  end
$$;

create or replace function public.pode_ver_tarefa(p_tarefa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_ativo() and exists (
    select 1 from public.tarefas t
    where t.id = p_tarefa
      and (public.tem_permissao('tarefas.ver_todas')
           or t.responsavel_id = public.usuario_atual()
           or t.created_by = public.usuario_atual())
  )
$$;

create or replace function public.pode_ver_documento(p_documento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documentos d
    where d.id = p_documento
      and public.tem_permissao('documentos.ver')
      and (not d.clinico or public.pode_ver_saude(d.cliente_id, d.lead_id))
      and (not d.financeiro or public.tem_permissao('financeiro.ver'))
  )
$$;

create or replace function public.pode_ver_registro(p_entidade text, p_registro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_ativo() and case p_entidade
    when 'lead' then public.tem_permissao('leads.ver')
    when 'cliente' then public.tem_permissao('clientes.ver')
    when 'caso' then public.tem_permissao('casos.ver')
    when 'processo' then public.tem_permissao('casos.ver')
    when 'prazo' then public.tem_permissao('prazos.ver')
    when 'tarefa' then public.pode_ver_tarefa(p_registro)
    when 'documento' then public.pode_ver_documento(p_registro)
    when 'compromisso' then public.tem_permissao('agenda.ver_todas') or exists (
      select 1 from public.compromissos c where c.id = p_registro
        and (c.responsavel_id = public.usuario_atual() or c.created_by = public.usuario_atual()
             or public.usuario_atual() = any (c.participantes)))
    else false
  end
$$;

create or replace function public.pode_editar_entidade(p_entidade text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entidade
    when 'lead' then public.tem_permissao('leads.editar')
    when 'cliente' then public.tem_permissao('clientes.editar')
    when 'caso' then public.tem_permissao('casos.editar')
    else false
  end
$$;

create or replace function public.pode_ver_campo(p_campo uuid, p_entidade text, p_registro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pode_ver_registro(p_entidade, p_registro) and coalesce((
    select case c.visibilidade
      when 'todos' then true
      when 'saude' then public.pode_ver_saude_registro(p_entidade, p_registro)
      when 'financeiro' then public.tem_permissao('financeiro.ver')
      when 'admin' then public.eh_admin()
      else false
    end
    from public.campos_personalizados c where c.id = p_campo
  ), false)
$$;

-- -----------------------------------------------------------------------------
-- Habilita RLS em todas as tabelas do CRM
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'permissoes_catalogo', 'perfis', 'usuarios', 'tipos_demanda', 'etapas', 'opcoes', 'etiquetas',
    'campos_personalizados', 'valores_personalizados', 'configuracoes', 'visualizacoes', 'visualizacoes_favoritas',
    'feriados', 'leads', 'clientes', 'dados_clinicos', 'quiz_submissoes', 'quiz_respostas', 'consentimentos',
    'interacoes', 'casos', 'processos', 'partes', 'andamentos', 'modelos_tarefas', 'automacoes', 'tarefas',
    'compromissos', 'prazos', 'prazos_historico', 'categorias_documento', 'modelos_checklist',
    'modelos_checklist_grupos', 'modelos_checklist_itens', 'documentos', 'documentos_historico',
    'solicitacoes_documentos', 'arquivos', 'midias', 'contratos', 'cobrancas', 'pagamentos', 'reembolsos',
    'despesas', 'comentarios', 'eventos', 'notificacoes', 'auditoria', 'importacoes', 'limites_uso',
    'automacoes_execucoes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Cadastros de configuração: leitura para usuários ativos; escrita para
-- administradores de configuração.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'tipos_demanda', 'etapas', 'opcoes', 'etiquetas', 'campos_personalizados', 'configuracoes',
    'categorias_documento', 'modelos_checklist', 'modelos_checklist_grupos', 'modelos_checklist_itens', 'modelos_tarefas'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.usuario_ativo()))', t || '_ler', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.tem_permissao(''admin.configuracoes'')))', t || '_inserir', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.tem_permissao(''admin.configuracoes''))) with check ((select public.tem_permissao(''admin.configuracoes'')))', t || '_alterar', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.tem_permissao(''admin.configuracoes'')))', t || '_excluir', t);
  end loop;
end
$$;

create policy permissoes_catalogo_ler on public.permissoes_catalogo for select to authenticated
  using ((select public.usuario_ativo()));
create policy perfis_ler on public.perfis for select to authenticated
  using ((select public.usuario_ativo()));
-- O próprio usuário sempre enxerga o seu cadastro (inclusive para exibir "conta inativa").
create policy usuarios_ler on public.usuarios for select to authenticated
  using ((select public.usuario_ativo()) or id = (select auth.uid()));

create policy automacoes_ler on public.automacoes for select to authenticated
  using ((select public.usuario_ativo()));
create policy automacoes_inserir on public.automacoes for insert to authenticated
  with check ((select public.tem_permissao('admin.automacoes')));
create policy automacoes_alterar on public.automacoes for update to authenticated
  using ((select public.tem_permissao('admin.automacoes'))) with check ((select public.tem_permissao('admin.automacoes')));
create policy automacoes_excluir on public.automacoes for delete to authenticated
  using ((select public.tem_permissao('admin.automacoes')));
create policy automacoes_execucoes_ler on public.automacoes_execucoes for select to authenticated
  using ((select public.tem_permissao('admin.automacoes')));

create policy feriados_ler on public.feriados for select to authenticated
  using ((select public.usuario_ativo()));
create policy feriados_inserir on public.feriados for insert to authenticated
  with check ((select public.tem_permissao('admin.configuracoes')) or (select public.tem_permissao('prazos.conferir')));
create policy feriados_alterar on public.feriados for update to authenticated
  using ((select public.tem_permissao('admin.configuracoes')) or (select public.tem_permissao('prazos.conferir')))
  with check ((select public.tem_permissao('admin.configuracoes')) or (select public.tem_permissao('prazos.conferir')));
create policy feriados_excluir on public.feriados for delete to authenticated
  using ((select public.tem_permissao('admin.configuracoes')) or (select public.tem_permissao('prazos.conferir')));

-- Visualizações: próprias ou compartilhadas. Compartilhar/definir padrão exige admin.configuracoes.
create policy visualizacoes_ler on public.visualizacoes for select to authenticated
  using ((select public.usuario_ativo()) and (dono_id = (select auth.uid()) or compartilhada));
create policy visualizacoes_inserir on public.visualizacoes for insert to authenticated
  with check ((select public.usuario_ativo()) and dono_id = (select auth.uid())
              and ((not compartilhada and not padrao) or (select public.tem_permissao('admin.configuracoes'))));
create policy visualizacoes_alterar on public.visualizacoes for update to authenticated
  using ((select public.usuario_ativo()) and (dono_id = (select auth.uid()) or (compartilhada and (select public.tem_permissao('admin.configuracoes')))))
  with check ((not compartilhada and not padrao and dono_id = (select auth.uid())) or (select public.tem_permissao('admin.configuracoes')));
create policy visualizacoes_excluir on public.visualizacoes for delete to authenticated
  using ((select public.usuario_ativo()) and (dono_id = (select auth.uid()) or (select public.tem_permissao('admin.configuracoes'))));

create policy visualizacoes_favoritas_ler on public.visualizacoes_favoritas for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy visualizacoes_favoritas_inserir on public.visualizacoes_favoritas for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select public.usuario_ativo()));
create policy visualizacoes_favoritas_excluir on public.visualizacoes_favoritas for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- Campos personalizados (valores): visibilidade por campo + permissão da entidade.
create policy valores_personalizados_ler on public.valores_personalizados for select to authenticated
  using (public.pode_ver_campo(campo_id, entidade, registro_id));
create policy valores_personalizados_inserir on public.valores_personalizados for insert to authenticated
  with check (public.pode_editar_entidade(entidade) and public.pode_ver_campo(campo_id, entidade, registro_id));
create policy valores_personalizados_alterar on public.valores_personalizados for update to authenticated
  using (public.pode_editar_entidade(entidade) and public.pode_ver_campo(campo_id, entidade, registro_id))
  with check (public.pode_editar_entidade(entidade) and public.pode_ver_campo(campo_id, entidade, registro_id));
create policy valores_personalizados_excluir on public.valores_personalizados for delete to authenticated
  using (public.pode_editar_entidade(entidade) and public.pode_ver_campo(campo_id, entidade, registro_id));

-- -----------------------------------------------------------------------------
-- Leads, quiz e clientes
-- -----------------------------------------------------------------------------

create policy leads_ler on public.leads for select to authenticated
  using ((select public.tem_permissao('leads.ver')));
create policy leads_inserir on public.leads for insert to authenticated
  with check ((select public.tem_permissao('leads.editar')));
create policy leads_alterar on public.leads for update to authenticated
  using ((select public.tem_permissao('leads.editar'))) with check ((select public.tem_permissao('leads.editar')));
create policy leads_excluir on public.leads for delete to authenticated
  using ((select public.tem_permissao('leads.excluir')));

create policy quiz_submissoes_ler on public.quiz_submissoes for select to authenticated
  using ((select public.tem_permissao('leads.ver')));
create policy quiz_respostas_ler on public.quiz_respostas for select to authenticated
  using ((select public.tem_permissao('leads.ver')));
create policy consentimentos_ler on public.consentimentos for select to authenticated
  using ((select public.tem_permissao('leads.ver')) or (select public.tem_permissao('clientes.ver')));

create policy clientes_ler on public.clientes for select to authenticated
  using ((select public.tem_permissao('clientes.ver')));
create policy clientes_inserir on public.clientes for insert to authenticated
  with check ((select public.tem_permissao('clientes.editar')));
create policy clientes_alterar on public.clientes for update to authenticated
  using ((select public.tem_permissao('clientes.editar'))) with check ((select public.tem_permissao('clientes.editar')));
create policy clientes_excluir on public.clientes for delete to authenticated
  using ((select public.tem_permissao('clientes.excluir')));

create policy dados_clinicos_ler on public.dados_clinicos for select to authenticated
  using (public.pode_ver_saude(cliente_id));
create policy dados_clinicos_inserir on public.dados_clinicos for insert to authenticated
  with check (public.pode_ver_saude(cliente_id) and (select public.tem_permissao('clientes.editar')));
create policy dados_clinicos_alterar on public.dados_clinicos for update to authenticated
  using (public.pode_ver_saude(cliente_id) and (select public.tem_permissao('clientes.editar')))
  with check (public.pode_ver_saude(cliente_id) and (select public.tem_permissao('clientes.editar')));

create policy interacoes_ler on public.interacoes for select to authenticated
  using ((lead_id is not null and (select public.tem_permissao('leads.ver')))
         or (cliente_id is not null and (select public.tem_permissao('clientes.ver')))
         or (caso_id is not null and (select public.tem_permissao('casos.ver'))));
create policy interacoes_inserir on public.interacoes for insert to authenticated
  with check ((select public.usuario_ativo())
              and ((lead_id is not null and (select public.tem_permissao('leads.editar')))
                   or (cliente_id is not null and (select public.tem_permissao('clientes.editar')))
                   or (caso_id is not null and ((select public.tem_permissao('casos.editar'))
                                                or (select public.tem_permissao('clientes.editar'))))));
create policy interacoes_alterar on public.interacoes for update to authenticated
  using ((select public.usuario_ativo()) and (usuario_id = (select auth.uid()) or (select public.eh_admin())))
  with check ((select public.usuario_ativo()) and (usuario_id = (select auth.uid()) or (select public.eh_admin())));
create policy interacoes_excluir on public.interacoes for delete to authenticated
  using ((select public.usuario_ativo()) and (usuario_id = (select auth.uid()) or (select public.eh_admin())));

-- -----------------------------------------------------------------------------
-- Casos, processos, partes e andamentos
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['casos', 'processos', 'partes', 'andamentos'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.tem_permissao(''casos.ver'')))', t || '_ler', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.tem_permissao(''casos.editar'')))', t || '_inserir', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.tem_permissao(''casos.editar''))) with check ((select public.tem_permissao(''casos.editar'')))', t || '_alterar', t);
  end loop;
end
$$;

create policy casos_excluir on public.casos for delete to authenticated
  using ((select public.tem_permissao('casos.excluir')));
create policy processos_excluir on public.processos for delete to authenticated
  using ((select public.tem_permissao('casos.editar')));
create policy partes_excluir on public.partes for delete to authenticated
  using ((select public.tem_permissao('casos.editar')));
create policy andamentos_excluir on public.andamentos for delete to authenticated
  using ((select public.tem_permissao('casos.editar')) and (registrado_por = (select auth.uid()) or (select public.eh_admin())));

-- -----------------------------------------------------------------------------
-- Tarefas e agenda
-- -----------------------------------------------------------------------------

create policy tarefas_ler on public.tarefas for select to authenticated
  using ((select public.usuario_ativo())
         and ((select public.tem_permissao('tarefas.ver_todas'))
              or responsavel_id = (select auth.uid()) or created_by = (select auth.uid())));
create policy tarefas_inserir on public.tarefas for insert to authenticated
  with check ((select public.usuario_ativo())
              and ((select public.tem_permissao('tarefas.editar')) or responsavel_id = (select auth.uid())));
create policy tarefas_alterar on public.tarefas for update to authenticated
  using ((select public.usuario_ativo())
         and ((select public.tem_permissao('tarefas.editar'))
              or responsavel_id = (select auth.uid()) or created_by = (select auth.uid())))
  with check ((select public.usuario_ativo())
              and ((select public.tem_permissao('tarefas.editar'))
                   or responsavel_id = (select auth.uid()) or created_by = (select auth.uid())));
create policy tarefas_excluir on public.tarefas for delete to authenticated
  using ((select public.tem_permissao('tarefas.editar')) or created_by = (select auth.uid()));

create policy compromissos_ler on public.compromissos for select to authenticated
  using ((select public.usuario_ativo())
         and ((select public.tem_permissao('agenda.ver_todas'))
              or responsavel_id = (select auth.uid()) or created_by = (select auth.uid())
              or (select auth.uid()) = any (participantes)));
create policy compromissos_inserir on public.compromissos for insert to authenticated
  with check ((select public.usuario_ativo())
              and ((select public.tem_permissao('agenda.editar')) or coalesce(responsavel_id, (select auth.uid())) = (select auth.uid())));
create policy compromissos_alterar on public.compromissos for update to authenticated
  using ((select public.usuario_ativo())
         and ((select public.tem_permissao('agenda.editar')) or responsavel_id = (select auth.uid()) or created_by = (select auth.uid())))
  with check ((select public.usuario_ativo())
              and ((select public.tem_permissao('agenda.editar')) or responsavel_id = (select auth.uid()) or created_by = (select auth.uid())));
create policy compromissos_excluir on public.compromissos for delete to authenticated
  using ((select public.tem_permissao('agenda.editar')) or created_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Prazos (exclusão definitiva apenas por administradores; use "cancelado")
-- -----------------------------------------------------------------------------

create policy prazos_ler on public.prazos for select to authenticated
  using ((select public.tem_permissao('prazos.ver')));
create policy prazos_inserir on public.prazos for insert to authenticated
  with check ((select public.tem_permissao('prazos.editar')));
create policy prazos_alterar on public.prazos for update to authenticated
  using ((select public.tem_permissao('prazos.editar'))) with check ((select public.tem_permissao('prazos.editar')));
create policy prazos_excluir on public.prazos for delete to authenticated
  using ((select public.eh_admin()));
create policy prazos_historico_ler on public.prazos_historico for select to authenticated
  using ((select public.tem_permissao('prazos.ver')));

-- -----------------------------------------------------------------------------
-- Documentos, arquivos, mídias e solicitações
-- -----------------------------------------------------------------------------

create policy documentos_ler on public.documentos for select to authenticated
  using ((select public.tem_permissao('documentos.ver'))
         and (not clinico or public.pode_ver_saude(cliente_id, lead_id))
         and (not financeiro or (select public.tem_permissao('financeiro.ver'))));
create policy documentos_inserir on public.documentos for insert to authenticated
  with check ((select public.tem_permissao('documentos.editar'))
              and (not clinico or public.pode_ver_saude(cliente_id, lead_id))
              and (not financeiro or (select public.tem_permissao('financeiro.ver'))));
create policy documentos_alterar on public.documentos for update to authenticated
  using ((select public.tem_permissao('documentos.editar'))
         and (not clinico or public.pode_ver_saude(cliente_id, lead_id))
         and (not financeiro or (select public.tem_permissao('financeiro.ver'))))
  with check ((select public.tem_permissao('documentos.editar'))
              and (not clinico or public.pode_ver_saude(cliente_id, lead_id))
              and (not financeiro or (select public.tem_permissao('financeiro.ver'))));
create policy documentos_excluir on public.documentos for delete to authenticated
  using ((select public.tem_permissao('documentos.excluir'))
         and (not clinico or public.pode_ver_saude(cliente_id, lead_id))
         and (not financeiro or (select public.tem_permissao('financeiro.ver'))));

create policy documentos_historico_ler on public.documentos_historico for select to authenticated
  using (public.pode_ver_documento(documento_id));

create policy solicitacoes_documentos_ler on public.solicitacoes_documentos for select to authenticated
  using ((select public.tem_permissao('documentos.ver')));

create or replace function public.pode_ver_arquivo(a public.arquivos)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_ativo()
    and (a.removido_em is null or public.eh_admin() or public.tem_permissao('documentos.excluir'))
    and case
      when a.financeiro then public.tem_permissao('financeiro.ver')
      when a.clinico then public.tem_permissao('documentos.ver') and public.pode_ver_saude(a.cliente_id, a.lead_id)
      when a.restrito then public.eh_admin() or public.eh_responsavel(a.cliente_id, a.caso_id, a.lead_id)
      when a.tarefa_id is not null and a.cliente_id is null and a.caso_id is null and a.lead_id is null
        then public.pode_ver_tarefa(a.tarefa_id)
      else public.tem_permissao('documentos.ver')
        or (a.tarefa_id is not null and public.pode_ver_tarefa(a.tarefa_id))
    end
$$;

create policy arquivos_ler on public.arquivos for select to authenticated
  using (public.pode_ver_arquivo(arquivos));
create policy arquivos_inserir on public.arquivos for insert to authenticated
  with check ((select public.usuario_ativo()) and bucket = 'crm-documentos'
              and ((select public.tem_permissao('documentos.editar'))
                   or (tarefa_id is not null and public.pode_ver_tarefa(tarefa_id)))
              and (not clinico or public.pode_ver_saude(cliente_id, lead_id))
              and (not financeiro or (select public.tem_permissao('financeiro.ver'))));
create policy arquivos_alterar on public.arquivos for update to authenticated
  using (bucket = 'crm-documentos' and (select public.tem_permissao('documentos.editar')) and public.pode_ver_arquivo(arquivos))
  with check (bucket = 'crm-documentos' and (select public.tem_permissao('documentos.editar')));
create policy arquivos_excluir on public.arquivos for delete to authenticated
  using ((select public.tem_permissao('documentos.excluir')) and removido_em is not null and bucket = 'crm-documentos');

create policy midias_ler on public.midias for select to authenticated
  using ((select public.usuario_ativo()) and case visibilidade
    when 'equipe' then (cliente_id is not null and (select public.tem_permissao('clientes.ver')))
                    or (caso_id is not null and (select public.tem_permissao('casos.ver')))
    when 'saude' then public.pode_ver_saude(coalesce(cliente_id, (select k.cliente_id from public.casos k where k.id = caso_id)))
    else (select public.eh_admin()) or public.eh_responsavel(cliente_id, caso_id, null)
  end);
create policy midias_inserir on public.midias for insert to authenticated
  with check ((select public.tem_permissao('documentos.editar')));
create policy midias_alterar on public.midias for update to authenticated
  using ((select public.tem_permissao('documentos.editar')))
  with check ((select public.tem_permissao('documentos.editar')));
create policy midias_excluir on public.midias for delete to authenticated
  using ((select public.tem_permissao('documentos.excluir')) or created_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Financeiro: somente leitura (escrita pela Edge Function crm-financeiro)
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['contratos', 'cobrancas', 'pagamentos', 'reembolsos', 'despesas'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.tem_permissao(''financeiro.ver'')))', t || '_ler', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Comentários, linha do tempo, notificações, auditoria e importações
-- -----------------------------------------------------------------------------

create policy comentarios_ler on public.comentarios for select to authenticated
  using (removido_em is null and public.pode_ver_registro(entidade, registro_id));
create policy comentarios_inserir on public.comentarios for insert to authenticated
  with check (public.pode_ver_registro(entidade, registro_id));
create policy comentarios_alterar on public.comentarios for update to authenticated
  using (autor_id = (select auth.uid()) and (select public.usuario_ativo()))
  with check (autor_id = (select auth.uid()));

create policy eventos_ler on public.eventos for select to authenticated
  using (
    (select public.usuario_ativo())
    and (restrito is null
         or (restrito = 'financeiro' and (select public.tem_permissao('financeiro.ver')))
         or (restrito = 'saude' and public.pode_ver_saude(cliente_id, lead_id)))
    and ((lead_id is not null and (select public.tem_permissao('leads.ver')))
         or (cliente_id is not null and (select public.tem_permissao('clientes.ver')))
         or (caso_id is not null and (select public.tem_permissao('casos.ver'))))
  );
-- Registro manual de acontecimentos na linha do tempo do caso/cliente/lead.
create policy eventos_inserir on public.eventos for insert to authenticated
  with check (
    tipo = 'manual' and restrito is null and autor_id = (select auth.uid())
    and ((caso_id is not null and (select public.tem_permissao('casos.editar')))
         or (caso_id is null and cliente_id is not null and (select public.tem_permissao('clientes.editar')))
         or (caso_id is null and cliente_id is null and lead_id is not null and (select public.tem_permissao('leads.editar'))))
  );

create policy notificacoes_ler on public.notificacoes for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy notificacoes_alterar on public.notificacoes for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy notificacoes_excluir on public.notificacoes for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy auditoria_ler on public.auditoria for select to authenticated
  using ((select public.tem_permissao('admin.auditoria')));

create policy importacoes_ler on public.importacoes for select to authenticated
  using ((select public.tem_permissao('dados.importar')));

-- limites_uso: sem políticas (acesso apenas pela service role).

-- Auditoria complementar para partes e andamentos
create trigger partes_auditoria after insert or update or delete on public.partes
  for each row execute function public.tg_auditoria();
create trigger andamentos_auditoria after insert or update or delete on public.andamentos
  for each row execute function public.tg_auditoria();

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Tabelas sem escrita direta pelo navegador (defesa em profundidade além da RLS).
revoke insert, update, delete on
  public.permissoes_catalogo, public.perfis, public.usuarios,
  public.quiz_submissoes, public.quiz_respostas, public.consentimentos,
  public.prazos_historico, public.documentos_historico, public.solicitacoes_documentos,
  public.contratos, public.cobrancas, public.pagamentos, public.reembolsos, public.despesas,
  public.auditoria, public.importacoes, public.limites_uso, public.automacoes_execucoes
from authenticated;
revoke update, delete on public.eventos from authenticated;
revoke insert on public.notificacoes from authenticated;

-- Funções: nenhuma é pública por padrão; liberação explícita abaixo.
-- ATENÇÃO (manutenção): novas funções em "public" não ficam executáveis por
-- anon/authenticated; conceda EXECUTE explicitamente quando for uma RPC da interface.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

grant execute on function
  public.f_unaccent(text),
  public.somente_digitos(text),
  public.normalizar_telefone(text),
  public.chave_telefone(text),
  public.normalizar_email(text),
  public.normalizar_documento(text),
  public.hoje_sp(),
  public.usuario_atual(),
  public.tem_permissao(text),
  public.usuario_ativo(),
  public.eh_admin(),
  public.meu_perfil(),
  public.registrar_acesso(),
  public.atualizar_meu_perfil(text, text, text),
  public.eh_responsavel(uuid, uuid, uuid),
  public.pode_ver_saude(uuid, uuid),
  public.pode_ver_saude_registro(text, uuid),
  public.pode_ver_tarefa(uuid),
  public.pode_ver_documento(uuid),
  public.pode_ver_registro(text, uuid),
  public.pode_editar_entidade(text),
  public.pode_ver_campo(uuid, text, uuid),
  public.pode_ver_arquivo(public.arquivos),
  public.nome_usuario(uuid),
  public.rotulo_opcao(text, text),
  public.rotulo_status_documento(text),
  public.formatar_moeda(numeric),
  public.formatar_data_hora(timestamptz),
  public.registrar_exportacao(text, integer, text),
  public.converter_lead(uuid, jsonb),
  public.criar_caso(jsonb),
  public.aplicar_checklist(uuid, uuid, uuid, uuid),
  public.aplicar_modelo_tarefas(uuid, uuid, date),
  public.mesclar_leads(uuid, uuid),
  public.buscar_duplicados(text, text, text, uuid),
  public.busca_global(text),
  public.executar_automacoes_agora(),
  public.relatorio_periodo(jsonb),
  public.exigir_relatorios(),
  public.relatorio_leads(jsonb),
  public.relatorio_casos(jsonb),
  public.relatorio_produtividade(jsonb),
  public.relatorio_prazos(jsonb),
  public.relatorio_documentos(jsonb),
  public.relatorio_financeiro(jsonb)
to authenticated;

grant execute on all functions in schema public to service_role;
