// State
const state = {
  user: null,
  projects: [],
  currentProject: null,
  filter: 'all',
  loading: false,
};

// Status labels in Portuguese
const STATUS_LABELS = {
  RASCUNHO: 'Rascunho',
  PROCESSANDO_COM_IA: 'Processando com IA',
  AGUARDANDO_REVISAO_DO_SOLICITANTE: 'Aguardando revisão do solicitante',
  EM_EDICAO: 'Em edição',
  SUBMETIDO_AO_MARKETING: 'Submetido ao marketing',
  EM_ANALISE_PELO_MARKETING: 'Em análise pelo marketing',
  FEEDBACK_DO_MARKETING_DISPONIVEL: 'Feedback do marketing disponível',
  SEM_CONSIDERACOES_DO_MARKETING: 'Sem considerações do marketing',
  EM_REVISAO_PELO_SOLICITANTE: 'Em revisão pelo solicitante',
  PRONTO_PARA_AVALIACAO_GERENCIAL: 'Pronto para avaliação gerencial',
  EM_AVALIACAO_GERENCIAL: 'Em avaliação gerencial',
  AJUSTES_SOLICITADOS_PELA_GERENCIA: 'Ajustes solicitados pela gerência',
  AUTORIZADO_PARA_PROSSEGUIR: 'Autorizado para prosseguir',
  ENCERRADO_PELA_GERENCIA: 'Encerrado pela gerência',
  ARQUIVADO_PELO_SOLICITANTE: 'Arquivado pelo solicitante',
  ERRO_NO_PROCESSAMENTO_DA_IA: 'Erro no processamento da IA',
};

const ROLE_LABELS = {
  requester: 'Solicitante',
  marketing: 'Marketing',
  management: 'Gerência',
};

// Source labels
const SOURCE_LABELS = {
  REQUESTER_CREATION: 'Criação do solicitante',
  AI_REFINEMENT: 'Refinamento por IA',
  REQUESTER_EDIT: 'Edição do solicitante',
  REQUESTER_EDIT_AFTER_MARKETING: 'Edição após feedback do marketing',
};

// Flow steps for visualization
const FLOW_STEPS = [
  { key: 'criada', label: 'Ideia criada' },
  { key: 'ia', label: 'Estruturada pela IA' },
  { key: 'revisada', label: 'Revisada' },
  { key: 'marketing', label: 'Enviada ao marketing' },
  { key: 'feedback', label: 'Feedback disponível' },
  { key: 'gerencia', label: 'Encaminhada à gerência' },
  { key: 'decisao', label: 'Decisão registrada' },
];

function getFlowStep(project) {
  const status = project.status;
  const steps = ['criada'];
  if (status === 'RASCUNHO') return { current: 0, steps: steps };
  steps.push('ia');
  if (['PROCESSANDO_COM_IA', 'ERRO_NO_PROCESSAMENTO_DA_IA'].includes(status)) return { current: 1, steps };
  steps.push('revisada');
  if (['AGUARDANDO_REVISAO_DO_SOLICITANTE', 'EM_EDICAO', 'ARQUIVADO_PELO_SOLICITANTE'].includes(status)) return { current: 2, steps };
  steps.push('marketing');
  if (['SUBMETIDO_AO_MARKETING', 'EM_ANALISE_PELO_MARKETING'].includes(status)) return { current: 3, steps };
  steps.push('feedback');
  if (['FEEDBACK_DO_MARKETING_DISPONIVEL', 'SEM_CONSIDERACOES_DO_MARKETING', 'EM_REVISAO_PELO_SOLICITANTE'].includes(status)) return { current: 4, steps };
  steps.push('gerencia');
  if (['PRONTO_PARA_AVALIACAO_GERENCIAL', 'EM_AVALIACAO_GERENCIAL', 'AJUSTES_SOLICITADOS_PELA_GERENCIA'].includes(status)) return { current: 5, steps };
  steps.push('decisao');
  return { current: 6, steps };
}

// API helper
async function api(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  const response = await fetch(url, config);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return data;
}

// Router
function navigate(hash) {
  window.location.hash = hash;
}

function getRoute() {
  const hash = window.location.hash.slice(1) || 'requester/dashboard';
  const parts = hash.split('/');
  return { page: parts[0], params: parts.slice(1) };
}

// Render app
function render() {
  const { page, params } = getRoute();

  if (!state.user) return;

  if (page === 'requester' && params[0] === 'new') {
    renderNewProposal();
  } else if (page === 'requester' && params[0] === 'dashboard') {
    renderDashboard('requester');
  } else if (page === 'marketing' && params[0] === 'dashboard') {
    renderDashboard('marketing');
  } else if (page === 'marketing' && params[0] === 'feedback') {
    renderMarketingFeedback(params[1]);
  } else if (page === 'management' && params[0] === 'dashboard') {
    renderDashboard('management');
  } else if (page === 'management' && params[0] === 'decision') {
    renderManagementDecision(params[1]);
  } else if (page === 'project') {
    renderProjectDetail(params[0]);
  } else {
    renderDashboard(state.user.role);
  }
}

// === DASHBOARD ===

// === DASHBOARD ===
function renderDashboard(role) {
  const app = document.getElementById('app');
  app.innerHTML = renderHeader(role) + `
    <div class="app-layout">
      ${renderSidebar(role)}
      <main class="main-content" id="mainContent">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </main>
    </div>
  `;
  loadDashboard(role);
}

async function loadDashboard(role) {
  try {
    state.projects = await api('/api/projects');
    renderDashboardContent(role);
  } catch (err) {
    document.getElementById('mainContent').innerHTML = `
      <div class="alert alert-error">Erro ao carregar projetos: ${err.message}</div>
    `;
  }
}

function renderDashboardContent(role) {
  const main = document.getElementById('mainContent');
  let filtered = getFilteredProjects(role);

  let stats = {};
  if (role === 'requester') {
    stats = {
      total: state.projects.length,
      draft: state.projects.filter(p => p.status === 'RASCUNHO' || p.status === 'AGUARDANDO_REVISAO_DO_SOLICITANTE').length,
      archived: state.projects.filter(p => p.status === 'ARQUIVADO_PELO_SOLICITANTE').length,
      finished: state.projects.filter(p => ['AUTORIZADO_PARA_PROSSEGUIR', 'ENCERRADO_PELA_GERENCIA'].includes(p.status)).length,
    };
  } else if (role === 'marketing') {
    stats = {
      pending: state.projects.filter(p => p.status === 'SUBMETIDO_AO_MARKETING' || p.status === 'EM_ANALISE_PELO_MARKETING').length,
      reviewed: state.projects.filter(p => ['FEEDBACK_DO_MARKETING_DISPONIVEL', 'SEM_CONSIDERACOES_DO_MARKETING'].includes(p.status)).length,
    };
  } else if (role === 'management') {
    stats = {
      pending: state.projects.filter(p => p.status === 'PRONTO_PARA_AVALIACAO_GERENCIAL').length,
      authorized: state.projects.filter(p => p.status === 'AUTORIZADO_PARA_PROSSEGUIR').length,
      adjustments: state.projects.filter(p => p.status === 'AJUSTES_SOLICITADOS_PELA_GERENCIA').length,
      closed: state.projects.filter(p => p.status === 'ENCERRADO_PELA_GERENCIA').length,
    };
  }

  const filters = getFilters(role);

  main.innerHTML = `
    <div class="dashboard-header">
      <h2>Painel de ${ROLE_LABELS[role]}</h2>
      ${role === 'requester' ? '<button class="btn btn-primary" onclick="navigate(\'requester/new\')">+ Nova Proposta</button>' : ''}
    </div>

    <div class="stats-grid">
      ${Object.entries(stats).map(([key, val]) => `
        <div class="stat-card">
          <div class="stat-value">${val}</div>
          <div class="stat-label">${getStatLabel(key, role)}</div>
        </div>
      `).join('')}
    </div>

    <div class="filter-bar">
      ${filters.map(f => `
        <button class="filter-btn ${state.filter === f.key ? 'active' : ''}" onclick="setFilter('${f.key}', '${role}')">${f.label}</button>
      `).join('')}
    </div>

    <div class="project-list">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">${role === 'requester' ? '📋' : role === 'marketing' ? '📬' : '📊'}</div>
          <p>Nenhum projeto encontrado.</p>
        </div>
      ` : filtered.map(p => renderProjectItem(p, role)).join('')}
    </div>
  `;
}

function getStatLabel(key, role) {
  const labels = {
    requester: { total: 'Total', draft: 'Em andamento', archived: 'Arquivados', finished: 'Finalizados' },
    marketing: { pending: 'Pendentes', reviewed: 'Analisados' },
    management: { pending: 'Aguardando decisão', authorized: 'Autorizados', adjustments: 'Ajustes solicitados', closed: 'Encerrados' },
  };
  return labels[role][key] || key;
}

function getFilters(role) {
  if (role === 'requester') {
    return [
      { key: 'all', label: 'Todos' },
      { key: 'active', label: 'Ativos' },
      { key: 'RASCUNHO', label: 'Rascunho' },
      { key: 'AGUARDANDO_REVISAO_DO_SOLICITANTE', label: 'Aguardando revisão' },
      { key: 'ARQUIVADO_PELO_SOLICITANTE', label: 'Arquivados' },
    ];
  }
  if (role === 'marketing') {
    return [
      { key: 'all', label: 'Todos' },
      { key: 'pending', label: 'Pendentes' },
      { key: 'reviewed', label: 'Analisados' },
    ];
  }
  if (role === 'management') {
    return [
      { key: 'all', label: 'Todas' },
      { key: 'PRONTO_PARA_AVALIACAO_GERENCIAL', label: 'Aguardando decisão' },
      { key: 'AUTORIZADO_PARA_PROSSEGUIR', label: 'Autorizados' },
      { key: 'AJUSTES_SOLICITADOS_PELA_GERENCIA', label: 'Ajustes solicitados' },
      { key: 'ENCERRADO_PELA_GERENCIA', label: 'Encerrados' },
    ];
  }
  return [{ key: 'all', label: 'Todos' }];
}

function getFilteredProjects(role) {
  const filter = state.filter;
  if (filter === 'all') return [...state.projects];

  if (role === 'requester') {
    if (filter === 'active') {
      return state.projects.filter(p => !['ARQUIVADO_PELO_SOLICITANTE', 'ENCERRADO_PELA_GERENCIA', 'AUTORIZADO_PARA_PROSSEGUIR'].includes(p.status));
    }
    return state.projects.filter(p => p.status === filter);
  }

  if (role === 'marketing') {
    const marketingStatuses = ['SUBMETIDO_AO_MARKETING', 'EM_ANALISE_PELO_MARKETING', 'FEEDBACK_DO_MARKETING_DISPONIVEL', 'SEM_CONSIDERACOES_DO_MARKETING', 'EM_REVISAO_PELO_SOLICITANTE', 'PRONTO_PARA_AVALIACAO_GERENCIAL', 'AJUSTES_SOLICITADOS_PELA_GERENCIA'];
    if (filter === 'pending') {
      return state.projects.filter(p => p.status === 'SUBMETIDO_AO_MARKETING' || p.status === 'EM_ANALISE_PELO_MARKETING');
    }
    if (filter === 'reviewed') {
      return state.projects.filter(p => ['FEEDBACK_DO_MARKETING_DISPONIVEL', 'SEM_CONSIDERACOES_DO_MARKETING', 'EM_REVISAO_PELO_SOLICITANTE', 'PRONTO_PARA_AVALIACAO_GERENCIAL'].includes(p.status));
    }
    return state.projects.filter(p => marketingStatuses.includes(p.status));
  }

  if (role === 'management') {
    const managementStatuses = ['PRONTO_PARA_AVALIACAO_GERENCIAL', 'EM_AVALIACAO_GERENCIAL', 'AUTORIZADO_PARA_PROSSEGUIR', 'AJUSTES_SOLICITADOS_PELA_GERENCIA', 'ENCERRADO_PELA_GERENCIA'];
    if (filter === 'pending') return state.projects.filter(p => p.status === 'PRONTO_PARA_AVALIACAO_GERENCIAL');
    return state.projects.filter(p => p.status === filter);
  }

  return [];
}

function renderProjectItem(project, role) {
  const created = new Date(project.createdAt).toLocaleDateString('pt-BR');
  return `
    <div class="project-item" onclick="navigate('project/${project.id}')">
      <div class="project-info">
        <h4>${escapeHtml(project.title)}</h4>
        <p>${escapeHtml(project.requester)} · ${escapeHtml(project.businessUnit)}</p>
      </div>
      <div class="project-meta">
        <span class="status-badge ${project.status} status-label ${project.status}"></span>
        <span class="project-date">${created}</span>
      </div>
    </div>
  `;
}

window.setFilter = function (key, role) {
  state.filter = key;
  renderDashboardContent(role);
};

// === SIDEBAR ===
function renderSidebar(role) {
  const profile = getProfileData(role);
  const links = {
    requester: [
      { href: 'requester/dashboard', icon: icon('grid'), label: 'Painel' },
      { href: 'requester/new', icon: icon('plus'), label: 'Nova Proposta' },
    ],
    marketing: [
      { href: 'marketing/dashboard', icon: icon('grid'), label: 'Painel' },
    ],
    management: [
      { href: 'management/dashboard', icon: icon('grid'), label: 'Painel' },
    ],
  };

  const current = window.location.hash.slice(1);

  return `
    <aside class="sidebar">
      <nav>
        <div class="sidebar-section">Menu</div>
        ${links[role].map(l => `
          <a href="#${l.href}" class="${current.startsWith(l.href) ? 'active' : ''}" onclick="navigate('${l.href}')">
            ${l.icon} ${l.label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-profile">
        <button class="profile-tab" id="profileTabBtn" type="button">
          <div class="profile-avatar">${profile.name.charAt(0)}</div>
          <span class="profile-name">${profile.name}</span>
          <svg class="profile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
    </aside>
  `;
}

window.toggleProfile = function () {};

var _profilePopupRole = null;

function getProfileData(role) {
  var profiles = {
    requester: { name: 'Ana Silva', gender: 'Feminino', position: 'Analista de Projetos' },
    marketing: { name: 'Carlos Mendes', gender: 'Masculino', position: 'Coordenador de Marketing' },
    management: { name: 'Dra. Beatriz Oliveira', gender: 'Feminino', position: 'Diretora de Operações' },
  };
  return profiles[role] || profiles.requester;
}

function createProfilePopup() {
  var existing = document.getElementById('profilePopupFixed');
  if (existing) existing.remove();

  var role = state.user ? state.user.role : null;
  if (!role) return;
  _profilePopupRole = role;

  var profile = getProfileData(role);

  var popup = document.createElement('div');
  popup.id = 'profilePopupFixed';
  popup.innerHTML = `
    <div class="profile-popup-card">
      <div class="profile-popup-header">
        <div class="profile-popup-avatar">${profile.name.charAt(0)}</div>
        <div class="profile-popup-info">
          <div class="profile-popup-name">${profile.name}</div>
          <div class="profile-popup-position">${profile.position}</div>
        </div>
      </div>
      <div class="profile-popup-details">
        <div class="profile-detail-row">
          <span class="profile-detail-label">Nome</span>
          <span class="profile-detail-value">${profile.name}</span>
        </div>
        <div class="profile-detail-row">
          <span class="profile-detail-label">Sexo</span>
          <span class="profile-detail-value">${profile.gender}</span>
        </div>
        <div class="profile-detail-row">
          <span class="profile-detail-label">Cargo</span>
          <span class="profile-detail-value">${profile.position}</span>
        </div>
      </div>
    </div>
  `;
  popup.addEventListener('click', function (e) {
    if (e.target === popup) {
      popup.style.display = 'none';
    }
  });
  document.body.appendChild(popup);
}

function setupProfileTab() {
  var btn = document.getElementById('profileTabBtn');
  if (!btn) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();

    if (!document.getElementById('profilePopupFixed')) {
      createProfilePopup();
    }

    var popup = document.getElementById('profilePopupFixed');
    if (!popup) return;

    var rect = btn.getBoundingClientRect();
    popup.style.left = rect.left + 'px';
    popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    popup.style.top = 'auto';
    popup.style.right = 'auto';

    if (popup.style.display === 'block') {
      popup.style.display = 'none';
      btn.classList.remove('active');
    } else {
      popup.style.display = 'block';
      btn.classList.add('active');
    }
  });
}

function cleanupProfilePopup() {
  var popup = document.getElementById('profilePopupFixed');
  if (popup) popup.style.display = 'none';
  var btn = document.getElementById('profileTabBtn');
  if (btn) btn.classList.remove('active');
}

function renderHeader(role) {
  return `
    <header class="app-header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 2L11 13"></path>
          <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
        </svg>
        Azul E.L.O.S.
      </div>
      <div class="user-info">
        <span class="user-badge ${role}">${ROLE_LABELS[role]}</span>
        <span>${state.user.name}</span>
        <button class="btn-logout" onclick="logout()">Sair</button>
      </div>
    </header>
  `;
}

window.logout = function () {
  state.user = null;
  state.projects = [];
  state.currentProject = null;
  state.filter = 'all';
  navigate('login');
};

// === NEW PROPOSAL ===
function renderNewProposal() {
  const app = document.getElementById('app');
  app.innerHTML = renderHeader('requester') + `
    <div class="app-layout">
      ${renderSidebar('requester')}
      <main class="main-content">
        <div class="dashboard-header">
          <h2>Nova Proposta</h2>
        </div>

        <div id="formMessages"></div>

        <div class="card">
          <form id="proposalForm" onsubmit="submitProposal(event)">
            <div class="form-row">
              <div class="form-group">
                <label for="title">Título da ideia *</label>
                <input type="text" id="title" class="form-control" required>
              </div>
              <div class="form-group">
                <label for="requester">Nome do solicitante *</label>
                <input type="text" id="requester" class="form-control" value="${state.user.name}" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="businessUnit">Vertical / Unidade de negócio *</label>
                <select id="businessUnit" class="form-control" required>
                  <option value="">Selecione...</option>
                  <option value="Operações aeroportuárias">Operações aeroportuárias</option>
                  <option value="Logística">Logística</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Atendimento ao cliente">Atendimento ao cliente</option>
                  <option value="Tecnologia">Tecnologia</option>
                  <option value="Recursos humanos">Recursos humanos</option>
                  <option value="Finanças">Finanças</option>
                </select>
              </div>
              <div class="form-group">
                <label for="estimatedDeadline">Prazo aproximado</label>
                <input type="text" id="estimatedDeadline" class="form-control" placeholder="Ex.: 3 meses">
                <div class="hint">Opcional</div>
              </div>
            </div>
            <div class="form-group">
              <label for="problem">Problema identificado *</label>
              <textarea id="problem" class="form-control" rows="3" required placeholder="Qual problema esta proposta resolve?"></textarea>
            </div>
            <div class="form-group">
              <label for="idea">Descrição da ideia bruta *</label>
              <textarea id="idea" class="form-control" rows="4" required placeholder="Descreva sua ideia em detalhes..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="expectedBenefit">Benefício esperado *</label>
                <textarea id="expectedBenefit" class="form-control" rows="3" required placeholder="Que benefícios sua ideia trará?"></textarea>
              </div>
              <div class="form-group">
                <label for="targetUsers">Usuários ou clientes impactados *</label>
                <textarea id="targetUsers" class="form-control" rows="3" required placeholder="Quem será beneficiado?"></textarea>
              </div>
            </div>
            <div class="action-bar" style="border-top:none;padding-top:0;margin-top:8px;">
              <button type="submit" class="btn btn-primary">Salvar Proposta</button>
              <button type="button" class="btn btn-secondary" onclick="quickFill()">⚡ Preencher exemplo</button>
              <button type="button" class="btn btn-secondary" onclick="navigate('requester/dashboard')">Cancelar</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  `;
}

window.quickFill = function () {
  const samples = [
    {
      title: 'Embarque facilitado para famílias',
      businessUnit: 'Operações aeroportuárias',
      problem: 'Famílias com crianças pequenas enfrentam dificuldades no embarque, causando estresse e atrasos nas conexões.',
      idea: 'Criar um processo diferenciado para famílias com crianças pequenas, oferecendo orientações antecipadas por email e um canal de embarque prioritário.',
      expectedBenefit: 'Redução do estresse das famílias, agilidade no embarque e melhoria da experiência do cliente.',
      targetUsers: 'Famílias com crianças de até 5 anos que utilizam voos nacionais.',
      deadline: '3 meses',
    },
    {
      title: 'App de acompanhamento de manutenção',
      businessUnit: 'Manutenção',
      problem: 'Técnicos de manutenção não têm acesso rápido ao histórico de reparos das aeronaves quando estão em campo.',
      idea: 'Desenvolver um aplicativo mobile que centralize o histórico de manutenção, checklist digital e notificações de peças com reposição automática.',
      expectedBenefit: 'Redução de 30% no tempo de diagnóstico e aumento da precisão dos reparos.',
      targetUsers: 'Técnicos de manutenção e engenheiros de frota.',
      deadline: '6 meses',
    },
    {
      title: 'Chatbot para remarcação de voos',
      businessUnit: 'Atendimento ao cliente',
      problem: 'Alto volume de chamadas para remarcação em situações de mau tempo gera filas e insatisfação.',
      idea: 'Implementar um chatbot no WhatsApp e no site que permita remarcação autônoma sem falar com atendente.',
      expectedBenefit: 'Redução de 40% das chamadas e agilidade no atendimento.',
      targetUsers: 'Passageiros com voos nacionais que precisam remarcar.',
      deadline: '4 meses',
    },
  ];
  const pick = samples[Math.floor(Math.random() * samples.length)];
  document.getElementById('title').value = pick.title;
  document.getElementById('businessUnit').value = pick.businessUnit;
  document.getElementById('problem').value = pick.problem;
  document.getElementById('idea').value = pick.idea;
  document.getElementById('expectedBenefit').value = pick.expectedBenefit;
  document.getElementById('targetUsers').value = pick.targetUsers;
  document.getElementById('estimatedDeadline').value = pick.deadline;
  document.getElementById('formMessages').innerHTML = '<div class="alert alert-info">Formulário preenchido com exemplo aleatório. Edite ou salve.</div>';
};

window.submitProposal = async function (event) {
  event.preventDefault();
  const messages = document.getElementById('formMessages');
  const form = document.getElementById('proposalForm');
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  const data = {
    title: document.getElementById('title').value.trim(),
    requester: document.getElementById('requester').value.trim(),
    businessUnit: document.getElementById('businessUnit').value,
    problem: document.getElementById('problem').value.trim(),
    idea: document.getElementById('idea').value.trim(),
    expectedBenefit: document.getElementById('expectedBenefit').value.trim(),
    targetUsers: document.getElementById('targetUsers').value.trim(),
    estimatedDeadline: document.getElementById('estimatedDeadline').value.trim(),
  };

  try {
    const project = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    messages.innerHTML = '<div class="alert alert-success">Proposta criada com sucesso!</div>';
    setTimeout(() => navigate(`project/${project.id}`), 800);
  } catch (err) {
    messages.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Salvar Proposta';
  }
};

// === PROJECT DETAIL ===
function renderProjectDetail(projectId) {
  const app = document.getElementById('app');
  const role = state.user?.role || 'requester';
  app.innerHTML = renderHeader(role) + `
    <div class="app-layout">
      ${renderSidebar(role)}
      <main class="main-content" id="mainContent">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </main>
    </div>
  `;
  loadProjectDetail(projectId);
}

async function loadProjectDetail(projectId) {
  try {
    const project = await api(`/api/projects/${projectId}`);
    state.currentProject = project;
    renderProjectContent();
  } catch (err) {
    document.getElementById('mainContent').innerHTML = `
      <div class="alert alert-error">Erro ao carregar projeto: ${err.message}</div>
      <button class="btn btn-secondary mt-4" onclick="history.back()">Voltar</button>
    `;
  }
}

function renderProjectContent() {
  const main = document.getElementById('mainContent');
  const project = state.currentProject;
  if (!project) return;

  const role = state.user.role;
  const content = project.currentContent || {};
  const aiAnalysis = content.aiAnalysis;

  const flow = getFlowStep(project);

  main.innerHTML = `
    <div class="project-detail-header">
      <button class="btn btn-secondary btn-sm mb-2" onclick="navigate('${role}/dashboard')">← Voltar</button>
      <h2>${escapeHtml(project.title)}</h2>
      <div class="meta">
        <span class="status-badge ${project.status} status-label ${project.status}"></span>
        <span>${escapeHtml(project.requester)}</span>
        <span>·</span>
        <span>${escapeHtml(project.businessUnit)}</span>
        <span>·</span>
        <span>v${project.currentVersionNumber}</span>
      </div>
    </div>

    <div class="flow-steps">
      ${FLOW_STEPS.map((step, i) => {
        const idx = flow.steps.indexOf(step.key);
        const cls = idx >= 0 && idx < flow.current ? 'done' : (idx === flow.current ? 'active' : '');
        return `
          <div class="flow-step ${cls}">
            <div class="step-circle">${idx >= 0 && idx < flow.current ? '✓' : (idx === flow.current ? '●' : '○')}</div>
            <div class="step-label">${step.label}</div>
            ${i < FLOW_STEPS.length - 1 ? '<span class="flow-arrow">→</span>' : ''}
          </div>
        `;
      }).join('')}
    </div>

    <div id="detailMessages"></div>

    <div class="detail-section">
      <h3>Ideia Original</h3>
      <div class="field">
        <div class="field-label">Problema identificado</div>
        <div class="field-value">${escapeHtml(content.problem || '')}</div>
      </div>
      <div class="field">
        <div class="field-label">Descrição da ideia</div>
        <div class="field-value">${escapeHtml(content.idea || '')}</div>
      </div>
      <div class="field">
        <div class="field-label">Benefício esperado</div>
        <div class="field-value">${escapeHtml(content.expectedBenefit || '')}</div>
      </div>
      <div class="field">
        <div class="field-label">Usuários impactados</div>
        <div class="field-value">${escapeHtml(content.targetUsers || '')}</div>
      </div>
      ${content.estimatedDeadline ? `
        <div class="field">
          <div class="field-label">Prazo estimado</div>
          <div class="field-value">${escapeHtml(content.estimatedDeadline)}</div>
        </div>
      ` : ''}
    </div>

    ${aiAnalysis ? renderAiAnalysis(aiAnalysis) : ''}

    ${renderMarketingFeedbackSection(project)}

    ${renderDecisions(project)}

    ${renderVersionsTimeline(project)}

    ${renderActions(project, role)}
  `;
}

function renderAiAnalysis(ai) {
  return `
    <div class="detail-section">
      <h3>Análise da Inteligência Artificial</h3>
      <div class="field">
        <div class="field-label">Título sugerido</div>
        <div class="field-value">${escapeHtml(ai.suggestedTitle)}</div>
      </div>
      <div class="field">
        <div class="field-label">Resumo executivo</div>
        <div class="field-value">${escapeHtml(ai.executiveSummary)}</div>
      </div>
      <div class="field">
        <div class="field-label">Problema identificado</div>
        <div class="field-value">${escapeHtml(ai.identifiedProblem)}</div>
      </div>
      <div class="field">
        <div class="field-label">Público-alvo</div>
        <div class="field-value">${escapeHtml(ai.targetAudience)}</div>
      </div>
      <div class="field">
        <div class="field-label">Proposta de valor</div>
        <div class="field-value">${escapeHtml(ai.valueProposition)}</div>
      </div>

      <h4 style="font-size:0.875rem;font-weight:600;margin:16px 0 8px;color:var(--gray-700);">Alinhamento com valores da empresa</h4>
      ${ai.companyAlignment.map(a => `
        <div style="margin-bottom:8px;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--gray-600);">${escapeHtml(a.criterion)}</div>
          <div style="font-size:0.8125rem;color:var(--gray-500);">${escapeHtml(a.analysis)}</div>
        </div>
      `).join('')}

      <div class="form-row" style="margin-top:12px;">
        <div>
          <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:8px;color:var(--gray-700);">Informações ausentes</h4>
          <ul style="font-size:0.8125rem;color:var(--gray-500);padding-left:20px;">
            ${ai.missingInformation.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:8px;color:var(--gray-700);">Riscos</h4>
          <ul style="font-size:0.8125rem;color:var(--gray-500);padding-left:20px;">
            ${ai.risks.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="form-row" style="margin-top:12px;">
        <div>
          <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:8px;color:var(--gray-700);">Oportunidades</h4>
          <ul style="font-size:0.8125rem;color:var(--gray-500);padding-left:20px;">
            ${ai.opportunities.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:8px;color:var(--gray-700);">Métricas sugeridas</h4>
          <ul style="font-size:0.8125rem;color:var(--gray-500);padding-left:20px;">
            ${ai.suggestedMetrics.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="field" style="margin-top:12px;">
        <div class="field-label">Perguntas para o marketing</div>
        <ul style="font-size:0.8125rem;color:var(--gray-500);padding-left:20px;margin-top:4px;">
          ${ai.questionsForMarketing.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
        </ul>
      </div>

      <div class="field" style="margin-top:12px;">
        <div class="field-label">Proposta refinada</div>
        <div class="field-value" style="background:var(--gray-50);padding:12px;border-radius:var(--radius);border:1px solid var(--gray-200);">${escapeHtml(ai.refinedProposal)}</div>
      </div>
    </div>
  `;
}

function renderMarketingFeedbackSection(project) {
  if (!project.feedback || project.feedback.length === 0) return '';
  return `
    <div class="detail-section">
      <h3>Feedback do Marketing</h3>
      ${project.feedback.map(fb => `
        <div class="feedback-card">
          <div class="fb-header">${escapeHtml(fb.author)} · ${new Date(fb.createdAt).toLocaleDateString('pt-BR')}</div>
          ${fb.generalComments ? `<div class="fb-body" style="margin-top:8px;"><strong>Comentários gerais:</strong> ${escapeHtml(fb.generalComments)}</div>` : ''}
          ${fb.positivePoints ? `<div class="fb-body" style="margin-top:8px;"><strong>Pontos positivos:</strong> ${escapeHtml(fb.positivePoints)}</div>` : ''}
          ${fb.attentionPoints ? `<div class="fb-body" style="margin-top:8px;"><strong>Pontos de atenção:</strong> ${escapeHtml(fb.attentionPoints)}</div>` : ''}
          ${fb.recommendations ? `<div class="fb-body" style="margin-top:8px;"><strong>Sugestões:</strong> ${escapeHtml(fb.recommendations)}</div>` : ''}
          ${fb.communicationSuggestions ? `<div class="fb-body" style="margin-top:8px;"><strong>Sugestões de comunicação:</strong> ${escapeHtml(fb.communicationSuggestions)}</div>` : ''}
          ${fb.imageRisks ? `<div class="fb-body" style="margin-top:8px;"><strong>Riscos de imagem:</strong> ${escapeHtml(fb.imageRisks)}</div>` : ''}
          ${fb.audienceConsiderations ? `<div class="fb-body" style="margin-top:8px;"><strong>Considerações sobre público:</strong> ${escapeHtml(fb.audienceConsiderations)}</div>` : ''}
          ${!fb.hasConsiderations ? '<div class="fb-body" style="margin-top:8px;font-style:italic;">Registrado sem considerações adicionais.</div>' : ''}
          ${fb.requesterResponse ? `<div class="fb-body" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-200);"><strong>Resposta do solicitante:</strong> ${escapeHtml(typeof fb.requesterResponse === 'string' ? fb.requesterResponse : JSON.stringify(fb.requesterResponse))}</div>` : ''}
          <div class="fb-meta">Versão revisada: v${project.versions.find(v => v.id === fb.reviewedVersionId)?.versionNumber || '?'}</div>
        </div>
      `).join('')}
      <div class="alert alert-info" style="margin-top:8px;">
        O feedback do marketing possui caráter consultivo. A decisão final pertence à gerência responsável.
      </div>
    </div>
  `;
}

function renderDecisions(project) {
  if (!project.decisions || project.decisions.length === 0) return '';
  const decisionLabels = { AUTORIZAR: 'Autorizado', AJUSTES: 'Ajustes solicitados', ENCERRAR: 'Encerrado' };
  return `
    <div class="detail-section">
      <h3>Decisões Gerenciais</h3>
      ${project.decisions.map(d => `
        <div class="feedback-card">
          <div class="fb-header">${escapeHtml(d.manager)} · ${decisionLabels[d.decision] || d.decision} · ${new Date(d.createdAt).toLocaleDateString('pt-BR')}</div>
          ${d.justification ? `<div class="fb-body" style="margin-top:8px;">${escapeHtml(d.justification)}</div>` : ''}
          <div class="fb-meta">Versão avaliada: v${project.versions.find(v => v.id === d.evaluatedVersionId)?.versionNumber || '?'}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderVersionsTimeline(project) {
  if (!project.versions || project.versions.length === 0) return '';
  return `
    <div class="detail-section">
      <h3>Histórico de Versões</h3>
      <div class="timeline">
        ${project.versions.map(v => `
          <div class="timeline-item">
            <div class="tl-header">Versão ${v.versionNumber} — ${SOURCE_LABELS[v.source] || v.source}</div>
            <div class="tl-meta">${escapeHtml(v.createdBy)} · ${new Date(v.createdAt).toLocaleString('pt-BR')}</div>
            ${v.changeDescription ? `<div class="tl-body">${escapeHtml(v.changeDescription)}</div>` : ''}
            <div class="tl-body" onclick="viewVersion(${project.id}, ${v.id})" style="color:var(--primary);font-size:0.75rem;margin-top:2px;">
              Visualizar conteúdo →
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderActions(project, role) {
  const status = project.status;
  const actions = [];

  if (role === 'requester') {
    if (status === 'RASCUNHO') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="refineWithAi(' + project.id + ')">✨ Estruturar proposta com IA</button>',
      });
      actions.push({
        html: '<button class="btn btn-primary" onclick="showEditForm(' + project.id + ')">✏️ Editar proposta</button>',
      });
      actions.push({
        html: '<button class="btn btn-success" onclick="submitToMarketingAction(' + project.id + ')">📤 Enviar ao marketing</button>',
      });
      actions.push({
        html: '<button class="btn btn-secondary" onclick="confirmArchive(' + project.id + ')">📦 Arquivar</button>',
      });
    }
    if (status === 'ERRO_NO_PROCESSAMENTO_DA_IA') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="refineWithAi(' + project.id + ')">🔄 Tentar novamente com IA</button>',
      });
    }
    if (status === 'AGUARDANDO_REVISAO_DO_SOLICITANTE') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="showEditForm(' + project.id + ')">✏️ Editar proposta</button>',
      });
      if (project.currentContent?.aiAnalysis) {
        actions.push({
          html: '<button class="btn btn-primary" onclick="refineWithAi(' + project.id + ')">✨ Re-estruturar com IA</button>',
        });
      }
      actions.push({
        html: '<button class="btn btn-success" onclick="submitToMarketingAction(' + project.id + ')">📤 Enviar ao marketing</button>',
      });
      actions.push({
        html: '<button class="btn btn-secondary" onclick="confirmArchive(' + project.id + ')">📦 Arquivar</button>',
      });
    }
    if (status === 'FEEDBACK_DO_MARKETING_DISPONIVEL' || status === 'SEM_CONSIDERACOES_DO_MARKETING') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="showEditForm(' + project.id + ', \'REQUESTER_EDIT_AFTER_MARKETING\')">✏️ Editar proposta</button>',
      });
      actions.push({
        html: '<button class="btn btn-success" onclick="showSubmitManagement(' + project.id + ')">📤 Encaminhar à gerência</button>',
      });
    }
    if (status === 'EM_REVISAO_PELO_SOLICITANTE') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="showEditForm(' + project.id + ', \'REQUESTER_EDIT_AFTER_MARKETING\')">✏️ Editar proposta</button>',
      });
      actions.push({
        html: '<button class="btn btn-success" onclick="showSubmitManagement(' + project.id + ')">📤 Encaminhar à gerência</button>',
      });
    }
    if (status === 'AJUSTES_SOLICITADOS_PELA_GERENCIA') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="showEditForm(' + project.id + ')">✏️ Editar proposta</button>',
      });
      actions.push({
        html: '<button class="btn btn-success" onclick="showSubmitManagement(' + project.id + ')">📤 Encaminhar à gerência</button>',
      });
    }
  }

  if (role === 'marketing') {
    if (status === 'SUBMETIDO_AO_MARKETING' || status === 'EM_ANALISE_PELO_MARKETING') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="navigate(\'marketing/feedback/' + project.id + '\')">📝 Registrar feedback</button>',
      });
    }
  }

  if (role === 'management') {
    if (status === 'PRONTO_PARA_AVALIACAO_GERENCIAL') {
      actions.push({
        html: '<button class="btn btn-primary" onclick="navigate(\'management/decision/' + project.id + '\')">📋 Decidir</button>',
      });
    }
  }

  if (actions.length === 0) return '';

  return `
    <div class="detail-section">
      <h3>Ações</h3>
      <div class="action-bar">
        ${actions.map(a => a.html).join('')}
      </div>
    </div>
  `;
}

// === ACTIONS ===
window.refineWithAi = async function (projectId) {
  const main = document.getElementById('mainContent');
  if (state.loading) return;
  state.loading = true;

  const actionDiv = document.querySelector('.detail-section:last-child .action-bar');
  if (actionDiv) {
    actionDiv.innerHTML = '<div class="loading"><div class="spinner"></div> <span>Processando com IA... (pode levar até 1 minuto no plano gratuito)</span></div>';
  }

  try {
    const project = await api(`/api/projects/${projectId}/refine`, { method: 'POST' });
    state.currentProject = project;
    state.loading = false;
    renderProjectContent();
    const msg = document.getElementById('detailMessages');
    if (msg) msg.innerHTML = '<div class="alert alert-success">Proposta estruturada com sucesso pela IA!</div>';
  } catch (err) {
    state.loading = false;
    const msg = document.getElementById('detailMessages');
    if (msg) msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    renderProjectContent();
  }
};

window.showEditForm = function (projectId, source) {
  const project = state.currentProject;
  if (!project) return;
  const content = project.currentContent || {};

  const editSource = source || 'REQUESTER_EDIT';
  const isAfterMarketing = editSource === 'REQUESTER_EDIT_AFTER_MARKETING';

  const main = document.getElementById('mainContent');
  const editHtml = `
    <div style="background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:20px 24px;box-shadow:var(--shadow);">
      <h3 style="font-size:1rem;font-weight:600;margin-bottom:16px;color:var(--gray-800);">
        ${isAfterMarketing ? 'Editar proposta (após feedback do marketing)' : 'Editar proposta'}
      </h3>
      <div id="editMessages"></div>
      <form id="editForm">
        <div class="form-row">
          <div class="form-group">
            <label for="editTitle">Título</label>
            <input type="text" id="editTitle" class="form-control" value="${escapeHtml(content.title || '')}">
          </div>
          <div class="form-group">
            <label for="editRequester">Solicitante</label>
            <input type="text" id="editRequester" class="form-control" value="${escapeHtml(content.requester || '')}">
          </div>
        </div>
        <div class="form-group">
          <label for="editProblem">Problema identificado</label>
          <textarea id="editProblem" class="form-control" rows="3">${escapeHtml(content.problem || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="editIdea">Descrição da ideia</label>
          <textarea id="editIdea" class="form-control" rows="4">${escapeHtml(content.idea || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="editBenefit">Benefício esperado</label>
            <textarea id="editBenefit" class="form-control" rows="3">${escapeHtml(content.expectedBenefit || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="editUsers">Usuários impactados</label>
            <textarea id="editUsers" class="form-control" rows="3">${escapeHtml(content.targetUsers || '')}</textarea>
          </div>
        </div>
        <div class="form-group">
          <label for="editDeadline">Prazo estimado</label>
          <input type="text" id="editDeadline" class="form-control" value="${escapeHtml(content.estimatedDeadline || '')}">
        </div>
        ${isAfterMarketing && project.feedback && project.feedback.length > 0 ? `
          <div class="form-group">
            <label for="justification">Justificativa (caso não tenha incorporado alguma sugestão)</label>
            <textarea id="justification" class="form-control" rows="3" placeholder="Explique por que alguma sugestão não foi incorporada..."></textarea>
          </div>
        ` : ''}
        <div class="action-bar" style="border-top:none;padding-top:0;margin-top:8px;">
          <button type="submit" class="btn btn-primary">Salvar versão</button>
          <button type="button" class="btn btn-secondary" onclick="loadProjectDetail(${projectId})">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  // Replace last section with edit form
  const sections = main.querySelectorAll('.detail-section');
  const lastSection = sections[sections.length - 1];
  if (lastSection) {
    lastSection.innerHTML = editHtml;
  }

  document.getElementById('editForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const newContent = {
      title: document.getElementById('editTitle').value.trim() || content.title,
      requester: document.getElementById('editRequester').value.trim() || content.requester,
      businessUnit: content.businessUnit,
      problem: document.getElementById('editProblem').value.trim(),
      idea: document.getElementById('editIdea').value.trim(),
      expectedBenefit: document.getElementById('editBenefit').value.trim(),
      targetUsers: document.getElementById('editUsers').value.trim(),
      estimatedDeadline: document.getElementById('editDeadline').value.trim(),
    };

    if (content.aiAnalysis) {
      newContent.aiAnalysis = content.aiAnalysis;
    }

    const justification = document.getElementById('justification')?.value?.trim();

    try {
      const project = await api(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          content: newContent,
          createdBy: state.user.name,
          source: editSource,
          changeDescription: isAfterMarketing
            ? `Edição após feedback do marketing${justification ? '. Justificativa: ' + justification : ''}`
            : 'Edição pelo solicitante',
        }),
      });
      state.currentProject = project;
      document.getElementById('editMessages').innerHTML = '<div class="alert alert-success">Nova versão salva com sucesso!</div>';
      setTimeout(() => loadProjectDetail(projectId), 800);
    } catch (err) {
      document.getElementById('editMessages').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      btn.disabled = false;
      btn.textContent = 'Salvar versão';
    }
  });
};

window.submitToMarketingAction = async function (projectId) {
  const project = state.currentProject;
  if (!project) return;

  const versionId = project.currentVersionId;
  if (!versionId) return;

  try {
    const updated = await api(`/api/projects/${projectId}/submit-marketing`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    });
    state.currentProject = updated;
    const msg = document.getElementById('detailMessages');
    if (msg) msg.innerHTML = '<div class="alert alert-success">Proposta enviada ao marketing com sucesso!</div>';
    renderProjectContent();
  } catch (err) {
    const msg = document.getElementById('detailMessages');
    if (msg) msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
};

window.showSubmitManagement = function (projectId) {
  const project = state.currentProject;
  if (!project) return;

  const main = document.getElementById('mainContent');
  const sections = main.querySelectorAll('.detail-section');
  const lastSection = sections[sections.length - 1];

  const hasFeedback = project.feedback && project.feedback.length > 0;

  const html = `
    <div style="background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:20px 24px;box-shadow:var(--shadow);">
      <h3 style="font-size:1rem;font-weight:600;margin-bottom:16px;color:var(--gray-800);">Encaminhar à Gerência</h3>
      <div id="managementSubmitMessages"></div>
      <p style="font-size:0.875rem;color:var(--gray-500);margin-bottom:16px;">
        Você está prestes a encaminhar a versão atual (v${project.currentVersionNumber}) para avaliação da gerência.
        ${hasFeedback ? 'O feedback do marketing será incluído.' : ''}
      </p>
      ${hasFeedback ? `
        <div class="form-group">
          <label for="requesterResponse">Resposta ao feedback do marketing (opcional)</label>
          <textarea id="requesterResponse" class="form-control" rows="3" placeholder="Comente sobre como o feedback foi incorporado..."></textarea>
        </div>
      ` : ''}
      <div class="action-bar" style="border-top:none;padding-top:0;">
        <button class="btn btn-success" onclick="doSubmitManagement(${projectId})">📤 Confirmar envio</button>
        <button class="btn btn-secondary" onclick="loadProjectDetail(${projectId})">Cancelar</button>
      </div>
    </div>
  `;

  if (lastSection) {
    lastSection.innerHTML = html;
  }
};

window.doSubmitManagement = async function (projectId) {
  const project = state.currentProject;
  if (!project) return;

  const requesterResponse = document.getElementById('requesterResponse')?.value?.trim();

  try {
    const updated = await api(`/api/projects/${projectId}/submit-management`, {
      method: 'POST',
      body: JSON.stringify({
        versionId: project.currentVersionId,
        requesterResponse: requesterResponse || undefined,
      }),
    });
    state.currentProject = updated;
    document.getElementById('managementSubmitMessages').innerHTML = '<div class="alert alert-success">Proposta encaminhada à gerência!</div>';
    setTimeout(() => loadProjectDetail(projectId), 800);
  } catch (err) {
    document.getElementById('managementSubmitMessages').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
};

window.confirmArchive = function (projectId) {
  showConfirm(
    'Arquivar proposta',
    'Tem certeza que deseja arquivar esta proposta? Ela permanecerá salva, mas não estará mais ativa.',
    async () => {
      try {
        const updated = await api(`/api/projects/${projectId}/archive`, { method: 'POST' });
        state.currentProject = updated;
        const msg = document.getElementById('detailMessages');
        if (msg) msg.innerHTML = '<div class="alert alert-success">Proposta arquivada com sucesso!</div>';
        renderProjectContent();
      } catch (err) {
        const msg = document.getElementById('detailMessages');
        if (msg) msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      }
    }
  );
};

window.viewVersion = async function (projectId, versionId) {
  try {
    const project = await api(`/api/projects/${projectId}`);
    const version = project.versions.find(v => v.id === versionId);
    if (!version) return;

    const content = version.content;
    const html = `
      <div class="modal-overlay" onclick="event.target===this&&closeModal()">
        <div class="modal-content">
          <button class="modal-close" onclick="closeModal()">✕</button>
          <h3>Versão ${version.versionNumber} — ${SOURCE_LABELS[version.source] || version.source}</h3>
          <p style="font-size:0.8125rem;color:var(--gray-400);margin-bottom:16px;">
            ${escapeHtml(version.createdBy)} · ${new Date(version.createdAt).toLocaleString('pt-BR')}
            ${version.changeDescription ? ' · ' + escapeHtml(version.changeDescription) : ''}
          </p>
          <div style="font-size:0.875rem;white-space:pre-wrap;color:var(--gray-700);">
            ${renderVersionContent(content)}
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  } catch (err) {
    // ignore
  }
};

function renderVersionContent(content) {
  if (typeof content === 'string') return escapeHtml(content);
  let html = '';
  if (content.title) html += `<div style="margin-bottom:8px;"><strong>Título:</strong> ${escapeHtml(content.title)}</div>`;
  if (content.problem) html += `<div style="margin-bottom:8px;"><strong>Problema:</strong> ${escapeHtml(content.problem)}</div>`;
  if (content.idea) html += `<div style="margin-bottom:8px;"><strong>Ideia:</strong> ${escapeHtml(content.idea)}</div>`;
  if (content.expectedBenefit) html += `<div style="margin-bottom:8px;"><strong>Benefício:</strong> ${escapeHtml(content.expectedBenefit)}</div>`;
  if (content.targetUsers) html += `<div style="margin-bottom:8px;"><strong>Usuários:</strong> ${escapeHtml(content.targetUsers)}</div>`;

  if (content.aiAnalysis) {
    html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-200);">
      <strong>Análise da IA:</strong>
      <div style="margin-top:4px;">${escapeHtml(content.aiAnalysis.executiveSummary || '')}</div>
    </div>`;
  }
  return html;
}

window.closeModal = function () {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
};

function showConfirm(title, message, onConfirm) {
  const html = `
    <div class="confirm-overlay" id="confirmDialog">
      <div class="confirm-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-danger" onclick="confirmAction()">Confirmar</button>
          <button class="btn btn-secondary" onclick="closeConfirm()">Cancelar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  window.confirmAction = function () {
    closeConfirm();
    onConfirm();
  };
}

window.closeConfirm = function () {
  document.getElementById('confirmDialog')?.remove();
  delete window.confirmAction;
};

// === MARKETING FEEDBACK ===
function renderMarketingFeedback(projectId) {
  const app = document.getElementById('app');
  app.innerHTML = renderHeader('marketing') + `
    <div class="app-layout">
      ${renderSidebar('marketing')}
      <main class="main-content" id="mainContent">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </main>
    </div>
  `;
  loadMarketingFeedback(projectId);
}

async function loadMarketingFeedback(projectId) {
  try {
    const project = await api(`/api/projects/${projectId}`);
    state.currentProject = project;
    renderFeedbackForm();
  } catch (err) {
    document.getElementById('mainContent').innerHTML = `
      <div class="alert alert-error">Erro ao carregar projeto: ${err.message}</div>
      <button class="btn btn-secondary mt-4" onclick="navigate('marketing/dashboard')">Voltar</button>
    `;
  }
}

function renderFeedbackForm() {
  const main = document.getElementById('mainContent');
  const project = state.currentProject;
  if (!project) return;

  const content = project.currentContent || {};
  const aiAnalysis = content.aiAnalysis;

  main.innerHTML = `
    <div class="project-detail-header">
      <button class="btn btn-secondary btn-sm mb-2" onclick="navigate('marketing/dashboard')">← Voltar</button>
      <h2>Feedback Consultivo — ${escapeHtml(project.title)}</h2>
      <div class="meta">
        <span class="status-badge ${project.status} status-label ${project.status}"></span>
        <span>${escapeHtml(project.requester)} · ${escapeHtml(project.businessUnit)}</span>
        <span>·</span>
        <span>Versão atual: v${project.currentVersionNumber}</span>
      </div>
    </div>

    <div id="feedbackMessages"></div>

    <div class="detail-section">
      <h3>Ideia Original</h3>
      <div class="field"><div class="field-label">Problema</div><div class="field-value">${escapeHtml(content.problem || '')}</div></div>
      <div class="field"><div class="field-label">Ideia</div><div class="field-value">${escapeHtml(content.idea || '')}</div></div>
      <div class="field"><div class="field-label">Benefício esperado</div><div class="field-value">${escapeHtml(content.expectedBenefit || '')}</div></div>
    </div>

    ${aiAnalysis ? `
      <div class="detail-section">
        <h3>Análise da IA</h3>
        <div class="field"><div class="field-label">Público-alvo</div><div class="field-value">${escapeHtml(aiAnalysis.targetAudience)}</div></div>
        <div class="field"><div class="field-label">Proposta de valor</div><div class="field-value">${escapeHtml(aiAnalysis.valueProposition)}</div></div>
        <div class="field"><div class="field-label">Riscos</div><ul style="font-size:0.875rem;color:var(--gray-500);padding-left:20px;">${aiAnalysis.risks.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>
        <div class="field"><div class="field-label">Oportunidades</div><ul style="font-size:0.875rem;color:var(--gray-500);padding-left:20px;">${aiAnalysis.opportunities.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul></div>
      </div>
    ` : ''}

    <div class="detail-section">
      <h3>Registrar Feedback Consultivo</h3>
      <p style="font-size:0.8125rem;color:var(--gray-500);margin-bottom:16px;">
        Seu feedback tem caráter consultivo. Você não pode aprovar, reprovar, barrar ou encerrar projetos.
      </p>
      <form id="feedbackForm">
        <div class="form-group">
          <label for="fbAuthor">Seu nome *</label>
          <input type="text" id="fbAuthor" class="form-control" value="${state.user.name}" required>
        </div>
        <div class="form-group">
          <label for="fbGeneral">Comentários gerais</label>
          <textarea id="fbGeneral" class="form-control" rows="3" placeholder="Impressão geral sobre a proposta..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="fbPositive">Pontos positivos</label>
            <textarea id="fbPositive" class="form-control" rows="3" placeholder="O que está bem alinhado..."></textarea>
          </div>
          <div class="form-group">
            <label for="fbAttention">Pontos de atenção</label>
            <textarea id="fbAttention" class="form-control" rows="3" placeholder="O que merece cuidado..."></textarea>
          </div>
        </div>
        <div class="form-group">
          <label for="fbRecommendations">Sugestões para melhorar a aceitação</label>
          <textarea id="fbRecommendations" class="form-control" rows="3" placeholder="Recomendações para fortalecer a proposta..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="fbCommunication">Sugestões de comunicação</label>
            <textarea id="fbCommunication" class="form-control" rows="3" placeholder="Como comunicar melhor esta proposta..."></textarea>
          </div>
          <div class="form-group">
            <label for="fbAudience">Considerações sobre público-alvo</label>
            <textarea id="fbAudience" class="form-control" rows="3" placeholder="Reflexões sobre o público impactado..."></textarea>
          </div>
        </div>
        <div class="form-group">
          <label for="fbImageRisks">Possíveis riscos de imagem</label>
          <textarea id="fbImageRisks" class="form-control" rows="2" placeholder="Riscos de percepção pública..."></textarea>
        </div>
        <div class="action-bar" style="border-top:none;padding-top:0;margin-top:8px;">
          <button type="submit" class="btn btn-primary">📨 Enviar feedback consultivo</button>
          <button type="button" class="btn btn-secondary" onclick="submitFeedbackNoConsiderations()">Registrar sem considerações</button>
          <button type="button" class="btn btn-secondary" onclick="navigate('marketing/dashboard')">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('feedbackForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    await submitFeedbackWithConsiderations();
  });
}

async function submitFeedbackWithConsiderations() {
  const project = state.currentProject;
  const btn = document.querySelector('#feedbackForm button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const data = {
    reviewedVersionId: project.currentVersionId,
    author: document.getElementById('fbAuthor').value.trim(),
    generalComments: document.getElementById('fbGeneral').value.trim(),
    positivePoints: document.getElementById('fbPositive').value.trim(),
    attentionPoints: document.getElementById('fbAttention').value.trim(),
    recommendations: document.getElementById('fbRecommendations').value.trim(),
    communicationSuggestions: document.getElementById('fbCommunication').value.trim(),
    audienceConsiderations: document.getElementById('fbAudience').value.trim(),
    imageRisks: document.getElementById('fbImageRisks').value.trim(),
    hasConsiderations: true,
  };

  try {
    const updated = await api(`/api/projects/${project.id}/marketing-feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    state.currentProject = updated;
    document.getElementById('feedbackMessages').innerHTML = '<div class="alert alert-success">Feedback consultivo registrado com sucesso!</div>';
    setTimeout(() => navigate('marketing/dashboard'), 1000);
  } catch (err) {
    document.getElementById('feedbackMessages').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Enviar feedback consultivo';
  }
}

window.submitFeedbackNoConsiderations = async function () {
  const project = state.currentProject;
  const author = document.getElementById('fbAuthor')?.value?.trim() || state.user.name;

  const data = {
    reviewedVersionId: project.currentVersionId,
    author: author,
    hasConsiderations: false,
  };

  try {
    const updated = await api(`/api/projects/${project.id}/marketing-feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    state.currentProject = updated;
    document.getElementById('feedbackMessages').innerHTML = '<div class="alert alert-success">Registrado sem considerações adicionais.</div>';
    setTimeout(() => navigate('marketing/dashboard'), 1000);
  } catch (err) {
    document.getElementById('feedbackMessages').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
};

// === MANAGEMENT DECISION ===
function renderManagementDecision(projectId) {
  const app = document.getElementById('app');
  app.innerHTML = renderHeader('management') + `
    <div class="app-layout">
      ${renderSidebar('management')}
      <main class="main-content" id="mainContent">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </main>
    </div>
  `;
  loadManagementDecision(projectId);
}

async function loadManagementDecision(projectId) {
  try {
    const project = await api(`/api/projects/${projectId}`);
    state.currentProject = project;
    renderDecisionForm();
  } catch (err) {
    document.getElementById('mainContent').innerHTML = `
      <div class="alert alert-error">Erro ao carregar projeto: ${err.message}</div>
      <button class="btn btn-secondary mt-4" onclick="navigate('management/dashboard')">Voltar</button>
    `;
  }
}

function renderDecisionForm() {
  const main = document.getElementById('mainContent');
  const project = state.currentProject;
  if (!project) return;

  const content = project.currentContent || {};
  const aiAnalysis = content.aiAnalysis;

  main.innerHTML = `
    <div class="project-detail-header">
      <button class="btn btn-secondary btn-sm mb-2" onclick="navigate('management/dashboard')">← Voltar</button>
      <h2>Decisão Gerencial — ${escapeHtml(project.title)}</h2>
      <div class="meta">
        <span class="status-badge ${project.status} status-label ${project.status}"></span>
        <span>${escapeHtml(project.requester)} · ${escapeHtml(project.businessUnit)}</span>
        <span>·</span>
        <span>v${project.currentVersionNumber}</span>
      </div>
    </div>

    <div id="decisionMessages"></div>

    <div class="detail-section">
      <h3>Ideia Original</h3>
      <div class="field"><div class="field-label">Problema</div><div class="field-value">${escapeHtml(content.problem || '')}</div></div>
      <div class="field"><div class="field-label">Ideia</div><div class="field-value">${escapeHtml(content.idea || '')}</div></div>
      <div class="field"><div class="field-label">Benefício esperado</div><div class="field-value">${escapeHtml(content.expectedBenefit || '')}</div></div>
    </div>

    ${aiAnalysis ? `
      <div class="detail-section">
        <h3>Análise da IA</h3>
        <div class="field"><div class="field-label">Público-alvo</div><div class="field-value">${escapeHtml(aiAnalysis.targetAudience)}</div></div>
        <div class="field"><div class="field-label">Proposta de valor</div><div class="field-value">${escapeHtml(aiAnalysis.valueProposition)}</div></div>
        <div class="field"><div class="field-label">Resumo</div><div class="field-value">${escapeHtml(aiAnalysis.executiveSummary)}</div></div>
      </div>
    ` : ''}

    ${renderMarketingFeedbackSection(project)}

    <div class="detail-section">
      <h3>Registrar Decisão</h3>
      <p style="font-size:0.8125rem;color:var(--gray-500);margin-bottom:16px;">
        Como gerência, você pode autorizar o prosseguimento, solicitar ajustes ou encerrar o projeto.
        Esta decisão é final e será registrada no histórico.
      </p>
      <form id="decisionForm">
        <div class="form-group">
          <label for="decManager">Seu nome *</label>
          <input type="text" id="decManager" class="form-control" value="${state.user.name}" required>
        </div>
        <div class="form-group">
          <label>Decisão *</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 16px;border:2px solid var(--gray-200);border-radius:var(--radius);transition:all 0.15s;" onmouseover="this.style.borderColor='var(--success)'" onmouseout="this.style.borderColor='var(--gray-200)'">
              <input type="radio" name="decision" value="AUTORIZAR" required onchange="document.getElementById('justificationGroup').style.display=this.value==='AUTORIZAR'?'none':'block'">
              <div>
                <div style="font-weight:600;color:var(--success);">Autorizar prosseguimento</div>
                <div style="font-size:0.8125rem;color:var(--gray-500);">O projeto pode seguir adiante</div>
              </div>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 16px;border:2px solid var(--gray-200);border-radius:var(--radius);transition:all 0.15s;" onmouseover="this.style.borderColor='var(--warning)'" onmouseout="this.style.borderColor='var(--gray-200)'">
              <input type="radio" name="decision" value="AJUSTES" required onchange="document.getElementById('justificationGroup').style.display='block'">
              <div>
                <div style="font-weight:600;color:var(--warning);">Solicitar ajustes</div>
                <div style="font-size:0.8125rem;color:var(--gray-500);">O projeto precisa de modificações antes de prosseguir</div>
              </div>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 16px;border:2px solid var(--gray-200);border-radius:var(--radius);transition:all 0.15s;" onmouseover="this.style.borderColor='var(--danger)'" onmouseout="this.style.borderColor='var(--gray-200)'">
              <input type="radio" name="decision" value="ENCERRAR" required onchange="document.getElementById('justificationGroup').style.display='block'">
              <div>
                <div style="font-weight:600;color:var(--danger);">Encerrar projeto</div>
                <div style="font-size:0.8125rem;color:var(--gray-500);">O projeto não deve prosseguir</div>
              </div>
            </label>
          </div>
        </div>
        <div class="form-group" id="justificationGroup" style="display:none;">
          <label for="decJustification">Justificativa *</label>
          <textarea id="decJustification" class="form-control" rows="4" placeholder="Explique os motivos da sua decisão..."></textarea>
        </div>
        <div class="action-bar" style="border-top:none;padding-top:0;">
          <button type="submit" class="btn btn-primary">Registrar decisão</button>
          <button type="button" class="btn btn-secondary" onclick="navigate('management/dashboard')">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('decisionForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    const decision = document.querySelector('input[name="decision"]:checked')?.value;
    const justification = document.getElementById('decJustification')?.value?.trim();

    if (!decision) {
      document.getElementById('decisionMessages').innerHTML = '<div class="alert alert-error">Selecione uma decisão.</div>';
      btn.disabled = false;
      btn.textContent = 'Registrar decisão';
      return;
    }

    if ((decision === 'ENCERRAR' || decision === 'AJUSTES') && !justification) {
      document.getElementById('decisionMessages').innerHTML = '<div class="alert alert-error">Justificativa é obrigatória para esta decisão.</div>';
      btn.disabled = false;
      btn.textContent = 'Registrar decisão';
      return;
    }

    try {
      const updated = await api(`/api/projects/${project.id}/management-decision`, {
        method: 'POST',
        body: JSON.stringify({
          evaluatedVersionId: project.currentVersionId,
          manager: document.getElementById('decManager').value.trim(),
          decision: decision,
          justification: justification || null,
        }),
      });
      state.currentProject = updated;
      document.getElementById('decisionMessages').innerHTML = '<div class="alert alert-success">Decisão registrada com sucesso!</div>';

      const statusLabels = { AUTORIZAR: 'autorizado', AJUSTES: 'com ajustes solicitados', ENCERRAR: 'encerrado' };
      setTimeout(() => {
        const msg = document.getElementById('decisionMessages');
        if (msg) msg.innerHTML += `<div class="alert alert-info mt-2">Projeto ${statusLabels[decision]}.</div>`;
      }, 500);

      setTimeout(() => navigate('management/dashboard'), 2000);
    } catch (err) {
      document.getElementById('decisionMessages').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      btn.disabled = false;
      btn.textContent = 'Registrar decisão';
    }
  });
}

// === ICONS ===
function icon(name) {
  const icons = {
    grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  };
  return icons[name] || '';
}

// === HELPERS ===
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// === CHAT ===
const chatState = {
  open: false,
  messages: [],
  channel: 'general',
  unreadCount: 0,
  lastPoll: null,
  pollInterval: null,
};

function injectChatToggle() {
  const existing = document.getElementById('chatToggleBtn');
  if (existing) return;
  const btn = document.createElement('button');
  btn.id = 'chatToggleBtn';
  btn.className = 'chat-toggle-btn';
  btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="chat-badge" id="chatBadge" style="display:none">0</span>`;
  btn.addEventListener('click', toggleChat);
  document.body.appendChild(btn);
}

function injectChatPanel() {
  const existing = document.getElementById('chatPanel');
  if (existing) return;
  const panel = document.createElement('div');
  panel.id = 'chatPanel';
  panel.className = 'chat-panel';
  panel.innerHTML = `
    <div class="chat-header">
      <h3>Chat</h3>
      <button class="chat-close-btn" onclick="toggleChat()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="chat-channels" id="chatChannels">
      <button class="chat-channel active" data-channel="general" onclick="switchChatChannel('general')">Geral</button>
      <button class="chat-channel" data-channel="project" onclick="switchChatChannel('project')" id="projectChannelBtn" style="display:none">Projeto</button>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input-area">
      <textarea class="chat-input" id="chatInput" placeholder="Digite sua mensagem..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage()}"></textarea>
      <button class="chat-send-btn" onclick="sendChatMessage()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </div>
  `;
  document.body.appendChild(panel);
  autoResizeChatInput();
}

function autoResizeChatInput() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
}

window.toggleChat = function () {
  chatState.open = !chatState.open;
  const panel = document.getElementById('chatPanel');
  const btn = document.getElementById('chatToggleBtn');
  if (panel) panel.classList.toggle('open', chatState.open);
  if (btn) btn.classList.toggle('active', chatState.open);
  if (chatState.open) {
    chatState.unreadCount = 0;
    updateChatBadge();
    loadChatMessages();
    startChatPolling();
    document.getElementById('chatInput')?.focus();
  } else {
    stopChatPolling();
  }
};

window.switchChatChannel = function (channel) {
  chatState.channel = channel;
  document.querySelectorAll('.chat-channel').forEach(b => b.classList.toggle('active', b.dataset.channel === channel));
  loadChatMessages();
};

function getChatProjectId() {
  if (chatState.channel === 'project' && state.currentProject) {
    return state.currentProject.id;
  }
  return null;
}

async function loadChatMessages() {
  try {
    const projectId = getChatProjectId();
    const url = projectId ? `/api/chat/messages?project_id=${projectId}` : '/api/chat/messages';
    const messages = await api(url);
    chatState.messages = messages;
    renderChatMessages();
  } catch (err) {
    console.error('Erro ao carregar mensagens:', err);
  }
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  if (chatState.messages.length === 0) {
    container.innerHTML = '<div class="chat-empty">Nenhuma mensagem ainda. Seja o primeiro a escrever!</div>';
    return;
  }
  container.innerHTML = chatState.messages.map(m => {
    const roleClass = m.senderRole || 'requester';
    const roleLabels = { requester: 'Solicitante', marketing: 'Marketing', management: 'Gerência' };
    const roleLabel = roleLabels[m.senderRole] || m.senderRole;
    const time = new Date(m.createdAt + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const initials = m.sender ? m.sender.charAt(0).toUpperCase() : '?';
    return `
      <div class="chat-msg">
        <div class="chat-msg-avatar ${roleClass}">${initials}</div>
        <div class="chat-msg-body">
          <div class="chat-msg-header">
            <span class="chat-msg-name">${escapeHtml(m.sender)}</span>
            <span class="chat-msg-role ${roleClass}">${roleLabel}</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          <div class="chat-msg-text">${escapeHtml(m.message)}</div>
        </div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

window.sendChatMessage = async function () {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  try {
    const projectId = getChatProjectId();
    await api('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ projectId, message: text }),
    });
    await loadChatMessages();
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
  }
};

function startChatPolling() {
  stopChatPolling();
  chatState.pollInterval = setInterval(async () => {
    if (!chatState.open) return;
    try {
      const projectId = getChatProjectId();
      const url = projectId ? `/api/chat/messages?project_id=${projectId}` : '/api/chat/messages';
      const messages = await api(url);
      if (messages.length > chatState.messages.length) {
        chatState.messages = messages;
        renderChatMessages();
      }
    } catch (err) {
      // ignore polling errors
    }
  }, 5000);
}

function stopChatPolling() {
  if (chatState.pollInterval) {
    clearInterval(chatState.pollInterval);
    chatState.pollInterval = null;
  }
}

function updateChatBadge() {
  const badge = document.getElementById('chatBadge');
  if (!badge) return;
  if (chatState.unreadCount > 0) {
    badge.textContent = chatState.unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function setupChatProjectChannel() {
  const btn = document.getElementById('projectChannelBtn');
  if (!btn) return;
  if (state.currentProject) {
    btn.style.display = 'flex';
    btn.textContent = `Projeto: ${state.currentProject.title.substring(0, 20)}${state.currentProject.title.length > 20 ? '...' : ''}`;
  } else {
    btn.style.display = 'none';
    if (chatState.channel === 'project') {
      switchChatChannel('general');
    }
  }
}

// Hook into existing render to inject chat
const _origRender = render;
render = function () {
  _origRender();
  injectChatToggle();
  injectChatPanel();
  setupChatProjectChannel();
};

// === INIT ===
window.addEventListener('hashchange', function () { cleanupProfilePopup(); render(); });
window.addEventListener('load', render);

var _profileObserver = new MutationObserver(function () {
  var btn = document.getElementById('profileTabBtn');
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();

      if (!document.getElementById('profilePopupFixed')) {
        createProfilePopup();
      }

      var popup = document.getElementById('profilePopupFixed');
      if (!popup) return;

      var rect = btn.getBoundingClientRect();
      popup.style.left = rect.left + 'px';
      popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
      popup.style.top = 'auto';
      popup.style.right = 'auto';

      if (popup.style.display === 'block') {
        popup.style.display = 'none';
        btn.classList.remove('active');
      } else {
        popup.style.display = 'block';
        btn.classList.add('active');
      }
    });
  }
});
_profileObserver.observe(document.getElementById('app'), { childList: true, subtree: true });

document.addEventListener('click', function () {
  var popup = document.getElementById('profilePopupFixed');
  if (popup) popup.style.display = 'none';
  var btn = document.getElementById('profileTabBtn');
  if (btn) btn.classList.remove('active');
});
