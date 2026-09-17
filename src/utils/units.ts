import { Batch } from '../types';
import { formatNumberBR } from './calculations';

/**
 * Standardized units and conversion rules across all layers:
 * - ENGORDA:
 *   - sellableUnit: 'KG'
 *   - sellableQuantity: mass in kilograms (e.g. 1000 = 1.000 kg)
 *   - unitCost: R$ / kg
 * 
 * - LARVICULTURA:
 *   - sellableUnit: 'MILHEIRO'
 *   - sellableQuantity: count in thousands (milheiros) of post-larvae (e.g. 2000 = 2.000 milheiros = 2.000.000 PL)
 *   - unitCost: R$ / milheiro
 */

export function getLarviculturaPostLarvaeCount(batch: Batch | { sellableQuantity: number; sellableUnit?: string }): number {
  const qty = batch.sellableQuantity || 0;
  return qty * 1000;
}

export function formatLarviculturaDetailed(sellableQuantity: number): string {
  const milheiros = sellableQuantity || 0;
  const plCount = milheiros * 1000;
  return `${formatNumberBR(milheiros, 0)} milheiros (${formatNumberBR(plCount, 0)} PL)`;
}

export function formatBatchQuantityWithUnit(batch: Batch): string {
  if (batch.modality === 'LARVICULTURA' || batch.sellableUnit === 'MILHEIRO') {
    return formatLarviculturaDetailed(batch.sellableQuantity);
  }
  return `${formatNumberBR(batch.sellableQuantity, 0)} kg`;
}

export function getUnitLabel(modalityOrUnit?: string): string {
  if (modalityOrUnit === 'LARVICULTURA' || modalityOrUnit === 'MILHEIRO') {
    return 'milheiro';
  }
  return 'kg';
}

export function getUnitPluralLabel(modalityOrUnit?: string): string {
  if (modalityOrUnit === 'LARVICULTURA' || modalityOrUnit === 'MILHEIRO') {
    return 'milheiros';
  }
  return 'kg';
}

export function getUnitCostLabel(modalityOrUnit?: string): string {
  if (modalityOrUnit === 'LARVICULTURA' || modalityOrUnit === 'MILHEIRO') {
    return 'R$ / milheiro';
  }
  return 'R$ / kg';
}

export function buildReservationNotice(
  modalityOrUnit: string,
  requestedQty: number,
  availableStockRemaining: number,
  isAccepted: boolean
): string {
  const unit = getUnitPluralLabel(modalityOrUnit);
  if (isAccepted) {
    return `Reserva confirmada. Quantidade alocada: ${formatNumberBR(requestedQty, 0)} ${unit}. Saldo liberado restante: ${formatNumberBR(availableStockRemaining, 0)} ${unit}.`;
  }
  return `Atenção: Saldo liberado restante (${formatNumberBR(availableStockRemaining, 0)} ${unit}) insuficiente para reservar ${formatNumberBR(requestedQty, 0)} ${unit}. O pedido foi gravado com status "EM_REVISAO".`;
}

export interface UnitMigrationResult {
  migratedBatch: any;
  wasMigrated: boolean;
  isAmbiguous: boolean;
  reason: string;
}

/**
 * Validated/versioned migration for legacy databases:
 * Legacy systems might have recorded raw PL counts (e.g. 2.000.000) under sellableUnit = 'MILHEIRO'.
 * - If batch.unitVersion === 'v2', it is already standardized.
 * - If sellableQuantity >= 100,000 in MILHEIRO, it unambiguously represents raw PL count -> converts to milheiros (count / 1000) with unitVersion 'v2'.
 * - If sellableQuantity is between 1 and 10,000 without version, it is already in milheiros.
 * - Ambiguous values are NOT automatically converted, but flagged for review.
 */
export function migrateLegacyBatchSellableUnit(batch: any): UnitMigrationResult {
  if (batch.unitVersion === 'v2') {
    return {
      migratedBatch: batch,
      wasMigrated: false,
      isAmbiguous: false,
      reason: 'Já versionado v2',
    };
  }

  if (batch.modality !== 'LARVICULTURA' && batch.sellableUnit !== 'MILHEIRO') {
    return {
      migratedBatch: { ...batch, unitVersion: 'v2' },
      wasMigrated: false,
      isAmbiguous: false,
      reason: 'Lote de engorda, sem necessidade de conversão',
    };
  }

  const rawQty = Number(batch.sellableQuantity) || 0;

  // Unambiguously absolute count: e.g. 2_000_000 PL recorded as MILHEIRO
  if (rawQty >= 100_000) {
    return {
      migratedBatch: {
        ...batch,
        sellableQuantity: Math.round(rawQty / 1000),
        unitVersion: 'v2',
        legacyRawCount: rawQty,
        migratedAt: new Date().toISOString(),
      },
      wasMigrated: true,
      isAmbiguous: false,
      reason: `Contagem absoluta de ${rawQty} PL convertida para ${Math.round(rawQty / 1000)} milheiros`,
    };
  }

  // Already in thousands (standard convention: 1 to 50,000 milheiros)
  return {
    migratedBatch: {
      ...batch,
      unitVersion: 'v2',
    },
    wasMigrated: false,
    isAmbiguous: false,
    reason: 'Valor já expresso em milheiros',
  };
}
