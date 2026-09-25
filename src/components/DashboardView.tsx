import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sliders,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import {
  CalculationInput,
  CalculationResult,
  CompanyProfile,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  MasterDataItem,
  MasterDataKind,
  PricingMethod,
  TdsRefundSettings,
} from '../types';
import { formatCurrency, formatPercent } from '../services/calculationEngine';
import { SearchableSelect } from './SearchableSelect';
import { PricingMethodField } from './PricingMethodField';
import { MultiVehiclePricingPanel, vehicleAmounts } from './MultiVehiclePricingPanel';

interface DashboardViewProps {
  input: CalculationInput;
  setInput: React.Dispatch<React.SetStateAction<CalculationInput>>;
  result: CalculationResult;
  expenses: ExpenseItem[];
  setExpenses?: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  onNavigateTab: (tab: string) => void;
  onSaveCalculation: () => void;
  onExportExcel: () => void;
  onPrintReport: (showFormulas?: boolean) => void;
  onExportPdf?: (showFormulas?: boolean) => void;
  clients: MasterDataItem[];
  truckTypes: MasterDataItem[];
  locations: MasterDataItem[];
  onAddMasterData: (
    kind: MasterDataKind,
    name: string
  ) => Promise<MasterDataItem | null>;
  companyProfiles?: CompanyProfile[];
  onSelectCompanyProfile?: (profile: CompanyProfile) => void;
  onSaveCurrentToCompanyProfile?: (companyNameOrId: string) => void;
  onOpenCompanyProfilesModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  input,
  setInput,
  result,
  expenses,
  setExpenses,
  interestTranches,
  tdsSettings,
  generalSettings,
  onNavigateTab,
  onSaveCalculation,
  onExportExcel,
  onPrintReport,
  onExportPdf,
  clients,
  truckTypes,
  locations,
  onAddMasterData,
  companyProfiles = [],
  onSelectCompanyProfile,
  onSaveCurrentToCompanyProfile,
  onOpenCompanyProfilesModal,
}) => {
  const [quickDays, setQuickDays] = useState<number>(input.customDays ?? 20);
  const [quickRate, setQuickRate] = useState<number>(
    input.customInterestRate ?? 1.0
  );
  // When off, printed/exported reports drop the "Formula / Basis" column
  // and show only the final amounts — a clean statement for handing to a
  // client without walking them through how the numbers were derived.
  const [showFormulas, setShowFormulas] = useState(true);
  const [profileSyncNotice, setProfileSyncNotice] = useState<string | null>(null);

  // Single Entry: Selling/Buying pricing-method handlers. sellingPrice /
  // buyingPrice stay the canonical amount the rest of the app reads —
  // when the method is Freight × PMT they're recomputed on every change.
  const updateSellingMethod = (method: PricingMethod) =>
    setInput((p) => ({
      ...p,
      sellingPricingMethod: method,
      sellingPrice:
        method === 'freight_pmt'
          ? (p.sellingFreightRate || 0) * (p.sellingPmt || 0)
          : p.sellingPrice,
    }));
  const updateSellingAmount = (amt: number) =>
    setInput((p) => ({ ...p, sellingPrice: amt }));
  const updateSellingFreightRate = (rate: number) =>
    setInput((p) => ({
      ...p,
      sellingFreightRate: rate,
      sellingPrice: rate * (p.sellingPmt || 0),
    }));
  const updateSellingPmt = (pmt: number) =>
    setInput((p) => ({
      ...p,
      sellingPmt: pmt,
      sellingPrice: (p.sellingFreightRate || 0) * pmt,
    }));

  const updateBuyingMethod = (method: PricingMethod) =>
    setInput((p) => ({
      ...p,
      buyingPricingMethod: method,
      buyingPrice:
        method === 'freight_pmt'
          ? (p.buyingFreightRate || 0) * (p.buyingPmt || 0)
          : p.buyingPrice,
    }));
  const updateBuyingAmount = (amt: number) =>
    setInput((p) => ({ ...p, buyingPrice: amt }));
  const updateBuyingFreightRate = (rate: number) =>
    setInput((p) => ({
      ...p,
      buyingFreightRate: rate,
      buyingPrice: rate * (p.buyingPmt || 0),
    }));
  const updateBuyingPmt = (pmt: number) =>
    setInput((p) => ({
      ...p,
      buyingPmt: pmt,
      buyingPrice: (p.buyingFreightRate || 0) * pmt,
    }));

  const handleDaysSlider = (days: number) => {
    setQuickDays(days);
    setInput((prev) => ({
      ...prev,
      customDays: days,
      creditPeriodDays: days,
    }));
  };

  const handleRateSlider = (rate: number) => {
    setQuickRate(rate);
    setInput((prev) => ({ ...prev, customInterestRate: rate }));
  };

  const resetQuickSliders = () => {
    setQuickDays(20);
    setQuickRate(1.0);
    setInput((prev) => ({
      ...prev,
      customDays: 20,
      creditPeriodDays: 20,
    }));
  };

  const handleToggleExpense = (id: string) => {
    if (!setExpenses) return;
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const handleUpdateExpenseName = (id: string, name: string) => {
    if (!setExpenses) return;
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, name } : e))
    );
  };

  const handleUpdateExpenseRate = (id: string, percentage: number) => {
    if (!setExpenses) return;
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, percentage } : e))
    );
  };

  const handleUpdateExpenseFixed = (id: string, fixedAmount: number) => {
    if (!setExpenses) return;
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, fixedAmount: Math.max(0, fixedAmount) } : e
      )
    );
  };

  const handleSelectClient = (clientName: string) => {
    setInput((p) => ({ ...p, clientName }));
    if (!clientName) return;
    const matchedProfile = companyProfiles.find(
      (cp) => cp.name.toLowerCase() === clientName.toLowerCase()
    );
    if (matchedProfile && onSelectCompanyProfile) {
      onSelectCompanyProfile(matchedProfile);
      setProfileSyncNotice(`✓ Applied engine settings for ${matchedProfile.name}`);
      setTimeout(() => setProfileSyncNotice(null), 3000);
    }
  };

  const activeCompanyProfile = companyProfiles.find(
    (cp) => cp.name.toLowerCase() === (input.clientName || '').toLowerCase()
  );

  const entryMode = input.vehicleEntryMode || 'single';

  const setEntryMode = (mode: 'single' | 'multiple') => {
    setInput((prev) => {
      if (mode === 'multiple') {
        const hasExisting = prev.vehicles && prev.vehicles.length > 0;
        const initialVehicles = hasExisting
          ? prev.vehicles
          : [
              {
                id: 'veh_' + Date.now() + '_0',
                vehicleNumber: prev.truckNumber || '',
                truckType: prev.truckType || '',
                sellingPricingMethod: (prev.sellingPricingMethod || 'fixed') as PricingMethod,
                sellingAmount: Number(prev.sellingPrice) || 0,
                buyingPricingMethod: (prev.buyingPricingMethod || 'fixed') as PricingMethod,
                buyingAmount: Number(prev.buyingPrice) || 0,
              },
              {
                id: 'veh_' + Date.now() + '_1',
                vehicleNumber: '',
                truckType: '',
                sellingPricingMethod: 'fixed' as PricingMethod,
                sellingAmount: 0,
                buyingPricingMethod: 'fixed' as PricingMethod,
                buyingAmount: 0,
              },
              {
                id: 'veh_' + Date.now() + '_2',
                vehicleNumber: '',
                truckType: '',
                sellingPricingMethod: 'fixed' as PricingMethod,
                sellingAmount: 0,
                buyingPricingMethod: 'fixed' as PricingMethod,
                buyingAmount: 0,
              },
            ];

        return {
          ...prev,
          vehicleEntryMode: 'multiple',
          vehicles: initialVehicles,
        };
      } else {
        // Switching back to single truck mode
        const firstVeh = prev.vehicles && prev.vehicles[0];
        return {
          ...prev,
          vehicleEntryMode: 'single',
          truckNumber: prev.truckNumber || firstVeh?.vehicleNumber || '',
        };
      }
    });
  };

  // Multiple Truck Entry: keep sellingPrice/buyingPrice in sync with the sum of all vehicle rows, automatically.
  React.useEffect(() => {
    if (entryMode !== 'multiple') return;
    if (!input.vehicles || input.vehicles.length === 0) return;

    const totals = input.vehicles.reduce(
      (acc, v) => {
        const { selling, buying } = vehicleAmounts(v);
        return { selling: acc.selling + selling, buying: acc.buying + buying };
      },
      { selling: 0, buying: 0 }
    );

    // Only update if there are vehicles with values or amounts changed
    const hasAnyContent = input.vehicles.some(
      (v) => (v.vehicleNumber && v.vehicleNumber.trim().length > 0) || Number(v.sellingAmount) > 0 || Number(v.buyingAmount) > 0
    );

    if (hasAnyContent && (totals.selling !== input.sellingPrice || totals.buying !== input.buyingPrice)) {
      setInput((prev) => ({
        ...prev,
        sellingPrice: totals.selling,
        buyingPrice: totals.buying,
      }));
    }
  }, [entryMode, input.vehicles, input.sellingPrice, input.buyingPrice, setInput]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner with Quick Actions */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Freight Profit Analysis • Trip Pricing Engine</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
              {input.clientName ||
                (input.fromLocation && input.toLocation
                  ? `${input.fromLocation} → ${input.toLocation}`
                  : input.title) ||
                'Freight Profit & Tax Computation'}
            </h1>
            <p className="text-sm text-slate-400">
              Trip Ref: <span className="text-slate-200 font-mono font-medium">{input.tripNumber || 'TR-001'}</span>
              {input.truckNumber && (
                <> • Truck No: <span className="text-amber-400 font-mono font-bold">{input.truckNumber}</span></>
              )}
              {input.fromLocation && input.toLocation && (
                <> • Route: <span className="text-slate-200 font-medium">{input.fromLocation} → {input.toLocation}</span></>
              )}
              {input.truckType && (
                <> • Truck Type: <span className="text-slate-200 font-medium">{input.truckType}</span></>
              )}
              {' '}• Currency: {generalSettings.currencyCode} ({generalSettings.currencySymbol})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showFormulas}
                onChange={(e) => setShowFormulas(e.target.checked)}
                className="accent-amber-500"
              />
              Show Formulas in Print/PDF
            </label>
            <button
              id="btn-save-calc"
              onClick={onSaveCalculation}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Trip</span>
            </button>
            <button
              id="btn-export-pdf"
              onClick={() => (onExportPdf || onPrintReport)(showFormulas)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition active:scale-95"
              title="Export official PDF report to mobile storage"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button
              id="btn-export-excel"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel Export</span>
            </button>
            <button
              id="btn-print-report"
              onClick={() => onPrintReport(showFormulas)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold shadow-md transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Warning Banners if any */}
        {result.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1">
            {result.warnings.map((warn, i) => (
              <div key={i} className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Revenue Inputs & Quick Adjusters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Input Card */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Core Trip Pricing</span>
            </h2>
            <span className="text-xs text-slate-400">Live Auto-calc</span>
          </div>

          {/* Truck Entry Mode Toggle: Single Truck Entry vs Multiple Truck Entry */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-700/60">
            <div className="inline-flex bg-slate-950 border border-slate-700 rounded-xl p-1 text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => setEntryMode('single')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  entryMode === 'single'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Single Truck Entry</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('multiple')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  entryMode === 'multiple'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multiple Truck Entry</span>
                {input.vehicles && input.vehicles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-300 text-[10px] font-mono font-bold">
                    {input.vehicles.length}
                  </span>
                )}
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              {entryMode === 'single' ? 'Single Vehicle Mode' : 'Multiple Trucks Mode'}
            </span>
          </div>

          <div className="space-y-3">
            {entryMode === 'single' ? (
              <>
                <PricingMethodField
                  label="Selling Price (Freight Charged to Client)"
                  currencySymbol={generalSettings.currencySymbol}
                  method={input.sellingPricingMethod || 'fixed'}
                  amount={input.sellingPrice}
                  freightRate={input.sellingFreightRate}
                  pmt={input.sellingPmt}
                  onMethodChange={updateSellingMethod}
                  onAmountChange={updateSellingAmount}
                  onFreightRateChange={updateSellingFreightRate}
                  onPmtChange={updateSellingPmt}
                />
                <PricingMethodField
                  label="Buying Price (Vehicle Hire / Lorry Payment)"
                  currencySymbol={generalSettings.currencySymbol}
                  method={input.buyingPricingMethod || 'fixed'}
                  amount={input.buyingPrice}
                  freightRate={input.buyingFreightRate}
                  pmt={input.buyingPmt}
                  onMethodChange={updateBuyingMethod}
                  onAmountChange={updateBuyingAmount}
                  onFreightRateChange={updateBuyingFreightRate}
                  onPmtChange={updateBuyingPmt}
                />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Truck Number in Single Entry */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Truck No. / Vehicle No.</span>
                    </label>
                    <input
                      type="text"
                      value={input.truckNumber || ''}
                      onChange={(e) =>
                        setInput((p) => ({ ...p, truckNumber: e.target.value.toUpperCase() }))
                      }
                      placeholder="e.g. MH12AB1234"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase focus:border-blue-500 placeholder-slate-500"
                    />
                  </div>

                  {/* Truck Type in Single Entry */}
                  <div>
                    <SearchableSelect
                      label="Truck Type"
                      value={input.truckType || ''}
                      onChange={(v) => setInput((p) => ({ ...p, truckType: v }))}
                      options={truckTypes}
                      onAddNew={(name) => onAddMasterData('truck_types', name)}
                      placeholder="Search or add truck type…"
                    />
                  </div>
                </div>
              </>
            ) : (
              <MultiVehiclePricingPanel
                vehicles={input.vehicles || []}
                onChange={(vehicles) => setInput((p) => ({ ...p, vehicles }))}
                truckTypes={truckTypes}
                onAddMasterData={onAddMasterData}
                currencySymbol={generalSettings.currencySymbol}
              />
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/60">
              {/* Trip / LR No. */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Trip / LR / Order No.
                </label>
                <input
                  type="text"
                  value={input.tripNumber || ''}
                  onChange={(e) =>
                    setInput((p) => ({ ...p, tripNumber: e.target.value }))
                  }
                  placeholder="TR-001"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500"
                />
              </div>

              {/* Title / Batch Name */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Trip Title / Label
                </label>
                <input
                  type="text"
                  value={input.title || ''}
                  onChange={(e) => setInput((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Mumbai Dispatch"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500"
                />
              </div>

              {/* Client Name (Company Profile) */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Client Name (Company Profile)</span>
                  </label>
                  {onOpenCompanyProfilesModal && (
                    <button
                      type="button"
                      onClick={onOpenCompanyProfilesModal}
                      className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5"
                    >
                      <span>Manage / Add Clients (+)</span>
                    </button>
                  )}
                </div>

                <select
                  value={input.clientName || ''}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500"
                >
                  <option value="">-- Select Company Profile (Client) --</option>
                  {companyProfiles.map((cp) => (
                    <option key={cp.id} value={cp.name}>
                      {cp.name} ({cp.paymentTermsDays || 20}d credit, {cp.interestRate || 1}% int, {cp.tdsSettings?.nominalTdsRate || 2}% TDS)
                    </option>
                  ))}
                  {clients
                    .filter(
                      (c) =>
                        !companyProfiles.some(
                          (cp) => cp.name.toLowerCase() === c.name.toLowerCase()
                        )
                    )
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>

                {/* Profile Engine Status & Sync */}
                {activeCompanyProfile && (
                  <div className="mt-1.5 p-2 rounded-lg bg-slate-950/80 border border-amber-500/30 text-[11px] text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <span className="text-amber-400 font-semibold">Engine Applied: </span>
                      <span>{activeCompanyProfile.paymentTermsDays || 20}d credit • {activeCompanyProfile.interestRate || 1}% interest • {activeCompanyProfile.tdsSettings?.nominalTdsRate || 2}% TDS</span>
                    </div>
                    {onSaveCurrentToCompanyProfile && (
                      <button
                        type="button"
                        onClick={() => onSaveCurrentToCompanyProfile(activeCompanyProfile.id)}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 shrink-0 self-start sm:self-auto"
                        title="Save any adjustments in Engine Settings back into this client's profile"
                      >
                        <Save className="w-3 h-3" />
                        <span>Update Profile Settings</span>
                      </button>
                    )}
                  </div>
                )}
                {profileSyncNotice && (
                  <div className="mt-1 text-[11px] text-emerald-400 font-semibold">
                    {profileSyncNotice}
                  </div>
                )}
              </div>

              {/* Locations */}
              <SearchableSelect
                label="From (Origin)"
                value={input.fromLocation || ''}
                onChange={(v) => setInput((p) => ({ ...p, fromLocation: v }))}
                options={locations}
                onAddNew={(name) => onAddMasterData('locations', name)}
                placeholder="Origin"
              />
              <SearchableSelect
                label="To (Destination)"
                value={input.toLocation || ''}
                onChange={(v) => setInput((p) => ({ ...p, toLocation: v }))}
                options={locations}
                onAddNew={(name) => onAddMasterData('locations', name)}
                placeholder="Destination"
              />

              {/* Trip Timing, Credit Period & TDS Schedule (Excel Model) */}
              <div className="col-span-2 pt-2 border-t border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Trip Timing & Credit Model</span>
                  </label>
                  <span className="text-[10px] text-slate-400">P&L Date Controls</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* LR Date */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      LR Date (Lorry Receipt)
                    </label>
                    <input
                      type="date"
                      value={input.lrDate || ''}
                      onChange={(e) =>
                        setInput((p) => ({ ...p, lrDate: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-blue-500"
                    />
                  </div>

                  {/* Credit Period (Days) */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] font-semibold text-slate-400">
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
                        setQuickDays(days);
                        setInput((p) => ({
                          ...p,
                          creditPeriodDays: days,
                          customDays: days,
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:border-blue-500"
                    />
                  </div>

                  {/* Credit Period Due Date (Auto-calculated) */}
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Credit Period Due Date</span>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                        Auto
                      </span>
                    </div>
                    <div className="text-xs font-black text-cyan-300 font-mono mt-0.5">
                      {result.creditPeriodDueDate || '—'}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      LR Date + {input.creditPeriodDays ?? 20} days
                    </div>
                  </div>

                  {/* Financial Year End Date & TDS Refund Period */}
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-400">
                        FY End Date
                      </label>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                        Auto TDS
                      </span>
                    </div>
                    <input
                      type="date"
                      value={input.financialYearEndDate || ''}
                      onChange={(e) =>
                        setInput((p) => ({
                          ...p,
                          financialYearEndDate: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-amber-500"
                    />
                    <div className="flex items-center justify-between text-[10px] pt-0.5">
                      <span className="text-slate-400">TDS Refund Period:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {result.tdsRefundPeriodMonths !== undefined
                          ? `${result.tdsRefundPeriodMonths} mos`
                          : '18 mos'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Validation warning if FY End Date < LR Date */}
                {input.lrDate &&
                  input.financialYearEndDate &&
                  input.financialYearEndDate < input.lrDate && (
                    <div className="p-2 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>
                        FY End Date is earlier than LR Date. TDS refund period cannot be negative.
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Quick Sliders for Days & Interest */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Fast Fin-Adjusters</span>
            </h2>
            <button
              onClick={resetQuickSliders}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Payment Cycle / Days</span>
                <span className="text-amber-400 font-bold text-sm">
                  {quickDays} Days
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="120"
                value={quickDays}
                onChange={(e) => handleDaysSlider(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span
                  onClick={() => handleDaysSlider(7)}
                  className="cursor-pointer hover:text-white"
                >
                  7d
                </span>
                <span
                  onClick={() => handleDaysSlider(15)}
                  className="cursor-pointer hover:text-white"
                >
                  15d
                </span>
                <span
                  onClick={() => handleDaysSlider(20)}
                  className="cursor-pointer text-amber-400 font-semibold"
                >
                  20d (Default)
                </span>
                <span
                  onClick={() => handleDaysSlider(45)}
                  className="cursor-pointer hover:text-white"
                >
                  45d
                </span>
                <span
                  onClick={() => handleDaysSlider(60)}
                  className="cursor-pointer hover:text-white"
                >
                  60d
                </span>
                <span
                  onClick={() => handleDaysSlider(90)}
                  className="cursor-pointer hover:text-white"
                >
                  90d
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Interest Rate (p.a.)</span>
                <span className="text-blue-400 font-bold text-sm">
                  {quickRate.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={quickRate}
                onChange={(e) => handleRateSlider(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span
                  onClick={() => handleRateSlider(0.5)}
                  className="cursor-pointer hover:text-white"
                >
                  0.5%
                </span>
                <span
                  onClick={() => handleRateSlider(1.0)}
                  className="cursor-pointer text-blue-400 font-semibold"
                >
                  1.0% (Default)
                </span>
                <span
                  onClick={() => handleRateSlider(1.5)}
                  className="cursor-pointer hover:text-white"
                >
                  1.5%
                </span>
                <span
                  onClick={() => handleRateSlider(2.0)}
                  className="cursor-pointer hover:text-white"
                >
                  2.0%
                </span>
                <span
                  onClick={() => handleRateSlider(3.0)}
                  className="cursor-pointer hover:text-white"
                >
                  3.0%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Margin Gauge / Health */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Profit Margin Pulse
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  result.profitAfterTax >= 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {result.profitAfterTax >= 0 ? 'Profitable' : 'Loss Trip'}
              </span>
            </div>
            <div className="text-3xl font-black text-white">
              {formatPercent(result.percentageOfSale, 2)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              PAT as percentage of Selling Price.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/80 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Net Profit (with TDS):</span>
              <span className="font-bold text-amber-400 font-mono">
                {formatCurrency(result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">% Profit After TDS Saving:</span>
              <span className="font-black text-cyan-300 font-mono">
                {formatPercent(result.tdsRefund.percentageOfProfitAfterTdsSaving, 2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Gross Margin:</span>
              <span className="font-semibold text-slate-200 font-mono">
                {formatPercent(result.grossProfitMargin, 2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Tax Liability (27%):</span>
              <span className="font-semibold text-rose-300 font-mono">
                {formatCurrency(result.incomeTax, generalSettings.currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Operating Expenses & Statutory P&L Breakdown */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">
                Trip Operating Expenses Breakdown
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Statutory TDS, Salaries, Management, Commission, Consultation, Ho Expenses (0.25%), and Other Expenses (Fixed ₹).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-right">
              <span className="text-slate-400">Total Operating: </span>
              <span className="font-bold text-amber-400 font-mono">
                {formatCurrency(result.totalOperatingExpenses, generalSettings.currencySymbol)}
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('settings')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium underline"
            >
              Engine Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {expenses.map((exp) => {
            const detail = result.expenseDetails.find((d) => d.id === exp.id);
            const computedAmt = detail?.amount ?? 0;
            const isOtherExp = exp.id === 'exp-other' || exp.name.toLowerCase().includes('other expense');

            return (
              <div
                key={exp.id}
                className={`p-3.5 rounded-xl border transition flex flex-col justify-between space-y-2.5 ${
                  exp.enabled
                    ? 'bg-slate-900/80 border-slate-700/90'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                }`}
              >
                {/* Header: Toggle & Editable Name */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={exp.enabled}
                      onChange={() => handleToggleExpense(exp.id)}
                      className="accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                      title={exp.enabled ? 'Enabled' : 'Disabled'}
                    />
                    <input
                      type="text"
                      value={exp.name}
                      onChange={(e) => handleUpdateExpenseName(exp.id, e.target.value)}
                      placeholder="Expense Name"
                      className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 text-xs font-semibold text-white truncate focus:outline-none w-full"
                      title="Click to rename this expense"
                    />
                  </div>
                  {exp.isTds && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
                      TDS 194C
                    </span>
                  )}
                  {exp.id === 'exp-ho' && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold shrink-0">
                      HO Exp
                    </span>
                  )}
                  {isOtherExp && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                      Editable
                    </span>
                  )}
                </div>

                {/* Rate / Amount input */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      {exp.basis === 'fixed_amount' ? 'Fixed ₹' : `${exp.basis.replace(/_/g, ' ')} %`}
                    </label>
                    {exp.basis === 'fixed_amount' ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1 text-slate-400 text-xs font-mono">
                          {generalSettings.currencySymbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={exp.fixedAmount}
                          onChange={(e) =>
                            handleUpdateExpenseFixed(
                              exp.id,
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-xs text-white font-mono font-bold focus:border-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.05"
                          value={exp.percentage}
                          onChange={(e) =>
                            handleUpdateExpenseRate(
                              exp.id,
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:border-blue-500"
                        />
                        <span className="absolute right-2 top-1 text-slate-400 text-xs font-mono">
                          %
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Computed Amount Display */}
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Computed</span>
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {formatCurrency(computedAmt, generalSettings.currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Core Dashboard Metric Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Key Financial Summary Cards</span>
          </h2>
          <button
            onClick={() => onNavigateTab('details')}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <span>View Formula Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {/* 1. Selling Price */}
          <div
            id="card-selling-price"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>1. Selling Price</span>
              <span className="text-blue-400 text-[10px]">Client Rate</span>
            </div>
            <div className="text-lg md:text-xl font-black text-white mt-1 tracking-tight">
              {formatCurrency(result.sellingPrice, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Base revenue billing
            </div>
          </div>

          {/* 2. Buying Price */}
          <div
            id="card-buying-price"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>2. Buying Price</span>
              <span className="text-slate-400 text-[10px]">Lorry Hire</span>
            </div>
            <div className="text-lg md:text-xl font-black text-white mt-1 tracking-tight">
              {formatCurrency(result.buyingPrice, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Direct transport cost
            </div>
          </div>

          {/* 3. Gross Profit */}
          <div
            id="card-gross-profit"
            className={`border rounded-2xl p-4 transition shadow-sm ${
              result.grossProfit >= 0
                ? 'bg-slate-800/90 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-400'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
              <span>3. Gross Profit</span>
              <span className="text-xs font-bold text-emerald-400">
                {result.grossProfitMargin}%
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-white mt-1 tracking-tight">
              {formatCurrency(result.grossProfit, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Selling Price − Buying Price
            </div>
          </div>

          {/* 4. Total Expenses */}
          <div
            id="card-total-expenses"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>4. Total Expenses</span>
              <span className="text-amber-400 text-[10px]">
                Int: {formatCurrency(result.totalInterest, generalSettings.currencySymbol)}
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-amber-300 mt-1 tracking-tight">
              {formatCurrency(result.netTotalExpenses, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              TDS, Salaries, Mgmt, Commission & Interest
            </div>
          </div>

          {/* 5. Net Profit Before Tax */}
          <div
            id="card-npbt"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>5. Net Profit Before Tax</span>
              <span className="text-blue-400 text-[10px]">NPBT</span>
            </div>
            <div
              className={`text-lg md:text-xl font-black mt-1 tracking-tight ${
                result.netProfitBeforeTax >= 0
                  ? 'text-white'
                  : 'text-rose-400'
              }`}
            >
              {formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Gross Profit − Net Total Expenses
            </div>
          </div>

          {/* 6. Income Tax */}
          <div
            id="card-income-tax"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>6. Income Tax</span>
              <span className="text-rose-400 text-[10px]">{result.incomeTaxRate}% Rate</span>
            </div>
            <div className="text-lg md:text-xl font-black text-rose-300 mt-1 tracking-tight">
              {formatCurrency(result.incomeTax, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {result.incomeTaxRate}% on NPBT
            </div>
          </div>

          {/* 7. Profit After Tax */}
          <div
            id="card-pat"
            className={`border rounded-2xl p-4 transition shadow-sm ${
              result.profitAfterTax >= 0
                ? 'bg-slate-800/90 border-emerald-500/50'
                : 'bg-rose-950/40 border-rose-500/50'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
              <span>7. Profit After Tax</span>
              <span className="text-emerald-400 text-[10px] font-bold">PAT</span>
            </div>
            <div
              className={`text-lg md:text-xl font-black mt-1 tracking-tight ${
                result.profitAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              NPBT − Income Tax
            </div>
          </div>

          {/* 8. TDS Saving */}
          <div
            id="card-tds-saving"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>8. Net Saving in TDS</span>
              <span className="text-amber-400 text-[10px]">Refund Gain</span>
            </div>
            <div className="text-lg md:text-xl font-black text-amber-300 mt-1 tracking-tight">
              {formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              TDS − Cost + IT Int − Tax
            </div>
          </div>

          {/* 9. Profit Percentage */}
          <div
            id="card-profit-percentage"
            className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>9. Percentage of Sale</span>
              <span className="text-cyan-400 text-[10px]">PAT / SP</span>
            </div>
            <div className="text-lg md:text-xl font-black text-cyan-300 mt-1 tracking-tight">
              {formatPercent(result.percentageOfSale, 2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              PAT ÷ Selling Price × 100
            </div>
          </div>

          {/* 10. Net Profit = Profit After Tax + Net Saving in TDS */}
          <div
            id="card-net-profit-tds"
            className="bg-emerald-950/20 border border-emerald-500/50 rounded-2xl p-4 hover:border-emerald-400 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
              <span className="font-bold text-emerald-300">10. Net Profit</span>
              <span className="text-emerald-400 text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                NPBT + TDS
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-emerald-300 mt-1 tracking-tight">
              {formatCurrency(result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Profit After Tax + Net Saving in TDS
            </div>
          </div>

          {/* 11. % of Profit After TDS Saving */}
          <div
            id="card-pct-profit-tds"
            className="bg-cyan-950/20 border border-cyan-500/50 rounded-2xl p-4 hover:border-cyan-400 transition shadow-sm"
          >
            <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
              <span className="font-bold text-cyan-300">11. % Profit After TDS</span>
              <span className="text-cyan-400 text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded font-bold">
                NP / SP × 100
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-cyan-300 mt-1 tracking-tight">
              {formatPercent(result.tdsRefund.percentageOfProfitAfterTdsSaving, 2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Net Profit ÷ Selling Price × 100
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Cost Distribution Visualizer */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Percent className="w-4 h-4 text-cyan-400" />
            <span>Selling Price Capital Split</span>
          </h3>
          <span className="text-xs text-slate-400">
            Total SP = {formatCurrency(result.sellingPrice, generalSettings.currencySymbol)}
          </span>
        </div>

        {/* Stacked bar */}
        {result.sellingPrice > 0 && (
          <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{
                width: `${Math.min(
                  100,
                  (result.buyingPrice / result.sellingPrice) * 100
                )}%`,
              }}
              className="bg-slate-500 h-full"
              title={`Buying Price: ${formatCurrency(result.buyingPrice, generalSettings.currencySymbol)}`}
            />
            <div
              style={{
                width: `${Math.min(
                  100,
                  (result.totalOperatingExpenses / result.sellingPrice) * 100
                )}%`,
              }}
              className="bg-amber-500 h-full"
              title={`Operating Expenses: ${formatCurrency(result.totalOperatingExpenses, generalSettings.currencySymbol)}`}
            />
            <div
              style={{
                width: `${Math.min(
                  100,
                  (result.totalInterest / result.sellingPrice) * 100
                )}%`,
              }}
              className="bg-indigo-500 h-full"
              title={`Interest Cost: ${formatCurrency(result.totalInterest, generalSettings.currencySymbol)}`}
            />
            <div
              style={{
                width: `${Math.min(
                  100,
                  (result.incomeTax / result.sellingPrice) * 100
                )}%`,
              }}
              className="bg-rose-500 h-full"
              title={`Income Tax: ${formatCurrency(result.incomeTax, generalSettings.currencySymbol)}`}
            />
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (result.profitAfterTax / result.sellingPrice) * 100)
                )}%`,
              }}
              className="bg-emerald-500 h-full"
              title={`Profit After Tax: ${formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}`}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="text-slate-400">
              Lorry Cost: {formatCurrency(result.buyingPrice, generalSettings.currencySymbol)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-400">
              Expenses: {formatCurrency(result.totalOperatingExpenses, generalSettings.currencySymbol)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-slate-400">
              Interest: {formatCurrency(result.totalInterest, generalSettings.currencySymbol)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-400">
              Tax: {formatCurrency(result.incomeTax, generalSettings.currencySymbol)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-emerald-400 font-semibold">
              Net PAT: {formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
