import React, { useState } from 'react';
import { Batch, MarketReferenceItem, RegionalWeatherAlert } from '../types';
import {
  NORDESTE_MARKET_REFERENCES,
  NORDESTE_WEATHER_ALERTS,
  compareBatchWithNordesteBenchmark,
} from '../utils/nordesteMarketData';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CloudRain,
  Sun,
  CloudSun,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Scale,
  DollarSign,
  Compass,
  Calendar,
  Layers,
} from 'lucide-react';

interface NordesteMarketTabProps {
  batches: Batch[];
}

export const NordesteMarketTab: React.FC<NordesteMarketTabProps> = ({ batches }) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    batches.length > 0 ? batches[0].id : ''
  );
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'TODOS' | 'CAMARAO_VIVO' | 'RACAO' | 'POS_LARVAS'>('TODOS');
  const [selectedStateFilter, setSelectedStateFilter] = useState<'TODOS' | 'RN' | 'CE' | 'BA'>('TODOS');

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];

  // Cálculo da biomassa e peso médio para benchmark
  const batchTotalCosts = selectedBatch?.costs?.reduce((acc, c) => acc + Number(c.amount || 0), 0) || 0;
  const batchSellableQty = selectedBatch?.sellableQuantity || 1000;
  const batchUnitCost = batchSellableQty > 0 ? batchTotalCosts / batchSellableQty : 0;
  const latestBiometry = selectedBatch?.biometrics && selectedBatch.biometrics.length > 0
    ? selectedBatch.biometrics[selectedBatch.biometrics.length - 1]
    : null;
  const averageWeightG = latestBiometry?.averageWeightG || 12.0;

  const comparison = selectedBatch
    ? compareBatchWithNordesteBenchmark(averageWeightG, batchUnitCost, 'RN')
    : null;

  const filteredReferences = NORDESTE_MARKET_REFERENCES.filter((item) => {
    if (selectedCategoryFilter !== 'TODOS' && item.category !== selectedCategoryFilter) return false;
    if (selectedStateFilter !== 'TODOS' && item.state !== selectedStateFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner: Isolamento Estrito e Contexto Regional */}
      <div className="bg-gradient-to-r from-[#123B45] to-[#167D8D] text-white p-6 rounded-2xl shadow-sm border border-[#167D8D]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Inteligência de Mercado Nordeste
              </span>
              <span className="text-xs text-emerald-300 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-4 h-4" /> Isolamento Contábil Garantido
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">Cotações Regionais, Clima e Benchmarks</h1>
            <p className="text-emerald-100/90 text-sm mt-1 max-w-3xl">
              Dados de referência pública e cotações de cooperativas do RN, CE, PB e BA para apoio na tomada de decisão.
              Estas informações funcionam exclusivamente como comparativo e <strong className="text-white font-semibold">não alteram</strong> os registros contábeis da sua empresa.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 self-start md:self-auto">
            <Calendar className="w-5 h-5 text-emerald-300" />
            <div className="text-xs">
              <p className="text-emerald-200">Data de Referência</p>
              <p className="font-semibold text-white">15/09/2026 — 12:00 BRT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Comparativo: Lote Selecionado vs. Média do Nordeste */}
      {selectedBatch && comparison && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#167D8D]" />
                <h2 className="text-lg font-bold text-[#17323A]">Comparativo de Eficiência do Seu Lote</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Compara o custo de produção do lote com o preço praticado para a mesma faixa de peso no Nordeste.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="select-batch-benchmark" className="text-xs font-medium text-slate-600">
                Lote Avaliado:
              </label>
              <select
                id="select-batch-benchmark"
                value={selectedBatch.id}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="text-sm font-semibold text-[#123B45] bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#167D8D] focus:outline-none"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.pondId} ({b.modality})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-5">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-medium text-slate-500">Custo Apurado do Lote</p>
              <p className="text-2xl font-bold text-[#123B45] mt-1">
                R$ {batchUnitCost.toFixed(2)}
                <span className="text-xs text-slate-500 font-normal"> / {selectedBatch.sellableUnit}</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Base: R$ {batchTotalCosts.toLocaleString('pt-BR')} em {batchSellableQty.toLocaleString('pt-BR')} {selectedBatch.sellableUnit.toLowerCase()}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-medium text-slate-500">Média de Mercado (Nordeste)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                R$ {comparison.marketAveragePrice.toFixed(2)}
                <span className="text-xs text-slate-500 font-normal"> / kg</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Faixa: R$ {comparison.marketMinPrice.toFixed(2)} a R$ {comparison.marketMaxPrice.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs font-medium text-slate-500">Margem Bruta Estimada</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  comparison.estimatedMarginPerKg >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {comparison.estimatedMarginPerKg >= 0 ? '+' : ''}R$ {comparison.estimatedMarginPerKg.toFixed(2)}
                <span className="text-xs text-slate-500 font-normal"> / kg ({comparison.marginPercent}%)</span>
              </p>
              <div className="mt-2 flex items-center gap-1">
                {comparison.status === 'OTIMA_MARGEM' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> Alta Competitividade
                  </span>
                )}
                {comparison.status === 'MARGEM_ACEITAVEL' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <Minus className="w-3 h-3" /> Margem Adequada
                  </span>
                )}
                {comparison.status === 'ALERTA_CUSTO_ALTO' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Custo Unitário Elevado
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Gramatura de Referência</p>
                <p className="text-sm font-bold text-[#17323A] mt-1">{comparison.closestSpecification}</p>
                <p className="text-xs text-slate-500 mt-1">Peso médio atual: {averageWeightG.toFixed(1)}g</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 truncate" title={comparison.source}>
                Fonte: {comparison.source}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Seção 1: Cotações por Gramatura e Insumos */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#17323A] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#167D8D]" />
              Tabela de Cotações Regionais de Camarão e Insumos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Valores médios negociados em cooperativas, entrepostos e distribuidores credenciados no Nordeste.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSelectedCategoryFilter('TODOS')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedCategoryFilter === 'TODOS' ? 'bg-white text-[#123B45] shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedCategoryFilter('CAMARAO_VIVO')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedCategoryFilter === 'CAMARAO_VIVO' ? 'bg-white text-[#123B45] shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                Camarão Vivo/Fresco
              </button>
              <button
                onClick={() => setSelectedCategoryFilter('RACAO')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedCategoryFilter === 'RACAO' ? 'bg-white text-[#123B45] shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                Rações
              </button>
              <button
                onClick={() => setSelectedCategoryFilter('POS_LARVAS')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedCategoryFilter === 'POS_LARVAS' ? 'bg-white text-[#123B45] shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                Pós-Larvas
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
              {(['TODOS', 'RN', 'CE', 'BA'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStateFilter(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedStateFilter === st ? 'bg-[#167D8D] text-white font-bold' : 'text-slate-600'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Produto / Especificação</th>
                <th className="px-4 py-3">Região / Polo</th>
                <th className="px-4 py-3 text-right">Preço Médio</th>
                <th className="px-4 py-3 text-right">Faixa (Mín - Máx)</th>
                <th className="px-4 py-3 text-center">Tendência</th>
                <th className="px-4 py-3">Fonte & Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReferences.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#17323A]">{item.productName}</div>
                    <div className="text-xs text-slate-500">{item.specification}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 mr-2">
                      {item.state}
                    </span>
                    <span className="text-xs text-slate-600">{item.region}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#123B45]">
                    R$ {item.averagePrice.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500"> / {item.unit.toLowerCase().replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-600">
                    R$ {item.minPrice.toFixed(2)} – R$ {item.maxPrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.tendency === 'ALTA' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3" /> Alta
                      </span>
                    )}
                    {item.tendency === 'BAIXA' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                        <TrendingDown className="w-3 h-3" /> Baixa
                      </span>
                    )}
                    {item.tendency === 'ESTAVEL' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Minus className="w-3 h-3" /> Estável
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p className="font-medium text-slate-700 truncate max-w-[200px]" title={item.source}>
                      {item.source}
                    </p>
                    <p className="text-[11px] text-slate-400">Cotado em: {item.quotedAt}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção 2: Alertas Meteorológicos e Manejo para o Nordeste */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#17323A] flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-[#167D8D]" />
              Boletim Agroclimático & Alertas Operacionais de Manejo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Condições climáticas com impacto direto na salinidade, temperatura e taxa de aeração dos viveiros.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#167D8D] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Atualizado via INMET / CPTEC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {NORDESTE_WEATHER_ALERTS.map((alert) => (
            <div
              key={alert.id}
              className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4 hover:border-[#167D8D]/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#123B45] text-white">
                      {alert.state}
                    </span>
                    <h3 className="font-bold text-sm text-[#17323A] mt-1.5">{alert.region}</h3>
                  </div>
                  {alert.condition === 'ENSOLARADO' && <Sun className="w-6 h-6 text-amber-500 shrink-0" />}
                  {alert.condition === 'PARCIALMENTE_NUBLADO' && <CloudSun className="w-6 h-6 text-blue-500 shrink-0" />}
                  {alert.condition === 'CHUVA_MODERADA' && <CloudRain className="w-6 h-6 text-indigo-500 shrink-0" />}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 py-2 border-y border-slate-200/70 text-xs">
                  <div>
                    <span className="text-slate-500">Temperatura:</span>
                    <p className="font-semibold text-slate-800">
                      {alert.temperatureMinC}°C a {alert.temperatureMaxC}°C
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Fase da Maré:</span>
                    <p className="font-semibold text-[#167D8D]">{alert.tidePhase}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Impacto nos Viveiros:</span>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{alert.impactOnPonds}</p>
                  </div>
                  <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80">
                    <span className="font-semibold text-amber-900 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Recomendação Operacional:
                    </span>
                    <p className="text-amber-950 mt-1 text-[11px] leading-relaxed">
                      {alert.operationalRecommendation}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-400">
                <p>Fonte: {alert.source}</p>
                <p>Atualizado em: {alert.updatedAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
