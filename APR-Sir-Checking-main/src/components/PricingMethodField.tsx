/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Selling/Buying price field with a pricing-method toggle: type the amount
 * directly ("Fixed Amount"), or enter a Freight Rate and PMT (tonnage/
 * quantity) and let the amount be calculated automatically.
 */

import React from 'react';
import { PricingMethod } from '../types';
import { computePricingAmount, formatCurrency } from '../services/calculationEngine';

interface PricingMethodFieldProps {
  label: string;
  currencySymbol: string;
  method: PricingMethod;
  amount: number;
  freightRate?: number;
  pmt?: number;
  onMethodChange: (method: PricingMethod) => void;
  onAmountChange: (amount: number) => void;
  onFreightRateChange: (rate: number) => void;
  onPmtChange: (pmt: number) => void;
  compact?: boolean;
}

export const PricingMethodField: React.FC<PricingMethodFieldProps> = ({
  label,
  currencySymbol,
  method,
  amount,
  freightRate,
  pmt,
  onMethodChange,
  onAmountChange,
  onFreightRateChange,
  onPmtChange,
  compact,
}) => {
  const computed = computePricingAmount(method, amount, freightRate, pmt);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <label className={compact ? 'text-[11px] text-slate-400' : 'text-xs font-medium text-slate-300'}>
          {label}
        </label>
        <div className="inline-flex bg-slate-950 border border-slate-700 rounded-lg p-0.5 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => onMethodChange('fixed')}
            className={`px-2 py-0.5 rounded-md transition ${
              method === 'fixed' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fixed Amount
          </button>
          <button
            type="button"
            onClick={() => onMethodChange('freight_pmt')}
            className={`px-2 py-0.5 rounded-md transition ${
              method === 'freight_pmt' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Freight × PMT
          </button>
        </div>
      </div>

      {method === 'fixed' ? (
        <div className="relative">
          <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold ${compact ? 'text-xs' : ''}`}>
            {currencySymbol}
          </span>
          <input
            type="number"
            step="100"
            min="0"
            value={amount || ''}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            className={
              compact
                ? 'w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono text-white'
                : 'w-full bg-slate-900/90 border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-8 pr-4 py-2.5 text-lg font-bold text-white tracking-wide'
            }
            placeholder="0"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="1"
            min="0"
            value={freightRate || ''}
            onChange={(e) => onFreightRateChange(parseFloat(e.target.value) || 0)}
            placeholder="Freight/MT"
            className={
              compact
                ? 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white'
                : 'bg-slate-900/90 border border-slate-600 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-mono text-white'
            }
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={pmt || ''}
            onChange={(e) => onPmtChange(parseFloat(e.target.value) || 0)}
            placeholder="PMT (Tons)"
            className={
              compact
                ? 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white'
                : 'bg-slate-900/90 border border-slate-600 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-mono text-white'
            }
          />
          <div className={`col-span-2 text-right font-mono font-bold text-emerald-400 ${compact ? 'text-[11px]' : 'text-sm'}`}>
            = {formatCurrency(computed, currencySymbol)}
          </div>
        </div>
      )}
    </div>
  );
};
