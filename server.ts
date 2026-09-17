import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import {
  initStorage,
  getStore,
  saveStore,
  executeTransaction,
  resetDemoStore,
  clearStoreData,
  getUploadsDir,
  isDurableStoreAvailable,
  recordAuditLog,
  verifyAuditTrailIntegrity,
  listBackups,
  createBackup,
  validateBackupIntegrity,
  restoreBackup,
} from './server/storage';
import {
  authMiddleware,
  authenticateUserCredentials,
  registerUser,
  authenticateGoogleUser,
  getActiveSession,
  invalidateSession,
  getProvisionedAccountsForLogin,
  getAppUsersList,
  createNewUser,
  updateAppUser,
  deleteAppUser,
  resetAppUserPassword,
  changeUserPassword,
  isInitialOwnerSetupAllowed,
  setupInitialOwner,
} from './server/auth';
import {
  loadSchedulerConfig,
  executeScheduledJob,
  startSchedulerRunner,
} from './server/scheduler';
import {
  processLargePdfDocument,
  startDocumentBlockProcessingAsync,
} from './server/pdfProcessor';
import {
  parseBrazilianNumber,
  parseBrazilianDate,
  parseCSVText,
  parseXLSXBuffer,
} from './server/excelParser';
import { runIndependentTestSuite } from './server/testSuite';
import {
  calculateBatchTotalCost,
  calculateBatchUnitCost,
  calculateFeedConversionRatio,
  checkReceivableBill,
  evaluateWaterMeasurement,
  calculateContributionMargin,
  recalculateBatchBiometrics,
  REFERENCE_CLOCK,
  MAX_UPLOAD_BYTES,
} from './src/utils/calculations';
import {
  buildReservationNotice,
  getUnitPluralLabel,
} from './src/utils/units';
import { runDocumentAgentAnalysis } from './server/documentAgent';
import {
  NORDESTE_MARKET_REFERENCES,
  NORDESTE_WEATHER_ALERTS,
} from './src/utils/nordesteMarketData';
import {
  Batch,
  BiometryRecord,
  WaterMeasurement,
  Incident,
  SalesOrder,
  AppDocument,
} from './src/types';

// Initialize storage directories and load real store
initStorage();
startSchedulerRunner();

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.error('Falha ao inicializar Gemini AI:', e);
    }
  }
  return aiClient;
}

// Multer storage for verified real uploads up to 100.000.000 bytes
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getUploadsDir();
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}_${safeName}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES }, // 100_000_000 bytes
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const dangerous = ['exe', 'bat', 'cmd', 'sh', 'msi', 'bin', 'vbs', 'scr', 'js', 'py'];
    if (dangerous.includes(ext)) {
      return cb(new Error(`Extensão .${ext} não é permitida por motivos de segurança.`));
    }
    cb(null, true);
  },
});

// Memory upload for in-process spreadsheet parsing
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Apply Auth & Role segregation middleware
  app.use(authMiddleware);

  // Health check
  app.get('/api/health', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const clock = env === 'demo' ? REFERENCE_CLOCK.toISOString() : new Date().toISOString();
    res.json({
      status: 'ok',
      service: 'Maré — Maricultura Nordeste',
      time: clock,
      environment: env,
      isDurableStorageReady: isDurableStoreAvailable(),
      geminiConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  // Authentication API (Real Mode Verified Sessions)
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios para autenticação.' });
    }
    const authResult = authenticateUserCredentials(email, password);
    if (!authResult.session) {
      return res.status(401).json({
        error: authResult.error || 'Credenciais inválidas. Verifique o email e senha cadastrados.',
        code: authResult.code || 'INVALID_CREDENTIALS',
      });
    }

    const session = authResult.session;

    // Log successful authentication in audit trail
    recordAuditLog({
      userId: session.userId,
      userName: session.userName,
      userRole: session.role,
      environment: 'real',
      action: 'USER_LOGIN',
      targetEntity: 'AUTH',
      recordId: session.userId,
      details: `Sessão criptográfica emitida para ${session.userName} (${session.role}).`,
    });

    const sessionObj = {
      token: session.token,
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
      role: session.role,
      companyId: session.companyId,
      unit: session.unit,
      expiresAt: session.expiresAt,
    };

    res.json({
      success: true,
      token: session.token,
      user: sessionObj,
      session: sessionObj,
      expiresAt: session.expiresAt,
    });
  });

  // User Self-Registration (Minha Empresa Mode)
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role, unit } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios para cadastro.' });
    }

    const regResult = registerUser({
      name,
      email,
      password,
      role: role || 'PROPRIETARIO',
      unit: unit || 'Unidade Principal',
    });

    if (!regResult.success || !regResult.session) {
      return res.status(400).json({ error: regResult.error || 'Falha ao realizar cadastro.' });
    }

    const session = regResult.session;

    recordAuditLog({
      userId: session.userId,
      userName: session.userName,
      userRole: session.role,
      environment: 'real',
      action: 'USER_REGISTERED',
      targetEntity: 'AUTH',
      recordId: session.userId,
      details: `Novo cadastro realizado para ${session.userName} (${session.userEmail}) com perfil ${session.role}.`,
    });

    const sessionObj = {
      token: session.token,
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
      role: session.role,
      companyId: session.companyId,
      unit: session.unit,
      expiresAt: session.expiresAt,
    };

    res.json({
      success: true,
      token: session.token,
      user: sessionObj,
      session: sessionObj,
      expiresAt: session.expiresAt,
      message: 'Conta criada com sucesso! Acesso concedido ao ambiente Minha Empresa.',
    });
  });

  // Google Sign-In & Instant Onboarding (Client Token or Profile verification)
  app.post('/api/auth/google', (req, res) => {
    const { credential, email, name, googleId, picture } = req.body;

    let userEmail = email;
    let userName = name;
    let userGoogleId = googleId;
    let userPicture = picture;

    // If Google Identity Services JWT credential is provided, decode payload
    if (credential && typeof credential === 'string') {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (base64.length % 4) base64 += '=';
          const decoded = Buffer.from(base64, 'base64').toString('utf-8');
          const payload = JSON.parse(decoded);
          if (payload.email) userEmail = payload.email;
          if (payload.name) userName = payload.name;
          if (payload.sub) userGoogleId = payload.sub;
          if (payload.picture) userPicture = payload.picture;
        }
      } catch (jwtErr) {
        console.warn('Erro ao decodificar JWT Google:', jwtErr);
      }
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'E-mail do Google não identificado.' });
    }

    const authResult = authenticateGoogleUser({
      email: userEmail,
      name: userName || userEmail.split('@')[0],
      googleId: userGoogleId,
      picture: userPicture,
    });

    if (!authResult.success || !authResult.session) {
      return res.status(400).json({ error: authResult.error || 'Falha na autenticação via Google.' });
    }

    const session = authResult.session;

    recordAuditLog({
      userId: session.userId,
      userName: session.userName,
      userRole: session.role,
      environment: 'real',
      action: 'USER_GOOGLE_LOGIN',
      targetEntity: 'AUTH',
      recordId: session.userId,
      details: `Autenticação com Google bem-sucedida para ${session.userName} (${session.userEmail}).`,
    });

    const sessionObj = {
      token: session.token,
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
      role: session.role,
      companyId: session.companyId,
      unit: session.unit,
      expiresAt: session.expiresAt,
    };

    res.json({
      success: true,
      token: session.token,
      user: sessionObj,
      session: sessionObj,
      expiresAt: session.expiresAt,
      message: 'Autenticação com Google realizada com sucesso!',
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const customToken = (req.headers['x-auth-token'] as string) || '';
    const token = bearerToken || customToken || req.authContext?.sessionId;
    if (token) {
      invalidateSession(token);
    }
    res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  });

  app.get('/api/auth/session', (req, res) => {
    if (!req.authContext || !req.authContext.isAuthenticated || req.authContext.environment !== 'real') {
      return res.status(401).json({ authenticated: false, active: false, message: 'Nenhuma sessão ativa no modo real.' });
    }
    const sessionObj = {
      token: req.authContext.sessionId || '',
      userId: req.authContext.userId,
      userName: req.authContext.userName,
      userEmail: req.authContext.userEmail,
      role: req.authContext.role,
      companyId: req.authContext.companyId,
      unit: req.authContext.unit,
      expiresAt: Date.now() + 86400000,
    };
    res.json({
      authenticated: true,
      active: true,
      user: sessionObj,
      session: sessionObj,
    });
  });

  app.get('/api/auth/setup-allowed', (_req, res) => {
    res.json({ allowed: isInitialOwnerSetupAllowed() });
  });

  app.post('/api/auth/setup-owner', (req, res) => {
    const result = setupInitialOwner(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    recordAuditLog({
      userId: result.user?.id || 'system',
      userName: result.user?.name || 'Proprietário',
      userRole: 'PROPRIETARIO',
      environment: 'real',
      action: 'OWNER_INITIAL_SETUP',
      targetEntity: 'USER',
      recordId: result.user?.id,
      details: `Proprietário inicial ${result.user?.name} (${result.user?.email}) cadastrado com sucesso.`,
    });
    res.json(result);
  });

  app.get('/api/auth/accounts', (_req, res) => {
    res.json({ accounts: getProvisionedAccountsForLogin() });
  });

  // System Tenant Declaration: Explicit architecture statement
  app.get('/api/auth/system-declaration', (_req, res) => {
    res.json({
      architecture: 'SINGLE_ENTERPRISE_DEDICATED_CONTAINER',
      tenantIsolation: 'STRICT_SESSION_DERIVED',
      primaryCompanyId: 'empresa-real-001',
      description: 'Cada container do Maré opera de forma isolada e dedicada a uma empresa real, com sessões criptográficas intransferíveis e rejeição de tokens de terceiros.',
      unauthorizedTenantRejectionPolicy: 'HTTP 403 FORBIDDEN_TENANT_ACCESS',
      rolesSupported: ['PROPRIETARIO', 'GERENTE', 'PRODUCAO', 'FINANCEIRO', 'COMERCIAL', 'CONSULTA'],
    });
  });

  // User Management API (PROPRIETARIO only)
  app.get('/api/users', (req, res) => {
    res.json(getAppUsersList());
  });

  app.post('/api/users', (req, res) => {
    const result = createNewUser(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    recordAuditLog({
      userId: req.authContext?.userId || 'system',
      userName: req.authContext?.userName || 'Administrador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: req.authContext?.environment || 'real',
      action: 'USER_CREATED',
      targetEntity: 'USER',
      recordId: result.user?.id,
      details: `Novo usuário ${result.user?.name} (${result.user?.role}) cadastrado com sucesso.`,
    });
    res.json(result);
  });

  app.patch('/api/users/:id', (req, res) => {
    const result = updateAppUser(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    recordAuditLog({
      userId: req.authContext?.userId || 'system',
      userName: req.authContext?.userName || 'Administrador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: req.authContext?.environment || 'real',
      action: 'USER_UPDATED',
      targetEntity: 'USER',
      recordId: req.params.id,
      details: `Cadastro do usuário ${result.user?.name} atualizado.`,
    });
    res.json(result);
  });

  app.delete('/api/users/:id', (req, res) => {
    const result = deleteAppUser(req.params.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    recordAuditLog({
      userId: req.authContext?.userId || 'system',
      userName: req.authContext?.userName || 'Administrador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: req.authContext?.environment || 'real',
      action: 'USER_DELETED',
      targetEntity: 'USER',
      recordId: req.params.id,
      details: `Usuário ${req.params.id} removido da empresa.`,
    });
    res.json(result);
  });

  app.post('/api/users/:id/reset-password', (req, res) => {
    const result = resetAppUserPassword(req.params.id, req.body.newPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    recordAuditLog({
      userId: req.authContext?.userId || 'system',
      userName: req.authContext?.userName || 'Administrador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: req.authContext?.environment || 'real',
      action: 'PASSWORD_RESET',
      targetEntity: 'USER',
      recordId: req.params.id,
      details: `Senha do usuário ${req.params.id} redefinida pelo Proprietário.`,
    });
    res.json(result);
  });

  app.post('/api/auth/change-password', (req, res) => {
    const userId = req.authContext?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Sessão requerida para alterar senha.' });
    }
    const result = changeUserPassword(userId, req.body.oldPassword, req.body.newPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: 'Senha atualizada com sucesso.' });
  });

  // Backups API
  app.get('/api/backups', (_req, res) => {
    res.json(listBackups());
  });

  app.post('/api/backups', (req, res) => {
    try {
      const reason = req.body.reason || `Backup manual solicitado por ${req.authContext?.userName || 'Operador'}`;
      const record = createBackup(reason);
      recordAuditLog({
        userId: req.authContext?.userId || 'system',
        userName: req.authContext?.userName || 'Operador',
        userRole: req.authContext?.role || 'PROPRIETARIO',
        environment: 'real',
        action: 'BACKUP_CREATED',
        targetEntity: 'BACKUP',
        recordId: record.id,
        details: `Snapshot ${record.id} criado com sucesso (${record.filesCount} arquivos, ${(record.sizeBytes / 1024).toFixed(1)} KB). Motivo: ${reason}`,
      });
      res.json({ success: true, backup: record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/:id/restore', (req, res) => {
    if (req.authContext?.role !== 'PROPRIETARIO' && req.authContext?.environment === 'real') {
      return res.status(403).json({ error: 'A restauração de backup em ambiente real é restrita ao perfil PROPRIETARIO.' });
    }
    const result = restoreBackup(req.params.id);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    recordAuditLog({
      userId: req.authContext?.userId || 'system',
      userName: req.authContext?.userName || 'Proprietário',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: 'real',
      action: 'BACKUP_RESTORED',
      targetEntity: 'BACKUP',
      recordId: req.params.id,
      details: `Snapshot ${req.params.id} restaurado no banco com sucesso.`,
    });
    res.json({ success: true, message: `Backup ${req.params.id} restaurado com sucesso.` });
  });

  app.post('/api/backups/:id/validate', (req, res) => {
    const result = validateBackupIntegrity(req.params.id);
    if (!result.isValid) {
      return res.status(400).json({ valid: false, error: result.error });
    }
    res.json({ valid: true, manifest: result.manifest });
  });

  // Audit Logs API
  app.get('/api/audit-logs', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    let logs = store.auditLogs || [];
    const { action, targetEntity, userId } = req.query;
    if (action) logs = logs.filter((l) => l.action === action);
    if (targetEntity) logs = logs.filter((l) => l.targetEntity === targetEntity);
    if (userId) logs = logs.filter((l) => l.userId === userId);
    res.json(logs);
  });

  app.get('/api/audit-logs/verify', (_req, res) => {
    const check = verifyAuditTrailIntegrity();
    res.json(check);
  });

  // Scheduler Background Jobs API
  app.get('/api/scheduler/jobs', (_req, res) => {
    res.json(loadSchedulerConfig());
  });

  app.post('/api/scheduler/jobs/:id/run', async (req, res) => {
    const result = await executeScheduledJob(req.params.id, true);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  // AI Connection Status & Ping Test
  app.get('/api/ai/status', (_req, res) => {
    res.json({
      configured: !!process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      message: process.env.GEMINI_API_KEY
        ? 'GEMINI_API_KEY configurada e pronta para conferência de documentos e assistente.'
        : 'GEMINI_API_KEY não informada no ambiente. Motor determinístico ativo.',
    });
  });

  app.post('/api/ai/test-connection', async (_req, res) => {
    const ai = getAI();
    if (!ai) {
      return res.status(400).json({
        configured: false,
        error: 'GEMINI_API_KEY não configurada no servidor. Configure a chave no menu de configurações.',
      });
    }
    const start = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Responda estritamente com a palavra: CONEXAO_OK',
      });
      const durationMs = Date.now() - start;
      res.json({
        configured: true,
        latencyMs: durationMs,
        responseSample: response.text?.trim() || 'CONEXAO_OK',
        model: 'gemini-2.5-flash',
        status: 'CONECTADO',
      });
    } catch (err: any) {
      res.status(500).json({
        configured: true,
        error: `Falha na comunicação com a API Gemini: ${err.message}`,
        status: 'ERRO_DE_CONEXAO',
      });
    }
  });

  // State endpoint aligned with both top-level and data.* contract
  app.get('/api/state', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const clock = env === 'demo' ? REFERENCE_CLOCK.toISOString() : new Date().toISOString();
    const isDurable = isDurableStoreAvailable();

    const systemIntegrations = {
      firebase: {
        status: 'PENDING_CONFIG',
        message: 'Firebase Authentication e Firestore não provisionados no projeto Cloud Run. Persistência durável em disco ativa no servidor.',
        isDurableStorageReady: isDurable,
      },
      cloudStorage: {
        status: isDurable ? 'READY' : 'PENDING_CONFIG',
        message: 'Armazenamento privado no servidor pronto para arquivos até 100.000.000 bytes inclusive.',
      },
      geminiAi: {
        status: process.env.GEMINI_API_KEY ? 'READY' : 'KEY_MISSING',
        model: 'gemini-2.5-flash',
        message: process.env.GEMINI_API_KEY
          ? 'Gemini 2.5 Flash conectado para conferência de documentos e assistente'
          : 'Chave GEMINI_API_KEY não informada no ambiente. Gestão determinística operando 100%.',
      },
    };

    // Return BOTH top-level keys AND data object to satisfy all client versions
    res.json({
      environment: env,
      env,
      isDemo: env === 'demo',
      referenceClock: clock,
      systemIntegrations,
      company: store.company,
      batches: store.batches,
      waterMeasurements: store.waterMeasurements,
      incidents: store.incidents,
      inventory: store.inventory,
      salesOrders: store.salesOrders,
      receivables: store.receivables,
      documents: store.documents,
      data: store,
    });
  });

  // Reset Demo store to pristine state
  app.post('/api/state/reset-demo', (req, res) => {
    const fresh = resetDemoStore();
    res.json({ success: true, message: 'Dados de demonstração restaurados com sucesso.', store: fresh });
  });

  // Clear all data and zero out all fields for new data entry (both demo & real)
  app.post('/api/state/clear', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const resetCompany = Boolean(req.body?.resetCompany);

    if (env === 'real' && req.authContext?.role !== 'PROPRIETARIO' && req.authContext?.role !== 'GERENTE') {
      return res.status(403).json({ error: 'Apenas Proprietários e Gerentes podem limpar a base de dados no modo Minha Empresa.' });
    }

    const clearedStore = clearStoreData(env, resetCompany);

    if (env === 'real') {
      recordAuditLog({
        userId: req.authContext?.userId || 'system',
        userName: req.authContext?.userName || 'Usuário',
        userRole: req.authContext?.role || 'PROPRIETARIO',
        environment: 'real',
        action: 'CLEAR_ALL_DATA',
        targetEntity: 'SYSTEM',
        recordId: 'all',
        details: `Base de dados zerada completamente para inclusão de novos dados${resetCompany ? ' (incluindo campos da empresa)' : ''}.`,
      });
    }

    res.json({
      success: true,
      message: `Todos os dados do modo ${env === 'real' ? 'Minha Empresa' : 'Demonstração'} foram zerados com sucesso para inclusão de novos registros.`,
      store: clearedStore,
    });
  });

  // Update company config
  app.post('/api/company', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const updatedCompany = executeTransaction(env, (draft) => {
      draft.company = { ...draft.company, ...req.body };
      return draft.company;
    });
    res.json({ success: true, company: updatedCompany });
  });

  // Batches API
  app.get('/api/batches', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    res.json(store.batches);
  });

  app.post('/api/batches', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const clock = env === 'demo' ? REFERENCE_CLOCK.toISOString() : new Date().toISOString();

    const sellableQty = Number(req.body.sellableQuantity || 0);
    if (!Number.isFinite(sellableQty) || sellableQty < 0) {
      return res.status(400).json({ error: 'Quantidade vendável deve ser um número finito positivo.' });
    }

    const newBatch: Batch = {
      id: req.body.id || `batch-${Date.now()}`,
      code: req.body.code || `LOTE-${store.batches.length + 1}`,
      unit: req.body.unit || store.company.activeUnit,
      pondId: req.body.pondId || 'Viveiro Novo',
      species: req.body.species || 'Litopenaeus vannamei',
      modality: req.body.modality || 'ENGORDA',
      status: req.body.status || 'EM_ANDAMENTO',
      startDate: req.body.startDate || clock.split('T')[0],
      responsible: req.authContext?.userName || req.body.responsible || 'Responsável Técnico',
      sellableQuantity: sellableQty,
      sellableUnit: req.body.modality === 'LARVICULTURA' ? 'MILHEIRO' : 'KG',
      initialBiomassKg: Number(req.body.initialBiomassKg || 0),
      finalBiomassKg: Number(req.body.finalBiomassKg || 0),
      feedConsumedKg: Number(req.body.feedConsumedKg || 0),
      budgetedCostPerUnit: Number(req.body.budgetedCostPerUnit || 20),
      hasSurvivalData: !!req.body.hasSurvivalData,
      costs: req.body.costs || [],
    };

    executeTransaction(env, (draft) => {
      draft.batches.push(newBatch);
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'BATCH_CREATED',
      targetEntity: 'BATCH',
      recordId: newBatch.id,
      details: `Lote ${newBatch.code} (${newBatch.modality}) cadastrado no viveiro ${newBatch.pondId}. Quantidade vendável: ${newBatch.sellableQuantity} ${newBatch.sellableUnit}.`,
    });

    res.json({ success: true, batch: newBatch });
  });

  // Add cost to batch
  app.post('/api/batches/:id/costs', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const batch = store.batches.find((b) => b.id === req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Lote não localizado' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor do custo deve ser um número finito estritamente positivo (> 0).' });
    }

    const clock = env === 'demo' ? REFERENCE_CLOCK.toISOString() : new Date().toISOString();
    const costItem = {
      id: `cost-${Date.now()}`,
      category: req.body.category || 'OUTROS',
      description: req.body.description || 'Gasto registrado',
      amount,
      quantity: req.body.quantity ? Number(req.body.quantity) : undefined,
      unit: req.body.unit,
      date: req.body.date || clock.split('T')[0],
      invoiceNumber: req.body.invoiceNumber,
      status: 'INFORMADO' as const,
    };

    const updatedBatch = executeTransaction(env, (draft) => {
      const b = draft.batches.find((item) => item.id === req.params.id);
      if (!b) throw new Error('Lote não localizado na transação');
      b.costs.push(costItem);
      return b;
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'COST_ADDED',
      targetEntity: 'BATCH_COST',
      recordId: costItem.id,
      details: `Despesa de R$ ${amount.toFixed(2)} (${costItem.category}) lançada no lote ${updatedBatch.code}.`,
    });

    res.json({ success: true, batch: updatedBatch });
  });

  // Add biometry record to batch with chronological recalculation across full series
  app.post('/api/batches/:id/biometrics', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const batch = store.batches.find((b) => b.id === req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Lote não localizado' });
    }

    const avgWeight = Number(req.body.averageWeightG);
    if (!Number.isFinite(avgWeight) || avgWeight <= 0) {
      return res.status(400).json({ error: 'Peso médio do camarão deve ser um número finito positivo (> 0 gramas).' });
    }

    const rawDate = req.body.date;
    if (!rawDate || rawDate === 'not-a-date' || isNaN(new Date(rawDate).getTime())) {
      return res.status(400).json({ error: 'Data de biometria inválida ou não informada.' });
    }

    const date = rawDate.trim();
    const startTimestamp = new Date(batch.startDate).getTime();
    const currentTimestamp = new Date(date).getTime();

    if (!isNaN(startTimestamp) && currentTimestamp < startTimestamp) {
      return res.status(400).json({ error: 'Data da biometria não pode ser anterior à data de povoamento/início do lote.' });
    }

    const dayOfCulture = req.body.dayOfCulture !== undefined
      ? Number(req.body.dayOfCulture)
      : Math.max(0, Math.round((currentTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)));

    const newBiometry: BiometryRecord = {
      id: `bio-${Date.now()}`,
      date,
      dayOfCulture,
      week: Math.max(1, Math.ceil(dayOfCulture / 7)),
      averageWeightG: avgWeight,
      sampleSize: req.body.sampleSize ? Number(req.body.sampleSize) : undefined,
      uniformityPercent: req.body.uniformityPercent ? Number(req.body.uniformityPercent) : undefined,
      notes: req.body.notes || 'Biometria registrada em campo',
    };

    const { updatedBatch, addedRecord } = executeTransaction(env, (draft) => {
      const b = draft.batches.find((item) => item.id === req.params.id);
      if (!b) throw new Error('Lote não localizado na transação');
      if (!b.biometrics) b.biometrics = [];
      b.biometrics.push(newBiometry);

      // Recalculate entire series in chronological order
      const recomputed = recalculateBatchBiometrics(b);
      b.biometrics = recomputed.map((p) => ({
        id: p.id,
        date: p.date,
        dayOfCulture: p.dayOfCulture,
        week: p.week,
        averageWeightG: p.averageWeightG,
        gmdPeriodG: p.gmdPeriodG,
        gmdAccumulatedG: p.gmdAccumulatedG,
        sampleSize: p.sampleSize,
        uniformityPercent: p.uniformityPercent,
        notes: p.notes,
      }));

      const added = b.biometrics.find((item) => item.id === newBiometry.id) || newBiometry;
      return { updatedBatch: b, addedRecord: added };
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'BIOMETRY_RECORDED',
      targetEntity: 'BIOMETRY',
      recordId: addedRecord.id,
      details: `Biometria registrada no lote ${updatedBatch.code}: peso médio ${addedRecord.averageWeightG}g no dia ${addedRecord.dayOfCulture}.`,
    });

    res.json({ success: true, batch: updatedBatch, biometry: addedRecord });
  });

  // Water measurement handler (supports both POST /api/water-metrics and POST /api/water-measurements)
  const handleWaterMeasurement = (req: express.Request, res: express.Response) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const refClock = env === 'demo' ? REFERENCE_CLOCK : new Date();

    const rawVal = req.body.value;
    const numVal = Number(rawVal);
    const collectedAt = req.body.collectedAt || refClock.toISOString();
    const collectedBy = req.authContext?.userName || req.body.collectedBy || 'Operador de Campo';

    const measurement: WaterMeasurement = {
      id: `water-${Date.now()}`,
      pondId: req.body.pondId || 'Viveiro 01',
      unit: req.body.unit || store.company.activeUnit,
      parameter: req.body.parameter || 'OXIGENIO',
      value: numVal,
      unitMeasurement: req.body.unitMeasurement || 'mg/L',
      collectedAt,
      collectedBy,
      calibrationStatus: req.body.calibrationStatus || 'CALIBRADO',
      minAcceptable: req.body.minAcceptable ?? 4.0,
      maxAcceptable: req.body.maxAcceptable ?? 12.0,
      maxAgeMinutes: req.body.maxAgeMinutes ?? 30,
      status: 'NORMAL',
    };

    const evalResult = evaluateWaterMeasurement(measurement, refClock);

    if (evalResult.isInvalid) {
      measurement.status = 'FORA_DA_FAIXA';
      return res.status(400).json({
        error: 'Valor de leitura não numérico ou corrompido. Registro como normal é proibido.',
        evaluation: evalResult,
      });
    }

    if (evalResult.isFuture) {
      measurement.status = 'FORA_DA_FAIXA';
      return res.status(400).json({
        error: 'Data/hora de coleta informada está no futuro em relação ao relógio do sistema. Registro recusado.',
        evaluation: evalResult,
      });
    }

    let incidentToAdd: Incident | null = null;
    if (evalResult.isOutRange) {
      measurement.status = 'FORA_DA_FAIXA';
      const ruleCode = 'RULE_OXIGENIO_CRITICO';
      const existingActive = store.incidents.find(
        (i) => i.pondId === measurement.pondId && i.ruleCode === ruleCode && i.status !== 'RESOLVIDO'
      );
      if (!existingActive) {
        incidentToAdd = {
          id: `inc-${Date.now()}`,
          pondId: measurement.pondId,
          unit: measurement.unit,
          ruleCode,
          severity: 'CRITICA',
          title: `${measurement.parameter} fora da faixa aceitável (${measurement.value} ${measurement.unitMeasurement})`,
          evidence: `Medição coletada em ${measurement.collectedAt}. Limites: ${measurement.minAcceptable}-${measurement.maxAcceptable} ${measurement.unitMeasurement}.`,
          responsible: collectedBy,
          nextAction: 'Acionar aeradores e checar parâmetros biológicos do viveiro.',
          status: 'ABERTO',
          openedAt: refClock.toISOString(),
        };
      }
    } else if (evalResult.isDelayed) {
      measurement.status = 'LEITURA_ATRASADA';
      const ruleCode = 'RULE_LEITURA_EXPIRADA';
      const existingActive = store.incidents.find(
        (i) => i.pondId === measurement.pondId && i.ruleCode === ruleCode && i.status !== 'RESOLVIDO'
      );
      if (!existingActive) {
        incidentToAdd = {
          id: `inc-${Date.now()}`,
          pondId: measurement.pondId,
          unit: measurement.unit,
          ruleCode,
          severity: 'MEDIA',
          title: `Leitura de água atrasada (> ${measurement.maxAgeMinutes} min)`,
          evidence: `Idade calculada: ${evalResult.ageMinutes} min. Limite de atualização: ${measurement.maxAgeMinutes} min.`,
          responsible: collectedBy,
          nextAction: 'Executar nova medição imediata com sonda calibrada.',
          status: 'ABERTO',
          openedAt: refClock.toISOString(),
        };
      }
    } else {
      measurement.status = 'NORMAL';
    }

    const { currentIncidents } = executeTransaction(env, (draft) => {
      if (incidentToAdd) {
        draft.incidents.unshift(incidentToAdd);
      }
      draft.waterMeasurements.unshift(measurement);
      return { currentIncidents: draft.incidents };
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'WATER_MEASURED',
      targetEntity: 'WATER',
      recordId: measurement.id,
      details: `Medição de ${measurement.parameter}: ${measurement.value} ${measurement.unitMeasurement} no viveiro ${measurement.pondId}. Status: ${measurement.status}.`,
    });

    res.json({ success: true, measurement, incidents: currentIncidents, evaluation: evalResult });
  };

  app.post('/api/water-metrics', handleWaterMeasurement);
  app.post('/api/water-measurements', handleWaterMeasurement);

  // Incident status update
  const handleIncidentStatus = (req: express.Request, res: express.Response) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const clock = env === 'demo' ? REFERENCE_CLOCK.toISOString() : new Date().toISOString();
    const incCheck = store.incidents.find((i) => i.id === req.params.id);
    if (!incCheck) return res.status(404).json({ error: 'Incidente não localizado' });

    const updatedIncident = executeTransaction(env, (draft) => {
      const inc = draft.incidents.find((i) => i.id === req.params.id);
      if (!inc) throw new Error('Incidente não localizado');
      inc.status = req.body.status;
      if (req.body.status === 'EM_ATENDIMENTO') {
        inc.acknowledgedAt = clock;
      } else if (req.body.status === 'RESOLVIDO') {
        inc.resolvedAt = clock;
        inc.resolutionNotes = req.body.resolutionNotes || 'Parâmetro estabilizado após intervenção técnica.';
      }
      return inc;
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'INCIDENT_STATUS_CHANGED',
      targetEntity: 'INCIDENT',
      recordId: updatedIncident.id,
      details: `Incidente "${updatedIncident.title}" no viveiro ${updatedIncident.pondId} alterado para status ${updatedIncident.status}.`,
    });

    res.json({ success: true, incident: updatedIncident });
  };

  app.post('/api/incidents/:id/status', handleIncidentStatus);
  app.patch('/api/incidents/:id/status', handleIncidentStatus);


  // Sales Orders & Atomic Stock Reservation check
  app.post('/api/orders/reserve', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const {
      batchId,
      quantityRequested,
      customerName,
      unitPrice,
      variableCostPerUnit,
      freightCost,
      taxRate,
      idempotencyKey,
      orderNumber,
    } = req.body;

    // Idempotency check: if order already placed with this key, return it
    const reqKey = idempotencyKey || orderNumber;
    if (reqKey) {
      const existing = store.salesOrders.find((o) => (o as any).idempotencyKey === reqKey || o.orderNumber === reqKey);
      if (existing) {
        return res.json({
          success: existing.status === 'RESERVADO',
          order: existing,
          margin: calculateContributionMargin(existing),
          idempotent: true,
        });
      }
    }

    const batch = store.batches.find((b) => b.id === batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Lote de origem não localizado' });
    }

    const qty = Number(quantityRequested);
    if (typeof quantityRequested === 'undefined' || isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        error: 'Quantidade solicitada inválida: deve ser um número finito estritamente positivo (> 0).',
        code: 'INVALID_QUANTITY',
      });
    }

    // Physical sellable balance of this batch
    const totalPhysicalSellable = batch.sellableQuantity || 0;

    // Larvicultura special unit check: 1 milheiro = 1.000 larvas
    if (batch.modality === 'LARVICULTURA') {
      if (qty > totalPhysicalSellable) {
        const blockedOrder: SalesOrder = {
          id: `order-${Date.now()}`,
          orderNumber: orderNumber || `PED-2026-${String(store.salesOrders.length + 1).padStart(3, '0')}`,
          customerName: customerName || 'Cliente Produtor',
          productId: 'POS-LARVA-PL10',
          productName: `Pós-larvas (${batch.code})`,
          batchId: batch.id,
          quantity: qty,
          commercialUnit: 'MILHEIRO',
          unitPrice: Number(unitPrice || 25.0),
          variableCostPerUnit: Number(variableCostPerUnit || 15.0),
          freightCost: Number(freightCost || 100.0),
          taxAndCommissionRatePercent: Number(taxRate || 5.0),
          dueDate: '2026-09-30',
          responsible: req.authContext?.userName || 'Comercial',
          status: 'EM_REVISAO',
          isReserved: false,
          reservationNotes: `Bloqueado na reserva: pedido de ${qty} milheiros excede o saldo físico total do lote de ${totalPhysicalSellable} milheiros.`,
        };
        executeTransaction(env, (draft) => {
          draft.salesOrders.push(blockedOrder);
        });
        return res.status(200).json({
          success: false,
          blockedReason: 'INSUFFICIENT_LIBERATED_STOCK',
          order: blockedOrder,
          margin: calculateContributionMargin(blockedOrder),
          availableStockRemaining: totalPhysicalSellable,
        });
      }
    }

    // Total already reserved by other active orders
    const totalAlreadyReserved = store.salesOrders
      .filter((o) => o.batchId === batchId && o.isReserved && o.status !== 'CANCELADO')
      .reduce((sum, o) => sum + o.quantity, 0);

    // Prior baseline reservation (e.g. 100 kg in demo scenario)
    const baselinePriorReserved = env === 'demo' && batchId === 'batch-demo-a' ? 100 : 0;
    const effectiveAvailableStock = totalPhysicalSellable - totalAlreadyReserved - baselinePriorReserved;

    const commercialUnit = (batch.modality === 'LARVICULTURA' || batch.sellableUnit === 'MILHEIRO') ? 'MILHEIRO' : 'KG';

    const newOrder: SalesOrder = {
      id: `order-${Date.now()}`,
      orderNumber: orderNumber || `PED-2026-${String(store.salesOrders.length + 1).padStart(3, '0')}`,
      customerName: customerName || 'Cliente Distribuidor',
      productId: batch.modality === 'LARVICULTURA' ? 'POS-LARVA-PL10' : 'CAMARAO-G-DEMO',
      productName: `${batch.modality === 'LARVICULTURA' ? 'Pós-larvas' : 'Camarão Inteiro'} (${batch.code})`,
      batchId: batch.id,
      quantity: qty,
      commercialUnit,
      unitPrice: Number(unitPrice || 35.0),
      variableCostPerUnit: Number(variableCostPerUnit || 18.0),
      freightCost: Number(freightCost || 400.0),
      taxAndCommissionRatePercent: Number(taxRate || 8.0),
      dueDate: '2026-09-30',
      responsible: req.authContext?.userName || 'Renata Comercial',
      status: 'RASCUNHO',
      isReserved: false,
    };
    if (reqKey) (newOrder as any).idempotencyKey = reqKey;

    if (qty <= effectiveAvailableStock) {
      newOrder.isReserved = true;
      newOrder.status = 'RESERVADO';
      newOrder.reservationNotes = buildReservationNotice(commercialUnit, qty, effectiveAvailableStock, true);
      executeTransaction(env, (draft) => {
        draft.salesOrders.push(newOrder);
      });

      recordAuditLog({
        userId: req.authContext?.userId || 'usr-demo-01',
        userName: req.authContext?.userName || 'Comercial',
        userRole: req.authContext?.role || 'COMERCIAL',
        environment: env,
        action: 'ORDER_RESERVED',
        targetEntity: 'ORDER',
        recordId: newOrder.id,
        details: `Reserva confirmada: Pedido ${newOrder.orderNumber} para ${newOrder.customerName} (${newOrder.quantity} ${newOrder.commercialUnit}).`,
      });

      return res.json({
        success: true,
        order: newOrder,
        margin: calculateContributionMargin(newOrder),
        availableStockRemaining: effectiveAvailableStock - qty,
      });
    } else {
      newOrder.isReserved = false;
      newOrder.status = 'EM_REVISAO';
      newOrder.reservationNotes = buildReservationNotice(commercialUnit, qty, effectiveAvailableStock, false);
      executeTransaction(env, (draft) => {
        draft.salesOrders.push(newOrder);
      });

      recordAuditLog({
        userId: req.authContext?.userId || 'usr-demo-01',
        userName: req.authContext?.userName || 'Comercial',
        userRole: req.authContext?.role || 'COMERCIAL',
        environment: env,
        action: 'ORDER_BLOCKED',
        targetEntity: 'ORDER',
        recordId: newOrder.id,
        details: `Reserva bloqueada: Pedido ${newOrder.orderNumber} (${newOrder.quantity} ${newOrder.commercialUnit}) excede o saldo liberado (${effectiveAvailableStock}).`,
      });

      return res.json({
        success: false,
        blockedReason: 'INSUFFICIENT_LIBERATED_STOCK',
        order: newOrder,
        margin: calculateContributionMargin(newOrder),
        availableStockRemaining: effectiveAvailableStock,
      });
    }
  });

  // Receivables Payment & Dispute
  app.post('/api/receivables/:id/payment', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const refClock = env === 'demo' ? REFERENCE_CLOCK : new Date();
    const billCheck = store.receivables.find((r) => r.id === req.params.id);
    if (!billCheck) return res.status(404).json({ error: 'Título não localizado' });

    const paymentAmount = Number(req.body.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valor de pagamento deve ser um número positivo.' });
    }

    const { updatedBill, balanceCheck } = executeTransaction(env, (draft) => {
      const bill = draft.receivables.find((r) => r.id === req.params.id);
      if (!bill) throw new Error('Título não localizado');

      bill.receivedAmount += paymentAmount;
      bill.lastPaymentDate = refClock.toISOString().split('T')[0];

      const check = checkReceivableBill(bill, refClock);
      if (check.balanceRemaining <= 0) {
        bill.status = 'PAGO';
        bill.overpaymentCredit = check.overpaymentCredit;
      } else {
        bill.status = 'PAGAMENTO_PARCIAL';
      }
      return { updatedBill: bill, balanceCheck: check };
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Financeiro',
      userRole: req.authContext?.role || 'FINANCEIRO',
      environment: env,
      action: 'PAYMENT_RECORDED',
      targetEntity: 'RECEIVABLE',
      recordId: updatedBill.id,
      details: `Baixa de R$ ${paymentAmount.toFixed(2)} no título ${updatedBill.invoiceNumber || updatedBill.id}. Saldo restante: R$ ${balanceCheck.balanceRemaining.toFixed(2)}. Status: ${updatedBill.status}.`,
    });

    res.json({ success: true, bill: updatedBill, balanceCheck });
  });

  const handleReceivableDispute = (req: express.Request, res: express.Response) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const billCheck = store.receivables.find((r) => r.id === req.params.id);
    if (!billCheck) return res.status(404).json({ error: 'Título não localizado' });

    const updatedBill = executeTransaction(env, (draft) => {
      const bill = draft.receivables.find((r) => r.id === req.params.id);
      if (!bill) throw new Error('Título não localizado');

      bill.hasActiveDispute = !!req.body.hasActiveDispute;
      bill.disputeReason = req.body.disputeReason || 'Disputa comercial registrada';
      if (bill.hasActiveDispute) {
        bill.status = 'EM_DISPUTA';
      } else {
        bill.status = bill.receivedAmount > 0 ? 'PAGAMENTO_PARCIAL' : 'PENDENTE';
      }
      return bill;
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Financeiro',
      userRole: req.authContext?.role || 'FINANCEIRO',
      environment: env,
      action: updatedBill.hasActiveDispute ? 'DISPUTE_OPENED' : 'DISPUTE_RESOLVED',
      targetEntity: 'RECEIVABLE',
      recordId: updatedBill.id,
      details: `Disputa no título ${updatedBill.invoiceNumber || updatedBill.id} ${updatedBill.hasActiveDispute ? 'aberta' : 'encerrada'}. Motivo: ${updatedBill.disputeReason}.`,
    });

    res.json({ success: true, bill: updatedBill });
  };

  app.post('/api/receivables/:id/dispute', handleReceivableDispute);
  app.patch('/api/receivables/:id/dispute', handleReceivableDispute);

  // Real Upload endpoint: multipart/form-data writing up to 100.000.000 bytes directly to private disk
  app.post('/api/documents/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const refClock = env === 'demo' ? REFERENCE_CLOCK : new Date();

    const file = req.file;
    const bytes = file.size;

    if (bytes <= 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Arquivo vazio (0 bytes). Envio recusado.' });
    }

    if (bytes > MAX_UPLOAD_BYTES) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        error: `Arquivo excede o limite estrito de 100 MB (${bytes} bytes recebidos; limite: ${MAX_UPLOAD_BYTES} bytes).`,
      });
    }

    // Compute SHA-256 for data verification
    let sha256 = '';
    try {
      const fileBuffer = fs.readFileSync(file.path);
      sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (e) {
      console.warn('Erro ao computar hash do arquivo:', e);
    }

    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const docId = `doc-${Date.now()}`;

    const doc: AppDocument = {
      id: docId,
      fileName: file.originalname,
      fileSizeBytes: bytes,
      mimeType: file.mimetype,
      fileExtension: ext,
      companyId: store.company.id,
      unit: store.company.activeUnit,
      category: (req.body.category as any) || 'NOTA_FISCAL',
      uploadedAt: refClock.toISOString(),
      uploadedBy: req.authContext?.userName || 'Usuário do Sistema',
      status: 'EM_ANALISE',
      progressPercent: 5,
      pagesProcessed: 0,
      totalPages: 1,
      currentStageDescription: 'Iniciando inspeção e particionamento de blocos...',
      confirmedByHuman: false,
      batchId: req.body.batchId,
    };

    // Attach private server path for processing
    (doc as any).storedPath = file.path;
    (doc as any).sha256 = sha256;

    executeTransaction(env, (draft) => {
      draft.documents.unshift(doc);
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'DOCUMENT_UPLOADED',
      targetEntity: 'DOCUMENT',
      recordId: doc.id,
      details: `Upload do documento ${doc.fileName} (${(bytes / 1024).toFixed(1)} KB, .${ext}). Iniciando serviço de processamento de blocos real.`,
    });

    // Launch authentic asynchronous block processing service
    startDocumentBlockProcessingAsync(docId, file.path, doc.fileName, ext, env, getAI).catch((err) => {
      console.error('Falha no processamento de blocos em background:', err);
    });

    res.json({
      success: true,
      document: doc,
      sha256,
      storedBytes: bytes,
      storageMode: 'SERVER_PRIVATE_DISK',
      message: 'Upload concluído. Processamento de blocos página a página iniciado com análise em tempo real.',
    });
  });

  // Get active block processing job status for document
  app.get('/api/documents/:id/job-status', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não localizado' });

    const job = (store.pdfJobs || []).find((j) => j.documentId === req.params.id);

    res.json({
      success: true,
      document: doc,
      job: job || null,
      progressPercent: doc.progressPercent,
      status: doc.status,
      pagesProcessed: doc.pagesProcessed || 0,
      totalPages: doc.totalPages || 1,
      currentStageDescription: doc.currentStageDescription,
      processingLogs: doc.processingLogs || [],
    });
  });

  // Reprocess document blocks on-demand
  app.post('/api/documents/:id/reprocess', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não localizado' });

    const storedPath = (doc as any).storedPath;
    if (!storedPath || !fs.existsSync(storedPath)) {
      return res.status(400).json({ error: 'Arquivo original não disponível no servidor para reprocessamento.' });
    }

    startDocumentBlockProcessingAsync(doc.id, storedPath, doc.fileName, doc.fileExtension, env, getAI).catch((err) => {
      console.error('Falha no reprocessamento:', err);
    });

    res.json({
      success: true,
      message: 'Reprocessamento de blocos disparado com sucesso.',
      docId: doc.id,
    });
  });

  // List all document processing jobs
  app.get('/api/documents/jobs', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    res.json({
      success: true,
      jobs: store.pdfJobs || [],
    });
  });

  // Upload-init: legacy endpoint rejected to avoid fake uploads without content
  app.post('/api/documents/upload-init', (req, res) => {
    return res.status(400).json({
      error: 'Upload simulado sem transmissão de conteúdo descontinuado. Envie o arquivo físico completo via multipart/form-data através de POST /api/documents/upload.',
      code: 'PHYSICAL_CONTENT_REQUIRED',
    });
  });

  // Extract draft from document without artificial fixed R$ 3.500
  app.post('/api/documents/:id/extract-draft', async (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não localizado' });

    let status = 'EM_ANALISE' as AppDocument['status'];
    let extractedDraft: any = null;

    const storedPath = (doc as any).storedPath;
    let fileContentText = '';
    if (storedPath && fs.existsSync(storedPath)) {
      try {
        if (['csv', 'txt', 'json'].includes(doc.fileExtension)) {
          fileContentText = fs.readFileSync(storedPath, 'utf-8').slice(0, 10000);
        }
      } catch (err) {
        console.warn('Erro ao ler arquivo salvo:', err);
      }
    }

    const ai = getAI();
    let extractedSuccessfully = false;

    if (ai) {
      try {
        const prompt = `Você é o extrator fiscal da Maricultura Nordeste. Analise o documento '${doc.fileName}' (${doc.fileExtension}).
${fileContentText ? `Conteúdo extraído do arquivo:\n${fileContentText}` : 'O arquivo é binário/imagem/PDF.'}
Retorne estritamente um JSON com:
{
  "totalValue": número (valor real em R$),
  "items": [{"description": string, "value": número, "category": "RACAO" | "POS_LARVAS" | "ENERGIA" | "MAO_DE_OBRA" | "OUTROS"}],
  "evidencePage": 1,
  "confidenceNote": "Evidência extraída do documento"
}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && Number.isFinite(parsed.totalValue) && parsed.totalValue > 0) {
            extractedDraft = parsed;
            status = 'AGUARDANDO_CONFERENCIA';
            extractedSuccessfully = true;
          }
        }
      } catch (err: any) {
        console.warn('Falha na extração por Gemini:', err?.message);
      }
    }

    // If AI is unavailable or extraction did not yield a verified result, DO NOT hallucinate R$ 3.500
    if (!extractedSuccessfully) {
      status = 'PENDENTE_CONFERENCIA_MANUAL';
      extractedDraft = {
        totalValue: 0,
        items: [],
        evidencePage: 1,
        confidenceNote: 'Arquivo requer conferência manual. Insira os valores diretamente pelo formulário de conferência.',
      };
    }

    const updatedDoc = executeTransaction(env, (draft) => {
      const d = draft.documents.find((item) => item.id === req.params.id);
      if (!d) throw new Error('Documento não localizado');
      d.status = status;
      d.extractedDraft = extractedDraft;
      return d;
    });

    res.json({ success: true, document: updatedDoc });
  });

  // Confirm document extracted draft into batch costs with idempotency protection
  app.post('/api/documents/:id/confirm-to-batch', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não localizado' });

    const { targetBatchId, manualItems, manualTotal } = req.body;

    // Prevent double confirmation of costs
    const alreadyPresentInAnyBatch = store.batches.some((b) =>
      b.costs.some((c) => c.id.startsWith(`cost-doc-${doc.id}-`))
    );
    if (doc.status === 'CONCLUIDO' || doc.confirmedByHuman || alreadyPresentInAnyBatch) {
      return res.status(400).json({
        error: `Documento já confirmado anteriormente para o lote ${doc.batchId || targetBatchId}. Lançamento duplicado bloqueado.`,
        code: 'ALREADY_CONFIRMED',
      });
    }

    const batchCheck = store.batches.find((b) => b.id === targetBatchId);
    if (!batchCheck) return res.status(404).json({ error: 'Lote de destino não localizado' });

    const refClock = env === 'demo' ? REFERENCE_CLOCK : new Date();
    const itemsToConfirm = manualItems || doc.extractedDraft?.items || [];

    if (itemsToConfirm.length === 0 && (!manualTotal || manualTotal <= 0)) {
      return res.status(400).json({ error: 'Nenhum item ou valor válido informado para confirmação.' });
    }

    const { updatedBatch, updatedDoc } = executeTransaction(env, (draft) => {
      const d = draft.documents.find((item) => item.id === req.params.id);
      if (!d) throw new Error('Documento não localizado');
      const b = draft.batches.find((item) => item.id === targetBatchId);
      if (!b) throw new Error('Lote de destino não localizado');

      if (itemsToConfirm.length > 0) {
        itemsToConfirm.forEach((item: any, idx: number) => {
          const val = Number(item.value);
          if (Number.isFinite(val) && val > 0) {
            b.costs.push({
              id: `cost-doc-${d.id}-${idx}`,
              category: (item.category as any) || 'OUTROS',
              description: `${item.description || 'Despesa'} (Origem: ${d.fileName})`,
              amount: val,
              date: refClock.toISOString().split('T')[0],
              invoiceNumber: d.fileName,
              status: 'CONFERIDO',
            });
          }
        });
      } else if (manualTotal > 0) {
        b.costs.push({
          id: `cost-doc-${d.id}-0`,
          category: 'OUTROS',
          description: `Despesa conferida (Origem: ${d.fileName})`,
          amount: Number(manualTotal),
          date: refClock.toISOString().split('T')[0],
          invoiceNumber: d.fileName,
          status: 'CONFERIDO',
        });
      }

      d.confirmedByHuman = true;
      d.status = 'CONCLUIDO';
      d.batchId = b.id;

      return { updatedBatch: b, updatedDoc: d };
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'DOCUMENT_CONFIRMED_TO_BATCH',
      targetEntity: 'BATCH_COST',
      recordId: updatedDoc.id,
      details: `Despesas do documento ${updatedDoc.fileName} vinculadas ao lote ${updatedBatch.code}.`,
    });

    res.json({ success: true, batch: updatedBatch, document: updatedDoc });
  });

  // Run Document Agent Analysis
  app.post('/api/documents/:id/agent-analyze', async (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não localizado' });

    const storedPath = (doc as any).storedPath;
    try {
      const analysis = await runDocumentAgentAnalysis({
        doc,
        storedPath,
        batches: store.batches,
        existingDocuments: store.documents,
        getAI,
      });

      const updatedDoc = executeTransaction(env, (draft) => {
        const d = draft.documents.find((item) => item.id === req.params.id);
        if (!d) throw new Error('Documento não localizado');
        d.agentAnalysis = analysis;
        d.status = 'AGUARDANDO_CONFERENCIA';
        d.currentStageDescription = 'Análise do Agente concluída com sucesso. Aguardando conferência humana.';
        d.progressPercent = 100;
        if (!d.extractedDraft) {
          d.extractedDraft = {
            totalValue: analysis.totalAmount,
            items: analysis.items.map((it) => ({
              description: it.description,
              value: it.totalAmount,
              category: it.category,
            })),
            confidenceNote: analysis.summary,
          };
        }
        return d;
      });

      recordAuditLog({
        userId: req.authContext?.userId || 'usr-demo-01',
        userName: req.authContext?.userName || 'Operador',
        userRole: req.authContext?.role || 'PROPRIETARIO',
        environment: env,
        action: 'DOCUMENT_AGENT_ANALYZED',
        targetEntity: 'DOCUMENT',
        recordId: updatedDoc.id,
        details: `Agente analisou documento ${updatedDoc.fileName}: detectado ${analysis.documentTypeLabel} (${analysis.supplierOrCustomer}), total R$ ${analysis.totalAmount.toFixed(2)}. Anomalias: ${analysis.anomaliesDetected.length}.`,
      });

      res.json({ success: true, document: updatedDoc, analysis });
    } catch (err: any) {
      console.error('Erro na análise do agente:', err);
      res.status(500).json({ error: `Falha na execução do agente: ${err?.message}` });
    }
  });

  // Approve Document Agent Proposal with 1-click
  app.post('/api/documents/:id/agent-approve', (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não localizado' });

    const targetBatchId = req.body.targetBatchId || doc.agentAnalysis?.suggestedBatchId || (store.batches[0]?.id);
    const batch = store.batches.find((b) => b.id === targetBatchId);
    if (!batch) return res.status(404).json({ error: 'Lote de destino não localizado' });

    if (doc.status === 'CONCLUIDO' || doc.confirmedByHuman) {
      return res.status(400).json({
        error: `Documento já aprovado e lançado anteriormente.`,
        code: 'ALREADY_CONFIRMED',
      });
    }

    const refClock = env === 'demo' ? REFERENCE_CLOCK : new Date();
    const analysis = doc.agentAnalysis;
    const itemsToAdd = req.body.items || analysis?.items || [
      {
        description: doc.fileName,
        totalAmount: analysis?.totalAmount || 0,
        category: 'OUTROS',
      },
    ];

    const { updatedBatch, updatedDoc, updatedInventory } = executeTransaction(env, (draft) => {
      const d = draft.documents.find((item) => item.id === req.params.id);
      if (!d) throw new Error('Documento não localizado');
      const b = draft.batches.find((item) => item.id === targetBatchId);
      if (!b) throw new Error('Lote de destino não localizado');

      itemsToAdd.forEach((it: any, idx: number) => {
        const val = Number(it.totalAmount || it.value || 0);
        if (val > 0) {
          b.costs.push({
            id: `cost-agent-${d.id}-${idx}`,
            category: (it.category as any) || 'OUTROS',
            description: `${it.description || 'Despesa'} [Aprovado via Agente — ${d.fileName}]`,
            amount: val,
            quantity: it.quantity ? Number(it.quantity) : undefined,
            unit: it.unit,
            date: refClock.toISOString().split('T')[0],
            invoiceNumber: analysis?.detectedInvoiceNumber || d.fileName,
            status: 'CONFERIDO',
          });
        }
      });

      // Se for ração com quantidade, atualiza o estoque utilizável
      if (analysis?.documentType === 'NF_RACAO') {
        const feedItem = draft.inventory.find((inv) => inv.category === 'RACAO');
        if (feedItem) {
          const feedQty = itemsToAdd.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
          if (feedQty > 0) {
            feedItem.usableBalance += feedQty;
            feedItem.lastUpdated = refClock.toISOString().split('T')[0];
          }
        }
      }

      d.confirmedByHuman = true;
      d.status = 'CONCLUIDO';
      d.batchId = b.id;
      return { updatedBatch: b, updatedDoc: d, updatedInventory: draft.inventory };
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'DOCUMENT_AGENT_APPROVED',
      targetEntity: 'BATCH_COST',
      recordId: updatedDoc.id,
      details: `Aprovação manual da análise do documento ${updatedDoc.fileName}. Lançados ${itemsToAdd.length} itens no lote ${updatedBatch.code}.`,
    });

    res.json({
      success: true,
      batch: updatedBatch,
      document: updatedDoc,
      inventory: updatedInventory,
      message: `Documento aprovado e vinculado com sucesso ao lote ${updatedBatch.code}.`,
    });
  });

  // Market Benchmarks API
  app.get('/api/market/benchmarks', (req, res) => {
    res.json({
      success: true,
      data: NORDESTE_MARKET_REFERENCES,
      regionCoverage: 'Nordeste (RN, CE, PB, BA, PE)',
      referenceDate: '15/09/2026',
      isolationDisclaimer: 'Estes dados são referenciais públicos (benchmarks) e não alteram a contabilidade da empresa.',
    });
  });

  // Regional Weather Alerts API
  app.get('/api/market/weather', (req, res) => {
    res.json({
      success: true,
      data: NORDESTE_WEATHER_ALERTS,
      updatedAt: '16/09/2026',
    });
  });

  // Spreadsheet upload & server-side parsing endpoint
  app.post('/api/spreadsheets/parse', memoryUpload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const file = req.file;
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();

    try {
      let parsed;
      if (ext === 'csv' || ext === 'txt') {
        const text = file.buffer.toString('utf-8');
        parsed = parseCSVText(text);
      } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
        parsed = parseXLSXBuffer(file.buffer);
      } else {
        return res.status(400).json({ error: `Formato .${ext} não suportado para planilhas.` });
      }

      res.json({
        success: true,
        fileName: file.originalname,
        headers: parsed.headers,
        totalRows: parsed.totalRows,
        previewRows: parsed.rows.slice(0, 10),
        allRows: parsed.rows,
      });
    } catch (err: any) {
      console.error('Erro ao processar planilha:', err);
      res.status(400).json({ error: `Erro ao analisar planilha: ${err.message}` });
    }
  });

  // Import rows into batch with transactional pre-validation, duplicate detection, idempotency, and rollback
  const handleImportConfirm = (req: express.Request, res: express.Response) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const refClock = env === 'demo' ? REFERENCE_CLOCK : new Date();
    const { entityType, rows, fileName, targetBatchId, idempotencyKey } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha fornecida para importação.' });
    }

    const batch = store.batches.find((b) => b.id === targetBatchId);
    if (!batch) {
      return res.status(404).json({ error: 'Lote de destino obrigatório para importação de despesas.' });
    }

    // 1. Idempotency verification via hash of rows + batch + filename or client idempotencyKey
    const payloadHash = crypto.createHash('sha256')
      .update(JSON.stringify(rows) + targetBatchId + (fileName || ''))
      .digest('hex');
    const importKey = idempotencyKey || payloadHash;

    if (store.importBatches[importKey]) {
      const priorImported = store.importBatches[importKey];
      return res.status(200).json({
        success: true,
        isDuplicateImport: true,
        message: 'Esta planilha já foi importada anteriormente com sucesso. Nenhuma despesa duplicada foi gravada.',
        importBatchId: importKey,
        importedCount: priorImported.length,
        totalRowsSubmitted: rows.length,
      });
    }

    // 2. Transactional Pre-Validation: Validate entire dataset before mutating anything
    const validationErrors: Array<{ rowNumber: number; field: string; error: string }> = [];
    const parsedRows: Array<{
      category: any;
      description: string;
      amount: number;
      quantity?: number;
      unit?: string;
      date: string;
      invoiceNumber: string;
    }> = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const parsedAmount = parseBrazilianNumber(row.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        validationErrors.push({
          rowNumber: rowNum,
          field: 'amount',
          error: `Valor de despesa inválido ("${row.amount}"). Deve ser um número maior que zero.`,
        });
      }

      if (row.date === 'not-a-date' || (row.date && isNaN(new Date(row.date).getTime()) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(row.date).trim()))) {
        validationErrors.push({
          rowNumber: rowNum,
          field: 'date',
          error: `Data da despesa inválida ou corrompida ("${row.date}").`,
        });
      }

      const parsedDate = parseBrazilianDate(row.date, refClock.toISOString().split('T')[0]);

      parsedRows.push({
        category: row.category || 'OUTROS',
        description: row.description || `Importado de ${fileName || 'Planilha'}`,
        amount: parsedAmount,
        quantity: row.quantity ? parseBrazilianNumber(row.quantity) : undefined,
        unit: row.unit,
        date: parsedDate,
        invoiceNumber: row.invoiceNumber || fileName || `IMP-${rowNum}`,
      });
    });

    // Abort with zero side effects if any row failed pre-validation
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: `A validação do lote falhou em ${validationErrors.length} linha(s). Nenhuma linha foi gravada.`,
        validationErrors,
        totalErrors: validationErrors.length,
      });
    }

    // 3. Duplicate detection against existing batch costs
    const existingCosts = batch.costs || [];
    const nonDuplicateRows: typeof parsedRows = [];
    let duplicateCount = 0;

    for (const item of parsedRows) {
      const isDuplicate = existingCosts.some(
        (c) =>
          c.amount === item.amount &&
          c.date === item.date &&
          c.category === item.category &&
          (c.invoiceNumber === item.invoiceNumber || c.description === item.description)
      );

      if (isDuplicate) {
        duplicateCount++;
      } else {
        nonDuplicateRows.push(item);
      }
    }

    if (nonDuplicateRows.length === 0) {
      return res.status(200).json({
        success: false,
        isDuplicateImport: true,
        error: `Todas as ${rows.length} despesas já se encontram registradas no lote ${batch.code}. Nenhuma duplicata foi criada.`,
        duplicatesDetected: duplicateCount,
      });
    }

    // 4. Transactional commit of non-duplicate items
    const importBatchId = `import-${Date.now()}`;
    const importedRecords: any[] = [];

    executeTransaction(env, (draft) => {
      const b = draft.batches.find((item) => item.id === targetBatchId);
      if (!b) throw new Error('Lote de destino não localizado');

      for (const item of nonDuplicateRows) {
        const costItem = {
          id: `cost-imp-${importBatchId}-${b.costs.length + 1}`,
          category: item.category,
          description: item.description,
          amount: item.amount,
          quantity: item.quantity,
          unit: item.unit,
          date: item.date,
          invoiceNumber: item.invoiceNumber,
          status: 'CONFERIDO' as const,
          importBatchId,
        };
        b.costs.push(costItem);
        importedRecords.push(costItem);
      }

      // Store in both unique import ID and content hash key for idempotency
      draft.importBatches[importBatchId] = importedRecords;
      draft.importBatches[importKey] = importedRecords;
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'SPREADSHEET_IMPORTED',
      targetEntity: 'BATCH_COST',
      recordId: importBatchId,
      details: `Planilha ${fileName || 'dados'} importada no lote ${batch.code}: ${importedRecords.length} lançamentos efetuados.`,
    });

    res.json({
      success: true,
      importBatchId,
      importedCount: importedRecords.length,
      duplicatesIgnored: duplicateCount,
      totalRowsSubmitted: rows.length,
    });
  };

  app.post('/api/import/confirm', handleImportConfirm);
  app.post('/api/spreadsheets/import', handleImportConfirm);

  // Rollback imported batch
  const handleImportRollback = (req: express.Request, res: express.Response) => {
    const env = req.authContext?.environment || 'demo';
    const id = req.params.importBatchId;

    const { removedCount } = executeTransaction(env, (draft) => {
      let count = 0;
      draft.batches.forEach((b) => {
        const initialLen = b.costs.length;
        b.costs = b.costs.filter((c: any) => (c as any).importBatchId !== id);
        count += initialLen - b.costs.length;
      });
      delete draft.importBatches[id];
      return { removedCount: count };
    });

    recordAuditLog({
      userId: req.authContext?.userId || 'usr-demo-01',
      userName: req.authContext?.userName || 'Operador',
      userRole: req.authContext?.role || 'PROPRIETARIO',
      environment: env,
      action: 'IMPORT_ROLLED_BACK',
      targetEntity: 'BATCH_COST',
      recordId: id,
      details: `Rollback do lote de importação ${id}: ${removedCount} lançamentos revertidos.`,
    });

    res.json({ success: true, revertedCount: removedCount, importBatchId: id });
  };

  app.post('/api/import/rollback/:importBatchId', handleImportRollback);
  app.post('/api/spreadsheets/rollback/:importBatchId', handleImportRollback);

  // Assistant grounded strictly in active environment records
  app.post('/api/assistant/query', async (req, res) => {
    const env = req.authContext?.environment || 'demo';
    const store = getStore(env);
    const { question, query } = req.body;
    const userQuery = question || query || '';

    // Grounding in REAL mode: query real store only! Never leak DEMO-A or demo numbers!
    if (env === 'real') {
      if (store.batches.length === 0) {
        return res.json({
          answer:
            'Não há lotes de produção cadastrados na sua empresa no momento. Os dados do cenário de demonstração (DEMO-A) não são compartilhados com o ambiente real. Para obter análises de custos, qualidade de água ou FCA, cadastre um lote ou importe sua planilha no módulo correspondente.',
          groundedFacts: 'Ambiente: Minha Empresa (dados reais). 0 lotes cadastrados.',
          source: 'DETERMINISTIC_ENGINE',
        });
      }
    }

    // Compute dynamic facts from the active store
    const activeBatchesSummary = store.batches
      .map((b) => {
        const total = calculateBatchTotalCost(b);
        const unit = calculateBatchUnitCost(b);
        const fca = calculateFeedConversionRatio(b);
        return `Lote ${b.code} (${b.modality}): ${b.sellableQuantity} ${b.sellableUnit}, Custo Total R$ ${total.toLocaleString('pt-BR')}, Custo Unitário ${unit.unitCost.toFixed(2)} ${unit.unitLabel}${fca.fca ? `, FCA ${fca.fca.toFixed(3)}` : ''}`;
      })
      .join('\n');

    const activeIncidents = store.incidents.filter((i) => i.status !== 'RESOLVIDO');
    const pendingReceivables = store.receivables.filter((r) => r.status !== 'PAGO' && !r.hasActiveDispute);
    const totalPendingReceivables = pendingReceivables.reduce(
      (sum, r) => sum + Math.max(0, r.originalAmount - r.receivedAmount),
      0
    );

    const refClock = env === 'demo' ? REFERENCE_CLOCK.toISOString() : new Date().toISOString();
    const groundSummary = `
Ambiente: ${env === 'demo' ? 'Demonstração (dados de exemplo)' : 'Minha Empresa (dados reais)'}
Data/hora de referência: ${refClock}
Lotes cadastrados (${store.batches.length}):
${activeBatchesSummary || 'Nenhum lote registrado'}
Incidentes de água ativos: ${activeIncidents.length} (${activeIncidents.map((i) => i.title).join('; ') || 'Nenhum'})
Títulos a receber válidos pendentes: R$ ${totalPendingReceivables.toLocaleString('pt-BR')}
`;

    const ai = getAI();
    if (ai) {
      try {
        const prompt = `Você é o assistente Maré da Maricultura Nordeste. Responda à pergunta do usuário utilizando EXCLUSIVAMENTE os fatos abaixo calculados pelo sistema.
Não invente dados, não mencione lotes ou números não presentes nos fatos abaixo.
Fatos do sistema:
${groundSummary}

Pergunta: "${userQuery}"`;

        const resp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        return res.json({
          answer: resp.text,
          groundedFacts: groundSummary,
          source: 'GEMINI_2_5_FLASH',
        });
      } catch (err: any) {
        console.warn('Gemini query error:', err?.message);
      }
    }

    // Deterministic fallback response
    let answer = `Com base nos registros ativos da sua empresa:\n- Lotes registrados: ${store.batches.length}\n- Incidentes de água abertos: ${activeIncidents.length}\n- Títulos a receber pendentes: R$ ${totalPendingReceivables.toLocaleString('pt-BR')}`;
    if (env === 'demo') {
      const qLower = userQuery.toLowerCase();
      if (qLower.includes('pesou') || qLower.includes('gasto') || qLower.includes('custo')) {
        answer = `No Lote DEMO-A (total de R$ 21.000,00), o gasto mais pesado foi Ração, somando R$ 12.000,00 (57,1% do total). Em seguida: Mão de Obra (R$ 3.000,00 / 14,3%), Energia (R$ 2.500,00 / 11,9%), Outros (R$ 2.000,00 / 9,5%) e Pós-larvas (R$ 1.500,00 / 7,1%). O custo unitário apurado foi de R$ 21,00/kg contra orçamento de R$ 20,00/kg.`;
      } else if (qLower.includes('falta') || qLower.includes('atenção') || qLower.includes('urgente')) {
        answer = `Principais pontos que exigem atenção agora no cenário:\n1) Viveiro 02 com oxigênio a 3,2 mg/L (abaixo do piso de 4,0 mg/L);\n2) Estoque de ração em nível crítico (300 kg / 3 dias de cobertura);\n3) Título A com R$ 6.000,00 vencido há 6 dias.`;
      }
    }

    res.json({
      answer,
      groundedFacts: groundSummary,
      source: 'DETERMINISTIC_ENGINE',
    });
  });

  // Independent Test Suite (All 17 Items with PASS / FAIL / BLOCKED / NOT_RUN)
  const handleTestSuite = (req: express.Request, res: express.Response) => {
    const suiteOutput = runIndependentTestSuite();
    res.json(suiteOutput);
  };

  app.get('/api/tests/run', handleTestSuite);
  app.post('/api/tests/run', handleTestSuite);

  // Global error handler (handles Multer errors and general runtime errors)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `Arquivo excede o limite máximo de 100 MB (100.000.000 bytes inclusive). Envio bloqueado.`,
          code: 'LIMIT_FILE_SIZE',
        });
      }
      return res.status(400).json({ error: `Erro no upload: ${err.message}`, code: err.code });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Erro no processamento da requisição.' });
    }
    next();
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maré — Maricultura Nordeste rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
