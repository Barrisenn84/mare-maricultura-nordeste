import React, { useState, useEffect, useCallback } from 'react';
import {
  EnvironmentMode,
  UserRole,
  NavigationTab,
  Batch,
  WaterMeasurement,
  Incident,
  InventoryItem,
  SalesOrder,
  ReceivableBill,
  AppDocument,
  CompanyConfig,
  AuthSession,
} from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { ProductionView } from './components/ProductionView';
import { CostsInventoryView } from './components/CostsInventoryView';
import { SalesReceivablesView } from './components/SalesReceivablesView';
import { DocumentsImportView } from './components/DocumentsImportView';
import { ReportsView } from './components/ReportsView';
import { NordesteMarketTab } from './components/NordesteMarketTab';
import { AssistantModal } from './components/AssistantModal';
import { TestSuiteModal } from './components/TestSuiteModal';
import { LoginModal } from './components/LoginModal';
import { ClearDataModal } from './components/ClearDataModal';
import {
  loadClientStore,
  saveClientStore,
  resetDemoClientStore,
  clearClientStore,
} from './utils/clientStorage';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentEnv, setCurrentEnv] = useState<EnvironmentMode>('demo');
  const [currentRole, setCurrentRole] = useState<UserRole>('PROPRIETARIO');
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthSession | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [clearAllConfirmModal, setClearAllConfirmModal] = useState(false);
  const [company, setCompany] = useState<CompanyConfig>({
    id: 'mari-ne-001',
    name: 'Maricultura Nordeste Ltda.',
    legalName: 'Maricultura Nordeste Ltda.',
    cnpj: '12.345.678/0001-90',
    modality: 'AMBAS',
    ownerName: 'José da Silva',
    city: 'Tibau do Sul',
    state: 'RN',
    units: ['Fazenda Tibau', 'Laboratório Guamaré'],
    activeUnit: 'Fazenda Tibau',
    primaryProblem: 'Controlar custos por lote em tempo real e conciliar pedidos com estoque liberado',
    systemsInUse: 'Planilhas dispersas e anotações de campo em caderno',
  });

  const [batches, setBatches] = useState<Batch[]>([]);
  const [waterMeasurements, setWaterMeasurements] = useState<WaterMeasurement[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [receivables, setReceivables] = useState<ReceivableBill[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);

  const [loading, setLoading] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);
  const [switchConfirmModal, setSwitchConfirmModal] = useState<EnvironmentMode | null>(null);
  const [resetConfirmModal, setResetConfirmModal] = useState(false);

  // Derive request headers with token for real environment
  const getAuthHeaders = useCallback((customHeaders?: Record<string, string>) => {
    const headers: Record<string, string> = {
      'x-environment': currentEnv,
      ...(customHeaders || {}),
    };
    const token = authenticatedUser?.token || sessionStorage.getItem('mare_auth_token');
    if (token && currentEnv === 'real') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [currentEnv, authenticatedUser]);

  // Fetch full state from backend or fallback to local storage
  const fetchState = useCallback(async (envOverride?: EnvironmentMode, tokenOverride?: string) => {
    const activeEnv = envOverride || currentEnv;
    try {
      setLoading(true);
      const token = tokenOverride || authenticatedUser?.token || sessionStorage.getItem('mare_auth_token');
      const reqHeaders: Record<string, string> = {
        'x-environment': activeEnv,
      };
      if (token && activeEnv === 'real') {
        reqHeaders['Authorization'] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`/api/state?env=${activeEnv}`, {
          headers: reqHeaders,
        });

        if (res.status === 401 && activeEnv === 'real') {
          setAuthenticatedUser(null);
          sessionStorage.removeItem('mare_auth_token');
          setIsLoginModalOpen(true);
          setLoading(false);
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          const rawStore = data.data || data;

          if (data.env || data.environment) {
            setCurrentEnv(data.env || data.environment);
          }
          if (rawStore.company) {
            setCompany((prev) => ({
              ...prev,
              ...rawStore.company,
              modality: rawStore.company.modality || prev.modality || 'AMBAS',
            }));
          }
          if (rawStore.batches) setBatches(rawStore.batches);
          if (rawStore.waterMeasurements) setWaterMeasurements(rawStore.waterMeasurements);
          if (rawStore.incidents) setIncidents(rawStore.incidents);
          if (rawStore.inventory) setInventory(rawStore.inventory);
          if (rawStore.salesOrders) setSalesOrders(rawStore.salesOrders);
          if (rawStore.receivables) setReceivables(rawStore.receivables);
          if (rawStore.documents) setDocuments(rawStore.documents);
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to client storage
      }

      // Standalone / Vercel offline client storage fallback
      const clientStore = loadClientStore(activeEnv);
      setCompany(clientStore.company);
      setBatches(clientStore.batches);
      setWaterMeasurements(clientStore.waterMeasurements);
      setIncidents(clientStore.incidents);
      setInventory(clientStore.inventory);
      setSalesOrders(clientStore.salesOrders);
      setReceivables(clientStore.receivables);
      setDocuments(clientStore.documents);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [currentEnv, authenticatedUser]);

  // Check active session on startup
  useEffect(() => {
    const token = sessionStorage.getItem('mare_auth_token');
    if (token) {
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.active && data.session) {
            setAuthenticatedUser(data.session);
            setCurrentRole(data.session.role);
          } else {
            sessionStorage.removeItem('mare_auth_token');
          }
        })
        .catch(() => {
          sessionStorage.removeItem('mare_auth_token');
        });
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Real-time polling while any document is undergoing authentic block processing
  useEffect(() => {
    const hasProcessingDocs = documents.some(
      (d) => d.status === 'EM_ANALISE' || (d.status === 'RECEBIDO' && d.progressPercent < 100)
    );
    if (!hasProcessingDocs) return;

    const interval = setInterval(() => {
      fetchState();
    }, 1000);

    return () => clearInterval(interval);
  }, [documents, fetchState]);

  // Environment switcher
  const handleSwitchEnv = async (targetEnv: EnvironmentMode) => {
    try {
      if (targetEnv === 'real') {
        const token = authenticatedUser?.token || sessionStorage.getItem('mare_auth_token');
        if (!token) {
          // Open login modal for authentication into real environment
          setIsLoginModalOpen(true);
          setSwitchConfirmModal(null);
          return;
        }
      }
      setCurrentEnv(targetEnv);
      await fetchState(targetEnv);
    } catch (err) {
      console.error(err);
    } finally {
      setSwitchConfirmModal(null);
    }
  };

  const handleLoginSuccess = (session: AuthSession) => {
    sessionStorage.setItem('mare_auth_token', session.token);
    setAuthenticatedUser(session);
    setCurrentRole(session.role);
    setCurrentEnv('real');
    setIsLoginModalOpen(false);
    fetchState('real', session.token);
  };

  const handleLogout = async () => {
    const token = authenticatedUser?.token || sessionStorage.getItem('mare_auth_token');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    sessionStorage.removeItem('mare_auth_token');
    setAuthenticatedUser(null);
    setCurrentEnv('demo');
    setCurrentRole('PROPRIETARIO');
    fetchState('demo');
  };

  // Reset demo state
  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/state/reset-demo', {
        method: 'POST',
        headers: { 'x-environment': 'demo' },
      });
      if (res.ok) {
        await fetchState('demo');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResetConfirmModal(false);
    }
  };

  // Clear all operational data and zero out all fields (Demo or Real)
  const handleClearAllData = async (resetCompany: boolean) => {
    try {
      const res = await fetch(`/api/state/clear?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ resetCompany }),
      });
      if (res.ok) {
        await fetchState(currentEnv);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao limpar e zerar os dados.');
      }
    } catch (err) {
      console.error('Erro ao limpar dados:', err);
    } finally {
      setClearAllConfirmModal(false);
    }
  };

  // Create Batch
  const handleAddBatch = async (batchData: Partial<Batch>) => {
    try {
      const res = await fetch(`/api/batches?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(batchData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao cadastrar lote');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Cost to Batch
  const handleAddCostToBatch = async (batchId: string, costData: any) => {
    try {
      const res = await fetch(`/api/batches/${batchId}/costs?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(costData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao adicionar custo');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Biometry to Batch
  const handleAddBiometry = async (batchId: string, biometryData: any) => {
    try {
      const res = await fetch(`/api/batches/${batchId}/biometrics?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(biometryData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao registrar biometria');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Water Measurement
  const handleAddWaterMeasurement = async (measurementData: Partial<WaterMeasurement>) => {
    try {
      const res = await fetch(`/api/water-measurements?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(measurementData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao registrar medição de água');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Update Incident Status
  const handleUpdateIncidentStatus = async (id: string, status: Incident['status'], notes?: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}/status?env=${currentEnv}`, {
        method: 'PATCH',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ status, resolutionNotes: notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao atualizar status do incidente');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Reserve Sales Order
  const handleReserveOrder = async (orderData: any) => {
    try {
      const res = await fetch(`/api/orders/reserve?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(orderData),
      });
      const data = await res.json();
      await fetchState();
      return data;
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Erro de comunicação ao reservar pedido' };
    }
  };

  // Record Payment on Receivable
  const handleRecordPayment = async (billId: string, amount: number) => {
    try {
      const res = await fetch(`/api/receivables/${billId}/payment?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao registrar pagamento');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Dispute on Receivable
  const handleToggleDispute = async (billId: string) => {
    try {
      const res = await fetch(`/api/receivables/${billId}/dispute?env=${currentEnv}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao atualizar disputa comercial');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Real Document Upload up to 100.000.000 bytes
  const handleUploadDocument = async (file: File, meta: any) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', meta.category || 'NOTA_FISCAL');
    if (meta.batchId) formData.append('batchId', meta.batchId);

    const res = await fetch(`/api/documents/upload?env=${currentEnv}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha no upload' }));
      throw new Error(err.error || `Falha no upload (${res.status})`);
    }

    await fetchState();
  };

  // Extract Draft using Gemini
  const handleExtractDraft = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/extract-draft?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Falha ao extrair rascunho');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Reprocess Document Blocks (Page by Page)
  const handleReprocessDocument = async (docId: string) => {
    const res = await fetch(`/api/documents/${docId}/reprocess?env=${currentEnv}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao reprocessar blocos');
    }
    await fetchState();
  };

  // Confirm Draft to Batch
  const handleConfirmDraftToBatch = async (docId: string, targetBatchId: string, options?: any) => {
    try {
      const res = await fetch(`/api/documents/${docId}/confirm-to-batch?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          targetBatchId,
          manualTotal: options?.manualTotal,
          manualItems: options?.manualItems,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Falha ao confirmar gastos no lote');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Agent Analyze Document
  const handleAgentAnalyzeDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/agent-analyze?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Falha na análise do agente.');
      }
      await fetchState();
      return data;
    } catch (err: any) {
      console.error(err);
      alert('Erro de comunicação com o Agente.');
    }
  };

  // Agent Approve Document (1-Click)
  const handleAgentApproveDocument = async (docId: string, targetBatchId?: string, items?: any[]) => {
    try {
      const res = await fetch(`/api/documents/${docId}/agent-approve?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ targetBatchId, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Falha ao aprovar lançamento do agente.');
      } else {
        alert(data.message || 'Documento aprovado e lançado com sucesso!');
      }
      await fetchState();
      return data;
    } catch (err: any) {
      console.error(err);
      alert('Erro ao confirmar aprovação.');
    }
  };

  // Import Spreadsheet Rows
  const handleImportSpreadsheetRows = async (
    entityType: string,
    rows: any[],
    fileName: string,
    batchId: string
  ) => {
    try {
      const res = await fetch(`/api/spreadsheets/import?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          entityType,
          rows,
          fileName,
          targetBatchId: batchId,
          batchId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao importar planilha' }));
        alert(err.error || 'Erro ao importar planilha');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Rollback Import
  const handleRollbackImport = async (importBatchId: string) => {
    try {
      const res = await fetch(`/api/spreadsheets/rollback/${importBatchId}?env=${currentEnv}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao reverter importação');
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Action Handler from Overview
  const handleQuickAction = (action: 'cost' | 'production' | 'import' | 'report') => {
    if (action === 'cost') setActiveTab('costs');
    else if (action === 'production') setActiveTab('production');
    else if (action === 'import') setActiveTab('documents');
    else if (action === 'report') setActiveTab('reports');
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#17323A] flex flex-col font-sans">
      {/* Persistent Header */}
      <Header
        currentEnv={currentEnv}
        company={company}
        currentRole={currentRole}
        onChangeRole={(r) => setCurrentRole(r)}
        onSwitchEnvClick={(env) => setSwitchConfirmModal(env)}
        onResetDemoClick={() => setResetConfirmModal(true)}
        onClearAllClick={() => setClearAllConfirmModal(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenTestSuite={() => setIsTestSuiteOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        authenticatedUser={
          authenticatedUser
            ? {
                name: authenticatedUser.userName,
                email: authenticatedUser.userEmail,
                role: authenticatedUser.role,
              }
            : null
        }
        onLogout={handleLogout}
      />

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 gap-6">
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onQuickAction={handleQuickAction}
          batchesCount={batches.length}
          openIncidentsCount={incidents.filter((i) => i.status !== 'RESOLVIDO').length}
          pendingDocsCount={documents.filter((d) => d.status === 'AGUARDANDO_CONFERENCIA').length}
        />

        {/* Content View Area */}
        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#167D8D]" />
              <span>Sincronizando dados certificados...</span>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  batches={batches}
                  waterMeasurements={waterMeasurements}
                  incidents={incidents}
                  inventory={inventory}
                  receivables={receivables}
                  company={company}
                  currentEnv={currentEnv}
                  onNavigate={(tab) => {
                    if (tab === 'costs_inventory' || tab === 'costs') setActiveTab('costs');
                    else if (tab === 'sales_receivables' || tab === 'sales') setActiveTab('sales');
                    else if (tab === 'production') setActiveTab('production');
                    else if (tab === 'documents') setActiveTab('documents');
                    else if (tab === 'reports') setActiveTab('reports');
                    else setActiveTab('overview');
                  }}
                  onQuickAction={handleQuickAction}
                  onOpenBatchDetail={() => setActiveTab('production')}
                  onOpenIncidentDetails={() => setActiveTab('production')}
                />
              )}

              {activeTab === 'production' && (
                <ProductionView
                  batches={batches}
                  waterMeasurements={waterMeasurements}
                  incidents={incidents}
                  company={company}
                  onAddBatch={handleAddBatch}
                  onAddMeasurement={handleAddWaterMeasurement}
                  onUpdateIncidentStatus={handleUpdateIncidentStatus}
                  onAddBiometry={handleAddBiometry}
                />
              )}

              {activeTab === 'costs' && (
                <CostsInventoryView
                  batches={batches}
                  inventory={inventory}
                  onAddCostToBatch={handleAddCostToBatch}
                  onQuickAction={handleQuickAction}
                />
              )}

              {activeTab === 'sales' && (
                <SalesReceivablesView
                  orders={salesOrders}
                  receivables={receivables}
                  batches={batches}
                  onReserveOrder={handleReserveOrder}
                  onRecordPayment={handleRecordPayment}
                  onToggleDispute={handleToggleDispute}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsImportView
                  documents={documents}
                  batches={batches}
                  company={company}
                  onUploadDocument={handleUploadDocument}
                  onExtractDraft={handleExtractDraft}
                  onReprocessDocument={handleReprocessDocument}
                  onConfirmDraftToBatch={handleConfirmDraftToBatch}
                  onImportSpreadsheetRows={handleImportSpreadsheetRows}
                  onRollbackImport={handleRollbackImport}
                  onAgentAnalyze={handleAgentAnalyzeDocument}
                  onAgentApprove={handleAgentApproveDocument}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  batches={batches}
                  company={company}
                  currentEnv={currentEnv}
                />
              )}

              {activeTab === 'market' && (
                <NordesteMarketTab batches={batches} />
              )}
            </>
          )}
        </main>
      </div>

      {/* AI Assistant Modal */}
      <AssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentEnv={currentEnv}
        currentRole={currentRole}
        companyId={company.id}
        unit={company.activeUnit}
      />

      {/* 17 Automated Tests Acceptance Suite Modal */}
      <TestSuiteModal
        isOpen={isTestSuiteOpen}
        onClose={() => setIsTestSuiteOpen(false)}
        onRefreshData={fetchState}
      />

      {/* Confirmation Modal: Switch Environment */}
      {switchConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-2.5 text-[#123B45] mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-base">Alternar Ambiente de Operação</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Você está prestes a alternar para o ambiente{' '}
              <strong>{switchConfirmModal === 'real' ? 'Minha Empresa (Real)' : 'Demonstração'}</strong>.
              <br />
              <br />
              <span className="text-teal-900 font-semibold">
                Os dados são estritamente segregados no servidor. Os dados da demonstração nunca se misturam com as transações da sua empresa.
              </span>
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSwitchConfirmModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSwitchEnv(switchConfirmModal)}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded-lg shadow-sm transition-colors"
              >
                Confirmar e Alternar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Demo */}
      {resetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-2.5 text-[#123B45] mb-2">
              <RefreshCw className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-base">Restaurar Cenário de Demonstração</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Deseja redefinir os dados da demonstração para o estado original da especificação (DEMO-A, Tanque 02 com 3,2 mg/L, Tanque 03 atrasado, estoque de 3 dias, etc.)?
              <br />
              <br />
              Seus dados reais da empresa não serão afetados.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setResetConfirmModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetDemo}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Restaurar Demonstração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Operational Data Confirmation Modal */}
      <ClearDataModal
        isOpen={clearAllConfirmModal}
        onClose={() => setClearAllConfirmModal(false)}
        onConfirm={handleClearAllData}
        currentEnv={currentEnv}
      />

      {/* Secure Server Login Modal for Minha Empresa */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
