/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalculationGroup,
  CalculationHistoryEntry,
  CalculationInput,
  CalculationResult,
  CompanyProfile,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  MasterDataItem,
  MasterDataKind,
  SavedCalculation,
  ScenarioDefinition,
  TdsRefundSettings,
  VehicleLineItem,
} from './types';
import {
  calculateFreightProfit,
  DEFAULT_EXPENSES,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_INPUT,
  DEFAULT_INTEREST_TRANCHES,
  DEFAULT_TDS_SETTINGS,
} from './services/calculationEngine';
import {
  clearCalculationHistory,
  DEFAULT_SCENARIOS,
  addMasterDataItem,
  deleteCalculationGroup,
  deleteSavedCalculation,
  duplicateSavedCalculation,
  loadAllAppState,
  loadCalculationHistory,
  loadCalculationGroups,
  loadDailyGroupSummary,
  logCalculationHistory,
  saveCalculationGroup,
  saveCompanyProfiles,
  saveCurrentExpenses,
  saveCurrentGeneralSettings,
  saveCurrentInput,
  saveCurrentInterestTranches,
  saveCurrentTdsSettings,
  saveNewCalculation,
  saveScenarios,
} from './services/storage';
import {
  exportCalculationToExcel,
  exportCalculationToPdf,
  printCalculationReport,
} from './services/exportService';

import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { QuickCalcView } from './components/QuickCalcView';
import { BulkEntryView, InitialBatchData } from './components/BulkEntryView';
import { CalculationDetailsView } from './components/CalculationDetailsView';
import { ScenarioView } from './components/ScenarioView';
import { SettingsView } from './components/SettingsView';
import { SettingsPasswordGate } from './components/SettingsPasswordGate';
import { HistoryReportsView } from './components/HistoryReportsView';
import { CompanyProfilesModal } from './components/CompanyProfilesModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [settingsSection, setSettingsSection] = useState<string | undefined>(
    undefined
  );

  // Whether the initial fetch from Supabase has completed. Used to avoid
  // clobbering the database with default values before the real data loads.
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active Calculation Input (persisted to Supabase)
  const [input, setInput] = useState<CalculationInput>(DEFAULT_INPUT);

  // Calculation Engine State (persisted to Supabase)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(DEFAULT_EXPENSES);
  const [interestTranches, setInterestTranches] = useState<InterestTranche[]>(
    DEFAULT_INTEREST_TRANCHES
  );
  const [tdsSettings, setTdsSettings] =
    useState<TdsRefundSettings>(DEFAULT_TDS_SETTINGS);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(
    DEFAULT_GENERAL_SETTINGS
  );

  // Scenarios State
  const [scenarios, setScenarios] =
    useState<ScenarioDefinition[]>(DEFAULT_SCENARIOS);

  // Saved Calculations History
  const [savedCalculations, setSavedCalculations] = useState<
    SavedCalculation[]
  >([]);

  // Company Profiles (Clients with individual Engine Settings)
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [showCompanyProfilesModal, setShowCompanyProfilesModal] = useState(false);

  // Initial batch state for Multi-Vehicle Entry (when reopened from History/Reports)
  const [bulkInitialBatch, setBulkInitialBatch] = useState<InitialBatchData | null>(null);

  // Core Trip Pricing master data (Client Name / Truck Type / From-To
  // Location suggestion lists) — pure autocomplete lists, not foreign keys.
  const [clients, setClients] = useState<MasterDataItem[]>([]);
  const [truckTypes, setTruckTypes] = useState<MasterDataItem[]>([]);
  const [locations, setLocations] = useState<MasterDataItem[]>([]);

  // Engine Settings is password-protected — re-locks whenever you navigate
  // away, so it must be unlocked again each time you open it.
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  useEffect(() => {
    if (activeTab !== 'settings') setSettingsUnlocked(false);
  }, [activeTab]);

  // One-time fetch of everything from Supabase on app start.
  useEffect(() => {
    let cancelled = false;
    loadAllAppState()
      .then((state) => {
        if (cancelled) return;
        setInput(state.input);
        setExpenses(state.expenses);
        setInterestTranches(state.interestTranches);
        setTdsSettings(state.tdsSettings);
        setGeneralSettings(state.generalSettings);
        setScenarios(state.scenarios);
        setSavedCalculations(state.savedCalculations);
        setCompanyProfiles(state.companyProfiles || []);
        setClients(state.clients);
        setTruckTypes(state.truckTypes);
        setLocations(state.locations);
      })
      .catch((err) => {
        console.error('Failed to load app state from Supabase', err);
        if (!cancelled) {
          setLoadError(
            'Could not connect to Supabase. Check your project URL/key and internet connection.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce helper: waits `delay` ms of inactivity before persisting, so
  // rapid edits (e.g. typing in a number field) don't fire a write per
  // keystroke. Skipped entirely until the initial Supabase load completes.
  function useDebouncedSave<T>(value: T, save: (v: T) => Promise<void>) {
    useEffect(() => {
      if (!isLoaded) return;
      const timer = setTimeout(() => {
        save(value).catch((err) =>
          console.error('Failed to save to Supabase', err)
        );
      }, 600);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, isLoaded]);
  }

  useDebouncedSave(input, saveCurrentInput);
  useDebouncedSave(expenses, saveCurrentExpenses);
  useDebouncedSave(interestTranches, saveCurrentInterestTranches);
  useDebouncedSave(tdsSettings, saveCurrentTdsSettings);
  useDebouncedSave(generalSettings, saveCurrentGeneralSettings);
  useDebouncedSave(scenarios, saveScenarios);

  // Live Computation
  const result: CalculationResult = useMemo(() => {
    return calculateFreightProfit(
      input,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings
    );
  }, [input, expenses, interestTranches, tdsSettings, generalSettings]);

  // Automatic Calculation History Log
  //
  // Earlier this logged a snapshot on every settled edit (2.5s debounce),
  // which meant every keystroke-adjacent tweak — including just adjusting
  // Engine Settings — created a new row. At real-world volume that grows
  // calculation_history unboundedly with mostly-redundant rows.
  //
  // Instead, this now logs only at a meaningful checkpoint: when you
  // navigate away from the calculator (Dashboard/Quick Calc) after entering
  // a real trip (selling & buying price both set), and only if it differs
  // from the last thing logged this session. That's roughly one row per
  // trip actually worked on, not one row per keystroke.
  const lastLoggedSignatureRef = useRef<string | null>(null);
  const prevActiveTabRef = useRef(activeTab);
  useEffect(() => {
    const leavingCalculator =
      prevActiveTabRef.current !== activeTab &&
      (prevActiveTabRef.current === 'dashboard' || prevActiveTabRef.current === 'quick');
    prevActiveTabRef.current = activeTab;

    if (!isLoaded || !leavingCalculator) return;
    if (!input.sellingPrice || !input.buyingPrice) return; // not a real trip yet

    const signature = JSON.stringify({
      input,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
    });
    if (signature === lastLoggedSignatureRef.current) return;

    logCalculationHistory(
      input,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      result
    )
      .then(() => {
        lastLoggedSignatureRef.current = signature;
      })
      .catch((err) =>
        console.error('Failed to auto-log calculation to Supabase', err)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Save Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTripNo, setSaveTripNo] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  const handleOpenSaveModal = () => {
    setSaveName(input.title || `Trip ${input.tripNumber || 'Calculation'}`);
    setSaveTripNo(input.tripNumber || 'TR-001');
    setSaveNotes(input.notes || '');
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!saveName.trim()) {
      alert('Please enter a calculation name.');
      return;
    }
    try {
      const saved = await saveNewCalculation(
        saveName.trim(),
        input,
        expenses,
        interestTranches,
        tdsSettings,
        generalSettings,
        saveTripNo.trim() || undefined,
        saveNotes.trim() || undefined
      );
      setSavedCalculations((prev) => [saved, ...prev]);
      setShowSaveModal(false);
      alert(`Calculation "${saved.name}" saved successfully!`);
    } catch (err) {
      alert('Failed to save calculation. Please check your connection and try again.');
    }
  };

  // Reopen calculation with historic snapshot preservation
  const handleReopenCalculation = (saved: SavedCalculation) => {
    const hasMultipleVehicles =
      saved.input.vehicleEntryMode === 'multiple' ||
      (Array.isArray(saved.input.vehicles) && saved.input.vehicles.length > 0);

    setInput({
      sellingPrice: saved.input.sellingPrice,
      buyingPrice: saved.input.buyingPrice,
      sellingPricingMethod: saved.input.sellingPricingMethod,
      sellingFreightRate: saved.input.sellingFreightRate,
      sellingPmt: saved.input.sellingPmt,
      buyingPricingMethod: saved.input.buyingPricingMethod,
      buyingFreightRate: saved.input.buyingFreightRate,
      buyingPmt: saved.input.buyingPmt,
      vehicleEntryMode: hasMultipleVehicles ? 'multiple' : 'single',
      vehicles: saved.input.vehicles || [],
      truckNumber: saved.input.truckNumber || (saved as any).truck_number || '',
      tripNumber: saved.tripNumber || saved.input.tripNumber || '',
      clientName: saved.input.clientName || (saved as any).client_name || '',
      fromLocation: saved.input.fromLocation || '',
      toLocation: saved.input.toLocation || '',
      truckType: saved.input.truckType || (saved as any).truck_type || '',
      title: saved.name,
      notes: saved.notes || saved.input.notes,
      customDays: saved.input.customDays,
      customInterestRate: saved.input.customInterestRate,
      companyProfileId: saved.input.companyProfileId,
    });
    setExpenses(saved.expenses);
    setInterestTranches(saved.interestTranches);
    setTdsSettings(saved.tdsSettings);
    setGeneralSettings(saved.generalSettings);
    setActiveTab('dashboard');
  };

  // Reopen an auto-logged history entry (unnamed) into the live calculator
  const handleReopenHistoryEntry = (entry: CalculationHistoryEntry) => {
    const hasMultipleVehicles =
      entry.input.vehicleEntryMode === 'multiple' ||
      (Array.isArray(entry.input.vehicles) && entry.input.vehicles.length > 0);

    setInput({
      ...entry.input,
      vehicleEntryMode: hasMultipleVehicles ? 'multiple' : (entry.input.vehicleEntryMode || 'single'),
      vehicles: entry.input.vehicles || [],
      truckNumber: entry.input.truckNumber || (entry as any).truck_number || '',
    });
    setExpenses(entry.expenses);
    setInterestTranches(entry.interestTranches);
    setTdsSettings(entry.tdsSettings);
    setGeneralSettings(entry.generalSettings);
    setActiveTab('dashboard');
  };

  // Promote an auto-logged history entry into the named Saved Trips archive
  const handleSaveHistoryEntry = async (
    entry: CalculationHistoryEntry,
    name: string
  ) => {
    const saved = await saveNewCalculation(
      name,
      entry.input,
      entry.expenses,
      entry.interestTranches,
      entry.tdsSettings,
      entry.generalSettings,
      entry.input.tripNumber,
      entry.input.notes
    );
    setSavedCalculations((prev) => [saved, ...prev]);
  };

  const handleDuplicate = async (id: string) => {
    const duplicated = await duplicateSavedCalculation(id);
    if (duplicated) {
      setSavedCalculations((prev) => [duplicated, ...prev]);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = await deleteSavedCalculation(id);
    setSavedCalculations(updated);
  };

  // Multi-Vehicle Bulk Entry: sums the vehicle rows' selling/buying prices,
  // runs the normal calculation engine once on the totals, and saves the
  // whole batch to Supabase as one group.
  const handleSaveGroup = async (
    groupName: string,
    vehicles: VehicleLineItem[],
    groupDate: string
  ) => {
    return saveCalculationGroup(
      groupName,
      vehicles,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      groupDate
    );
  };

  // Save full calculation snapshot from Bulk Entry View (preserves individual trucks)
  const handleSaveCalculationSnapshotFromBulk = async (
    name: string,
    vehicles: VehicleLineItem[],
    clientName?: string,
    groupDate?: string
  ) => {
    const totalSelling = vehicles.reduce((s, v) => s + (Number(v.sellingPrice) || 0), 0);
    const totalBuying = vehicles.reduce((s, v) => s + (Number(v.buyingPrice) || 0), 0);
    const batchInput: CalculationInput = {
      sellingPrice: totalSelling,
      buyingPrice: totalBuying,
      clientName: clientName || '',
      vehicleEntryMode: 'multiple',
      vehicles: vehicles.map((v) => ({
        id: v.id,
        vehicleNumber: v.vehicleNumber,
        sellingPricingMethod: 'fixed',
        sellingAmount: Number(v.sellingPrice) || 0,
        buyingPricingMethod: 'fixed',
        buyingAmount: Number(v.buyingPrice) || 0,
        notes: v.notes,
        truckType: v.truckType,
      })),
      title: name,
    };
    const saved = await saveNewCalculation(
      name,
      batchInput,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      `BATCH-${(groupDate || '').replace(/-/g, '')}`,
      `${vehicles.length} Trucks batch`
    );
    setSavedCalculations((prev) => [saved, ...prev]);
  };

  // Reopen a saved vehicle-group into Dashboard with Multiple Truck Entry mode so user sees ALL trucks!
  const handleReopenGroup = (group: CalculationGroup) => {
    const convertedVehicles = (group.vehicles || []).map((v, i) => ({
      id: v.id || 'veh_' + i,
      vehicleNumber: v.vehicleNumber || '',
      truckType: v.truckType || '',
      sellingPricingMethod: 'fixed' as const,
      sellingAmount: Number(v.sellingPrice) || 0,
      buyingPricingMethod: 'fixed' as const,
      buyingAmount: Number(v.buyingPrice) || 0,
    }));

    setInput({
      sellingPrice: group.totalSellingPrice,
      buyingPrice: group.totalBuyingPrice,
      title: group.groupName,
      vehicleEntryMode: 'multiple',
      vehicles: convertedVehicles,
    });
    setExpenses(group.expenses);
    setInterestTranches(group.interestTranches);
    setTdsSettings(group.tdsSettings);
    setGeneralSettings(group.generalSettings);
    setActiveTab('dashboard');
  };

  const handleDeleteGroup = async (id: string) => {
    await deleteCalculationGroup(id);
  };

  // Company Profile (Client) Handlers
  const handleSelectCompanyProfile = (profile: CompanyProfile) => {
    if (profile.expenses && profile.expenses.length > 0) {
      setExpenses(JSON.parse(JSON.stringify(profile.expenses)));
    }
    if (profile.interestTranches && profile.interestTranches.length > 0) {
      setInterestTranches(JSON.parse(JSON.stringify(profile.interestTranches)));
    }
    if (profile.tdsSettings) {
      setTdsSettings(JSON.parse(JSON.stringify(profile.tdsSettings)));
    }
    if (profile.generalSettings) {
      setGeneralSettings(JSON.parse(JSON.stringify(profile.generalSettings)));
    }
    setInput((prev) => ({
      ...prev,
      clientName: profile.name,
      companyProfileId: profile.id,
      customDays: profile.paymentTermsDays ?? prev.customDays,
      customInterestRate: profile.interestRate ?? prev.customInterestRate,
    }));
  };

  const handleSaveCompanyProfiles = async (updated: CompanyProfile[]) => {
    setCompanyProfiles(updated);
    await saveCompanyProfiles(updated);
    // sync client names
    for (const cp of updated) {
      if (!clients.some((c) => c.name.toLowerCase() === cp.name.toLowerCase())) {
        const added = await addMasterDataItem('clients', cp.name);
        if (added) {
          setClients((prev) => [...prev, added]);
        }
      }
    }
  };

  const handleSaveSingleCompanyProfile = async (profile: CompanyProfile) => {
    const exists = companyProfiles.some((p) => p.id === profile.id);
    let updated: CompanyProfile[];
    if (exists) {
      updated = companyProfiles.map((p) => (p.id === profile.id ? profile : p));
    } else {
      updated = [...companyProfiles, profile];
    }
    await handleSaveCompanyProfiles(updated);
  };

  const handleDeleteSingleCompanyProfile = async (id: string) => {
    const updated = companyProfiles.filter((p) => p.id !== id);
    await handleSaveCompanyProfiles(updated);
  };

  const handleSaveCurrentToCompanyProfile = async (companyIdOrName: string) => {
    const updated = companyProfiles.map((p) => {
      if (p.id === companyIdOrName || p.name.toLowerCase() === companyIdOrName.toLowerCase()) {
        return {
          ...p,
          expenses: JSON.parse(JSON.stringify(expenses)),
          interestTranches: JSON.parse(JSON.stringify(interestTranches)),
          tdsSettings: JSON.parse(JSON.stringify(tdsSettings)),
          generalSettings: JSON.parse(JSON.stringify(generalSettings)),
          paymentTermsDays: input.customDays ?? p.paymentTermsDays,
          interestRate: input.customInterestRate ?? p.interestRate,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    setCompanyProfiles(updated);
    await saveCompanyProfiles(updated);
    alert(`Updated company profile settings with current calculator engine!`);
  };

  // Core Trip Pricing: add a new Client/Truck Type/Location suggestion,
  // then make it immediately available in the dropdown.
  const handleAddMasterData = async (
    kind: MasterDataKind,
    name: string
  ): Promise<MasterDataItem | null> => {
    const created = await addMasterDataItem(kind, name);
    if (!created) return null;
    const setter =
      kind === 'clients' ? setClients : kind === 'truck_types' ? setTruckTypes : setLocations;
    setter((prev) =>
      prev.some((p) => p.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
    );
    return created;
  };

  const handleApplyScenario = (sc: ScenarioDefinition) => {
    setInput((prev) => ({
      ...prev,
      sellingPrice: sc.sellingPrice,
      buyingPrice: sc.buyingPrice,
      customDays: sc.days,
      customInterestRate: sc.interestRate,
      title: `${sc.name} Simulation`,
    }));
    setActiveTab('dashboard');
  };

  const handleNavigateToSettings = (sec?: string) => {
    setSettingsSection(sec);
    setActiveTab('settings');
  };

  const handleExportExcel = () => {
    exportCalculationToExcel(
      input,
      result,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      `Freight_${input.tripNumber || 'Trip'}.xlsx`
    );
  };

  const handlePrint = (showFormulas: boolean = true) => {
    printCalculationReport(
      input,
      result,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      showFormulas
    );
  };

  const handleExportPdf = async (showFormulas: boolean = true) => {
    await exportCalculationToPdf(
      input,
      result,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      undefined,
      showFormulas
    );
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-amber-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading your data from Supabase…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {loadError && (
        <div className="bg-red-900/60 border-b border-red-700 text-red-200 text-xs px-4 py-2 text-center">
          {loadError} Showing local defaults; changes may not be saved.
        </div>
      )}
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(t) => {
          setSettingsSection(undefined);
          setActiveTab(t);
        }}
        sellingPrice={result.sellingPrice}
        buyingPrice={result.buyingPrice}
        pat={result.profitAfterTax}
        marginPct={result.percentageOfSale}
        netProfitWithTds={result.tdsRefund.netProfitWithTdsSaving}
        pctProfitAfterTds={result.tdsRefund.percentageOfProfitAfterTdsSaving}
        generalSettings={generalSettings}
        onOpenCompanyProfilesModal={() => setShowCompanyProfilesModal(true)}
        activeClientName={input.clientName}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            input={input}
            setInput={setInput}
            result={result}
            expenses={expenses}
            interestTranches={interestTranches}
            tdsSettings={tdsSettings}
            generalSettings={generalSettings}
            onNavigateTab={setActiveTab}
            onSaveCalculation={handleOpenSaveModal}
            onExportExcel={handleExportExcel}
            onPrintReport={handlePrint}
            onExportPdf={handleExportPdf}
            clients={clients}
            truckTypes={truckTypes}
            locations={locations}
            onAddMasterData={handleAddMasterData}
            companyProfiles={companyProfiles}
            onSelectCompanyProfile={handleSelectCompanyProfile}
            onSaveCurrentToCompanyProfile={handleSaveCurrentToCompanyProfile}
            onOpenCompanyProfilesModal={() => setShowCompanyProfilesModal(true)}
          />
        )}

        {activeTab === 'quick' && (
          <QuickCalcView
            input={input}
            setInput={setInput}
            result={result}
            generalSettings={generalSettings}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'bulk' && (
          <BulkEntryView
            expenses={expenses}
            interestTranches={interestTranches}
            tdsSettings={tdsSettings}
            generalSettings={generalSettings}
            onSaveGroup={handleSaveGroup}
            onNavigateTab={setActiveTab}
            companyProfiles={companyProfiles}
            onSelectCompanyProfile={handleSelectCompanyProfile}
            onOpenCompanyProfilesModal={() => setShowCompanyProfilesModal(true)}
            initialBatch={bulkInitialBatch}
            onSaveCalculationSnapshot={handleSaveCalculationSnapshotFromBulk}
          />
        )}

        {activeTab === 'details' && (
          <CalculationDetailsView
            input={input}
            result={result}
            expenses={expenses}
            interestTranches={interestTranches}
            tdsSettings={tdsSettings}
            generalSettings={generalSettings}
            onNavigateSettings={handleNavigateToSettings}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioView
            scenarios={scenarios}
            setScenarios={setScenarios}
            expenses={expenses}
            interestTranches={interestTranches}
            tdsSettings={tdsSettings}
            generalSettings={generalSettings}
            onApplyScenarioToActive={handleApplyScenario}
          />
        )}

        {activeTab === 'settings' && (
          settingsUnlocked ? (
            <SettingsView
              expenses={expenses}
              setExpenses={setExpenses}
              interestTranches={interestTranches}
              setInterestTranches={setInterestTranches}
              tdsSettings={tdsSettings}
              setTdsSettings={setTdsSettings}
              generalSettings={generalSettings}
              setGeneralSettings={setGeneralSettings}
              initialSection={settingsSection}
            />
          ) : (
            <SettingsPasswordGate onUnlock={() => setSettingsUnlocked(true)} />
          )
        )}

        {activeTab === 'history' && (
          <HistoryReportsView
            savedCalculations={savedCalculations}
            onReopenCalculation={handleReopenCalculation}
            onDuplicateCalculation={handleDuplicate}
            onDeleteCalculation={handleDelete}
            currentInput={input}
            currentResult={result}
            expenses={expenses}
            interestTranches={interestTranches}
            tdsSettings={tdsSettings}
            generalSettings={generalSettings}
            onSaveCurrent={handleOpenSaveModal}
            onLoadCalculationHistory={loadCalculationHistory}
            onClearCalculationHistory={clearCalculationHistory}
            onReopenHistoryEntry={handleReopenHistoryEntry}
            onSaveHistoryEntry={handleSaveHistoryEntry}
            onLoadCalculationGroups={loadCalculationGroups}
            onLoadDailyGroupSummary={loadDailyGroupSummary}
            onDeleteCalculationGroup={handleDeleteGroup}
            onReopenGroup={handleReopenGroup}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      {/* Save Calculation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Save Trip Calculation Snapshot
            </h3>
            <p className="text-xs text-slate-400">
              Saves the current Selling Price ({generalSettings.currencySymbol}{input.sellingPrice.toLocaleString()}), Buying Price ({generalSettings.currencySymbol}{input.buyingPrice.toLocaleString()}), all interest rules, expenses, and TDS settings into an offline-first record.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">
                  Trip / Calculation Name *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500"
                  placeholder="e.g. Mumbai - Delhi Express"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">
                  Trip / LR Reference No.
                </label>
                <input
                  type="text"
                  value={saveTripNo}
                  onChange={(e) => setSaveTripNo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500"
                  placeholder="e.g. TR-001"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500"
                  placeholder="Add vehicle, driver or client remarks..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Company Profiles & Engine Settings Modal (Global) */}
      <CompanyProfilesModal
        isOpen={showCompanyProfilesModal}
        onClose={() => setShowCompanyProfilesModal(false)}
        profiles={companyProfiles}
        activeClientName={input.clientName}
        onSaveProfile={handleSaveSingleCompanyProfile}
        onDeleteProfile={handleDeleteSingleCompanyProfile}
        onApplyProfile={(profile) => {
          handleSelectCompanyProfile(profile);
          setShowCompanyProfilesModal(false);
        }}
        currentExpenses={expenses}
        currentInterestTranches={interestTranches}
        currentTdsSettings={tdsSettings}
        currentGeneralSettings={generalSettings}
      />
    </div>
  );
}
