import React, { useState } from 'react';
import { EnvironmentMode } from '../types';
import {
  Eraser,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resetCompany: boolean) => Promise<void>;
  currentEnv: EnvironmentMode;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentEnv,
}) => {
  const [resetCompany, setResetCompany] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isReal = currentEnv === 'real';

  const handleExecute = async () => {
    setLoading(true);
    try {
      await onConfirm(resetCompany);
      onClose();
    } catch (err) {
      console.error('Erro ao limpar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <Eraser className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                Limpar Tudo e Zerar Campos
              </h3>
              <p className="text-xs text-slate-500">
                Ambiente: <strong className={isReal ? 'text-teal-700' : 'text-amber-700'}>
                  {isReal ? 'Minha Empresa (Real)' : 'Demonstração (Fictícia)'}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mt-4 p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> Esta ação irá limpar todos os registros e zerar todos os indicadores, preparando a plataforma para a inclusão manual de novos dados ou novas importações.
          </div>
        </div>

        {/* What will be reset */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Os seguintes campos e módulos serão totalmente zerados:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Lotes e Biometrias (0 kg)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Qualidade da Água (Leituras)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Custos e Despesas (R$ 0,00)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Estoque de Ração e Insumos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Vendas e Contas a Receber</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Documentos e Notas Fiscais</span>
            </div>
          </div>
        </div>

        {/* Optional: Reset Company data */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              checked={resetCompany}
              onChange={(e) => setResetCompany(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
            />
            <span>
              <strong>Zerar também dados da empresa</strong> (CNPJ, Proprietário e diagnóstico inicial)
            </span>
          </label>
        </div>

        {/* Note about restoration */}
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          {isReal ? (
            <span>
              🔒 A operação é segura e atômica no servidor, permitindo começar uma gestão limpa imediatamente.
            </span>
          ) : (
            <span>
              💡 No modo demonstração, você pode clicar em <strong>"Restaurar Demo"</strong> a qualquer momento para trazer os dados de exemplo de volta.
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Zerando todos os campos...</span>
              </>
            ) : (
              <>
                <Eraser className="w-4 h-4" />
                <span>Sim, Limpar e Zerar Tudo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
