/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Add many vehicles/trips at once instead of running the full calculator
 * flow one-by-one. Their selling & buying prices are summed; the rest of
 * the calculation (expenses, interest, TDS, tax) runs once on the totals
 * using the same engine settings as the rest of the app. The whole batch
 * (vehicle rows + aggregated result) is saved to Supabase as one "group" so
 * you can see exactly how much business was done on any given day.
 */

import React, { useMemo, useState } from 'react';
import { Layers, Plus, Save, Trash2, Truck } from 'lucide-react';
import {
  CalculationGroup,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  TdsRefundSettings,
  VehicleLineItem,
} from '../types';
import { calculateFreightProfit, formatCurrency } from '../services/calculationEngine';

interface BulkEntryViewProps {
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  onSaveGroup: (
    groupName: string,
    vehicles: VehicleLineItem[],
    groupDate: string
  ) => Promise<CalculationGroup>;
  onNavigateTab: (tab: string) => void;
}

function newVehicleRow(): VehicleLineItem {
  return {
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    vehicleNumber: '',
    sellingPrice: 0,
    buyingPrice: 0,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const BulkEntryView: React.FC<BulkEntryViewProps> = ({
  expenses,
  interestTranches,
  tdsSettings,
  generalSettings,
  onSaveGroup,
  onNavigateTab,
}) => {
  const [groupDate, setGroupDate] = useState(todayIso());
  const [groupName, setGroupName] = useState('');
  const [vehicles, setVehicles] = useState<VehicleLineItem[]>([
    newVehicleRow(),
    newVehicleRow(),
    newVehicleRow(),
  ]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<CalculationGroup | null>(null);

  const updateVehicle = (id: string, patch: Partial<VehicleLineItem>) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };

  const addRow = () => setVehicles((prev) => [...prev, newVehicleRow()]);
  const addRows = (count: number) =>
    setVehicles((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => newVehicleRow()),
    ]);

  const removeRow = (id: string) => {
    setVehicles((prev) =>
      prev.length > 1 ? prev.filter((v) => v.id !== id) : prev
    );
  };

  const clearAll = () => {
    if (window.confirm('Clear all vehicle rows and start a new batch?')) {
      setVehicles([newVehicleRow(), newVehicleRow(), newVehicleRow()]);
      setGroupName('');
      setLastSaved(null);
    }
  };

  const validVehicles = vehicles.filter(
    (v) => v.sellingPrice > 0 || v.buyingPrice > 0
  );

  const totalSellingPrice = useMemo(
    () => vehicles.reduce((s, v) => s + (Number(v.sellingPrice) || 0), 0),
    [vehicles]
  );
  const totalBuyingPrice = useMemo(
    () => vehicles.reduce((s, v) => s + (Number(v.buyingPrice) || 0), 0),
    [vehicles]
  );

  // Live preview of the aggregated calculation, computed the exact same way
  // saveCalculationGroup will compute it — so what you see here is exactly
  // what gets saved.
  const previewResult = useMemo(() => {
    if (totalSellingPrice <= 0 && totalBuyingPrice <= 0) return null;
    return calculateFreightProfit(
      { sellingPrice: totalSellingPrice, buyingPrice: totalBuyingPrice },
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings
    );
  }, [totalSellingPrice, totalBuyingPrice, expenses, interestTranches, tdsSettings, generalSettings]);

  const handleSave = async () => {
    if (validVehicles.length === 0) {
      alert('Add at least one vehicle with a selling or buying price.');
      return;
    }
    setSaving(true);
    try {
      const saved = await onSaveGroup(
        groupName.trim() || `Batch ${groupDate}`,
        validVehicles,
        groupDate
      );
      setLastSaved(saved);
      alert(
        `Saved "${saved.groupName}" — ${saved.vehicles.length} vehicles, ` +
          `Net Profit ${formatCurrency(saved.result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}`
      );
      setVehicles([newVehicleRow(), newVehicleRow(), newVehicleRow()]);
      setGroupName('');
    } catch (err) {
      alert('Failed to save this batch. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Layers className="w-4 h-4" />
          <span>Bulk Entry</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
          Add Multiple Vehicles
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Enter every vehicle/trip for the day in one go. Their selling and
          buying prices are summed automatically — the rest of the
          calculation (expenses, interest, TDS, tax) runs once on the total,
          using your current Engine Settings.
        </p>
      </div>

      {/* Batch meta */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Date
          </label>
          <input
            type="date"
            value={groupDate}
            onChange={(e) => setGroupDate(e.target.value)}
            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Batch Name (optional)
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={`Batch ${groupDate}`}
            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Vehicle rows */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-400" />
            Vehicles ({vehicles.length})
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => addRows(5)}
              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold transition"
            >
              +5 Rows
            </button>
            <button
              onClick={clearAll}
              className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[11px] font-semibold transition"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Table header (desktop) */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          <div>Vehicle / LR No.</div>
          <div>Selling Price</div>
          <div>Buying Price</div>
          <div>Notes (optional)</div>
          <div></div>
        </div>

        <div className="space-y-2">
          {vehicles.map((v, idx) => (
            <div
              key={v.id}
              className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 bg-slate-900/70 border border-slate-700/80 rounded-xl p-2.5"
            >
              <input
                type="text"
                value={v.vehicleNumber}
                onChange={(e) => updateVehicle(v.id, { vehicleNumber: e.target.value })}
                placeholder={`Vehicle ${idx + 1}`}
                className="col-span-2 sm:col-span-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500"
              />
              <input
                type="number"
                inputMode="decimal"
                value={v.sellingPrice || ''}
                onChange={(e) =>
                  updateVehicle(v.id, { sellingPrice: parseFloat(e.target.value) || 0 })
                }
                placeholder="Selling"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 font-mono"
              />
              <input
                type="number"
                inputMode="decimal"
                value={v.buyingPrice || ''}
                onChange={(e) =>
                  updateVehicle(v.id, { buyingPrice: parseFloat(e.target.value) || 0 })
                }
                placeholder="Buying"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 font-mono"
              />
              <input
                type="text"
                value={v.notes || ''}
                onChange={(e) => updateVehicle(v.id, { notes: e.target.value })}
                placeholder="Notes"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500"
              />
              <button
                onClick={() => removeRow(v.id)}
                disabled={vehicles.length <= 1}
                className="flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                title="Remove row"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 text-slate-400 hover:text-blue-400 text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Vehicle Row
        </button>
      </div>

      {/* Live totals + preview */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <h2 className="text-sm font-bold text-white">Batch Summary (Live Preview)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-slate-400">Vehicles</div>
            <div className="text-white font-mono font-bold text-lg">
              {validVehicles.length}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-slate-400">Total Selling</div>
            <div className="text-white font-mono font-bold text-lg">
              {formatCurrency(totalSellingPrice, generalSettings.currencySymbol)}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-slate-400">Total Buying</div>
            <div className="text-white font-mono font-bold text-lg">
              {formatCurrency(totalBuyingPrice, generalSettings.currencySymbol)}
            </div>
          </div>
          <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/50">
            <div className="text-emerald-300">Net Profit (Est.)</div>
            <div
              className={`font-mono font-bold text-lg ${
                previewResult && previewResult.tdsRefund.netProfitWithTdsSaving < 0
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {previewResult
                ? formatCurrency(previewResult.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)
                : formatCurrency(0, generalSettings.currencySymbol)}
            </div>
          </div>
        </div>

        {previewResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 border-t border-slate-700/80 pt-3">
            <div>Gross Profit: <span className="text-white font-mono">{formatCurrency(previewResult.grossProfit, generalSettings.currencySymbol)}</span></div>
            <div>Total Expenses+Int.: <span className="text-white font-mono">{formatCurrency(previewResult.netTotalExpenses, generalSettings.currencySymbol)}</span></div>
            <div>Income Tax: <span className="text-white font-mono">{formatCurrency(previewResult.incomeTax, generalSettings.currencySymbol)}</span></div>
            <div>TDS Saving: <span className="text-amber-400 font-mono">{formatCurrency(previewResult.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}</span></div>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          This uses the Expenses, Interest, TDS and Tax settings currently
          configured under{' '}
          <button
            onClick={() => onNavigateTab('settings')}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Engine Settings
          </button>
          . Change them there if this batch needs different rates.
        </p>

        <button
          onClick={handleSave}
          disabled={saving || validVehicles.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving to Supabase…' : `Save Batch (${validVehicles.length} vehicles) to Supabase`}
        </button>

        {lastSaved && (
          <div className="text-center">
            <button
              onClick={() => onNavigateTab('history')}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline"
            >
              View "{lastSaved.groupName}" and all your batches under History & Reports → Vehicle Groups
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
