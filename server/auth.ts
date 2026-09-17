import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserRole, AppUser, AuthSession } from '../src/types';
import { isDurableStoreAvailable, getStore, recordAuditLog } from './storage';

export interface UserSession {
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  companyId: string;
  unit: string;
  createdAt: number;
  expiresAt: number;
  mustChangePassword?: boolean;
}

export interface AuthContext {
  userId: string;
  userName: string;
  userEmail?: string;
  role: UserRole;
  companyId: string;
  unit: string;
  environment: 'demo' | 'real';
  isAuthenticated: boolean;
  sessionId?: string;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (vol) {
    return path.basename(vol) === 'data' ? vol : path.join(vol, 'data');
  }
  return path.join(process.cwd(), 'data');
}

const DATA_DIR = resolveDataDir();
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// In-memory active verifiable sessions (mapped by cryptorandom token)
const activeSessions = new Map<string, UserSession>();

// Rate-limiting for failed logins (max 5 failed attempts within 15 minutes)
interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface StoredUserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  unit: string;
  salt: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  mustChangePassword?: boolean;
  algo?: string; // 'pbkdf2_sha512_100k' or legacy
}

// OWASP Recommended PBKDF2 parameters for SHA-512
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time safe string/buffer comparison to prevent timing attacks
 */
export function safeCompareHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

let storedUsersCache: StoredUserRecord[] | null = null;
let usersCorrupted = false;
let usersCorruptionReason: string | null = null;

export function isUsersCorrupted(): boolean {
  return usersCorrupted;
}

export function getUsersCorruptionDetails(): string | null {
  return usersCorruptionReason;
}

/**
 * Loads user records from disk.
 * FAIL-CLOSED: If the file is corrupted, it preserves the damaged file for audit/diagnosis,
 * marks the database as corrupted, and refuses to auto-create default accounts.
 */
export function loadUsers(forceReload = false): StoredUserRecord[] {
  if (storedUsersCache !== null && !forceReload && !usersCorrupted) {
    return storedUsersCache;
  }

  if (usersCorrupted && !forceReload) {
    throw new Error(`Base de usuários em quarentena por corrupção: ${usersCorruptionReason}`);
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      // File absent: first run on clean install. No users exist yet.
      storedUsersCache = [];
      usersCorrupted = false;
      usersCorruptionReason = null;
      return storedUsersCache;
    }

    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr: any) {
      // JSON syntax corruption detected! FAIL CLOSED.
      const corruptedFile = path.join(DATA_DIR, `users.corrupted.${Date.now()}.json`);
      try {
        fs.copyFileSync(USERS_FILE, corruptedFile);
      } catch {}
      usersCorrupted = true;
      usersCorruptionReason = `Arquivo users.json corrompido (JSON inválido). Cópia preservada em ${path.basename(corruptedFile)}.`;
      console.error(`[FATAL AUTH CORRUPTION] ${usersCorruptionReason}`);
      throw new Error(usersCorruptionReason);
    }

    if (!Array.isArray(parsed)) {
      const corruptedFile = path.join(DATA_DIR, `users.corrupted.${Date.now()}.json`);
      try {
        fs.copyFileSync(USERS_FILE, corruptedFile);
      } catch {}
      usersCorrupted = true;
      usersCorruptionReason = `Estrutura de users.json inválida (não é um array). Cópia preservada em ${path.basename(corruptedFile)}.`;
      console.error(`[FATAL AUTH CORRUPTION] ${usersCorruptionReason}`);
      throw new Error(usersCorruptionReason);
    }

    storedUsersCache = parsed;
    usersCorrupted = false;
    usersCorruptionReason = null;
    return storedUsersCache;
  } catch (err: any) {
    if (usersCorrupted) throw err;
    usersCorrupted = true;
    usersCorruptionReason = err.message || 'Erro desconhecido ao carregar base de usuários.';
    throw new Error(`Falha fechada no carregamento de usuários: ${usersCorruptionReason}`);
  }
}

export function saveUsers(): void {
  if (usersCorrupted) {
    throw new Error('Gravação recusada: a base de usuários está em quarentena por corrupção.');
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const temp = `${USERS_FILE}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
    fs.writeFileSync(temp, JSON.stringify(storedUsersCache || [], null, 2), 'utf-8');
    fs.renameSync(temp, USERS_FILE);
  } catch (err: any) {
    // Secondary attempt: direct write
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(storedUsersCache || [], null, 2), 'utf-8');
    } catch (directErr: any) {
      console.warn('[AUTH WARNING] Falha ao persistir users.json em disco (' + directErr.message + '). Usuário mantido em memória.');
    }
  }
}

/**
 * Checks if the system is currently in initial setup mode (no PROPRIETARIO exists)
 */
export function isInitialOwnerSetupAllowed(): boolean {
  if (usersCorrupted) return false;
  try {
    const users = loadUsers();
    const hasActiveOwner = users.some((u) => u.role === 'PROPRIETARIO' && u.active);
    return !hasActiveOwner;
  } catch {
    return false;
  }
}

/**
 * Creates the initial master owner account on first installation
 */
export function setupInitialOwner(params: {
  name: string;
  email: string;
  password: string;
  unit?: string;
}): { success: boolean; user?: AppUser; error?: string } {
  if (!isInitialOwnerSetupAllowed()) {
    return {
      success: false,
      error: 'O cadastro inicial já foi concluído. A criação de novos usuários requer login de um Proprietário ativo.',
    };
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const password = params.password;

  if (!cleanEmail || !params.name.trim()) {
    return { success: false, error: 'Nome e e-mail são obrigatórios.' };
  }

  // Password complexity policy: at least 8 chars, mixed chars
  if (!password || password.length < 8) {
    return { success: false, error: 'A senha do Proprietário deve possuir no mínimo 8 caracteres.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  if (!hasUpper || !hasLower || !hasNum) {
    return { success: false, error: 'A senha deve conter letras maiúsculas, minúsculas e números.' };
  }

  const salt = generateSalt();
  const now = new Date().toISOString();

  const newOwner: StoredUserRecord = {
    id: `usr-owner-${Date.now()}`,
    email: cleanEmail,
    name: params.name.trim(),
    role: 'PROPRIETARIO',
    companyId: 'empresa-real-001',
    unit: params.unit?.trim() || 'Unidade Principal',
    salt,
    passwordHash: hashPassword(password, salt),
    active: true,
    createdAt: now,
    updatedAt: now,
    mustChangePassword: false,
    algo: 'pbkdf2_sha512_100k',
  };

  const users = storedUsersCache || [];
  users.push(newOwner);
  storedUsersCache = users;
  saveUsers();

  return {
    success: true,
    user: {
      id: newOwner.id,
      name: newOwner.name,
      email: newOwner.email,
      role: newOwner.role,
      companyId: newOwner.companyId,
      unit: newOwner.unit,
      active: newOwner.active,
      createdAt: newOwner.createdAt,
      updatedAt: newOwner.updatedAt,
    },
  };
}

/**
 * Registers a new user for "Minha Empresa" mode and creates an active session.
 */
export function registerUser(params: {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  unit?: string;
  isGoogle?: boolean;
}): { success: boolean; session?: UserSession; user?: AppUser; error?: string } {
  let users: StoredUserRecord[];
  try {
    users = loadUsers();
  } catch (err: any) {
    return { success: false, error: 'Base de dados indisponível no momento.' };
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const name = params.name.trim();

  if (!cleanEmail || !name) {
    return { success: false, error: 'Nome e e-mail são obrigatórios.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Formato de e-mail inválido.' };
  }

  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    if (params.isGoogle) {
      if (!existing.active) {
        return { success: false, error: 'Esta conta de usuário está desativada. Contate o administrador.' };
      }
      clearFailedLogins(cleanEmail);
      const session = createSessionForUser(existing);
      return {
        success: true,
        session,
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          companyId: existing.companyId,
          unit: existing.unit,
          active: existing.active,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        },
      };
    }
    return { success: false, error: 'Este e-mail já está cadastrado. Faça login com sua senha ou utilize a opção Entrar com Google.' };
  }

  if (!params.isGoogle) {
    const password = params.password || '';
    if (password.length < 6) {
      return { success: false, error: 'A senha deve possuir no mínimo 6 caracteres.' };
    }
  }

  const isFirstUser = users.filter((u) => u.active).length === 0;
  const role: UserRole = isFirstUser ? 'PROPRIETARIO' : (params.role || 'PROPRIETARIO');
  const salt = generateSalt();
  const rawPass = params.password || crypto.randomBytes(24).toString('hex');
  const passwordHash = hashPassword(rawPass, salt);
  const now = new Date().toISOString();

  const newRecord: StoredUserRecord = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    email: cleanEmail,
    name,
    role,
    companyId: 'empresa-real-001',
    unit: params.unit?.trim() || 'Unidade Principal',
    salt,
    passwordHash,
    active: true,
    createdAt: now,
    updatedAt: now,
    mustChangePassword: false,
    algo: 'pbkdf2_sha512_100k',
  };

  users.push(newRecord);
  storedUsersCache = users;
  saveUsers();

  clearFailedLogins(cleanEmail);
  const session = createSessionForUser(newRecord);

  return {
    success: true,
    session,
    user: {
      id: newRecord.id,
      name: newRecord.name,
      email: newRecord.email,
      role: newRecord.role,
      companyId: newRecord.companyId,
      unit: newRecord.unit,
      active: newRecord.active,
      createdAt: newRecord.createdAt,
      updatedAt: newRecord.updatedAt,
    },
  };
}

/**
 * Authenticates or registers a user with Google credentials
 */
export function authenticateGoogleUser(params: {
  email: string;
  name: string;
  googleId?: string;
  picture?: string;
}): { success: boolean; session?: UserSession; user?: AppUser; error?: string } {
  return registerUser({
    name: params.name || params.email.split('@')[0],
    email: params.email,
    isGoogle: true,
  });
}

/**
 * Checks rate limiting for an email or IP
 */
export function checkLoginRateLimit(identifier: string): { isLocked: boolean; waitMinutes?: number } {
  const attempt = loginAttempts.get(identifier.toLowerCase());
  if (!attempt) return { isLocked: false };

  const now = Date.now();
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const waitMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
    return { isLocked: true, waitMinutes };
  }

  // Clear if lockout expired
  if (attempt.lockedUntil && now >= attempt.lockedUntil) {
    loginAttempts.delete(identifier.toLowerCase());
    return { isLocked: false };
  }

  if (now - attempt.firstAttemptAt > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(identifier.toLowerCase());
    return { isLocked: false };
  }

  return { isLocked: false };
}

export function recordFailedLogin(identifier: string): { isNowLocked: boolean; attemptsLeft: number } {
  const key = identifier.toLowerCase();
  const now = Date.now();
  let attempt = loginAttempts.get(key);

  if (!attempt || now - attempt.firstAttemptAt > LOCKOUT_DURATION_MS) {
    attempt = { count: 1, firstAttemptAt: now };
  } else {
    attempt.count++;
  }

  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(key, attempt);
    return { isNowLocked: true, attemptsLeft: 0 };
  }

  loginAttempts.set(key, attempt);
  return { isNowLocked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS - attempt.count };
}

export function clearFailedLogins(identifier: string): void {
  loginAttempts.delete(identifier.toLowerCase());
}

/**
 * Creates a cryptographically random session token and stores session in server memory
 */
export function createSessionForUser(user: StoredUserRecord, ttlMs: number = 24 * 60 * 60 * 1000): UserSession {
  const token = `mrs_${crypto.randomBytes(32).toString('hex')}`;
  const session: UserSession = {
    token,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    companyId: user.companyId,
    unit: user.unit,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    mustChangePassword: !!user.mustChangePassword,
  };
  activeSessions.set(token, session);
  return session;
}

/**
 * Invalidates all active sessions for a specific user (on password change, role change, deactivation)
 */
export function invalidateUserSessions(userId: string): number {
  let count = 0;
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.userId === userId) {
      activeSessions.delete(token);
      count++;
    }
  }
  return count;
}

/**
 * Validates credentials and returns an active server session.
 * STRICT CRITERIA:
 * 1. Rejects raw stored hash as password.
 * 2. Compares hashes via crypto.timingSafeEqual.
 * 3. Enforces rate limiting against brute force.
 * 4. Transparently upgrades legacy hashes to PBKDF2-SHA512 upon successful plain text verification.
 */
export function authenticateUserCredentials(email: string, passwordPlain: string): {
  session: UserSession | null;
  error?: string;
  code?: string;
} {
  const cleanEmail = email.trim().toLowerCase();
  const rateCheck = checkLoginRateLimit(cleanEmail);
  if (rateCheck.isLocked) {
    return {
      session: null,
      error: `Muitas tentativas incorretas. Bloqueio temporário ativo por ${rateCheck.waitMinutes} minutos para sua segurança.`,
      code: 'BRUTE_FORCE_LOCKED',
    };
  }

  let users: StoredUserRecord[];
  try {
    users = loadUsers();
  } catch (err: any) {
    return {
      session: null,
      error: 'Base de autenticação indisponível ou corrompida. Contate o administrador.',
      code: 'AUTH_STORAGE_ERROR',
    };
  }

  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user || !user.active) {
    const res = recordFailedLogin(cleanEmail);
    return {
      session: null,
      error: res.isNowLocked
        ? `Credenciais inválidas. Limite excedido: conta bloqueada por 15 minutos.`
        : `E-mail ou senha incorretos (${res.attemptsLeft} tentativas restantes).`,
      code: 'INVALID_CREDENTIALS',
    };
  }

  // Strictly calculate hash of provided plain password
  const computedHash = hashPassword(passwordPlain, user.salt);

  // Check PBKDF2-SHA512 (standard)
  let isMatch = safeCompareHex(user.passwordHash, computedHash);

  // Safe migration for legacy PBKDF2-SHA256 (1000 iter) without accepting hash as plain
  if (!isMatch && user.algo !== 'pbkdf2_sha512_100k') {
    const legacyHash = crypto.pbkdf2Sync(passwordPlain, user.salt, 1000, 32, 'sha256').toString('hex');
    if (safeCompareHex(user.passwordHash, legacyHash)) {
      // Match found on legacy! Upgrade immediately to PBKDF2-SHA512 with new 32-byte salt
      user.salt = generateSalt();
      user.passwordHash = hashPassword(passwordPlain, user.salt);
      user.algo = 'pbkdf2_sha512_100k';
      user.updatedAt = new Date().toISOString();
      try {
        saveUsers();
      } catch (e) {
        console.warn('Não foi possível salvar migração de hash do usuário:', e);
      }
      isMatch = true;
    }
  }

  // REJECT HASH PASSED AS PASSWORD: Never allow user.passwordHash === passwordPlain!
  if (!isMatch) {
    const res = recordFailedLogin(cleanEmail);
    return {
      session: null,
      error: res.isNowLocked
        ? `Credenciais inválidas. Limite excedido: conta bloqueada por 15 minutos.`
        : `E-mail ou senha incorretos (${res.attemptsLeft} tentativas restantes).`,
      code: 'INVALID_CREDENTIALS',
    };
  }

  // Success: clear rate limit counter
  clearFailedLogins(cleanEmail);
  const session = createSessionForUser(user);
  return { session };
}

/**
 * Retrieves and validates an active server session by token
 */
export function getActiveSession(token: string): UserSession | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  // Check expiration
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Destroys an active session
 */
export function invalidateSession(token: string): boolean {
  return activeSessions.delete(token);
}

/**
 * Returns clean user list for administration (without sensitive hashes/salts)
 */
export function getAppUsersList(): AppUser[] {
  const users = loadUsers();
  return users
    .filter((u) => u.companyId === 'empresa-real-001')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyId: u.companyId,
      unit: u.unit,
      active: u.active,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      mustChangePassword: u.mustChangePassword,
    }));
}

/**
 * Creates a new user (PROPRIETARIO only)
 */
export function createNewUser(params: {
  name: string;
  email: string;
  role: UserRole;
  unit: string;
  temporaryPassword: string;
}): { success: boolean; user?: AppUser; error?: string } {
  const users = loadUsers();
  const cleanEmail = params.email.trim().toLowerCase();

  if (!cleanEmail || !params.name.trim()) {
    return { success: false, error: 'Nome e e-mail são obrigatórios.' };
  }

  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'Já existe um usuário cadastrado com este e-mail.' };
  }

  const tempPass = params.temporaryPassword;
  if (!tempPass || tempPass.length < 8) {
    return { success: false, error: 'A senha temporária deve possuir no mínimo 8 caracteres.' };
  }

  const salt = generateSalt();
  const now = new Date().toISOString();

  const newRecord: StoredUserRecord = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    email: cleanEmail,
    name: params.name.trim(),
    role: params.role,
    companyId: 'empresa-real-001',
    unit: params.unit || 'Unidade Principal',
    salt,
    passwordHash: hashPassword(tempPass, salt),
    active: true,
    createdAt: now,
    updatedAt: now,
    mustChangePassword: true,
    algo: 'pbkdf2_sha512_100k',
  };

  users.push(newRecord);
  saveUsers();

  return {
    success: true,
    user: {
      id: newRecord.id,
      name: newRecord.name,
      email: newRecord.email,
      role: newRecord.role,
      companyId: newRecord.companyId,
      unit: newRecord.unit,
      active: newRecord.active,
      createdAt: newRecord.createdAt,
      updatedAt: newRecord.updatedAt,
      mustChangePassword: true,
    },
  };
}

/**
 * Updates user profile or role (PROPRIETARIO only).
 * If deactivated or demoted, active sessions are immediately invalidated.
 */
export function updateAppUser(
  userId: string,
  params: { name?: string; role?: UserRole; unit?: string; active?: boolean }
): { success: boolean; user?: AppUser; error?: string } {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { success: false, error: 'Usuário não localizado.' };
  }

  const user = users[idx];

  // Safeguard: cannot deactivate or demote the last active PROPRIETARIO
  if (user.role === 'PROPRIETARIO' && (params.role !== 'PROPRIETARIO' || params.active === false)) {
    const activeOwners = users.filter((u) => u.role === 'PROPRIETARIO' && u.active && u.id !== userId);
    if (activeOwners.length === 0) {
      return { success: false, error: 'Operação recusada: a empresa deve possuir pelo menos um Proprietário ativo.' };
    }
  }

  const roleChanged = params.role && params.role !== user.role;
  const deactivation = typeof params.active === 'boolean' && params.active === false;

  if (params.name) user.name = params.name.trim();
  if (params.role) user.role = params.role;
  if (params.unit) user.unit = params.unit;
  if (typeof params.active === 'boolean') user.active = params.active;
  user.updatedAt = new Date().toISOString();

  saveUsers();

  // Invalidate sessions if role changed or user deactivated
  if (roleChanged || deactivation) {
    invalidateUserSessions(userId);
  }

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      unit: user.unit,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

/**
 * Deactivates or removes a user (PROPRIETARIO only)
 */
export function deleteAppUser(userId: string): { success: boolean; error?: string } {
  const users = loadUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return { success: false, error: 'Usuário não encontrado.' };

  if (target.role === 'PROPRIETARIO') {
    const otherOwners = users.filter((u) => u.role === 'PROPRIETARIO' && u.id !== userId && u.active);
    if (otherOwners.length === 0) {
      return { success: false, error: 'Não é permitido excluir o único Proprietário da empresa.' };
    }
  }

  storedUsersCache = users.filter((u) => u.id !== userId);
  saveUsers();
  invalidateUserSessions(userId);

  return { success: true };
}

/**
 * Resets a user's password (PROPRIETARIO only).
 * Requires mandatory password change upon subsequent login.
 */
export function resetAppUserPassword(
  userId: string,
  newPasswordPlain: string
): { success: boolean; error?: string } {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Usuário não encontrado.' };

  if (!newPasswordPlain || newPasswordPlain.length < 8) {
    return { success: false, error: 'A nova senha deve possuir pelo menos 8 caracteres.' };
  }

  user.salt = generateSalt();
  user.passwordHash = hashPassword(newPasswordPlain, user.salt);
  user.mustChangePassword = true;
  user.algo = 'pbkdf2_sha512_100k';
  user.updatedAt = new Date().toISOString();
  saveUsers();

  // Invalidate old sessions
  invalidateUserSessions(userId);

  return { success: true };
}

/**
 * Changes own password
 */
export function changeUserPassword(
  userId: string,
  oldPasswordPlain: string,
  newPasswordPlain: string
): { success: boolean; error?: string } {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Usuário não encontrado.' };

  const currentComputed = hashPassword(oldPasswordPlain, user.salt);
  let isOldValid = safeCompareHex(user.passwordHash, currentComputed);
  if (!isOldValid && user.algo !== 'pbkdf2_sha512_100k') {
    const legacy = crypto.pbkdf2Sync(oldPasswordPlain, user.salt, 1000, 32, 'sha256').toString('hex');
    isOldValid = safeCompareHex(user.passwordHash, legacy);
  }

  if (!isOldValid) {
    return { success: false, error: 'A senha atual informada está incorreta.' };
  }

  if (!newPasswordPlain || newPasswordPlain.length < 8) {
    return { success: false, error: 'A nova senha deve possuir no mínimo 8 caracteres.' };
  }

  user.salt = generateSalt();
  user.passwordHash = hashPassword(newPasswordPlain, user.salt);
  user.mustChangePassword = false;
  user.algo = 'pbkdf2_sha512_100k';
  user.updatedAt = new Date().toISOString();
  saveUsers();

  // Invalidate all existing sessions for this user so re-login is required with new credentials
  invalidateUserSessions(userId);

  return { success: true };
}

/**
 * List provisioned accounts (display only non-sensitive email and role)
 */
export function getProvisionedAccountsForLogin(): { email: string; name: string; role: UserRole; companyId: string }[] {
  try {
    const users = loadUsers();
    return users
      .filter((u) => u.active && u.companyId === 'empresa-real-001')
      .map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        companyId: u.companyId,
      }));
  } catch {
    return [];
  }
}

/**
 * Creates an isolated test session for automated tests
 */
export function createTestSession(
  role: UserRole = 'PROPRIETARIO',
  companyId: string = 'empresa-real-001',
  unit: string = 'Unidade Principal',
  userName: string = 'Test User'
): UserSession {
  const token = `mrs_test_${crypto.randomBytes(16).toString('hex')}`;
  const session: UserSession = {
    token,
    userId: `usr-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userName,
    userEmail: `test-${role.toLowerCase()}@maricultura.com.br`,
    role,
    companyId,
    unit,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    mustChangePassword: false,
  };
  activeSessions.set(token, session);
  return session;
}

/**
 * Enterprise authentication middleware.
 * - Demo mode: ISOLATED read-only/demo sandbox. Role is CONSULTA, isAuthenticated: false.
 *   Demo mode is STRICTLY FORBIDDEN from accessing any administrative routes (/api/users, /api/backups, /api/scheduler, /api/company).
 * - Real mode: REQUIRES an active, verified server session.
 *   Role, identity, companyId, and unit are strictly derived from the verified session.
 *   Forged headers (x-real-session, x-user-role, x-company-id) are rejected.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Public endpoints
  if (
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/register' ||
    req.path === '/api/auth/google' ||
    req.path === '/api/auth/accounts' ||
    req.path === '/api/auth/setup-owner' ||
    req.path === '/api/auth/setup-allowed' ||
    req.path === '/api/auth/system-declaration'
  ) {
    return next();
  }

  const envQuery = req.query?.env as string | undefined;
  const envHeader = req.headers ? (req.headers['x-environment'] as string) : undefined;
  const rawEnv = envQuery || envHeader || 'demo';
  const environment: 'demo' | 'real' = rawEnv === 'real' ? 'real' : 'demo';
  const isDemo = environment === 'demo';

  // Extract auth token exclusively from Bearer or x-auth-token
  const authHeader = req.headers ? (req.headers['authorization'] || '') : '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const customToken = req.headers ? ((req.headers['x-auth-token'] as string) || '') : '';
  const providedToken = bearerToken || customToken;

  // Administrative path check: Any attempt to access users, backups, scheduler, or company
  const isAdministrativePath =
    req.path.startsWith('/api/users') ||
    req.path.startsWith('/api/backups') ||
    req.path.startsWith('/api/scheduler') ||
    req.path === '/api/company';

  // DEMO MODE: Safe isolated guest sandbox
  if (isDemo) {
    // CRITICAL: Demo mode CANNOT access administrative routes of the real enterprise!
    if (isAdministrativePath) {
      return res.status(403).json({
        error: 'Acesso administrativo recusado no modo demonstração. Operações de gestão de usuários, backups e infraestrutura exigem login verificado na empresa real.',
        code: 'FORBIDDEN_DEMO_ADMIN_ACCESS',
      });
    }

    req.authContext = {
      userId: 'usr-demo-guest',
      userName: 'Visitante (Demonstração)',
      role: 'CONSULTA',
      companyId: 'mari-ne-001',
      unit: 'Unidade Principal',
      environment: 'demo',
      isAuthenticated: false,
    };
    return next();
  }

  // REAL MODE: Must have an active, verified server session
  const session = getActiveSession(providedToken);
  if (!session) {
    return res.status(401).json({
      error: 'Acesso ao ambiente real requer autenticação ativa e verificada no servidor. Faça login com suas credenciais.',
      code: 'UNAUTHORIZED_REAL_ACCESS',
    });
  }

  // Mandatory password change check: if user must change password, block all other mutations
  if (session.mustChangePassword && req.path !== '/api/auth/change-password' && req.path !== '/api/auth/session' && req.path !== '/api/auth/logout') {
    return res.status(403).json({
      error: 'Troca de senha obrigatória no primeiro acesso antes de executar operações.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }

  // Strictly derive identity and permissions from the server-managed session
  const realStore = getStore('real');

  // Multi-tenant check: ensure session's authorized company matches the real store
  if (session.companyId !== realStore.company.id) {
    return res.status(403).json({
      error: `Acesso negado: a sua sessão pertence à empresa "${session.companyId}", mas o recurso solicitado pertence à empresa "${realStore.company.id}".`,
      code: 'FORBIDDEN_TENANT_ACCESS',
    });
  }

  // Unit check
  if (session.unit && !realStore.company.units.includes(session.unit)) {
    return res.status(403).json({
      error: `Acesso negado: a unidade "${session.unit}" não pertence à empresa autorizada.`,
      code: 'FORBIDDEN_UNIT_ACCESS',
    });
  }

  req.authContext = {
    userId: session.userId,
    userName: session.userName,
    userEmail: session.userEmail,
    role: session.role,
    companyId: session.companyId,
    unit: session.unit,
    environment: 'real',
    isAuthenticated: true,
    sessionId: session.token,
    mustChangePassword: session.mustChangePassword,
  };

  // Enforce mutation policies in real mode
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    // Durable storage check in real mode
    if (!isDurableStoreAvailable()) {
      return res.status(503).json({
        error: 'Armazenamento durável indisponível ou em quarentena por corrupção. Modo real de gravação bloqueado para proteção contra perda de dados.',
        code: 'DURABLE_STORAGE_UNAVAILABLE',
      });
    }

    const role = session.role;
    const path = req.path;

    // Role CONSULTA: strictly read-only
    if (role === 'CONSULTA') {
      return res.status(403).json({
        error: 'Acesso negado: o perfil CONSULTA possui apenas permissões de leitura.',
        code: 'FORBIDDEN_READONLY_ROLE',
      });
    }

    // User management: PROPRIETARIO only
    if (path.startsWith('/api/users') && role !== 'PROPRIETARIO') {
      return res.status(403).json({
        error: 'Acesso negado: administração de usuários é restrita ao PROPRIETARIO.',
        code: 'FORBIDDEN_OWNER_ONLY',
      });
    }

    // Company master reconfiguration: PROPRIETARIO only
    if (path === '/api/company' && role !== 'PROPRIETARIO') {
      return res.status(403).json({
        error: 'Acesso negado: reconfiguração institucional da empresa é restrita ao PROPRIETARIO.',
        code: 'FORBIDDEN_OWNER_ONLY',
      });
    }

    // Backups restore: PROPRIETARIO only
    if (path.includes('/restore') && role !== 'PROPRIETARIO') {
      return res.status(403).json({
        error: 'Acesso negado: restauração de backup é restrita ao PROPRIETARIO.',
        code: 'FORBIDDEN_OWNER_ONLY',
      });
    }

    // Role-specific boundaries
    if (role === 'PRODUCAO') {
      if (
        path.startsWith('/api/receivables') ||
        path.startsWith('/api/orders') ||
        path.startsWith('/api/company') ||
        path.startsWith('/api/backups') ||
        path.startsWith('/api/scheduler')
      ) {
        return res.status(403).json({
          error: 'Acesso negado: o perfil PRODUCAO não possui permissão para operações financeiras, comerciais, administrativas ou de infraestrutura.',
          code: 'FORBIDDEN_MODULE_ACCESS',
        });
      }
    } else if (role === 'FINANCEIRO') {
      if (
        path.startsWith('/api/water') ||
        path.startsWith('/api/orders/reserve') ||
        path.startsWith('/api/company') ||
        path.startsWith('/api/scheduler')
      ) {
        return res.status(403).json({
          error: 'Acesso negado: o perfil FINANCEIRO não possui permissão para medições biológicas, reservas comerciais ou configurações do sistema.',
          code: 'FORBIDDEN_MODULE_ACCESS',
        });
      }
    } else if (role === 'COMERCIAL') {
      if (
        path.startsWith('/api/water') ||
        path.startsWith('/api/batches') ||
        path.startsWith('/api/company') ||
        path.startsWith('/api/scheduler') ||
        path.startsWith('/api/backups')
      ) {
        return res.status(403).json({
          error: 'Acesso negado: o perfil COMERCIAL não possui permissão para custos de produção, biologia, backups ou cadastro institucional.',
          code: 'FORBIDDEN_MODULE_ACCESS',
        });
      }
    }
  }

  next();
}
