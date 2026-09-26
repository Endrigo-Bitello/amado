
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "andamentos": {
                  Row: {
                    "caso_id": string,"created_at": string,"data": string,"descricao": string,"fonte": string,"id": string,"id_externo": string | null,"importante": boolean,"processo_id": string | null,"registrado_por": string | null,"tipo": string
                  }
                  Insert: {
                    "caso_id": string,"created_at"?: string,"data"?: string,"descricao": string,"fonte"?: string,"id"?: string,"id_externo"?: string | null,"importante"?: boolean,"processo_id"?: string | null,"registrado_por"?: string | null,"tipo"?: string
                  }
                  Update: {
                    "caso_id"?: string,"created_at"?: string,"data"?: string,"descricao"?: string,"fonte"?: string,"id"?: string,"id_externo"?: string | null,"importante"?: boolean,"processo_id"?: string | null,"registrado_por"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "andamentos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "andamentos_processo_id_fkey"
      columns: ["processo_id"]
isOneToOne: false
      referencedRelation: "processos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "andamentos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"arquivos": {
                  Row: {
                    "bucket": string,"caminho": string,"caso_id": string | null,"categoria_id": string | null,"cliente_id": string | null,"clinico": boolean,"created_at": string,"descricao": string | null,"documento_id": string | null,"enviado_pelo_cliente": boolean,"enviado_por": string | null,"financeiro": boolean,"id": string,"lead_id": string | null,"mime": string | null,"nome": string,"removido_em": string | null,"removido_por": string | null,"restrito": boolean,"solicitacao_id": string | null,"tamanho": number | null,"tarefa_id": string | null,"tipo": string,"versao": number,"pode_ver_arquivo": boolean | null
                  }
                  Insert: {
                    "bucket": string,"caminho": string,"caso_id"?: string | null,"categoria_id"?: string | null,"cliente_id"?: string | null,"clinico"?: boolean,"created_at"?: string,"descricao"?: string | null,"documento_id"?: string | null,"enviado_pelo_cliente"?: boolean,"enviado_por"?: string | null,"financeiro"?: boolean,"id"?: string,"lead_id"?: string | null,"mime"?: string | null,"nome": string,"removido_em"?: string | null,"removido_por"?: string | null,"restrito"?: boolean,"solicitacao_id"?: string | null,"tamanho"?: number | null,"tarefa_id"?: string | null,"tipo"?: string,"versao"?: number
                  }
                  Update: {
                    "bucket"?: string,"caminho"?: string,"caso_id"?: string | null,"categoria_id"?: string | null,"cliente_id"?: string | null,"clinico"?: boolean,"created_at"?: string,"descricao"?: string | null,"documento_id"?: string | null,"enviado_pelo_cliente"?: boolean,"enviado_por"?: string | null,"financeiro"?: boolean,"id"?: string,"lead_id"?: string | null,"mime"?: string | null,"nome"?: string,"removido_em"?: string | null,"removido_por"?: string | null,"restrito"?: boolean,"solicitacao_id"?: string | null,"tamanho"?: number | null,"tarefa_id"?: string | null,"tipo"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "arquivos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias_documento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_documento_id_fkey"
      columns: ["documento_id"]
isOneToOne: false
      referencedRelation: "documentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_enviado_por_fkey"
      columns: ["enviado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_removido_por_fkey"
      columns: ["removido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_solicitacao_id_fkey"
      columns: ["solicitacao_id"]
isOneToOne: false
      referencedRelation: "solicitacoes_documentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arquivos_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "tarefas"
      referencedColumns: ["id"]
    }
                  ]
                },"auditoria": {
                  Row: {
                    "acao": string,"alteracoes": NonNullable<Json>,"contexto": string | null,"created_at": string,"id": number,"registro_id": string | null,"tabela": string,"usuario_id": string | null
                  }
                  Insert: {
                    "acao": string,"alteracoes"?: NonNullable<Json>,"contexto"?: string | null,"created_at"?: string,"id"?: never,"registro_id"?: string | null,"tabela": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"alteracoes"?: NonNullable<Json>,"contexto"?: string | null,"created_at"?: string,"id"?: never,"registro_id"?: string | null,"tabela"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "auditoria_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"automacoes": {
                  Row: {
                    "ativo": boolean,"created_at": string,"created_by": string | null,"descricao": string | null,"id": string,"nome": string,"parametros": NonNullable<Json>,"tipo": string,"ultima_execucao_em": string | null,"updated_at": string,"auto_documento_pendente": number | null,"auto_documento_validade": number | null,"auto_lead_parado": number | null,"auto_parcela_vencida": number | null,"auto_prazo_processual": number | null,"auto_tarefa_prazo": number | null
                  }
                  Insert: {
                    "ativo"?: boolean,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"nome": string,"parametros"?: NonNullable<Json>,"tipo": string,"ultima_execucao_em"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"nome"?: string,"parametros"?: NonNullable<Json>,"tipo"?: string,"ultima_execucao_em"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "automacoes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"automacoes_execucoes": {
                  Row: {
                    "automacao_id": string | null,"erro": string | null,"id": number,"iniciado_em": string,"itens_afetados": number
                  }
                  Insert: {
                    "automacao_id"?: string | null,"erro"?: string | null,"id"?: never,"iniciado_em"?: string,"itens_afetados"?: number
                  }
                  Update: {
                    "automacao_id"?: string | null,"erro"?: string | null,"id"?: never,"iniciado_em"?: string,"itens_afetados"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "automacoes_execucoes_automacao_id_fkey"
      columns: ["automacao_id"]
isOneToOne: false
      referencedRelation: "automacoes"
      referencedColumns: ["id"]
    }
                  ]
                },"campos_personalizados": {
                  Row: {
                    "ajuda": string | null,"ativo": boolean,"created_at": string,"created_by": string | null,"entidade": string,"id": string,"mostrar_no_quadro": boolean,"obrigatorio": boolean,"opcoes": NonNullable<Json>,"ordem": number,"rotulo": string,"secao": string,"tipo": string,"updated_at": string,"visibilidade": string
                  }
                  Insert: {
                    "ajuda"?: string | null,"ativo"?: boolean,"created_at"?: string,"created_by"?: string | null,"entidade": string,"id"?: string,"mostrar_no_quadro"?: boolean,"obrigatorio"?: boolean,"opcoes"?: NonNullable<Json>,"ordem"?: number,"rotulo": string,"secao"?: string,"tipo": string,"updated_at"?: string,"visibilidade"?: string
                  }
                  Update: {
                    "ajuda"?: string | null,"ativo"?: boolean,"created_at"?: string,"created_by"?: string | null,"entidade"?: string,"id"?: string,"mostrar_no_quadro"?: boolean,"obrigatorio"?: boolean,"opcoes"?: NonNullable<Json>,"ordem"?: number,"rotulo"?: string,"secao"?: string,"tipo"?: string,"updated_at"?: string,"visibilidade"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campos_personalizados_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"casos": {
                  Row: {
                    "arquivado_em": string | null,"arquivado_por": string | null,"cliente_id": string,"codigo": string | null,"created_at": string,"created_by": string | null,"data_abertura": string,"data_encerramento": string | null,"data_protocolo": string | null,"equipe": (string)[],"etiquetas": (string)[],"fase_alterada_em": string,"fase_id": string | null,"id": string,"lead_id": string | null,"links": NonNullable<Json>,"natureza": string,"objeto": string | null,"observacoes": string | null,"prioridade": string,"responsavel_id": string | null,"resultado": string | null,"segredo_justica": boolean,"status": string,"tipo_demanda_id": string | null,"titulo": string,"updated_at": string,"valor_causa": number | null,"versao": number
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"cliente_id": string,"codigo"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_abertura"?: string,"data_encerramento"?: string | null,"data_protocolo"?: string | null,"equipe"?: (string)[],"etiquetas"?: (string)[],"fase_alterada_em"?: string,"fase_id"?: string | null,"id"?: string,"lead_id"?: string | null,"links"?: NonNullable<Json>,"natureza"?: string,"objeto"?: string | null,"observacoes"?: string | null,"prioridade"?: string,"responsavel_id"?: string | null,"resultado"?: string | null,"segredo_justica"?: boolean,"status"?: string,"tipo_demanda_id"?: string | null,"titulo": string,"updated_at"?: string,"valor_causa"?: number | null,"versao"?: number
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"cliente_id"?: string,"codigo"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_abertura"?: string,"data_encerramento"?: string | null,"data_protocolo"?: string | null,"equipe"?: (string)[],"etiquetas"?: (string)[],"fase_alterada_em"?: string,"fase_id"?: string | null,"id"?: string,"lead_id"?: string | null,"links"?: NonNullable<Json>,"natureza"?: string,"objeto"?: string | null,"observacoes"?: string | null,"prioridade"?: string,"responsavel_id"?: string | null,"resultado"?: string | null,"segredo_justica"?: boolean,"status"?: string,"tipo_demanda_id"?: string | null,"titulo"?: string,"updated_at"?: string,"valor_causa"?: number | null,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "casos_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_fase_id_fkey"
      columns: ["fase_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_tipo_demanda_id_fkey"
      columns: ["tipo_demanda_id"]
isOneToOne: false
      referencedRelation: "tipos_demanda"
      referencedColumns: ["id"]
    }
                  ]
                },"categorias_documento": {
                  Row: {
                    "ativo": boolean,"clinico": boolean,"cor": string,"created_at": string,"descricao": string | null,"financeiro": boolean,"id": string,"nome": string,"ordem": number,"updated_at": string
                  }
                  Insert: {
                    "ativo"?: boolean,"clinico"?: boolean,"cor"?: string,"created_at"?: string,"descricao"?: string | null,"financeiro"?: boolean,"id"?: string,"nome": string,"ordem"?: number,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"clinico"?: boolean,"cor"?: string,"created_at"?: string,"descricao"?: string | null,"financeiro"?: boolean,"id"?: string,"nome"?: string,"ordem"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clientes": {
                  Row: {
                    "arquivado_em": string | null,"arquivado_por": string | null,"bairro": string | null,"cep": string | null,"cidade": string | null,"codigo": string | null,"complemento": string | null,"cpf_cnpj": string | null,"cpf_cnpj_norm": string | null,"created_at": string,"created_by": string | null,"data_nascimento": string | null,"email": string | null,"email_norm": string | null,"estado_civil": string | null,"etiquetas": (string)[],"id": string,"lead_origem_id": string | null,"logradouro": string | null,"nacionalidade": string | null,"nome": string,"nome_social": string | null,"numero": string | null,"observacoes": string | null,"origem": string,"possui_representante": boolean,"profissao": string | null,"representante_contato": string | null,"representante_cpf": string | null,"representante_nome": string | null,"representante_parentesco": string | null,"responsavel_id": string | null,"rg": string | null,"status": string,"telefone_chave": string | null,"telefone_norm": string | null,"telefone_secundario": string | null,"tipo_pessoa": string,"uf": string | null,"updated_at": string,"versao": number,"whatsapp": string | null
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"bairro"?: string | null,"cep"?: string | null,"cidade"?: string | null,"codigo"?: string | null,"complemento"?: string | null,"cpf_cnpj"?: string | null,"cpf_cnpj_norm"?: never,"created_at"?: string,"created_by"?: string | null,"data_nascimento"?: string | null,"email"?: string | null,"email_norm"?: never,"estado_civil"?: string | null,"etiquetas"?: (string)[],"id"?: string,"lead_origem_id"?: string | null,"logradouro"?: string | null,"nacionalidade"?: string | null,"nome": string,"nome_social"?: string | null,"numero"?: string | null,"observacoes"?: string | null,"origem"?: string,"possui_representante"?: boolean,"profissao"?: string | null,"representante_contato"?: string | null,"representante_cpf"?: string | null,"representante_nome"?: string | null,"representante_parentesco"?: string | null,"responsavel_id"?: string | null,"rg"?: string | null,"status"?: string,"telefone_chave"?: never,"telefone_norm"?: never,"telefone_secundario"?: string | null,"tipo_pessoa"?: string,"uf"?: string | null,"updated_at"?: string,"versao"?: number,"whatsapp"?: string | null
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"bairro"?: string | null,"cep"?: string | null,"cidade"?: string | null,"codigo"?: string | null,"complemento"?: string | null,"cpf_cnpj"?: string | null,"cpf_cnpj_norm"?: never,"created_at"?: string,"created_by"?: string | null,"data_nascimento"?: string | null,"email"?: string | null,"email_norm"?: never,"estado_civil"?: string | null,"etiquetas"?: (string)[],"id"?: string,"lead_origem_id"?: string | null,"logradouro"?: string | null,"nacionalidade"?: string | null,"nome"?: string,"nome_social"?: string | null,"numero"?: string | null,"observacoes"?: string | null,"origem"?: string,"possui_representante"?: boolean,"profissao"?: string | null,"representante_contato"?: string | null,"representante_cpf"?: string | null,"representante_nome"?: string | null,"representante_parentesco"?: string | null,"responsavel_id"?: string | null,"rg"?: string | null,"status"?: string,"telefone_chave"?: never,"telefone_norm"?: never,"telefone_secundario"?: string | null,"tipo_pessoa"?: string,"uf"?: string | null,"updated_at"?: string,"versao"?: number,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clientes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clientes_lead_origem_id_fkey"
      columns: ["lead_origem_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clientes_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"cobrancas": {
                  Row: {
                    "acrescimo": number,"cancelada_em": string | null,"cancelada_por": string | null,"caso_id": string | null,"categoria": string,"cliente_id": string,"contrato_id": string | null,"created_at": string,"created_by": string | null,"desconto": number,"descricao": string,"id": string,"id_externo": string | null,"motivo_cancelamento": string | null,"observacoes": string | null,"parcela_numero": number | null,"parcela_total": number | null,"updated_at": string,"valor": number,"vencimento": string
                  }
                  Insert: {
                    "acrescimo"?: number,"cancelada_em"?: string | null,"cancelada_por"?: string | null,"caso_id"?: string | null,"categoria"?: string,"cliente_id": string,"contrato_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"desconto"?: number,"descricao": string,"id"?: string,"id_externo"?: string | null,"motivo_cancelamento"?: string | null,"observacoes"?: string | null,"parcela_numero"?: number | null,"parcela_total"?: number | null,"updated_at"?: string,"valor": number,"vencimento": string
                  }
                  Update: {
                    "acrescimo"?: number,"cancelada_em"?: string | null,"cancelada_por"?: string | null,"caso_id"?: string | null,"categoria"?: string,"cliente_id"?: string,"contrato_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"desconto"?: number,"descricao"?: string,"id"?: string,"id_externo"?: string | null,"motivo_cancelamento"?: string | null,"observacoes"?: string | null,"parcela_numero"?: number | null,"parcela_total"?: number | null,"updated_at"?: string,"valor"?: number,"vencimento"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cobrancas_cancelada_por_fkey"
      columns: ["cancelada_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_contrato_id_fkey"
      columns: ["contrato_id"]
isOneToOne: false
      referencedRelation: "contratos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"comentarios": {
                  Row: {
                    "autor_id": string | null,"created_at": string,"editado_em": string | null,"entidade": string,"id": string,"mencoes": (string)[],"registro_id": string,"removido_em": string | null,"texto": string
                  }
                  Insert: {
                    "autor_id"?: string | null,"created_at"?: string,"editado_em"?: string | null,"entidade": string,"id"?: string,"mencoes"?: (string)[],"registro_id": string,"removido_em"?: string | null,"texto": string
                  }
                  Update: {
                    "autor_id"?: string | null,"created_at"?: string,"editado_em"?: string | null,"entidade"?: string,"id"?: string,"mencoes"?: (string)[],"registro_id"?: string,"removido_em"?: string | null,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comentarios_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"compromissos": {
                  Row: {
                    "caso_id": string | null,"cliente_id": string | null,"created_at": string,"created_by": string | null,"descricao": string | null,"dia_inteiro": boolean,"fim": string | null,"id": string,"inicio": string,"lead_id": string | null,"lembrete_minutos": number | null,"link_reuniao": string | null,"local": string | null,"participantes": (string)[],"processo_id": string | null,"responsavel_id": string | null,"status": string,"tipo": string,"titulo": string,"updated_at": string
                  }
                  Insert: {
                    "caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"dia_inteiro"?: boolean,"fim"?: string | null,"id"?: string,"inicio": string,"lead_id"?: string | null,"lembrete_minutos"?: number | null,"link_reuniao"?: string | null,"local"?: string | null,"participantes"?: (string)[],"processo_id"?: string | null,"responsavel_id"?: string | null,"status"?: string,"tipo"?: string,"titulo": string,"updated_at"?: string
                  }
                  Update: {
                    "caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"dia_inteiro"?: boolean,"fim"?: string | null,"id"?: string,"inicio"?: string,"lead_id"?: string | null,"lembrete_minutos"?: number | null,"link_reuniao"?: string | null,"local"?: string | null,"participantes"?: (string)[],"processo_id"?: string | null,"responsavel_id"?: string | null,"status"?: string,"tipo"?: string,"titulo"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compromissos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compromissos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compromissos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compromissos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compromissos_processo_id_fkey"
      columns: ["processo_id"]
isOneToOne: false
      referencedRelation: "processos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compromissos_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracoes": {
                  Row: {
                    "chave": string,"descricao": string | null,"updated_at": string,"updated_by": string | null,"valor": NonNullable<Json>
                  }
                  Insert: {
                    "chave": string,"descricao"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"valor": NonNullable<Json>
                  }
                  Update: {
                    "chave"?: string,"descricao"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"valor"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracoes_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"consentimentos": {
                  Row: {
                    "cliente_id": string | null,"concedido": boolean,"id": string,"ip_hash": string | null,"lead_id": string | null,"origem": string,"pagina": string | null,"registrado_em": string,"submissao_id": string | null,"texto": string,"tipo": string,"user_agent": string | null,"versao": string | null
                  }
                  Insert: {
                    "cliente_id"?: string | null,"concedido": boolean,"id"?: string,"ip_hash"?: string | null,"lead_id"?: string | null,"origem"?: string,"pagina"?: string | null,"registrado_em"?: string,"submissao_id"?: string | null,"texto": string,"tipo"?: string,"user_agent"?: string | null,"versao"?: string | null
                  }
                  Update: {
                    "cliente_id"?: string | null,"concedido"?: boolean,"id"?: string,"ip_hash"?: string | null,"lead_id"?: string | null,"origem"?: string,"pagina"?: string | null,"registrado_em"?: string,"submissao_id"?: string | null,"texto"?: string,"tipo"?: string,"user_agent"?: string | null,"versao"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consentimentos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consentimentos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consentimentos_submissao_id_fkey"
      columns: ["submissao_id"]
isOneToOne: false
      referencedRelation: "quiz_submissoes"
      referencedColumns: ["id"]
    }
                  ]
                },"contratos": {
                  Row: {
                    "acrescimo": number,"arquivo_id": string | null,"caso_id": string | null,"cliente_id": string,"created_at": string,"created_by": string | null,"data_assinatura": string | null,"data_entrada": string | null,"desconto": number,"descricao": string,"forma_contratacao": string,"id": string,"numero_parcelas": number,"observacoes": string | null,"percentual_exito": number | null,"primeiro_vencimento": string | null,"status": string,"updated_at": string,"valor_entrada": number,"valor_total": number,"versao": number
                  }
                  Insert: {
                    "acrescimo"?: number,"arquivo_id"?: string | null,"caso_id"?: string | null,"cliente_id": string,"created_at"?: string,"created_by"?: string | null,"data_assinatura"?: string | null,"data_entrada"?: string | null,"desconto"?: number,"descricao"?: string,"forma_contratacao"?: string,"id"?: string,"numero_parcelas"?: number,"observacoes"?: string | null,"percentual_exito"?: number | null,"primeiro_vencimento"?: string | null,"status"?: string,"updated_at"?: string,"valor_entrada"?: number,"valor_total": number,"versao"?: number
                  }
                  Update: {
                    "acrescimo"?: number,"arquivo_id"?: string | null,"caso_id"?: string | null,"cliente_id"?: string,"created_at"?: string,"created_by"?: string | null,"data_assinatura"?: string | null,"data_entrada"?: string | null,"desconto"?: number,"descricao"?: string,"forma_contratacao"?: string,"id"?: string,"numero_parcelas"?: number,"observacoes"?: string | null,"percentual_exito"?: number | null,"primeiro_vencimento"?: string | null,"status"?: string,"updated_at"?: string,"valor_entrada"?: number,"valor_total"?: number,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contratos_arquivo_id_fkey"
      columns: ["arquivo_id"]
isOneToOne: false
      referencedRelation: "arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contratos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contratos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contratos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"dados_clinicos": {
                  Row: {
                    "cid": string | null,"cliente_id": string,"created_at": string,"diagnostico": string | null,"medico_especialidade": string | null,"medico_nome": string | null,"medico_registro": string | null,"observacoes": string | null,"posologia": string | null,"produto_prescrito": string | null,"tratamento_atual": string | null,"tratamentos_anteriores": string | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "cid"?: string | null,"cliente_id": string,"created_at"?: string,"diagnostico"?: string | null,"medico_especialidade"?: string | null,"medico_nome"?: string | null,"medico_registro"?: string | null,"observacoes"?: string | null,"posologia"?: string | null,"produto_prescrito"?: string | null,"tratamento_atual"?: string | null,"tratamentos_anteriores"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cid"?: string | null,"cliente_id"?: string,"created_at"?: string,"diagnostico"?: string | null,"medico_especialidade"?: string | null,"medico_nome"?: string | null,"medico_registro"?: string | null,"observacoes"?: string | null,"posologia"?: string | null,"produto_prescrito"?: string | null,"tratamento_atual"?: string | null,"tratamentos_anteriores"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dados_clinicos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: true
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dados_clinicos_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"despesas": {
                  Row: {
                    "cancelada_em": string | null,"cancelada_por": string | null,"caso_id": string | null,"categoria": string,"cliente_id": string,"cobranca_reembolso_id": string | null,"comprovante_arquivo_id": string | null,"data": string,"descricao": string,"id": string,"motivo_cancelamento": string | null,"observacao": string | null,"pago_por": string,"reembolsavel": boolean,"registrado_em": string,"registrado_por": string,"valor": number
                  }
                  Insert: {
                    "cancelada_em"?: string | null,"cancelada_por"?: string | null,"caso_id"?: string | null,"categoria": string,"cliente_id": string,"cobranca_reembolso_id"?: string | null,"comprovante_arquivo_id"?: string | null,"data": string,"descricao": string,"id"?: string,"motivo_cancelamento"?: string | null,"observacao"?: string | null,"pago_por": string,"reembolsavel"?: boolean,"registrado_em"?: string,"registrado_por": string,"valor": number
                  }
                  Update: {
                    "cancelada_em"?: string | null,"cancelada_por"?: string | null,"caso_id"?: string | null,"categoria"?: string,"cliente_id"?: string,"cobranca_reembolso_id"?: string | null,"comprovante_arquivo_id"?: string | null,"data"?: string,"descricao"?: string,"id"?: string,"motivo_cancelamento"?: string | null,"observacao"?: string | null,"pago_por"?: string,"reembolsavel"?: boolean,"registrado_em"?: string,"registrado_por"?: string,"valor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "despesas_cancelada_por_fkey"
      columns: ["cancelada_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "despesas_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "despesas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "despesas_cobranca_reembolso_id_fkey"
      columns: ["cobranca_reembolso_id"]
isOneToOne: false
      referencedRelation: "cobrancas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "despesas_cobranca_reembolso_id_fkey"
      columns: ["cobranca_reembolso_id"]
isOneToOne: false
      referencedRelation: "v_cobrancas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "despesas_comprovante_arquivo_id_fkey"
      columns: ["comprovante_arquivo_id"]
isOneToOne: false
      referencedRelation: "arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "despesas_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"documentos": {
                  Row: {
                    "aprovado_em": string | null,"aprovado_por": string | null,"caso_id": string | null,"categoria_id": string | null,"cliente_id": string | null,"cliente_pode_enviar": boolean,"clinico": boolean,"condicao_descricao": string | null,"created_at": string,"created_by": string | null,"descricao_cliente": string | null,"dispensado_motivo": string | null,"enviado_pelo_cliente": boolean,"etapa": string | null,"financeiro": boolean,"grupo": string | null,"id": string,"instrucao_equipe": string | null,"lead_id": string | null,"modelo_id": string | null,"modelo_item_id": string | null,"nome": string,"obrigatorio": boolean,"observacoes": string | null,"ordem": number,"prazo": string | null,"recebido_em": string | null,"recebido_por": string | null,"rejeitado_motivo": string | null,"revisado_em": string | null,"revisado_por": string | null,"revisor_id": string | null,"solicitado_em": string | null,"solicitado_por": string | null,"status": string,"updated_at": string,"validade_dias": number | null,"valido_ate": string | null
                  }
                  Insert: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"caso_id"?: string | null,"categoria_id"?: string | null,"cliente_id"?: string | null,"cliente_pode_enviar"?: boolean,"clinico"?: boolean,"condicao_descricao"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao_cliente"?: string | null,"dispensado_motivo"?: string | null,"enviado_pelo_cliente"?: boolean,"etapa"?: string | null,"financeiro"?: boolean,"grupo"?: string | null,"id"?: string,"instrucao_equipe"?: string | null,"lead_id"?: string | null,"modelo_id"?: string | null,"modelo_item_id"?: string | null,"nome": string,"obrigatorio"?: boolean,"observacoes"?: string | null,"ordem"?: number,"prazo"?: string | null,"recebido_em"?: string | null,"recebido_por"?: string | null,"rejeitado_motivo"?: string | null,"revisado_em"?: string | null,"revisado_por"?: string | null,"revisor_id"?: string | null,"solicitado_em"?: string | null,"solicitado_por"?: string | null,"status"?: string,"updated_at"?: string,"validade_dias"?: number | null,"valido_ate"?: string | null
                  }
                  Update: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"caso_id"?: string | null,"categoria_id"?: string | null,"cliente_id"?: string | null,"cliente_pode_enviar"?: boolean,"clinico"?: boolean,"condicao_descricao"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao_cliente"?: string | null,"dispensado_motivo"?: string | null,"enviado_pelo_cliente"?: boolean,"etapa"?: string | null,"financeiro"?: boolean,"grupo"?: string | null,"id"?: string,"instrucao_equipe"?: string | null,"lead_id"?: string | null,"modelo_id"?: string | null,"modelo_item_id"?: string | null,"nome"?: string,"obrigatorio"?: boolean,"observacoes"?: string | null,"ordem"?: number,"prazo"?: string | null,"recebido_em"?: string | null,"recebido_por"?: string | null,"rejeitado_motivo"?: string | null,"revisado_em"?: string | null,"revisado_por"?: string | null,"revisor_id"?: string | null,"solicitado_em"?: string | null,"solicitado_por"?: string | null,"status"?: string,"updated_at"?: string,"validade_dias"?: number | null,"valido_ate"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documentos_aprovado_por_fkey"
      columns: ["aprovado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias_documento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_modelo_id_fkey"
      columns: ["modelo_id"]
isOneToOne: false
      referencedRelation: "modelos_checklist"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_modelo_item_id_fkey"
      columns: ["modelo_item_id"]
isOneToOne: false
      referencedRelation: "modelos_checklist_itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_recebido_por_fkey"
      columns: ["recebido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_revisado_por_fkey"
      columns: ["revisado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_revisor_id_fkey"
      columns: ["revisor_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_solicitado_por_fkey"
      columns: ["solicitado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"documentos_historico": {
                  Row: {
                    "comentario": string | null,"created_at": string,"de": string | null,"documento_id": string,"id": number,"para": string,"usuario_id": string | null,"via": string
                  }
                  Insert: {
                    "comentario"?: string | null,"created_at"?: string,"de"?: string | null,"documento_id": string,"id"?: never,"para": string,"usuario_id"?: string | null,"via"?: string
                  }
                  Update: {
                    "comentario"?: string | null,"created_at"?: string,"de"?: string | null,"documento_id"?: string,"id"?: never,"para"?: string,"usuario_id"?: string | null,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documentos_historico_documento_id_fkey"
      columns: ["documento_id"]
isOneToOne: false
      referencedRelation: "documentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_historico_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"etapas": {
                  Row: {
                    "ativo": boolean,"categoria": string,"chave": string | null,"cor": string,"created_at": string,"descricao": string | null,"funil": string,"id": string,"nome": string,"ordem": number,"updated_at": string
                  }
                  Insert: {
                    "ativo"?: boolean,"categoria"?: string,"chave"?: string | null,"cor"?: string,"created_at"?: string,"descricao"?: string | null,"funil": string,"id"?: string,"nome": string,"ordem"?: number,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"categoria"?: string,"chave"?: string | null,"cor"?: string,"created_at"?: string,"descricao"?: string | null,"funil"?: string,"id"?: string,"nome"?: string,"ordem"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"etiquetas": {
                  Row: {
                    "ativo": boolean,"cor": string,"created_at": string,"escopos": (string)[],"id": string,"nome": string,"updated_at": string
                  }
                  Insert: {
                    "ativo"?: boolean,"cor"?: string,"created_at"?: string,"escopos"?: (string)[],"id"?: string,"nome": string,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"cor"?: string,"created_at"?: string,"escopos"?: (string)[],"id"?: string,"nome"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"eventos": {
                  Row: {
                    "automatico": boolean,"autor_id": string | null,"caso_id": string | null,"cliente_id": string | null,"detalhes": NonNullable<Json>,"entidade": string | null,"id": number,"lead_id": string | null,"ocorrido_em": string,"registro_id": string | null,"restrito": string | null,"tipo": string,"titulo": string
                  }
                  Insert: {
                    "automatico"?: boolean,"autor_id"?: string | null,"caso_id"?: string | null,"cliente_id"?: string | null,"detalhes"?: NonNullable<Json>,"entidade"?: string | null,"id"?: never,"lead_id"?: string | null,"ocorrido_em"?: string,"registro_id"?: string | null,"restrito"?: string | null,"tipo": string,"titulo": string
                  }
                  Update: {
                    "automatico"?: boolean,"autor_id"?: string | null,"caso_id"?: string | null,"cliente_id"?: string | null,"detalhes"?: NonNullable<Json>,"entidade"?: string | null,"id"?: never,"lead_id"?: string | null,"ocorrido_em"?: string,"registro_id"?: string | null,"restrito"?: string | null,"tipo"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"feriados": {
                  Row: {
                    "abrangencia": string,"created_at": string,"created_by": string | null,"data": string,"descricao": string,"id": string,"municipio": string | null,"tribunal": string | null,"uf": string | null
                  }
                  Insert: {
                    "abrangencia"?: string,"created_at"?: string,"created_by"?: string | null,"data": string,"descricao": string,"id"?: string,"municipio"?: string | null,"tribunal"?: string | null,"uf"?: string | null
                  }
                  Update: {
                    "abrangencia"?: string,"created_at"?: string,"created_by"?: string | null,"data"?: string,"descricao"?: string,"id"?: string,"municipio"?: string | null,"tribunal"?: string | null,"uf"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feriados_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"importacoes": {
                  Row: {
                    "arquivo_nome": string | null,"atualizados": number,"created_at": string,"criados": number,"erros": number,"id": string,"ignorados": number,"mapeamento": NonNullable<Json>,"relatorio": NonNullable<Json>,"status": string,"tipo": string,"total_linhas": number,"usuario_id": string | null
                  }
                  Insert: {
                    "arquivo_nome"?: string | null,"atualizados"?: number,"created_at"?: string,"criados"?: number,"erros"?: number,"id"?: string,"ignorados"?: number,"mapeamento"?: NonNullable<Json>,"relatorio"?: NonNullable<Json>,"status"?: string,"tipo"?: string,"total_linhas"?: number,"usuario_id"?: string | null
                  }
                  Update: {
                    "arquivo_nome"?: string | null,"atualizados"?: number,"created_at"?: string,"criados"?: number,"erros"?: number,"id"?: string,"ignorados"?: number,"mapeamento"?: NonNullable<Json>,"relatorio"?: NonNullable<Json>,"status"?: string,"tipo"?: string,"total_linhas"?: number,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "importacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"interacoes": {
                  Row: {
                    "caso_id": string | null,"cliente_id": string | null,"created_at": string,"direcao": string | null,"id": string,"lead_id": string | null,"ocorrida_em": string,"resultado": string | null,"resumo": string,"tipo": string,"usuario_id": string | null
                  }
                  Insert: {
                    "caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"direcao"?: string | null,"id"?: string,"lead_id"?: string | null,"ocorrida_em"?: string,"resultado"?: string | null,"resumo": string,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"direcao"?: string | null,"id"?: string,"lead_id"?: string | null,"ocorrida_em"?: string,"resultado"?: string | null,"resumo"?: string,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "interacoes_caso_fk"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interacoes_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interacoes_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "arquivado_em": string | null,"arquivado_por": string | null,"cliente_id": string | null,"codigo": string | null,"convertido_em": string | null,"convertido_por": string | null,"cpf": string | null,"cpf_norm": string | null,"created_at": string,"created_by": string | null,"email": string | null,"email_norm": string | null,"estado": string | null,"etapa_alterada_em": string,"etapa_id": string,"etiquetas": (string)[],"faixa_renda": string | null,"id": string,"mesclado_em_id": string | null,"motivo_perda": string | null,"motivo_perda_detalhe": string | null,"municipio": string | null,"nome": string,"observacoes": string | null,"origem": string,"primeiro_contato_em": string | null,"prioridade": string,"profissao": string | null,"proxima_acao": string | null,"proxima_acao_em": string | null,"quiz_agenda": string | null,"quiz_consulta_medica": string | null,"quiz_cultiva": string | null,"quiz_horario": string | null,"quiz_interesse": string | null,"quiz_motivacao": string | null,"quiz_observacoes": string | null,"responsavel_id": string | null,"score": number | null,"telefone_chave": string | null,"telefone_norm": string | null,"temperatura": string | null,"tipo_demanda_id": string | null,"total_submissoes": number,"ultima_atividade_em": string,"ultima_submissao_id": string | null,"ultimo_contato_em": string | null,"updated_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"versao": number,"whatsapp": string | null
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"cliente_id"?: string | null,"codigo"?: string | null,"convertido_em"?: string | null,"convertido_por"?: string | null,"cpf"?: string | null,"cpf_norm"?: never,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"email_norm"?: never,"estado"?: string | null,"etapa_alterada_em"?: string,"etapa_id": string,"etiquetas"?: (string)[],"faixa_renda"?: string | null,"id"?: string,"mesclado_em_id"?: string | null,"motivo_perda"?: string | null,"motivo_perda_detalhe"?: string | null,"municipio"?: string | null,"nome": string,"observacoes"?: string | null,"origem"?: string,"primeiro_contato_em"?: string | null,"prioridade"?: string,"profissao"?: string | null,"proxima_acao"?: string | null,"proxima_acao_em"?: string | null,"quiz_agenda"?: string | null,"quiz_consulta_medica"?: string | null,"quiz_cultiva"?: string | null,"quiz_horario"?: string | null,"quiz_interesse"?: string | null,"quiz_motivacao"?: string | null,"quiz_observacoes"?: string | null,"responsavel_id"?: string | null,"score"?: number | null,"telefone_chave"?: never,"telefone_norm"?: never,"temperatura"?: string | null,"tipo_demanda_id"?: string | null,"total_submissoes"?: number,"ultima_atividade_em"?: string,"ultima_submissao_id"?: string | null,"ultimo_contato_em"?: string | null,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"versao"?: number,"whatsapp"?: string | null
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"cliente_id"?: string | null,"codigo"?: string | null,"convertido_em"?: string | null,"convertido_por"?: string | null,"cpf"?: string | null,"cpf_norm"?: never,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"email_norm"?: never,"estado"?: string | null,"etapa_alterada_em"?: string,"etapa_id"?: string,"etiquetas"?: (string)[],"faixa_renda"?: string | null,"id"?: string,"mesclado_em_id"?: string | null,"motivo_perda"?: string | null,"motivo_perda_detalhe"?: string | null,"municipio"?: string | null,"nome"?: string,"observacoes"?: string | null,"origem"?: string,"primeiro_contato_em"?: string | null,"prioridade"?: string,"profissao"?: string | null,"proxima_acao"?: string | null,"proxima_acao_em"?: string | null,"quiz_agenda"?: string | null,"quiz_consulta_medica"?: string | null,"quiz_cultiva"?: string | null,"quiz_horario"?: string | null,"quiz_interesse"?: string | null,"quiz_motivacao"?: string | null,"quiz_observacoes"?: string | null,"responsavel_id"?: string | null,"score"?: number | null,"telefone_chave"?: never,"telefone_norm"?: never,"temperatura"?: string | null,"tipo_demanda_id"?: string | null,"total_submissoes"?: number,"ultima_atividade_em"?: string,"ultima_submissao_id"?: string | null,"ultimo_contato_em"?: string | null,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"versao"?: number,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_cliente_fk"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_convertido_por_fkey"
      columns: ["convertido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_mesclado_em_id_fkey"
      columns: ["mesclado_em_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_tipo_demanda_id_fkey"
      columns: ["tipo_demanda_id"]
isOneToOne: false
      referencedRelation: "tipos_demanda"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_ultima_submissao_fk"
      columns: ["ultima_submissao_id"]
isOneToOne: false
      referencedRelation: "quiz_submissoes"
      referencedColumns: ["id"]
    }
                  ]
                },"limites_uso": {
                  Row: {
                    "chave": string,"contagem": number,"janela_inicio": string
                  }
                  Insert: {
                    "chave": string,"contagem"?: number,"janela_inicio": string
                  }
                  Update: {
                    "chave"?: string,"contagem"?: number,"janela_inicio"?: string
                  }
                  Relationships: [
                    
                  ]
                },"midias": {
                  Row: {
                    "arquivo_id": string | null,"caso_id": string | null,"cliente_id": string | null,"created_at": string,"created_by": string | null,"descricao": string | null,"id": string,"tipo": string,"titulo": string,"updated_at": string,"url": string | null,"visibilidade": string
                  }
                  Insert: {
                    "arquivo_id"?: string | null,"caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"tipo": string,"titulo": string,"updated_at"?: string,"url"?: string | null,"visibilidade"?: string
                  }
                  Update: {
                    "arquivo_id"?: string | null,"caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"tipo"?: string,"titulo"?: string,"updated_at"?: string,"url"?: string | null,"visibilidade"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "midias_arquivo_id_fkey"
      columns: ["arquivo_id"]
isOneToOne: false
      referencedRelation: "arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "midias_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "midias_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "midias_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"modelos_checklist": {
                  Row: {
                    "ativo": boolean,"aviso": string | null,"created_at": string,"created_by": string | null,"descricao": string | null,"id": string,"nome": string,"tipo_demanda_id": string | null,"updated_at": string,"versao": number
                  }
                  Insert: {
                    "ativo"?: boolean,"aviso"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"nome": string,"tipo_demanda_id"?: string | null,"updated_at"?: string,"versao"?: number
                  }
                  Update: {
                    "ativo"?: boolean,"aviso"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"nome"?: string,"tipo_demanda_id"?: string | null,"updated_at"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "modelos_checklist_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelos_checklist_tipo_demanda_id_fkey"
      columns: ["tipo_demanda_id"]
isOneToOne: false
      referencedRelation: "tipos_demanda"
      referencedColumns: ["id"]
    }
                  ]
                },"modelos_checklist_grupos": {
                  Row: {
                    "created_at": string,"descricao": string | null,"id": string,"modelo_id": string,"nome": string,"ordem": number
                  }
                  Insert: {
                    "created_at"?: string,"descricao"?: string | null,"id"?: string,"modelo_id": string,"nome": string,"ordem"?: number
                  }
                  Update: {
                    "created_at"?: string,"descricao"?: string | null,"id"?: string,"modelo_id"?: string,"nome"?: string,"ordem"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "modelos_checklist_grupos_modelo_id_fkey"
      columns: ["modelo_id"]
isOneToOne: false
      referencedRelation: "modelos_checklist"
      referencedColumns: ["id"]
    }
                  ]
                },"modelos_checklist_itens": {
                  Row: {
                    "ativo": boolean,"categoria_id": string | null,"cliente_pode_enviar": boolean,"condicao": Json | null,"condicao_descricao": string | null,"created_at": string,"descricao_cliente": string | null,"etapa": string | null,"grupo_id": string | null,"id": string,"instrucao_equipe": string | null,"modelo_id": string,"nome": string,"obrigatoriedade": string,"ordem": number,"prazo_dias": number | null,"revisor_perfil_id": string | null,"revisor_tipo": string,"revisor_usuario_id": string | null,"updated_at": string,"validade_dias": number | null
                  }
                  Insert: {
                    "ativo"?: boolean,"categoria_id"?: string | null,"cliente_pode_enviar"?: boolean,"condicao"?: Json | null,"condicao_descricao"?: string | null,"created_at"?: string,"descricao_cliente"?: string | null,"etapa"?: string | null,"grupo_id"?: string | null,"id"?: string,"instrucao_equipe"?: string | null,"modelo_id": string,"nome": string,"obrigatoriedade"?: string,"ordem"?: number,"prazo_dias"?: number | null,"revisor_perfil_id"?: string | null,"revisor_tipo"?: string,"revisor_usuario_id"?: string | null,"updated_at"?: string,"validade_dias"?: number | null
                  }
                  Update: {
                    "ativo"?: boolean,"categoria_id"?: string | null,"cliente_pode_enviar"?: boolean,"condicao"?: Json | null,"condicao_descricao"?: string | null,"created_at"?: string,"descricao_cliente"?: string | null,"etapa"?: string | null,"grupo_id"?: string | null,"id"?: string,"instrucao_equipe"?: string | null,"modelo_id"?: string,"nome"?: string,"obrigatoriedade"?: string,"ordem"?: number,"prazo_dias"?: number | null,"revisor_perfil_id"?: string | null,"revisor_tipo"?: string,"revisor_usuario_id"?: string | null,"updated_at"?: string,"validade_dias"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "modelos_checklist_itens_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias_documento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelos_checklist_itens_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: false
      referencedRelation: "modelos_checklist_grupos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelos_checklist_itens_modelo_id_fkey"
      columns: ["modelo_id"]
isOneToOne: false
      referencedRelation: "modelos_checklist"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelos_checklist_itens_revisor_perfil_id_fkey"
      columns: ["revisor_perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelos_checklist_itens_revisor_usuario_id_fkey"
      columns: ["revisor_usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"modelos_tarefas": {
                  Row: {
                    "ativo": boolean,"created_at": string,"created_by": string | null,"descricao": string | null,"id": string,"itens": NonNullable<Json>,"nome": string,"tipo_demanda_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "ativo"?: boolean,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"itens"?: NonNullable<Json>,"nome": string,"tipo_demanda_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"itens"?: NonNullable<Json>,"nome"?: string,"tipo_demanda_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modelos_tarefas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelos_tarefas_tipo_demanda_id_fkey"
      columns: ["tipo_demanda_id"]
isOneToOne: false
      referencedRelation: "tipos_demanda"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "automacao_id": string | null,"chave_dedupe": string | null,"created_at": string,"entidade": string | null,"id": string,"lida_em": string | null,"link": string | null,"mensagem": string | null,"registro_id": string | null,"tipo": string,"titulo": string,"usuario_id": string
                  }
                  Insert: {
                    "automacao_id"?: string | null,"chave_dedupe"?: string | null,"created_at"?: string,"entidade"?: string | null,"id"?: string,"lida_em"?: string | null,"link"?: string | null,"mensagem"?: string | null,"registro_id"?: string | null,"tipo": string,"titulo": string,"usuario_id": string
                  }
                  Update: {
                    "automacao_id"?: string | null,"chave_dedupe"?: string | null,"created_at"?: string,"entidade"?: string | null,"id"?: string,"lida_em"?: string | null,"link"?: string | null,"mensagem"?: string | null,"registro_id"?: string | null,"tipo"?: string,"titulo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacoes_automacao_id_fkey"
      columns: ["automacao_id"]
isOneToOne: false
      referencedRelation: "automacoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notificacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"opcoes": {
                  Row: {
                    "ativo": boolean,"cor": string | null,"lista": string,"meta": NonNullable<Json>,"ordem": number,"rotulo": string,"sistema": boolean,"updated_at": string,"valor": string
                  }
                  Insert: {
                    "ativo"?: boolean,"cor"?: string | null,"lista": string,"meta"?: NonNullable<Json>,"ordem"?: number,"rotulo": string,"sistema"?: boolean,"updated_at"?: string,"valor": string
                  }
                  Update: {
                    "ativo"?: boolean,"cor"?: string | null,"lista"?: string,"meta"?: NonNullable<Json>,"ordem"?: number,"rotulo"?: string,"sistema"?: boolean,"updated_at"?: string,"valor"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pagamentos": {
                  Row: {
                    "caso_id": string | null,"cliente_id": string,"cobranca_id": string,"comprovante_arquivo_id": string | null,"data_pagamento": string,"estornado_em": string | null,"estornado_por": string | null,"forma": string,"id": string,"motivo_estorno": string | null,"observacao": string | null,"registrado_em": string,"registrado_por": string,"valor": number
                  }
                  Insert: {
                    "caso_id"?: string | null,"cliente_id": string,"cobranca_id": string,"comprovante_arquivo_id"?: string | null,"data_pagamento": string,"estornado_em"?: string | null,"estornado_por"?: string | null,"forma"?: string,"id"?: string,"motivo_estorno"?: string | null,"observacao"?: string | null,"registrado_em"?: string,"registrado_por": string,"valor": number
                  }
                  Update: {
                    "caso_id"?: string | null,"cliente_id"?: string,"cobranca_id"?: string,"comprovante_arquivo_id"?: string | null,"data_pagamento"?: string,"estornado_em"?: string | null,"estornado_por"?: string | null,"forma"?: string,"id"?: string,"motivo_estorno"?: string | null,"observacao"?: string | null,"registrado_em"?: string,"registrado_por"?: string,"valor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagamentos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_cobranca_id_fkey"
      columns: ["cobranca_id"]
isOneToOne: false
      referencedRelation: "cobrancas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_cobranca_id_fkey"
      columns: ["cobranca_id"]
isOneToOne: false
      referencedRelation: "v_cobrancas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_comprovante_arquivo_id_fkey"
      columns: ["comprovante_arquivo_id"]
isOneToOne: false
      referencedRelation: "arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_estornado_por_fkey"
      columns: ["estornado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"partes": {
                  Row: {
                    "caso_id": string,"cliente_id": string | null,"created_at": string,"documento": string | null,"id": string,"nome": string,"observacoes": string | null,"processo_id": string | null,"tipo": string
                  }
                  Insert: {
                    "caso_id": string,"cliente_id"?: string | null,"created_at"?: string,"documento"?: string | null,"id"?: string,"nome": string,"observacoes"?: string | null,"processo_id"?: string | null,"tipo"?: string
                  }
                  Update: {
                    "caso_id"?: string,"cliente_id"?: string | null,"created_at"?: string,"documento"?: string | null,"id"?: string,"nome"?: string,"observacoes"?: string | null,"processo_id"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partes_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partes_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partes_processo_id_fkey"
      columns: ["processo_id"]
isOneToOne: false
      referencedRelation: "processos"
      referencedColumns: ["id"]
    }
                  ]
                },"perfis": {
                  Row: {
                    "created_at": string,"descricao": string | null,"id": string,"nome": string,"ordem": number,"permissoes": (string)[],"sistema": boolean,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"descricao"?: string | null,"id": string,"nome": string,"ordem"?: number,"permissoes"?: (string)[],"sistema"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"descricao"?: string | null,"id"?: string,"nome"?: string,"ordem"?: number,"permissoes"?: (string)[],"sistema"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permissoes_catalogo": {
                  Row: {
                    "descricao": string,"id": string,"modulo": string,"ordem": number
                  }
                  Insert: {
                    "descricao": string,"id": string,"modulo": string,"ordem"?: number
                  }
                  Update: {
                    "descricao"?: string,"id"?: string,"modulo"?: string,"ordem"?: number
                  }
                  Relationships: [
                    
                  ]
                },"prazos": {
                  Row: {
                    "alertas_dias": (number)[],"calculo": Json | null,"caso_id": string,"comprovante_arquivo_id": string | null,"conferido": boolean,"conferido_em": string | null,"conferido_por": string | null,"created_at": string,"created_by": string | null,"cumprido_em": string | null,"cumprido_por": string | null,"cumprimento_obs": string | null,"data_ciencia": string | null,"descricao": string | null,"id": string,"motivo_alteracao": string | null,"observacoes": string | null,"origem": string,"prioridade": string,"processo_id": string | null,"referencia_origem": string | null,"responsavel_id": string | null,"status": string,"titulo": string,"updated_at": string,"vencimento": string,"versao": number
                  }
                  Insert: {
                    "alertas_dias"?: (number)[],"calculo"?: Json | null,"caso_id": string,"comprovante_arquivo_id"?: string | null,"conferido"?: boolean,"conferido_em"?: string | null,"conferido_por"?: string | null,"created_at"?: string,"created_by"?: string | null,"cumprido_em"?: string | null,"cumprido_por"?: string | null,"cumprimento_obs"?: string | null,"data_ciencia"?: string | null,"descricao"?: string | null,"id"?: string,"motivo_alteracao"?: string | null,"observacoes"?: string | null,"origem"?: string,"prioridade"?: string,"processo_id"?: string | null,"referencia_origem"?: string | null,"responsavel_id"?: string | null,"status"?: string,"titulo": string,"updated_at"?: string,"vencimento": string,"versao"?: number
                  }
                  Update: {
                    "alertas_dias"?: (number)[],"calculo"?: Json | null,"caso_id"?: string,"comprovante_arquivo_id"?: string | null,"conferido"?: boolean,"conferido_em"?: string | null,"conferido_por"?: string | null,"created_at"?: string,"created_by"?: string | null,"cumprido_em"?: string | null,"cumprido_por"?: string | null,"cumprimento_obs"?: string | null,"data_ciencia"?: string | null,"descricao"?: string | null,"id"?: string,"motivo_alteracao"?: string | null,"observacoes"?: string | null,"origem"?: string,"prioridade"?: string,"processo_id"?: string | null,"referencia_origem"?: string | null,"responsavel_id"?: string | null,"status"?: string,"titulo"?: string,"updated_at"?: string,"vencimento"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prazos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_comprovante_fk"
      columns: ["comprovante_arquivo_id"]
isOneToOne: false
      referencedRelation: "arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_conferido_por_fkey"
      columns: ["conferido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_cumprido_por_fkey"
      columns: ["cumprido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_processo_id_fkey"
      columns: ["processo_id"]
isOneToOne: false
      referencedRelation: "processos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"prazos_historico": {
                  Row: {
                    "campo": string,"created_at": string,"id": number,"motivo": string | null,"prazo_id": string,"usuario_id": string | null,"valor_anterior": string | null,"valor_novo": string | null
                  }
                  Insert: {
                    "campo": string,"created_at"?: string,"id"?: never,"motivo"?: string | null,"prazo_id": string,"usuario_id"?: string | null,"valor_anterior"?: string | null,"valor_novo"?: string | null
                  }
                  Update: {
                    "campo"?: string,"created_at"?: string,"id"?: never,"motivo"?: string | null,"prazo_id"?: string,"usuario_id"?: string | null,"valor_anterior"?: string | null,"valor_novo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "prazos_historico_prazo_id_fkey"
      columns: ["prazo_id"]
isOneToOne: false
      referencedRelation: "prazos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prazos_historico_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"processos": {
                  Row: {
                    "caso_id": string,"classe": string | null,"comarca": string | null,"created_at": string,"created_by": string | null,"data_distribuicao": string | null,"fonte": string,"id": string,"id_externo": string | null,"instancia": string | null,"link_consulta": string | null,"numero": string | null,"numero_norm": string | null,"observacoes": string | null,"orgao": string | null,"principal": boolean,"segredo_justica": boolean,"sistema": string | null,"situacao": string,"tribunal": string | null,"uf": string | null,"ultima_sincronizacao_em": string | null,"updated_at": string
                  }
                  Insert: {
                    "caso_id": string,"classe"?: string | null,"comarca"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_distribuicao"?: string | null,"fonte"?: string,"id"?: string,"id_externo"?: string | null,"instancia"?: string | null,"link_consulta"?: string | null,"numero"?: string | null,"numero_norm"?: never,"observacoes"?: string | null,"orgao"?: string | null,"principal"?: boolean,"segredo_justica"?: boolean,"sistema"?: string | null,"situacao"?: string,"tribunal"?: string | null,"uf"?: string | null,"ultima_sincronizacao_em"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "caso_id"?: string,"classe"?: string | null,"comarca"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_distribuicao"?: string | null,"fonte"?: string,"id"?: string,"id_externo"?: string | null,"instancia"?: string | null,"link_consulta"?: string | null,"numero"?: string | null,"numero_norm"?: never,"observacoes"?: string | null,"orgao"?: string | null,"principal"?: boolean,"segredo_justica"?: boolean,"sistema"?: string | null,"situacao"?: string,"tribunal"?: string | null,"uf"?: string | null,"ultima_sincronizacao_em"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "processos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "processos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_respostas": {
                  Row: {
                    "campo": string | null,"id": number,"lead_id": string | null,"ordem": number,"pergunta": string,"pergunta_id": string,"pontuacao": number | null,"resposta": string | null,"submissao_id": string,"valor": string | null
                  }
                  Insert: {
                    "campo"?: string | null,"id"?: never,"lead_id"?: string | null,"ordem": number,"pergunta": string,"pergunta_id": string,"pontuacao"?: number | null,"resposta"?: string | null,"submissao_id": string,"valor"?: string | null
                  }
                  Update: {
                    "campo"?: string | null,"id"?: never,"lead_id"?: string | null,"ordem"?: number,"pergunta"?: string,"pergunta_id"?: string,"pontuacao"?: number | null,"resposta"?: string | null,"submissao_id"?: string,"valor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_respostas_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_respostas_submissao_id_fkey"
      columns: ["submissao_id"]
isOneToOne: false
      referencedRelation: "quiz_submissoes"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_submissoes": {
                  Row: {
                    "chave_idempotencia": string,"duracao_segundos": number | null,"email": string | null,"fbclid": string | null,"gclid": string | null,"id": string,"iniciado_em": string | null,"ip_hash": string | null,"lead_id": string | null,"motivo_bloqueio": string | null,"nome": string | null,"observacoes": string | null,"pagina": string | null,"recebido_em": string,"referrer": string | null,"respostas": NonNullable<Json>,"score_calculado": number | null,"score_informado": number | null,"status": string,"temperatura": string | null,"user_agent": string | null,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"versao_quiz": string | null,"whatsapp": string | null
                  }
                  Insert: {
                    "chave_idempotencia": string,"duracao_segundos"?: number | null,"email"?: string | null,"fbclid"?: string | null,"gclid"?: string | null,"id"?: string,"iniciado_em"?: string | null,"ip_hash"?: string | null,"lead_id"?: string | null,"motivo_bloqueio"?: string | null,"nome"?: string | null,"observacoes"?: string | null,"pagina"?: string | null,"recebido_em"?: string,"referrer"?: string | null,"respostas"?: NonNullable<Json>,"score_calculado"?: number | null,"score_informado"?: number | null,"status"?: string,"temperatura"?: string | null,"user_agent"?: string | null,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"versao_quiz"?: string | null,"whatsapp"?: string | null
                  }
                  Update: {
                    "chave_idempotencia"?: string,"duracao_segundos"?: number | null,"email"?: string | null,"fbclid"?: string | null,"gclid"?: string | null,"id"?: string,"iniciado_em"?: string | null,"ip_hash"?: string | null,"lead_id"?: string | null,"motivo_bloqueio"?: string | null,"nome"?: string | null,"observacoes"?: string | null,"pagina"?: string | null,"recebido_em"?: string,"referrer"?: string | null,"respostas"?: NonNullable<Json>,"score_calculado"?: number | null,"score_informado"?: number | null,"status"?: string,"temperatura"?: string | null,"user_agent"?: string | null,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"versao_quiz"?: string | null,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_submissoes_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"reembolsos": {
                  Row: {
                    "caso_id": string | null,"cliente_id": string,"cobranca_id": string,"comprovante_arquivo_id": string | null,"data": string,"forma": string,"id": string,"motivo": string,"registrado_em": string,"registrado_por": string,"valor": number
                  }
                  Insert: {
                    "caso_id"?: string | null,"cliente_id": string,"cobranca_id": string,"comprovante_arquivo_id"?: string | null,"data": string,"forma"?: string,"id"?: string,"motivo": string,"registrado_em"?: string,"registrado_por": string,"valor": number
                  }
                  Update: {
                    "caso_id"?: string | null,"cliente_id"?: string,"cobranca_id"?: string,"comprovante_arquivo_id"?: string | null,"data"?: string,"forma"?: string,"id"?: string,"motivo"?: string,"registrado_em"?: string,"registrado_por"?: string,"valor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reembolsos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_cobranca_id_fkey"
      columns: ["cobranca_id"]
isOneToOne: false
      referencedRelation: "cobrancas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_cobranca_id_fkey"
      columns: ["cobranca_id"]
isOneToOne: false
      referencedRelation: "v_cobrancas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_comprovante_arquivo_id_fkey"
      columns: ["comprovante_arquivo_id"]
isOneToOne: false
      referencedRelation: "arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitacoes_documentos": {
                  Row: {
                    "caso_id": string | null,"cliente_id": string | null,"created_at": string,"criado_por": string | null,"documentos_ids": (string)[],"expira_em": string,"id": string,"lead_id": string | null,"mensagem": string | null,"revogada_em": string | null,"revogada_por": string | null,"token_hash": string,"total_acessos": number,"total_envios": number,"ultimo_acesso_em": string | null
                  }
                  Insert: {
                    "caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"criado_por"?: string | null,"documentos_ids": (string)[],"expira_em": string,"id"?: string,"lead_id"?: string | null,"mensagem"?: string | null,"revogada_em"?: string | null,"revogada_por"?: string | null,"token_hash": string,"total_acessos"?: number,"total_envios"?: number,"ultimo_acesso_em"?: string | null
                  }
                  Update: {
                    "caso_id"?: string | null,"cliente_id"?: string | null,"created_at"?: string,"criado_por"?: string | null,"documentos_ids"?: (string)[],"expira_em"?: string,"id"?: string,"lead_id"?: string | null,"mensagem"?: string | null,"revogada_em"?: string | null,"revogada_por"?: string | null,"token_hash"?: string,"total_acessos"?: number,"total_envios"?: number,"ultimo_acesso_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "solicitacoes_documentos_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacoes_documentos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacoes_documentos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacoes_documentos_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solicitacoes_documentos_revogada_por_fkey"
      columns: ["revogada_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"tarefas": {
                  Row: {
                    "arquivado_em": string | null,"automacao_id": string | null,"caso_id": string | null,"checklist": NonNullable<Json>,"cliente_id": string | null,"concluida_em": string | null,"concluida_por": string | null,"created_at": string,"created_by": string | null,"depende_de": string | null,"descricao": string | null,"etiquetas": (string)[],"id": string,"lead_id": string | null,"modelo_id": string | null,"origem": string,"prazo": string | null,"prazo_dia_inteiro": boolean,"prioridade": string,"responsavel_id": string | null,"status": string,"titulo": string,"updated_at": string,"versao": number
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"automacao_id"?: string | null,"caso_id"?: string | null,"checklist"?: NonNullable<Json>,"cliente_id"?: string | null,"concluida_em"?: string | null,"concluida_por"?: string | null,"created_at"?: string,"created_by"?: string | null,"depende_de"?: string | null,"descricao"?: string | null,"etiquetas"?: (string)[],"id"?: string,"lead_id"?: string | null,"modelo_id"?: string | null,"origem"?: string,"prazo"?: string | null,"prazo_dia_inteiro"?: boolean,"prioridade"?: string,"responsavel_id"?: string | null,"status"?: string,"titulo": string,"updated_at"?: string,"versao"?: number
                  }
                  Update: {
                    "arquivado_em"?: string | null,"automacao_id"?: string | null,"caso_id"?: string | null,"checklist"?: NonNullable<Json>,"cliente_id"?: string | null,"concluida_em"?: string | null,"concluida_por"?: string | null,"created_at"?: string,"created_by"?: string | null,"depende_de"?: string | null,"descricao"?: string | null,"etiquetas"?: (string)[],"id"?: string,"lead_id"?: string | null,"modelo_id"?: string | null,"origem"?: string,"prazo"?: string | null,"prazo_dia_inteiro"?: boolean,"prioridade"?: string,"responsavel_id"?: string | null,"status"?: string,"titulo"?: string,"updated_at"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tarefas_automacao_id_fkey"
      columns: ["automacao_id"]
isOneToOne: false
      referencedRelation: "automacoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_concluida_por_fkey"
      columns: ["concluida_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_depende_de_fkey"
      columns: ["depende_de"]
isOneToOne: false
      referencedRelation: "tarefas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_modelo_id_fkey"
      columns: ["modelo_id"]
isOneToOne: false
      referencedRelation: "modelos_tarefas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarefas_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"tipos_demanda": {
                  Row: {
                    "ativo": boolean,"cor": string,"created_at": string,"descricao": string | null,"id": string,"modelo_checklist_id": string | null,"modelo_tarefas_id": string | null,"nome": string,"ordem": number,"updated_at": string
                  }
                  Insert: {
                    "ativo"?: boolean,"cor"?: string,"created_at"?: string,"descricao"?: string | null,"id"?: string,"modelo_checklist_id"?: string | null,"modelo_tarefas_id"?: string | null,"nome": string,"ordem"?: number,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"cor"?: string,"created_at"?: string,"descricao"?: string | null,"id"?: string,"modelo_checklist_id"?: string | null,"modelo_tarefas_id"?: string | null,"nome"?: string,"ordem"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tipos_demanda_modelo_checklist_fk"
      columns: ["modelo_checklist_id"]
isOneToOne: false
      referencedRelation: "modelos_checklist"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tipos_demanda_modelo_tarefas_fk"
      columns: ["modelo_tarefas_id"]
isOneToOne: false
      referencedRelation: "modelos_tarefas"
      referencedColumns: ["id"]
    }
                  ]
                },"usuarios": {
                  Row: {
                    "ativo": boolean,"cargo": string | null,"cor": string,"created_at": string,"email": string,"id": string,"nome": string,"oab": string | null,"perfil_id": string,"permissoes_extra": (string)[],"permissoes_negadas": (string)[],"telefone": string | null,"ultimo_acesso_em": string | null,"updated_at": string
                  }
                  Insert: {
                    "ativo"?: boolean,"cargo"?: string | null,"cor"?: string,"created_at"?: string,"email": string,"id": string,"nome": string,"oab"?: string | null,"perfil_id": string,"permissoes_extra"?: (string)[],"permissoes_negadas"?: (string)[],"telefone"?: string | null,"ultimo_acesso_em"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ativo"?: boolean,"cargo"?: string | null,"cor"?: string,"created_at"?: string,"email"?: string,"id"?: string,"nome"?: string,"oab"?: string | null,"perfil_id"?: string,"permissoes_extra"?: (string)[],"permissoes_negadas"?: (string)[],"telefone"?: string | null,"ultimo_acesso_em"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuarios_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"valores_personalizados": {
                  Row: {
                    "campo_id": string,"entidade": string,"registro_id": string,"updated_at": string,"updated_by": string | null,"valor": Json | null
                  }
                  Insert: {
                    "campo_id": string,"entidade": string,"registro_id": string,"updated_at"?: string,"updated_by"?: string | null,"valor"?: Json | null
                  }
                  Update: {
                    "campo_id"?: string,"entidade"?: string,"registro_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"valor"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "valores_personalizados_campo_id_fkey"
      columns: ["campo_id"]
isOneToOne: false
      referencedRelation: "campos_personalizados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "valores_personalizados_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"visualizacoes": {
                  Row: {
                    "compartilhada": boolean,"config": NonNullable<Json>,"created_at": string,"dono_id": string | null,"id": string,"nome": string,"ordem": number,"padrao": boolean,"quadro": string,"tipo": string,"updated_at": string
                  }
                  Insert: {
                    "compartilhada"?: boolean,"config"?: NonNullable<Json>,"created_at"?: string,"dono_id"?: string | null,"id"?: string,"nome": string,"ordem"?: number,"padrao"?: boolean,"quadro": string,"tipo"?: string,"updated_at"?: string
                  }
                  Update: {
                    "compartilhada"?: boolean,"config"?: NonNullable<Json>,"created_at"?: string,"dono_id"?: string | null,"id"?: string,"nome"?: string,"ordem"?: number,"padrao"?: boolean,"quadro"?: string,"tipo"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visualizacoes_dono_id_fkey"
      columns: ["dono_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"visualizacoes_favoritas": {
                  Row: {
                    "created_at": string,"usuario_id": string,"visualizacao_id": string
                  }
                  Insert: {
                    "created_at"?: string,"usuario_id"?: string,"visualizacao_id": string
                  }
                  Update: {
                    "created_at"?: string,"usuario_id"?: string,"visualizacao_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visualizacoes_favoritas_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visualizacoes_favoritas_visualizacao_id_fkey"
      columns: ["visualizacao_id"]
isOneToOne: false
      referencedRelation: "visualizacoes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_cobrancas": {
                  Row: {
                    "acrescimo": number | null,"cancelada_em": string | null,"cancelada_por": string | null,"caso_id": string | null,"categoria": string | null,"cliente_id": string | null,"contrato_id": string | null,"created_at": string | null,"created_by": string | null,"desconto": number | null,"descricao": string | null,"dias_atraso": number | null,"id": string | null,"id_externo": string | null,"motivo_cancelamento": string | null,"observacoes": string | null,"parcela_numero": number | null,"parcela_total": number | null,"parcialmente_pago": boolean | null,"saldo": number | null,"situacao": string | null,"ultimo_pagamento": string | null,"updated_at": string | null,"valor": number | null,"valor_devido": number | null,"valor_pago": number | null,"valor_reembolsado": number | null,"vencimento": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cobrancas_cancelada_por_fkey"
      columns: ["cancelada_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_caso_id_fkey"
      columns: ["caso_id"]
isOneToOne: false
      referencedRelation: "casos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_contrato_id_fkey"
      columns: ["contrato_id"]
isOneToOne: false
      referencedRelation: "contratos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobrancas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_bootstrap":
{ Args: { "p_email": string,"p_nome": string,"p_usuario": string }; Returns: undefined
                           },
"admin_excluir_perfil":
{ Args: { "p_ator": string,"p_id": string }; Returns: undefined
                           },
"admin_salvar_perfil":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"admin_salvar_usuario":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"admins_ativos":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"aplicar_checklist":
{ Args: { "p_caso"?: string,"p_cliente"?: string,"p_lead"?: string,"p_modelo": string }; Returns: number
                           },
"aplicar_modelo_tarefas":
{ Args: { "p_caso": string,"p_data_base"?: string,"p_modelo": string }; Returns: number
                           },
"atualizar_meu_perfil":
{ Args: { "p_cor": string,"p_nome": string,"p_telefone": string }; Returns: undefined
                           },
"auto_documento_pendente":
{ Args: { "a": Database["public"]['Tables']["automacoes"]['Row'] }; Returns: number
                           },
"auto_documento_validade":
{ Args: { "a": Database["public"]['Tables']["automacoes"]['Row'] }; Returns: number
                           },
"auto_lead_parado":
{ Args: { "a": Database["public"]['Tables']["automacoes"]['Row'] }; Returns: number
                           },
"auto_parcela_vencida":
{ Args: { "a": Database["public"]['Tables']["automacoes"]['Row'] }; Returns: number
                           },
"auto_prazo_processual":
{ Args: { "a": Database["public"]['Tables']["automacoes"]['Row'] }; Returns: number
                           },
"auto_tarefa_prazo":
{ Args: { "a": Database["public"]['Tables']["automacoes"]['Row'] }; Returns: number
                           },
"avaliar_condicao_documento":
{ Args: { "p_caso": string,"p_cliente": string,"p_cond": Json,"p_lead": string }; Returns: boolean
                           },
"busca_global":
{ Args: { "p_termo": string }; Returns: Json
                           },
"buscar_duplicados":
{ Args: { "p_cpf": string,"p_email": string,"p_ignorar"?: string,"p_telefone": string }; Returns: Json
                           },
"campos_alterados":
{ Args: { "p_antigo": Json,"p_novo": Json,"p_rotulos": Json }; Returns: string
                           },
"chave_telefone":
{ Args: { "texto": string }; Returns: string
                           },
"converter_lead":
{ Args: { "p_dados"?: Json,"p_lead": string }; Returns: Json
                           },
"criar_caso":
{ Args: { "p": Json }; Returns: string
                           },
"doc_criar_solicitacao":
{ Args: { "p": Json,"p_ator": string }; Returns: Json
                           },
"doc_revogar_solicitacao":
{ Args: { "p_ator": string,"p_id": string }; Returns: undefined
                           },
"eh_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"eh_responsavel":
{ Args: { "p_caso"?: string,"p_cliente": string,"p_lead"?: string }; Returns: boolean
                           },
"escolher_responsavel":
{ Args: { "p_config": Json }; Returns: string
                           },
"etapa_inicial":
{ Args: { "p_funil": string }; Returns: string
                           },
"etapa_por_categoria":
{ Args: { "p_categoria": string,"p_funil": string }; Returns: string
                           },
"executar_automacoes":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"executar_automacoes_agora":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"exigir_permissao":
{ Args: { "p_ator": string,"p_permissao": string }; Returns: undefined
                           },
"exigir_relatorios":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"f_unaccent":
{ Args: { "texto": string }; Returns: string
                           },
"fin_adicionar_cobranca":
{ Args: { "p": Json,"p_ator": string }; Returns: string
                           },
"fin_atualizar_contrato":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"fin_cancelar_cobranca":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"fin_cancelar_despesa":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"fin_criar_contrato":
{ Args: { "p": Json,"p_ator": string }; Returns: Json
                           },
"fin_editar_cobranca":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"fin_estornar_pagamento":
{ Args: { "p": Json,"p_ator": string }; Returns: undefined
                           },
"fin_registrar_arquivo":
{ Args: { "p": Json,"p_ator": string }; Returns: string
                           },
"fin_registrar_despesa":
{ Args: { "p": Json,"p_ator": string }; Returns: Json
                           },
"fin_registrar_pagamento":
{ Args: { "p": Json,"p_ator": string }; Returns: Json
                           },
"fin_registrar_reembolso":
{ Args: { "p": Json,"p_ator": string }; Returns: string
                           },
"fin_validar_comprovante":
{ Args: { "p_arquivo": string,"p_cliente": string }; Returns: undefined
                           },
"formatar_data_hora":
{ Args: { "p_valor": string }; Returns: string
                           },
"formatar_moeda":
{ Args: { "p_valor": number }; Returns: string
                           },
"hoje_sp":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"importar_buscar_duplicados":
{ Args: { "p_cpfs": (string)[],"p_emails": (string)[],"p_telefones": (string)[] }; Returns: Json
                           },
"importar_clientes":
{ Args: { "p": Json,"p_ator": string }; Returns: Json
                           },
"link_registro":
{ Args: { "p_entidade": string,"p_id": string }; Returns: string
                           },
"mesclar_leads":
{ Args: { "p_destino": string,"p_origem": string }; Returns: undefined
                           },
"meu_perfil":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"nome_usuario":
{ Args: { "p_id": string }; Returns: string
                           },
"normalizar_documento":
{ Args: { "texto": string }; Returns: string
                           },
"normalizar_email":
{ Args: { "texto": string }; Returns: string
                           },
"normalizar_telefone":
{ Args: { "texto": string }; Returns: string
                           },
"notificar":
{ Args: { "p_automacao"?: string,"p_chave"?: string,"p_entidade"?: string,"p_link"?: string,"p_mensagem"?: string,"p_registro"?: string,"p_tipo": string,"p_titulo": string,"p_usuario": string }; Returns: boolean
                           },
"notificar_atribuicao":
{ Args: { "p_entidade": string,"p_registro": string,"p_titulo": string,"p_usuario": string }; Returns: undefined
                           },
"permissoes_efetivas":
{ Args: { "p_usuario": string }; Returns: (string)[]
                           },
"pode_editar_entidade":
{ Args: { "p_entidade": string }; Returns: boolean
                           },
"pode_ver_arquivo":
{ Args: { "a": Database["public"]['Tables']["arquivos"]['Row'] }; Returns: boolean
                           },
"pode_ver_campo":
{ Args: { "p_campo": string,"p_entidade": string,"p_registro": string }; Returns: boolean
                           },
"pode_ver_documento":
{ Args: { "p_documento": string }; Returns: boolean
                           },
"pode_ver_registro":
{ Args: { "p_entidade": string,"p_registro": string }; Returns: boolean
                           },
"pode_ver_saude":
{ Args: { "p_cliente": string,"p_lead"?: string }; Returns: boolean
                           },
"pode_ver_saude_registro":
{ Args: { "p_entidade": string,"p_registro": string }; Returns: boolean
                           },
"pode_ver_tarefa":
{ Args: { "p_tarefa": string }; Returns: boolean
                           },
"portal_abrir":
{ Args: { "p_token_hash": string }; Returns: Json
                           },
"portal_preparar_envio":
{ Args: { "p_documento": string,"p_token_hash": string }; Returns: Json
                           },
"portal_registrar_envio":
{ Args: { "p_caminho": string,"p_documento": string,"p_mime": string,"p_nome": string,"p_tamanho": number,"p_token_hash": string }; Returns: Json
                           },
"portal_solicitacao_valida":
{ Args: { "p_token_hash": string }; Returns: {
              "caso_id": string | null,
"cliente_id": string | null,
"created_at": string,
"criado_por": string | null,
"documentos_ids": (string)[],
"expira_em": string,
"id": string,
"lead_id": string | null,
"mensagem": string | null,
"revogada_em": string | null,
"revogada_por": string | null,
"token_hash": string,
"total_acessos": number,
"total_envios": number,
"ultimo_acesso_em": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "solicitacoes_documentos"
        isOneToOne: true
        isSetofReturn: false
      } },
"quiz_registrar":
{ Args: { "p": Json }; Returns: Json
                           },
"registrar_acesso":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"registrar_evento":
{ Args: { "p_automatico"?: boolean,"p_caso"?: string,"p_cliente"?: string,"p_detalhes"?: Json,"p_entidade"?: string,"p_lead"?: string,"p_registro"?: string,"p_restrito"?: string,"p_tipo": string,"p_titulo": string }; Returns: undefined
                           },
"registrar_exportacao":
{ Args: { "p_formato": string,"p_quadro": string,"p_quantidade": number }; Returns: undefined
                           },
"relatorio_casos":
{ Args: { "p": Json }; Returns: Json
                           },
"relatorio_documentos":
{ Args: { "p": Json }; Returns: Json
                           },
"relatorio_financeiro":
{ Args: { "p": Json }; Returns: Json
                           },
"relatorio_leads":
{ Args: { "p": Json }; Returns: Json
                           },
"relatorio_periodo":
{ Args: { "p": Json }; Returns: Record<string, unknown>
                           },
"relatorio_prazos":
{ Args: { "p": Json }; Returns: Json
                           },
"relatorio_produtividade":
{ Args: { "p": Json }; Returns: Json
                           },
"rotulo_opcao":
{ Args: { "p_lista": string,"p_valor": string }; Returns: string
                           },
"rotulo_status_documento":
{ Args: { "p_status": string }; Returns: string
                           },
"servico_contexto":
{ Args: { "p_ator": string,"p_contexto": string }; Returns: undefined
                           },
"somente_digitos":
{ Args: { "texto": string }; Returns: string
                           },
"tem_permissao":
{ Args: { "p_permissao": string }; Returns: boolean
                           },
"tem_permissao_usuario":
{ Args: { "p_permissao": string,"p_usuario": string }; Returns: boolean
                           },
"usuario_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"usuario_atual":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"verificar_limite":
{ Args: { "p_chave": string,"p_janela_segundos": number,"p_maximo": number }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

