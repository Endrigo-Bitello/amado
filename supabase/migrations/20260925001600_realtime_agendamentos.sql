-- =============================================================================
-- CRM Amado & Amado Jr. — 16. Tempo real e agendamentos
-- =============================================================================

-- Tabelas publicadas no Supabase Realtime (as políticas RLS continuam valendo
-- para cada usuário conectado).
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'leads', 'clientes', 'dados_clinicos', 'casos', 'processos', 'partes', 'andamentos', 'tarefas', 'compromissos',
    'prazos', 'documentos', 'arquivos', 'midias', 'solicitacoes_documentos', 'interacoes', 'comentarios', 'eventos',
    'notificacoes', 'contratos', 'cobrancas', 'pagamentos', 'reembolsos', 'despesas',
    'configuracoes', 'etapas', 'opcoes', 'etiquetas', 'campos_personalizados', 'valores_personalizados',
    'tipos_demanda', 'categorias_documento', 'modelos_checklist', 'modelos_checklist_grupos',
    'modelos_checklist_itens', 'modelos_tarefas', 'automacoes', 'usuarios', 'perfis', 'visualizacoes', 'feriados'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- Execução periódica das automações (a cada 15 minutos) via pg_cron.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível (%). Ative a extensão "pg_cron" no painel do Supabase e reaplique esta migration.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'crm-automacoes';
    perform cron.schedule('crm-automacoes', '*/15 * * * *', 'select public.executar_automacoes()');
  end if;
end
$$;
