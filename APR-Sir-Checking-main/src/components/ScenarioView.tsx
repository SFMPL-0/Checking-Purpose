import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Layers,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  CalculationResult,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  ScenarioDefinition,
  TdsRefundSettings,
} from '../types';
import {
  calculateFreightProfit,
  formatCurrency,
  formatPercent,
} from '../services/calculationEngine';

interface ScenarioViewProps {
  scenarios: ScenarioDefinition[];
  setScenarios: React.Dispatch<React.SetStateAction<ScenarioDefinition[]>>;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  onApplyScenarioToActive: (scenario: ScenarioDefinition) => void;
}

export const ScenarioView: React.FC<ScenarioViewProps> = ({
  scenarios,
  setScenarios,
  expenses,
  interestTranches,
  tdsSettings,
  generalSettings,
  onApplyScenarioToActive,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Compute results for each scenario using active expense/tax models
  const evaluatedScenarios = scenarios.map((sc) => {
    const result: CalculationResult = calculateFreightProfit(
      {
        sellingPrice: sc.sellingPrice,
        buyingPrice: sc.buyingPrice,
        customDays: sc.days,
        customInterestRate: sc.interestRate,
      },
      expenses,
      interestTranches,
      {
        ...tdsSettings,
        actualTaxRate: sc.incomeTaxRate ?? tdsSettings.actualTaxRate,
      },
      generalSettings
    );
    return {
      definition: sc,
      result,
    };
  });

  // Identify scenario with highest PAT
  const bestScenario = evaluatedScenarios.reduce(
    (max, curr) =>
      curr.result.profitAfterTax > (max?.result.profitAfterTax ?? -Infinity)
        ? curr
        : max,
    evaluatedScenarios[0]
  );

  const handleAddScenario = () => {
    const newSc: ScenarioDefinition = {
      id: 'sc_' + Date.now(),
      name: `Scenario ${String.fromCharCode(65 + scenarios.length)}`,
      sellingPrice: 52000,
      buyingPrice: 48000,
      days: 30,
      interestRate: 1.5,
      incomeTaxRate: 27.0,
      notes: 'Custom scenario simulation',
    };
    setScenarios([...scenarios, newSc]);
  };

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length <= 1) {
      alert('You must retain at least one scenario.');
      return;
    }
    setScenarios(scenarios.filter((s) => s.id !== id));
  };

  const handleUpdateField = (
    id: string,
    field: keyof ScenarioDefinition,
    val: any
  ) => {
    setScenarios(
      scenarios.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <BarChart3 className="w-4 h-4" />
              <span>Mode 3 • What-If Decision Matrix</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
              Multi-Scenario Comparison
            </h1>
            <p className="text-sm text-slate-400">
              Evaluate freight quotation scenarios side-by-side with varying credit days, interest rates, and profit margins.
            </p>
          </div>

          <button
            onClick={handleAddScenario}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Scenario</span>
          </button>
        </div>

        {/* Best Recommendation Banner */}
        {bestScenario && (
          <div className="mt-4 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-300">
                  Highest Profit: {bestScenario.definition.name}
                </span>
                <span className="text-slate-300 ml-2">
                  PAT of{' '}
                  <strong className="text-emerald-400">
                    {formatCurrency(
                      bestScenario.result.profitAfterTax,
                      generalSettings.currencySymbol
                    )}
                  </strong>{' '}
                  ({bestScenario.result.percentageOfSale}% of sale)
                </span>
              </div>
            </div>
            <button
              onClick={() => onApplyScenarioToActive(bestScenario.definition)}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition"
            >
              Apply to Active Trip
            </button>
          </div>
        )}
      </div>

      {/* Scenario Parameter Cards (Editable) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((sc, idx) => (
          <div
            key={sc.id}
            className={`bg-slate-800/90 border rounded-2xl p-4 shadow-lg space-y-3 transition ${
              bestScenario?.definition.id === sc.id
                ? 'border-emerald-500/50 shadow-emerald-950/20'
                : 'border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={sc.name}
                onChange={(e) =>
                  handleUpdateField(sc.id, 'name', e.target.value)
                }
                className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none w-2/3"
              />
              <button
                onClick={() => handleDeleteScenario(sc.id)}
                className="text-slate-500 hover:text-rose-400 p-1 rounded"
                title="Delete scenario"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400">Selling Price</label>
                <input
                  type="number"
                  value={sc.sellingPrice}
                  onChange={(e) =>
                    handleUpdateField(
                      sc.id,
                      'sellingPrice',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Buying Price</label>
                <input
                  type="number"
                  value={sc.buyingPrice}
                  onChange={(e) =>
                    handleUpdateField(
                      sc.id,
                      'buyingPrice',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Days Credit</label>
                <input
                  type="number"
                  value={sc.days}
                  onChange={(e) =>
                    handleUpdateField(
                      sc.id,
                      'days',
                      parseInt(e.target.value) || 20
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Interest %</label>
                <input
                  type="number"
                  step="0.1"
                  value={sc.interestRate}
                  onChange={(e) =>
                    handleUpdateField(
                      sc.id,
                      'interestRate',
                      parseFloat(e.target.value) || 1.0
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-blue-300 font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                {sc.notes || 'Scenario configuration'}
              </span>
              <button
                onClick={() => onApplyScenarioToActive(sc)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                Load to Main
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Comprehensive Comparison Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Side-by-Side Financial Comparison Table</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-3 px-3">Metric / Output</th>
                {evaluatedScenarios.map((item) => (
                  <th
                    key={item.definition.id}
                    className="py-3 px-3 text-right font-bold text-white"
                  >
                    {item.definition.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {/* Selling Price */}
              <tr>
                <td className="py-2.5 px-3 text-slate-300 font-medium">Selling Price</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono text-white">
                    {formatCurrency(item.result.sellingPrice, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Buying Price */}
              <tr>
                <td className="py-2.5 px-3 text-slate-300 font-medium">Buying Price</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono text-slate-300">
                    {formatCurrency(item.result.buyingPrice, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Gross Profit */}
              <tr className="bg-slate-900/40">
                <td className="py-2.5 px-3 text-emerald-400 font-semibold">Gross Profit</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono font-bold text-emerald-300">
                    {formatCurrency(item.result.grossProfit, generalSettings.currencySymbol)} ({item.result.grossProfitMargin}%)
                  </td>
                ))}
              </tr>

              {/* Total Interest */}
              <tr>
                <td className="py-2.5 px-3 text-slate-300 font-medium">Financing Interest Cost</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono text-indigo-300">
                    {formatCurrency(item.result.totalInterest, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Total Expenses */}
              <tr>
                <td className="py-2.5 px-3 text-slate-300 font-medium">Net Total Expenses</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono text-amber-300">
                    {formatCurrency(item.result.netTotalExpenses, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Net Profit Before Tax */}
              <tr className="bg-slate-900/40">
                <td className="py-2.5 px-3 text-slate-200 font-semibold">Net Profit Before Tax (NPBT)</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    {formatCurrency(item.result.netProfitBeforeTax, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Income Tax */}
              <tr>
                <td className="py-2.5 px-3 text-slate-300 font-medium">Income Tax ({generalSettings.defaultIncomeTaxRate}%)</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono text-rose-300">
                    {formatCurrency(item.result.incomeTax, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Profit After Tax */}
              <tr className="bg-emerald-950/20">
                <td className="py-3 px-3 text-emerald-400 font-bold">Profit After Tax (PAT)</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                    {formatCurrency(item.result.profitAfterTax, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Percentage of Sale */}
              <tr>
                <td className="py-2.5 px-3 text-cyan-400 font-semibold">Percentage of Sale</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                    {formatPercent(item.result.percentageOfSale, 2)}
                  </td>
                ))}
              </tr>

              {/* Net Saving in TDS */}
              <tr>
                <td className="py-2.5 px-3 text-amber-400 font-medium">Net Saving in TDS</td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-2.5 px-3 text-right font-mono text-amber-300">
                    {formatCurrency(item.result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
                  </td>
                ))}
              </tr>

              {/* Net Profit with TDS */}
              <tr className="bg-emerald-950/20 border-t border-emerald-500/30">
                <td className="py-3 px-3 text-emerald-300 font-bold">
                  Net Profit (NPBT + TDS Saving)
                  <span className="block text-[10px] text-slate-400 font-normal">% of Profit After TDS Saving</span>
                </td>
                {evaluatedScenarios.map((item) => (
                  <td key={item.definition.id} className="py-3 px-3 text-right font-mono font-bold text-emerald-300">
                    <div>{formatCurrency(item.result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}</div>
                    <div className="text-[11px] text-cyan-300 font-semibold">{item.result.tdsRefund.percentageOfProfitAfterTdsSaving.toFixed(2)}%</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
