export type ProductionModality = 'ENGORDA' | 'LARVICULTURA' | 'AMBAS';
export type EnvironmentMode = 'demo' | 'real';
export type UserRole = 'PROPRIETARIO' | 'GERENTE' | 'PRODUCAO' | 'FINANCEIRO' | 'COMERCIAL' | 'CONSULTA';
export type NavigationTab = 'overview' | 'production' | 'costs' | 'sales' | 'documents' | 'reports' | 'market';
export type MainNavView = NavigationTab | 'costs_inventory' | 'sales_receivables' | 'documents_import' | 'settings';

export interface AuthSession {
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  companyId: string;
  unit: string;
  expiresAt: number;
}

export type DataStatus = 'INFORMADO' | 'CONFERIDO' | 'INCOMPLETO' | 'SIMULADO';

export interface CompanyConfig {
  id?: string;
  name: string;
  legalName?: string;
  cnpj?: string;
  modality?: ProductionModality;
  units: string[];
  ownerName: string;
  city?: string;
  state?: string;
  primaryProblem?: string;
  systemsInUse?: string;
  activeUnit?: string;
}

export interface BatchCostItem {
  id: string;
  category: 'RACAO' | 'POS_LARVAS' | 'ENERGIA' | 'MAO_DE_OBRA' | 'MANUTENCAO' | 'OUTROS';
  description: string;
  amount: number; // in Reais (or cents)
  quantity?: number;
  unit?: string;
  date: string;
  invoiceNumber?: string;
  status: DataStatus;
}

export interface BiometryRecord {
  id: string;
  date: string;
  dayOfCulture: number;
  week?: number;
  averageWeightG: number;
  gmdPeriodG?: number;
  gmdAccumulatedG?: number;
  sampleSize?: number;
  uniformityPercent?: number;
  notes?: string;
}

export interface Batch {
  id: string;
  code: string;
  unit: string;
  pondId: string;
  species: string;
  modality: 'ENGORDA' | 'LARVICULTURA';
  status: 'EM_ANDAMENTO' | 'ENCERRADO';
  startDate: string;
  endDate?: string;
  responsible: string;
  initialBiomassKg?: number;
  finalBiomassKg?: number;
  sellableQuantity: number; // kg for engorda, count of post-larvae for larvicultura
  sellableUnit: 'KG' | 'MILHEIRO' | 'UNIDADES';
  feedConsumedKg?: number;
  budgetedCostPerUnit?: number;
  costs: BatchCostItem[];
  biometrics?: BiometryRecord[];
  notes?: string;
  // Survival
  initialPopulationCount?: number;
  finalPopulationCount?: number;
  hasSurvivalData: boolean;
}

export interface WaterMeasurement {
  id: string;
  pondId: string;
  unit: string;
  parameter: 'OXIGENIO' | 'TEMPERATURA' | 'PH' | 'SALINIDADE' | 'AMONIA';
  value: number;
  unitMeasurement: string;
  collectedAt: string; // ISO string or DD/MM/AAAA HH:mm
  collectedBy: string;
  calibrationStatus?: 'CALIBRADO' | 'PENDENTE' | 'NAO_INFORMADO';
  minAcceptable: number;
  maxAcceptable: number;
  maxAgeMinutes: number;
  status: 'NORMAL' | 'FORA_DA_FAIXA' | 'LEITURA_ATRASADA';
}

export interface Incident {
  id: string;
  pondId: string;
  unit: string;
  ruleCode: string;
  severity: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
  title: string;
  evidence: string;
  responsible: string;
  nextAction: string;
  status: 'ABERTO' | 'EM_ATENDIMENTO' | 'RESOLVIDO';
  openedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: 'RACAO' | 'INSUMO' | 'FERTILIZANTE' | 'EQUIPAMENTO';
  unit: string;
  usableBalance: number;
  averageDailyConsumption: number;
  leadTimeDays: number;
  safetyStockDays: number;
  reservedBalance: number;
  lastUpdated: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  productId: string;
  productName: string;
  batchId: string;
  quantity: number;
  commercialUnit: 'KG' | 'MILHEIRO';
  unitPrice: number;
  freightCost: number;
  variableCostPerUnit: number;
  taxAndCommissionRatePercent: number; // e.g. 8%
  status: 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'RESERVADO' | 'ENTREGUE' | 'ENCERRADO' | 'CANCELADO';
  dueDate: string;
  responsible: string;
  isReserved: boolean;
  reservationNotes?: string;
}

export interface ReceivableBill {
  id: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  salesOrderId?: string;
  customerName: string;
  originalAmount: number;
  receivedAmount: number;
  dueDate: string; // DD/MM/AAAA
  isReconciled: boolean;
  status: 'PENDENTE' | 'PAGO' | 'PAGAMENTO_PARCIAL' | 'EM_DISPUTA' | 'CANCELADO';
  hasActiveDispute: boolean;
  disputeReason?: string;
  lastPaymentDate?: string;
  overpaymentCredit?: number;
}

export interface AppDocument {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  fileExtension: string;
  companyId: string;
  unit: string;
  batchId?: string;
  category: 'NOTA_FISCAL' | 'LAUDO_AGUA' | 'PLANILHA_BIOMETRIA' | 'CONTRATO' | 'OUTROS';
  uploadedAt: string;
  uploadedBy: string;
  status: 'ENVIANDO' | 'RECEBIDO' | 'NA_FILA' | 'EM_ANALISE' | 'AGUARDANDO_CONFERENCIA' | 'PENDENTE_CONFERENCIA_MANUAL' | 'CONCLUIDO' | 'SEM_ANALISE_AUTOMATICA' | 'FALHA';
  progressPercent: number;
  pagesProcessed?: number;
  totalPages?: number;
  currentStageDescription?: string;
  processingLogs?: Array<{ timestamp: string; message: string; page?: number }>;
  errorMessage?: string;
  extractedDraft?: {
    totalValue?: number;
    items?: Array<{ description: string; value: number; category: string }>;
    evidencePage?: number;
    confidenceNote?: string;
  };
  confirmedByHuman: boolean;
  splitPagesCount?: number;
  agentAnalysis?: DocumentAgentAnalysis;
}

export interface DocumentAgentAnalysis {
  documentType: 'NF_RACAO' | 'FATURA_ENERGIA' | 'RECIBO_POS_LARVAS' | 'RELATORIO_BIOMETRIA' | 'BOLETO_BANCARIO' | 'OUTROS';
  documentTypeLabel: string;
  supplierOrCustomer?: string;
  cnpjOrCpf?: string;
  detectedInvoiceNumber?: string;
  detectedDate?: string;
  totalAmount: number;
  items: Array<{
    description: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    totalAmount: number;
    category: 'RACAO' | 'POS_LARVAS' | 'ENERGIA' | 'MAO_DE_OBRA' | 'MANUTENCAO' | 'OUTROS';
  }>;
  suggestedBatchId?: string;
  suggestedBatchCode?: string;
  confidenceScore: number; // 0 to 100
  anomaliesDetected: Array<{
    type: 'DUPLICATE_FILE' | 'DUPLICATE_INVOICE' | 'PRICE_OUTLIER' | 'MISSING_MANDATORY_FIELD' | 'DATE_MISMATCH';
    severity: 'ALTA' | 'MEDIA' | 'BAIXA';
    message: string;
    evidence: string;
  }>;
  summary: string;
  analyzedAt: string;
}

export interface MarketReferenceItem {
  id: string;
  category: 'CAMARAO_VIVO' | 'RACAO' | 'POS_LARVAS';
  productName: string;
  specification: string; // Ex: '10-12g', '35% PB - Saco 25kg', 'PL-10'
  unit: 'KG' | 'MILHEIRO' | 'SACO_25KG';
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
  region: string; // Ex: 'RN - Litoral Sul', 'CE - Jaguaruana', 'BA - Valença'
  state: 'RN' | 'CE' | 'PB' | 'BA' | 'PE';
  source: string; // Ex: 'ABCC / Cooperativas RN', 'CEASA-CE', 'Cotação Regional'
  quotedAt: string; // DD/MM/AAAA
  tendency: 'ESTAVEL' | 'ALTA' | 'BAIXA';
  notes?: string;
}

export interface RegionalWeatherAlert {
  id: string;
  region: string; // Ex: 'Litoral Sul Potiguar (Tibau do Sul / Canguaretama)'
  state: 'RN' | 'CE' | 'PB' | 'BA';
  forecastPeriod: string; // Ex: '16/09 a 22/09/2026'
  condition: 'ENSOLARADO' | 'PARCIALMENTE_NUBLADO' | 'CHUVA_MODERADA' | 'CHUVA_INTENSA_ALERTA';
  temperatureMinC: number;
  temperatureMaxC: number;
  precipitationExpectedMm: number;
  tidePhase: 'SIZIGIA' | 'QUADRATURA';
  impactOnPonds: string; // Ex: 'Risco de queda de oxigênio em dias nublados e variação de salinidade pós-chuva.'
  operationalRecommendation: string; // Ex: 'Ajustar taxa de arraçoamento e manter aeradores em prontidão às 03:00.'
  source: string; // Ex: 'INMET / CPTEC / Marinha do Brasil'
  updatedAt: string;
}

export interface SystemTestResult {
  id: number;
  title: string;
  requirementNumber: number;
  passed: boolean;
  details: string;
  evidence: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  unit: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  mustChangePassword?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  environment: EnvironmentMode;
  action: string;
  targetEntity: string;
  recordId?: string;
  details?: string;
}

export interface SchedulerExecutionEntry {
  timestamp: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  anomaliesCount: number;
  details?: string;
}

export interface SchedulerJobInfo {
  id: string;
  name: string;
  description: string;
  scheduleDescription: string;
  intervalMinutes: number;
  timezone: string;
  lastRunAt?: string;
  nextRunAt?: string;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  anomaliesFound?: number;
  lastError?: string;
  enabled: boolean;
  history: SchedulerExecutionEntry[];
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  fileName: string;
  sizeBytes: number;
  reason: string;
  filesCount: number;
  schemaVersion: number;
  isValid: boolean;
}

export interface PdfProcessingJob {
  id: string;
  documentId: string;
  fileName: string;
  totalPages: number;
  pagesProcessed: number;
  currentChunk: number;
  totalChunks: number;
  stage: 'RECEBIDO' | 'IDENTIFICANDO_PAGINAS' | 'PROCESSANDO_TRECHOS' | 'AGUARDANDO_CONFERENCIA' | 'FALHA' | 'NOT_CONFIGURED' | 'PROTEGIDO';
  progressPercent: number;
  results?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConnectionStatus {
  configured: boolean;
  model: string;
  working: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}
