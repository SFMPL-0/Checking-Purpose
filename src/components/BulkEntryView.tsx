/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Add many vehicles/trips at once instead of running the full calculator
 * flow one-by-one. Their selling & buying prices are summed; the rest of
 * the calculation (expenses, interest, TDS, tax) runs once on the totals
 * using the same engine settings as the rest of the app. The whole batch
 * (vehicle rows + aggregated result) is saved to Supabase so you can see
 * every truck and exactly how much business was done on any given day.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  CalculationGroup,
  CompanyProfile,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  MasterDataItem,
  TdsRefundSettings,
  VehicleLineItem,
} from '../types';
import { calculateFreightProfit, formatCurrency } from '../services/calculationEngine';

export interface InitialBatchData {
  groupName?: string;
  groupDate?: string;
  vehicles: VehicleLineItem[];
  lastSavedGroup?: CalculationGroup | null;
  clientName?: string;
}

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
  onSaveCalculationSnapshot?: (
    name: string,
    vehicles: VehicleLineItem[],
    clientName?: string,
    groupDate?: string
  ) => Promise<void>;
  onNavigateTab: (tab: string) => void;
  initialBatch?: InitialBatchData | null;
  onClearInitialBatch?: () => void;
  companyProfiles?: CompanyProfile[];
  onSelectCompanyProfile?: (profile: CompanyProfile) => void;
  truckTypes?: MasterDataItem[];
}

function newVehicleRow(index?: number): VehicleLineItem {
  return {
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    vehicleNumber: '',
    sellingPrice: 0,
    buyingPrice: 0,
    notes: '',
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
  onSaveCalculationSnapshot,
  onNavigateTab,
  initialBatch,
  onClearInitialBatch,
  companyProfiles = [],
  onSelectCompanyProfile,
  truckTypes = [],
}) => {
  const [groupDate, setGroupDate] = useState(todayIso());
  const [groupName, setGroupName] = useState('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [vehicles, setVehicles] = useState<VehicleLineItem[]>([
    newVehicleRow(),
    newVehicleRow(),
    newVehicleRow(),
  ]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<CalculationGroup | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Load initial batch if passed from History / Reopen
  useEffect(() => {
    if (initialBatch && initialBatch.vehicles && initialBatch.vehicles.length > 0) {
      setVehicles(
        initialBatch.vehicles.map((v) => ({
          id: v.id || 'v_' + Math.random().toString(36).substring(2, 6),
          vehicleNumber: v.vehicleNumber || '',
          sellingPrice: Number(v.sellingPrice) || 0,
          buyingPrice: Number(v.buyingPrice) || 0,
          truckType: v.truckType || '',
          notes: v.notes || '',
        }))
      );
      if (initialBatch.groupDate) setGroupDate(initialBatch.groupDate);
      if (initialBatch.groupName) setGroupName(initialBatch.groupName);
      if (initialBatch.clientName) setSelectedClientName(initialBatch.clientName);
      if (initialBatch.lastSavedGroup) setLastSaved(initialBatch.lastSavedGroup);

      setBatchNotice(
        `✓ Reopened batch "${initialBatch.groupName || 'Batch'}" with ${initialBatch.vehicles.length} trucks.`
      );
    }
  }, [initialBatch]);

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
      setSelectedClientName('');
      setLastSaved(null);
      setBatchNotice(null);
      if (onClearInitialBatch) onClearInitialBatch();
    }
  };

  const handleClientChange = (clientName: string) => {
    setSelectedClientName(clientName);
    if (!clientName) return;
    const matched = companyProfiles.find(
      (cp) => cp.name.toLowerCase() === clientName.toLowerCase()
    );
    if (matched && onSelectCompanyProfile) {
      onSelectCompanyProfile(matched);
      setBatchNotice(`✓ Applied engine settings for ${matched.name}`);
      setTimeout(() => setBatchNotice(null), 3500);
    }
  };

  const validVehicles = vehicles.filter(
    (v) => (Number(v.sellingPrice) || 0) > 0 || (Number(v.buyingPrice) || 0) > 0 || v.vehicleNumber.trim().length > 0
  );

  const totalSellingPrice = useMemo(
    () => vehicles.reduce((s, v) => s + (Number(v.sellingPrice) || 0), 0),
    [vehicles]
  );
  const totalBuyingPrice = useMemo(
    () => vehicles.reduce((s, v) => s + (Number(v.buyingPrice) || 0), 0),
    [vehicles]
  );

  const previewResult = useMemo(() => {
    if (totalSellingPrice <= 0 && totalBuyingPrice <= 0) return null;
    return calculateFreightProfit(
      {
        sellingPrice: totalSellingPrice,
        buyingPrice: totalBuyingPrice,
        clientName: selectedClientName || undefined,
        vehicleEntryMode: 'multiple',
      },
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings
    );
  }, [totalSellingPrice, totalBuyingPrice, expenses, interestTranches, tdsSettings, generalSettings, selectedClientName]);

  const handleSave = async () => {
    if (validVehicles.length === 0) {
      alert('Please add at least one vehicle with a selling or buying price.');
      return;
    }
    setSaving(true);
    try {
      const finalName = groupName.trim() || `${selectedClientName ? selectedClientName + ' - ' : ''}Batch ${groupDate}`;
      const saved = await onSaveGroup(
        finalName,
        validVehicles,
        groupDate
      );
      setLastSaved(saved);
      setBatchNotice(
        `✓ Successfully saved "${saved.groupName}" with ${saved.vehicles.length} trucks! (Net Profit: ${formatCurrency(
          saved.result.tdsRefund.netProfitWithTdsSaving,
          generalSettings.currencySymbol
        )})`
      );
    } catch (err) {
      console.error(err);
      alert('Failed to save this batch. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTripSnapshot = async () => {
    if (validVehicles.length === 0) {
      alert('Please add at least one vehicle with a price.');
      return;
    }
    if (!onSaveCalculationSnapshot) {
      await handleSave();
      return;
    }
    setSaving(true);
    try {
      const finalName = groupName.trim() || `${selectedClientName ? selectedClientName + ' - ' : ''}Trip Batch (${validVehicles.length} Trucks)`;
      await onSaveCalculationSnapshot(finalName, validVehicles, selectedClientName, groupDate);
      setBatchNotice(`✓ Saved trip snapshot with ${validVehicles.length} trucks! Reopening will restore all trucks.`);
    } catch (err) {
      console.error(err);
      alert('Failed to save trip snapshot.');
    } finally {
      setSaving(false);
    }
  };

  const activeProfile = companyProfiles.find(
    (cp) => cp.name.toLowerCase() === selectedClientName.toLowerCase()
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Truck className="w-4 h-4" />
              <span>Multi-Vehicle / Bulk Entry</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
              Add Multiple Trucks
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Enter every truck/vehicle for the day in one go. Each truck retains its own Truck Number, selling and buying rates. The calculation engine aggregates them while keeping all truck details intact for history and reports!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('dashboard')}
              className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
            >
              Switch to Single Entry →
            </button>
          </div>
        </div>

        {/* Notice banner if reopened or saved */}
        {batchNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{batchNotice}</span>
            </div>
            <button
              onClick={() => setBatchNotice(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Batch Metadata & Client Engine Settings */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Client / Company Profile */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Client / Company Profile</span>
          </label>
          <select
            value={selectedClientName}
            onChange={(e) => handleClientChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500"
          >
            <option value="">-- Select Client Profile (Optional) --</option>
            {companyProfiles.map((cp) => (
              <option key={cp.id} value={cp.name}>
                {cp.name} ({cp.paymentTermsDays || 20}d credit, {cp.interestRate || 1}% int)
              </option>
            ))}
          </select>
          {activeProfile && (
            <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
              <span>✓ Custom Engine active: {activeProfile.paymentTermsDays || 20}d credit, {activeProfile.interestRate || 1}% int</span>
            </div>
          )}
        </div>

        {/* Batch Date */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Batch Date</span>
          </label>
          <input
            type="date"
            value={groupDate}
            onChange={(e) => setGroupDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 font-mono"
          />
        </div>

        {/* Batch Name / Trip Title */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 block">
            Batch Name / Trip Label (Optional)
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={`e.g. ${selectedClientName ? selectedClientName + ' - ' : ''}Daily Dispatch ${groupDate}`}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Vehicle Rows Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Trucks / Vehicles ({vehicles.length} Rows, {validVehicles.length} Active)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Enter individual truck numbers and rates. All rows will be preserved when reopened!
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => addRows(5)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold transition"
            >
              +5 Rows
            </button>
            <button
              onClick={() => addRows(10)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold transition"
            >
              +10 Rows
            </button>
            <button
              onClick={clearAll}
              className="px-2.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[11px] font-semibold transition"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2 px-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
          <div>Truck No. / Vehicle No.</div>
          <div>Selling Price ({generalSettings.currencySymbol})</div>
          <div>Buying Price ({generalSettings.currencySymbol})</div>
          <div>Notes / LR No. / Route</div>
          <div className="w-8"></div>
        </div>

        <div className="space-y-2">
          {vehicles.map((v, idx) => (
            <div
              key={v.id}
              className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2 bg-slate-900/70 border border-slate-700/80 hover:border-slate-600 rounded-xl p-2.5 transition items-center"
            >
              {/* Truck Number */}
              <div className="col-span-2 sm:col-span-1">
                <input
                  type="text"
                  value={v.vehicleNumber}
                  onChange={(e) =>
                    updateVehicle(v.id, { vehicleNumber: e.target.value.toUpperCase() })
                  }
                  placeholder={`Truck ${idx + 1} (e.g. MH12AB1234)`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono uppercase focus:border-blue-500"
                />
              </div>

              {/* Selling Price */}
              <div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={v.sellingPrice || ''}
                  onChange={(e) =>
                    updateVehicle(v.id, { sellingPrice: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="Selling Price"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 font-mono"
                />
              </div>

              {/* Buying Price */}
              <div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={v.buyingPrice || ''}
                  onChange={(e) =>
                    updateVehicle(v.id, { buyingPrice: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="Buying Price"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 font-mono"
                />
              </div>

              {/* Notes */}
              <div className="col-span-2 sm:col-span-1">
                <input
                  type="text"
                  value={v.notes || ''}
                  onChange={(e) => updateVehicle(v.id, { notes: e.target.value })}
                  placeholder="Optional notes / LR no."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500"
                />
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeRow(v.id)}
                disabled={vehicles.length <= 1}
                className="flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                title="Remove truck row"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-amber-500 text-slate-400 hover:text-amber-400 text-xs font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Another Truck Row</span>
        </button>
      </div>

      {/* Live Totals & Action Section */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Batch Financial Summary (Live Aggregation)</span>
          </h2>
          {activeProfile && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              Profile: {activeProfile.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-slate-400">Total Active Trucks</div>
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
            <div className="text-emerald-300">Net Profit (with TDS)</div>
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
            <div>Gross Margin: <span className="text-white font-mono font-bold">{formatCurrency(previewResult.grossProfit, generalSettings.currencySymbol)}</span></div>
            <div>Total Exp. & Int.: <span className="text-white font-mono font-bold">{formatCurrency(previewResult.netTotalExpenses, generalSettings.currencySymbol)}</span></div>
            <div>Estimated Tax: <span className="text-white font-mono font-bold">{formatCurrency(previewResult.incomeTax, generalSettings.currencySymbol)}</span></div>
            <div>TDS Refund Saving: <span className="text-amber-400 font-mono font-bold">{formatCurrency(previewResult.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}</span></div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || validVehicles.length === 0}
            className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {saving ? 'Saving...' : `Save Vehicle Batch (${validVehicles.length} Trucks)`}
            </span>
          </button>

          <button
            onClick={handleSaveTripSnapshot}
            disabled={saving || validVehicles.length === 0}
            className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Save as Trip Snapshot in History</span>
          </button>
        </div>

        {lastSaved && (
          <div className="text-center pt-2">
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
            >
              View "{lastSaved.groupName}" under History & Reports → Vehicle Groups →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
