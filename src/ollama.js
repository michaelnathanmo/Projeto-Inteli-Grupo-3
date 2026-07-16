import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'qwen2:0.5b';

export async function isOllamaAvailable() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function refineWithOllama(projectData, projectHistory) {
  const knowledgeBasePath = path.join(__dirname, '..', 'data', 'knowledge-base.json');
  const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

  const systemPrompt = buildSystemPrompt(knowledgeBase);
  const userPrompt = buildUserPrompt(projectData, projectHistory);

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      options: { temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama retornou erro ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.message?.content;
  if (!content) {
    throw new Error('Resposta do Ollama não contém conteúdo válido.');
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

function buildSystemPrompt(kb) {
  const valuesText = kb.company.values.map(v => `- ${v.name}: ${v.description}`).join('\n');

  return `Você é um analista de marketing consultivo da companhia aérea fictícia "${kb.company.name}".

Valores da empresa:
${valuesText}

Analise a ideia do solicitante seguindo estas regras:
1. Preserve a intenção original.
2. Aponte problema, público-alvo e proposta de valor.
3. Relacione a ideia com os valores da empresa.
4. Aponte riscos, oportunidades e métricas.
5. Sugira perguntas para o marketing.
6. NÃO aprove, reprove ou invente dados.
7. Responda APENAS em JSON válido, sem texto extra.

JSON esperado:
{
  "suggestedTitle": "string",
  "executiveSummary": "string",
  "identifiedProblem": "string",
  "targetAudience": "string",
  "valueProposition": "string",
  "companyAlignment": [{"criterion":"string","analysis":"string"}],
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
  if (jsonMatch) return jsonMatch[0];
  return text;
}

function validateAiResponse(data) {
  const required = [
    'suggestedTitle', 'executiveSummary', 'identifiedProblem',
    'targetAudience', 'valueProposition', 'companyAlignment',
    'missingInformation', 'risks', 'opportunities',
    'suggestedMetrics', 'questionsForMarketing', 'refinedProposal',
  ];
  const missing = required.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
  if (missing.length > 0) {
    throw new Error(`Resposta da IA incompleta. Campos ausentes: ${missing.join(', ')}`);
  }
  if (!Array.isArray(data.companyAlignment)) throw new Error('companyAlignment deve ser um array.');
  if (!Array.isArray(data.missingInformation)) throw new Error('missingInformation deve ser um array.');
  if (!Array.isArray(data.risks)) throw new Error('risks deve ser um array.');
  if (!Array.isArray(data.opportunities)) throw new Error('opportunities deve ser um array.');
  if (!Array.isArray(data.suggestedMetrics)) throw new Error('suggestedMetrics deve ser um array.');
  if (!Array.isArray(data.questionsForMarketing)) throw new Error('questionsForMarketing deve ser um array.');
}
