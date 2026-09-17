# Plano de Implementação — Correção Obrigatória Maré / Maricultura Nordeste

Este documento estabelece o plano de arquitetura, correções estruturais e verificação para resolver todas as falhas apontadas no relatório de auditoria do sistema **Maré — Maricultura Nordeste**.

---

## Security Threat Model

### Component Overview
O sistema **Maré — Maricultura Nordeste** é uma aplicação full-stack (Express 4 + Vite + React 19 + TypeScript) voltada para gestão aquícola de engorda e larvicultura de camarão no Nordeste brasileiro. A aplicação opera com dois ambientes de execução:
1. **Demonstração (`demo`)**: Ambiente interativo em memória, isolado para exploração de funcionalidades com dados fictícios.
2. **Minha Empresa (`real`)**: Ambiente de produção com persistência em disco, dados operacionais e financeiros reais, usuários restritos e conformidade fiscal.

### Entry Points and Untrusted Inputs
| Entry Point | Type | Trusted? | Validation |
|---|---|---|---|
| `POST /api/auth/login` | HTTP REST | Não | Validação de campos obrigatórios, rate-limiting (5 tentativas em 15 min), comparação criptográfica em tempo constante via PBKDF2-SHA512. |
| `POST /api/auth/setup-owner` | HTTP REST | Não | Permitido estritamente quando não houver proprietário provisionado. Validação de força de senha. |
| `GET /api/state`, `/api/batches`, etc. | HTTP REST | Não | Segregação estrita por sessão do servidor. Headers de papel (`x-user-role`, `x-company-id`) são ignorados. |
| `POST /api/documents/upload` | HTTP multipart | Não | Limite rígido inclusivo de 100.000.000 bytes, bloqueio de extensões executáveis perigosas, hash SHA-256 verificado. |
| `POST /api/backups/:id/restore` | HTTP REST | Não | Restrito a `PROPRIETARIO` real. Validação prévia de manifesto com SHA-256 de todos os arquivos em área de staging antes de tocar no destino. |
| `POST /api/scheduler/run/:id` | HTTP REST | Não | Restrito a `PROPRIETARIO` e `GERENTE` reais. Bloqueio no modo demo. |

### Trust Boundaries and Auth Assumptions
- **Fronteira Cliente-Servidor**: O cliente (browser) é completamente não confiável. Tokens de sessão são gerados com 32 bytes criptográficos aleatórios no servidor. O servidor extrai o token exclusivamente do cabeçalho `Authorization: Bearer <token>` ou `x-auth-token`.
- **Fronteira Demo vs. Real**: O modo demonstração é estritamente isolado da base real. Requisições em modo demo nunca acessam arquivos de usuários, backups reais ou mutações persistidas.
- **Fronteira de Papéis (RBAC)**: O papel do usuário é derivado unicamente do registro da sessão no servidor. Operações administrativas reais são exclusivas do perfil `PROPRIETARIO`.

### Sensitive Data Paths
| Data Type | Source | Destination | Protection |
|---|---|---|---|
| Credenciais (senhas) | Browser (login/setup) | Servidor | PBKDF2-SHA512 (100.000 iterações, salt 32 bytes, timingSafeEqual). Nunca persistida em texto claro ou retornada na API. |
| Sessões Ativas | Servidor (`crypto.randomBytes`) | Memória / Header | Chave aleatória de 256 bits, TTL de expiração e revogação imediata em mutações de usuário. |
| Dados Operacionais Reais | Servidor | `data/real_store.json` | Transações atômicas com cópia isolada antes da persistência; quarentena automática em corrupção. |
| Backups | `data/` | `data/backups/` | Manifesto com hash SHA-256 por arquivo e integridade verificada antes de substituição. |
| Trilha de Auditoria | Servidor | `data/audit_trail.jsonl` | Append-only com hash SHA-256 encadeado e retenção controlada. |

### Privileged Actions
| Action | Location | Guard |
|---|---|---|
| Criação/Exclusão de Usuários | `server/auth.ts`, `server.ts` | Requer sessão real válida com papel `PROPRIETARIO`. |
| Restauração de Backup | `server/storage.ts`, `server.ts` | Requer sessão real válida com papel `PROPRIETARIO` + staging e validação de hash. |
| Reconfiguração Institucional | `server.ts` | Requer sessão real válida com papel `PROPRIETARIO`. |
| Execução Manual de Scheduler | `server/scheduler.ts`, `server.ts` | Requer sessão real válida com papel `PROPRIETARIO` ou `GERENTE`. |

### Priority Review Areas
1. Bloqueio irrestrito de qualquer operação administrativa no modo demo ou por chamadas não autenticadas.
2. Eliminação de senhas padrão ('123456', 'Mudar@2026'), eliminação de login via hash e fail-closed da base de usuários.
3. Alinhamento exato do contrato de autenticação (`session`, `token`, `user`) entre servidor, `LoginModal.tsx` e `src/App.tsx`.
4. Transações atômicas de persistência evitando divergência entre memória e disco em falhas de I/O.
5. Validação de manifesto com hash SHA-256 e restauração segura em staging.
6. Remoção de progresso fictício em PDFs e tratamento real de status (`PENDENTE_CONFERENCIA_MANUAL`).
7. Agendamento com fuso horário America/Fortaleza e regra de estoque idêntica ao painel (`diasCobertura <= prazoEntrega + estoqueSeguranca`).
8. Suíte de testes automatizados com requisições e componentes reais, sem alterar a base de produção.
9. Script de empacotamento que exclui credenciais, locks, backups e bancos operacionais do ZIP final.

---

## Verification Plan

### Security Verification
- **Security Scan**: Inspecionar todos os arquivos alterados quanto a vulnerabilidades CWE/OWASP (CWE-287, CWE-285, CWE-307, CWE-208, CWE-200, CWE-319, CWE-400).
- **Security Audit**: Auditar a implementação contra o modelo de ameaças e gerar o relatório no artefato `walkthrough.md` com a skill `generate-security-audit-report`.
- **PoC Verification**: Desenvolver cenários de exploit (tentativa de bypass administrativo via demo, tentativa de login com hash, teste de falha de persistência atômica, restauração com manifesto corrompido) e documentar a prova de bloqueio via skill `run-poc`.
- **Test Suite Execution**: Executar a suíte de testes de integração com `npx tsx` e verificar que todas as 21 rotinas retornam resultados comprovados sem mocks duplicados da lógica do app.
- **Build & Packaging**: Compilar a aplicação com `npm run build` e gerar o ZIP de entrega limpo, confirmando a ausência de arquivos sensíveis.
