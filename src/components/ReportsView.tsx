import React, { useState } from 'react';
import {
  Batch,
  CompanyConfig,
  EnvironmentMode,
} from '../types';
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatDateBR,
  calculateBatchTotalCost,
  calculateBatchUnitCost,
  calculateFeedConversionRatio,
} from '../utils/calculations';
import {
  FileText,
  Download,
  Printer,
  Calculator,
  Clock,
  ShieldCheck,
  TrendingUp,
  Sliders,
  Sparkles,
  Info,
  Server,
} from 'lucide-react';
import { AuditTrailTab } from './AuditTrailTab';
import { SystemManagementTab } from './SystemManagementTab';

interface ReportsViewProps {
  batches: Batch[];
  company: CompanyConfig;
  currentEnv: EnvironmentMode;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  batches,
  company,
  currentEnv,
}) => {
  const [activeTab, setActiveTab] = useState<'lote' | 'executivo' | 'roi' | 'auditoria' | 'sistema'>('lote');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    batches.length > 0 ? batches[0].id : ''
  );

  // ROI Calculator Scenario states (Section 11)
  const [roiForm, setRoiForm] = useState({
    initialInvestment: 15000, // R$ 15.000 investimento inicial (softwares, tablets, implantação)
    monthlyCost: 650, // R$ 650/mês
    monthlyRecurringSavings: 2800, // R$ 2.800/mês de economia comprovada (redução de perdas e insumos)
    incrementalMargin: 1200, // R$ 1.200/mês de margem incremental comprovada
    hoursFreedPerMonth: 45, // 45 horas/mês liberadas de digitação em planilhas
    workingCapitalFreed: 8000, // R$ 8.000 de capital de giro liberado por previsibilidade
    lossesAvoidedEstimate: 12000, // Perdas evitadas por oxigênio
  });

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];
  const totalCost = selectedBatch ? calculateBatchTotalCost(selectedBatch) : 0;
  const unitCostInfo = selectedBatch ? calculateBatchUnitCost(selectedBatch) : null;
  const fcaInfo = selectedBatch ? calculateFeedConversionRatio(selectedBatch) : null;

  // ROI Calculations
  const netMonthlyBenefit =
    roiForm.monthlyRecurringSavings + roiForm.incrementalMargin - roiForm.monthlyCost;
  const simplePaybackMonths =
    netMonthlyBenefit > 0 ? roiForm.initialInvestment / netMonthlyBenefit : null;

  // Safe CSV exporter that prevents spreadsheet formula injection
  const exportBatchCSV = () => {
    if (!selectedBatch) return;

    // Sanitize string to prevent Excel / Calc formula execution (=, +, -, @)
    const sanitize = (text: string) => {
      const trimmed = text.trim();
      if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
        return `'${trimmed}`;
      }
      return trimmed;
    };

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Lote;Categoria;Descricao;Valor;Data;NF;Status\n';

    selectedBatch.costs.forEach((c) => {
      const row = [
        sanitize(selectedBatch.code),
        sanitize(c.category),
        sanitize(c.description),
        c.amount.toFixed(2).replace('.', ','),
        c.date,
        sanitize(c.invoiceNumber || ''),
        c.status,
      ].join(';');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Relatorio_Custos_${selectedBatch.code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#167D8D]" />
            <h2 className="text-xl font-bold text-[#17323A]">
              Relatórios e Retorno da Automação
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Demonstrativo contábil de lote, sumário executivo e cálculo auditável de ROI.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('lote')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'lote'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Relatório de Lote
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('executivo')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'executivo'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resumo Executivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roi')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'roi'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Retorno da Automação
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auditoria')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'auditoria'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trilha de Auditoria
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sistema')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'sistema'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Backups & Sistema
          </button>
        </div>
      </div>

      {/* TAB 1: RELATÓRIO DE LOTE */}
      {activeTab === 'lote' && (
        <div className="space-y-6">
          {batches.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-dashed border-teal-300">
              <p className="text-sm text-slate-600">
                Nenhum lote cadastrado para gerar relatório.
              </p>
            </div>
          ) : (
            <>
              {/* Top Controls: Selector & Export */}
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
                        {b.code} — {b.pondId}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 bg-white hover:bg-slate-50 text-[#123B45] text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir / Salvar PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportBatchCSV}
                    className="px-3 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV Seguro</span>
                  </button>
                </div>
              </div>

              {/* Printable Official Report Card */}
              {selectedBatch && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 print:border-none print:shadow-none">
                  {/* Header of Report */}
                  <div className="border-b border-slate-200 pb-4 flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-[#167D8D] tracking-wider uppercase">
                        Relatório Técnico e Contábil de Fechamento de Lote
                      </span>
                      <h3 className="text-xl font-bold text-[#17323A] mt-0.5">
                        {selectedBatch.code} • {selectedBatch.pondId}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {company.name} | Unidade: {selectedBatch.unit}
                      </p>
                    </div>

                    <div className="text-right text-xs text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-semibold text-slate-700 block mb-1">
                        Ambiente: {currentEnv === 'demo' ? 'Demonstração (Fictício)' : 'Minha Empresa'}
                      </span>
                      <span>Emitido em: 16/09/2026 às 12:00 BRT</span>
                    </div>
                  </div>

                  {/* Summary Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F6F8F7] p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Produção Vendável</span>
                      <span className="text-base font-bold text-[#17323A] font-mono">
                        {formatNumberBR(selectedBatch.sellableQuantity, 0)}{' '}
                        {selectedBatch.modality === 'ENGORDA' ? 'kg' : 'pós-larvas'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Custo Total Apurado</span>
                      <span className="text-base font-bold text-[#123B45] font-mono">
                        {formatCurrencyBRL(totalCost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Custo Unitário Final</span>
                      <span className="text-base font-bold text-[#167D8D] font-mono">
                        {unitCostInfo ? formatCurrencyBRL(unitCostInfo.unitCost) : '—'}{' '}
                        {selectedBatch.modality === 'ENGORDA' ? '/ kg' : '/ milheiro'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Conversão Alimentar (FCA)</span>
                      <span className="text-base font-bold text-slate-800 font-mono">
                        {fcaInfo && fcaInfo.isValid ? `${fcaInfo.fca?.toFixed(3)} kg/kg` : 'Não aplicável'}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Cost Breakdown */}
                  <div>
                    <h4 className="text-sm font-bold text-[#17323A] mb-3">
                      Composição dos Gastos Conferidos
                    </h4>
                    <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5">Categoria</th>
                          <th className="px-3 py-2.5">Descrição</th>
                          <th className="px-3 py-2.5">Documento</th>
                          <th className="px-3 py-2.5">Competência</th>
                          <th className="px-3 py-2.5 text-right">Valor</th>
                          <th className="px-3 py-2.5 text-right">% do Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedBatch.costs.map((c) => {
                          const percent = totalCost > 0 ? (c.amount / totalCost) * 100 : 0;
                          return (
                            <tr key={c.id}>
                              <td className="px-3 py-2 font-semibold text-slate-700">{c.category}</td>
                              <td className="px-3 py-2 text-[#17323A]">{c.description}</td>
                              <td className="px-3 py-2 text-slate-500 font-mono">{c.invoiceNumber || '—'}</td>
                              <td className="px-3 py-2 text-slate-600 font-mono">{formatDateBR(c.date)}</td>
                              <td className="px-3 py-2 text-right font-bold text-[#123B45] font-mono">
                                {formatCurrencyBRL(c.amount)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600 font-mono">
                                {percent.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="px-3 py-2.5 text-right text-[#17323A]">
                            Total Geral do Lote:
                          </td>
                          <td className="px-3 py-2.5 text-right text-[#123B45] font-mono">
                            {formatCurrencyBRL(totalCost)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700 font-mono">100,0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Audit Signatures */}
                  <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                    <div>
                      <div className="border-b border-slate-300 w-3/4 mx-auto mb-2" />
                      <span className="font-semibold text-slate-800">
                        {selectedBatch.responsible}
                      </span>
                      <p className="text-[11px] text-slate-500">Responsável Técnico Aquícola</p>
                    </div>
                    <div>
                      <div className="border-b border-slate-300 w-3/4 mx-auto mb-2" />
                      <span className="font-semibold text-slate-800">
                        {company.ownerName}
                      </span>
                      <p className="text-[11px] text-slate-500">Diretoria / Gestão Financeira</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: RESUMO EXECUTIVO */}
      {activeTab === 'executivo' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-bold text-[#167D8D] uppercase tracking-wider">
                Diretoria e Controladoria
              </span>
              <h3 className="text-lg font-bold text-[#17323A] mt-0.5">
                Resumo Executivo do Período (Safra 2026.2)
              </h3>
              <p className="text-xs text-slate-500">
                Consolidação das operações de engorda, larvicultura, receitas e contas a receber.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">
                  Biomassa Total Despescada
                </span>
                <span className="text-2xl font-bold text-[#17323A] font-mono mt-1 block">
                  1.000 kg
                </span>
                <span className="text-slate-600 mt-1 block">
                  Custo médio consolidado: R$ 21,00/kg
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">
                  Larvicultura Entregue
                </span>
                <span className="text-2xl font-bold text-[#167D8D] font-mono mt-1 block">
                  2.000 milheiros
                </span>
                <span className="text-slate-600 mt-1 block">
                  Custo por milheiro: R$ 20,00 / 1.000 PL
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">
                  Valores a Receber Válidos
                </span>
                <span className="text-2xl font-bold text-[#123B45] font-mono mt-1 block">
                  R$ 6.000,00
                </span>
                <span className="text-amber-800 font-medium mt-1 block">
                  1 fatura em atraso (6 dias)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RETORNO DA AUTOMAÇÃO (ROI) */}
      {activeTab === 'roi' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#167D8D] uppercase tracking-wider">
                  Cálculo Auditável e Determinístico
                </span>
                <h3 className="text-lg font-bold text-[#17323A] mt-0.5">
                  Retorno da Automação (ROI)
                </h3>
                <p className="text-xs text-slate-500">
                  Benefício mensal líquido = Economia recorrente validada + Margem incremental comprovada - Custo mensal.
                </p>
              </div>

              <span className="px-2.5 py-1 bg-teal-50 text-[#167D8D] text-xs font-bold rounded-lg border border-teal-200">
                Premissas Parametrizáveis
              </span>
            </div>

            {/* Explanatory Rule Banner */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>Regra de Rigor Metodológico:</strong> Horas de trabalho liberadas, capital de giro e perdas
              potencialmente evitadas são informados <strong>separadamente</strong> e
              <strong> NUNCA somados diretamente como lucro contábil</strong>.
              A diferença antes/depois não comprova isoladamente causalidade da automação.
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Investimento Inicial (R$)
                </label>
                <input
                  type="number"
                  value={roiForm.initialInvestment}
                  onChange={(e) => setRoiForm({ ...roiForm, initialInvestment: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Custo Mensal da Solução (R$)
                </label>
                <input
                  type="number"
                  value={roiForm.monthlyCost}
                  onChange={(e) => setRoiForm({ ...roiForm, monthlyCost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Economia Recorrente Validada (R$/mês)
                </label>
                <input
                  type="number"
                  value={roiForm.monthlyRecurringSavings}
                  onChange={(e) => setRoiForm({ ...roiForm, monthlyRecurringSavings: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Margem Incremental Comprovada (R$/mês)
                </label>
                <input
                  type="number"
                  value={roiForm.incrementalMargin}
                  onChange={(e) => setRoiForm({ ...roiForm, incrementalMargin: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Result Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-[#123B45] text-white p-4 rounded-xl shadow-xs">
                <span className="text-[11px] text-teal-200 uppercase font-semibold block mb-1">
                  Benefício Mensal Líquido
                </span>
                <span className="text-2xl font-bold font-mono">
                  {formatCurrencyBRL(netMonthlyBenefit)}
                </span>
                <span className="text-xs text-teal-200/80 mt-1 block">
                  R$ {roiForm.monthlyRecurringSavings} + R$ {roiForm.incrementalMargin} - R$ {roiForm.monthlyCost}
                </span>
              </div>

              <div className="bg-[#167D8D] text-white p-4 rounded-xl shadow-xs">
                <span className="text-[11px] text-teal-100 uppercase font-semibold block mb-1">
                  Prazo de Retorno Simples
                </span>
                <span className="text-2xl font-bold font-mono">
                  {simplePaybackMonths !== null ? `${simplePaybackMonths.toFixed(1)} meses` : 'Sem retorno'}
                </span>
                <span className="text-xs text-teal-100/80 mt-1 block">
                  {simplePaybackMonths !== null
                    ? `Investimento recuperado em ~${Math.ceil(simplePaybackMonths)} meses`
                    : 'Sem retorno calculável neste cenário'}
                </span>
              </div>

              {/* Separated Indicators (NOT added to profit) */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                  Horas Liberadas da Equipe
                </span>
                <span className="text-2xl font-bold text-[#17323A] font-mono">
                  {roiForm.hoursFreedPerMonth} h / mês
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Exibido separadamente (sem soma ao lucro)
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                  Capital de Giro Liberado
                </span>
                <span className="text-2xl font-bold text-slate-800 font-mono">
                  {formatCurrencyBRL(roiForm.workingCapitalFreed)}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Por previsibilidade de compras e ração
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRILHA DE AUDITORIA */}
      {activeTab === 'auditoria' && (
        <AuditTrailTab currentEnv={currentEnv} />
      )}

      {/* TAB 5: BACKUPS & SISTEMA */}
      {activeTab === 'sistema' && (
        <SystemManagementTab currentEnv={currentEnv} />
      )}
    </div>
  );
};
