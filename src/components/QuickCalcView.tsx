import React from 'react';
import {
  ArrowRight,
  Calculator,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  DollarSign,
  Percent,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  CalculationInput,
  CalculationResult,
  GeneralSettings,
} from '../types';
import { formatCurrency, formatPercent } from '../services/calculationEngine';

interface QuickCalcViewProps {
  input: CalculationInput;
  setInput: React.Dispatch<React.SetStateAction<CalculationInput>>;
  result: CalculationResult;
  generalSettings: GeneralSettings;
  onNavigateTab: (tab: string) => void;
}

export const QuickCalcView: React.FC<QuickCalcViewProps> = ({
  input,
  setInput,
  result,
  generalSettings,
  onNavigateTab,
}) => {
  const handleSellingChange = (val: number) => {
    setInput((prev) => ({ ...prev, sellingPrice: val }));
  };

  const handleBuyingChange = (val: number) => {
    setInput((prev) => ({ ...prev, buyingPrice: val }));
  };

  const quickPresets = [
    { label: 'Standard ₹50k', sp: 50000, bp: 45000 },
    { label: 'Long Haul ₹75k', sp: 75000, bp: 69000 },
    { label: 'Container ₹1.2L', sp: 120000, bp: 110000 },
    { label: 'Local Trip ₹28k', sp: 28000, bp: 25000 },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 fill-blue-400" />
          <span>Mode 1 • Instant Quotation Engine</span>
        </div>
        <h1 className="text-2xl font-black text-white">
          Quick Freight Profit Calculator
        </h1>
        <p className="text-xs text-slate-400">
          Enter Selling & Buying Price to immediately evaluate gross margin, net expenses, tax, and bottom-line profit.
        </p>
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {quickPresets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              handleSellingChange(p.sp);
              handleBuyingChange(p.bp);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition active:scale-95"
          >
            {p.label} ({generalSettings.currencySymbol}{p.sp.toLocaleString()})
          </button>
        ))}
      </div>

      {/* Dual Big Input Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Selling Price */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between">
            <span>Selling Price (SP)</span>
            <span className="text-[10px] text-slate-400 font-normal">Customer Freight</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
              {generalSettings.currencySymbol}
            </span>
            <input
              id="quick-input-selling"
              type="number"
              step="100"
              min="0"
              value={input.sellingPrice || ''}
              onChange={(e) => handleSellingChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-600 focus:border-blue-500 rounded-xl pl-9 pr-3 py-3 text-2xl font-black text-white"
              placeholder="51500"
            />
          </div>
          <div className="flex gap-1.5 pt-1">
            {[+500, +1000, +5000].map((adj) => (
              <button
                key={adj}
                onClick={() => handleSellingChange((input.sellingPrice || 0) + adj)}
                className="px-2 py-1 bg-slate-700/60 hover:bg-slate-700 text-[10px] text-slate-300 rounded font-mono"
              >
                +{adj}
              </button>
            ))}
          </div>
        </div>

        {/* Buying Price */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Buying Price (BP)</span>
            <span className="text-[10px] text-slate-400 font-normal">Lorry Hire</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
              {generalSettings.currencySymbol}
            </span>
            <input
              id="quick-input-buying"
              type="number"
              step="100"
              min="0"
              value={input.buyingPrice || ''}
              onChange={(e) => handleBuyingChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-600 focus:border-blue-500 rounded-xl pl-9 pr-3 py-3 text-2xl font-black text-white"
              placeholder="48000"
            />
          </div>
          <div className="flex gap-1.5 pt-1">
            {[+500, +1000, +5000].map((adj) => (
              <button
                key={adj}
                onClick={() => handleBuyingChange((input.buyingPrice || 0) + adj)}
                className="px-2 py-1 bg-slate-700/60 hover:bg-slate-700 text-[10px] text-slate-300 rounded font-mono"
              >
                +{adj}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trip Dates & Credit Model (P&L Timing) */}
      <div className="bg-slate-800/90 border border-slate-700/90 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-700/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              Trip Timing & Credit Model
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Drives Credit Period Due Date & TDS Refund Period
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* LR Date */}
          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>LR Date</span>
              <span className="text-[10px] text-blue-400 font-normal">Trip Date</span>
            </label>
            <input
              type="date"
              value={input.lrDate || ''}
              onChange={(e) =>
                setInput((prev) => ({ ...prev, lrDate: e.target.value }))
              }
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          {/* Credit Period (Days) */}
          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300">
                Credit Period (Days)
              </label>
              <span className="text-[10px] font-mono text-amber-400 font-bold">
                {input.creditPeriodDays ?? 20}d
              </span>
            </div>
            <input
              type="number"
              min="0"
              max="365"
              value={input.creditPeriodDays ?? 20}
              onChange={(e) => {
                const days = Math.max(0, parseInt(e.target.value, 10) || 0);
                setInput((prev) => ({
                  ...prev,
                  creditPeriodDays: days,
                  customDays: days,
                }));
              }}
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold"
            />
            <div className="flex gap-1 pt-0.5">
              {[15, 20, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setInput((prev) => ({
                      ...prev,
                      creditPeriodDays: d,
                      customDays: d,
                    }))
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    (input.creditPeriodDays ?? 20) === d
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Credit Period Due Date (Auto-calculated) */}
          <div className="bg-slate-900/70 p-3 rounded-xl border border-blue-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">
                Credit Period Due Date
              </span>
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                Auto-calculated
              </span>
            </div>
            <div className="text-sm font-black text-cyan-300 font-mono py-1">
              {result.creditPeriodDueDate || '—'}
            </div>
            <p className="text-[10px] text-slate-400">
              LR Date + {input.creditPeriodDays ?? 20} Days
            </p>
          </div>

          {/* Financial Year End Date & TDS Refund Period */}
          <div className="bg-slate-900/70 p-3 rounded-xl border border-amber-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300">
                FY End Date
              </label>
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                Auto TDS Period
              </span>
            </div>
            <input
              type="date"
              value={input.financialYearEndDate || ''}
              onChange={(e) =>
                setInput((prev) => ({
                  ...prev,
                  financialYearEndDate: e.target.value,
                }))
              }
              className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
            <div className="pt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">TDS Refund Period:</span>
              <span className="font-mono font-bold text-amber-300">
                {result.tdsRefundPeriodMonths !== undefined
                  ? `${result.tdsRefundPeriodMonths} mos`
                  : '18 mos'}
              </span>
            </div>
          </div>
        </div>

        {/* Validation warning if FY End Date is before LR Date */}
        {input.lrDate &&
          input.financialYearEndDate &&
          input.financialYearEndDate < input.lrDate && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <span className="font-bold">⚠️ Warning:</span>
              <span>
                Financial Year End Date ({input.financialYearEndDate}) is earlier
                than LR Date ({input.lrDate}). TDS refund period clamped to 0 months.
              </span>
            </div>
          )}
      </div>

      {/* Main Bottom Line Results Hero Card */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700/90 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
          <div>
            <div className="text-xs text-slate-400">Final Profit After Tax (PAT)</div>
            <div
              className={`text-3xl sm:text-4xl font-black tracking-tight mt-1 ${
                result.profitAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Percentage of Sale</div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-300 mt-1">
              {formatPercent(result.percentageOfSale, 2)}
            </div>
          </div>
        </div>

        {/* Quick Row Results */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-slate-400">Gross Profit</div>
            <div className="text-sm font-bold text-white mt-0.5 font-mono">
              {formatCurrency(result.grossProfit, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-emerald-400">
              {result.grossProfitMargin}% margin
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-slate-400">Total Expenses</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5 font-mono">
              {formatCurrency(result.netTotalExpenses, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400">
              Inc. {generalSettings.currencySymbol}{result.totalInterest.toFixed(0)} int
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-slate-400">Profit Before Tax</div>
            <div className="text-sm font-bold text-white mt-0.5 font-mono">
              {formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400">
              Tax: {formatCurrency(result.incomeTax, generalSettings.currencySymbol)}
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-slate-400">Net Saving in TDS</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5 font-mono">
              {formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-amber-400">
              TDS Recovery
            </div>
          </div>

          <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/40 col-span-2 sm:col-span-1">
            <div className="text-emerald-400 font-bold">Net Profit (TDS)</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5 font-mono">
              {formatCurrency(result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-cyan-300 font-bold">
              {result.tdsRefund.percentageOfProfitAfterTdsSaving.toFixed(2)}% of Sale
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onNavigateTab('details')}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
          >
            <span>View Complete Mathematical Audit</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigateTab('scenarios')}
            className="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <span>Compare What-If Scenarios</span>
          </button>
        </div>
      </div>
    </div>
  );
};
