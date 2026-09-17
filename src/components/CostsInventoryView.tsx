import React, { useState } from 'react';
import {
  Batch,
  InventoryItem,
  BatchCostItem,
} from '../types';
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatDateBR,
  calculateBatchTotalCost,
  calculateBatchUnitCost,
  calculateFeedConversionRatio,
  checkInventoryItemRestock,
} from '../utils/calculations';
import {
  DollarSign,
  Package,
  Boxes,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Scale,
  Receipt,
  FileCheck,
} from 'lucide-react';

interface CostsInventoryViewProps {
  batches: Batch[];
  inventory: InventoryItem[];
  onAddCostToBatch: (batchId: string, cost: Partial<BatchCostItem>) => void;
  onQuickAction: (action: 'cost' | 'production' | 'import' | 'report') => void;
}

export const CostsInventoryView: React.FC<CostsInventoryViewProps> = ({
  batches,
  inventory,
  onAddCostToBatch,
  onQuickAction,
}) => {
  const [activeTab, setActiveTab] = useState<'custos' | 'estoque'>('custos');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    batches.length > 0 ? batches[0].id : ''
  );
  const [showAddCostModal, setShowAddCostModal] = useState(false);

  // Form states for new cost
  const [costForm, setCostForm] = useState({
    category: 'RACAO' as BatchCostItem['category'],
    description: '',
    amount: '',
    quantity: '',
    unit: 'KG',
    invoiceNumber: '',
  });

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];
  const totalBatchCost = selectedBatch ? calculateBatchTotalCost(selectedBatch) : 0;
  const unitCostInfo = selectedBatch ? calculateBatchUnitCost(selectedBatch) : null;
  const fcaInfo = selectedBatch ? calculateFeedConversionRatio(selectedBatch) : null;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#167D8D]" />
            <h2 className="text-xl font-bold text-[#17323A]">
              Custos de Produção e Controle de Estoque
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Composição por lote, conversão alimentar (FCA), cobertura de insumos e solicitações de reposição.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('custos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'custos'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Custos por Lote
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('estoque')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'estoque'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Estoque e Reposição
          </button>
        </div>
      </div>

      {/* TAB 1: CUSTOS POR LOTE */}
      {activeTab === 'custos' && (
        <div className="space-y-6">
          {batches.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-dashed border-teal-300">
              <p className="text-sm text-slate-600">
                Nenhum lote cadastrado. “Importe os gastos do lote para calcular o custo.”
              </p>
            </div>
          ) : (
            <>
              {/* Batch Selector Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Selecione o Lote:
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-xs font-bold text-[#17323A] rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.pondId} ({b.modality === 'ENGORDA' ? 'Engorda' : 'Larvicultura'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCostModal(true)}
                    className="px-3 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lançar Gasto Manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickAction('import')}
                    className="px-3 py-2 bg-white hover:bg-slate-50 text-[#123B45] text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors"
                  >
                    Importar Notas Fiscais
                  </button>
                </div>
              </div>

              {selectedBatch && (
                <>
                  {/* Key Metrics Cards for Selected Batch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Custo Total */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Custo Total Acumulado
                      </span>
                      <span className="text-2xl font-extrabold text-[#123B45] font-mono block">
                        {formatCurrencyBRL(totalBatchCost)}
                      </span>
                      <span className="text-xs text-slate-500 mt-1 block">
                        {selectedBatch.costs.length} lançamento(s) conferidos
                      </span>
                    </div>

                    {/* Custo Unitário */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Custo por Unidade Vendável
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-[#167D8D] font-mono">
                          {unitCostInfo ? formatCurrencyBRL(unitCostInfo.unitCost) : '—'}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {selectedBatch.modality === 'ENGORDA' ? '/ kg' : '/ milheiro'}
                        </span>
                      </div>
                      <span className="text-xs text-amber-800 font-medium mt-1 block">
                        {selectedBatch.budgetedCostPerUnit
                          ? `Orçamento: ${formatCurrencyBRL(selectedBatch.budgetedCostPerUnit)} (desvio para investigação)`
                          : 'Sem orçamento configurado'}
                      </span>
                    </div>

                    {/* FCA / Conversão */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Conversão Alimentar (FCA)
                      </span>
                      <span className="text-2xl font-extrabold text-slate-800 font-mono block">
                        {fcaInfo && fcaInfo.isValid ? `${fcaInfo.fca?.toFixed(3)} kg/kg` : '—'}
                      </span>
                      <span className="text-xs text-slate-500 mt-1 block">
                        {fcaInfo ? fcaInfo.message : '—'}
                      </span>
                    </div>

                    {/* Quantidade Vendável */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Produção Vendável
                      </span>
                      <span className="text-2xl font-extrabold text-[#17323A] font-mono block">
                        {selectedBatch.modality === 'ENGORDA'
                          ? `${formatNumberBR(selectedBatch.sellableQuantity, 0)} kg`
                          : `${formatNumberBR(selectedBatch.sellableQuantity / 1000, 0)} milheiros`}
                      </span>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Status: {selectedBatch.status === 'ENCERRADO' ? 'Encerrado' : 'Provisório (em andamento)'}
                      </span>
                    </div>
                  </div>

                  {/* Operational Costing Rules Notice */}
                  <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-teal-900 leading-relaxed">
                    <strong>Regras de Apuração Contábil:</strong> Insumos entram no custo do lote estritamente pelo
                    <strong> consumo efetivo</strong>, sem duplicar com a nota fiscal de compra no estoque.
                    A comparação de custos aponta &quot;gasto elevado&quot; como hipótese de investigação agronômica, nunca como desperdício comprovado.
                    <strong> Jamais reduza a alimentação do viveiro por meta financeira automática.</strong>
                  </div>

                  {/* Cost Items Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#17323A]">
                        Lançamentos de Custos do Lote ({selectedBatch.code})
                      </h3>
                      <span className="text-xs font-mono font-bold text-[#123B45]">
                        Soma: {formatCurrencyBRL(totalBatchCost)}
                      </span>
                    </div>

                    {selectedBatch.costs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        Nenhum gasto lançado para este lote. Clique em &quot;Lançar Gasto Manual&quot; ou importe suas notas fiscais.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">Categoria</th>
                              <th className="px-4 py-2.5">Descrição</th>
                              <th className="px-4 py-2.5">Documento / NF</th>
                              <th className="px-4 py-2.5">Data Competência</th>
                              <th className="px-4 py-2.5 text-right">Valor</th>
                              <th className="px-4 py-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedBatch.costs.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-semibold text-slate-700">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">
                                    {c.category}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-[#17323A]">{c.description}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono">{c.invoiceNumber || '—'}</td>
                                <td className="px-4 py-3 text-slate-600 font-mono">{formatDateBR(c.date)}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#123B45] font-mono">
                                  {formatCurrencyBRL(c.amount)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: ESTOQUE E REPOSIÇÃO */}
      {activeTab === 'estoque' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-base font-bold text-[#17323A]">
                Posição do Estoque e Ponto de Pedido
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cobertura = Saldo utilizável / Consumo médio diário. Solicitação de reposição quando Cobertura ≤ Prazo de entrega + Segurança.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {inventory.map((item) => {
                const restockCheck = checkInventoryItemRestock(item);
                return (
                  <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs">
                          <Boxes className="w-4 h-4 text-[#167D8D]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#17323A]">{item.name}</h4>
                          <span className="text-xs text-slate-500 font-mono">Código: {item.code}</span>
                        </div>
                      </div>

                      {restockCheck.needsRestock ? (
                        <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                          Reposição Necessária
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          Estoque Regular
                        </span>
                      )}
                    </div>

                    {/* Numeric Indicators */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F8F7] p-3 rounded-lg border border-slate-200 text-xs mt-3">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Saldo Utilizável</span>
                        <span className="text-sm font-bold text-[#17323A] font-mono">
                          {item.usableBalance} {item.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Consumo Médio Diário</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                          {item.averageDailyConsumption} {item.unit}/dia
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Cobertura Atual</span>
                        <span className="text-sm font-bold text-[#123B45] font-mono">
                          {restockCheck.coverageDays !== null ? `${restockCheck.coverageDays.toFixed(1)} dias` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Prazo + Segurança</span>
                        <span className="text-sm font-bold text-slate-700 font-mono">
                          {restockCheck.leadTimePlusSafety} dias ({item.leadTimeDays}d entrega + {item.safetyStockDays}d segurança)
                        </span>
                      </div>
                    </div>

                    {/* Restock Order Suggestion */}
                    {restockCheck.needsRestock && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Diagnóstico:</strong> {restockCheck.reason}. Sugestão de compra: <strong>900 {item.unit}</strong> para 12 dias de cobertura segura.
                        </span>
                        <button
                          type="button"
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-xs transition-colors"
                        >
                          Gerar Solicitação de Reposição
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lançar Gasto */}
      {showAddCostModal && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-[#17323A] mb-2">
              Lançar Gasto no Lote
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Lote de destino: <strong>{selectedBatch.code}</strong> ({selectedBatch.pondId})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria de Custo</label>
                <select
                  value={costForm.category}
                  onChange={(e) => setCostForm({ ...costForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                >
                  <option value="RACAO">Ração</option>
                  <option value="POS_LARVAS">Pós-larvas</option>
                  <option value="ENERGIA">Energia Elétrica</option>
                  <option value="MAO_DE_OBRA">Mão de Obra Direta</option>
                  <option value="MANUTENCAO">Manutenção</option>
                  <option value="OUTROS">Outros Insumos</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Ração 35% saca 25kg"
                  value={costForm.description}
                  onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1500.00"
                    value={costForm.amount}
                    onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nota Fiscal / Canhoto</label>
                  <input
                    type="text"
                    placeholder="Ex: NF-1049"
                    value={costForm.invoiceNumber}
                    onChange={(e) => setCostForm({ ...costForm, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCostModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!costForm.amount) return;
                  onAddCostToBatch(selectedBatch.id, {
                    category: costForm.category,
                    description: costForm.description || 'Gasto registrado',
                    amount: Number(costForm.amount),
                    invoiceNumber: costForm.invoiceNumber,
                    date: new Date().toISOString().split('T')[0],
                  });
                  setShowAddCostModal(false);
                }}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
              >
                Salvar Gasto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
