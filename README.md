# Azul — Sistema de Comunicação entre Verticais e Marketing

Projeto acadêmico do Inteli Camp. Todos os dados são fictícios.

**Problema central:** Falta de comunicação das Unidades de Negócio da Azul com o marketing — distanciamento da campanha aos ideais da empresa, falta de tempo para correção, perda de valor do produto.

## Sobre

Aplicação web para melhorar a comunicação entre as unidades de negócio (logística, manutenção, operações, atendimento) e o setor de marketing de uma companhia aérea fictícia.

**Regra central:** a IA estrutura, o marketing recomenda, o solicitante desenvolve, a gerência decide.

## Tecnologias

- Node.js + Express (backend)
- SQLite + better-sqlite3 (banco de dados)
- HTML + CSS + JavaScript (frontend SPA)
- OpenRouter (IA via API)

## Estrutura de Arquivos

```
src/
  server.js          Servidor Express com todas as rotas da API
  db.js              Configuração e inicialização do SQLite
  openrouter.js      Integração com OpenRouter para refinamento por IA
  project-service.js Lógica de negócio das propostas
  validation.js      Validação de dados de entrada
data/
  knowledge-base.json Base de conhecimento simulada para a IA
  inteli-camp.db     Banco SQLite (criado automaticamente)
public/
  index.html         Página principal (SPA)
  styles.css         Estilos da interface
  app.js             Lógica do frontend (roteamento, páginas, chamadas API)
.env.example         Exemplo de configuração
package.json         Dependências do projeto
```

## Como Executar

1. Instale as dependências:
   ```
   npm install
   ```

2. Configure a chave do OpenRouter (opcional para testar o restante do sistema):
   ```
   cp .env.example .env
   ```
   Edite o arquivo `.env` e adicione sua chave:
   ```
   OPENROUTER_API_KEY=sua_chave_aqui
   ```

3. Inicie o servidor:
   ```
   npm start
   ```

4. Acesse no navegador:
   ```
   http://localhost:3000
   ```

5. Para dados de demonstração, faça uma requisição POST:
   ```
   curl -X POST http://localhost:3000/api/seed
   ```

## Configuração do OpenRouter

1. Crie uma conta em [openrouter.ai](https://openrouter.ai)
2. Gere uma chave de API
3. Adicione no arquivo `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-sua-chave-aqui
   OPENROUTER_MODEL=openrouter/free
   ```

Se a chave não estiver configurada, o restante do sistema funciona normalmente — apenas o refinamento por IA fica indisponível.

## Fluxo do Sistema

1. **Solicitante** → Cria proposta → Edita → Envia ao marketing
2. **Marketing** → Analisa e registra feedback consultivo (não aprova/reprova)
3. **Solicitante** → Revisa feedback → Encaminha à gerência
4. **Gerência** → Autoriza, solicita ajustes ou encerra (decisão final)

## Perfis de Usuário (login simulado)

| Perfil | Acesso |
|--------|--------|
| Solicitante | Criar propostas, editar, enviar ao marketing |
| Marketing | Feedback consultivo |
| Gerência | Decisão final (autorizar, ajustes, encerrar) |

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status do servidor |
| GET | `/api/projects` | Listar projetos |
| POST | `/api/projects` | Criar projeto |
| GET | `/api/projects/:id` | Detalhes do projeto |
| POST | `/api/projects/:id/refine` | Refinar com IA |
| POST | `/api/projects/:id/versions` | Criar nova versão |
| POST | `/api/projects/:id/submit-marketing` | Enviar ao marketing |
| POST | `/api/projects/:id/marketing-feedback` | Feedback do marketing |
| POST | `/api/projects/:id/submit-management` | Enviar à gerência |
| POST | `/api/projects/:id/management-decision` | Decisão gerencial |
| POST | `/api/projects/:id/archive` | Arquivar proposta |
| POST | `/api/seed` | Criar dados de demonstração |

## Testes Executados

- GET /api/health → 200 OK
- POST /api/projects → Cria projeto com versão 1
- POST /api/projects/:id/refine (sem API key) → 503 com mensagem explicativa
- POST /api/projects/:id/versions → Cria versão 2, mantém versão 1
- POST /api/projects/:id/submit-marketing → Altera status
- POST /api/projects/:id/marketing-feedback → Registra feedback, não aprova/reprova
- POST /api/projects/:id/submit-management → Encaminha à gerência
- POST /api/projects/:id/management-decision → Autoriza/solicita ajustes/encerra
- POST /api/projects/:id/archive → Arquivamento mantém histórico
- Validações: campos obrigatórios, IDs inválidos, ações incompatíveis com status
- Havia 2 projetos anteriores no banco (migração de testes anteriores)

## Limitações

- Login simulado (sem autenticação real)
- Refinamento por IA depende de chave OpenRouter configurada
- Protótipo acadêmico — sem criptografia, sem autorização real
- Dados fictícios — não usar com informações reais
