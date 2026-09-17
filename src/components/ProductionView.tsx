import React, { useState } from 'react';
import {
  Batch,
  WaterMeasurement,
  Incident,
  CompanyConfig,
} from '../types';
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatDateBR,
  calculateBatchTotalCost,
  calculateBatchUnitCost,
  calculateFeedConversionRatio,
  evaluateWaterMeasurement,
} from '../utils/calculations';
import {
  Fish,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ArrowUpDown,
  RefreshCw,
  Sliders,
  Calendar,
  User,
  ExternalLink,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { GMDLineChart } from './GMDLineChart';

interface ProductionViewProps {
  batches: Batch[];
  waterMeasurements: WaterMeasurement[];
  incidents: Incident[];
  company: CompanyConfig;
  onAddBatch: (batch: Partial<Batch>) => void;
  onAddMeasurement: (m: Partial<WaterMeasurement>) => void;
  onUpdateIncidentStatus: (id: string, status: Incident['status'], notes?: string) => void;
  onAddBiometry?: (batchId: string, biometry: any) => Promise<void> | void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  batches,
  waterMeasurements,
  incidents,
  company,
  onAddBatch,
  onAddMeasurement,
  onUpdateIncidentStatus,
  onAddBiometry,
}) => {
  const [activeTab, setActiveTab] = useState<'lotes' | 'biometria' | 'agua' | 'incidentes'>('lotes');
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [showNewWaterModal, setShowNewWaterModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Form states for new Batch
  const [batchForm, setBatchForm] = useState({
    code: '',
    pondId: 'Viveiro 04',
    modality: 'ENGORDA' as 'ENGORDA' | 'LARVICULTURA',
    species: 'Litopenaeus vannamei',
    sellableQuantity: '',
    initialBiomassKg: '',
    finalBiomassKg: '',
    feedConsumedKg: '',
    responsible: 'Manoel Aquacultor',
  });

  // Form states for new Water reading
  const [waterForm, setWaterForm] = useState({
    pondId: 'Viveiro 02 (Ativo)',
    parameter: 'OXIGENIO' as const,
    value: '',
    unitMeasurement: 'mg/L',
    collectedBy: 'Carlos Operador',
    minAcceptable: '4.0',
    maxAcceptable: '12.0',
    maxAgeMinutes: '30',
  });

  const engordaBatches = batches.filter((b) => b.modality === 'ENGORDA');
  const larviculturaBatches = batches.filter((b) => b.modality === 'LARVICULTURA');

  return (
    <div className="space-y-6">
      {/* Header & Section Navigation */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Fish className="w-5 h-5 text-[#167D8D]" />
            <h2 className="text-xl font-bold text-[#17323A]">
              Gestão de Produção e Viveiros
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Acompanhamento de lotes de engorda e berçários, biometria, qualidade de água e incidentes.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('lotes')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'lotes'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lotes ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('biometria')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'biometria'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#167D8D]" />
            <span>Curva de GMD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('agua')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'agua'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monitoramento de Água
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incidentes')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'incidentes'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Ocorrências</span>
            {incidents.filter((i) => i.status !== 'RESOLVIDO').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-600" />
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: LOTES (ENGORDA & LARVICULTURA) */}
      {activeTab === 'lotes' && (
        <div className="space-y-6">
          {/* GMD Line Chart & Biometrics Overview */}
          <GMDLineChart batches={batches} onAddBiometry={onAddBiometry} />

          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#17323A]">
              Lotes Cadastrados
            </h3>
            <button
              type="button"
              onClick={() => setShowNewBatchModal(true)}
              className="px-3 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lote</span>
            </button>
          </div>

          {/* Engorda Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="bg-[#123B45] text-white px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-bold tracking-wide">
                Lotes de Engorda (Produção em Quilogramas)
              </span>
              <span className="text-xs text-teal-200">
                {engordaBatches.length} lote(s)
              </span>
            </div>

            {engordaBatches.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum lote de engorda cadastrado. Clique em &quot;Novo Lote&quot; para registrar.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {engordaBatches.map((b) => {
                  const totalCost = calculateBatchTotalCost(b);
                  const unitCostInfo = calculateBatchUnitCost(b);
                  const fcaInfo = calculateFeedConversionRatio(b);

                  return (
                    <div key={b.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded bg-teal-100 text-teal-900 font-bold text-xs font-mono">
                            {b.code}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-[#17323A]">
                              {b.pondId} • {b.species}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Responsável: {b.responsible} | Início: {formatDateBR(b.startDate)}
                              {b.endDate ? ` | Encerramento: ${formatDateBR(b.endDate)}` : ''}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            b.status === 'ENCERRADO'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.status === 'ENCERRADO' ? 'Lote Encerrado' : 'Em Andamento'}
                        </span>
                      </div>

                      {/* Numbers Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F8F7] p-3 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Produção Vendável</span>
                          <span className="text-sm font-bold text-[#17323A] font-mono">
                            {formatNumberBR(b.sellableQuantity, 0)} kg
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Custo Total Apurado</span>
                          <span className="text-sm font-bold text-[#123B45] font-mono">
                            {formatCurrencyBRL(totalCost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Custo por Quilo</span>
                          <span className="text-sm font-bold text-[#167D8D] font-mono">
                            {formatCurrencyBRL(unitCostInfo.unitCost)} / kg
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Conversão Alimentar (FCA)</span>
                          <span className="text-sm font-bold text-slate-800 font-mono">
                            {fcaInfo.isValid ? `${fcaInfo.fca?.toFixed(3)} kg/kg` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Technical Notes / Strict Non-Invented Count Notice */}
                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span>
                          <strong>Sobrevivência:</strong>{' '}
                          {b.hasSurvivalData
                            ? `${(((b.finalPopulationCount || 0) / (b.initialPopulationCount || 1)) * 100).toFixed(1)}%`
                            : 'Não aplicável (sem contagens iniciais registradas neste lote — conformidade com regra técnica)'}
                        </span>
                        {b.budgetedCostPerUnit && (
                          <span className="text-amber-800 font-medium">
                            Orçamento base: {formatCurrencyBRL(b.budgetedCostPerUnit)}/kg
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Larvicultura Section (Separated Metric: R$ / Milheiro) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="bg-[#167D8D] text-white px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-bold tracking-wide">
                Lotes de Larvicultura (Produção em Milheiros de Pós-larvas)
              </span>
              <span className="text-xs text-teal-100">
                {larviculturaBatches.length} lote(s)
              </span>
            </div>

            {larviculturaBatches.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum lote de larvicultura cadastrado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {larviculturaBatches.map((b) => {
                  const totalCost = calculateBatchTotalCost(b);
                  const unitCostInfo = calculateBatchUnitCost(b);
                  const milheiros = (b.sellableQuantity || 0) / 1000;

                  return (
                    <div key={b.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded bg-teal-100 text-teal-900 font-bold text-xs font-mono">
                            {b.code}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-[#17323A]">
                              {b.pondId} • {b.species}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Responsável: {b.responsible} | Início: {formatDateBR(b.startDate)}
                              {b.endDate ? ` | Encerramento: ${formatDateBR(b.endDate)}` : ''}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                          {b.status === 'ENCERRADO' ? 'Lote Encerrado' : 'Em Andamento'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F8F7] p-3 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Pós-larvas Vendáveis</span>
                          <span className="text-sm font-bold text-[#17323A] font-mono">
                            {formatNumberBR(milheiros, 0)} milheiros ({formatNumberBR(b.sellableQuantity, 0)} PL)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Custo Total Apurado</span>
                          <span className="text-sm font-bold text-[#123B45] font-mono">
                            {formatCurrencyBRL(totalCost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Custo por Milheiro</span>
                          <span className="text-sm font-bold text-[#167D8D] font-mono">
                            {formatCurrencyBRL(unitCostInfo.unitCost)} / milheiro
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">FCA na Larvicultura</span>
                          <span className="text-sm font-medium text-slate-500">
                            Não aplicável
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CURVA DE GMD & BIOMETRIA */}
      {activeTab === 'biometria' && (
        <div className="space-y-6">
          <GMDLineChart batches={batches} onAddBiometry={onAddBiometry} />
        </div>
      )}

      {/* TAB 3: MONITORAMENTO DE ÁGUA */}
      {activeTab === 'agua' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#17323A]">
                Qualidade da Água nos Viveiros
              </h3>
              <p className="text-xs text-slate-500">
                Política técnica: faixa segura de 4,0 a 12,0 mg/L de Oxigênio Dissolvido e idade máxima de 30 minutos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewWaterModal(true)}
                className="px-3 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Medição</span>
              </button>
            </div>
          </div>

          {/* Operational Policy Warning */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Aviso de Gestão Operacional:</strong> O sistema não aciona aeradores nem prescreve manejo medicamentoso.
              Todas as ocorrências orientam o cumprimento do protocolo aprovado pelo responsável técnico.
              A ausência de alerta não significa água normal: verifique sempre a cobertura e atualidade das medições.
            </div>
          </div>

          {/* Water Measurement Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Viveiro / Tanque</th>
                    <th className="px-4 py-3">Parâmetro</th>
                    <th className="px-4 py-3">Valor Lido</th>
                    <th className="px-4 py-3">Faixa Aceitável</th>
                    <th className="px-4 py-3">Horário de Coleta</th>
                    <th className="px-4 py-3">Diagnóstico</th>
                    <th className="px-4 py-3">Coletado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waterMeasurements.map((m) => {
                    const evalRes = evaluateWaterMeasurement(m);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-[#17323A]">{m.pondId}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{m.parameter}</td>
                        <td className="px-4 py-3 font-mono font-bold text-sm">
                          {m.value} {m.unitMeasurement}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono">
                          {m.minAcceptable} – {m.maxAcceptable} {m.unitMeasurement}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">
                          {m.collectedAt.includes('T')
                            ? m.collectedAt.split('T')[1]?.slice(0, 5) + ' BRT'
                            : m.collectedAt}
                        </td>
                        <td className="px-4 py-3">
                          {evalRes.isOutRange ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5" /> Fora da Faixa
                            </span>
                          ) : evalRes.isDelayed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5" /> Leitura Atrasada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{m.collectedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OCORRÊNCIAS / INCIDENTES */}
      {activeTab === 'incidentes' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#17323A]">
                Registro e Resolução de Ocorrências
              </h3>
              <p className="text-xs text-slate-500">
                Ciclo: Aberto → Em atendimento → Resolvido. Deduplicação ativa no servidor.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`bg-white rounded-xl border p-4 shadow-xs transition-all ${
                  inc.status === 'RESOLVIDO'
                    ? 'border-slate-200 opacity-75'
                    : inc.severity === 'CRITICA'
                    ? 'border-red-300 ring-1 ring-red-200'
                    : 'border-amber-300'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        inc.status === 'RESOLVIDO'
                          ? 'bg-slate-100 text-slate-700'
                          : inc.status === 'EM_ATENDIMENTO'
                          ? 'bg-teal-100 text-teal-900'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {inc.status === 'ABERTO'
                        ? 'Aberto'
                        : inc.status === 'EM_ATENDIMENTO'
                        ? 'Em Atendimento'
                        : 'Resolvido'}
                    </span>
                    <h4 className="text-sm font-bold text-[#17323A]">{inc.title}</h4>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{inc.pondId}</span>
                </div>

                <p className="text-xs text-slate-700 mt-2">
                  <strong>Evidência Técnica:</strong> {inc.evidence}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div>
                    <span>
                      <strong>Responsável:</strong> {inc.responsible}
                    </span>
                    <span className="mx-2">•</span>
                    <span>
                      <strong>Ação recomendada:</strong> {inc.nextAction}
                    </span>
                  </div>

                  {/* Actions to progress status */}
                  <div className="flex items-center gap-2">
                    {inc.status === 'ABERTO' && (
                      <button
                        type="button"
                        onClick={() => onUpdateIncidentStatus(inc.id, 'EM_ATENDIMENTO')}
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-[#167D8D] font-bold rounded border border-teal-200 transition-colors"
                      >
                        Assumir Atendimento
                      </button>
                    )}
                    {inc.status !== 'RESOLVIDO' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setResolutionNote('');
                        }}
                        className="px-2.5 py-1 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded transition-colors"
                      >
                        Concluir e Resolver
                      </button>
                    )}
                    {inc.status === 'RESOLVIDO' && (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolvido ({inc.resolutionNotes || 'Sem notas adicionais'})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Novo Lote */}
      {showNewBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-[#17323A] mb-4">
              Cadastrar Novo Lote de Produção
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Código do Lote</label>
                <input
                  type="text"
                  placeholder="Ex: LOTE-2026-02"
                  value={batchForm.code}
                  onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Modalidade</label>
                  <select
                    value={batchForm.modality}
                    onChange={(e) => setBatchForm({ ...batchForm, modality: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  >
                    <option value="ENGORDA">Engorda (em kg)</option>
                    <option value="LARVICULTURA">Larvicultura (em milheiros)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Viveiro / Berçário</label>
                  <input
                    type="text"
                    value={batchForm.pondId}
                    onChange={(e) => setBatchForm({ ...batchForm, pondId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {batchForm.modality === 'ENGORDA' ? 'Produção Vendável (kg)' : 'Pós-larvas Vendáveis (qtd)'}
                  </label>
                  <input
                    type="number"
                    value={batchForm.sellableQuantity}
                    onChange={(e) => setBatchForm({ ...batchForm, sellableQuantity: e.target.value })}
                    placeholder="Ex: 1000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Responsável Técnico</label>
                  <input
                    type="text"
                    value={batchForm.responsible}
                    onChange={(e) => setBatchForm({ ...batchForm, responsible: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewBatchModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddBatch({
                    code: batchForm.code || `LOTE-${Date.now()}`,
                    pondId: batchForm.pondId,
                    modality: batchForm.modality,
                    species: batchForm.species,
                    sellableQuantity: Number(batchForm.sellableQuantity || 0),
                    responsible: batchForm.responsible,
                    status: 'EM_ANDAMENTO',
                    sellableUnit: batchForm.modality === 'LARVICULTURA' ? 'MILHEIRO' : 'KG',
                    costs: [],
                  });
                  setShowNewBatchModal(false);
                }}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
              >
                Salvar Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Medição de Água */}
      {showNewWaterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-[#17323A] mb-4">
              Registrar Medição da Água
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Viveiro</label>
                <input
                  type="text"
                  value={waterForm.pondId}
                  onChange={(e) => setWaterForm({ ...waterForm, pondId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Parâmetro</label>
                  <select
                    value={waterForm.parameter}
                    onChange={(e) => setWaterForm({ ...waterForm, parameter: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  >
                    <option value="OXIGENIO">Oxigênio Dissolvido (mg/L)</option>
                    <option value="TEMPERATURA">Temperatura (°C)</option>
                    <option value="PH">pH</option>
                    <option value="SALINIDADE">Salinidade (ppt)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Valor Medido</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5.8"
                    value={waterForm.value}
                    onChange={(e) => setWaterForm({ ...waterForm, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Operador Responsável</label>
                <input
                  type="text"
                  value={waterForm.collectedBy}
                  onChange={(e) => setWaterForm({ ...waterForm, collectedBy: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewWaterModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!waterForm.value) return;
                  onAddMeasurement({
                    pondId: waterForm.pondId,
                    parameter: waterForm.parameter,
                    value: Number(waterForm.value),
                    unitMeasurement: waterForm.unitMeasurement,
                    collectedBy: waterForm.collectedBy,
                    minAcceptable: Number(waterForm.minAcceptable),
                    maxAcceptable: Number(waterForm.maxAcceptable),
                    maxAgeMinutes: Number(waterForm.maxAgeMinutes),
                    collectedAt: new Date().toISOString(),
                  });
                  setShowNewWaterModal(false);
                }}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
              >
                Salvar Medição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Resolver Incidente */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-[#17323A] mb-2">
              Concluir Ocorrência
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              {selectedIncident.title} ({selectedIncident.pondId})
            </p>

            <div>
              <label className="block text-xs text-slate-700 font-semibold mb-1">
                Ação Corretiva Executada (Justificativa Técnica)
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Descreva a intervenção realizada (ex: aerador suplementar ativado, nova leitura realizada com 6,1 mg/L)..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateIncidentStatus(selectedIncident.id, 'RESOLVIDO', resolutionNote);
                  setSelectedIncident(null);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
              >
                Confirmar Resolução
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
