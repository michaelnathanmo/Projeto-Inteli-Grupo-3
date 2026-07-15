import { getDb } from './db.js';
import { refineWithAi, isAiAvailable } from './openrouter.js';

export function createProject(data) {
  const db = getDb();
  const content = JSON.stringify({
    title: data.title,
    requester: data.requester,
    businessUnit: data.businessUnit,
    problem: data.problem,
    idea: data.idea,
    expectedBenefit: data.expectedBenefit,
    targetUsers: data.targetUsers,
    estimatedDeadline: data.estimatedDeadline || '',
  });

  const insertProject = db.prepare(`
    INSERT INTO projects (title, requester, business_unit, status)
    VALUES (?, ?, ?, 'RASCUNHO')
  `);

  const insertVersion = db.prepare(`
    INSERT INTO project_versions (project_id, version_number, content, source, created_by, change_description)
    VALUES (?, 1, ?, 'REQUESTER_CREATION', ?, 'Ideia original criada pelo solicitante')
  `);

  const updateProjectVersion = db.prepare(`
    UPDATE projects SET current_version_id = ?, updated_at = datetime('now') WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const projectResult = insertProject.run(data.title, data.requester, data.businessUnit);
    const projectId = projectResult.lastInsertRowid;
    const versionResult = insertVersion.run(projectId, content, data.requester);
    const versionId = versionResult.lastInsertRowid;
    updateProjectVersion.run(versionId, projectId);
    return projectId;
  });

  const projectId = transaction();
  return getProject(projectId);
}

export function getProjects(statusFilter) {
  const db = getDb();
  let query = `
    SELECT p.*, pv.content as current_content, pv.version_number as current_version_number
    FROM projects p
    LEFT JOIN project_versions pv ON p.current_version_id = pv.id
  `;
  const params = [];

  if (statusFilter) {
    if (Array.isArray(statusFilter)) {
      query += ` WHERE p.status IN (${statusFilter.map(() => '?').join(',')})`;
      params.push(...statusFilter);
    } else {
      query += ` WHERE p.status = ?`;
      params.push(statusFilter);
    }
  }

  query += ` ORDER BY p.updated_at DESC`;

  const rows = db.prepare(query).all(...params);
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    requester: row.requester,
    businessUnit: row.business_unit,
    status: row.status,
    currentVersionId: row.current_version_id,
    currentVersionNumber: row.current_version_number,
    marketingSubmittedVersionId: row.marketing_submitted_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getProject(projectId) {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.*, pv.content as current_content, pv.version_number as current_version_number
    FROM projects p
    LEFT JOIN project_versions pv ON p.current_version_id = pv.id
    WHERE p.id = ?
  `).get(projectId);

  if (!project) return null;

  const versions = db.prepare(`
    SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number ASC
  `).all(projectId);

  const feedback = db.prepare(`
    SELECT * FROM marketing_feedback WHERE project_id = ? ORDER BY created_at ASC
  `).all(projectId);

  const decisions = db.prepare(`
    SELECT * FROM management_decisions WHERE project_id = ? ORDER BY created_at ASC
  `).all(projectId);

  return {
    id: project.id,
    title: project.title,
    requester: project.requester,
    businessUnit: project.business_unit,
    status: project.status,
    currentVersionId: project.current_version_id,
    currentVersionNumber: project.current_version_number,
    currentContent: project.current_content ? tryParseJson(project.current_content) : null,
    marketingSubmittedVersionId: project.marketing_submitted_version_id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    versions: versions.map(v => ({
      id: v.id,
      versionNumber: v.version_number,
      content: tryParseJson(v.content),
      source: v.source,
      createdBy: v.created_by,
      changeDescription: v.change_description,
      createdAt: v.created_at,
    })),
    feedback: feedback.map(f => ({
      id: f.id,
      reviewedVersionId: f.reviewed_version_id,
      author: f.author,
      generalComments: f.general_comments,
      positivePoints: f.positive_points,
      attentionPoints: f.attention_points,
      recommendations: f.recommendations,
      communicationSuggestions: f.communication_suggestions,
      imageRisks: f.image_risks,
      audienceConsiderations: f.audience_considerations,
      requesterResponse: f.requester_response,
      hasConsiderations: !!f.has_considerations,
      createdAt: f.created_at,
    })),
    decisions: decisions.map(d => ({
      id: d.id,
      evaluatedVersionId: d.evaluated_version_id,
      manager: d.manager,
      decision: d.decision,
      justification: d.justification,
      createdAt: d.created_at,
    })),
  };
}

export async function refineProject(projectId) {
  if (!isAiAvailable()) {
    throw new Error('OPENROUTER_API_KEY não configurada. O refinamento por IA está indisponível.');
  }

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  if (project.status !== 'RASCUNHO' && project.status !== 'AGUARDANDO_REVISAO_DO_SOLICITANTE') {
    throw { status: 400, message: 'Projeto não está em estado válido para refinamento por IA.' };
  }

  const versions = db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number ASC').all(projectId);
  const latestVersion = versions[versions.length - 1];
  const projectData = latestVersion ? tryParseJson(latestVersion.content) : {};

  const updateStatus = db.prepare("UPDATE projects SET status = 'PROCESSANDO_COM_IA', updated_at = datetime('now') WHERE id = ?");
  updateStatus.run(projectId);

  let aiResult;
  try {
    aiResult = await refineWithAi(projectData, versions.map(v => ({
      version_number: v.version_number,
      source: v.source,
      created_by: v.created_by,
      created_at: v.created_at,
      content: v.content,
    })));
  } catch (aiError) {
    db.prepare("UPDATE projects SET status = 'ERRO_NO_PROCESSAMENTO_DA_IA', updated_at = datetime('now') WHERE id = ?").run(projectId);
    throw aiError;
  }

  const newContent = JSON.stringify({
    ...projectData,
    title: aiResult.suggestedTitle || projectData.title,
    aiAnalysis: aiResult,
  });

  const nextVersion = versions.length + 1;

  const insertVersion = db.prepare(`
    INSERT INTO project_versions (project_id, version_number, content, source, created_by, change_description)
    VALUES (?, ?, ?, 'AI_REFINEMENT', 'AGENTE_IA', 'Refinamento e estruturação pela inteligência artificial')
  `);

  const updateProject = db.prepare(`
    UPDATE projects SET current_version_id = ?, status = 'AGUARDANDO_REVISAO_DO_SOLICITANTE', updated_at = datetime('now') WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const versionResult = insertVersion.run(projectId, nextVersion, newContent);
    const versionId = versionResult.lastInsertRowid;
    updateProject.run(versionId, projectId);
    return versionId;
  });

  transaction();
  return getProject(projectId);
}

export function createVersion(projectId, content, createdBy, source, changeDescription) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  const validSources = ['REQUESTER_EDIT', 'REQUESTER_EDIT_AFTER_MARKETING', 'REQUESTER_CREATION'];
  if (!validSources.includes(source)) {
    throw { status: 400, message: `Origem inválida: ${source}. Use uma das: ${validSources.join(', ')}` };
  }

  if (source === 'REQUESTER_EDIT_AFTER_MARKETING') {
    if (project.status !== 'FEEDBACK_DO_MARKETING_DISPONIVEL' && project.status !== 'SEM_CONSIDERACOES_DO_MARKETING') {
      throw { status: 400, message: 'Projeto não está em estado que permita edição após feedback do marketing.' };
    }
  } else   if (source === 'REQUESTER_EDIT') {
    const allowed = ['RASCUNHO', 'AGUARDANDO_REVISAO_DO_SOLICITANTE', 'AJUSTES_SOLICITADOS_PELA_GERENCIA'];
    if (!allowed.includes(project.status)) {
      throw { status: 400, message: `Projeto não pode ser editado no status atual: ${project.status}.` };
    }
  }

  const versions = db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number ASC').all(projectId);
  const nextVersion = versions.length + 1;

  const insertVersion = db.prepare(`
    INSERT INTO project_versions (project_id, version_number, content, source, created_by, change_description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const newStatus = source === 'REQUESTER_EDIT_AFTER_MARKETING' ? 'EM_REVISAO_PELO_SOLICITANTE' : 'AGUARDANDO_REVISAO_DO_SOLICITANTE';

  const updateProject = db.prepare(`
    UPDATE projects SET current_version_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const versionResult = insertVersion.run(projectId, nextVersion, JSON.stringify(content), source, createdBy, changeDescription || '');
    const versionId = versionResult.lastInsertRowid;
    updateProject.run(versionId, newStatus, projectId);
    return versionId;
  });

  transaction();
  return getProject(projectId);
}

export function submitToMarketing(projectId, versionId) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  const allowedSubmitStatuses = ['RASCUNHO', 'AGUARDANDO_REVISAO_DO_SOLICITANTE'];
  if (!allowedSubmitStatuses.includes(project.status)) {
    throw { status: 400, message: `Projeto não pode ser enviado ao marketing no status atual: ${project.status}.` };
  }

  const version = db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(versionId, projectId);
  if (!version) {
    throw { status: 404, message: 'Versão não encontrada para este projeto.' };
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE projects SET status = 'SUBMETIDO_AO_MARKETING', marketing_submitted_version_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(versionId, projectId);
  });

  transaction();
  return getProject(projectId);
}

export function registerMarketingFeedback(projectId, data) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  if (project.status !== 'SUBMETIDO_AO_MARKETING' && project.status !== 'EM_ANALISE_PELO_MARKETING') {
    throw { status: 400, message: 'Projeto não está submetido ao marketing.' };
  }

  const version = db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(data.reviewedVersionId, projectId);
  if (!version) {
    throw { status: 404, message: 'Versão revisada não encontrada para este projeto.' };
  }

  const hasConsiderations = data.hasConsiderations !== false;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO marketing_feedback
        (project_id, reviewed_version_id, author, general_comments, positive_points, attention_points, recommendations, communication_suggestions, image_risks, audience_considerations, has_considerations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      data.reviewedVersionId,
      data.author,
      data.generalComments || null,
      data.positivePoints || null,
      data.attentionPoints || null,
      data.recommendations || null,
      data.communicationSuggestions || null,
      data.imageRisks || null,
      data.audienceConsiderations || null,
      hasConsiderations ? 1 : 0,
    );

    const newStatus = hasConsiderations ? 'FEEDBACK_DO_MARKETING_DISPONIVEL' : 'SEM_CONSIDERACOES_DO_MARKETING';
    db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, projectId);
  });

  transaction();
  return getProject(projectId);
}

export function submitToManagement(projectId, versionId, requesterResponse) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  const allowed = ['FEEDBACK_DO_MARKETING_DISPONIVEL', 'SEM_CONSIDERACOES_DO_MARKETING', 'EM_REVISAO_PELO_SOLICITANTE', 'AJUSTES_SOLICITADOS_PELA_GERENCIA'];
  if (!allowed.includes(project.status)) {
    throw { status: 400, message: `Projeto não pode ser enviado à gerência no status atual: ${project.status}.` };
  }

  if (versionId) {
    const version = db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(versionId, projectId);
    if (!version) {
      throw { status: 404, message: 'Versão não encontrada para este projeto.' };
    }
  }

  const transaction = db.transaction(() => {
    if (requesterResponse) {
      const latestFeedback = db.prepare('SELECT id FROM marketing_feedback WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
      if (latestFeedback) {
        db.prepare('UPDATE marketing_feedback SET requester_response = ? WHERE id = ?').run(JSON.stringify(requesterResponse), latestFeedback.id);
      }
    }

    if (versionId) {
      db.prepare("UPDATE projects SET current_version_id = ?, updated_at = datetime('now') WHERE id = ?").run(versionId, projectId);
    }

    db.prepare("UPDATE projects SET status = 'PRONTO_PARA_AVALIACAO_GERENCIAL', updated_at = datetime('now') WHERE id = ?").run(projectId);
  });

  transaction();
  return getProject(projectId);
}

export function registerManagementDecision(projectId, data) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  if (project.status !== 'PRONTO_PARA_AVALIACAO_GERENCIAL') {
    throw { status: 400, message: 'Projeto não está pronto para avaliação gerencial.' };
  }

  const version = db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(data.evaluatedVersionId, projectId);
  if (!version) {
    throw { status: 404, message: 'Versão avaliada não encontrada para este projeto.' };
  }

  const decisionMap = {
    'AUTORIZAR': 'AUTORIZADO_PARA_PROSSEGUIR',
    'AJUSTES': 'AJUSTES_SOLICITADOS_PELA_GERENCIA',
    'ENCERRAR': 'ENCERRADO_PELA_GERENCIA',
  };

  const newStatus = decisionMap[data.decision];
  if (!newStatus) {
    throw { status: 400, message: 'Decisão inválida.' };
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO management_decisions (project_id, evaluated_version_id, manager, decision, justification)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, data.evaluatedVersionId, data.manager, data.decision, data.justification || null);

    db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, projectId);
  });

  transaction();
  return getProject(projectId);
}

export function archiveProject(projectId) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    throw { status: 404, message: 'Projeto não encontrado.' };
  }

  const allowed = ['AGUARDANDO_REVISAO_DO_SOLICITANTE', 'RASCUNHO'];
  if (!allowed.includes(project.status)) {
    throw { status: 400, message: `Projeto não pode ser arquivado no status atual: ${project.status}.` };
  }

  db.prepare("UPDATE projects SET status = 'ARQUIVADO_PELO_SOLICITANTE', updated_at = datetime('now') WHERE id = ?").run(projectId);
  return getProject(projectId);
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export function seedDemoData() {
  const demoProjects = [
    {
      title: 'Embarque facilitado para famílias',
      requester: 'Equipe de Operações',
      businessUnit: 'Operações aeroportuárias',
      problem: 'Famílias com crianças pequenas enfrentam dificuldades no embarque, causando estresse e atrasos nas conexões.',
      idea: 'Criar um processo diferenciado para famílias com crianças pequenas, oferecendo orientações antecipadas por email e um canal de embarque prioritário.',
      expectedBenefit: 'Redução do estresse das famílias, agilidade no embarque e melhoria da experiência do cliente.',
      targetUsers: 'Famílias com crianças de até 5 anos que utilizam voos nacionais.',
      estimatedDeadline: '3 meses',
    },
    {
      title: 'App de acompanhamento de manutenção',
      requester: 'João da Silva',
      businessUnit: 'Manutenção',
      problem: 'Técnicos de manutenção não têm acesso rápido ao histórico de reparos das aeronaves em campo.',
      idea: 'Desenvolver um aplicativo mobile que centralize o histórico de manutenção, checklist digital e notificações de peças.',
      expectedBenefit: 'Redução do tempo de diagnóstico e aumento da precisão dos reparos.',
      targetUsers: 'Técnicos de manutenção e engenheiros de frota.',
      estimatedDeadline: '6 meses',
    },
    {
      title: 'Chatbot para remarcação de voos',
      requester: 'Central de Atendimento',
      businessUnit: 'Atendimento ao cliente',
      problem: 'Alto volume de chamadas para remarcação de voos em situações de mau tempo, gerando filas e insatisfação.',
      idea: 'Implementar um chatbot no WhatsApp e no site que permita remarcação autônoma de voos sem falar com atendente.',
      expectedBenefit: 'Redução de 40% das chamadas de remarcação e agilidade no atendimento.',
      targetUsers: 'Passageiros com voos nacionais que precisam remarcar.',
      estimatedDeadline: '4 meses',
    },
    {
      title: 'Programa de reciclagem de resíduos de bordo',
      requester: 'Equipe de Sustentabilidade',
      businessUnit: 'Logística',
      problem: 'Grande volume de resíduos recicláveis gerados nos voos não é separado adequadamente.',
      idea: 'Criar um programa de separação de resíduos a bordo com parceria de cooperativas nos aeroportos de destino.',
      expectedBenefit: 'Redução de impacto ambiental e fortalecimento da imagem sustentável da empresa.',
      targetUsers: 'Tripulantes, passageiros e comunidades locais.',
      estimatedDeadline: '8 meses',
    },
  ];

  const ids = [];
  for (const data of demoProjects) {
    const project = createProject(data);
    ids.push(project.id);
  }
  return ids;
}
