import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  HelpCircle,
  ShieldAlert,
  FileCheck2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEnv: 'demo' | 'real';
  currentRole?: string;
  companyId?: string;
  unit?: string;
}

export const AssistantModal: React.FC<AssistantModalProps> = ({
  isOpen,
  onClose,
  currentEnv,
  currentRole = 'PROPRIETARIO',
  companyId = 'empresa-real-001',
  unit = 'Unidade Principal',
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      citations?: string[];
      isFallback?: boolean;
    }>
  >([
    {
      role: 'assistant',
      content:
        currentEnv === 'real'
          ? 'Olá! Sou o Assistente Técnico e Financeiro da sua empresa. Estou conectado estritamente aos dados reais da sua fazenda. Posso consultar seus lotes, medições de água e pendências financeiras registradas.'
          : 'Olá! Sou o Assistente Técnico e Financeiro da Maré. Posso apoiar a leitura de notas fiscais, conferência de custos dos lotes de demonstração, checagem de qualidade de água e cálculos de conversão alimentar.',
    },
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setQuery('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const sessionToken = sessionStorage.getItem('mare_auth_token');
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-environment': currentEnv,
      };
      if (sessionToken && currentEnv === 'real') {
        reqHeaders['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`/api/assistant/query?env=${currentEnv}`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ query: userText, question: userText }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${response.status} na consulta.`);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'Nenhuma informação localizada.',
          citations: data.citations,
          isFallback: data.isDeterministicFallback,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            err.message ||
            'Não foi possível conectar ao serviço de inteligência no momento. Operando no modo de consulta determinística das regras do viveiro.',
          isFallback: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions =
    currentEnv === 'real'
      ? [
          'Quais lotes de camarão estão ativos na minha empresa?',
          'Há medições de água anômalas ou incidentes abertos?',
          'Qual a posição atual dos meus títulos a receber?',
          'Como importar custos de notas fiscais para um lote?',
        ]
      : [
          'Qual o custo por kg e FCA do lote DEMO-A?',
          'Como está a qualidade da água nos viveiros hoje?',
          'Quanto tenho de ração em estoque e quando devo repor?',
          'Qual a política para títulos em atraso e disputas?',
        ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col h-[640px] max-h-[90vh] border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#123B45] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-teal-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Assistente de Gestão Aquícola</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-800 text-teal-200 font-mono">
                  {currentEnv === 'demo' ? 'DEMO' : 'PRODUÇÃO'}
                </span>
              </div>
              <p className="text-[11px] text-teal-200/80">
                Auditoria técnica com citações de lote e transparência contábil
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

        {/* Ethical Safety Notice */}
        <div className="bg-teal-50/70 border-b border-teal-100 px-4 py-2 text-[11px] text-teal-900 flex items-center justify-between">
          <span>
            <strong>Diretriz Operacional:</strong> Rascunhos informativos. Sem comandos de aeradores ou lançamentos automáticos.
          </span>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                m.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#123B45] text-white'
                    : 'bg-[#F6F8F7] text-slate-800 border border-slate-200'
                }`}
              >
                {m.content}

                {/* Citations & Evidence Tag */}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 text-[11px] text-teal-800 flex flex-wrap items-center gap-1.5 font-mono">
                    <FileCheck2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>Citações auditáveis:</span>
                    {m.citations.map((c, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-1.5 py-0.5 bg-white rounded border border-teal-200 text-teal-900 font-bold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Fallback indicator */}
                {m.isFallback && (
                  <div className="mt-2 text-[10px] text-slate-500 italic">
                    (Resposta gerada por regras determinísticas do sistema)
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 italic p-2">
              <Sparkles className="w-4 h-4 text-[#167D8D] animate-spin" />
              <span>Consultando dados certificados e gerando resposta...</span>
            </div>
          )}
        </div>

        {/* Quick Question Chips */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(q);
              }}
              className="text-[11px] bg-white hover:bg-teal-50 hover:text-teal-900 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Query Input */}
        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex gap-2">
          <input
            type="text"
            placeholder="Pergunte sobre custos, FCA, água, faturas ou documentos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Perguntar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
