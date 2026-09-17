import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  ShieldCheck,
  AlertTriangle,
  Code2,
} from 'lucide-react';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    timestamp: string;
    total: number;
    passed: number;
    failed: number;
    blockedCount?: number;
    notRunCount?: number;
    tests: Array<{ id: string; name: string; passed: boolean; status?: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN'; details: string }>;
  } | null>(null);

  if (!isOpen) return null;

  const runSuite = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      const data = await res.json();
      setResults(data);
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col h-[680px] max-h-[92vh] border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#123B45] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-teal-300">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                Matriz de 21 Testes de Homologação e Segurança
              </h3>
              <p className="text-[11px] text-teal-200/80">
                Verificação automatizada ponta a ponta com status PASS, FAIL, BLOCKED e NOT_RUN
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-teal-100 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Stats Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={running}
              onClick={runSuite}
              className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              {running ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{running ? 'Executando Testes...' : 'Executar Todos os 21 Testes'}</span>
            </button>

            {results && (
              <span className="text-xs text-slate-600">
                Última execução: {results.timestamp.split('T')[1]?.slice(0, 8)}
              </span>
            )}
          </div>

          {results && (
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {results.passed} PASS
              </span>
              {results.failed > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-100 text-red-800 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                  {results.failed} FAIL
                </span>
              )}
              {(results.blockedCount || 0) > 0 && (
                <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  {results.blockedCount} BLOCKED
                </span>
              )}
            </div>
          )}
        </div>

        {/* Test List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
          {!results ? (
            <div className="text-center py-16 text-slate-500">
              <ShieldCheck className="w-12 h-12 text-[#167D8D] mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-700">
                Pronto para rodar a suíte completa de testes determinísticos.
              </p>
              <p className="text-[11px] mt-1">
                Clique no botão &quot;Executar Todos os 21 Testes&quot; acima para disparar os casos de teste no servidor.
              </p>
            </div>
          ) : (
            results.tests.map((t) => {
              const status = t.status || (t.passed ? 'PASS' : 'FAIL');
              const isPass = status === 'PASS';
              const isFail = status === 'FAIL';
              const isBlocked = status === 'BLOCKED';

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                    isPass
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isBlocked
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-red-50/40 border-red-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-500 text-[11px]">
                        {t.id}
                      </span>
                      <h4 className="font-bold text-[#17323A] text-xs">{t.name}</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 pl-6">{t.details}</p>
                  </div>

                  <div className="flex-shrink-0 pt-0.5">
                    {isPass && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                      </span>
                    )}
                    {isBlocked && (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-bold text-[11px] bg-amber-100 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> BLOCKED
                      </span>
                    )}
                    {isFail && (
                      <span className="inline-flex items-center gap-1 text-red-700 font-bold text-[11px] bg-red-100 px-2 py-0.5 rounded">
                        <XCircle className="w-3.5 h-3.5" /> FAIL
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Garantia de consistência: Todos os testes rodam no backend isolado sem afetar dados de produção.
        </div>
      </div>
    </div>
  );
};
