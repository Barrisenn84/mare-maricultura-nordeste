import {
  Batch,
  WaterMeasurement,
  Incident,
  InventoryItem,
  SalesOrder,
  ReceivableBill,
  AppDocument,
  CompanyConfig,
  EnvironmentMode,
  AuthSession,
  UserRole,
} from '../types';
import {
  INITIAL_COMPANY_CONFIG,
  DEMO_BATCHES,
  DEMO_WATER_MEASUREMENTS,
  DEMO_INCIDENTS,
  DEMO_INVENTORY,
  DEMO_SALES_ORDERS,
  DEMO_RECEIVABLES,
  DEMO_DOCUMENTS,
} from '../mockData';

export interface ClientStoreData {
  company: CompanyConfig;
  batches: Batch[];
  waterMeasurements: WaterMeasurement[];
  incidents: Incident[];
  inventory: InventoryItem[];
  salesOrders: SalesOrder[];
  receivables: ReceivableBill[];
  documents: AppDocument[];
}

const DEMO_STORAGE_KEY = 'mare_demo_store_v1';
const REAL_STORAGE_KEY = 'mare_real_store_v1';
const USERS_STORAGE_KEY = 'mare_users_v1';

export function getInitialDemoData(): ClientStoreData {
  return {
    company: { ...INITIAL_COMPANY_CONFIG },
    batches: JSON.parse(JSON.stringify(DEMO_BATCHES)),
    waterMeasurements: JSON.parse(JSON.stringify(DEMO_WATER_MEASUREMENTS)),
    incidents: JSON.parse(JSON.stringify(DEMO_INCIDENTS)),
    inventory: JSON.parse(JSON.stringify(DEMO_INVENTORY)),
    salesOrders: JSON.parse(JSON.stringify(DEMO_SALES_ORDERS)),
    receivables: JSON.parse(JSON.stringify(DEMO_RECEIVABLES)),
    documents: JSON.parse(JSON.stringify(DEMO_DOCUMENTS)),
  };
}

export function getInitialRealData(): ClientStoreData {
  return {
    company: {
      id: 'empresa-real-001',
      name: 'Minha Empresa Maricultura',
      legalName: 'Minha Empresa Maricultura Ltda.',
      cnpj: '12.345.678/0001-90',
      modality: 'AMBAS',
      ownerName: 'Proprietário',
      city: 'Tibau do Sul',
      state: 'RN',
      units: ['Fazenda Tibau', 'Laboratório Guamaré'],
      activeUnit: 'Fazenda Tibau',
      primaryProblem: 'Gestão aquícola profissional',
      systemsInUse: 'Sistema Maré',
    },
    batches: [],
    waterMeasurements: [],
    incidents: [],
    inventory: [
      {
        id: 'inv-r1',
        code: 'RAC-01',
        name: 'Ração Inicial 35% PB',
        category: 'RACAO',
        unit: 'KG',
        usableBalance: 2000,
        averageDailyConsumption: 100,
        leadTimeDays: 7,
        safetyStockDays: 5,
        reservedBalance: 0,
        lastUpdated: '2026-09-01',
      },
    ],
    salesOrders: [],
    receivables: [],
    documents: [],
  };
}

export function loadClientStore(env: EnvironmentMode): ClientStoreData {
  const key = env === 'demo' ? DEMO_STORAGE_KEY : REAL_STORAGE_KEY;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Erro ao ler localStorage:', e);
  }

  const initial = env === 'demo' ? getInitialDemoData() : getInitialRealData();
  saveClientStore(env, initial);
  return initial;
}

export function saveClientStore(env: EnvironmentMode, data: ClientStoreData): void {
  const key = env === 'demo' ? DEMO_STORAGE_KEY : REAL_STORAGE_KEY;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }
}

export function resetDemoClientStore(): ClientStoreData {
  const fresh = getInitialDemoData();
  saveClientStore('demo', fresh);
  return fresh;
}

export function clearClientStore(env: EnvironmentMode, resetCompany: boolean): ClientStoreData {
  const blank = env === 'demo' ? getInitialDemoData() : getInitialRealData();
  if (!resetCompany) {
    const current = loadClientStore(env);
    blank.company = current.company;
  }
  blank.batches = [];
  blank.waterMeasurements = [];
  blank.incidents = [];
  blank.inventory = [];
  blank.salesOrders = [];
  blank.receivables = [];
  blank.documents = [];
  saveClientStore(env, blank);
  return blank;
}

// Client-Side Auth Management (fallback for static hosting like Vercel)
export interface ClientUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  companyId: string;
  unit: string;
}

export function loadClientUsers(): ClientUser[] {
  try {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [
    {
      id: 'usr-admin-01',
      name: 'Barrinho Gonçalves',
      email: 'barrinho1602@gmail.com',
      passwordHash: '123456',
      role: 'PROPRIETARIO',
      companyId: 'empresa-real-001',
      unit: 'Fazenda Tibau',
    },
    {
      id: 'usr-admin-02',
      name: 'Gestor Maricultura',
      email: 'nuncaparedelutar1988@gmail.com',
      passwordHash: '123456',
      role: 'PROPRIETARIO',
      companyId: 'empresa-real-001',
      unit: 'Fazenda Tibau',
    },
  ];
}

export function saveClientUsers(users: ClientUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {}
}

export function registerClientUser(
  name: string,
  email: string,
  password: string,
  role: UserRole = 'PROPRIETARIO',
  unit: string = 'Fazenda Tibau'
): { success: boolean; session?: AuthSession; error?: string } {
  const users = loadClientUsers();
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  let user = users.find((u) => u.email === cleanEmail);
  if (!user) {
    user = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: password,
      role,
      companyId: 'empresa-real-001',
      unit,
    };
    users.push(user);
    saveClientUsers(users);
  }

  const session: AuthSession = {
    token: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    companyId: user.companyId,
    unit: user.unit,
    expiresAt: Date.now() + 86400000,
  };

  sessionStorage.setItem('mare_auth_token', session.token);
  return { success: true, session };
}

export function loginClientUser(
  email: string,
  password: string
): { success: boolean; session?: AuthSession; error?: string } {
  const users = loadClientUsers();
  const cleanEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email === cleanEmail);

  // If user exists or create automatically in standalone mode
  const resolvedUser = user || {
    id: `usr-${Date.now()}`,
    name: cleanEmail.split('@')[0],
    email: cleanEmail,
    passwordHash: password,
    role: 'PROPRIETARIO' as UserRole,
    companyId: 'empresa-real-001',
    unit: 'Fazenda Tibau',
  };

  if (!user) {
    users.push(resolvedUser);
    saveClientUsers(users);
  }

  const session: AuthSession = {
    token: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId: resolvedUser.id,
    userName: resolvedUser.name,
    userEmail: resolvedUser.email,
    role: resolvedUser.role,
    companyId: resolvedUser.companyId,
    unit: resolvedUser.unit,
    expiresAt: Date.now() + 86400000,
  };

  sessionStorage.setItem('mare_auth_token', session.token);
  return { success: true, session };
}
