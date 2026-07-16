import { Router } from 'express';

const USERS = [
  { login: 'solicitante1', password: 'azul123', role: 'requester', name: 'Ana Silva', cargo: 'Solicitante' },
  { login: 'marketing1', password: 'azul123', role: 'marketing', name: 'Carlos Mendes', cargo: 'Marketing' },
  { login: 'gerencia1', password: 'azul123', role: 'management', name: 'Dra. Beatriz Oliveira', cargo: 'Gerência' },
];

const sessions = new Map();
let sessionIdCounter = 1;

export function getUserFromSession(sessionId) {
  if (!sessionId) return null;
  const userId = sessions.get(sessionId);
  if (!userId) return null;
  return USERS.find(u => u.login === userId) || null;
}

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
  }
  const user = USERS.find(u => u.login === login && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Login ou senha inválidos.' });
  }
  const sessionId = String(sessionIdCounter++);
  sessions.set(sessionId, user.login);
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({
    login: user.login,
    name: user.name,
    role: user.role,
    cargo: user.cargo,
  });
});

authRouter.post('/logout', (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie('session_id');
  res.json({ message: 'Logout realizado.' });
});

authRouter.get('/me', (req, res) => {
  const sessionId = req.cookies?.session_id;
  const user = getUserFromSession(sessionId);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  res.json({
    login: user.login,
    name: user.name,
    role: user.role,
    cargo: user.cargo,
  });
});

export function requireAuth(req, res, next) {
  const sessionId = req.cookies?.session_id;
  const user = getUserFromSession(sessionId);
  if (!user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }
    return res.redirect('/login');
  }
  req.user = user;
  next();
}
