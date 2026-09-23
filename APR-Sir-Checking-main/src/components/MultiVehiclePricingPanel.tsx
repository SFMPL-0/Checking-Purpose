/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multiple Entry mode for Core Trip Pricing: enter pricing for several
 * vehicles at once (5, 10, 20+), each with its own Vehicle Number, Truck
 * Type, and Selling/Buying pricing (Fixed Amount or Freight × PMT). Totals
 * are summed automatically and fed back into the main calculation as
 * sellingPrice/buyingPrice.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MasterDataItem, MasterDataKind, VehiclePricingEntry } from '../types';
import { computePricingAmount, formatCurrency } from '../services/calculationEngine';
import { SearchableSelect } from './SearchableSelect';
import { PricingMethodField } from './PricingMethodField';

interface MultiVehiclePricingPanelProps {
  vehicles: VehiclePricingEntry[];
  onChange: (vehicles: VehiclePricingEntry[]) => void;
  truckTypes: MasterDataItem[];
  onAddMasterData: (kind: MasterDataKind, name: string) => Promise<MasterDataItem | null>;
  currencySymbol: string;
}

function newVehicle(): VehiclePricingEntry {
  return {
    id: 'veh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    vehicleNumber: '',
    truckType: '',
    sellingPricingMethod: 'fixed',
    sellingAmount: 0,
    buyingPricingMethod: 'fixed',
    buyingAmount: 0,
  };
}

export function vehicleAmounts(v: VehiclePricingEntry) {
  return {
    selling: computePricingAmount(v.sellingPricingMethod, v.sellingAmount, v.sellingFreightRate, v.sellingPmt),
    buying: computePricingAmount(v.buyingPricingMethod, v.buyingAmount, v.buyingFreightRate, v.buyingPmt),
  };
}

export const MultiVehiclePricingPanel: React.FC<MultiVehiclePricingPanelProps> = ({
  vehicles,
  onChange,
  truckTypes,
  onAddMasterData,
  currencySymbol,
}) => {
  const updateVehicle = (id: string, patch: Partial<VehiclePricingEntry>) => {
    onChange(vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const addVehicles = (count: number) => {
    onChange([...vehicles, ...Array.from({ length: count }, () => newVehicle())]);
  };

  const removeVehicle = (id: string) => {
    if (vehicles.length <= 1) return;
    onChange(vehicles.filter((v) => v.id !== id));
  };

  const totals = vehicles.reduce(
    (acc, v) => {
      const { selling, buying } = vehicleAmounts(v);
      return {
        selling: acc.selling + selling,
        buying: acc.buying + buying,
      };
    },
    { selling: 0, buying: 0 }
  );
  const totalProfit = totals.selling - totals.buying;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">
          Vehicles ({vehicles.length})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => addVehicles(1)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-semibold transition"
          >
            <Plus className="w-3 h-3" /> Add Vehicle
          </button>
          <button
            type="button"
            onClick={() => addVehicles(5)}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-semibold transition"
          >
            +5
          </button>
          <button
            type="button"
            onClick={() => addVehicles(10)}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-semibold transition"
          >
            +10
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {vehicles.map((v, idx) => {
          const { selling, buying } = vehicleAmounts(v);
          return (
            <div key={v.id} className="bg-slate-950/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <input
                    type="text"
                    value={v.vehicleNumber}
                    onChange={(e) => updateVehicle(v.id, { vehicleNumber: e.target.value })}
                    placeholder={`Vehicle ${idx + 1} No.`}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                  <SearchableSelect
                    label=""
                    value={v.truckType || ''}
                    onChange={(val) => updateVehicle(v.id, { truckType: val })}
                    options={truckTypes}
                    onAddNew={(name) => onAddMasterData('truck_types', name)}
                    placeholder="Truck type"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVehicle(v.id)}
                  disabled={vehicles.length <= 1}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition disabled:opacity-30 shrink-0"
                  title="Remove vehicle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <PricingMethodField
                  label="Selling Price"
                  currencySymbol={currencySymbol}
                  method={v.sellingPricingMethod}
                  amount={v.sellingAmount}
                  freightRate={v.sellingFreightRate}
                  pmt={v.sellingPmt}
                  onMethodChange={(m) => updateVehicle(v.id, { sellingPricingMethod: m })}
                  onAmountChange={(amt) => updateVehicle(v.id, { sellingAmount: amt })}
                  onFreightRateChange={(r) => updateVehicle(v.id, { sellingFreightRate: r })}
                  onPmtChange={(p) => updateVehicle(v.id, { sellingPmt: p })}
                  compact
                />
                <PricingMethodField
                  label="Buying Price"
                  currencySymbol={currencySymbol}
                  method={v.buyingPricingMethod}
                  amount={v.buyingAmount}
                  freightRate={v.buyingFreightRate}
                  pmt={v.buyingPmt}
                  onMethodChange={(m) => updateVehicle(v.id, { buyingPricingMethod: m })}
                  onAmountChange={(amt) => updateVehicle(v.id, { buyingAmount: amt })}
                  onFreightRateChange={(r) => updateVehicle(v.id, { buyingFreightRate: r })}
                  onPmtChange={(p) => updateVehicle(v.id, { buyingPmt: p })}
                  compact
                />
              </div>

              <div className="text-right text-[11px] text-slate-400">
                Row Profit:{' '}
                <span className={`font-mono font-bold ${selling - buying >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(selling - buying, currencySymbol)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-slate-900/70 border border-slate-700 rounded-xl p-3">
        <div>
          <div className="text-[10px] text-slate-500">Total Selling</div>
          <div className="text-sm font-mono font-bold text-white">
            {formatCurrency(totals.selling, currencySymbol)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">Total Buying</div>
          <div className="text-sm font-mono font-bold text-white">
            {formatCurrency(totals.buying, currencySymbol)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">Total Profit</div>
          <div className={`text-sm font-mono font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(totalProfit, currencySymbol)}
          </div>
        </div>
      </div>
    </div>
  );
};
