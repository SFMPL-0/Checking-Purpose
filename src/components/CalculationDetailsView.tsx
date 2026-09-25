import React from 'react';
import {
  Calculator,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Layers,
  Percent,
  Sliders,
} from 'lucide-react';
import {
  CalculationInput,
  CalculationResult,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  TdsRefundSettings,
} from '../types';
import { formatCurrency, formatPercent } from '../services/calculationEngine';

interface CalculationDetailsViewProps {
  input: CalculationInput;
  setInput?: React.Dispatch<React.SetStateAction<CalculationInput>>;
  result: CalculationResult;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  onNavigateSettings: (section?: string) => void;
}

export const CalculationDetailsView: React.FC<CalculationDetailsViewProps> = ({
  input,
  setInput,
  result,
  expenses,
  interestTranches,
  tdsSettings,
  generalSettings,
  onNavigateSettings,
}) => {
  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
              <Calculator className="w-4 h-4" />
              <span>Full Formula Audit & Math Engine</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
              Calculation Breakdown & Logic
            </h1>
            <p className="text-sm text-slate-400">
              Transparent, step-by-step verification of every formula, interest tranche, expense, and statutory tax calculation.
            </p>
          </div>

          <button
            onClick={() => onNavigateSettings()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold transition"
          >
            <Sliders className="w-4 h-4" />
            <span>Open Engine Settings</span>
          </button>
        </div>
      </div>

      {/* Trip Timing & Credit Model Schedule */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
              0
            </span>
            <span>Trip Timing, Credit Schedule & Statutory Deadlines</span>
          </h2>
          <span className="text-xs text-slate-400">Excel Model Calendar Controls</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* LR Date */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60">
            <div className="text-slate-400 text-[11px]">LR Date (Lorry Receipt)</div>
            <div className="text-sm font-bold text-white mt-1 font-mono">
              {input.lrDate || 'Not specified'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Base dispatch date</div>
          </div>

          {/* Credit Period & Due Date */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-blue-500/40">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Credit Period Due Date</span>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.2 rounded uppercase">
                Auto
              </span>
            </div>
            <div className="text-sm font-bold text-cyan-300 mt-1 font-mono">
              {result.creditPeriodDueDate || '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              LR Date + {input.creditPeriodDays ?? 20} credit days
            </div>
          </div>

          {/* Financial Year End Date */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60">
            <div className="text-slate-400 text-[11px]">Financial Year End Date</div>
            <div className="text-sm font-bold text-white mt-1 font-mono">
              {input.financialYearEndDate || '31 March'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Company FY closing</div>
          </div>

          {/* TDS Refund Period */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-amber-500/40">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">TDS Refund Period</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded uppercase">
                Auto
              </span>
            </div>
            <div className="text-sm font-bold text-amber-300 mt-1 font-mono">
              {result.tdsRefundPeriodMonths !== undefined
                ? `${result.tdsRefundPeriodMonths} Months`
                : '18 Months'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              ROUND((FY End − LR Date) ÷ 30, 1)
            </div>
          </div>
        </div>

        {input.lrDate &&
          input.financialYearEndDate &&
          input.financialYearEndDate < input.lrDate && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
              ⚠️ Warning: Financial Year End Date ({input.financialYearEndDate}) is earlier
              than LR Date ({input.lrDate}). TDS refund period cannot be negative (clamped to 0).
            </div>
          )}
      </div>

      {/* 1. Core Revenue & Gross Profit Card */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <span>Gross Profit Computation</span>
          </h2>
          <span className="text-xs text-slate-400">Section A</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
            <div className="text-xs text-slate-400">Selling Price (Revenue)</div>
            <div className="text-lg font-black text-white mt-1">
              {formatCurrency(result.sellingPrice, generalSettings.currencySymbol)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Billing to freight customer
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
            <div className="text-xs text-slate-400">Buying Price (Hire Cost)</div>
            <div className="text-lg font-black text-white mt-1">
              {formatCurrency(result.buyingPrice, generalSettings.currencySymbol)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Direct vehicle cost
            </div>
          </div>

          <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-500/30">
            <div className="text-xs text-emerald-400 font-medium">Gross Profit Result</div>
            <div className="text-xl font-black text-emerald-300 mt-1">
              {formatCurrency(result.grossProfit, generalSettings.currencySymbol)}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1">
              Margin: {result.grossProfitMargin}% of Selling Price
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/60 text-xs space-y-1">
          <div className="text-slate-400 font-mono">
            <strong>Formula:</strong> Gross Profit = Selling Price − Buying Price
          </div>
          <div className="text-slate-300 font-mono">
            <strong>Values:</strong> {formatCurrency(result.sellingPrice, generalSettings.currencySymbol)} − {formatCurrency(result.buyingPrice, generalSettings.currencySymbol)} = <span className="text-emerald-400 font-bold">{formatCurrency(result.grossProfit, generalSettings.currencySymbol)}</span>
          </div>
        </div>
      </div>

      {/* 2. Optional Interest Tranches (if custom standalone tranches configured) */}
      {result.interestDetails.length > 0 && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center">
                2
              </span>
              <span>Interest Calculations (Split Portions)</span>
            </h2>
            <button
              onClick={() => onNavigateSettings('interest')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Interest Tranches</span>
            </button>
          </div>

          <div className="space-y-3">
            {result.interestDetails.map((item, idx) => (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-4 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span className="text-indigo-400 font-mono text-xs">#{idx + 1}</span>
                    <span>{item.name}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/50 px-2.5 py-1 rounded-md border border-indigo-800/40">
                    {formatCurrency(item.amount, generalSettings.currencySymbol)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1">
                  <div>
                    <span className="text-slate-500">Allocation:</span>{' '}
                    <span className="text-slate-300 font-semibold">{item.allocationPercent}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Principal Base:</span>{' '}
                    <span className="text-slate-300 font-semibold">{formatCurrency(item.principal, generalSettings.currencySymbol)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Interest Rate:</span>{' '}
                    <span className="text-slate-300 font-semibold">{item.rate}% {item.isDailyRate ? 'Daily' : 'Annual'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Days:</span>{' '}
                    <span className="text-slate-300 font-semibold">{item.days} / {item.daysInYear}</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
                  <span className="text-slate-500">Formula:</span> {item.formulaString}
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 px-4">
              <span className="text-xs font-bold text-slate-200">
                Total Interest Financing Expense:
              </span>
              <span className="text-sm font-black text-indigo-300 font-mono">
                {formatCurrency(result.totalInterest, generalSettings.currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Operating & Statutory Expenses */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
              3
            </span>
            <span>Operating Expenses Breakdown</span>
          </h2>
          <button
            onClick={() => onNavigateSettings('expenses')}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit / Add Expenses</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2.5 px-3">Expense Name</th>
                <th className="py-2.5 px-3">Calculation Basis</th>
                <th className="py-2.5 px-3">Configured Rate / Amount</th>
                <th className="py-2.5 px-3">Formula Breakdown</th>
                <th className="py-2.5 px-3 text-right">Computed Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {result.expenseDetails.map((exp) => (
                <tr
                  key={exp.id}
                  className={`hover:bg-slate-800/50 ${
                    !exp.enabled ? 'opacity-40 line-through' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-semibold text-white">
                    {exp.name}
                    {exp.isTds && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        TDS 194C
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-300 capitalize">
                    {exp.basis.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-mono">
                    {exp.basis === 'fixed_amount'
                      ? formatCurrency(exp.fixedAmount, generalSettings.currencySymbol)
                      : `${exp.percentage}%`}
                  </td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                    {exp.formulaString}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                    {formatCurrency(exp.amount, generalSettings.currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="flex justify-between items-center bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 px-4">
            <span className="text-xs text-slate-400">Operating Expenses Subtotal:</span>
            <span className="text-sm font-bold text-slate-200 font-mono">
              {formatCurrency(result.totalOperatingExpenses, generalSettings.currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between items-center bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 px-4">
            <span className="text-xs font-bold text-amber-300">
              Net Total Expenses (Inc. Interest):
            </span>
            <span className="text-sm font-black text-amber-300 font-mono">
              {formatCurrency(result.netTotalExpenses, generalSettings.currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Profit Before Tax, Income Tax & PAT */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
              4
            </span>
            <span>Net Profit & Income Tax Computation</span>
          </h2>
          <button
            onClick={() => onNavigateSettings('tax')}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Tax Rate</span>
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Step 1 */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-white">Net Profit Before Tax (NPBT)</div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                Gross Profit ({formatCurrency(result.grossProfit, generalSettings.currencySymbol)}) − Net Total Expenses ({formatCurrency(result.netTotalExpenses, generalSettings.currencySymbol)})
              </div>
            </div>
            <div className="font-mono font-bold text-sm text-white">
              {formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-white">Income Tax Liability (@ {result.incomeTaxRate}%)</div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                NPBT ({formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)}) × {result.incomeTaxRate}%
              </div>
            </div>
            <div className="font-mono font-bold text-sm text-rose-300">
              {formatCurrency(result.incomeTax, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-bold text-emerald-300 text-sm">Profit After Tax (PAT)</div>
              <div className="text-emerald-400/80 font-mono text-[11px] mt-0.5">
                NPBT ({formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)}) − Income Tax ({formatCurrency(result.incomeTax, generalSettings.currencySymbol)})
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-black text-xl text-emerald-300">
                {formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}
              </div>
              <div className="text-xs font-semibold text-emerald-400">
                Percentage of Sale: {result.percentageOfSale}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. TDS Claim / Refund Section (Detailed Excel Logic) */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
                5
              </span>
              <span>TDS Claim / Refund Accounting Matrix</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Statutory TDS refund, carrying financing cost, and Sec 244A interest recovery logic.
            </p>
          </div>
          <button
            onClick={() => onNavigateSettings('tds')}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit TDS Claim Rules</span>
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Nominal TDS */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex justify-between items-center">
            <div>
              <div className="font-semibold text-white">Nominal TDS Deducted</div>
              <div className="text-slate-400 text-[11px]">
                2% deducted at source by consignor / client
              </div>
            </div>
            <div className="font-mono font-bold text-slate-200">
              +{formatCurrency(result.tdsRefund.nominalTdsAmount, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* Carrying Cost to get refund */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex justify-between items-center">
            <div>
              <div className="font-semibold text-amber-300 flex items-center gap-1.5 flex-wrap">
                <span>
                  Less Interest for {result.tdsRefundPeriodMonths ?? tdsSettings.refundCarryingPeriodMonths} Months @ {tdsSettings.refundCarryingRate}% to Get Refund
                </span>
                {result.isTdsRefundPeriodComputed && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                    Auto: (FY End − LR) ÷ 30
                  </span>
                )}
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                {result.tdsRefund.carryingCostFormula}
              </div>
            </div>
            <div className="font-mono font-bold text-rose-400">
              −{formatCurrency(result.tdsRefund.carryingCostAmount, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* IT Department Interest */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex justify-between items-center">
            <div>
              <div className="font-semibold text-cyan-300">
                Add Interest Paid by IT Dept @ {tdsSettings.itInterestRate}% for {tdsSettings.itInterestPeriodMonths} Months
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                {result.tdsRefund.itInterestFormula} (Section 244A IT Act)
              </div>
            </div>
            <div className="font-mono font-bold text-cyan-300">
              +{formatCurrency(result.tdsRefund.itInterestAmount, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* Less Actual Income Tax Liability */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex justify-between items-center">
            <div>
              <div className="font-semibold text-slate-300">Less: Actual Income Tax Liability</div>
              <div className="text-slate-400 font-mono text-[11px]">
                {result.tdsRefund.actualTaxFormula}
              </div>
            </div>
            <div className="font-mono font-bold text-rose-400">
              −{formatCurrency(result.tdsRefund.actualTaxLiabilities, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* Interactive Formula Verification Callouts for the two ⚠️ items */}
          <div className="p-3.5 bg-slate-950/80 border border-amber-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <span>⚠️ Formula Verification & Assumptions Options</span>
              </span>
              <span className="text-[10px] text-slate-400">Excel Model Variations</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Variation 1: Flat 3% vs Linked IT Interest */}
              <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-200 text-[11px]">
                  1. IT Dept Interest Computation
                </div>
                <p className="text-[10px] text-slate-400">
                  Current worksheet hardcodes 3.0%, while assumption fields specify {tdsSettings.itInterestRate}%/mo × {tdsSettings.itInterestPeriodMonths} mos = {(Number(tdsSettings.itInterestRate) * Number(tdsSettings.itInterestPeriodMonths)).toFixed(1)}%.
                </p>
                {setInput && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setInput((p) => ({ ...p, itInterestMethod: 'linked' }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        (input.itInterestMethod ?? 'linked') === 'linked'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Linked (Rate × Months)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInput((p) => ({ ...p, itInterestMethod: 'flat_3pct' }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        input.itInterestMethod === 'flat_3pct'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Flat 3.0% (Sheet Hardcoded)
                    </button>
                  </div>
                )}
              </div>

              {/* Variation 2: Net Saving Formula Order (Swapped vs Standard) */}
              <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-200 text-[11px]">
                  2. Net Saving Sign / Order
                </div>
                <p className="text-[10px] text-slate-400">
                  Worksheet row labels show: Notional − Carrying + IT Interest − Tax Liab. But cell formula had the last two terms inverted.
                </p>
                {setInput && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setInput((p) => ({ ...p, tdsCalculationVariant: 'standard' }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        (input.tdsCalculationVariant ?? 'standard') === 'standard'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Standard (− Tax + IT Int)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInput((p) => ({ ...p, tdsCalculationVariant: 'excel_swapped' }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        input.tdsCalculationVariant === 'excel_swapped'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Excel Swapped (+ Tax − IT Int)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Net Saving in TDS */}
          <div className="bg-amber-950/30 p-3.5 rounded-xl border border-amber-500/40 flex justify-between items-center">
            <div>
              <div className="font-bold text-amber-300 text-sm">Net Saving in TDS</div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                {result.tdsRefund.formulaSummary}
              </div>
            </div>
            <div className="font-mono font-black text-base text-amber-300">
              {formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
            </div>
          </div>

          {/* % of Profit After TDS Saving to Sale */}
          <div className="bg-cyan-950/30 p-3.5 rounded-xl border border-cyan-500/40 flex justify-between items-center">
            <div>
              <div className="font-semibold text-cyan-300 text-xs">
                % of Profit After TDS Saving to Sale
              </div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                Net Saving in TDS ({formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}) ÷ Selling Price ({formatCurrency(result.sellingPrice, generalSettings.currencySymbol)})
              </div>
            </div>
            <div className="font-mono font-black text-sm text-cyan-300">
              {formatPercent(result.percentageOfProfitAfterTdsSaving, 2)}
            </div>
          </div>
        </div>
      </div>

      {/* 6. SUMMARY (Matching Excel Worksheet Exactly) */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
              6
            </span>
            <h2 className="text-base font-bold text-white">
              Summary (Excel Worksheet Output)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Row 6 P&L Totals</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Profit After Tax */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 space-y-1">
            <div className="text-slate-400 text-xs font-medium">Profit After Tax (PAT)</div>
            <div
              className={`text-xl font-black font-mono mt-1 ${
                result.profitAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-500">
              NPBT − Income Tax ({result.incomeTaxRate}%)
            </div>
          </div>

          {/* Net Saving in TDS */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-500/30 space-y-1">
            <div className="text-slate-400 text-xs font-medium">Net Saving in TDS</div>
            <div className="text-xl font-black font-mono text-amber-300 mt-1">
              {formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-500">
              From Section 5 statutory matrix
            </div>
          </div>

          {/* Total Benefit = Profit After Tax + Net Saving in TDS */}
          <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/50 space-y-1 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-emerald-300 text-xs font-bold">Total Benefit</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                PAT + Net Saving
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
              {formatCurrency(result.totalBenefit ?? (result.profitAfterTax + result.tdsRefund.netSavingInTds), generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-emerald-400/80">
              Complete bottom-line financial yield
            </div>
          </div>

          {/* % To Sales = ROUND(Total Benefit ÷ Selling Price × 100, 0) */}
          <div className="bg-cyan-950/40 p-4 rounded-xl border border-cyan-500/50 space-y-1 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 text-xs font-bold">% To Sales</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                Rounded
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
              {result.percentToSales ?? (result.sellingPrice > 0 ? Math.round(((result.totalBenefit ?? 0) / result.sellingPrice) * 100) : 0)}%
            </div>
            <div className="text-[10px] text-cyan-400/80">
              ROUND(Total Benefit ÷ SP × 100, 0)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
