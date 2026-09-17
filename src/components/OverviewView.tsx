import React from 'react';
import {
  Batch,
  Incident,
  ReceivableBill,
  CompanyConfig,
  EnvironmentMode,
  WaterMeasurement,
  InventoryItem,
} from '../types';
import {
  formatCurrencyBRL,
  formatNumberBR,
  calculateBatchTotalCost,
  calculateBatchUnitCost,
  checkReceivableBill,
} from '../utils/calculations';
import {
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Scale,
  DollarSign,
  AlertCircle,
  FileCheck2,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';

interface OverviewViewProps {
  batches: Batch[];
  incidents?: Incident[];
  receivables?: ReceivableBill[];
  waterMeasurements?: WaterMeasurement[];
  inventory?: InventoryItem[];
  company?: CompanyConfig;
  currentEnv?: EnvironmentMode;
  onNavigate?: (view: any) => void;
  onQuickAction: (action: 'cost' | 'production' | 'import' | 'report') => void;
  onOpenBatchDetail?: (batchId: string) => void;
  onOpenIncidentDetails?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  batches = [],
  incidents = [],
  receivables = [],
  company,
  currentEnv = 'demo',
  onNavigate,
  onQuickAction,
  onOpenBatchDetail,
}) => {
  const safeBatches = batches || [];
  // Filter batches for active unit & closed
  const closedEngordaBatches = safeBatches.filter(
    (b) => b?.modality === 'ENGORDA' && b?.status === 'ENCERRADO'
  );
  const closedLarvaBatches = safeBatches.filter(
    (b) => b?.modality === 'LARVICULTURA' && b?.status === 'ENCERRADO'
  );

  // Consolidated sellable production for Engorda (kg)
  const totalSellableKg = closedEngordaBatches.reduce((acc, b) => acc + (b.sellableQuantity || 0), 0);
  const totalCostEngorda = closedEngordaBatches.reduce((acc, b) => acc + calculateBatchTotalCost(b), 0);
  const consolidatedCostPerKg = totalSellableKg > 0 ? totalCostEngorda / totalSellableKg : null;

  // Active Incidents
  const activeIncidents = (incidents || []).filter((i) => i.status !== 'RESOLVIDO');

  // Active Receivables (excluding fully paid or in active dispute)
  const validReceivables = (receivables || []).filter((r) => r.status !== 'PAGO');
  const totalReceivablesBalance = validReceivables.reduce((sum, r) => {
    const check = checkReceivableBill(r);
    return sum + check.balanceRemaining;
  }, 0);

  // If in "Minha Empresa" or zeroed state and no batches: guidance state
  const hasNoData = batches.length === 0;

  // Derive dynamic costs from the active or first available batch
  const referenceBatch = batches[0];
  const refTotalCost = referenceBatch ? calculateBatchTotalCost(referenceBatch) : 0;
  const refCosts = referenceBatch?.costs || [];
  const feedCost = refCosts.filter(c => c.category === 'RACAO').reduce((sum, c) => sum + c.amount, 0);
  const laborCost = refCosts.filter(c => c.category === 'MAO_DE_OBRA').reduce((sum, c) => sum + c.amount, 0);
  const energyCost = refCosts.filter(c => c.category === 'ENERGIA').reduce((sum, c) => sum + c.amount, 0);
  const inputsCost = refCosts.filter(c => c.category === 'INSUMOS' || c.category === 'OUTROS').reduce((sum, c) => sum + c.amount, 0);
  const larvaeCost = refCosts.filter(c => c.category === 'POVOAMENTO' || c.category === 'POS_LARVA').reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      {/* Context Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#167D8D]">
              Cockpit Executivo
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Unidade: {company?.activeUnit || 'Fazenda Principal'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#17323A] mt-0.5">
            Visão Geral da Produção e Finanças
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {currentEnv === 'demo'
              ? 'Ambiente de Demonstração — Dados de referência em 16/09/2026 às 12:00 BRT'
              : 'Ambiente Real — Registros operacionais autenticados da sua empresa'}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onQuickAction('cost')}
            className="px-3 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="w-4 h-4" />
            <span>Lançar gasto</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('production')}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-[#123B45] text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Scale className="w-4 h-4 text-[#167D8D]" />
            <span>+ Novo lote</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('import')}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-[#123B45] text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-[#167D8D]" />
            <span>Importar dados</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('report')}
            className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-[#167D8D] text-xs sm:text-sm font-semibold rounded-lg border border-teal-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Gerar relatório</span>
          </button>
        </div>
      </div>

      {/* Section 6: 4 Core Indicators (Always visible, zeroed when database is clean) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Produção Vendável */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Produção Vendável</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
              Lotes Encerrados
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#17323A] tabular-nums">
              {formatNumberBR(totalSellableKg, 0)}
            </span>
            <span className="text-sm font-semibold text-slate-500">kg de camarão</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>{closedEngordaBatches.length} lote(s) engorda</span>
            {closedLarvaBatches.length > 0 && (
              <span className="text-teal-700 font-medium">
                + {closedLarvaBatches.reduce((a, b) => a + (b.sellableQuantity || 0) / 1000, 0)} milheiros
              </span>
            )}
          </div>
        </div>

        {/* 2. Custo por Unidade Vendável */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Custo por Quilo</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-semibold">
              {consolidatedCostPerKg !== null ? 'Consolidado' : 'Sem lotes'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#123B45] tabular-nums">
              {consolidatedCostPerKg !== null ? formatCurrencyBRL(consolidatedCostPerKg) : '—'}
            </span>
            <span className="text-sm font-medium text-slate-500">/ kg</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="text-slate-500">
              {batches.length} lote(s) cadastrado(s)
            </span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('costs_inventory')}
                className="text-xs text-[#167D8D] hover:underline font-semibold cursor-pointer"
              >
                Ver gastos
              </button>
            )}
          </div>
        </div>

        {/* 3. Ocorrências Abertas */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Ocorrências Abertas</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                activeIncidents.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {activeIncidents.length > 0 ? 'Atenção Necessária' : 'Normalidade'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${activeIncidents.length > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {activeIncidents.length}
            </span>
            <span className="text-sm font-medium text-slate-500">nos viveiros</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>{activeIncidents.length > 0 ? `${activeIncidents.length} alerta(s) ativo(s)` : 'Nenhum alerta pendente'}</span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('production')}
                className="text-xs text-[#167D8D] hover:underline font-semibold cursor-pointer"
              >
                Viveiros
              </button>
            )}
          </div>
        </div>

        {/* 4. Valores a Receber */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Valores a Receber</span>
            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 text-[10px] font-semibold">
              Títulos Válidos
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#17323A] tabular-nums">
              {formatCurrencyBRL(totalReceivablesBalance)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="text-slate-500">{validReceivables.length} fatura(s) pendente(s)</span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('sales_receivables')}
                className="text-xs text-[#167D8D] hover:underline font-semibold cursor-pointer"
              >
                Ver títulos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State Banner when no batches exist */}
      {hasNoData && (
        <div className="bg-white rounded-xl p-6 border border-dashed border-teal-300 text-center max-w-2xl mx-auto my-2 shadow-xs">
          <div className="w-12 h-12 bg-teal-50 text-[#167D8D] rounded-full flex items-center justify-center mx-auto mb-2">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#17323A] mb-1">
            Base de dados zerada e pronta para novos registros
          </h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Todos os campos estão zerados. Comece cadastrando o primeiro lote de produção ou importando notas e planilhas de custos.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onQuickAction('production')}
              className="px-3.5 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              + Cadastrar primeiro lote
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('import')}
              className="px-3.5 py-2 bg-white text-[#123B45] hover:bg-slate-50 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Importar planilha ou NF-e
            </button>
          </div>
        </div>
      )}

      {/* Core Layout: "O que precisa de atenção" & "Composição dos Custos" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* O Que Precisa de Atenção (Priority List) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#17323A]">
                  O Que Precisa de Atenção
                </h3>
                <p className="text-xs text-slate-500">
                  Monitoramento contínuo de qualidade de água, estoque e recebíveis
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {activeIncidents.length} itens ativos
            </span>
          </div>

          {activeIncidents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Tudo em conformidade!</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Nenhum alerta crítico ou incidente pendente de ação nos viveiros.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeIncidents.map((inc) => (
                <div key={inc.id} className="p-3.5 rounded-lg bg-red-50/70 border border-red-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white uppercase">
                        {inc.severity}
                      </span>
                      <h4 className="text-sm font-bold text-red-950">
                        {inc.title}
                      </h4>
                    </div>
                    <span className="text-[11px] text-red-700 font-mono">{inc.pondId}</span>
                  </div>
                  <p className="text-xs text-red-900 mt-1">
                    <strong>Evidência:</strong> {inc.evidence}
                  </p>
                  <div className="mt-2 pt-2 border-t border-red-200/60 flex items-center justify-between text-xs text-red-800">
                    <span>
                      <strong>Responsável:</strong> {inc.assignedTo}
                    </span>
                    <span className="font-semibold">
                      <strong>Próxima ação:</strong> {inc.nextAction}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composição dos Custos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#17323A]">
                  Composição dos Custos
                </h3>
                <p className="text-xs text-slate-500">
                  {referenceBatch ? `Lote ${referenceBatch.code} (${referenceBatch.sellableQuantity || 0} kg)` : 'Nenhum lote selecionado'}
                </p>
              </div>
              <span className="text-xs font-bold text-[#123B45] font-mono">
                Total: {formatCurrencyBRL(refTotalCost)}
              </span>
            </div>

            {refTotalCost === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100 my-4">
                Nenhum custo lançado no lote ainda.
              </div>
            ) : (
              <div className="space-y-2.5 mt-3">
                {feedCost > 0 && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Ração</span>
                      <span className="font-mono">{formatCurrencyBRL(feedCost)} ({((feedCost / refTotalCost) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#123B45] rounded-full" style={{ width: `${(feedCost / refTotalCost) * 100}%` }} />
                    </div>
                  </div>
                )}

                {laborCost > 0 && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Mão de obra direta</span>
                      <span className="font-mono">{formatCurrencyBRL(laborCost)} ({((laborCost / refTotalCost) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#167D8D] rounded-full" style={{ width: `${(laborCost / refTotalCost) * 100}%` }} />
                    </div>
                  </div>
                )}

                {energyCost > 0 && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Energia (aeradores)</span>
                      <span className="font-mono">{formatCurrencyBRL(energyCost)} ({((energyCost / refTotalCost) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600 rounded-full" style={{ width: `${(energyCost / refTotalCost) * 100}%` }} />
                    </div>
                  </div>
                )}

                {inputsCost > 0 && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Outros insumos</span>
                      <span className="font-mono">{formatCurrencyBRL(inputsCost)} ({((inputsCost / refTotalCost) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-600 rounded-full" style={{ width: `${(inputsCost / refTotalCost) * 100}%` }} />
                    </div>
                  </div>
                )}

                {larvaeCost > 0 && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Pós-larvas (povoamento)</span>
                      <span className="font-mono">{formatCurrencyBRL(larvaeCost)} ({((larvaeCost / refTotalCost) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: `${(larvaeCost / refTotalCost) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {referenceBatch && onOpenBatchDetail && (
            <button
              type="button"
              onClick={() => onOpenBatchDetail(referenceBatch.id)}
              className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ver detalhes completos do Lote {referenceBatch.code}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
