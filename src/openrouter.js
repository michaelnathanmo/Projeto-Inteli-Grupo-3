import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';

export function isAiAvailable() {
  return !!process.env.OPENROUTER_API_KEY;
}

export async function refineWithAi(projectData, projectHistory) {
  if (!isAiAvailable()) {
    throw new Error('OPENROUTER_API_KEY não configurada. O refinamento por IA está indisponível.');
  }

  const knowledgeBasePath = path.join(__dirname, '..', 'data', 'knowledge-base.json');
  const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

  const systemPrompt = buildSystemPrompt(knowledgeBase);
  const userPrompt = buildUserPrompt(projectData, projectHistory);

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Inteli Camp - Projeto 3',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });
  } catch (fetchError) {
    throw new Error(`Erro de conexão com o OpenRouter: ${fetchError.message}`);
  }

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = '(resposta não legível)';
    }
    throw new Error(`OpenRouter retornou erro ${response.status}: ${errorBody}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error(`Resposta inválida do OpenRouter: ${parseError.message}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Resposta do OpenRouter não contém conteúdo válido.');
  }

  let parsed;
  try {
    const cleaned = extractJson(content);
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(`Não foi possível interpretar a resposta da IA como JSON: ${parseError.message}`);
  }

  validateAiResponse(parsed);

  return parsed;
}

function buildSystemPrompt(knowledgeBase) {
  const valuesText = knowledgeBase.company.values.map(v =>
    `- ${v.name}: ${v.description}`
  ).join('\n');

  const audiencesText = knowledgeBase.targetAudiences.map(a =>
    `- ${a.segment}: ${a.profile}`
  ).join('\n');

  const criteriaText = knowledgeBase.marketingCriteria.map(c =>
    `- ${c.criterion}: ${c.question}`
  ).join('\n');

  const examplesText = knowledgeBase.previousProjects.map(p =>
    `- ${p.title}: ${p.description} (Resultado: ${p.result})`
  ).join('\n');

  const externalText = knowledgeBase.externalExamples.map(e =>
    `- ${e.company} - ${e.initiative}: ${e.lesson}`
  ).join('\n');

  const risksText = knowledgeBase.commonRisks.map(r => `- ${r}`).join('\n');

  return `Você é um analista de marketing consultivo da companhia aérea fictícia "${knowledgeBase.company.name}".

Você NÃO pode aprovar ou reprovar projetos. Seu papel é APENAS consultivo.

Sua função é estruturar ideias de forma profissional, organizada e alinhada aos valores da empresa.

## Valores da Empresa
${valuesText}

## Públicos-alvo
${audiencesText}

## Critérios de Marketing
${criteriaText}

## Projetos Anteriores (fictícios)
${examplesText}

## Exemplos de Mercado
${externalText}

## Riscos Comuns
${risksText}

## Regras Obrigatórias
1. Preserve a intenção original do solicitante.
2. Identifique o problema que está sendo resolvido.
3. Relacione a proposta com os valores da empresa.
4. Aponte informações ausentes de forma construtiva.
5. Aponte riscos e oportunidades.
6. Sugira métricas de acompanhamento.
7. Crie perguntas para o marketing.
8. Gere um texto refinado da proposta.
9. NÃO aprove, reprove ou tome decisões finais.
10. NÃO invente estatísticas, pesquisas ou custos.
11. NÃO diga que o marketing aprovou ou que a gerência autorizou.
12. Responda ESTRITAMENTE em JSON, sem texto adicional fora do JSON.

## Formato JSON Esperado
{
  "suggestedTitle": "string",
  "executiveSummary": "string",
  "identifiedProblem": "string",
  "targetAudience": "string",
  "valueProposition": "string",
  "companyAlignment": [
    { "criterion": "string", "analysis": "string" }
  ],
  "missingInformation": ["string"],
  "risks": ["string"],
  "opportunities": ["string"],
  "suggestedMetrics": ["string"],
  "questionsForMarketing": ["string"],
  "refinedProposal": "string"
}`;
}

function buildUserPrompt(projectData, projectHistory) {
  const historyText = projectHistory && projectHistory.length > 0
    ? projectHistory.map((v, i) =>
      `[Versão ${v.version_number} - ${v.source} - ${v.created_by} - ${v.created_at}]\n${typeof v.content === 'string' ? v.content : JSON.stringify(v.content, null, 2)}`
    ).join('\n\n')
    : 'Nenhum histórico disponível.';

  return `## Ideia do Solicitante
Título: ${projectData.title}
Solicitante: ${projectData.requester}
Vertical: ${projectData.businessUnit}
Problema identificado: ${projectData.problem}
Descrição da ideia: ${projectData.idea}
Benefício esperado: ${projectData.expectedBenefit}
Usuários impactados: ${projectData.targetUsers}
Prazo estimado: ${projectData.estimatedDeadline || 'Não informado'}

## Histórico da Proposta
${historyText}

Analise esta ideia seguindo as regras estabelecidas e retorne APENAS o JSON no formato especificado.`;
}

function extractJson(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return text;
}

function validateAiResponse(data) {
  const required = [
    'suggestedTitle',
    'executiveSummary',
    'identifiedProblem',
    'targetAudience',
    'valueProposition',
    'companyAlignment',
    'missingInformation',
    'risks',
    'opportunities',
    'suggestedMetrics',
    'questionsForMarketing',
    'refinedProposal',
  ];

  const missing = required.filter(field => {
    const val = data[field];
    return val === undefined || val === null || val === '';
  });

  if (missing.length > 0) {
    throw new Error(`Resposta da IA incompleta. Campos ausentes: ${missing.join(', ')}`);
  }

  if (!Array.isArray(data.companyAlignment)) {
    throw new Error('companyAlignment deve ser um array.');
  }
  if (!Array.isArray(data.missingInformation)) {
    throw new Error('missingInformation deve ser um array.');
  }
  if (!Array.isArray(data.risks)) {
    throw new Error('risks deve ser um array.');
  }
  if (!Array.isArray(data.opportunities)) {
    throw new Error('opportunities deve ser um array.');
  }
  if (!Array.isArray(data.suggestedMetrics)) {
    throw new Error('suggestedMetrics deve ser um array.');
  }
  if (!Array.isArray(data.questionsForMarketing)) {
    throw new Error('questionsForMarketing deve ser um array.');
  }
}
