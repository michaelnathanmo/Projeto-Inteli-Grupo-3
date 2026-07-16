import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db.js';
import {
  createProject,
  getProjects,
  getProject,
  refineProject,
  createVersion,
  submitToMarketing,
  registerMarketingFeedback,
  submitToManagement,
  registerManagementDecision,
  archiveProject,
  seedDemoData,
} from './project-service.js';
import {
  validateCreateProject,
  validateCreateVersion,
  validateMarketingFeedback,
  validateManagementDecision,
} from './validation.js';
import { isAiAvailable } from './openrouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/logos', express.static(path.join(__dirname, '..', 'logos')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize database on startup
getDb();

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiAvailable: isAiAvailable(),
    timestamp: new Date().toISOString(),
  });
});

// List projects
app.get('/api/projects', (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? status.split(',') : undefined;
    const projects = getProjects(filter);
    res.json(projects);
  } catch (err) {
    console.error('Erro ao listar projetos:', err);
    res.status(500).json({ error: 'Erro interno ao listar projetos.' });
  }
});

// Create project
app.post('/api/projects', (req, res) => {
  try {
    const errors = validateCreateProject(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }
    const project = createProject(req.body);
    res.status(201).json(project);
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    res.status(500).json({ error: 'Erro interno ao criar projeto.' });
  }
});

// Get project by ID
app.get('/api/projects/:projectId', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }
    const project = getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado.' });
    }
    res.json(project);
  } catch (err) {
    console.error('Erro ao buscar projeto:', err);
    res.status(500).json({ error: 'Erro interno ao buscar projeto.' });
  }
});

// Refine with AI
app.post('/api/projects/:projectId/refine', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    if (!isAiAvailable()) {
      return res.status(503).json({ error: 'OPENROUTER_API_KEY não configurada. Configure no .env.' });
    }

    const project = await refineProject(projectId);
    res.json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro no refinamento por IA:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao processar refinamento por IA.' });
  }
});

// Create new version (edit)
app.post('/api/projects/:projectId/versions', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    const errors = validateCreateVersion(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const source = req.body.source || 'REQUESTER_EDIT';
    const project = createVersion(projectId, req.body.content, req.body.createdBy, source, req.body.changeDescription);
    res.status(201).json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro ao criar versão:', err);
    res.status(500).json({ error: 'Erro interno ao criar versão.' });
  }
});

// Submit to marketing
app.post('/api/projects/:projectId/submit-marketing', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    const { versionId } = req.body;
    if (!versionId) {
      return res.status(400).json({ error: 'ID da versão é obrigatório.' });
    }

    const project = submitToMarketing(projectId, versionId);
    res.json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro ao submeter ao marketing:', err);
    res.status(500).json({ error: 'Erro interno ao submeter ao marketing.' });
  }
});

// Marketing feedback
app.post('/api/projects/:projectId/marketing-feedback', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    const errors = validateMarketingFeedback(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const project = registerMarketingFeedback(projectId, req.body);
    res.json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro ao registrar feedback:', err);
    res.status(500).json({ error: 'Erro interno ao registrar feedback.' });
  }
});

// Submit to management
app.post('/api/projects/:projectId/submit-management', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    const project = submitToManagement(projectId, req.body.versionId, req.body.requesterResponse);
    res.json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro ao submeter à gerência:', err);
    res.status(500).json({ error: 'Erro interno ao submeter à gerência.' });
  }
});

// Management decision
app.post('/api/projects/:projectId/management-decision', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    const errors = validateManagementDecision(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const project = registerManagementDecision(projectId, req.body);
    res.json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro ao registrar decisão:', err);
    res.status(500).json({ error: 'Erro interno ao registrar decisão.' });
  }
});

// Archive project
app.post('/api/projects/:projectId/archive', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID do projeto inválido.' });
    }

    const project = archiveProject(projectId);
    res.json(project);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Erro ao arquivar projeto:', err);
    res.status(500).json({ error: 'Erro interno ao arquivar projeto.' });
  }
});

// Seed demo data
app.post('/api/seed', (req, res) => {
  try {
    const ids = seedDemoData();
    res.json({ message: 'Dados de demonstração criados.', projectIds: ids });
  } catch (err) {
    console.error('Erro ao criar dados de demonstração:', err);
    res.status(500).json({ error: 'Erro ao criar dados de demonstração.' });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Rota não encontrada.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`IA disponível: ${isAiAvailable() ? 'Sim (OpenRouter)' : 'Não (configure OPENROUTER_API_KEY no .env)'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
