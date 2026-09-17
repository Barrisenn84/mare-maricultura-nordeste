import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDocument,
  Batch,
  CompanyConfig,
} from '../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  MAX_UPLOAD_BYTES,
} from '../utils/calculations';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
  Sparkles,
  FileCheck,
  HelpCircle,
  Eye,
  RefreshCw,
  XCircle,
  File,
  Layers,
  Bot,
  CheckCheck,
  Building2,
} from 'lucide-react';

interface DocumentsImportViewProps {
  documents: AppDocument[];
  batches: Batch[];
  company: CompanyConfig;
  onUploadDocument: (file: File, meta: any) => Promise<any>;
  onExtractDraft: (docId: string) => Promise<any>;
  onReprocessDocument?: (docId: string) => Promise<any>;
  onConfirmDraftToBatch: (docId: string, targetBatchId: string, options?: any) => Promise<any>;
  onImportSpreadsheetRows: (entityType: string, rows: any[], fileName: string, batchId: string) => Promise<any>;
  onRollbackImport: (importBatchId: string) => Promise<any>;
  onAgentAnalyze?: (docId: string) => Promise<any>;
  onAgentApprove?: (docId: string, targetBatchId?: string, items?: any[]) => Promise<any>;
}

export const DocumentsImportView: React.FC<DocumentsImportViewProps> = ({
  documents,
  batches,
  company,
  onUploadDocument,
  onExtractDraft,
  onReprocessDocument,
  onConfirmDraftToBatch,
  onImportSpreadsheetRows,
  onRollbackImport,
  onAgentAnalyze,
  onAgentApprove,
}) => {
  const [activeTab, setActiveTab] = useState<'documentos' | 'planilhas'>('documentos');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedBatchForUpload, setSelectedBatchForUpload] = useState<string>(
    batches.length > 0 ? batches[0].id : ''
  );
  const [selectedCategory, setSelectedCategory] = useState<AppDocument['category']>('NOTA_FISCAL');
  const [reviewingDoc, setReviewingDoc] = useState<AppDocument | null>(null);
  const [targetBatchForConfirm, setTargetBatchForConfirm] = useState<string>(
    batches.length > 0 ? batches[0].id : ''
  );

  // Agent State & Handlers
  const [analyzingAgentDocId, setAnalyzingAgentDocId] = useState<string | null>(null);
  const [approvingAgentDocId, setApprovingAgentDocId] = useState<string | null>(null);
  const [targetBatchPerDoc, setTargetBatchPerDoc] = useState<Record<string, string>>({});

  const handleTriggerAgent = async (docId: string) => {
    if (!onAgentAnalyze) return;
    setAnalyzingAgentDocId(docId);
    setUploadError(null);
    try {
      await onAgentAnalyze(docId);
      setUploadSuccess('Análise do Agente de IA concluída. Documento pronto para conferência.');
    } catch (e: any) {
      setUploadError(e.message || 'Falha ao executar análise do agente.');
    } finally {
      setAnalyzingAgentDocId(null);
    }
  };

  const handleApproveAgent = async (doc: AppDocument) => {
    if (!onAgentApprove) return;
    setApprovingAgentDocId(doc.id);
    setUploadError(null);
    try {
      const selectedBatch = targetBatchPerDoc[doc.id] || doc.agentAnalysis?.suggestedBatchId || (batches[0]?.id || '');
      await onAgentApprove(doc.id, selectedBatch, doc.agentAnalysis?.items);
      setUploadSuccess(`Lançamento do documento "${doc.fileName}" aprovado com sucesso no lote!`);
    } catch (e: any) {
      setUploadError(e.message || 'Falha ao aprovar lançamento.');
    } finally {
      setApprovingAgentDocId(null);
    }
  };

  // Spreadsheet mapping state with allRows preservation
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<{
    fileName: string;
    headers: string[];
    rows: any[][];
    allRows: any[][];
    totalRows: number;
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    description: 0,
    amount: 1,
    category: 2,
    date: 3,
    invoiceNumber: 4,
  });

  // Human conference manual state
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<string>('OUTROS');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spreadsheetInputRef = useRef<HTMLInputElement>(null);

  // Handle file validation and upload
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Rule: Max 100.000.000 bytes inclusive
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError(
          `Arquivo "${file.name}" excede o limite máximo permitido de 100 MB (${(file.size / 1_000_000).toFixed(2)} MB; limite: 100.000.000 bytes).`
        );
        return;
      }

      if (file.size <= 0) {
        setUploadError(`Arquivo "${file.name}" está vazio (0 bytes). Envio recusado.`);
        return;
      }

      // Check dangerous extensions
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const dangerous = ['exe', 'sh', 'bat', 'cmd', 'js', 'vbs', 'scr', 'msi', 'bin'];
      if (dangerous.includes(ext)) {
        setUploadError(`Extensão .${ext} não é permitida. Não são aceitos executáveis ou scripts.`);
        return;
      }

      try {
        await onUploadDocument(file, {
          batchId: selectedBatchForUpload,
          category: selectedCategory,
        });
        setUploadSuccess(`Documento "${file.name}" recebido com sucesso no repositório.`);
      } catch (err: any) {
        setUploadError(err.message || 'Falha ao processar upload.');
      }
    }
  };

  // Drag & drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // Download empty model CSVs
  const downloadTemplate = (type: 'gastos' | 'biometria' | 'agua') => {
    let content = '';
    let fileName = '';

    if (type === 'gastos') {
      fileName = 'Modelo_Importacao_Gastos_Lote.csv';
      content = 'Descricao;Valor;Categoria;Data;NotaFiscal\n' +
        'Racao Camarão 35% 30 sacas;12000,00;RACAO;15/07/2026;NF-8921\n' +
        'Pos-larvas PL-10 certificadas;1500,00;POS_LARVAS;01/06/2026;NF-8800\n' +
        'Energia eletrica aeradores;2500,00;ENERGIA;30/08/2026;FAT-COELBA-08\n';
    } else if (type === 'biometria') {
      fileName = 'Modelo_Importacao_Biometria.csv';
      content = 'Semana;PesoMedioGramas;SobrevivenciaEstimada;BiomassaEstimadaKg;Data\n' +
        '1;0,10;95;10;01/06/2026\n' +
        '4;2,50;90;225;28/06/2026\n' +
        '14;12,00;85;1000;10/09/2026\n';
    } else {
      fileName = 'Modelo_Importacao_Qualidade_Agua.csv';
      content = 'Viveiro;Parametro;Valor;Unidade;DataHora;ColetadoPor\n' +
        'Viveiro 02;OXIGENIO;5,4;mg/L;16/09/2026 08:00;Carlos Operador\n' +
        'Viveiro 03;OXIGENIO;6,1;mg/L;16/09/2026 08:30;Carlos Operador\n';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // True RFC-compliant CSV & XLSX parser with Brazilian formatting
  const parseBrazilianNum = (val: any): number => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (!val) return 0;
    let str = String(val).trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
    if (!str) return 0;
    if (str.includes('.') && str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : 0;
  };

  const parseCsvText = (text: string) => {
    const lines: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQ && next === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if ((c === '\r' || c === '\n') && !inQ) {
        if (c === '\r' && next === '\n') i++;
        if (cur.trim().length > 0) lines.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    if (cur.trim().length > 0) lines.push(cur);
    if (lines.length === 0) return { headers: [], rows: [] };

    const first = lines[0];
    let sep = ';';
    if ((first.match(/,/g) || []).length > (first.match(/;/g) || []).length) sep = ',';

    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let f = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i + 1];
        if (c === '"') {
          if (q && next === '"') { f += '"'; i++; } else { q = !q; }
        } else if (c === sep && !q) {
          fields.push(f.trim());
          f = '';
        } else {
          f += c;
        }
      }
      fields.push(f.trim());
      return fields;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine).filter((r) => r.some((cell) => cell.length > 0));
    return { headers, rows };
  };

  const handleSpreadsheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      let headers: string[] = [];
      let allRows: any[][] = [];

      if (['xlsx', 'xls', 'ods'].includes(ext)) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('Planilha vazia ou sem abas.');
        const ws = workbook.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rawData.length > 0) {
          headers = rawData[0].map((h: any) => String(h).trim());
          allRows = rawData.slice(1).filter((r) => r.some((c: any) => String(c).trim().length > 0));
        }
      } else {
        const text = await file.text();
        const parsed = parseCsvText(text);
        headers = parsed.headers;
        allRows = parsed.rows;
      }

      if (headers.length === 0) {
        setUploadError('Nenhuma coluna identificada no arquivo.');
        return;
      }

      setSpreadsheetPreview({
        fileName: file.name,
        headers,
        rows: allRows.slice(0, 10),
        allRows,
        totalRows: allRows.length,
      });
      setUploadError(null);
    } catch (err: any) {
      setUploadError(`Erro ao carregar arquivo de planilha: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#167D8D]" />
            <h2 className="text-xl font-bold text-[#17323A]">
              Central de Documentos e Importação de Dados
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Arquivos de até 100 MB (100.000.000 bytes inclusive), notas fiscais, laudos e planilhas com mapeamento.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('documentos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'documentos'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Central de Documentos (até 100 MB)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planilhas')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'planilhas'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Importação de Planilhas (CSV/XLSX)
          </button>
        </div>
      </div>

      {/* Alerts */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button type="button" onClick={() => setUploadError(null)} className="font-bold text-red-700">
            OK
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button type="button" onClick={() => setUploadSuccess(null)} className="font-bold text-emerald-700">
            OK
          </button>
        </div>
      )}

      {/* TAB 1: CENTRAL DE DOCUMENTOS (UP TO 100 MB) */}
      {activeTab === 'documentos' && (
        <div className="space-y-6">
          {/* Upload Dropzone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`bg-white rounded-xl p-8 border-2 border-dashed transition-all text-center ${
              isDragging ? 'border-teal-500 bg-teal-50/50' : 'border-slate-300 hover:border-teal-400'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-teal-50 text-[#167D8D] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-[#17323A] mb-1">
              Enviar Documentos da Empresa
            </h3>
            <p className="text-xs text-slate-600 mb-4 max-w-lg mx-auto">
              Arraste e solte arquivos aqui ou selecione no computador/celular.
              <br />
              <strong className="text-[#123B45]">Limite máximo por arquivo: 100 MB (100.000.000 bytes inclusive).</strong>
            </p>

            {/* Upload metadata associations */}
            <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-xs mb-4 text-left">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vincular ao Lote</label>
                <select
                  value={selectedBatchForUpload}
                  onChange={(e) => setSelectedBatchForUpload(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="NOTA_FISCAL">Nota Fiscal / Recibo</option>
                  <option value="LAUDO_AGUA">Laudo de Água / Laboratório</option>
                  <option value="PLANILHA_BIOMETRIA">Planilha de Biometria</option>
                  <option value="CONTRATO">Contrato / Acordo</option>
                  <option value="OUTROS">Outros Documentos</option>
                </select>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              Selecionar Arquivos (até 100 MB)
            </button>

            <div className="mt-4 text-[11px] text-slate-500">
              Formatos aceitos: PDF, CSV, XLSX, XLS, ODS, DOCX, TXT, XML, JSON, JPG, PNG, WEBP, TIFF, HEIC.
              <br />
              Executáveis (.exe, .sh, scripts) são bloqueados. Arquivos &gt; 50 MB divididos em lotes para conformidade com a IA.
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#17323A]">
                Documentos Armazenados ({documents.length})
              </h3>
              <span className="text-xs text-slate-500">
                Repositório Privado Autorizado
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhum documento enviado ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#167D8D] flex items-center justify-center font-bold text-xs">
                          {doc.fileExtension.toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#17323A]">{doc.fileName}</h4>
                          <p className="text-xs text-slate-500">
                            {(doc.fileSizeBytes / 1_000_000).toFixed(2)} MB • {doc.category} • Enviado por {doc.uploadedBy}
                          </p>
                        </div>
                      </div>

                      {/* Status Badges & Controls */}
                      <div className="flex items-center gap-2">
                        {doc.status === 'EM_ANALISE' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 flex items-center gap-1.5 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin text-sky-700" />
                            <span>Analisando Blocos ({doc.progressPercent}%)</span>
                          </span>
                        )}

                        {doc.status === 'CONCLUIDO' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Conferido e Lançado</span>
                          </span>
                        )}

                        {doc.status === 'AGUARDANDO_CONFERENCIA' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Aguardando Conferência (100%)</span>
                          </span>
                        )}

                        {doc.status === 'PENDENTE_CONFERENCIA_MANUAL' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-900 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-orange-700" />
                            <span>Conferência Manual</span>
                          </span>
                        )}

                        {doc.status === 'SEM_ANALISE_AUTOMATICA' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            Sem Análise Automática
                          </span>
                        )}

                        {doc.status === 'FALHA' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-900 flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-red-700" />
                            <span>Falha no Processamento</span>
                          </span>
                        )}

                        {(doc.status === 'AGUARDANDO_CONFERENCIA' || doc.status === 'PENDENTE_CONFERENCIA_MANUAL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingDoc(doc);
                              setTargetBatchForConfirm(doc.batchId || (batches[0]?.id || ''));
                            }}
                            className="px-3 py-1 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold text-xs rounded transition-colors flex items-center gap-1"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Conferir Rascunho</span>
                          </button>
                        )}

                        {doc.status === 'RECEBIDO' && (
                          <button
                            type="button"
                            onClick={() => onExtractDraft(doc.id)}
                            className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-[#167D8D] font-bold text-xs rounded border border-teal-200 transition-colors flex items-center gap-1"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Gerar Rascunho</span>
                          </button>
                        )}

                        {onAgentAnalyze && !doc.agentAnalysis && doc.status !== 'EM_ANALISE' && (
                          <button
                            type="button"
                            disabled={analyzingAgentDocId === doc.id}
                            onClick={() => handleTriggerAgent(doc.id)}
                            className="px-3 py-1 bg-gradient-to-r from-[#123B45] to-[#167D8D] hover:opacity-90 text-white font-bold text-xs rounded transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>{analyzingAgentDocId === doc.id ? 'Analisando...' : 'Analisar com Agente IA'}</span>
                          </button>
                        )}

                        {onReprocessDocument && doc.status !== 'EM_ANALISE' && (
                          <button
                            type="button"
                            title="Reanalisar blocos e páginas do arquivo"
                            onClick={async () => {
                              try {
                                await onReprocessDocument(doc.id);
                                setUploadSuccess(`Reanálise de blocos iniciada para "${doc.fileName}".`);
                              } catch (e: any) {
                                setUploadError(e.message || 'Erro ao reprocessar.');
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progressive Real-time Block Progress Bar */}
                    {doc.status === 'EM_ANALISE' && (
                      <div className="mt-3 p-2.5 bg-sky-50/80 rounded-lg border border-sky-200 space-y-1.5">
                        <div className="flex justify-between items-center text-[11px] font-semibold text-sky-950">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-sky-700" />
                            {doc.currentStageDescription || 'Processando blocos de conteúdo página por página...'}
                          </span>
                          <span className="font-mono text-sky-800">
                            Pág. {doc.pagesProcessed || 0}/{doc.totalPages || 1} • {doc.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full bg-sky-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#167D8D] h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(5, doc.progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Split / Page Summary note */}
                    {doc.status !== 'EM_ANALISE' && doc.splitPagesCount && doc.splitPagesCount > 1 && (
                      <div className="mt-2 text-[11px] text-teal-800 bg-teal-50/70 p-2 rounded border border-teal-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            Documento particionado e verificado em {doc.splitPagesCount} páginas/blocos de conteúdo.
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-teal-700 font-semibold">
                          100% Verificado
                        </span>
                      </div>
                    )}

                    {/* ESTEIRA DO AGENTE: Card de Conferência e Aprovação de Lançamento */}
                    {doc.agentAnalysis && (
                      <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-[#123B45] text-white">
                              <Bot className="w-4 h-4" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#123B45]">
                                  {doc.agentAnalysis.documentTypeLabel}
                                </span>
                                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                  {doc.agentAnalysis.confidenceScore}% Confiança
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {doc.agentAnalysis.supplierOrCustomer} • Doc: {doc.agentAnalysis.detectedInvoiceNumber} • {doc.agentAnalysis.detectedDate}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-500 font-medium">Valor Total Extraído:</span>
                            <p className="text-base font-bold text-[#123B45]">
                              R$ {doc.agentAnalysis.totalAmount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Alertas de Anomalias Detectadas pelo Agente */}
                        {doc.agentAnalysis.anomaliesDetected && doc.agentAnalysis.anomaliesDetected.length > 0 && (
                          <div className="space-y-1.5">
                            {doc.agentAnalysis.anomaliesDetected.map((anom, idx) => (
                              <div
                                key={idx}
                                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                                  anom.severity === 'ALTA'
                                    ? 'bg-red-50 text-red-900 border border-red-200'
                                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                                }`}
                              >
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">{anom.message}</span>
                                  <p className="text-[11px] opacity-90 mt-0.5">{anom.evidence}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Itens Extraídos */}
                        {doc.agentAnalysis.items && doc.agentAnalysis.items.length > 0 && (
                          <div className="bg-white rounded-lg p-2.5 border border-slate-200 text-xs">
                            <p className="font-semibold text-slate-700 mb-1.5">Itens Identificados no Arquivo:</p>
                            <div className="space-y-1">
                              {doc.agentAnalysis.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[11px] py-0.5 border-b border-slate-100 last:border-0">
                                  <span className="text-slate-700">
                                    {it.description}
                                    {it.quantity ? ` (${it.quantity} ${it.unit || ''})` : ''}
                                  </span>
                                  <span className="font-semibold text-[#123B45]">
                                    R$ {it.totalAmount.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Barra de Ação: Seleção de Lote & Aprovação com 1 Clique */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-600 font-medium">Vincular ao Lote:</span>
                            <select
                              value={
                                targetBatchPerDoc[doc.id] ||
                                doc.agentAnalysis.suggestedBatchId ||
                                (batches[0]?.id || '')
                              }
                              onChange={(e) =>
                                setTargetBatchPerDoc({ ...targetBatchPerDoc, [doc.id]: e.target.value })
                              }
                              disabled={doc.confirmedByHuman}
                              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-[#123B45] focus:outline-none focus:ring-1 focus:ring-[#167D8D]"
                            >
                              {batches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code} ({b.pondId} - {b.modality})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            {doc.confirmedByHuman ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                                <CheckCheck className="w-4 h-4 text-emerald-700" />
                                Lançamento Aprovado e Registrado
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={approvingAgentDocId === doc.id}
                                onClick={() => handleApproveAgent(doc)}
                                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{approvingAgentDocId === doc.id ? 'Gravando...' : 'Aprovar Lançamento (1 Clique)'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: IMPORTAÇÃO DE PLANILHAS COM MAPEAMENTO */}
      {activeTab === 'planilhas' && (
        <div className="space-y-6">
          {/* Download Model Templates */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-[#17323A] mb-1">
              Baixar Modelos Vazios de Planilha
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Use estes arquivos formatados com separador brasileiro (ponto e vírgula e vírgula decimal) para acelerar a conferência.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadTemplate('gastos')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Modelo de Gastos do Lote (.csv)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate('biometria')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Modelo de Biometria (.csv)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate('agua')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Modelo de Qualidade da Água (.csv)</span>
              </button>
            </div>
          </div>

          {/* Upload and Map Spreadsheet */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#17323A]">
                  Importar Planilha com Mapeamento de Colunas
                </h3>
                <p className="text-xs text-slate-500">
                  Validação de duplicatas, separadores de milhar/decimal e reversão rastreável.
                </p>
              </div>

              <input
                ref={spreadsheetInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.ods"
                onChange={handleSpreadsheetFile}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => spreadsheetInputRef.current?.click()}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Carregar Arquivo CSV/XLSX</span>
              </button>
            </div>

            {/* Mapping Interface if preview is loaded */}
            {spreadsheetPreview && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                <div className="p-3 bg-teal-50/60 rounded-lg border border-teal-200 text-xs text-teal-950 flex items-center justify-between">
                  <span>
                    Arquivo carregado: <strong>{spreadsheetPreview.fileName}</strong> ({spreadsheetPreview.rows.length} linhas de amostra)
                  </span>
                  <span className="font-semibold text-teal-800">
                    {spreadsheetPreview.headers.length} colunas identificadas
                  </span>
                </div>

                {/* Column Association Form */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Coluna Descrição</label>
                    <select
                      value={columnMapping.description}
                      onChange={(e) => setColumnMapping({ ...columnMapping, description: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    >
                      {spreadsheetPreview.headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Coluna Valor (R$)</label>
                    <select
                      value={columnMapping.amount}
                      onChange={(e) => setColumnMapping({ ...columnMapping, amount: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    >
                      {spreadsheetPreview.headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Coluna Categoria</label>
                    <select
                      value={columnMapping.category}
                      onChange={(e) => setColumnMapping({ ...columnMapping, category: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    >
                      {spreadsheetPreview.headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Lote de Destino</label>
                    <select
                      value={selectedBatchForUpload}
                      onChange={(e) => setSelectedBatchForUpload(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sample Preview Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        {spreadsheetPreview.headers.map((h, idx) => (
                          <th key={idx} className="px-3 py-2 border-r last:border-r-0 border-slate-200">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {spreadsheetPreview.rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell: any, cIdx: number) => (
                            <td key={cIdx} className="px-3 py-2 text-slate-700 font-mono text-[11px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Confirm Import Button */}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSpreadsheetPreview(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const mappedRows = spreadsheetPreview.allRows.map((r) => {
                        const rawAmount = r[columnMapping.amount];
                        const amount = parseBrazilianNum(rawAmount);
                        return {
                          description: String(r[columnMapping.description] || 'Item importado').trim(),
                          amount,
                          category: String(r[columnMapping.category] || 'OUTROS').trim(),
                          date: r[columnMapping.date] ? String(r[columnMapping.date]).trim() : new Date().toISOString().split('T')[0],
                          invoiceNumber: r[columnMapping.invoiceNumber] ? String(r[columnMapping.invoiceNumber]).trim() : spreadsheetPreview.fileName,
                        };
                      }).filter((row) => row.amount > 0);

                      if (mappedRows.length === 0) {
                        setUploadError('Nenhum registro com valor numérico positivo identificado para importação.');
                        return;
                      }

                      await onImportSpreadsheetRows(
                        'GASTOS',
                        mappedRows,
                        spreadsheetPreview.fileName,
                        selectedBatchForUpload
                      );
                      setSpreadsheetPreview(null);
                      setUploadSuccess(`Planilha ${spreadsheetPreview.fileName} importada com sucesso! ${mappedRows.length} lançamentos conferidos.`);
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                  >
                    Confirmar Importação de {spreadsheetPreview.totalRows} Linhas no Lote
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Conferência Humana do Rascunho Extraído por IA (Human-in-the-Loop) */}
      {reviewingDoc && reviewingDoc.extractedDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center gap-2 text-[#167D8D] mb-1">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg font-bold text-[#17323A]">
                Conferência Humana de Rascunho Fiscal
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Origem: <strong>{reviewingDoc.fileName}</strong> • Página {reviewingDoc.extractedDraft.evidencePage || 1}
              <br />
              <span className="text-amber-800 font-semibold">
                * A extração por IA é apenas um rascunho de conferência e não substitui a comprovação contábil.
              </span>
            </p>

            <div className="p-3 bg-[#F6F8F7] rounded-lg border border-slate-200 mb-4 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-[#17323A]">
                <span>Valor Total Identificado:</span>
                <span className="font-mono text-[#123B45]">
                  {formatCurrencyBRL(reviewingDoc.extractedDraft.totalValue || 0)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Evidência: {reviewingDoc.extractedDraft.confidenceNote}
              </p>

              {/* Items Breakdown list if available */}
              {reviewingDoc.extractedDraft.items && reviewingDoc.extractedDraft.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Itens extraídos dos blocos ({reviewingDoc.extractedDraft.items.length}):
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {reviewingDoc.extractedDraft.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] bg-white p-1.5 rounded border border-slate-200">
                        <span className="truncate pr-2 font-medium text-slate-800">{it.description}</span>
                        <span className="font-mono font-bold text-[#123B45] whitespace-nowrap">{formatCurrencyBRL(it.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real-time processing logs if available */}
              {reviewingDoc.processingLogs && reviewingDoc.processingLogs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 block mb-1">
                    Rastreabilidade de Análise por Página ({reviewingDoc.processingLogs.length} eventos):
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-50 p-1.5 rounded border border-slate-200 text-[10px] font-mono text-slate-600">
                    {reviewingDoc.processingLogs.map((log, lIdx) => (
                      <div key={lIdx} className="truncate">
                        • {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual input if value is zero or requires manual adjustment */}
              {(!reviewingDoc.extractedDraft.totalValue || reviewingDoc.extractedDraft.totalValue === 0) && (
                <div className="mt-3 pt-2 border-t border-slate-200 space-y-2">
                  <p className="text-amber-800 font-semibold text-[11px]">
                    Insira os valores conferidos manualmente da nota/recibo:
                  </p>
                  <div>
                    <label className="block text-slate-600 mb-0.5 font-medium">Valor Total da Despesa (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ex: 3500.00"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5 font-medium">Descrição do Lançamento:</label>
                    <input
                      type="text"
                      placeholder="Ex: Ração inicial 35% proteína"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4 text-xs">
              <label className="block text-slate-700 font-semibold">
                Selecione o Lote de Destino para os Gastos:
              </label>
              <select
                value={targetBatchForConfirm}
                onChange={(e) => setTargetBatchForConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.pondId}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setReviewingDoc(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const hasDraftValue = reviewingDoc.extractedDraft.totalValue > 0;
                  const finalAmount = hasDraftValue ? reviewingDoc.extractedDraft.totalValue : parseFloat(manualAmount || '0');

                  if (!finalAmount || finalAmount <= 0) {
                    setUploadError('Informe um valor numérico positivo para aprovar o lançamento no lote.');
                    return;
                  }

                  const options = hasDraftValue ? {} : {
                    manualTotal: finalAmount,
                    manualItems: [{
                      description: manualDescription || `Despesa conferida (${reviewingDoc.fileName})`,
                      value: finalAmount,
                      category: manualCategory || 'OUTROS',
                    }],
                  };

                  await onConfirmDraftToBatch(reviewingDoc.id, targetBatchForConfirm, options);
                  setReviewingDoc(null);
                  setUploadSuccess('Gastos conferidos e lançados no lote de destino com sucesso!');
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm transition-colors"
              >
                Aprovar e Lançar no Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
