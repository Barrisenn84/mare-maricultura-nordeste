import { Batch, SalesOrder, ReceivableBill, InventoryItem, WaterMeasurement, Incident } from '../types';

export const REFERENCE_CLOCK = new Date('2026-09-16T12:00:00-03:00');
export const MAX_UPLOAD_BYTES = 100_000_000; // 100 MB inclusive

/**
 * Format currency in BRL: R$ 1.234,56
 */
export function formatCurrencyBRL(val: number): string {
  if (isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Format number in Brazilian standard: 1.234,56
 */
export function formatNumberBR(val: number, decimals: number = 2): string {
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

/**
 * Format date in DD/MM/AAAA.
 * Guarantees civil dates (YYYY-MM-DD) are formatted without UTC timezone displacement.
 */
export function formatDateBR(dateStrOrObj: string | Date): string {
  try {
    if (typeof dateStrOrObj === 'string') {
      const trimmed = dateStrOrObj.trim();
      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return `${day}/${month}/${year}`;
      }
    }
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateStrOrObj);
  }
}

/**
 * Calculate total cost of a batch
 */
export function calculateBatchTotalCost(batch: Batch): number {
  if (!batch.costs || batch.costs.length === 0) return 0;
  return batch.costs.reduce((sum, item) => sum + (item.amount || 0), 0);
}

/**
 * Calculate unit cost for Engorda (R$ / kg) or Larvicultura (R$ / milheiro)
 */
export function calculateBatchUnitCost(batch: Batch): {
  unitCost: number;
  unitLabel: string;
  isComplete: boolean;
  notes: string;
} {
  const totalCost = calculateBatchTotalCost(batch);

  if (batch.modality === 'ENGORDA') {
    if (!batch.sellableQuantity || batch.sellableQuantity <= 0) {
      return {
        unitCost: 0,
        unitLabel: 'R$ / kg',
        isComplete: false,
        notes: 'Quantidade vendável zerada ou não informada',
      };
    }
    const unitCost = totalCost / batch.sellableQuantity;
    return {
      unitCost,
      unitLabel: 'R$ / kg',
      isComplete: batch.status === 'ENCERRADO' && totalCost > 0,
      notes: batch.status === 'EM_ANDAMENTO' ? 'Custo parcial (lote em andamento)' : 'Custo final apurado',
    };
  } else {
    // LARVICULTURA: R$ / milheiro
    const milheiros =
      batch.sellableUnit === 'MILHEIRO'
        ? batch.sellableQuantity || 0
        : (batch.sellableQuantity || 0) / 1000;
    if (milheiros <= 0) {
      return {
        unitCost: 0,
        unitLabel: 'R$ / milheiro',
        isComplete: false,
        notes: 'Contagem de pós-larvas zerada ou não informada',
      };
    }
    const unitCost = totalCost / milheiros;
    return {
      unitCost,
      unitLabel: 'R$ / milheiro',
      isComplete: batch.status === 'ENCERRADO' && totalCost > 0,
      notes: batch.status === 'EM_ANDAMENTO' ? 'Custo parcial (lote em andamento)' : 'Custo final apurado',
    };
  }
}

/**
 * Feed Conversion Ratio (FCA / FCR) for Engorda:
 * FCA = Ração consumida (kg) / Ganho de Biomassa (kg)
 * Ganho de biomassa = Biomassa final (kg) - Biomassa inicial (kg)
 */
export function calculateFeedConversionRatio(batch: Batch): {
  fca: number | null;
  biomassGainKg: number;
  isValid: boolean;
  message: string;
} {
  if (batch.modality !== 'ENGORDA') {
    return {
      fca: null,
      biomassGainKg: 0,
      isValid: false,
      message: 'FCA não se aplica à larvicultura',
    };
  }

  const initial = batch.initialBiomassKg ?? 0;
  const finalBio = batch.finalBiomassKg ?? batch.sellableQuantity ?? 0;
  const feed = batch.feedConsumedKg ?? 0;

  const gain = finalBio - initial;
  if (gain <= 0) {
    return {
      fca: null,
      biomassGainKg: gain,
      isValid: false,
      message: 'Ganho de biomassa nulo ou negativo. Cálculo bloqueado.',
    };
  }

  if (feed <= 0) {
    return {
      fca: null,
      biomassGainKg: gain,
      isValid: false,
      message: 'Consumo de ração não informado.',
    };
  }

  const fca = feed / gain;
  return {
    fca,
    biomassGainKg: gain,
    isValid: true,
    message: `FCA apurado: ${formatNumberBR(fca, 3)} kg ração / kg camarão`,
  };
}

/**
 * Inventory Coverage & Restocking:
 * Cobertura (dias) = Saldo utilizável / Consumo médio diário
 * Solicitação necessária se Cobertura <= Prazo de entrega + Estoque de segurança
 */
export function checkInventoryItemRestock(item: InventoryItem): {
  coverageDays: number | null;
  needsRestock: boolean;
  leadTimePlusSafety: number;
  suggestedReorderQuantity: number;
  reason: string;
} {
  const leadPlusSafe = item.leadTimeDays + item.safetyStockDays;
  if (item.averageDailyConsumption <= 0) {
    return {
      coverageDays: null,
      needsRestock: false,
      leadTimePlusSafety: leadPlusSafe,
      suggestedReorderQuantity: 0,
      reason: 'Consumo médio insuficiente para calcular previsão de estoque',
    };
  }

  const coverageDays = item.usableBalance / item.averageDailyConsumption;
  const needsRestock = coverageDays <= leadPlusSafe;
  const suggestedReorderQuantity = needsRestock
    ? Math.max(0, (leadPlusSafe * 2) * item.averageDailyConsumption - item.usableBalance)
    : 0;

  return {
    coverageDays,
    needsRestock,
    leadTimePlusSafety: leadPlusSafe,
    suggestedReorderQuantity,
    reason: needsRestock
      ? `Cobertura crítica (${coverageDays.toFixed(1)} dias) menor ou igual à soma de entrega (${item.leadTimeDays}d) + segurança (${item.safetyStockDays}d)`
      : `Estoque regular com ${coverageDays.toFixed(1)} dias de cobertura`,
  };
}

/**
 * Contribution Margin for a Sales Order:
 * Margem = Receita Bruta - Custos Variáveis - Frete - Tributos/Comissões
 * (Receita Bruta = Quantidade * Preço Unitário)
 */
export function calculateContributionMargin(order: SalesOrder): {
  grossRevenue: number;
  totalVariableCost: number;
  freightCost: number;
  taxesAndCommission: number;
  contributionMargin: number;
  contributionMarginPercent: number;
} {
  const grossRevenue = order.quantity * order.unitPrice;
  const totalVariableCost = order.quantity * order.variableCostPerUnit;
  const freightCost = order.freightCost || 0;
  const taxesAndCommission = grossRevenue * ((order.taxAndCommissionRatePercent || 0) / 100);

  const contributionMargin = grossRevenue - totalVariableCost - freightCost - taxesAndCommission;
  const contributionMarginPercent = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;

  return {
    grossRevenue,
    totalVariableCost,
    freightCost,
    taxesAndCommission,
    contributionMargin,
    contributionMarginPercent,
  };
}

/**
 * Receivable Bill Status & Collection Verification:
 * Saldo = originalAmount - receivedAmount
 * Regra:
 * - Se quitado (saldo <= 0), NENHUMA cobrança.
 * - Se em disputa ativa, NENHUMA cobrança.
 * - Se não conciliado, cobrança suspensa.
 * - Pagamento excedente vira crédito para conciliação.
 */
export function checkReceivableBill(bill: ReceivableBill, referenceDate: Date = REFERENCE_CLOCK): {
  balanceRemaining: number;
  overpaymentCredit: number;
  isOverdue: boolean;
  daysOverdue: number;
  eligibleForCollection: boolean;
  collectionStatusText: string;
} {
  const diff = bill.originalAmount - bill.receivedAmount;
  const balanceRemaining = Math.max(0, diff);
  const overpaymentCredit = diff < 0 ? Math.abs(diff) : 0;

  // Parse DD/MM/AAAA or ISO
  let dueDateObj: Date;
  if (bill.dueDate.includes('/')) {
    const [d, m, y] = bill.dueDate.split('/').map(Number);
    dueDateObj = new Date(y, m - 1, d, 12, 0, 0);
  } else {
    dueDateObj = new Date(bill.dueDate);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.floor((referenceDate.getTime() - dueDateObj.getTime()) / msPerDay);
  const isOverdue = balanceRemaining > 0 && daysDiff > 0 && !bill.hasActiveDispute;
  const daysOverdue = isOverdue ? daysDiff : 0;

  let eligibleForCollection = false;
  let collectionStatusText = '';

  if (balanceRemaining <= 0) {
    eligibleForCollection = false;
    collectionStatusText = 'Título integralmente liquidado — nenhuma cobrança gerada.';
  } else if (bill.hasActiveDispute) {
    eligibleForCollection = false;
    collectionStatusText = 'Cobrança suspensa: título com disputa comercial ativa.';
  } else if (!bill.isReconciled) {
    eligibleForCollection = false;
    collectionStatusText = 'Cobrança suspensa: título aguardando conciliação bancária.';
  } else if (isOverdue) {
    eligibleForCollection = true;
    collectionStatusText = `Título vencido há ${daysOverdue} dias. Saldo a receber: ${formatCurrencyBRL(balanceRemaining)}`;
  } else {
    eligibleForCollection = false;
    collectionStatusText = `A vencer em ${Math.abs(daysDiff)} dias.`;
  }

  return {
    balanceRemaining,
    overpaymentCredit,
    isOverdue,
    daysOverdue,
    eligibleForCollection,
    collectionStatusText,
  };
}

/**
 * Parses Brazilian formatted currency/numbers into standard float:
 * "12.000,50" -> 12000.50
 * "1.500" -> 1500
 * "R$ 3.500,00" -> 3500
 * "1500.50" -> 1500.50
 */
export function parseBrazilianNumber(val: any): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (!val && val !== 0) return 0;

  let str = String(val).trim();
  str = str.replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!str) return 0;

  // If contains both '.' and ',', standard Brazilian: 1.234,56
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Only comma: 1234,56
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Only dot: e.g. "1.500", "12.000", "1.500.000"
    // In Brazilian standard, dot followed by 3 digits is a thousands separator!
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Water Measurement check against threshold, age, validity, and future dates:
 * - Date check: must be a valid, parseable date string
 * - Validity check: finite number (not NaN or undefined)
 * - Future date check: collectedAt must not be in the future relative to refDate
 * - Age check: difference in minutes between reference clock and collectedAt
 * - Threshold check: minAcceptable <= value <= maxAcceptable
 */
export function evaluateWaterMeasurement(m: WaterMeasurement, refDate: Date = REFERENCE_CLOCK): {
  isOutRange: boolean;
  isDelayed: boolean;
  isInvalid: boolean;
  isFuture: boolean;
  ageMinutes: number;
  diagnostic: string;
} {
  // 1. Strict validation of date
  const collected = new Date(m.collectedAt);
  const isValidDate = Boolean(m.collectedAt) && !isNaN(collected.getTime()) && m.collectedAt !== 'not-a-date';

  // 2. Strict validation of value
  const numVal = Number(m.value);
  const isNumericInvalid = typeof m.value !== 'number' || isNaN(numVal) || !Number.isFinite(numVal);

  const isInvalid = isNumericInvalid || !isValidDate;

  if (!isValidDate) {
    return {
      isOutRange: true,
      isDelayed: false,
      isInvalid: true,
      isFuture: false,
      ageMinutes: 0,
      diagnostic: `Data de coleta inválida ou corrompida ("${m.collectedAt}"). Proibido classificar como normal.`,
    };
  }

  if (isNumericInvalid) {
    return {
      isOutRange: true,
      isDelayed: false,
      isInvalid: true,
      isFuture: false,
      ageMinutes: 0,
      diagnostic: 'Valor de leitura não numérico ou corrompido. Proibido classificar como normal.',
    };
  }

  const ageMs = refDate.getTime() - collected.getTime();
  // Allow up to 30 seconds clock skew tolerance
  const isFuture = ageMs < -30000;
  const ageMinutes = !isFuture ? Math.max(0, Math.floor(ageMs / (1000 * 60))) : 0;
  const isDelayed = !isFuture && ageMinutes > m.maxAgeMinutes;
  const isOutOfAcceptableRange = numVal < m.minAcceptable || numVal > m.maxAcceptable;
  const isOutRange = isFuture || isOutOfAcceptableRange;

  let diagnostic = 'Parâmetro em conformidade';
  if (isFuture) {
    diagnostic = `Data de coleta futura (${collected.toISOString()}) em relação ao relógio de referência (${refDate.toISOString()}). Proibido classificar como normal.`;
  } else if (isOutOfAcceptableRange) {
    diagnostic = `Leitura fora da faixa (${numVal} ${m.unitMeasurement} fora de ${m.minAcceptable}-${m.maxAcceptable})`;
  } else if (isDelayed) {
    diagnostic = `Leitura atrasada (${ageMinutes} min decorridos, limite de atualização é ${m.maxAgeMinutes} min)`;
  }

  return {
    isOutRange,
    isDelayed,
    isInvalid: false,
    isFuture,
    ageMinutes,
    diagnostic,
  };
}

export interface ProcessedBiometryPoint {
  id: string;
  date: string;
  dayOfCulture: number;
  week: number;
  averageWeightG: number;
  periodGainG: number;
  gmdPeriodG: number;
  gmdAccumulatedG: number;
  weeklyGainG: number;
  sampleSize?: number;
  uniformityPercent?: number;
  notes?: string;
  isWeightDrop?: boolean;
  benchmarkGmd: number;
  benchmarkWeightG: number;
}

/**
 * Recalculates the entire biometry series for a batch in strict chronological order.
 * - Validates dates strictly (rejects 'not-a-date' or invalid dates)
 * - Computes exact Day of Culture (DOC) from batch.startDate
 * - Calculates period GMD: (currentWeight - prevWeight) / daysDiff
 * - Does NOT silence weight drops with Math.max(0, ...); signals them explicitly
 * - Accurately updates both period GMD and accumulated GMD across the entire series
 */
export function recalculateBatchBiometrics(
  batch: Batch,
  benchmarkGmdTarget: number = 0.18
): ProcessedBiometryPoint[] {
  if (!batch.biometrics || batch.biometrics.length === 0) {
    return [];
  }

  // Filter out any invalid records with invalid dates
  const validRecords = batch.biometrics.filter((b) => {
    if (!b.date || b.date === 'not-a-date') return false;
    const t = new Date(b.date).getTime();
    return !isNaN(t);
  });

  // Sort biometrics chronologically
  const sorted = [...validRecords].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const startTimestamp = new Date(batch.startDate).getTime();
  const hasValidStart = !isNaN(startTimestamp);

  // Initial weight: use recorded stocking weight if available
  const initialWeight = batch.initialBiomassKg && batch.initialPopulationCount && batch.initialPopulationCount > 0
    ? (batch.initialBiomassKg * 1000) / batch.initialPopulationCount
    : 0.02; // Reference PL10 weight (0.02g) used as baseline hypothesis

  return sorted.map((bio, index) => {
    const bioTimestamp = new Date(bio.date).getTime();
    let dayOfCulture = bio.dayOfCulture;
    if (dayOfCulture === undefined || dayOfCulture === null || isNaN(dayOfCulture)) {
      dayOfCulture = hasValidStart
        ? Math.max(0, Math.round((bioTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)))
        : 0;
    }

    const week = Math.max(1, Math.ceil(dayOfCulture / 7));
    const prev = index > 0 ? sorted[index - 1] : null;

    let periodGainG = 0;
    let gmdPeriodG = 0;
    let isWeightDrop = false;

    if (prev) {
      const prevTimestamp = new Date(prev.date).getTime();
      let prevDoc = prev.dayOfCulture;
      if (prevDoc === undefined || prevDoc === null || isNaN(prevDoc)) {
        prevDoc = hasValidStart
          ? Math.max(0, Math.round((prevTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)))
          : 0;
      }
      const daysDiff = dayOfCulture - prevDoc;
      const weightDiff = bio.averageWeightG - prev.averageWeightG;
      periodGainG = weightDiff;

      if (weightDiff < 0) {
        isWeightDrop = true;
      }

      if (daysDiff > 0) {
        gmdPeriodG = Number((weightDiff / daysDiff).toFixed(3));
      } else {
        // Same day measurement or inverted date
        gmdPeriodG = 0;
      }
    } else {
      if (dayOfCulture > 0) {
        periodGainG = bio.averageWeightG - initialWeight;
        gmdPeriodG = Number((periodGainG / dayOfCulture).toFixed(3));
      } else {
        periodGainG = 0;
        gmdPeriodG = 0;
      }
    }

    const totalDays = Math.max(1, dayOfCulture);
    const accumulatedGain = bio.averageWeightG - initialWeight;
    const gmdAccumulatedG = Number((accumulatedGain / totalDays).toFixed(3));
    const weeklyGainG = Number((gmdPeriodG * 7).toFixed(2));
    const benchmarkWeightG = Number((initialWeight + benchmarkGmdTarget * dayOfCulture).toFixed(2));

    return {
      id: bio.id || `bio-${index}`,
      date: bio.date,
      dayOfCulture,
      week,
      averageWeightG: bio.averageWeightG,
      periodGainG: Number(periodGainG.toFixed(2)),
      gmdPeriodG,
      gmdAccumulatedG,
      weeklyGainG,
      sampleSize: bio.sampleSize,
      uniformityPercent: bio.uniformityPercent,
      notes: isWeightDrop ? `${bio.notes || ''} [Atenção: Redução de peso médio registrada vs amostragem anterior]`.trim() : bio.notes,
      isWeightDrop,
      benchmarkGmd: benchmarkGmdTarget,
      benchmarkWeightG,
    };
  });
}

/**
 * Calculates GMD (Ganho de Peso Médio Diário) progression for a batch.
 * Always computes from the full chronological series to ensure correctness.
 */
export function calculateBatchBiometricsGMD(
  batch: Batch,
  benchmarkGmdTarget: number = 0.18
): ProcessedBiometryPoint[] {
  return recalculateBatchBiometrics(batch, benchmarkGmdTarget);
}

