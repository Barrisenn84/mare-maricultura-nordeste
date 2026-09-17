import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Batch,
  BiometryRecord,
} from '../types';
import {
  calculateBatchBiometricsGMD,
  ProcessedBiometryPoint,
  formatDateBR,
  formatNumberBR,
} from '../utils/calculations';
import {
  TrendingUp,
  Scale,
  Calendar,
  Plus,
  Target,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface GMDLineChartProps {
  batches: Batch[];
  onAddBiometry?: (batchId: string, biometry: Partial<BiometryRecord>) => Promise<void> | void;
}

type ChartMetricMode = 'gmd_period' | 'gmd_accumulated' | 'weight' | 'multi_batch';

export const GMDLineChart: React.FC<GMDLineChartProps> = ({ batches, onAddBiometry }) => {
  // Only Engorda batches have weight gain in grams/day
  const engordaBatches = useMemo(
    () => batches.filter((b) => b.modality === 'ENGORDA'),
    [batches]
  );

  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
    return engordaBatches[0]?.id || '';
  });

  const [metricMode, setMetricMode] = useState<ChartMetricMode>('gmd_period');
  const [benchmarkTarget, setBenchmarkTarget] = useState<number>(0.18); // standard 0.18 g/day target for L. vannamei
  const [showTable, setShowTable] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Biometry Form state
  const [newBiometryDate, setNewBiometryDate] = useState<string>('2026-09-16');
  const [newBiometryWeight, setNewBiometryWeight] = useState<string>('');
  const [newBiometrySampleSize, setNewBiometrySampleSize] = useState<string>('100');
  const [newBiometryUniformity, setNewBiometryUniformity] = useState<string>('90');
  const [newBiometryNotes, setNewBiometryNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active single batch
  const selectedBatch = useMemo(
    () => engordaBatches.find((b) => b.id === selectedBatchId) || engordaBatches[0] || null,
    [engordaBatches, selectedBatchId]
  );

  // Processed biometrics for selected batch
  const processedPoints = useMemo(() => {
    if (!selectedBatch) return [];
    return calculateBatchBiometricsGMD(selectedBatch, benchmarkTarget);
  }, [selectedBatch, benchmarkTarget]);

  // KPIs for selected batch
  const kpis = useMemo(() => {
    if (!processedPoints || processedPoints.length === 0) {
      return {
        latestWeight: 0,
        latestGMDPeriod: 0,
        latestGMDAccumulated: 0,
        latestWeeklyGain: 0,
        totalDOC: 0,
        benchmarkDiffPercent: 0,
        status: 'SEM_DADOS' as const,
      };
    }
    const latest = processedPoints[processedPoints.length - 1];
    const diff = ((latest.gmdPeriodG - benchmarkTarget) / benchmarkTarget) * 100;
    return {
      latestWeight: latest.averageWeightG,
      latestGMDPeriod: latest.gmdPeriodG,
      latestGMDAccumulated: latest.gmdAccumulatedG,
      latestWeeklyGain: latest.weeklyGainG,
      totalDOC: latest.dayOfCulture,
      benchmarkDiffPercent: Number(diff.toFixed(1)),
      status: latest.gmdPeriodG >= benchmarkTarget ? ('EXCELENTE' as const) : ('ATENCAO' as const),
    };
  }, [processedPoints, benchmarkTarget]);

  // Chart dataset for Single Batch modes
  const singleBatchChartData = useMemo(() => {
    return processedPoints.map((p) => ({
      doc: p.dayOfCulture,
      label: `D${p.dayOfCulture}`,
      fullLabel: `Dia ${p.dayOfCulture} (${formatDateBR(p.date)})`,
      date: formatDateBR(p.date),
      rawDate: p.date,
      gmdPeriod: p.gmdPeriodG,
      gmdAccumulated: p.gmdAccumulatedG,
      averageWeight: p.averageWeightG,
      weeklyGain: p.weeklyGainG,
      benchmarkTarget,
      benchmarkWeight: p.benchmarkWeightG,
      sampleSize: p.sampleSize,
      uniformity: p.uniformityPercent,
      notes: p.notes,
    }));
  }, [processedPoints, benchmarkTarget]);

  // Multi-batch comparison dataset (normalized by Day of Culture)
  const multiBatchChartData = useMemo(() => {
    if (metricMode !== 'multi_batch') return [];

    // Collect all unique DOC values across all engorda batches
    const docMap = new Map<number, any>();

    engordaBatches.forEach((batch) => {
      const pts = calculateBatchBiometricsGMD(batch, benchmarkTarget);
      pts.forEach((pt) => {
        if (!docMap.has(pt.dayOfCulture)) {
          docMap.set(pt.dayOfCulture, {
            doc: pt.dayOfCulture,
            label: `D${pt.dayOfCulture}`,
            benchmarkTarget,
          });
        }
        const entry = docMap.get(pt.dayOfCulture);
        entry[`gmd_${batch.id}`] = pt.gmdPeriodG;
        entry[`weight_${batch.id}`] = pt.averageWeightG;
        entry[`name_${batch.id}`] = batch.code;
      });
    });

    return Array.from(docMap.values()).sort((a, b) => a.doc - b.doc);
  }, [engordaBatches, metricMode, benchmarkTarget]);

  const batchPalette = ['#167D8D', '#E76F51', '#2A9D8F', '#457B9D', '#F4A261'];

  // Handle adding new biometry
  const handleSaveBiometry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    const weightNum = parseFloat(newBiometryWeight.replace(',', '.'));
    if (isNaN(weightNum) || weightNum <= 0) {
      alert('Informe um peso médio válido maior que zero (em gramas).');
      return;
    }

    try {
      setIsSubmitting(true);
      if (onAddBiometry) {
        await onAddBiometry(selectedBatch.id, {
          date: newBiometryDate,
          averageWeightG: weightNum,
          sampleSize: parseInt(newBiometrySampleSize, 10) || 100,
          uniformityPercent: parseInt(newBiometryUniformity, 10) || 90,
          notes: newBiometryNotes.trim() || 'Biometria registrada em campo',
        });
      }
      setShowAddModal(false);
      setNewBiometryWeight('');
      setNewBiometryNotes('');
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar biometria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="bg-[#123B45] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-300" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Ganho de Peso Médio Diário (GMD) e Curva de Crescimento
            </h3>
          </div>
          <p className="text-xs text-teal-100/90 mt-1">
            Evolução histórica zootécnica dos camarões desde o povoamento até a despesca final.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Batch Selector */}
          {engordaBatches.length > 0 && (
            <div className="flex items-center bg-white/10 rounded-lg px-2.5 py-1.5 border border-white/20">
              <span className="text-xs text-teal-100 mr-2 font-medium">Lote:</span>
              <select
                aria-label="Selecionar Lote de Engorda"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {engordaBatches.map((b) => (
                  <option key={b.id} value={b.id} className="text-slate-900 bg-white">
                    {b.code} ({b.pondId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* New Biometry Button */}
          {selectedBatch && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-[#167D8D] hover:bg-[#1f97ab] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Biometria</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      {selectedBatch && (
        <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* KPI 1: Peso Médio Atual */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">Peso Médio Atual</span>
                <Scale className="w-3.5 h-3.5 text-[#167D8D]" />
              </div>
              <div className="text-lg font-bold text-[#17323A] font-mono">
                {kpis.latestWeight > 0 ? `${formatNumberBR(kpis.latestWeight, 2)} g` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Última amostragem no lote
              </div>
            </div>

            {/* KPI 2: GMD no Período */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">GMD no Período</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-emerald-700 font-mono">
                {kpis.latestGMDPeriod > 0 ? `${formatNumberBR(kpis.latestGMDPeriod, 3)}` : '—'}
                <span className="text-xs font-normal text-slate-500 ml-1">g/dia</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Ganho diário recente
              </div>
            </div>

            {/* KPI 3: GMD Acumulado Global */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">GMD Acumulado</span>
                <Target className="w-3.5 h-3.5 text-[#123B45]" />
              </div>
              <div className="text-lg font-bold text-[#123B45] font-mono">
                {kpis.latestGMDAccumulated > 0 ? `${formatNumberBR(kpis.latestGMDAccumulated, 3)}` : '—'}
                <span className="text-xs font-normal text-slate-500 ml-1">g/dia</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Média desde o povoamento (D0)
              </div>
            </div>

            {/* KPI 4: Ganho Semanal Estimado */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">Ganho Semanal</span>
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <div className="text-lg font-bold text-teal-800 font-mono">
                {kpis.latestWeeklyGain > 0 ? `${formatNumberBR(kpis.latestWeeklyGain, 2)}` : '—'}
                <span className="text-xs font-normal text-slate-500 ml-1">g/sem</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Ritmo semanal de engorda
              </div>
            </div>

            {/* KPI 5: Dias de Cultivo & Meta */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">DOC / Meta Zootécnica</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-lg font-bold text-[#17323A] font-mono">
                {kpis.totalDOC} <span className="text-xs font-normal text-slate-500">dias</span>
              </div>
              <div className="text-[10px] flex items-center gap-1 mt-0.5">
                {kpis.benchmarkDiffPercent >= 0 ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> +{kpis.benchmarkDiffPercent}% vs meta
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                    <AlertCircle className="w-2.5 h-2.5" /> {kpis.benchmarkDiffPercent}% vs meta
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chart Section */}
      <div className="p-4 sm:p-5">
        {/* Controls Toolbar: Metric Switcher & Benchmark Target */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setMetricMode('gmd_period')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                metricMode === 'gmd_period'
                  ? 'bg-white text-[#123B45] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GMD por Período (g/dia)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('gmd_accumulated')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                metricMode === 'gmd_accumulated'
                  ? 'bg-white text-[#123B45] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GMD Acumulado (g/dia)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('weight')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                metricMode === 'weight'
                  ? 'bg-white text-[#123B45] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Peso Corporal (g)
            </button>
            {engordaBatches.length > 1 && (
              <button
                type="button"
                onClick={() => setMetricMode('multi_batch')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  metricMode === 'multi_batch'
                    ? 'bg-white text-[#123B45] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comparativo de Lotes
              </button>
            )}
          </div>

          {/* Benchmark Target Selector & Table Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="hidden sm:inline font-medium">Meta Zootécnica:</span>
              <select
                aria-label="Selecionar Meta Zootécnica de GMD"
                value={benchmarkTarget}
                onChange={(e) => setBenchmarkTarget(parseFloat(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              >
                <option value={0.15}>0,15 g/dia (Conservador)</option>
                <option value={0.18}>0,18 g/dia (Padrão Vannamei)</option>
                <option value={0.20}>0,20 g/dia (Alto Desempenho)</option>
                <option value={0.22}>0,22 g/dia (Intensivo Avançado)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              className="text-xs text-[#167D8D] hover:text-[#123B45] font-semibold flex items-center gap-1"
            >
              <span>{showTable ? 'Ocultar Tabela' : 'Ver Tabela'}</span>
              {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        {engordaBatches.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
            <Scale className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium">Nenhum lote de engorda cadastrado no ambiente ativo.</p>
            <p className="text-xs text-slate-400">Cadastre um lote para visualizar o gráfico de GMD.</p>
          </div>
        ) : singleBatchChartData.length === 0 && metricMode !== 'multi_batch' ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-200 rounded-lg p-6 text-center">
            <TrendingUp className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Lote selecionado ({selectedBatch?.code}) ainda não possui biometrias registradas.
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Clique em &quot;Nova Biometria&quot; acima para registrar as pesagens amostrais ou selecione outro lote com histórico de cultivo.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-3 px-3 py-1.5 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar 1ª Biometria</span>
            </button>
          </div>
        ) : (
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metricMode === 'multi_batch' ? (
                <LineChart data={multiBatchChartData} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: 'Dias de Cultivo (DOC) desde o Povoamento',
                      position: 'insideBottom',
                      offset: -15,
                      fill: '#64748B',
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    unit=" g/d"
                    label={{
                      value: 'GMD (g/dia)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      fill: '#64748B',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200 text-xs">
                          <div className="font-bold text-[#17323A] border-b border-slate-100 pb-1 mb-1.5">
                            {label} de Cultivo
                          </div>
                          <div className="space-y-1">
                            {payload.map((entry: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  {entry.name}:
                                </span>
                                <span className="font-mono font-bold text-slate-800">
                                  {typeof entry.value === 'number' ? `${entry.value.toFixed(3)} g/dia` : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '11px' }} />
                  <ReferenceLine
                    y={benchmarkTarget}
                    stroke="#D97706"
                    strokeDasharray="4 4"
                    label={{
                      value: `Meta (${benchmarkTarget.toFixed(2)} g/d)`,
                      fill: '#B45309',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                  {engordaBatches.map((b, idx) => (
                    <Line
                      key={b.id}
                      type="monotone"
                      dataKey={`gmd_${b.id}`}
                      name={b.code}
                      stroke={batchPalette[idx % batchPalette.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 1 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <LineChart data={singleBatchChartData} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: 'Dias de Cultivo (DOC) desde o Povoamento',
                      position: 'insideBottom',
                      offset: -15,
                      fill: '#64748B',
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    unit={metricMode === 'weight' ? ' g' : ' g/d'}
                    label={{
                      value: metricMode === 'weight' ? 'Peso Médio (g)' : 'GMD (g/dia)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      fill: '#64748B',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3.5 rounded-lg shadow-md border border-slate-200 text-xs min-w-[220px]">
                          <div className="font-bold text-[#17323A] border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between">
                            <span>Dia {data.doc} de Cultivo</span>
                            <span className="text-[10px] text-slate-500 font-normal">{data.date}</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Peso Médio:</span>
                              <span className="font-mono font-bold text-[#17323A]">
                                {formatNumberBR(data.averageWeight, 2)} g
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">GMD no Período:</span>
                              <span className="font-mono font-bold text-emerald-700">
                                {formatNumberBR(data.gmdPeriod, 3)} g/dia
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">GMD Acumulado (D0):</span>
                              <span className="font-mono font-bold text-[#123B45]">
                                {formatNumberBR(data.gmdAccumulated, 3)} g/dia
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Ganho Semanal:</span>
                              <span className="font-mono font-medium text-teal-800">
                                {formatNumberBR(data.weeklyGain, 2)} g/sem
                              </span>
                            </div>
                            {data.uniformity && (
                              <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
                                <span className="text-slate-500">Uniformidade:</span>
                                <span className="text-slate-700 font-medium">{data.uniformity}%</span>
                              </div>
                            )}
                            {data.notes && (
                              <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 italic">
                                &quot;{data.notes}&quot;
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '11px' }} />

                  {/* Reference Line for Benchmark */}
                  {metricMode === 'gmd_period' && (
                    <ReferenceLine
                      y={benchmarkTarget}
                      stroke="#D97706"
                      strokeDasharray="4 4"
                      label={{
                        value: `Meta Zootécnica (${benchmarkTarget.toFixed(2)} g/d)`,
                        fill: '#B45309',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                  )}

                  {/* Dynamic Metric Line */}
                  {metricMode === 'gmd_period' && (
                    <Line
                      type="monotone"
                      dataKey="gmdPeriod"
                      name="GMD no Período (g/dia)"
                      stroke="#167D8D"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#167D8D', strokeWidth: 1 }}
                      activeDot={{ r: 7 }}
                    />
                  )}

                  {metricMode === 'gmd_accumulated' && (
                    <>
                      <ReferenceLine
                        y={benchmarkTarget}
                        stroke="#D97706"
                        strokeDasharray="4 4"
                        label={{
                          value: `Meta (${benchmarkTarget.toFixed(2)} g/d)`,
                          fill: '#B45309',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="gmdAccumulated"
                        name="GMD Acumulado Global (g/dia)"
                        stroke="#123B45"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#123B45', strokeWidth: 1 }}
                        activeDot={{ r: 7 }}
                      />
                    </>
                  )}

                  {metricMode === 'weight' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="averageWeight"
                        name="Peso Médio Real (g)"
                        stroke="#167D8D"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#167D8D', strokeWidth: 1 }}
                        activeDot={{ r: 7 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="benchmarkWeight"
                        name={`Curva Teórica (Meta ${benchmarkTarget.toFixed(2)} g/d)`}
                        stroke="#F59E0B"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                      />
                    </>
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Technical Explanatory Note */}
        <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <Info className="w-4 h-4 text-[#167D8D] shrink-0 mt-0.5" />
          <div>
            <strong>Interpretação Zootécnica:</strong> O Ganho de Peso Médio Diário (GMD = ganho em gramas dividido pelo número de dias) mede a taxa instantânea de crescimento. Valores acima de 0,18 g/dia em camarão <em>Litopenaeus vannamei</em> indicam excelente taxa metabólica e manejo nutricional eficiente.
          </div>
        </div>

        {/* Collapsible Biometry Records Table */}
        {showTable && selectedBatch && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold text-[#17323A] uppercase tracking-wider mb-2">
              Histórico Detalhado de Biometrias — {selectedBatch.code} ({selectedBatch.pondId})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-[#123B45] text-white">
                  <tr>
                    <th className="p-2.5 font-semibold">Data</th>
                    <th className="p-2.5 font-semibold">DOC</th>
                    <th className="p-2.5 font-semibold">Semana</th>
                    <th className="p-2.5 font-semibold">Peso Médio (g)</th>
                    <th className="p-2.5 font-semibold">GMD Período (g/dia)</th>
                    <th className="p-2.5 font-semibold">GMD Acumulado</th>
                    <th className="p-2.5 font-semibold">Ganho Semanal</th>
                    <th className="p-2.5 font-semibold">Amostra</th>
                    <th className="p-2.5 font-semibold">Uniformidade</th>
                    <th className="p-2.5 font-semibold">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {processedPoints.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-slate-500">
                        Nenhuma biometria registrada para este lote.
                      </td>
                    </tr>
                  ) : (
                    processedPoints.map((pt) => (
                      <tr key={pt.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-medium text-slate-900">{formatDateBR(pt.date)}</td>
                        <td className="p-2.5 font-mono text-slate-700">D{pt.dayOfCulture}</td>
                        <td className="p-2.5 text-slate-600">Sem {pt.week}</td>
                        <td className="p-2.5 font-mono font-bold text-[#17323A]">
                          {formatNumberBR(pt.averageWeightG, 2)} g
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700">
                          {formatNumberBR(pt.gmdPeriodG, 3)} g/dia
                        </td>
                        <td className="p-2.5 font-mono text-[#123B45]">
                          {formatNumberBR(pt.gmdAccumulatedG, 3)} g/dia
                        </td>
                        <td className="p-2.5 font-mono text-teal-800">
                          {formatNumberBR(pt.weeklyGainG, 2)} g/sem
                        </td>
                        <td className="p-2.5 text-slate-600">{pt.sampleSize || '—'} un</td>
                        <td className="p-2.5 text-slate-600">{pt.uniformityPercent ? `${pt.uniformityPercent}%` : '—'}</td>
                        <td className="p-2.5 text-slate-500 text-[11px] max-w-xs truncate" title={pt.notes}>
                          {pt.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Registrar Nova Biometria */}
      {showAddModal && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#17323A]">
                  Registrar Nova Biometria
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedBatch.code} • {selectedBatch.pondId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBiometry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data da Amostragem
                </label>
                <input
                  type="date"
                  required
                  value={newBiometryDate}
                  onChange={(e) => setNewBiometryDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#167D8D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Peso Médio Amostrado (gramas) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 8.50"
                    value={newBiometryWeight}
                    onChange={(e) => setNewBiometryWeight(e.target.value)}
                    className="w-full text-xs px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#167D8D] font-mono"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">g</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Peso corporal individual médio obtido na tarrafa ou balança de precisão.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Camarões Amostrados
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={newBiometrySampleSize}
                    onChange={(e) => setNewBiometrySampleSize(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#167D8D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Uniformidade (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="90"
                    value={newBiometryUniformity}
                    onChange={(e) => setNewBiometryUniformity(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#167D8D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações de Campo
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Trato digestivo 100% cheio, carapaça firme, hepatopâncreas pigmentado."
                  value={newBiometryNotes}
                  onChange={(e) => setNewBiometryNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#167D8D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Biometria'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
