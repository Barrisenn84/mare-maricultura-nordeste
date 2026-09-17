import React, { useState } from 'react';
import {
  EnvironmentMode,
  UserRole,
  CompanyConfig,
} from '../types';
import {
  Waves,
  Sparkles,
  HelpCircle,
  Building2,
  Clock,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Eraser,
  Smartphone,
} from 'lucide-react';

export interface HeaderProps {
  currentEnv: EnvironmentMode;
  company?: CompanyConfig;
  currentRole?: UserRole;
  onChangeRole?: (role: UserRole) => void;
  onSwitchEnvClick?: (env: EnvironmentMode) => void;
  onSwitchEnv?: (env: EnvironmentMode) => void;
  onResetDemoClick?: () => void;
  onClearAllClick?: () => void;
  onOpenAssistant?: () => void;
  onOpenAi?: () => void;
  onOpenTestSuite?: () => void;
  onOpenTour?: () => void;
  activeView?: string;
  authenticatedUser?: { name: string; email: string; role: UserRole } | null;
  onLogout?: () => void;
  onOpenLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentEnv,
  company,
  currentRole,
  onChangeRole,
  onSwitchEnvClick,
  onSwitchEnv,
  onResetDemoClick,
  onClearAllClick,
  onOpenAssistant,
  onOpenAi,
  onOpenTestSuite,
  onOpenTour,
  authenticatedUser,
  onLogout,
  onOpenLogin,
}) => {
  const [internalRole, setInternalRole] = useState<UserRole>('PROPRIETARIO');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('Para instalar o app Maré no seu celular ou computador:\n\n1. No Android/Chrome: Toque nos 3 pontinhos do navegador e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".\n2. No iPhone (iOS/Safari): Toque no botão de Compartilhar e selecione "Adicionar à Tela de Início".');
    }
  };

  const activeRole = currentRole || internalRole;

  const handleRoleChange = (newRole: UserRole) => {
    setInternalRole(newRole);
    if (onChangeRole) {
      onChangeRole(newRole);
    }
  };

  const handleSwitch = (env: EnvironmentMode) => {
    if (onSwitchEnvClick) {
      onSwitchEnvClick(env);
    } else if (onSwitchEnv) {
      onSwitchEnv(env);
    }
  };

  const handleOpenAi = () => {
    if (onOpenAssistant) {
      onOpenAssistant();
    } else if (onOpenAi) {
      onOpenAi();
    }
  };

  const modalityText = company?.modality === 'AMBAS'
    ? 'Engorda e Larvicultura'
    : (company?.modality || 'Engorda e Larvicultura');

  return (
    <header className="sticky top-0 z-30 bg-[#123B45] text-white border-b border-[#167D8D]/30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#167D8D] flex items-center justify-center text-white shadow-inner flex-shrink-0">
            <Waves className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                Maré
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-[#167D8D]/40 text-teal-100 font-medium border border-teal-500/20">
                {company?.legalName || company?.name || 'Maricultura Nordeste Ltda.'}
              </span>
            </div>
            <p className="text-xs text-teal-100/70 hidden sm:block mt-0.5">
              Gestão aquícola de camarão • {modalityText}
            </p>
          </div>
        </div>

        {/* Center: Environment Switcher with Clear Visual Notice */}
        <div className="flex items-center gap-2 bg-[#0E2F37] p-1 rounded-lg border border-teal-700/30">
          <button
            type="button"
            onClick={() => handleSwitch('demo')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              currentEnv === 'demo'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-teal-200 hover:text-white'
            }`}
            title="Demonstração com dados fictícios e relógio fixo"
          >
            <span className={`w-2 h-2 rounded-full ${currentEnv === 'demo' ? 'bg-slate-900 animate-pulse' : 'bg-amber-400'}`} />
            Demonstração (Fictícia)
          </button>

          <button
            type="button"
            onClick={() => handleSwitch('real')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              currentEnv === 'real'
                ? 'bg-[#167D8D] text-white shadow-sm'
                : 'text-teal-200 hover:text-white'
            }`}
            title="Ambiente isolado da sua empresa (sem registros fictícios)"
          >
            <Building2 className="w-3.5 h-3.5" />
            Minha empresa
          </button>
        </div>

        {/* Right Actions: Clock, Reset Demo, Test Suite, Role, AI */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Reference Clock */}
          {currentEnv === 'demo' && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0E2F37]/80 text-amber-200/90 text-xs border border-amber-500/20 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>16/09/2026 12:00 BRT</span>
            </div>
          )}

          {/* Reset Demo Button */}
          {currentEnv === 'demo' && onResetDemoClick && (
            <button
              type="button"
              onClick={onResetDemoClick}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-medium border border-amber-500/30 transition-colors cursor-pointer"
              title="Restaurar dados originais da demonstração"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Restaurar Demo</span>
            </button>
          )}

          {/* Clear Everything / Zero All Fields Button (Both Demo and Real modes) */}
          {onClearAllClick && (
            <button
              type="button"
              onClick={onClearAllClick}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 hover:text-white text-xs font-semibold border border-rose-500/40 transition-colors cursor-pointer"
              title="Limpar e zerar todos os campos para inserção de novos dados"
            >
              <Eraser className="w-3.5 h-3.5 text-rose-300" />
              <span>Limpar Tudo (Zerar)</span>
            </button>
          )}

          {/* Automated Test Suite Button */}
          {onOpenTestSuite && (
            <button
              type="button"
              onClick={onOpenTestSuite}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-900/60 hover:bg-teal-800/80 text-teal-200 text-xs font-semibold border border-teal-500/30 transition-colors cursor-pointer"
              title="Abrir matriz dos 21 testes de homologação técnicos"
            >
              <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">21 Testes de Homologação</span>
            </button>
          )}

          {/* Role selector for RBAC preview or Authenticated User display */}
          {currentEnv === 'demo' ? (
            <div className="flex items-center gap-1 text-xs text-teal-200 bg-[#0E2F37] px-2 py-1 rounded border border-teal-700/30">
              <UserCheck className="w-3.5 h-3.5 text-teal-400 hidden sm:inline" />
              <select
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="bg-transparent text-teal-100 text-xs font-medium focus:outline-none cursor-pointer"
                title="Alternar perfil de acesso para simulação de permissões"
              >
                <option value="PROPRIETARIO" className="bg-[#123B45] text-white">Proprietário</option>
                <option value="GERENTE" className="bg-[#123B45] text-white">Gerente</option>
                <option value="PRODUCAO" className="bg-[#123B45] text-white">Produção</option>
                <option value="FINANCEIRO" className="bg-[#123B45] text-white">Financeiro</option>
                <option value="COMERCIAL" className="bg-[#123B45] text-white">Comercial</option>
                <option value="CONSULTA" className="bg-[#123B45] text-white">Consulta</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {authenticatedUser ? (
                <div className="flex items-center gap-2 bg-[#0E2F37] px-2.5 py-1 rounded border border-teal-600/40 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-white leading-tight">{authenticatedUser.name}</span>
                    <span className="text-[10px] text-teal-300 uppercase leading-none">{authenticatedUser.role}</span>
                  </div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="ml-1 text-[11px] text-teal-300 hover:text-white underline cursor-pointer"
                      title="Encerrar sessão segura"
                    >
                      Sair
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/40 transition-colors cursor-pointer"
                  title="Clique para fazer login ou registrar-se com Google ou E-mail"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Entrar / Cadastrar</span>
                </button>
              )}
            </div>
          )}

          {/* Install PWA Mobile App Button */}
          <button
            type="button"
            onClick={handleInstallPWA}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-teal-800/80 hover:bg-teal-700 text-teal-100 hover:text-white text-xs font-semibold border border-teal-500/40 transition-all cursor-pointer shadow-xs"
            title="Instalar Maré como aplicativo no celular ou computador (PWA / Android / iOS)"
          >
            <Smartphone className="w-3.5 h-3.5 text-teal-300" />
            <span className="hidden md:inline">Instalar App</span>
          </button>

          {/* Quick Tour Button */}
          {onOpenTour && (
            <button
              type="button"
              onClick={onOpenTour}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 text-xs font-medium border border-teal-600/30 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">Conhecer em 3 min</span>
            </button>
          )}

          {/* AI Assistant Button */}
          <button
            type="button"
            onClick={handleOpenAi}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold shadow transition-all transform active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Perguntar sobre meus dados</span>
          </button>
        </div>
      </div>

      {/* Persistent Environment Notice Banner */}
      {currentEnv === 'demo' ? (
        <div className="bg-amber-500/10 border-t border-b border-amber-500/20 px-4 py-1 text-center text-xs text-amber-200 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>
            <strong>Ambiente Demonstração:</strong> Todos os registros e valores são fictícios, reprodutíveis e fixados em 16/09/2026.
          </span>
        </div>
      ) : (
        <div className="bg-teal-500/10 border-t border-b border-teal-500/20 px-4 py-1 text-center text-xs text-teal-200 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
          <span>
            <strong>Ambiente Minha Empresa:</strong> Base de dados isolada no servidor. Sem registros simulados.
          </span>
        </div>
      )}
    </header>
  );
};
