import React from 'react';
import {
  BarChart3,
  Building2,
  Calculator,
  History,
  Layers,
  Plus,
  Sliders,
  Truck,
  Zap,
} from 'lucide-react';
import { GeneralSettings } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sellingPrice: number;
  buyingPrice: number;
  pat: number;
  marginPct: number;
  netProfitWithTds?: number;
  pctProfitAfterTds?: number;
  generalSettings: GeneralSettings;
  onDownloadAndroidZip?: () => void;
  onOpenCompanyProfilesModal?: () => void;
  activeClientName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  sellingPrice,
  buyingPrice,
  pat,
  marginPct,
  netProfitWithTds,
  pctProfitAfterTds,
  generalSettings,
  onOpenCompanyProfilesModal,
  activeClientName,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Trip Pricing', icon: Layers },
    { id: 'quick', label: 'Quick Calc', icon: Zap },
    { id: 'details', label: 'Detailed Breakdown', icon: Calculator },
    { id: 'scenarios', label: 'What-If Scenarios', icon: BarChart3 },
    { id: 'settings', label: 'Engine Settings', icon: Sliders },
    { id: 'history', label: 'History & Reports', icon: History },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md">
      {/* Top bar with quick numbers & Add Client */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Title */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-md">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black text-white leading-tight flex items-center gap-2">
                <span>Freight Profit Engine</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                  Financial Suite
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Live Freight Tax & Interest Computation
              </div>
            </div>
          </div>

          {/* Quick Active Trip Ticker */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/80 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">SP:</span>
              <span className="font-bold text-white font-mono">
                {generalSettings.currencySymbol}{sellingPrice.toLocaleString()}
              </span>
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">BP:</span>
              <span className="font-bold text-slate-300 font-mono">
                {generalSettings.currencySymbol}{buyingPrice.toLocaleString()}
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">PAT:</span>
              <span
                className={`font-black font-mono ${
                  pat >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {generalSettings.currencySymbol}{pat.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-cyan-300 font-bold font-mono">
                ({marginPct.toFixed(2)}%)
              </span>
            </div>
            {netProfitWithTds !== undefined && pctProfitAfterTds !== undefined && (
              <>
                <span className="text-slate-600">|</span>
                <div className="flex items-center gap-1.5" title="Net Profit = Profit After Tax + Net Saving in TDS">
                  <span className="text-slate-400">Net:</span>
                  <span
                    className={`font-black font-mono ${
                      netProfitWithTds >= 0 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {generalSettings.currencySymbol}{netProfitWithTds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Top Actions: Add Client / Company Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenCompanyProfilesModal && (
              <button
                type="button"
                onClick={onOpenCompanyProfilesModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
                title="Manage Client Company Profiles & Engine Settings"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clients & Engine Profiles</span>
                <span className="sm:hidden">Clients</span>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-950 text-amber-400 text-[10px] font-bold">
                  +
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex space-x-1 overflow-x-auto py-2 no-scrollbar border-t border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
