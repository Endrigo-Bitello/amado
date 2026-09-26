-- =============================================================================
-- CRM Amado & Amado Jr. — 17. Configuração inicial (editável pela Administração)
-- Nada aqui é dado de cliente. Etapas, listas, modelos e textos podem ser
-- renomeados, reordenados, arquivados ou substituídos pelo administrador.
-- =============================================================================

-- Funil de leads -------------------------------------------------------------
insert into public.etapas (funil, nome, cor, ordem, categoria, chave, descricao) values
  ('lead', 'Novo',                   '#3E5C8A', 10, 'aberta',  'lead_novo',          'Lead recém-chegado (quiz, cadastro manual ou importação).'),
  ('lead', 'A contatar',             '#C9822B', 20, 'aberta',  'lead_a_contatar',    'Aguardando o primeiro contato da equipe.'),
  ('lead', 'Em atendimento',         '#1F6E76', 30, 'aberta',  'lead_atendimento',   'Conversa em andamento com o lead.'),
  ('lead', 'Aguardando documentos',  '#6D5BA6', 40, 'aberta',  'lead_documentos',    'Documentos solicitados para análise.'),
  ('lead', 'Em análise jurídica',    '#7A8B2E', 50, 'aberta',  'lead_analise',       'Equipe jurídica avaliando a viabilidade da medida.'),
  ('lead', 'Proposta enviada',       '#A68658', 60, 'aberta',  'lead_proposta',      'Proposta de honorários enviada.'),
  ('lead', 'Contratado',             '#3D7B3E', 70, 'ganha',   'lead_contratado',    'Contrato fechado — converter em cliente.'),
  ('lead', 'Não convertido',         '#8E2C3D', 80, 'perdida', 'lead_nao_convertido','Atendimento encerrado sem contratação (exige motivo).');

-- Fases dos casos --------------------------------------------------------------
insert into public.etapas (funil, nome, cor, ordem, categoria, chave, descricao) values
  ('caso', 'Triagem e documentos',              '#3E5C8A', 10, 'aberta', 'caso_triagem',     'Coleta e conferência inicial de documentos.'),
  ('caso', 'Preparação da ação',                '#C9822B', 20, 'aberta', 'caso_preparacao',  'Elaboração e revisão da peça.'),
  ('caso', 'Protocolado — aguardando decisão',  '#6D5BA6', 30, 'aberta', 'caso_protocolado', 'Ação protocolada, aguardando apreciação.'),
  ('caso', 'Decisão proferida',                 '#1F6E76', 40, 'aberta', 'caso_decisao',     'Liminar, sentença ou decisão relevante.'),
  ('caso', 'Cumprimento e acompanhamento',      '#3D7B3E', 50, 'aberta', 'caso_cumprimento', 'Acompanhamento do cumprimento da decisão.'),
  ('caso', 'Recurso',                           '#B5532F', 60, 'aberta', 'caso_recurso',     'Recurso interposto ou em análise.'),
  ('caso', 'Encerramento',                      '#52525B', 70, 'aberta', 'caso_encerramento','Finalização e arquivamento interno.');

-- Listas de opções -------------------------------------------------------------
insert into public.opcoes (lista, valor, rotulo, cor, ordem, sistema, meta) values
  ('prioridade', 'baixa',   'Baixa',   '#A1A1AA', 10, true, '{}'),
  ('prioridade', 'media',   'Média',   '#3E5C8A', 20, true, '{}'),
  ('prioridade', 'alta',    'Alta',    '#C9822B', 30, true, '{}'),
  ('prioridade', 'urgente', 'Urgente', '#8E2C3D', 40, true, '{}'),

  ('origem', 'quiz_site',  'Quiz do site',       '#3D7B3E', 10, true, '{}'),
  ('origem', 'whatsapp',   'WhatsApp',           '#1F6E76', 20, false, '{}'),
  ('origem', 'instagram',  'Instagram',          '#6D5BA6', 30, false, '{}'),
  ('origem', 'indicacao',  'Indicação',          '#A68658', 40, false, '{}'),
  ('origem', 'telefone',   'Telefone',           '#3E5C8A', 50, false, '{}'),
  ('origem', 'presencial', 'Presencial',         '#7A8B2E', 60, false, '{}'),
  ('origem', 'evento',     'Evento / palestra',  '#B5532F', 70, false, '{}'),
  ('origem', 'lead',       'Conversão de lead',  '#285E31', 80, true, '{}'),
  ('origem', 'importacao', 'Importação',         '#52525B', 90, true, '{}'),
  ('origem', 'manual',     'Cadastro manual',    '#A1A1AA', 95, true, '{}'),
  ('origem', 'outro',      'Outro',              '#A1A1AA', 99, false, '{}'),

  ('motivo_perda', 'sem_retorno',        'Sem retorno do lead',            null, 10, false, '{}'),
  ('motivo_perda', 'sem_interesse',      'Sem interesse no momento',        null, 20, false, '{}'),
  ('motivo_perda', 'valor',              'Valor dos honorários',            null, 30, false, '{}'),
  ('motivo_perda', 'sem_acompanhamento', 'Sem acompanhamento médico',       null, 40, false, '{}'),
  ('motivo_perda', 'fora_escopo',        'Demanda fora da atuação',         null, 50, false, '{}'),
  ('motivo_perda', 'contratou_outro',    'Contratou outro escritório',      null, 60, false, '{}'),
  ('motivo_perda', 'inviavel',           'Medida avaliada como inviável',   null, 70, false, '{}'),
  ('motivo_perda', 'outro',              'Outro motivo',                    null, 99, false, '{}'),

  ('tipo_interacao', 'ligacao',      'Ligação',        '#3E5C8A', 10, true, '{"contato": true}'),
  ('tipo_interacao', 'whatsapp',     'WhatsApp',       '#1F6E76', 20, true, '{"contato": true}'),
  ('tipo_interacao', 'email',        'E-mail',         '#6D5BA6', 30, true, '{"contato": true}'),
  ('tipo_interacao', 'videochamada', 'Videochamada',   '#285E31', 40, true, '{"contato": true}'),
  ('tipo_interacao', 'reuniao',      'Reunião presencial', '#7A8B2E', 50, true, '{"contato": true}'),
  ('tipo_interacao', 'nota',         'Nota interna',   '#A1A1AA', 90, true, '{"contato": false}'),

  ('tipo_compromisso', 'reuniao',     'Reunião',              '#1F6E76', 10, true, '{"icone": "users"}'),
  ('tipo_compromisso', 'audiencia',   'Audiência',            '#8E2C3D', 20, true, '{"icone": "gavel"}'),
  ('tipo_compromisso', 'atendimento', 'Atendimento',          '#3D7B3E', 30, true, '{"icone": "message"}'),
  ('tipo_compromisso', 'pericia',     'Perícia',              '#6D5BA6', 40, false, '{"icone": "stethoscope"}'),
  ('tipo_compromisso', 'compromisso', 'Compromisso interno',  '#52525B', 50, true, '{"icone": "calendar"}'),

  ('forma_pagamento', 'pix',            'Pix',                 null, 10, false, '{}'),
  ('forma_pagamento', 'boleto',         'Boleto',              null, 20, false, '{}'),
  ('forma_pagamento', 'transferencia',  'Transferência',       null, 30, false, '{}'),
  ('forma_pagamento', 'cartao_credito', 'Cartão de crédito',   null, 40, false, '{}'),
  ('forma_pagamento', 'cartao_debito',  'Cartão de débito',    null, 50, false, '{}'),
  ('forma_pagamento', 'dinheiro',       'Dinheiro',            null, 60, false, '{}'),
  ('forma_pagamento', 'outro',          'Outro',               null, 99, false, '{}'),

  ('forma_contratacao', 'a_vista',   'À vista',                 null, 10, false, '{}'),
  ('forma_contratacao', 'parcelado', 'Parcelado',               null, 20, false, '{}'),
  ('forma_contratacao', 'exito',     'Êxito',                   null, 30, false, '{}'),
  ('forma_contratacao', 'mensal',    'Mensal (recorrente)',     null, 40, false, '{}'),
  ('forma_contratacao', 'misto',     'Misto (fixo + êxito)',    null, 50, false, '{}'),

  ('tipo_parte', 'autor',               'Autor / requerente',        null, 10, false, '{}'),
  ('tipo_parte', 'impetrante',          'Impetrante',                null, 20, false, '{}'),
  ('tipo_parte', 'paciente',            'Paciente',                  null, 30, false, '{}'),
  ('tipo_parte', 'representante',       'Representante legal',       null, 40, false, '{}'),
  ('tipo_parte', 'reu',                 'Réu / requerido',           null, 50, false, '{}'),
  ('tipo_parte', 'autoridade_coatora',  'Autoridade coatora',        null, 60, false, '{}'),
  ('tipo_parte', 'impetrado',           'Pessoa jurídica interessada', null, 70, false, '{}'),
  ('tipo_parte', 'ministerio_publico',  'Ministério Público',        null, 80, false, '{}'),
  ('tipo_parte', 'terceiro',            'Terceiro interessado',      null, 90, false, '{}'),
  ('tipo_parte', 'advogado_contrario',  'Advogado da parte contrária', null, 95, false, '{}'),

  ('origem_prazo', 'intimacao_eletronica', 'Intimação eletrônica',     null, 10, false, '{}'),
  ('origem_prazo', 'publicacao_dje',       'Publicação no DJe',        null, 20, false, '{}'),
  ('origem_prazo', 'despacho',             'Despacho / decisão',       null, 30, false, '{}'),
  ('origem_prazo', 'audiencia',            'Audiência',                null, 40, false, '{}'),
  ('origem_prazo', 'ciencia_pessoal',      'Ciência pessoal',          null, 50, false, '{}'),
  ('origem_prazo', 'email',                'E-mail / comunicação',     null, 60, false, '{}'),
  ('origem_prazo', 'interno',              'Prazo interno',            null, 70, false, '{}'),
  ('origem_prazo', 'outro',                'Outro',                    null, 99, false, '{}'),

  ('tipo_andamento', 'despacho',  'Despacho',            null, 10, false, '{}'),
  ('tipo_andamento', 'decisao',   'Decisão',             null, 20, false, '{}'),
  ('tipo_andamento', 'liminar',   'Liminar',             null, 30, false, '{}'),
  ('tipo_andamento', 'sentenca',  'Sentença',            null, 40, false, '{}'),
  ('tipo_andamento', 'acordao',   'Acórdão',             null, 50, false, '{}'),
  ('tipo_andamento', 'peticao',   'Petição',             null, 60, false, '{}'),
  ('tipo_andamento', 'intimacao', 'Intimação',           null, 70, false, '{}'),
  ('tipo_andamento', 'audiencia', 'Audiência',           null, 80, false, '{}'),
  ('tipo_andamento', 'juntada',   'Juntada',             null, 90, false, '{}'),
  ('tipo_andamento', 'certidao',  'Certidão',            null, 95, false, '{}'),
  ('tipo_andamento', 'outro',     'Outro',               null, 99, false, '{}');

-- Etiquetas iniciais
insert into public.etiquetas (nome, cor, escopos) values
  ('Urgência médica', '#8E2C3D', '{lead,cliente,caso,tarefa}'),
  ('Menor de idade', '#6D5BA6', '{lead,cliente,caso}'),
  ('Já cultiva', '#3D7B3E', '{lead,cliente,caso}'),
  ('Retorno agendado', '#1F6E76', '{lead,tarefa}');

-- Categorias de documentos -------------------------------------------------------
insert into public.categorias_documento (id, nome, descricao, clinico, financeiro, cor, ordem) values
  ('00000000-0000-4000-8000-00000000c001', 'Identificação e representação', 'Documentos pessoais, procuração e representação legal.', false, false, '#3E5C8A', 10),
  ('00000000-0000-4000-8000-00000000c002', 'Histórico clínico e tratamento', 'Laudos, prescrições e documentos médicos (dados de saúde — acesso restrito).', true, false, '#8E2C3D', 20),
  ('00000000-0000-4000-8000-00000000c003', 'Contexto administrativo e econômico', 'Protocolos, requerimentos, negativas, orçamentos e comprovantes, conforme a medida.', false, false, '#C9822B', 30),
  ('00000000-0000-4000-8000-00000000c004', 'Preparação da ação', 'Minuta, revisão, custas/gratuidade, protocolo e decisões.', false, false, '#1F6E76', 40),
  ('00000000-0000-4000-8000-00000000c005', 'Financeiro contratual', 'Contrato de honorários, comprovantes e recibos (acesso com permissão financeira).', false, true, '#A68658', 50),
  ('00000000-0000-4000-8000-00000000c006', 'Vídeos e mídias', 'Vídeos e gravações relacionadas ao cliente ou caso.', false, false, '#6D5BA6', 60);

-- Modelo inicial de checklist (revisável) ------------------------------------------
insert into public.modelos_checklist (id, nome, descricao, aviso) values
  ('00000000-0000-4000-8000-00000000a001',
   'Checklist inicial — cannabis medicinal (modelo revisável)',
   'Modelo de partida para organizar a coleta de documentos. Duplique e adapte por tipo de demanda.',
   'Modelo inicial sugerido. Os itens NÃO são requisitos jurídicos universais: a equipe jurídica define o que é exigido para cada medida e para cada caso concreto.');

insert into public.modelos_checklist_grupos (id, modelo_id, nome, ordem) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001', 'Identificação e representação', 10),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a001', 'Histórico clínico e tratamento', 20),
  ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000a001', 'Contexto administrativo e econômico (conforme a medida)', 30),
  ('00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000a001', 'Preparação da ação', 40),
  ('00000000-0000-4000-8000-00000000b005', '00000000-0000-4000-8000-00000000a001', 'Financeiro contratual', 50);

insert into public.modelos_checklist_itens
  (modelo_id, grupo_id, categoria_id, nome, descricao_cliente, instrucao_equipe, obrigatoriedade, condicao, condicao_descricao,
   prazo_dias, revisor_tipo, etapa, validade_dias, cliente_pode_enviar, ordem)
values
  -- Identificação e representação
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001',
   'Documento de identidade com foto', 'Foto ou digitalização legível, frente e verso (RG, CNH ou outro documento oficial).',
   'Conferir legibilidade e validade; o nome deve coincidir com o das prescrições.', 'obrigatorio', null, null,
   5, 'responsavel_caso', 'Triagem', null, true, 10),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001',
   'CPF', 'Somente se o número do CPF não constar no documento de identidade.',
   'Dispensar quando o CPF constar do documento de identidade.', 'opcional', null, null,
   5, 'responsavel_caso', 'Triagem', null, true, 20),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001',
   'Comprovante de residência', 'Conta de consumo ou documento equivalente recente. Se estiver em nome de outra pessoa, avise a equipe.',
   'Verificar data e titularidade; se em nome de terceiro, avaliar declaração complementar.', 'obrigatorio', null, null,
   5, 'responsavel_caso', 'Triagem', null, true, 30),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001',
   'Procuração assinada', 'Enviaremos o modelo para assinatura. Depois de assinado, envie o arquivo por aqui.',
   'Gerar a procuração com os poderes adequados à medida escolhida.', 'obrigatorio', null, null,
   7, 'responsavel_caso', 'Contratação', null, true, 40),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001',
   'Documentos do responsável legal', 'Documento de identidade do responsável legal, quando o paciente for menor de idade ou representado.',
   'Aplicável quando houver representação legal. Conferir também o documento que comprova a representação.', 'condicional',
   '{"campo": "cliente.possui_representante", "operador": "igual", "valor": true}', 'Quando o cliente possui representante legal',
   5, 'responsavel_caso', 'Triagem', null, true, 50),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001',
   'Comprovação da representação', 'Certidão de nascimento, termo de guarda, curatela ou documento equivalente.',
   'Aplicável quando houver representação legal.', 'condicional',
   '{"campo": "cliente.possui_representante", "operador": "igual", "valor": true}', 'Quando o cliente possui representante legal',
   5, 'responsavel_caso', 'Triagem', null, true, 60),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c005',
   'Contrato de honorários assinado', 'Enviaremos o contrato para assinatura.',
   'Anexar a versão assinada. Os valores ficam no módulo Financeiro.', 'obrigatorio', null, null,
   7, 'responsavel_caso', 'Contratação', null, true, 70),

  -- Histórico clínico e tratamento (dados de saúde)
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000c002',
   'Laudo ou relatório médico', 'Relatório do(a) médico(a) que acompanha o tratamento, com histórico e indicação terapêutica.',
   'Conferir data, identificação e assinatura do profissional e a fundamentação. A validade sugerida é apenas um lembrete interno de atualização.',
   'obrigatorio', null, null, 10, 'responsavel_caso', 'Triagem', 180, true, 10),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000c002',
   'Prescrição médica atual', 'Receita atual com o produto, a concentração e a forma de uso.',
   'Conferir se a prescrição está atual e legível. Ajuste a validade conforme a orientação da equipe.', 'obrigatorio', null, null,
   10, 'responsavel_caso', 'Triagem', 180, true, 20),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000c002',
   'Histórico de tratamentos anteriores', 'Receitas, relatórios ou exames de tratamentos já realizados, se houver.',
   'Útil para demonstrar tentativas terapêuticas anteriores, quando pertinente.', 'opcional', null, null,
   15, 'responsavel_caso', 'Análise', null, true, 30),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000c002',
   'Outros documentos médicos pertinentes', 'Exames ou relatórios complementares que o(a) médico(a) indicar.',
   'Solicitar apenas o que for relevante para a medida.', 'opcional', null, null,
   15, 'responsavel_caso', 'Análise', null, true, 40),

  -- Contexto administrativo e econômico
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000c003',
   'Protocolos e requerimentos administrativos', 'Pedidos feitos ao plano de saúde, à Secretaria de Saúde ou a outros órgãos, se houver.',
   'Relevante principalmente para fornecimento de tratamento e mandado de segurança.', 'opcional', null, null,
   10, 'responsavel_caso', 'Análise', null, true, 10),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000c003',
   'Respostas ou negativas administrativas', 'Negativa por escrito, e-mail ou número de protocolo de atendimento.',
   'Definir com a equipe jurídica se é exigida para a medida escolhida.', 'opcional', null, null,
   10, 'responsavel_caso', 'Análise', null, true, 20),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000c003',
   'Documentos sobre o acesso ao tratamento', 'Autorizações, cadastros ou comprovantes de aquisição relacionados ao tratamento, se houver.',
   'Ex.: autorização de importação, vínculo com associação, notas de compra.', 'opcional', null, null,
   10, 'responsavel_caso', 'Análise', null, true, 30),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000c003',
   'Orçamentos do tratamento', 'Orçamentos de produtos, insumos ou importação.',
   'Quando pertinente para demonstrar custo do tratamento.', 'opcional', null, null,
   10, 'responsavel_caso', 'Análise', null, true, 40),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000c003',
   'Comprovantes econômicos pertinentes', 'Somente se a equipe solicitar (por exemplo, comprovantes de renda).',
   'Ex.: análise de gratuidade de justiça. Solicitar apenas quando necessário.', 'opcional', null, null,
   10, 'responsavel_caso', 'Análise', null, true, 50),

  -- Preparação da ação (uso interno)
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000c004',
   'Minuta da petição', null, 'Versão para revisão interna.', 'obrigatorio', null, null,
   15, 'responsavel_caso', 'Preparação da ação', null, false, 10),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000c004',
   'Documentos revisados e organizados', null, 'Conjunto final de documentos conferidos para o protocolo.', 'obrigatorio', null, null,
   18, 'responsavel_caso', 'Preparação da ação', null, false, 20),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000c004',
   'Comprovante de custas ou pedido de gratuidade', null, 'Quando aplicável à medida e ao juízo.', 'opcional', null, null,
   20, 'responsavel_caso', 'Protocolo', null, false, 30),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000c004',
   'Comprovante de protocolo', null, 'Anexar o comprovante e cadastrar o número do processo no caso.', 'obrigatorio', null, null,
   20, 'responsavel_caso', 'Protocolo', null, false, 40),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000c004',
   'Decisão (liminar, sentença ou acórdão)', null, 'Anexar quando proferida e lançar o andamento correspondente.', 'opcional', null, null,
   null, 'responsavel_caso', 'Decisão', null, false, 50),

  -- Financeiro contratual (acesso com permissão financeira)
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b005', '00000000-0000-4000-8000-00000000c005',
   'Comprovantes de pagamento', 'Comprovantes de pagamento dos honorários, se desejar enviar por aqui.',
   'Os lançamentos oficiais ficam no módulo Financeiro; aqui apenas o arquivo.', 'opcional', null, null,
   null, 'responsavel_caso', 'Financeiro', null, true, 10),
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b005', '00000000-0000-4000-8000-00000000c005',
   'Recibos emitidos', null, 'Recibos emitidos pelo escritório ao cliente.', 'opcional', null, null,
   null, 'responsavel_caso', 'Financeiro', null, false, 20);

-- Modelo inicial de tarefas: etapas de preparação da ação (revisável) ---------------
insert into public.modelos_tarefas (id, nome, descricao, itens) values
  ('00000000-0000-4000-8000-00000000d001',
   'Preparação da ação — etapas iniciais (modelo revisável)',
   'Sequência sugerida de tarefas internas. Ajuste prazos e responsáveis conforme a rotina do escritório.',
   '[
     {"id": "t1", "titulo": "Reunião inicial e levantamento do caso", "prazo_dias": 2, "prioridade": "alta", "responsavel": {"tipo": "responsavel_caso"}, "checklist": ["Confirmar a medida pretendida", "Registrar o resumo da reunião"]},
     {"id": "t2", "titulo": "Enviar solicitação de documentos ao cliente", "prazo_dias": 2, "prioridade": "alta", "responsavel": {"tipo": "responsavel_caso"}, "depende_de": "t1", "checklist": ["Aplicar/revisar o checklist do caso", "Gerar o link seguro de envio"]},
     {"id": "t3", "titulo": "Conferir documentos recebidos", "prazo_dias": 10, "prioridade": "media", "responsavel": {"tipo": "responsavel_caso"}, "depende_de": "t2"},
     {"id": "t4", "titulo": "Elaborar a minuta", "prazo_dias": 15, "prioridade": "alta", "responsavel": {"tipo": "responsavel_caso"}, "depende_de": "t3"},
     {"id": "t5", "titulo": "Revisar a minuta", "prazo_dias": 17, "prioridade": "alta", "responsavel": {"tipo": "perfil", "valor": "advogado"}, "depende_de": "t4"},
     {"id": "t6", "titulo": "Protocolar a ação e cadastrar o processo", "prazo_dias": 20, "prioridade": "urgente", "responsavel": {"tipo": "responsavel_caso"}, "depende_de": "t5", "checklist": ["Anexar comprovante de protocolo", "Cadastrar número do processo", "Cadastrar prazos, se houver"]}
   ]'::jsonb);

-- Tipos de demanda (vinculados ao checklist e ao modelo de tarefas iniciais) ---------
insert into public.tipos_demanda (nome, descricao, cor, ordem, modelo_checklist_id, modelo_tarefas_id) values
  ('Habeas corpus preventivo — cultivo medicinal', 'Salvo-conduto para cultivo de cannabis para fins medicinais.', '#3D7B3E', 10,
   '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000d001'),
  ('Mandado de segurança — cannabis medicinal', 'Mandado de segurança relacionado ao acesso ao tratamento com cannabis.', '#1F6E76', 20,
   '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000d001'),
  ('Fornecimento de tratamento — plano de saúde', 'Ação para custeio do tratamento pelo plano de saúde.', '#6D5BA6', 30,
   '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000d001'),
  ('Fornecimento de tratamento — SUS / Estado', 'Ação para fornecimento do tratamento pelo poder público.', '#3E5C8A', 40,
   '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000d001'),
  ('Amparo contra abusos e discriminação', 'Proteção jurídica relacionada a transporte, porte e abordagens.', '#B5532F', 50,
   '00000000-0000-4000-8000-00000000a001', null),
  ('Consultoria (prescritores, associações e empresas)', 'Assessoria e regularização.', '#A68658', 60, null, null),
  ('Outros', 'Demandas não classificadas.', '#52525B', 99, null, null);

-- Automações iniciais (somente avisos e tarefas internas) ----------------------------
insert into public.automacoes (tipo, nome, descricao, ativo, parametros) values
  ('lead_novo_primeiro_contato', 'Tarefa de primeiro contato para lead novo',
   'Cria uma tarefa de primeiro contato quando um lead chega. Opcionalmente define o responsável (fixo ou rodízio).',
   true, '{"prazo_horas": 24, "prioridade": "alta", "origens": [], "atribuir": {"modo": "nenhum"}}'),
  ('lead_parado', 'Alerta de lead parado',
   'Avisa o responsável quando um lead em etapa aberta fica sem movimentação.',
   true, '{"dias": 3, "etapas": []}'),
  ('documento_pendente', 'Aviso de documento pendente',
   'Avisa o responsável quando um documento obrigatório está solicitado há muitos dias ou com prazo interno vencido (no máximo um aviso por semana por documento).',
   true, '{"dias": 5}'),
  ('parcela_vencida', 'Destaque de parcela vencida',
   'Avisa quem pode ver o financeiro quando uma parcela vence sem quitação.',
   true, '{"dias_apos_vencimento": 0}'),
  ('tarefa_prazo', 'Aviso de tarefas próximas ou atrasadas',
   'Avisa o responsável quando uma tarefa está perto do prazo ou atrasada.',
   true, '{"horas_antes": 24, "avisar_vencidas": true}'),
  ('prazo_processual', 'Aviso de prazos processuais',
   'Usa os alertas configurados em cada prazo, avisa sobre prazos vencidos e sobre prazos aguardando conferência.',
   true, '{"avisar_vencidos": true, "avisar_nao_conferidos": true}'),
  ('documento_validade', 'Aviso de validade de laudos e prescrições',
   'Avisa quando um documento aprovado com validade definida está perto de vencer.',
   true, '{"dias_antes": 15}');

-- Configurações gerais --------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('painel', '{
     "indicadores": [
       {"id": "novos_leads", "visivel": true},
       {"id": "leads_sem_retorno", "visivel": true},
       {"id": "tarefas_hoje", "visivel": true},
       {"id": "tarefas_atrasadas", "visivel": true},
       {"id": "prazos_proximos", "visivel": true},
       {"id": "prazos_vencidos", "visivel": true},
       {"id": "prazos_nao_conferidos", "visivel": true},
       {"id": "reunioes_hoje", "visivel": true},
       {"id": "documentos_faltantes", "visivel": true},
       {"id": "documentos_revisar", "visivel": true},
       {"id": "casos_ativos", "visivel": true},
       {"id": "pagamentos_vencidos", "visivel": true}
     ],
     "horas_sem_retorno": 24,
     "dias_prazos_proximos": 7
   }', 'Indicadores exibidos no painel Hoje e sua ordem.'),
  ('nomenclaturas', '{
     "leads": "Leads", "lead": "Lead",
     "clientes": "Clientes", "cliente": "Cliente",
     "casos": "Casos e processos", "caso": "Caso",
     "tarefas": "Tarefas", "tarefa": "Tarefa",
     "agenda": "Agenda", "documentos": "Documentos", "financeiro": "Financeiro",
     "relatorios": "Relatórios", "hoje": "Hoje"
   }', 'Nomes exibidos no menu e nos títulos.'),
  ('textos', '{
     "portal_titulo": "Envio seguro de documentos",
     "portal_instrucoes": "Envie cada documento no item correspondente. Aceitamos PDF, fotos (JPG, PNG, HEIC) e vídeos curtos. Se tiver dúvidas, fale com a nossa equipe pelo WhatsApp.",
     "portal_rodape": "Seus arquivos ficam armazenados de forma privada e são acessados apenas pela equipe responsável pelo seu atendimento.",
     "mensagem_link_documentos": "Olá, {nome}! Para darmos andamento ao seu atendimento, envie os documentos pelo link seguro: {link} (válido até {validade}). Equipe Amado & Amado Jr.",
     "aviso_prazos": "O CRM não calcula prazos processuais de forma definitiva. O auxílio de contagem é apenas uma sugestão e todo prazo deve ser conferido e confirmado por profissional habilitado."
   }', 'Textos operacionais exibidos pelo sistema.'),
  ('aparencia', '{"destaque": "floresta", "densidade": "confortavel"}', 'Configurações visuais permitidas (mantêm a identidade do site).'),
  ('portal', '{"validade_dias_padrao": 7, "tamanho_maximo_mb": 25}', 'Portal de envio de documentos pelo cliente.'),
  ('prazos', '{"alertas_padrao": [5, 2, 1, 0], "hora_padrao": "23:59", "recesso": {"ativo": true, "inicio": "12-20", "fim": "01-20"}}',
   'Padrões para cadastro de prazos e parâmetros do auxílio de contagem (sempre sujeito a conferência).');

-- Feriados nacionais e datas forenses usuais (para o auxílio de contagem) ------------
-- Lista de apoio: confira o calendário oficial do tribunal competente.
insert into public.feriados (data, descricao, abrangencia) values
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval (segunda-feira) — verificar tribunal', 'forense'),
  ('2026-02-17', 'Carnaval (terça-feira) — verificar tribunal', 'forense'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi — verificar tribunal', 'forense'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2026-12-08', 'Dia da Justiça — verificar tribunal', 'forense'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-02-08', 'Carnaval (segunda-feira) — verificar tribunal', 'forense'),
  ('2027-02-09', 'Carnaval (terça-feira) — verificar tribunal', 'forense'),
  ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'),
  ('2027-05-01', 'Dia do Trabalho', 'nacional'),
  ('2027-05-27', 'Corpus Christi — verificar tribunal', 'forense'),
  ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2027-12-08', 'Dia da Justiça — verificar tribunal', 'forense'),
  ('2027-12-25', 'Natal', 'nacional');
