import React, { useState } from 'react';
import {
  SalesOrder,
  ReceivableBill,
  Batch,
} from '../types';
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatDateBR,
  calculateContributionMargin,
  checkReceivableBill,
} from '../utils/calculations';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Lock,
  MessageSquare,
  HelpCircle,
  FileCheck2,
  Info,
} from 'lucide-react';

interface SalesReceivablesViewProps {
  orders: SalesOrder[];
  receivables: ReceivableBill[];
  batches: Batch[];
  onReserveOrder: (orderData: any) => Promise<any>;
  onRecordPayment: (billId: string, amount: number) => void;
  onToggleDispute: (billId: string) => void;
}

export const SalesReceivablesView: React.FC<SalesReceivablesViewProps> = ({
  orders,
  receivables,
  batches,
  onReserveOrder,
  onRecordPayment,
  onToggleDispute,
}) => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'titulos'>('pedidos');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<ReceivableBill | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);

  // Form for new order
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    batchId: batches.length > 0 ? batches[0].id : '',
    quantity: '400',
    unitPrice: '36.0',
    variableCostPerUnit: '18.0',
    freightCost: '350.0',
    taxRate: '8.0',
  });

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#167D8D]" />
            <h2 className="text-xl font-bold text-[#17323A]">
              Vendas, Margem e Contas a Receber
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Reservas atômicas de estoque liberado, margem de contribuição e conciliação de recebíveis.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'pedidos'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pedidos e Reservas ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('titulos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'titulos'
                ? 'bg-white text-[#123B45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Contas a Receber ({receivables.length})
          </button>
        </div>
      </div>

      {/* TAB 1: PEDIDOS E RESERVAS */}
      {activeTab === 'pedidos' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#17323A]">
                Pedidos de Venda e Checagem de Estoque
              </h3>
              <p className="text-xs text-slate-500">
                Produção prevista não vira estoque liberado. Reserva atômica exige saldo físico conferido.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowNewOrderModal(true);
                setReservationNotice(null);
              }}
              className="px-3 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Simular Novo Pedido</span>
            </button>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {orders.map((o) => {
              const margin = calculateContributionMargin(o);
              return (
                <div
                  key={o.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs transition-all ${
                    o.status === 'RESERVADO'
                      ? 'border-teal-200'
                      : o.status === 'EM_REVISAO'
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-800">
                        {o.orderNumber}
                      </span>
                      <h4 className="text-sm font-bold text-[#17323A]">
                        {o.customerName}
                      </h4>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        o.status === 'RESERVADO'
                          ? 'bg-teal-100 text-teal-900'
                          : o.status === 'EM_REVISAO'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {o.status === 'RESERVADO' ? 'Reserva Efetuada' : 'Em Revisão Comercial'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-3">
                    Produto: <strong>{o.productName}</strong> | Quantidade solicitada:{' '}
                    <strong>{formatNumberBR(o.quantity, 0)} {o.commercialUnit}</strong> a{' '}
                    <strong>{formatCurrencyBRL(o.unitPrice)}/{o.commercialUnit}</strong>
                  </p>

                  {/* Financial Breakdown: Contribution Margin Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F8F7] p-3 rounded-lg border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Receita Bruta</span>
                      <span className="text-sm font-bold text-[#17323A] font-mono">
                        {formatCurrencyBRL(margin.grossRevenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Custos Variáveis</span>
                      <span className="text-sm font-bold text-slate-700 font-mono">
                        - {formatCurrencyBRL(margin.totalVariableCost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Frete + Tributos (8%)</span>
                      <span className="text-sm font-bold text-slate-700 font-mono">
                        - {formatCurrencyBRL(margin.freightCost + margin.taxesAndCommission)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Margem de Contribuição</span>
                      <span className="text-sm font-bold text-[#167D8D] font-mono">
                        {formatCurrencyBRL(margin.contributionMargin)} ({margin.contributionMarginPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Reservation Note & Disclaimer */}
                  <div className="mt-3 pt-2 border-t border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-600">
                      <strong>Status de Estoque:</strong> {o.reservationNotes || 'Sem observações.'}
                    </span>
                    <span className="text-[11px] text-slate-500 italic">
                      * A margem de contribuição deste pedido não é o lucro líquido do lote.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CONTAS A RECEBER */}
      {activeTab === 'titulos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#17323A]">
                  Títulos Financeiros e Recebimentos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Regra estrita: Títulos quitados, não conciliados ou em disputa NUNCA geram cobrança.
                </p>
              </div>

              {/* Status Integrations Note */}
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Integrações Bancárias / WhatsApp: <strong>Não conectado</strong></span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {receivables.map((r) => {
                const check = checkReceivableBill(r);
                return (
                  <div key={r.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs font-mono">
                          NF
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#17323A]">{r.customerName}</h4>
                          <span className="text-xs text-slate-500 font-mono">
                            Fatura: {r.invoiceCode} | Vencimento: {r.dueDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.hasActiveDispute ? (
                          <span className="px-2.5 py-1 rounded bg-red-100 text-red-900 font-bold text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Em Disputa Comercial
                          </span>
                        ) : check.balanceRemaining === 0 ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            Integralmente Pago
                          </span>
                        ) : check.isOverdue ? (
                          <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            Vencido há {check.daysOverdue} dias
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-bold text-xs">
                            A Vencer
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Numeric Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F8F7] p-3 rounded-lg border border-slate-200 text-xs mt-3">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Valor Original</span>
                        <span className="text-sm font-bold text-[#17323A] font-mono">
                          {formatCurrencyBRL(r.originalAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Valor Já Recebido</span>
                        <span className="text-sm font-bold text-emerald-700 font-mono">
                          {formatCurrencyBRL(r.receivedAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Saldo em Aberto</span>
                        <span className="text-sm font-bold text-[#123B45] font-mono">
                          {formatCurrencyBRL(check.balanceRemaining)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Crédito Excedente</span>
                        <span className="text-sm font-bold text-slate-600 font-mono">
                          {formatCurrencyBRL(check.overpaymentCredit)}
                        </span>
                      </div>
                    </div>

                    {/* Collection Status Directive */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="text-slate-700">
                        <strong>Diretriz de Cobrança:</strong> {check.collectionStatusText}
                      </span>

                      <div className="flex items-center gap-2">
                        {check.balanceRemaining > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBillForPayment(r);
                              setPaymentAmountInput('');
                            }}
                            className="px-3 py-1 bg-[#123B45] hover:bg-[#167D8D] text-white font-bold rounded text-xs transition-colors"
                          >
                            Registrar Recebimento
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleDispute(r.id)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition-colors"
                        >
                          {r.hasActiveDispute ? 'Remover Disputa' : 'Sinalizar Disputa'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Simular Novo Pedido (Atomic Check Test) */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-[#17323A] mb-2">
              Lançar Pedido e Reservar Estoque
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              O sistema verifica em tempo real o saldo liberado e bloqueia pedidos concorrentes excedentes.
            </p>

            {reservationNotice && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {reservationNotice}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cliente</label>
                <input
                  type="text"
                  placeholder="Ex: Rede de Restaurantes Salvador"
                  value={orderForm.customerName}
                  onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Lote de Origem</label>
                  <select
                    value={orderForm.batchId}
                    onChange={(e) => setOrderForm({ ...orderForm, batchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} ({b.sellableQuantity} {b.sellableUnit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Quantidade (kg)</label>
                  <input
                    type="number"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preço Venda (R$/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={orderForm.unitPrice}
                    onChange={(e) => setOrderForm({ ...orderForm, unitPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Custo Variável (R$/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={orderForm.variableCostPerUnit}
                    onChange={(e) => setOrderForm({ ...orderForm, variableCostPerUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await onReserveOrder({
                    customerName: orderForm.customerName || 'Cliente Exemplo',
                    batchId: orderForm.batchId,
                    quantityRequested: Number(orderForm.quantity),
                    unitPrice: Number(orderForm.unitPrice),
                    variableCostPerUnit: Number(orderForm.variableCostPerUnit),
                    freightCost: Number(orderForm.freightCost),
                    taxRate: Number(orderForm.taxRate),
                  });
                  if (res && !res.success) {
                    setReservationNotice(
                      `Atenção: Saldo liberado restante (${res.availableStockRemaining} kg) insuficiente para reservar ${orderForm.quantity} kg. O pedido foi gravado com status "EM_REVISAO".`
                    );
                  } else {
                    setShowNewOrderModal(false);
                  }
                }}
                className="px-4 py-2 bg-[#123B45] hover:bg-[#167D8D] text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Pagamento de Título */}
      {selectedBillForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-[#17323A] mb-1">
              Registrar Recebimento
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Título {selectedBillForPayment.invoiceCode} ({selectedBillForPayment.customerName})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Valor do Pagamento (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 6000.00"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 font-mono text-sm font-bold"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedBillForPayment(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = Number(paymentAmountInput);
                  if (val > 0) {
                    onRecordPayment(selectedBillForPayment.id, val);
                    setSelectedBillForPayment(null);
                  }
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
              >
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
