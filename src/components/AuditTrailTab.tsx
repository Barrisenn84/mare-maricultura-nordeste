import React, { useState, useEffect } from 'react';
import { EnvironmentMode } from '../types';
import { ShieldCheck, Search, Filter, Download, RefreshCw, AlertCircle, Clock, UserCheck } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  environment: EnvironmentMode;
  action: string;
  targetEntity: string;
  recordId: string;
  details: string;
  ipAddress?: string;
}

interface AuditTrailTabProps {
  currentEnv: EnvironmentMode;
}

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ currentEnv }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const sessionToken = sessionStorage.getItem('mare_auth_token');
      const headers: Record<string, string> = {
        'x-environment': currentEnv,
      };
      if (sessionToken && currentEnv === 'real') {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(`/api/audit-logs?env=${currentEnv}`, { headers });
      if (!res.ok) {
        throw new Error(`Falha ao carregar trilha de auditoria (${res.status})`);
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao consultar trilha de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentEnv]);

  const filteredLogs = logs.filter((log) => {
    const matchesEntity = entityFilter === 'TODAS' || log.targetEntity === entityFilter;
    const matchesSearch =
      !searchTerm ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.recordId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesEntity && matchesSearch;
  });

  const exportAuditCSV = () => {
    const sanitize = (text: string) => {
      const trimmed = String(text || '').trim();
      if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
        return `'${trimmed}`;
      }
      return trimmed;
    };

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Data_Hora;Usuario;Papel;Ambiente;Acao;Entidade;ID_Registro;Detalhes\n';

    filteredLogs.forEach((l) => {
      const row = [
        sanitize(new Date(l.timestamp).toLocaleString('pt-BR')),
        sanitize(l.userName),
        sanitize(l.userRole),
        sanitize(l.environment === 'real' ? 'Minha Empresa' : 'Demonstração'),
        sanitize(l.action),
        sanitize(l.targetEntity),
        sanitize(l.recordId),
        sanitize(l.details),
      ].join(';');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Trilha_Auditoria_${currentEnv}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#167D8D] flex items-center justify-center border border-teal-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#123B45]">Trilha de Auditoria Imutável</h3>
            <p className="text-xs text-slate-500">
              Registros cronológicos de todas as inserções, baixas e alterações cadastrais
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={exportAuditCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por descrição, usuário, ação ou código..."
            className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <label className="text-xs font-semibold text-slate-600">Entidade:</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-teal-500"
          >
            <option value="TODAS">Todas as Entidades</option>
            <option value="LOTE">Lotes de Cultivo</option>
            <option value="CUSTO">Custos e Insumos</option>
            <option value="BIOMETRIA">Biometrias e GMD</option>
            <option value="WATER">Qualidade da Água</option>
            <option value="INCIDENT">Incidentes Técnicos</option>
            <option value="ORDER">Pedidos de Venda</option>
            <option value="RECEIVABLE">Contas a Receber</option>
            <option value="DOCUMENTO">Documentos e NFs</option>
            <option value="IMPORTACAO">Importações em Massa</option>
            <option value="BACKUP">Snapshots e Backups</option>
            <option value="AUTH">Autenticação e Sessões</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#167D8D]" />
            <span>Consultando registros de auditoria certificados...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhum registro de auditoria localizado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">Data / Hora</th>
                  <th className="px-3 py-2.5">Usuário & Papel</th>
                  <th className="px-3 py-2.5">Ação</th>
                  <th className="px-3 py-2.5">Entidade / ID</th>
                  <th className="px-3 py-2.5">Detalhes da Transação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 font-sans">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 font-sans">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                        <div>
                          <span className="font-semibold">{log.userName}</span>
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">{log.userRole}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-[#123B45] font-semibold border border-teal-200/60 text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      <span className="font-semibold text-slate-800">{log.targetEntity}</span>
                      <span className="text-[10px] text-slate-400 block">{log.recordId}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 font-sans max-w-md break-words">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
