import React from 'react';
import {
  LayoutDashboard,
  Fish,
  DollarSign,
  TrendingUp,
  FileText,
  UploadCloud,
  PlusCircle,
  Compass,
} from 'lucide-react';
import { NavigationTab, MainNavView } from '../types';

export interface SidebarProps {
  activeTab?: NavigationTab | MainNavView;
  activeView?: NavigationTab | MainNavView;
  onSelectTab?: (tab: NavigationTab) => void;
  onSelectView?: (view: MainNavView) => void;
  onQuickAction?: (action: 'cost' | 'production' | 'import' | 'report') => void;
  batchesCount?: number;
  openIncidentsCount?: number;
  openReceivablesCount?: number;
  pendingDocsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeView,
  onSelectTab,
  onSelectView,
  onQuickAction,
  batchesCount = 0,
  openIncidentsCount = 0,
  openReceivablesCount = 0,
  pendingDocsCount = 0,
}) => {
  // Resolve current active tab across both prop naming conventions
  const currentKey = activeTab || activeView || 'overview';

  // Normalize any key to a canonical NavigationTab
  const normalizeToTab = (key: string): NavigationTab => {
    if (key === 'costs_inventory' || key === 'costs') return 'costs';
    if (key === 'sales_receivables' || key === 'sales') return 'sales';
    if (key === 'documents_import' || key === 'documents') return 'documents';
    if (key === 'production') return 'production';
    if (key === 'reports') return 'reports';
    if (key === 'market') return 'market';
    return 'overview';
  };

  const activeNormalized = normalizeToTab(currentKey);

  // Safe handler that calls both onSelectTab and onSelectView without throwing
  const handleNavClick = (viewId: MainNavView) => {
    const mappedTab = normalizeToTab(viewId);
    if (typeof onSelectTab === 'function') {
      onSelectTab(mappedTab);
    }
    if (typeof onSelectView === 'function') {
      onSelectView(viewId);
    }
  };

  const handleAction = (action: 'cost' | 'production' | 'import' | 'report') => {
    if (typeof onQuickAction === 'function') {
      onQuickAction(action);
    } else {
      if (action === 'cost') handleNavClick('costs');
      else if (action === 'production') handleNavClick('production');
      else if (action === 'import') handleNavClick('documents');
      else if (action === 'report') handleNavClick('reports');
    }
  };

  const navItems = [
    {
      id: 'overview' as MainNavView,
      canonicalTab: 'overview' as NavigationTab,
      label: 'Visão Geral',
      icon: LayoutDashboard,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : null,
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      id: 'production' as MainNavView,
      canonicalTab: 'production' as NavigationTab,
      label: 'Produção',
      icon: Fish,
      badge: batchesCount > 0 ? `${batchesCount}` : null,
      badgeColor: 'bg-teal-700 text-white',
    },
    {
      id: 'costs' as MainNavView,
      canonicalTab: 'costs' as NavigationTab,
      label: 'Custos e Estoque',
      icon: DollarSign,
    },
    {
      id: 'sales' as MainNavView,
      canonicalTab: 'sales' as NavigationTab,
      label: 'Vendas e Recebíveis',
      icon: TrendingUp,
      badge: openReceivablesCount > 0 ? `${openReceivablesCount}` : null,
      badgeColor: 'bg-teal-700 text-white',
    },
    {
      id: 'documents' as MainNavView,
      canonicalTab: 'documents' as NavigationTab,
      label: 'Documentos e Importação',
      icon: UploadCloud,
      badge: pendingDocsCount > 0 ? `${pendingDocsCount}` : null,
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      id: 'reports' as MainNavView,
      canonicalTab: 'reports' as NavigationTab,
      label: 'Relatórios e Retorno',
      icon: FileText,
    },
    {
      id: 'market' as MainNavView,
      canonicalTab: 'market' as NavigationTab,
      label: 'Mercado & Clima NE',
      icon: Compass,
      badge: 'Regional',
      badgeColor: 'bg-[#167D8D] text-white',
    },
  ];

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 rounded-xl min-h-[calc(100vh-140px)] p-4 shadow-sm flex-shrink-0">
        <div className="mb-4">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Menu Operacional
          </span>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNormalized === item.canonicalTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#123B45] text-white font-semibold shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-teal-300' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-teal-400 text-slate-950' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Direct Actions Box */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block mb-2">
            Ações Rápidas
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleAction('cost')}
              className="px-2.5 py-2 bg-[#F6F8F7] hover:bg-teal-50 text-[#123B45] text-xs font-semibold rounded-md border border-slate-200 hover:border-teal-300 transition-colors text-center cursor-pointer"
            >
              + Gasto
            </button>
            <button
              type="button"
              onClick={() => handleAction('production')}
              className="px-2.5 py-2 bg-[#F6F8F7] hover:bg-teal-50 text-[#123B45] text-xs font-semibold rounded-md border border-slate-200 hover:border-teal-300 transition-colors text-center cursor-pointer"
            >
              + Produção
            </button>
            <button
              type="button"
              onClick={() => handleAction('import')}
              className="px-2.5 py-2 bg-[#F6F8F7] hover:bg-teal-50 text-[#123B45] text-xs font-semibold rounded-md border border-slate-200 hover:border-teal-300 transition-colors text-center cursor-pointer"
            >
              Importar
            </button>
            <button
              type="button"
              onClick={() => handleAction('report')}
              className="px-2.5 py-2 bg-[#F6F8F7] hover:bg-teal-50 text-[#123B45] text-xs font-semibold rounded-md border border-slate-200 hover:border-teal-300 transition-colors text-center cursor-pointer"
            >
              Relatório
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (Visible on mobile < 768px, >= 44px touch targets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-3 py-1 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => handleNavClick('overview')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 text-xs cursor-pointer ${
            activeNormalized === 'overview' ? 'text-[#167D8D] font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Início</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('production')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 text-xs relative cursor-pointer ${
            activeNormalized === 'production' ? 'text-[#167D8D] font-bold' : 'text-slate-500'
          }`}
        >
          <Fish className="w-5 h-5 mb-0.5" />
          <span>Produção</span>
          {openIncidentsCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 bg-red-600 rounded-full" />
          )}
        </button>

        {/* Central Plus / Action */}
        <button
          type="button"
          onClick={() => handleAction('cost')}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] -mt-4 bg-[#123B45] text-white rounded-full p-2.5 shadow-md border-2 border-white active:scale-95 cursor-pointer"
          title="Registrar novo gasto ou produção"
        >
          <PlusCircle className="w-6 h-6 text-teal-300" />
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('costs')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 text-xs cursor-pointer ${
            activeNormalized === 'costs' ? 'text-[#167D8D] font-bold' : 'text-slate-500'
          }`}
        >
          <DollarSign className="w-5 h-5 mb-0.5" />
          <span>Custos</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('documents')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 text-xs cursor-pointer ${
            activeNormalized === 'documents' ? 'text-[#167D8D] font-bold' : 'text-slate-500'
          }`}
        >
          <UploadCloud className="w-5 h-5 mb-0.5" />
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
};
