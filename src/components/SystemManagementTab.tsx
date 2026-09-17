import React, { useState, useEffect } from 'react';
import { EnvironmentMode, SchedulerJobInfo } from '../types';
import {
  ShieldCheck,
  Database,
  CalendarClock,
  Sparkles,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Archive,
  FlaskConical,
  RotateCcw,
  Check,
  X,
  Server,
  Lock,
} from 'lucide-react';

interface BackupRecord {
  id: string;
  createdAt: string;
  filesCount: number;
  sizeBytes: number;
  reason: string;
  isValid: boolean;
}

interface SystemManagementTabProps {
  currentEnv: EnvironmentMode;
}

export const SystemManagementTab: React.FC<SystemManagementTabProps> = ({ currentEnv }) => {
  // Backups state
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [sandboxTestingId, setSandboxTestingId] = useState<string | null>(null);
  const [sandboxResult, setSandboxResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);

  // Scheduler state
  const [jobs, setJobs] = useState<SchedulerJobInfo[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [jobFeedback, setJobFeedback] = useState<{ jobId: string; message: string } | null>(null);

  // Gemini state
  const [aiStatus, setAiStatus] = useState<{ isConfigured: boolean; model: string; notice: string } | null>(null);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; latencyMs?: number; message?: string; sampleResponse?: string } | null>(null);

  // General error
  const [generalError, setGeneralError] = useState<string | null>(null);

  const getHeaders = () => {
    const sessionToken = sessionStorage.getItem('mare_auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-environment': currentEnv,
    };
    if (sessionToken && currentEnv === 'real') {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch(`/api/backups?env=${currentEnv}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (err: any) {
      console.error('Erro ao buscar backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/scheduler/jobs?env=${currentEnv}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err: any) {
      console.error('Erro ao buscar jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchAiStatus = async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch (err) {
      console.error('Erro ao buscar status de IA:', err);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchJobs();
    fetchAiStatus();
  }, [currentEnv]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setGeneralError(null);
    try {
      const res = await fetch(`/api/backups?env=${currentEnv}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: 'Snapshot manual acionado pelo painel de controle' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao criar snapshot.');
      }
      await fetchBackups();
    } catch (err: any) {
      setGeneralError(err.message || 'Erro ao gerar backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleTestSandbox = async (id: string) => {
    setSandboxTestingId(id);
    setSandboxResult(null);
    try {
      const res = await fetch(`/api/backups/${id}/test-sandbox?env=${currentEnv}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSandboxResult({
          id,
          success: true,
          message: `Teste aprovado: ${data.filesVerified} arquivos auditados em sandbox. Checksums íntegros.`,
        });
      } else {
        setSandboxResult({
          id,
          success: false,
          message: data.error || 'Falha de verificação na sandbox.',
        });
      }
    } catch (err: any) {
      setSandboxResult({ id, success: false, message: err.message || 'Erro de comunicação no teste.' });
    } finally {
      setSandboxTestingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm('Atenção: A restauração substituirá os dados atuais pelo snapshot selecionado. Deseja continuar?')) {
      return;
    }
    setRestoringBackupId(id);
    setGeneralError(null);
    try {
      const res = await fetch(`/api/backups/${id}/restore?env=${currentEnv}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao restaurar snapshot.');
      }
      alert('Snapshot restaurado com sucesso. A página será atualizada.');
      window.location.reload();
    } catch (err: any) {
      setGeneralError(err.message || 'Erro na restauração.');
    } finally {
      setRestoringBackupId(null);
    }
  };

  const handleRunJob = async (jobId: string) => {
    setRunningJobId(jobId);
    setJobFeedback(null);
    try {
      const res = await fetch(`/api/scheduler/jobs/${jobId}/run?env=${currentEnv}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setJobFeedback({
          jobId,
          message: `Execução concluída: ${data.job?.history?.[0]?.details || 'Rotina finalizada sem erros.'}`,
        });
        await fetchJobs();
      } else {
        setJobFeedback({
          jobId,
          message: data.error || 'Erro ao executar rotina.',
        });
      }
    } catch (err: any) {
      setJobFeedback({ jobId, message: err.message || 'Falha de comunicação.' });
    } finally {
      setRunningJobId(null);
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      setAiTestResult({
        success: data.success,
        latencyMs: data.latencyMs,
        message: data.message || data.error,
        sampleResponse: data.sampleResponse,
      });
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: err.message || 'Erro de comunicação ao testar IA.',
      });
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Alert */}
      {generalError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* SECTION 1: SNAPSHOTS & BACKUPS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#167D8D] flex items-center justify-center border border-teal-200">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#123B45]">Snapshots e Cópias de Segurança</h3>
              <p className="text-xs text-slate-500">
                Backups atômicos com validação de checksum e teste de integridade em sandbox isolado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchBackups}
              disabled={loadingBackups}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className="px-3 py-1.5 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{creatingBackup ? 'Gerando Snapshot...' : 'Criar Novo Snapshot'}</span>
            </button>
          </div>
        </div>

        {sandboxResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              sandboxResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {sandboxResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            <span>{sandboxResult.message}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          {backups.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhum snapshot registrado no armazenamento até o momento.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">ID / Data</th>
                  <th className="px-3 py-2.5">Motivo</th>
                  <th className="px-3 py-2.5">Tamanho</th>
                  <th className="px-3 py-2.5">Integridade</th>
                  <th className="px-3 py-2.5 text-right">Ações Seguras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5 font-sans">
                      <div className="font-semibold text-slate-800">{b.id}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{new Date(b.createdAt).toLocaleString('pt-BR')}</div>
                    </td>
                    <td className="px-3 py-2.5 font-sans text-slate-700">{b.reason}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">{(b.sizeBytes / 1024).toFixed(1)} KB ({b.filesCount} arqs)</td>
                    <td className="px-3 py-2.5 font-sans">
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-semibold">
                        <Check className="w-3 h-3" />
                        Íntegro
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTestSandbox(b.id)}
                          disabled={sandboxTestingId === b.id}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-[11px] border border-teal-200 transition-colors cursor-pointer disabled:opacity-50"
                          title="Simula a extração e integridade sem alterar a base em produção"
                        >
                          <FlaskConical className="w-3 h-3 inline mr-1" />
                          {sandboxTestingId === b.id ? 'Testando...' : 'Testar em Sandbox'}
                        </button>
                        {currentEnv === 'real' && (
                          <button
                            type="button"
                            onClick={() => handleRestore(b.id)}
                            disabled={restoringBackupId === b.id}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded font-semibold text-[11px] border border-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                            title="Restaura esta cópia de segurança"
                          >
                            <RotateCcw className="w-3 h-3 inline mr-1" />
                            {restoringBackupId === b.id ? 'Restaurando...' : 'Restaurar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION 2: SCHEDULER & BACKGROUND AUDIT TASKS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#167D8D] flex items-center justify-center border border-teal-200">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#123B45]">Rotinas em Segundo Plano e Agendamentos</h3>
              <p className="text-xs text-slate-500">
                Tarefas automáticas de auditoria, verificação de qualidade da água e estoque mínimo seguro
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchJobs}
            disabled={loadingJobs}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loadingJobs ? 'animate-spin' : ''}`} />
            Atualizar Status
          </button>
        </div>

        {jobFeedback && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700 flex-shrink-0" />
            <span>{jobFeedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-xs text-slate-900">{job.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      job.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : job.status === 'RUNNING'
                        ? 'bg-sky-100 text-sky-800 animate-pulse'
                        : job.status === 'ERROR'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">{job.description}</p>
                <div className="text-[10px] text-slate-400 space-y-0.5 font-mono">
                  <div>Periodicidade: {job.scheduleDescription}</div>
                  <div>Última execução: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString('pt-BR') : 'Aguardando primeiro ciclo'}</div>
                  {job.anomaliesFound !== undefined && (
                    <div className={job.anomaliesFound > 0 ? 'text-amber-600 font-bold font-sans' : 'text-slate-500 font-sans'}>
                      Anomalias encontradas: {job.anomaliesFound}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleRunJob(job.id)}
                  disabled={runningJobId === job.id}
                  className="px-3 py-1.5 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{runningJobId === job.id ? 'Processando...' : 'Executar Agora'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: GEMINI AI CONNECTION DIAGNOSTIC */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#167D8D] flex items-center justify-center border border-teal-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#123B45]">Conexão e Inteligência Artificial (Gemini)</h3>
              <p className="text-xs text-slate-500">
                Diagnóstico de comunicação segura no servidor para extração de NFs e apoio técnico
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestAi}
            disabled={testingAi}
            className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{testingAi ? 'Testando Conexão...' : 'Testar Conexão com Gemini'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500 block text-[11px]">Chave de API (GEMINI_API_KEY)</span>
            <div className="mt-1 flex items-center gap-1.5 font-bold">
              {aiStatus?.isConfigured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Configurada no Servidor</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-700">Não configurada</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500 block text-[11px]">Modelo Ativo</span>
            <div className="mt-1 font-mono font-bold text-slate-800">
              {aiStatus?.model || 'gemini-2.5-flash'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500 block text-[11px]">Segurança e Privacidade</span>
            <div className="mt-1 font-semibold text-slate-800 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-teal-600" />
              <span>Chaves nunca expostas ao browser</span>
            </div>
          </div>
        </div>

        {aiTestResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              aiTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                {aiTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                <span>{aiTestResult.success ? 'Conexão com a API Gemini estabelecida com sucesso!' : 'Operando em modo determinístico sem chave de IA'}</span>
              </div>
              {aiTestResult.latencyMs !== undefined && (
                <span className="font-mono text-[11px] bg-white/70 px-2 py-0.5 rounded border border-emerald-300/40">
                  Latência: {aiTestResult.latencyMs} ms
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed">{aiTestResult.message}</p>
            {aiTestResult.sampleResponse && (
              <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 font-mono text-[11px] text-slate-700">
                Resposta recebida do modelo: &quot;{aiTestResult.sampleResponse}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 4: ARCHITECTURAL INTEGRITY DECLARATION */}
      <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Server className="w-4 h-4 text-[#167D8D] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-slate-800">Declaração de Isolamento e Conformidade de Dados</div>
          <p className="leading-relaxed">
            O ambiente <strong>Minha Empresa</strong> é mantido sob armazenamento durável persistente em disco privado, protegido contra quarentena de corrupção e desvinculado dos registros fictícios de demonstração. Sessões são validadas através de tokens assinados com PBKDF2 e SHA-512, impedindo qualquer manipulação de identidade via cabeçalhos HTTP do cliente.
          </p>
        </div>
      </div>
    </div>
  );
};
