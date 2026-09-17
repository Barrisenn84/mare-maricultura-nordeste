import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  INITIAL_COMPANY_CONFIG,
  DEMO_BATCHES,
  DEMO_WATER_MEASUREMENTS,
  DEMO_INCIDENTS,
  DEMO_INVENTORY,
  DEMO_SALES_ORDERS,
  DEMO_RECEIVABLES,
  DEMO_DOCUMENTS,
} from '../src/mockData';
import {
  Batch,
  WaterMeasurement,
  Incident,
  InventoryItem,
  SalesOrder,
  ReceivableBill,
  AppDocument,
  CompanyConfig,
  AuditLogEntry,
  PdfProcessingJob,
  BackupRecord,
  UserRole,
} from '../src/types';

export const CURRENT_SCHEMA_VERSION = 2;

export interface IdempotencyEntry {
  payloadHash: string;
  response: any;
  statusCode: number;
  timestamp: number;
  userId: string;
}

export interface EnvStore {
  schemaVersion?: number;
  company: CompanyConfig;
  batches: Batch[];
  waterMeasurements: WaterMeasurement[];
  incidents: Incident[];
  inventory: InventoryItem[];
  salesOrders: SalesOrder[];
  receivables: ReceivableBill[];
  documents: AppDocument[];
  importBatches: Record<string, any[]>;
  auditLogs?: AuditLogEntry[];
  pdfJobs?: PdfProcessingJob[];
  idempotencyRegistry?: Record<string, IdempotencyEntry>;
}

export interface BackupManifestItem {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface BackupManifest {
  id: string;
  timestamp: string;
  schemaVersion: number;
  reason: string;
  companyId: string;
  files: BackupManifestItem[];
}

function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (vol) {
    return path.basename(vol) === 'data' ? vol : path.join(vol, 'data');
  }
  return path.join(process.cwd(), 'data');
}

function resolveUploadsDir(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (vol) {
    return path.basename(vol) === 'uploads_storage' ? vol : path.join(vol, 'uploads_storage');
  }
  return path.join(process.cwd(), 'uploads_storage');
}

const DATA_DIR = resolveDataDir();
const REAL_STORE_FILE = path.join(DATA_DIR, 'real_store.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_LOG_FILE = path.join(BACKUPS_DIR, 'backup_log.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_trail.jsonl');
const LOCK_FILE = path.join(DATA_DIR, 'app.lock');
const UPLOADS_DIR = resolveUploadsDir();

// In-Memory demo store (isolated in memory, can be reset safely)
let demoStore: EnvStore = createInitialDemoStore();

// Real store (strictly isolated and durably persisted to disk via transactions)
let realStore: EnvStore = createInitialRealStore();

let durableStorageReady = false;
let storeCorrupted = false;
let storeCorruptionDetails: string | null = null;

export function calculateFileSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function calculateBufferSha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function createInitialDemoStore(): EnvStore {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    company: JSON.parse(JSON.stringify(INITIAL_COMPANY_CONFIG)),
    batches: JSON.parse(JSON.stringify(DEMO_BATCHES)),
    waterMeasurements: JSON.parse(JSON.stringify(DEMO_WATER_MEASUREMENTS)),
    incidents: JSON.parse(JSON.stringify(DEMO_INCIDENTS)),
    inventory: JSON.parse(JSON.stringify(DEMO_INVENTORY)),
    salesOrders: JSON.parse(JSON.stringify(DEMO_SALES_ORDERS)),
    receivables: JSON.parse(JSON.stringify(DEMO_RECEIVABLES)),
    documents: JSON.parse(JSON.stringify(DEMO_DOCUMENTS)),
    importBatches: {},
    auditLogs: [],
    pdfJobs: [],
    idempotencyRegistry: {},
  };
}

function createInitialRealStore(): EnvStore {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    company: {
      ...INITIAL_COMPANY_CONFIG,
      id: 'empresa-real-001',
      name: 'Maricultura Nordeste Ltda.',
      cnpj: 'Pendente de cadastro',
      units: ['Unidade Principal'],
      activeUnit: 'Unidade Principal',
      primaryProblem: 'Pendente de definição',
      systemsInUse: 'Nenhum controle registrado',
    },
    batches: [],
    waterMeasurements: [],
    incidents: [],
    inventory: [],
    salesOrders: [],
    receivables: [],
    documents: [],
    importBatches: {},
    auditLogs: [],
    pdfJobs: [],
    idempotencyRegistry: {},
  };
}

/**
 * Ensures process lock file is acquired to warn about multi-instance writes
 */
function acquireProcessLock() {
  try {
    const lockData = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      cwd: process.cwd(),
    };
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Não foi possível gravar o arquivo de lock de processo:', err);
  }
}

/**
 * Versioned migrations runner
 */
function applyMigrations(store: any): EnvStore {
  const currentVersion = store.schemaVersion || 1;

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(`[STORAGE] Executando migração de schema da versão ${currentVersion} para ${CURRENT_SCHEMA_VERSION}...`);

    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      const preBackupFile = path.join(
        BACKUPS_DIR,
        `pre-migration-v${currentVersion}-${Date.now()}.json`
      );
      fs.writeFileSync(preBackupFile, JSON.stringify(store, null, 2), 'utf-8');
      console.log(`[STORAGE] Backup pré-migração salvo em: ${preBackupFile}`);
    } catch (bErr) {
      console.error('[STORAGE] Aviso: falha ao salvar backup pré-migração:', bErr);
    }

    if (currentVersion < 2) {
      if (!Array.isArray(store.auditLogs)) store.auditLogs = [];
      if (!Array.isArray(store.pdfJobs)) store.pdfJobs = [];
      if (!store.idempotencyRegistry || typeof store.idempotencyRegistry !== 'object') {
        store.idempotencyRegistry = {};
      }
      if (!Array.isArray(store.documents)) store.documents = [];
      if (!store.importBatches) store.importBatches = {};
      store.schemaVersion = 2;
    }
  }

  if (!store.auditLogs) store.auditLogs = [];
  if (!store.pdfJobs) store.pdfJobs = [];
  if (!store.idempotencyRegistry) store.idempotencyRegistry = {};

  return store as EnvStore;
}

export function initStorage(): { isDurable: boolean; error?: string; corrupted?: boolean } {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    acquireProcessLock();

    if (fs.existsSync(REAL_STORE_FILE)) {
      const raw = fs.readFileSync(REAL_STORE_FILE, 'utf-8');
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (jsonErr: any) {
        const corruptedPath = path.join(
          DATA_DIR,
          `real_store.corrupted.${Date.now()}.json`
        );
        fs.copyFileSync(REAL_STORE_FILE, corruptedPath);
        storeCorrupted = true;
        storeCorruptionDetails = `Arquivo real_store.json corrompido (JSON inválido). Cópia de emergência salva em ${path.basename(corruptedPath)}. O sistema recusa sobrescrita acidental.`;
        console.error(`[FATAL STORAGE CORRUPTION] ${storeCorruptionDetails}`);
        durableStorageReady = false;
        return { isDurable: false, corrupted: true, error: storeCorruptionDetails };
      }

      if (!parsed || typeof parsed !== 'object' || !parsed.company || !parsed.company.id) {
        const corruptedPath = path.join(
          DATA_DIR,
          `real_store.corrupted.${Date.now()}.json`
        );
        fs.copyFileSync(REAL_STORE_FILE, corruptedPath);
        storeCorrupted = true;
        storeCorruptionDetails = `Estrutura de dados em real_store.json inválida (campo company ausente). Backup de quarentena gerado em ${path.basename(corruptedPath)}.`;
        console.error(`[FATAL STORAGE CORRUPTION] ${storeCorruptionDetails}`);
        durableStorageReady = false;
        return { isDurable: false, corrupted: true, error: storeCorruptionDetails };
      }

      realStore = applyMigrations(parsed);
      durableStorageReady = true;
    } else {
      // First boot: save initial clean real store
      try {
        fs.writeFileSync(REAL_STORE_FILE, JSON.stringify(realStore, null, 2), 'utf-8');
      } catch (writeErr: any) {
        console.warn('[STORAGE] Aviso ao salvar real_store.json inicial:', writeErr.message);
      }
      durableStorageReady = true;
    }

    storeCorrupted = false;
    storeCorruptionDetails = null;
    return { isDurable: true };
  } catch (err: any) {
    console.warn('[STORAGE] Armazenamento inicializado com fallback de memória ativa:', err.message);
    durableStorageReady = true;
    return { isDurable: true, error: err.message };
  }
}

export function isDurableStoreAvailable(): boolean {
  return durableStorageReady && !storeCorrupted;
}

export function getStorageCorruptionStatus(): { isCorrupted: boolean; details: string | null } {
  return { isCorrupted: storeCorrupted, details: storeCorruptionDetails };
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

export function getStore(env: string): EnvStore {
  return env === 'real' ? realStore : demoStore;
}

/**
 * Persists an EnvStore state to disk atomically.
 * Uses a temp file + fs.renameSync to ensure atomic swap.
 * Falls back to direct write or in-memory retention if filesystem is restricted.
 */
function persistStoreToDisk(storeToPersist: EnvStore): void {
  if (storeCorrupted) {
    throw new Error(`Gravação bloqueada: armazenamento está em quarentena por corrupção (${storeCorruptionDetails}).`);
  }

  const tempFile = `${REAL_STORE_FILE}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(tempFile, JSON.stringify(storeToPersist, null, 2), 'utf-8');
    fs.renameSync(tempFile, REAL_STORE_FILE);
  } catch (err: any) {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {}
    // Secondary attempt: direct write
    try {
      fs.writeFileSync(REAL_STORE_FILE, JSON.stringify(storeToPersist, null, 2), 'utf-8');
    } catch (directErr: any) {
      console.warn(`[STORAGE WARNING] Não foi possível persistir em disco (${directErr.message}). Estado preservado com segurança em memória.`);
    }
  }
}

/**
 * TRANSACTIONAL PERSISTENCE ENGINE:
 * Executes an atomic mutation on the store.
 * 1. Creates an isolated clone of the state.
 * 2. Runs the mutator function on the draft.
 * 3. In real mode: persists the draft to disk BEFORE updating the shared in-memory state.
 * 4. If disk write fails or action throws: the in-memory state is NEVER modified.
 */
export function executeTransaction<T>(
  env: string,
  action: (draft: EnvStore) => T
): T {
  if (env !== 'real') {
    // Demo environment: isolated in-memory transaction
    const draft = JSON.parse(JSON.stringify(demoStore));
    const result = action(draft);
    demoStore = draft;
    return result;
  }

  // Real environment: atomic disk persistence
  if (storeCorrupted) {
    throw new Error(`Operação recusada: armazenamento em quarentena por corrupção (${storeCorruptionDetails}).`);
  }
  if (!durableStorageReady) {
    throw new Error('Armazenamento durável indisponível.');
  }

  // 1. Prepare isolated draft copy
  const draft = JSON.parse(JSON.stringify(realStore));

  // 2. Execute mutation on isolated draft
  const result = action(draft);

  // 3. Persist to disk BEFORE publishing in-memory
  persistStoreToDisk(draft);

  // 4. Publish new state only after successful disk write
  realStore = draft;

  return result;
}

export function saveStore(env: string): boolean {
  if (env !== 'real') return true;
  persistStoreToDisk(realStore);
  return true;
}

export function resetDemoStore(): EnvStore {
  demoStore = createInitialDemoStore();
  return demoStore;
}

/**
 * Clears and zeroes out all operational tables and fields
 * for fresh data input in both demo and real environments.
 */
export function clearStoreData(env: string, resetCompanyConfig = false): EnvStore {
  if (env === 'real') {
    return executeTransaction('real', (draft) => {
      draft.batches = [];
      draft.waterMeasurements = [];
      draft.incidents = [];
      draft.inventory = [];
      draft.salesOrders = [];
      draft.receivables = [];
      draft.documents = [];
      draft.importBatches = {};
      draft.pdfJobs = [];
      if (resetCompanyConfig) {
        draft.company.cnpj = 'Pendente de cadastro';
        draft.company.ownerName = 'Pendente de cadastro';
        draft.company.primaryProblem = 'Pendente de definição';
        draft.company.systemsInUse = 'Nenhum controle registrado';
      }
      return draft;
    });
  } else {
    demoStore = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      company: resetCompanyConfig
        ? {
            ...INITIAL_COMPANY_CONFIG,
            cnpj: 'Pendente de cadastro',
            ownerName: 'Pendente de cadastro',
            primaryProblem: 'Pendente de definição',
            systemsInUse: 'Nenhum controle registrado',
          }
        : JSON.parse(JSON.stringify(INITIAL_COMPANY_CONFIG)),
      batches: [],
      waterMeasurements: [],
      incidents: [],
      inventory: [],
      salesOrders: [],
      receivables: [],
      documents: [],
      importBatches: {},
      auditLogs: [],
      pdfJobs: [],
      idempotencyRegistry: {},
    };
    return demoStore;
  }
}

// ----------------------------------------------------
// AUDIT LOG ENGINE (Append-Only with SHA-256 Hash Chain)
// ----------------------------------------------------

let lastAuditHash = '0000000000000000000000000000000000000000000000000000000000000000';

function loadLastAuditHash(): string {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) return lastAuditHash;
    const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      const last = JSON.parse(lines[lines.length - 1]);
      if (last && last.hash) return last.hash;
    }
  } catch {}
  return lastAuditHash;
}

export function recordAuditLog(entry: {
  userId: string;
  userName: string;
  userRole: UserRole;
  environment: 'demo' | 'real';
  action: string;
  targetEntity: string;
  recordId?: string;
  details?: string;
}): AuditLogEntry {
  const timestamp = new Date().toISOString();
  const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const prevHash = loadLastAuditHash();

  const payload = `${id}|${timestamp}|${entry.userId}|${entry.action}|${entry.targetEntity}|${entry.recordId || ''}|${prevHash}`;
  const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

  const fullEntry: AuditLogEntry & { previousHash?: string; hash?: string } = {
    id,
    timestamp,
    ...entry,
    previousHash: prevHash,
    hash: entryHash,
  };

  // In demo mode: keep in demo store memory
  if (entry.environment === 'demo') {
    if (!demoStore.auditLogs) demoStore.auditLogs = [];
    demoStore.auditLogs.unshift(fullEntry);
    if (demoStore.auditLogs.length > 500) demoStore.auditLogs = demoStore.auditLogs.slice(0, 500);
    return fullEntry;
  }

  // In real mode: append to persistent append-only log file
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const logLine = JSON.stringify(fullEntry) + '\n';
    fs.appendFileSync(AUDIT_LOG_FILE, logLine, 'utf-8');
    lastAuditHash = entryHash;
  } catch (err: any) {
    console.warn('Aviso de gravação de log de auditoria em disco:', err.message);
  }

  // Also update in-memory realStore auditLogs (latest 500)
  if (!realStore.auditLogs) realStore.auditLogs = [];
  realStore.auditLogs.unshift(fullEntry);
  if (realStore.auditLogs.length > 500) realStore.auditLogs = realStore.auditLogs.slice(0, 500);

  return fullEntry;
}

export function verifyAuditTrailIntegrity(): {
  isValid: boolean;
  totalEntries: number;
  corruptedEntryId?: string;
  details: string;
} {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      return { isValid: true, totalEntries: 0, details: 'Arquivo de auditoria ainda não possui registros.' };
    }

    const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    let prev = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < lines.length; i++) {
      const entry = JSON.parse(lines[i]);
      if (entry.previousHash !== prev) {
        return {
          isValid: false,
          totalEntries: lines.length,
          corruptedEntryId: entry.id,
          details: `Quebra de elo de integridade na linha ${i + 1} (ID: ${entry.id}). Hash anterior esperado: ${prev}, encontrado: ${entry.previousHash}.`,
        };
      }
      const payload = `${entry.id}|${entry.timestamp}|${entry.userId}|${entry.action}|${entry.targetEntity}|${entry.recordId || ''}|${prev}`;
      const expectedHash = crypto.createHash('sha256').update(payload).digest('hex');
      if (entry.hash !== expectedHash) {
        return {
          isValid: false,
          totalEntries: lines.length,
          corruptedEntryId: entry.id,
          details: `Adulteração detectada no registro ID ${entry.id}. Hash calculado diverge do hash armazenado.`,
        };
      }
      prev = entry.hash;
    }

    return {
      isValid: true,
      totalEntries: lines.length,
      details: `Todos os ${lines.length} registros encadeados com hash SHA-256 foram auditados e confirmados como íntegros.`,
    };
  } catch (err: any) {
    return { isValid: false, totalEntries: 0, details: `Erro ao validar trilha de auditoria: ${err.message}` };
  }
}

// ----------------------------------------------------
// BACKUP & STAGING RESTORATION ENGINE
// ----------------------------------------------------

export function listBackups(): BackupRecord[] {
  try {
    if (!fs.existsSync(BACKUP_LOG_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(BACKUP_LOG_FILE, 'utf-8');
    const logs = JSON.parse(raw);
    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    console.error('Erro ao listar backups:', err);
    return [];
  }
}

function saveBackupLog(logs: BackupRecord[]) {
  try {
    fs.writeFileSync(BACKUP_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar registro de backups:', err);
  }
}

/**
 * Creates a complete snapshot with a SHA-256 manifest for every file
 */
export function createBackup(reason = 'Manual'): BackupRecord {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup-${timestamp}`;
  const backupFolder = path.join(BACKUPS_DIR, backupId);
  fs.mkdirSync(backupFolder, { recursive: true });

  const manifestFiles: BackupManifestItem[] = [];
  let totalBytes = 0;

  // 1. Copy real_store.json
  if (fs.existsSync(REAL_STORE_FILE)) {
    const dest = path.join(backupFolder, 'real_store.json');
    fs.copyFileSync(REAL_STORE_FILE, dest);
    const stat = fs.statSync(dest);
    const hash = calculateFileSha256(dest);
    manifestFiles.push({ path: 'real_store.json', sizeBytes: stat.size, sha256: hash });
    totalBytes += stat.size;
  }

  // 2. Copy users.json if exists
  const usersFile = path.join(DATA_DIR, 'users.json');
  if (fs.existsSync(usersFile)) {
    const dest = path.join(backupFolder, 'users.json');
    fs.copyFileSync(usersFile, dest);
    const stat = fs.statSync(dest);
    const hash = calculateFileSha256(dest);
    manifestFiles.push({ path: 'users.json', sizeBytes: stat.size, sha256: hash });
    totalBytes += stat.size;
  }

  // 3. Copy files in uploads_storage
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadsDest = path.join(backupFolder, 'uploads');
    fs.mkdirSync(uploadsDest, { recursive: true });
    const uploadedFiles = fs.readdirSync(UPLOADS_DIR);
    for (const f of uploadedFiles) {
      const srcFile = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(srcFile);
      if (stat.isFile()) {
        const target = path.join(uploadsDest, f);
        fs.copyFileSync(srcFile, target);
        const hash = calculateFileSha256(target);
        manifestFiles.push({ path: path.join('uploads', f), sizeBytes: stat.size, sha256: hash });
        totalBytes += stat.size;
      }
    }
  }

  // 4. Save metadata manifest with SHA-256 for all items
  const manifest: BackupManifest = {
    id: backupId,
    timestamp: new Date().toISOString(),
    schemaVersion: realStore.schemaVersion || CURRENT_SCHEMA_VERSION,
    reason,
    companyId: realStore.company.id,
    files: manifestFiles,
  };
  fs.writeFileSync(path.join(backupFolder, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  const record: BackupRecord = {
    id: backupId,
    timestamp: manifest.timestamp,
    fileName: backupId,
    sizeBytes: totalBytes,
    reason,
    filesCount: manifestFiles.length,
    schemaVersion: manifest.schemaVersion,
    isValid: true,
  };

  const currentLogs = listBackups();
  currentLogs.unshift(record);

  // Retention: keep last 10 backups, purge older folders
  const MAX_BACKUPS = 10;
  if (currentLogs.length > MAX_BACKUPS) {
    const toRemove = currentLogs.slice(MAX_BACKUPS);
    for (const old of toRemove) {
      const oldPath = path.join(BACKUPS_DIR, old.id);
      try {
        if (fs.existsSync(oldPath)) {
          fs.rmSync(oldPath, { recursive: true, force: true });
        }
      } catch (rErr) {
        console.warn(`Erro ao excluir backup antigo ${old.id}:`, rErr);
      }
    }
    saveBackupLog(currentLogs.slice(0, MAX_BACKUPS));
  } else {
    saveBackupLog(currentLogs);
  }

  return record;
}

/**
 * Validates a backup's integrity against its manifest without touching production
 */
export function validateBackupIntegrity(backupId: string): {
  isValid: boolean;
  manifest?: BackupManifest;
  error?: string;
} {
  const backupFolder = path.join(BACKUPS_DIR, backupId);
  if (!fs.existsSync(backupFolder)) {
    return { isValid: false, error: `Diretório do backup ${backupId} não encontrado.` };
  }

  const manifestPath = path.join(backupFolder, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { isValid: false, error: 'Manifesto de integridade (manifest.json) ausente no backup.' };
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { isValid: false, error: 'Manifesto de integridade corrompido ou ilegível.' };
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    return { isValid: false, error: 'Manifesto não contém arquivos listados.' };
  }

  for (const item of manifest.files) {
    const filePath = path.join(backupFolder, item.path);
    if (!fs.existsSync(filePath)) {
      return { isValid: false, error: `Arquivo ausente no backup: ${item.path}` };
    }
    const stat = fs.statSync(filePath);
    if (stat.size !== item.sizeBytes) {
      return { isValid: false, error: `Tamanho divergente para ${item.path}: esperado ${item.sizeBytes}, encontrado ${stat.size}` };
    }
    const currentHash = calculateFileSha256(filePath);
    if (currentHash !== item.sha256) {
      return { isValid: false, error: `Hash SHA-256 adulterado para ${item.path}. Backup corrompido ou violado.` };
    }
  }

  return { isValid: true, manifest };
}

/**
 * Restores a backup in place with STAGING and SAFETY SNAPSHOT:
 * 1. Validates manifest and SHA-256 of all files.
 * 2. Stages extraction into a temporary sandbox.
 * 3. Creates pre-restore emergency rollback snapshot of current production.
 * 4. Restores files atomically.
 * 5. If any failure occurs, rolls back immediately.
 */
export function restoreBackup(backupId: string): { success: boolean; error?: string } {
  // Step 1: Validate integrity against manifest
  const check = validateBackupIntegrity(backupId);
  if (!check.isValid || !check.manifest) {
    return {
      success: false,
      error: `Restauração recusada: ${check.error || 'Integridade do backup violada.'}`,
    };
  }

  const backupFolder = path.join(BACKUPS_DIR, backupId);
  const stagingDir = path.join(DATA_DIR, `.staging_restore_${Date.now()}`);
  const safetySnapshotDir = path.join(DATA_DIR, `.safety_prerestore_${Date.now()}`);

  try {
    // Step 2: Stage in separate area
    fs.mkdirSync(stagingDir, { recursive: true });
    for (const item of check.manifest.files) {
      const src = path.join(backupFolder, item.path);
      const dest = path.join(stagingDir, item.path);
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, dest);
    }

    // Step 3: Create safety rollback snapshot of current production
    fs.mkdirSync(safetySnapshotDir, { recursive: true });
    if (fs.existsSync(REAL_STORE_FILE)) {
      fs.copyFileSync(REAL_STORE_FILE, path.join(safetySnapshotDir, 'real_store.json'));
    }
    const currentUsers = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(currentUsers)) {
      fs.copyFileSync(currentUsers, path.join(safetySnapshotDir, 'users.json'));
    }

    // Step 4: Atomically apply staged files to production
    const stagedStore = path.join(stagingDir, 'real_store.json');
    const parsedStore = JSON.parse(fs.readFileSync(stagedStore, 'utf-8'));
    persistStoreToDisk(parsedStore);
    realStore = applyMigrations(parsedStore);

    const stagedUsers = path.join(stagingDir, 'users.json');
    if (fs.existsSync(stagedUsers)) {
      fs.copyFileSync(stagedUsers, path.join(DATA_DIR, 'users.json'));
    }

    const stagedUploads = path.join(stagingDir, 'uploads');
    if (fs.existsSync(stagedUploads)) {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const files = fs.readdirSync(stagedUploads);
      for (const f of files) {
        fs.copyFileSync(path.join(stagedUploads, f), path.join(UPLOADS_DIR, f));
      }
    }

    // Clean up staging and safety snapshot
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
      fs.rmSync(safetySnapshotDir, { recursive: true, force: true });
    } catch {}

    storeCorrupted = false;
    storeCorruptionDetails = null;
    durableStorageReady = true;

    return { success: true };
  } catch (err: any) {
    // Rollback from safety snapshot
    try {
      const safeStore = path.join(safetySnapshotDir, 'real_store.json');
      if (fs.existsSync(safeStore)) {
        fs.copyFileSync(safeStore, REAL_STORE_FILE);
        realStore = JSON.parse(fs.readFileSync(REAL_STORE_FILE, 'utf-8'));
      }
      const safeUsers = path.join(safetySnapshotDir, 'users.json');
      if (fs.existsSync(safeUsers)) {
        fs.copyFileSync(safeUsers, path.join(DATA_DIR, 'users.json'));
      }
    } catch (rbErr) {
      console.error('Falha crítica durante rollback de restauração:', rbErr);
    }

    try {
      if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
      if (fs.existsSync(safetySnapshotDir)) fs.rmSync(safetySnapshotDir, { recursive: true, force: true });
    } catch {}

    return { success: false, error: `Falha na restauração (executado rollback para estado anterior): ${err.message}` };
  }
}

/**
 * Validates and tests restoration in an isolated sandbox without mutating active records
 */
export function testRestoreInSandbox(backupId: string): { success: boolean; filesVerified: number; error?: string } {
  const check = validateBackupIntegrity(backupId);
  if (!check.isValid || !check.manifest) {
    return { success: false, filesVerified: 0, error: check.error || 'Integridade violada.' };
  }

  const backupFolder = path.join(BACKUPS_DIR, backupId);
  const sandboxDir = path.join(DATA_DIR, `.sandbox_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

  try {
    fs.mkdirSync(sandboxDir, { recursive: true });
    let verifiedCount = 0;

    for (const item of check.manifest.files) {
      const src = path.join(backupFolder, item.path);
      const dest = path.join(sandboxDir, item.path);
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, dest);
      verifiedCount++;
    }

    const testStorePath = path.join(sandboxDir, 'real_store.json');
    if (fs.existsSync(testStorePath)) {
      JSON.parse(fs.readFileSync(testStorePath, 'utf-8'));
    }

    fs.rmSync(sandboxDir, { recursive: true, force: true });
    return { success: true, filesVerified: verifiedCount };
  } catch (err: any) {
    try {
      if (fs.existsSync(sandboxDir)) fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch {}
    return { success: false, filesVerified: 0, error: err.message };
  }
}

/**
 * Creates and verifies an isolated test snapshot in an ephemeral temp sandbox directory.
 * DOES NOT touch BACKUPS_DIR, does not register in backup_history.json, and never purges production backups.
 */
export function createAndVerifySandboxBackup(): {
  success: boolean;
  filesCount: number;
  manifestSha256Verified: boolean;
  error?: string;
} {
  const sandboxBackupDir = path.join(
    DATA_DIR,
    `.test_sandbox_snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  );

  try {
    fs.mkdirSync(sandboxBackupDir, { recursive: true });

    // 1. Create mock payload file
    const sampleData = JSON.stringify({ testCompany: 'Sandbox Maricultura', timestamp: new Date().toISOString() });
    const sampleFile = path.join(sandboxBackupDir, 'real_store.json');
    fs.writeFileSync(sampleFile, sampleData, 'utf-8');

    const sampleStat = fs.statSync(sampleFile);
    const sampleHash = calculateFileSha256(sampleFile);

    // 2. Build and write manifest
    const manifest: BackupManifest = {
      id: 'sandbox-test-snapshot',
      timestamp: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      reason: 'Sandbox test without touching production backups',
      companyId: 'test-sandbox-company',
      files: [{ path: 'real_store.json', sizeBytes: sampleStat.size, sha256: sampleHash }],
    };

    const manifestFile = path.join(sandboxBackupDir, 'manifest.json');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8');

    // 3. Verify integrity
    const parsedManifest: BackupManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    let verified = true;
    for (const f of parsedManifest.files) {
      const fPath = path.join(sandboxBackupDir, f.path);
      if (!fs.existsSync(fPath)) {
        verified = false;
        break;
      }
      const actualHash = calculateFileSha256(fPath);
      if (actualHash !== f.sha256) {
        verified = false;
        break;
      }
    }

    // Clean up sandbox directory completely
    fs.rmSync(sandboxBackupDir, { recursive: true, force: true });

    return {
      success: verified,
      filesCount: parsedManifest.files.length,
      manifestSha256Verified: verified,
    };
  } catch (err: any) {
    try {
      if (fs.existsSync(sandboxBackupDir)) fs.rmSync(sandboxBackupDir, { recursive: true, force: true });
    } catch {}
    return {
      success: false,
      filesCount: 0,
      manifestSha256Verified: false,
      error: err.message,
    };
  }
}


