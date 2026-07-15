export function validateCreateProject(body) {
  const errors = [];
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push('Título é obrigatório.');
  }
  if (!body.requester || typeof body.requester !== 'string' || body.requester.trim().length === 0) {
    errors.push('Nome do solicitante é obrigatório.');
  }
  if (!body.businessUnit || typeof body.businessUnit !== 'string' || body.businessUnit.trim().length === 0) {
    errors.push('Vertical ou unidade de negócio é obrigatória.');
  }
  if (!body.problem || typeof body.problem !== 'string' || body.problem.trim().length === 0) {
    errors.push('Problema identificado é obrigatório.');
  }
  if (!body.idea || typeof body.idea !== 'string' || body.idea.trim().length === 0) {
    errors.push('Descrição da ideia bruta é obrigatória.');
  }
  if (!body.expectedBenefit || typeof body.expectedBenefit !== 'string' || body.expectedBenefit.trim().length === 0) {
    errors.push('Benefício esperado é obrigatório.');
  }
  if (!body.targetUsers || typeof body.targetUsers !== 'string' || body.targetUsers.trim().length === 0) {
    errors.push('Possíveis usuários impactados é obrigatório.');
  }
  return errors;
}

export function validateCreateVersion(body) {
  const errors = [];
  if (!body.content || typeof body.content !== 'object') {
    errors.push('Conteúdo da versão é obrigatório.');
  }
  if (!body.createdBy || typeof body.createdBy !== 'string' || body.createdBy.trim().length === 0) {
    errors.push('Autor da versão é obrigatório.');
  }
  return errors;
}

export function validateMarketingFeedback(body) {
  const errors = [];
  if (!body.author || typeof body.author !== 'string' || body.author.trim().length === 0) {
    errors.push('Nome do analista de marketing é obrigatório.');
  }
  return errors;
}

export function validateManagementDecision(body) {
  const errors = [];
  if (!body.manager || typeof body.manager !== 'string' || body.manager.trim().length === 0) {
    errors.push('Nome do gerente é obrigatório.');
  }
  if (!body.decision || !['AUTORIZAR', 'AJUSTES', 'ENCERRAR'].includes(body.decision)) {
    errors.push('Decisão deve ser AUTORIZAR, AJUSTES ou ENCERRAR.');
  }
  if (body.decision === 'ENCERRAR' && (!body.justification || typeof body.justification !== 'string' || body.justification.trim().length === 0)) {
    errors.push('Justificativa é obrigatória para encerrar o projeto.');
  }
  if (body.decision === 'AJUSTES' && (!body.justification || typeof body.justification !== 'string' || body.justification.trim().length === 0)) {
    errors.push('Justificativa é obrigatória ao solicitar ajustes.');
  }
  return errors;
}

const VALID_STATUSES = [
  'RASCUNHO',
  'PROCESSANDO_COM_IA',
  'AGUARDANDO_REVISAO_DO_SOLICITANTE',
  'EM_EDICAO',
  'SUBMETIDO_AO_MARKETING',
  'EM_ANALISE_PELO_MARKETING',
  'FEEDBACK_DO_MARKETING_DISPONIVEL',
  'SEM_CONSIDERACOES_DO_MARKETING',
  'EM_REVISAO_PELO_SOLICITANTE',
  'PRONTO_PARA_AVALIACAO_GERENCIAL',
  'EM_AVALIACAO_GERENCIAL',
  'AJUSTES_SOLICITADOS_PELA_GERENCIA',
  'AUTORIZADO_PARA_PROSSEGUIR',
  'ENCERRADO_PELA_GERENCIA',
  'ARQUIVADO_PELO_SOLICITANTE',
  'ERRO_NO_PROCESSAMENTO_DA_IA',
];

export function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}
