import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  DollarSign,
  HelpCircle,
  Percent,
  Plus,
  RefreshCw,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react';
import {
  ExpenseBasis,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  TdsRefundMode,
  TdsRefundSettings,
} from '../types';
import {
  DEFAULT_EXPENSES,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_INTEREST_TRANCHES,
  DEFAULT_TDS_SETTINGS,
  formatCurrency,
} from '../services/calculationEngine';

interface SettingsViewProps {
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  interestTranches: InterestTranche[];
  setInterestTranches: React.Dispatch<React.SetStateAction<InterestTranche[]>>;
  tdsSettings: TdsRefundSettings;
  setTdsSettings: React.Dispatch<React.SetStateAction<TdsRefundSettings>>;
  generalSettings: GeneralSettings;
  setGeneralSettings: React.Dispatch<React.SetStateAction<GeneralSettings>>;
  initialSection?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  expenses,
  setExpenses,
  interestTranches,
  setInterestTranches,
  tdsSettings,
  setTdsSettings,
  generalSettings,
  setGeneralSettings,
  initialSection,
}) => {
  const [activeTab, setActiveTab] = useState<
    'expenses' | 'interest' | 'tds' | 'general'
  >(
    initialSection === 'interest'
      ? 'interest'
      : initialSection === 'tax' || initialSection === 'tds'
      ? 'tds'
      : 'expenses'
  );

  // Interest allocation total check
  const totalAllocation = interestTranches.reduce(
    (sum, t) => sum + (Number(t.allocationPercentage) || 0),
    0
  );

  // --- Expenses Actions ---
  const handleToggleExpense = (id: string) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const handleUpdateExpense = (
    id: string,
    field: keyof ExpenseItem,
    val: any
  ) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );
  };

  const handleDeleteExpense = (id: string) => {
    if (expenses.length <= 1) {
      alert('You must keep at least one expense in the engine.');
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleAddExpense = () => {
    const newExp: ExpenseItem = {
      id: 'exp_' + Date.now(),
      name: 'Custom Logistics Charge',
      enabled: true,
      basis: 'selling_price',
      percentage: 1.0,
      fixedAmount: 0,
      isTds: false,
    };
    setExpenses([...expenses, newExp]);
  };

  // --- Interest Tranches Actions ---
  const handleUpdateTranche = (
    id: string,
    field: keyof InterestTranche,
    val: any
  ) => {
    setInterestTranches((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  const handleAddTranche = () => {
    const newTranche: InterestTranche = {
      id: 'int_' + Date.now(),
      name: `Interest Portioned tranche`,
      allocationPercentage: 0,
      annualRate: 1.0,
      days: 20,
      daysInYear: 365,
      isDailyRate: false,
      basis: 'selling_price',
    };
    setInterestTranches([...interestTranches, newTranche]);
  };

  const handleDeleteTranche = (id: string) => {
    if (interestTranches.length <= 1) {
      alert('You must keep at least one interest tranche.');
      return;
    }
    setInterestTranches((prev) => prev.filter((t) => t.id !== id));
  };

  // Reset to Standard Defaults
  const handleResetToExcelDefaults = () => {
    if (
      window.confirm(
        'Reset all calculation settings (interest rates, expenses, TDS rules) back to standard benchmark defaults?'
      )
    ) {
      setExpenses(JSON.parse(JSON.stringify(DEFAULT_EXPENSES)));
      setInterestTranches(JSON.parse(JSON.stringify(DEFAULT_INTEREST_TRANCHES)));
      setTdsSettings(JSON.parse(JSON.stringify(DEFAULT_TDS_SETTINGS)));
      setGeneralSettings(JSON.parse(JSON.stringify(DEFAULT_GENERAL_SETTINGS)));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Sliders className="w-4 h-4" />
              <span>Fully Configurable Calculation Engine</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
              Engine Rules & Parameters
            </h1>
            <p className="text-sm text-slate-400">
              Nothing is hardcoded. Modify interest allocations, credit days, statutory taxes, and expense models in real-time.
            </p>
          </div>

          <button
            onClick={handleResetToExcelDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Excel Defaults</span>
          </button>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap gap-2 mt-5 border-t border-slate-700/80 pt-4">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'expenses'
                ? 'bg-amber-500 text-slate-900 shadow-md'
                : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Expense Rules ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('interest')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'interest'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>Interest Portions ({interestTranches.length})</span>
            {interestTranches.length > 0 && Math.abs(totalAllocation - 100) > 0.01 && (
              <span className="w-2 h-2 rounded-full bg-rose-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('tds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'tds'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            TDS Claim & Tax Settings
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'general'
                ? 'bg-emerald-500 text-slate-900 shadow-md'
                : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            General & Formatting
          </button>
        </div>
      </div>

      {/* TAB 1: EXPENSE SETTINGS */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                Configured Expense Rules Table
              </h2>
              <p className="text-xs text-slate-400">
                Change percentages, expense names, calculation basis (SP, BP, Gross Profit, or Fixed Amount), or add new line items.
              </p>
            </div>
            <button
              onClick={handleAddExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Expense</span>
            </button>
          </div>

          <div className="space-y-3">
            {expenses.map((exp, idx) => (
              <div
                key={exp.id}
                className={`bg-slate-900/70 border rounded-xl p-3.5 transition ${
                  exp.enabled
                    ? 'border-slate-700'
                    : 'border-slate-800 opacity-60 bg-slate-950/40'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Status Toggle & Name */}
                  <div className="md:col-span-4 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleExpense(exp.id)}
                      className={`p-1 rounded-md transition ${
                        exp.enabled ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                      title={exp.enabled ? 'Enabled' : 'Disabled'}
                    >
                      {exp.enabled ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>

                    <input
                      type="text"
                      value={exp.name}
                      onChange={(e) =>
                        handleUpdateExpense(exp.id, 'name', e.target.value)
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none w-full"
                    />

                    {exp.isTds && (
                      <span className="shrink-0 text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                        TDS
                      </span>
                    )}
                  </div>

                  {/* Calculation Basis */}
                  <div className="md:col-span-3">
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Basis
                    </label>
                    <select
                      value={exp.basis}
                      onChange={(e) =>
                        handleUpdateExpense(
                          exp.id,
                          'basis',
                          e.target.value as ExpenseBasis
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-blue-500"
                    >
                      <option value="selling_price">% of Selling Price</option>
                      <option value="buying_price">% of Buying Price</option>
                      <option value="gross_profit">% of Gross Profit</option>
                      <option value="fixed_amount">Fixed Amount (₹)</option>
                    </select>
                  </div>

                  {/* Percentage or Fixed Amount */}
                  <div className="md:col-span-4">
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      {exp.basis === 'fixed_amount' ? 'Fixed ₹' : 'Rate %'}
                    </label>
                    {exp.basis === 'fixed_amount' ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1 text-slate-400 text-xs">
                          {generalSettings.currencySymbol}
                        </span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={exp.fixedAmount}
                          onChange={(e) =>
                            handleUpdateExpense(
                              exp.id,
                              'fixedAmount',
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-xs text-white font-mono font-bold"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={exp.percentage}
                          onChange={(e) =>
                            handleUpdateExpense(
                              exp.id,
                              'percentage',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-6 pl-2 py-1 text-xs text-amber-300 font-mono font-bold"
                        />
                        <span className="absolute right-2 top-1 text-slate-400 text-xs font-mono">
                          %
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                      title="Delete expense rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INTEREST TRANCHES SETTINGS */}
      {activeTab === 'interest' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                Interest Portions & Credit Settings
              </h2>
              <p className="text-xs text-slate-400">
                In your latest Excel P&L sheet, interest is unified into the &quot;Interest on 30 Days&quot; expense row (flat 1% of Selling Price). If you ever need custom split tranches, you can add them below.
              </p>
            </div>
            <button
              onClick={handleAddTranche}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tranche</span>
            </button>
          </div>

          {/* Allocation Validation Alert */}
          {interestTranches.length > 0 && Math.abs(totalAllocation - 100) > 0.01 && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Total Allocation is <strong>{totalAllocation.toFixed(1)}%</strong>. Please adjust portions so they total 100.0%.
              </span>
            </div>
          )}

          {interestTranches.length === 0 ? (
            <div className="p-6 bg-slate-900/60 border border-slate-700/80 rounded-xl text-center space-y-2">
              <p className="text-xs text-slate-200 font-bold">
                No split tranches active
              </p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Interest is computed flat as &quot;Interest on 30 Days&quot; (1.0% of Selling Price) under Expense Rules, matching your current Excel P&L model without legacy 75%/25% split tranches.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
            {interestTranches.map((tranche, idx) => (
              <div
                key={tranche.id}
                className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={tranche.name}
                    onChange={(e) =>
                      handleUpdateTranche(tranche.id, 'name', e.target.value)
                    }
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white w-2/3"
                  />
                  <button
                    onClick={() => handleDeleteTranche(tranche.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Delete tranche"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  {/* Allocation % */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Portion Allocation %
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={tranche.allocationPercentage}
                      onChange={(e) =>
                        handleUpdateTranche(
                          tranche.id,
                          'allocationPercentage',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-indigo-300 font-mono font-bold"
                    />
                  </div>

                  {/* Interest Rate */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Interest Rate %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tranche.annualRate}
                      onChange={(e) =>
                        handleUpdateTranche(
                          tranche.id,
                          'annualRate',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-blue-300 font-mono font-bold"
                    />
                  </div>

                  {/* Number of Days */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Days
                    </label>
                    <input
                      type="number"
                      value={tranche.days}
                      onChange={(e) =>
                        handleUpdateTranche(
                          tranche.id,
                          'days',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-amber-300 font-mono font-bold"
                    />
                  </div>

                  {/* Days per Year */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Days / Year
                    </label>
                    <input
                      type="number"
                      value={tranche.daysInYear}
                      onChange={(e) =>
                        handleUpdateTranche(
                          tranche.id,
                          'daysInYear',
                          parseInt(e.target.value) || 365
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300 font-mono"
                    />
                  </div>

                  {/* Mode Toggle */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Rate Mode
                    </label>
                    <select
                      value={tranche.isDailyRate ? 'daily' : 'annual'}
                      onChange={(e) =>
                        handleUpdateTranche(
                          tranche.id,
                          'isDailyRate',
                          e.target.value === 'daily'
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="annual">Annual (/365)</option>
                      <option value="daily">Daily Rate</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* TAB 3: TDS CLAIM & TAX SETTINGS */}
      {activeTab === 'tds' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="border-b border-slate-700/80 pb-3">
            <h2 className="text-base font-bold text-white">
              TDS Claim & Income Tax Engine Settings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize the statutory parameters: nominal TDS deduction, refund financing carrying period, IT Dept interest rate, and corporate income tax rate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income Tax Rate */}
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold text-white block">
                Actual Income Tax Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={tdsSettings.actualTaxRate}
                  onChange={(e) =>
                    setTdsSettings({
                      ...tdsSettings,
                      actualTaxRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-rose-300 font-mono font-bold text-sm"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-mono text-sm">
                  %
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Default 27% (corporate tax + surcharge/cess statutory baseline).
              </p>
            </div>

            {/* Nominal TDS Rate */}
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold text-white block">
                Nominal TDS Rate (Section 194C)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={tdsSettings.nominalTdsRate}
                  onChange={(e) =>
                    setTdsSettings({
                      ...tdsSettings,
                      nominalTdsRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono font-bold text-sm"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-mono text-sm">
                  %
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Default 2% for freight contractor/transport invoices.
              </p>
            </div>

            {/* Carrying Cost for Refund */}
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-amber-300">
                Carrying Cost to Receive Refund
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">
                    Rate %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tdsSettings.refundCarryingRate}
                    onChange={(e) =>
                      setTdsSettings({
                        ...tdsSettings,
                        refundCarryingRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">
                    Period (Months)
                  </label>
                  <input
                    type="number"
                    value={tdsSettings.refundCarryingPeriodMonths}
                    onChange={(e) =>
                      setTdsSettings({
                        ...tdsSettings,
                        refundCarryingPeriodMonths: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">
                  Calculation Mode
                </label>
                <select
                  value={tdsSettings.refundCarryingMode}
                  onChange={(e) =>
                    setTdsSettings({
                      ...tdsSettings,
                      refundCarryingMode: e.target.value as TdsRefundMode,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                >
                  <option value="monthly">Monthly Rate (Rate × Months)</option>
                  <option value="annual">Annual Rate (Rate × Months ÷ 12)</option>
                  <option value="flat">Flat Percentage</option>
                </select>
              </div>
            </div>

            {/* IT Dept Interest (Sec 244A) */}
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-cyan-300">
                Interest Paid by IT Dept (Sec 244A)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">
                    IT Interest Rate %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tdsSettings.itInterestRate}
                    onChange={(e) =>
                      setTdsSettings({
                        ...tdsSettings,
                        itInterestRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">
                    Delay Period (Months)
                  </label>
                  <input
                    type="number"
                    value={tdsSettings.itInterestPeriodMonths}
                    onChange={(e) =>
                      setTdsSettings({
                        ...tdsSettings,
                        itInterestPeriodMonths: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">
                  Calculation Mode
                </label>
                <select
                  value={tdsSettings.itInterestMode}
                  onChange={(e) =>
                    setTdsSettings({
                      ...tdsSettings,
                      itInterestMode: e.target.value as TdsRefundMode,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                >
                  <option value="monthly">
                    Monthly Interest (0.5%/mo × 6 mos = 3.0%)
                  </option>
                  <option value="annual">Annual Interest</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="border-b border-slate-700/80 pb-3">
            <h2 className="text-base font-bold text-white">
              General Formatting & Localization
            </h2>
            <p className="text-xs text-slate-400">
              Configure currency notation, decimal precision, and application default parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={generalSettings.currencySymbol}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    currencySymbol: e.target.value,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">
                Currency Code
              </label>
              <input
                type="text"
                value={generalSettings.currencyCode}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    currencyCode: e.target.value,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">
                Decimal Places
              </label>
              <select
                value={generalSettings.decimalPlaces}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    decimalPlaces: parseInt(e.target.value) || 2,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="0">0 (e.g. ₹51,500)</option>
                <option value="2">2 (e.g. ₹51,500.00)</option>
                <option value="4">4 (High Precision)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">
                Days in Year
              </label>
              <input
                type="number"
                value={generalSettings.daysPerYear}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    daysPerYear: parseInt(e.target.value) || 365,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
