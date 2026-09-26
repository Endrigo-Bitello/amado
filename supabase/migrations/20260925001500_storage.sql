-- =============================================================================
-- CRM Amado & Amado Jr. — 15. Storage privado
--   crm-documentos: documentos, vídeos e anexos (prefixos "interno/" e "portal/")
--   crm-financeiro: comprovantes e contratos (prefixo "financeiro/<cliente>/")
-- Leitura: somente se existir o registro em public.arquivos visível ao usuário
-- (a RLS de arquivos aplica as regras clínicas, financeiras e de tarefas).
-- Envios do portal do cliente e do financeiro usam URLs assinadas geradas
-- pelas Edge Functions.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('crm-documentos', 'crm-documentos', false, 52428800, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text', 'text/plain', 'text/csv'
  ]),
  ('crm-financeiro', 'crm-financeiro', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "crm-documentos: leitura conforme permissões"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'crm-documentos'
    and exists (select 1 from public.arquivos a where a.bucket = 'crm-documentos' and a.caminho = name)
  );

create policy "crm-documentos: envio interno"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'crm-documentos'
    and (storage.foldername(name))[1] = 'interno'
    and public.usuario_ativo()
  );

-- Exclusão definitiva: somente arquivos já removidos (lixeira) e com permissão.
create policy "crm-documentos: exclusão definitiva"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'crm-documentos'
    and public.tem_permissao('documentos.excluir')
    and exists (select 1 from public.arquivos a
                where a.bucket = 'crm-documentos' and a.caminho = name and a.removido_em is not null)
  );

-- Limpeza de envio interrompido (objeto enviado pelo próprio usuário sem registro).
create policy "crm-documentos: limpeza de envio interrompido"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'crm-documentos'
    and (storage.foldername(name))[1] = 'interno'
    and owner_id = (select auth.uid())::text
    and not exists (select 1 from public.arquivos a where a.bucket = 'crm-documentos' and a.caminho = name)
  );

create policy "crm-financeiro: leitura com permissão financeira"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'crm-financeiro'
    and public.tem_permissao('financeiro.ver')
    and exists (select 1 from public.arquivos a where a.bucket = 'crm-financeiro' and a.caminho = name)
  );
