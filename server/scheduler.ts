import fs from 'fs';
import path from 'path';
import { SchedulerJobInfo, SchedulerExecutionEntry, Incident } from '../src/types';
import { getStore, saveStore, isDurableStoreAvailable, createBackup } from './storage';
import { evaluateWaterMeasurement, checkInventoryItemRestock } from '../src/utils/calculations';
import { parseBrazilianDate } from './excelParser';

const SCHEDULER_FILE = path.join(process.cwd(), 'data', 'scheduler.json');

const INITIAL_JOBS: SchedulerJobInfo[] = [
  {
    id: 'check_water_quality',
    name: 'Monitoramento da Qualidade da Água',
    description: 'Avalia atrasos na coleta de oxigênio/temperatura e desvios de parâmetros ambientais nos viveiros.',
    scheduleDescription: 'A cada 30 minutos',
    intervalMinutes: 30,
    timezone: 'America/Fortaleza',
    status: 'IDLE',
    enabled: true,
    history: [],
  },
  {
    id: 'check_stock_coverage',
    name: 'Conferência de Cobertura de Insumos',
    description: 'Calcula dias de estoque restante com base no consumo diário dos viveiros (cobertura <= prazo de entrega + estoque de segurança).',
    scheduleDescription: 'A cada 6 horas',
    intervalMinutes: 360,
    timezone: 'America/Fortaleza',
    status: 'IDLE',
    enabled: true,
    history: [],
  },
  {
    id: 'check_receivables',
    name: 'Auditoria de Títulos Vencidos',
    description: 'Identifica títulos em atraso sem acionar cobrança em títulos pagos, em disputa ativa ou não conciliados.',
    scheduleDescription: 'Diário às 06:00 BRT',
    intervalMinutes: 1440,
    timezone: 'America/Fortaleza',
    status: 'IDLE',
    enabled: true,
    history: [],
  },
  {
    id: 'automated_backup',
    name: 'Backup Durável Automático',
    description: 'Cria snapshot íntegro com manifesto SHA-256 do banco de dados, usuários e anexos.',
    scheduleDescription: 'Diário às 02:00 BRT',
    intervalMinutes: 1440,
    timezone: 'America/Fortaleza',
    status: 'IDLE',
    enabled: true,
    history: [],
  },
];

let jobsCache: SchedulerJobInfo[] = [];
const jobRunningLocks: Record<string, boolean> = {};
let schedulerTimer: NodeJS.Timeout | null = null;

export function loadSchedulerConfig(): SchedulerJobInfo[] {
  try {
    if (fs.existsSync(SCHEDULER_FILE)) {
      const raw = fs.readFileSync(SCHEDULER_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        jobsCache = parsed;
        return jobsCache;
      }
    }
    jobsCache = JSON.parse(JSON.stringify(INITIAL_JOBS));
    saveSchedulerConfig();
    return jobsCache;
  } catch (err) {
    console.error('Erro ao carregar scheduler.json:', err);
    jobsCache = JSON.parse(JSON.stringify(INITIAL_JOBS));
    return jobsCache;
  }
}

export function saveSchedulerConfig(): void {
  try {
    const dir = path.dirname(SCHEDULER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCHEDULER_FILE, JSON.stringify(jobsCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar scheduler.json:', err);
  }
}

/**
 * Runs a specific scheduled job with full concurrency locking and audit trail
 */
export async function executeScheduledJob(jobId: string, isManualTrigger = false): Promise<{
  success: boolean;
  durationMs: number;
  anomaliesCount: number;
  details?: string;
  error?: string;
}> {
  const job = jobsCache.find((j) => j.id === jobId);
  if (!job) {
    return { success: false, durationMs: 0, anomaliesCount: 0, error: `Tarefa ${jobId} não encontrada.` };
  }

  // Concurrency lock
  if (jobRunningLocks[jobId]) {
    return {
      success: false,
      durationMs: 0,
      anomaliesCount: 0,
      error: `A tarefa ${job.name} já está em execução. Execução simultânea bloqueada.`,
    };
  }

  jobRunningLocks[jobId] = true;
  job.status = 'RUNNING';
  const startTime = Date.now();
  let anomaliesCount = 0;
  let executionDetails = '';

  try {
    const store = getStore('real');

    if (jobId === 'check_water_quality') {
      const now = new Date();
      for (const m of store.waterMeasurements) {
        const evalRes = evaluateWaterMeasurement(m, now);
        if (evalRes.isDelayed || evalRes.isOutRange || evalRes.isInvalid) {
          anomaliesCount++;
          const existing = store.incidents.find(
            (inc) => inc.pondId === m.pondId && inc.status !== 'RESOLVIDO' && inc.evidence.includes(m.parameter)
          );
          if (!existing) {
            const newInc: Incident = {
              id: `inc-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              pondId: m.pondId,
              unit: m.unit,
              ruleCode: evalRes.isOutRange ? 'RULE-WATER-OUT-RANGE' : 'RULE-WATER-DELAYED',
              severity: evalRes.isOutRange ? 'ALTA' : 'MEDIA',
              title: `Anomalia na qualidade de água: ${m.parameter} (${m.pondId})`,
              evidence: `${evalRes.diagnostic}. Medição ID: ${m.id}`,
              responsible: 'Técnico de Qualidade de Água',
              nextAction: 'Inspecionar viveiro e checar oxigenação manualmente. Nenhuma máquina física foi acionada automaticamente.',
              status: 'ABERTO',
              openedAt: new Date().toISOString(),
            };
            store.incidents.unshift(newInc);
          }
        }
      }
      executionDetails = `${store.waterMeasurements.length} medições avaliadas. ${anomaliesCount} anomalias identificadas. Equipamentos físicos preservados sem acionamento remoto.`;
    } else if (jobId === 'check_stock_coverage') {
      for (const item of store.inventory) {
        const restockCheck = checkInventoryItemRestock(item);
        if (restockCheck.needsRestock) {
          anomaliesCount++;
          const existing = store.incidents.find(
            (inc) => inc.status !== 'RESOLVIDO' && inc.evidence.includes(item.code)
          );
          if (!existing) {
            store.incidents.unshift({
              id: `inc-stock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              pondId: 'Estoque Central',
              unit: 'Unidade Principal',
              ruleCode: 'RULE-STOCK-SAFETY-LOW',
              severity: 'ALTA',
              title: `Alerta de estoque mínimo: ${item.name}`,
              evidence: `${restockCheck.reason}. Saldo utilizável: ${item.usableBalance} ${item.unit}. Código: ${item.code}`,
              responsible: 'Gerente de Suprimentos',
              nextAction: 'Avaliar cotação com fornecedor e programar pedido de reposição.',
              status: 'ABERTO',
              openedAt: new Date().toISOString(),
            });
          }
        }
      }
      executionDetails = `${store.inventory.length} itens de estoque inspecionados. ${anomaliesCount} itens com cobertura abaixo da margem segura de reposição.`;
    } else if (jobId === 'check_receivables') {
      const todayIso = new Date().toISOString().slice(0, 10);
      for (const bill of store.receivables) {
        const parsedDue = parseBrazilianDate(bill.dueDate);
        if (parsedDue && parsedDue < todayIso && bill.status !== 'PAGO' && bill.receivedAmount < bill.originalAmount) {
          // Strictly exclude disputed or unreconciled bills
          if (!bill.hasActiveDispute && bill.isReconciled) {
            anomaliesCount++;
          }
        }
      }
      executionDetails = `${store.receivables.length} títulos auditados. ${anomaliesCount} títulos vencidos elegíveis para cobrança (títulos pagos, em disputa ou não conciliados foram desconsiderados).`;
    } else if (jobId === 'automated_backup') {
      if (isDurableStoreAvailable()) {
        const record = createBackup(isManualTrigger ? 'Disparo manual de rotina' : 'Rotina programada diária');
        executionDetails = `Snapshot salvo (${record.id}, ${record.filesCount} arquivos, ${(record.sizeBytes / 1024).toFixed(1)} KB).`;
      } else {
        throw new Error('Armazenamento durável indisponível no momento do backup.');
      }
    }

    if (isDurableStoreAvailable()) {
      saveStore('real');
    }

    const durationMs = Date.now() - startTime;
    job.status = 'SUCCESS';
    job.lastRunAt = new Date().toISOString();
    job.nextRunAt = new Date(Date.now() + job.intervalMinutes * 60 * 1000).toISOString();
    job.anomaliesFound = anomaliesCount;
    job.lastError = undefined;

    const entry: SchedulerExecutionEntry = {
      timestamp: new Date().toISOString(),
      durationMs,
      status: 'SUCCESS',
      anomaliesCount,
      details: executionDetails,
    };
    job.history.unshift(entry);
    if (job.history.length > 50) job.history = job.history.slice(0, 50);

    saveSchedulerConfig();

    return { success: true, durationMs, anomaliesCount, details: executionDetails };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    job.status = 'FAILED';
    job.lastRunAt = new Date().toISOString();
    job.lastError = err.message;

    const entry: SchedulerExecutionEntry = {
      timestamp: new Date().toISOString(),
      durationMs,
      status: 'FAILED',
      anomaliesCount: 0,
      details: `Falha: ${err.message}`,
    };
    job.history.unshift(entry);
    if (job.history.length > 50) job.history = job.history.slice(0, 50);

    saveSchedulerConfig();

    return { success: false, durationMs, anomaliesCount: 0, error: err.message };
  } finally {
    jobRunningLocks[jobId] = false;
  }
}

/**
 * Starts the master interval ticker
 */
export function startSchedulerRunner(): void {
  loadSchedulerConfig();

  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log('[SCHEDULER] Mecanismo de agendamento do servidor iniciado (fuso America/Fortaleza).');

  // Check every 60 seconds
  schedulerTimer = setInterval(async () => {
    const now = Date.now();
    for (const job of jobsCache) {
      if (!job.enabled) continue;
      const lastRun = job.lastRunAt ? new Date(job.lastRunAt).getTime() : 0;
      const intervalMs = job.intervalMinutes * 60 * 1000;
      if (now - lastRun >= intervalMs) {
        console.log(`[SCHEDULER] Executando tarefa agendada: ${job.name} (${job.id})...`);
        await executeScheduledJob(job.id, false);
      }
    }
  }, 60000);
}
