/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistence layer for the app. Backed by Supabase (Postgres) instead of
 * localStorage, so calculations, settings and scenarios sync across devices
 * and survive a browser/app reinstall.
 *
 * Two tables are used (see supabase-schema.sql for the exact DDL):
 *  - app_state:            a small key/value table holding the single
 *                           "current" input, expenses, interest tranches,
 *                           TDS settings, general settings and scenario list.
 *  - saved_calculations:   one row per saved trip/calculation snapshot.
 */

import {
  CalculationGroup,
  CalculationHistoryEntry,
  CalculationInput,
  CalculationResult,
  CompanyProfile,
  DailyGroupSummary,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  MasterDataItem,
  MasterDataKind,
  SavedCalculation,
  ScenarioDefinition,
  TdsRefundSettings,
  VehicleLineItem,
} from '../types';
import {
  DEFAULT_EXPENSES,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_INPUT,
  DEFAULT_INTEREST_TRANCHES,
  DEFAULT_TDS_SETTINGS,
  calculateFreightProfit,
  roundTo,
} from './calculationEngine';
import { APP_STATE_KEYS, supabase, TABLES } from './supabaseClient';

export const DEFAULT_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'sc-1',
    name: 'Scenario A (Standard Credit: 20 Days @ 1%)',
    sellingPrice: 50000,
    buyingPrice: 45000,
    days: 20,
    interestRate: 1.0,
    incomeTaxRate: 27.0,
    notes: 'Standard 20-day credit freight model',
  },
  {
    id: 'sc-2',
    name: 'Scenario B (Extended Credit: 45 Days @ 1.5%)',
    sellingPrice: 50000,
    buyingPrice: 45000,
    days: 45,
    interestRate: 1.5,
    incomeTaxRate: 27.0,
    notes: 'Delayed payment from consignee',
  },
  {
    id: 'sc-3',
    name: 'Scenario C (Higher Margin: ₹55,000 / 60 Days @ 2%)',
    sellingPrice: 55000,
    buyingPrice: 48000,
    days: 60,
    interestRate: 2.0,
    incomeTaxRate: 27.0,
    notes: 'Peak season premium freight quote',
  },
];

export interface AppState {
  input: CalculationInput;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  scenarios: ScenarioDefinition[];
  savedCalculations: SavedCalculation[];
  companyProfiles: CompanyProfile[];
  clients: MasterDataItem[];
  truckTypes: MasterDataItem[];
  locations: MasterDataItem[];
}

function getLocalItem<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setLocalItem(key: string, value: unknown): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

/**
 * Fetches every piece of app state in a handful of parallel round trips
 * (settings, saved calculations, and the three master-data lists) and
 * returns sane defaults or local cache for anything missing.
 */
export async function loadAllAppState(): Promise<AppState> {
  let stateResult: any = { data: null, error: null };
  let savedResult: any = { data: null, error: null };
  let clients: MasterDataItem[] = [];
  let truckTypes: MasterDataItem[] = [];
  let locations: MasterDataItem[] = [];

  try {
    const results = await Promise.all([
      Promise.resolve(supabase.from(TABLES.APP_STATE).select('key, value')).catch((err) => ({ data: null, error: err })),
      Promise.resolve(
        supabase
          .from(TABLES.SAVED_CALCULATIONS)
          .select('*')
          .order('created_at', { ascending: false })
      ).catch((err) => ({ data: null, error: err })),
      loadMasterData('clients').catch(() => []),
      loadMasterData('truck_types').catch(() => []),
      loadMasterData('locations').catch(() => []),
    ]);
    stateResult = results[0];
    savedResult = results[1];
    clients = results[2];
    truckTypes = results[3];
    locations = results[4];
  } catch (err) {
    console.warn('Failed to load app state from Supabase, checking local cache', err);
  }

  const kv = new Map<string, any>();
  if (stateResult?.data && Array.isArray(stateResult.data)) {
    stateResult.data.forEach((row: any) => {
      kv.set(row.key, row.value);
      setLocalItem(`app_state_${row.key}`, row.value);
    });
  }

  let savedCalculations: SavedCalculation[] = [];
  if (savedResult?.data && Array.isArray(savedResult.data)) {
    savedCalculations = savedResult.data.map(rowToSavedCalculation);
    setLocalItem('saved_calculations_cache', savedCalculations);
  } else {
    savedCalculations = getLocalItem<SavedCalculation[]>('saved_calculations_cache', []);
  }

  if (!clients || clients.length === 0) {
    clients = getLocalItem<MasterDataItem[]>('master_clients_cache', []);
  } else {
    setLocalItem('master_clients_cache', clients);
  }

  if (!truckTypes || truckTypes.length === 0) {
    truckTypes = getLocalItem<MasterDataItem[]>('master_truck_types_cache', []);
  } else {
    setLocalItem('master_truck_types_cache', truckTypes);
  }

  if (!locations || locations.length === 0) {
    locations = getLocalItem<MasterDataItem[]>('master_locations_cache', []);
  } else {
    setLocalItem('master_locations_cache', locations);
  }

  let companyProfiles =
    kv.get(APP_STATE_KEYS.COMPANY_PROFILES) ??
    getLocalItem<CompanyProfile[]>('company_profiles_cache', []);

  // Ensure default company profiles exist and sync with master clients
  if (!companyProfiles || companyProfiles.length === 0) {
    if (clients && clients.length > 0) {
      companyProfiles = clients.map((c) => ({
        id: 'cp_' + c.id,
        name: c.name,
        paymentTermsDays: 20,
        interestRate: 1.0,
        expenses: DEFAULT_EXPENSES,
        interestTranches: DEFAULT_INTEREST_TRANCHES,
        tdsSettings: DEFAULT_TDS_SETTINGS,
        generalSettings: DEFAULT_GENERAL_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    } else {
      companyProfiles = [
        {
          id: 'cp_standard',
          name: 'Standard Client Profile',
          paymentTermsDays: 20,
          interestRate: 1.0,
          notes: 'Default profile (20-day credit, 1% finance interest, 2% TDS)',
          expenses: DEFAULT_EXPENSES,
          interestTranches: DEFAULT_INTEREST_TRANCHES,
          tdsSettings: DEFAULT_TDS_SETTINGS,
          generalSettings: DEFAULT_GENERAL_SETTINGS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    setLocalItem('company_profiles_cache', companyProfiles);
  }

  // Ensure every company profile name is present in master clients list
  const existingClientNames = new Set(clients.map((c) => c.name.toLowerCase()));
  companyProfiles.forEach((cp) => {
    if (!existingClientNames.has(cp.name.toLowerCase())) {
      clients.push({ id: cp.id, name: cp.name });
    }
  });

  return {
    input: kv.get(APP_STATE_KEYS.INPUT) ?? getLocalItem(APP_STATE_KEYS.INPUT, DEFAULT_INPUT),
    expenses: kv.get(APP_STATE_KEYS.EXPENSES) ?? getLocalItem(APP_STATE_KEYS.EXPENSES, DEFAULT_EXPENSES),
    interestTranches:
      kv.get(APP_STATE_KEYS.INTEREST) ?? getLocalItem(APP_STATE_KEYS.INTEREST, DEFAULT_INTEREST_TRANCHES),
    tdsSettings: kv.get(APP_STATE_KEYS.TDS) ?? getLocalItem(APP_STATE_KEYS.TDS, DEFAULT_TDS_SETTINGS),
    generalSettings: kv.get(APP_STATE_KEYS.GENERAL) ?? getLocalItem(APP_STATE_KEYS.GENERAL, DEFAULT_GENERAL_SETTINGS),
    scenarios: kv.get(APP_STATE_KEYS.SCENARIOS) ?? getLocalItem(APP_STATE_KEYS.SCENARIOS, DEFAULT_SCENARIOS),
    savedCalculations,
    companyProfiles,
    clients,
    truckTypes,
    locations,
  };
}

function rowToSavedCalculation(row: any): SavedCalculation {
  const input = row.input || {};
  if (row.client_name && !input.clientName) input.clientName = row.client_name;
  if (row.truck_type && !input.truckType) input.truckType = row.truck_type;
  if (row.from_location && !input.fromLocation) input.fromLocation = row.from_location;
  if (row.to_location && !input.toLocation) input.toLocation = row.to_location;
  if (row.truck_number && !input.truckNumber) input.truckNumber = row.truck_number;
  if (!input.truckNumber && (row as any).truck_number) input.truckNumber = (row as any).truck_number;
  if (!input.truckNumber && Array.isArray(input.vehicles) && input.vehicles[0]?.vehicleNumber) {
    input.truckNumber = input.vehicles[0].vehicleNumber;
  }

  // Restore SP and BP from calculation result if 0 or missing in input JSON
  if ((input.sellingPrice === undefined || input.sellingPrice === null || Number(input.sellingPrice) === 0) && row.result?.sellingPrice) {
    input.sellingPrice = row.result.sellingPrice;
  }
  if ((input.buyingPrice === undefined || input.buyingPrice === null || Number(input.buyingPrice) === 0) && row.result?.buyingPrice) {
    input.buyingPrice = row.result.buyingPrice;
  }

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tripNumber: row.trip_number || input.tripNumber || '',
    notes: row.notes || input.notes || '',
    input,
    expenses: row.expenses,
    interestTranches: row.interest_tranches,
    tdsSettings: row.tds_settings,
    generalSettings: row.general_settings,
    result: row.result,
  };
}

async function upsertAppStateValue(key: string, value: unknown): Promise<void> {
  setLocalItem(`app_state_${key}`, value);
  try {
    const { error } = await supabase
      .from(TABLES.APP_STATE)
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) {
      console.warn(`Failed to save "${key}" to Supabase`, error);
    }
  } catch (err) {
    console.warn(`Failed to save "${key}" to Supabase (offline/error)`, err);
  }
}

export async function saveCompanyProfiles(profiles: CompanyProfile[]): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.COMPANY_PROFILES, profiles);
  setLocalItem('company_profiles_cache', profiles);
}

export async function saveCurrentInput(input: CalculationInput): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.INPUT, input);
}

export async function saveCurrentExpenses(
  expenses: ExpenseItem[]
): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.EXPENSES, expenses);
}

export async function saveCurrentInterestTranches(
  tranches: InterestTranche[]
): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.INTEREST, tranches);
}

export async function saveCurrentTdsSettings(
  settings: TdsRefundSettings
): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.TDS, settings);
}

export async function saveCurrentGeneralSettings(
  settings: GeneralSettings
): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.GENERAL, settings);
}

export async function saveScenarios(
  scenarios: ScenarioDefinition[]
): Promise<void> {
  await upsertAppStateValue(APP_STATE_KEYS.SCENARIOS, scenarios);
}

export async function saveNewCalculation(
  name: string,
  input: CalculationInput,
  expenses: ExpenseItem[],
  interestTranches: InterestTranche[],
  tdsSettings: TdsRefundSettings,
  generalSettings: GeneralSettings,
  tripNumber?: string,
  notes?: string
): Promise<SavedCalculation> {
  const isMultiple = input.vehicleEntryMode === 'multiple';
  const cleanInput: CalculationInput = {
    ...input,
    vehicleEntryMode: isMultiple ? 'multiple' : 'single',
    vehicles: isMultiple ? (input.vehicles || []) : [],
    truckNumber: (input.truckNumber || '').trim().toUpperCase(),
    sellingPrice: Number(input.sellingPrice) || 0,
    buyingPrice: Number(input.buyingPrice) || 0,
  };

  const result = calculateFreightProfit(
    cleanInput,
    expenses,
    interestTranches,
    tdsSettings,
    generalSettings
  );

  const nowIso = new Date().toISOString();
  const id = 'calc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const newRecord: SavedCalculation = {
    id,
    name: name.trim() || `Calculation ${new Date().toLocaleDateString()}`,
    createdAt: nowIso,
    updatedAt: nowIso,
    tripNumber: tripNumber || cleanInput.tripNumber || '',
    notes: notes || cleanInput.notes || '',
    input: cleanInput,
    expenses: JSON.parse(JSON.stringify(expenses)),
    interestTranches: JSON.parse(JSON.stringify(interestTranches)),
    tdsSettings: JSON.parse(JSON.stringify(tdsSettings)),
    generalSettings: JSON.parse(JSON.stringify(generalSettings)),
    result,
  };

  try {
    const payload: any = {
      id: newRecord.id,
      name: newRecord.name,
      trip_number: newRecord.tripNumber,
      notes: newRecord.notes,
      client_name: cleanInput.clientName || null,
      truck_type: cleanInput.truckType || null,
      from_location: cleanInput.fromLocation || null,
      to_location: cleanInput.toLocation || null,
      input: newRecord.input,
      expenses: newRecord.expenses,
      interest_tranches: newRecord.interestTranches,
      tds_settings: newRecord.tdsSettings,
      general_settings: newRecord.generalSettings,
      result: newRecord.result,
      created_at: newRecord.createdAt,
      updated_at: newRecord.updatedAt,
    };
    if (cleanInput.truckNumber) {
      payload.truck_number = cleanInput.truckNumber;
    }

    let { error } = await supabase.from(TABLES.SAVED_CALCULATIONS).insert(payload);
    if (error && error.message && error.message.includes('truck_number')) {
      delete payload.truck_number;
      const retry = await supabase.from(TABLES.SAVED_CALCULATIONS).insert(payload);
      error = retry.error;
    }

    if (error) {
      console.warn('Failed to save calculation to Supabase', error);
    }
  } catch (err) {
    console.warn('Supabase offline, saving calculation locally', err);
  }

  const cached = getLocalItem<SavedCalculation[]>('saved_calculations_cache', []);
  setLocalItem('saved_calculations_cache', [newRecord, ...cached.filter((c) => c.id !== newRecord.id)]);

  return newRecord;
}

export async function deleteSavedCalculation(
  id: string
): Promise<SavedCalculation[]> {
  try {
    const { error } = await supabase
      .from(TABLES.SAVED_CALCULATIONS)
      .delete()
      .eq('id', id);
    if (error) {
      console.warn('Failed to delete calculation from Supabase', error);
    }
  } catch (err) {
    console.warn('Failed to delete calculation from Supabase (offline)', err);
  }

  const cached = getLocalItem<SavedCalculation[]>('saved_calculations_cache', []);
  const updated = cached.filter((c) => c.id !== id);
  setLocalItem('saved_calculations_cache', updated);

  return refetchSavedCalculations();
}

export async function duplicateSavedCalculation(
  id: string
): Promise<SavedCalculation | null> {
  let target: SavedCalculation | null = null;
  try {
    const { data, error } = await supabase
      .from(TABLES.SAVED_CALCULATIONS)
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      target = rowToSavedCalculation(data);
    }
  } catch {}

  if (!target) {
    const cached = getLocalItem<SavedCalculation[]>('saved_calculations_cache', []);
    target = cached.find((c) => c.id === id) || null;
  }

  if (!target) {
    console.error('Failed to load calculation to duplicate');
    return null;
  }

  const nowIso = new Date().toISOString();
  const duplicated: SavedCalculation = {
    ...JSON.parse(JSON.stringify(target)),
    id: 'calc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: `${target.name} (Copy)`,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const { error: insertError } = await supabase
      .from(TABLES.SAVED_CALCULATIONS)
      .insert({
        id: duplicated.id,
        name: duplicated.name,
        trip_number: duplicated.tripNumber,
        notes: duplicated.notes,
        input: duplicated.input,
        expenses: duplicated.expenses,
        interest_tranches: duplicated.interestTranches,
        tds_settings: duplicated.tdsSettings,
        general_settings: duplicated.generalSettings,
        result: duplicated.result,
        created_at: duplicated.createdAt,
        updated_at: duplicated.updatedAt,
      });

    if (insertError) {
      console.warn('Failed to duplicate calculation in Supabase', insertError);
    }
  } catch (err) {
    console.warn('Supabase offline during duplicate', err);
  }

  const cached = getLocalItem<SavedCalculation[]>('saved_calculations_cache', []);
  setLocalItem('saved_calculations_cache', [duplicated, ...cached]);

  return duplicated;
}

export async function refetchSavedCalculations(): Promise<SavedCalculation[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.SAVED_CALCULATIONS)
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const items = data.map(rowToSavedCalculation);
      setLocalItem('saved_calculations_cache', items);
      return items;
    }
  } catch (err) {
    console.warn('Failed to reload saved calculations from Supabase', err);
  }

  return getLocalItem<SavedCalculation[]>('saved_calculations_cache', []);
}

export async function resetAllToDefaults(): Promise<void> {
  await Promise.all([
    saveCurrentInput(DEFAULT_INPUT),
    saveCurrentExpenses(DEFAULT_EXPENSES),
    saveCurrentInterestTranches(DEFAULT_INTEREST_TRANCHES),
    saveCurrentTdsSettings(DEFAULT_TDS_SETTINGS),
    saveCurrentGeneralSettings(DEFAULT_GENERAL_SETTINGS),
    saveScenarios(DEFAULT_SCENARIOS),
  ]);
}

// ============================================================================
// Automatic Calculation History Log
//
// Every calculation performed is logged here in the background (debounced,
// see App.tsx) — completely separate from the explicit "Save Current Trip"
// flow. This means even calculations the user never bothered to name/save
// can still be found and reopened later.
// ============================================================================

function rowToCalculationHistoryEntry(row: any): CalculationHistoryEntry {
  const input = row.input || {};
  if (row.client_name && !input.clientName) input.clientName = row.client_name;
  if (row.truck_type && !input.truckType) input.truckType = row.truck_type;
  if (row.trip_number && !input.tripNumber) input.tripNumber = row.trip_number;
  if (row.truck_number && !input.truckNumber) input.truckNumber = row.truck_number;
  if (!input.truckNumber && (row as any).truck_number) input.truckNumber = (row as any).truck_number;
  if (!input.truckNumber && Array.isArray(input.vehicles) && input.vehicles[0]?.vehicleNumber) {
    input.truckNumber = input.vehicles[0].vehicleNumber;
  }

  // Restore SP and BP from calculation result or top-level columns if 0 or missing in input JSON
  if ((input.sellingPrice === undefined || input.sellingPrice === null || Number(input.sellingPrice) === 0)) {
    input.sellingPrice = row.selling_price ?? row.result?.sellingPrice ?? 0;
  }
  if ((input.buyingPrice === undefined || input.buyingPrice === null || Number(input.buyingPrice) === 0)) {
    input.buyingPrice = row.buying_price ?? row.result?.buyingPrice ?? 0;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    input,
    expenses: row.expenses,
    interestTranches: row.interest_tranches,
    tdsSettings: row.tds_settings,
    generalSettings: row.general_settings,
    result: row.result,
  };
}

/**
 * Inserts one snapshot into the calculation_history table. Fire-and-forget
 * from the caller's perspective is fine, but errors are surfaced so the
 * caller can log/report a failed sync if it wants to.
 *
 * trip_number / selling_price / buying_price / net_profit are written as
 * plain (indexed) columns in addition to living inside `input`/`result`
 * JSONB, so that at 5-years-of-daily-use scale (tens of thousands of rows)
 * listing and searching this table doesn't require Postgres to parse JSON
 * on every row — it can use the indexes directly.
 */
export async function logCalculationHistory(
  input: CalculationInput,
  expenses: ExpenseItem[],
  interestTranches: InterestTranche[],
  tdsSettings: TdsRefundSettings,
  generalSettings: GeneralSettings,
  result: CalculationResult
): Promise<void> {
  const id =
    'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const { error } = await supabase.from(TABLES.CALCULATION_HISTORY).insert({
    id,
    trip_number: input.tripNumber || null,
    client_name: input.clientName || null,
    truck_type: input.truckType || null,
    selling_price: result.sellingPrice,
    buying_price: result.buyingPrice,
    net_profit: result.tdsRefund.netProfitWithTdsSaving,
    input,
    expenses,
    interest_tranches: interestTranches,
    tds_settings: tdsSettings,
    general_settings: generalSettings,
    result,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to log calculation history to Supabase', error);
    throw error;
  }
}

export interface CalculationHistoryPage {
  entries: CalculationHistoryEntry[];
  /** True if there are older rows beyond this page (pass the last entry's
   *  createdAt as `before` to fetch the next page). */
  hasMore: boolean;
}

export interface LoadCalculationHistoryOptions {
  /** Page size. Defaults to 50 — kept deliberately small since this table
   *  can hold years of data; the UI pages through it rather than loading
   *  everything at once. */
  limit?: number;
  /** Keyset cursor: only return rows strictly older than this ISO
   *  timestamp. Pass the `createdAt` of the last row you already have to
   *  fetch the next page — this stays fast (index range scan) no matter
   *  how deep into 5 years of history you go, unlike OFFSET pagination
   *  which gets slower the further back you page. */
  before?: string;
  /** Optional filter: trip/LR number contains this text (case-insensitive).
   *  Uses the trip_number column/index rather than scanning the JSONB. */
  tripNumber?: string;
}

/**
 * Loads a page of the calculation history log, newest first, using keyset
 * (cursor) pagination rather than OFFSET so it stays fast at any table size.
 */
export async function loadCalculationHistory(
  options: LoadCalculationHistoryOptions = {}
): Promise<CalculationHistoryPage> {
  const { limit = 50, before, tripNumber } = options;

  let query = supabase
    .from(TABLES.CALCULATION_HISTORY)
    .select('*')
    .order('created_at', { ascending: false })
    // Fetch one extra row so we know whether another page exists without a
    // separate count() query.
    .limit(limit + 1);

  if (before) {
    query = query.lt('created_at', before);
  }
  if (tripNumber && tripNumber.trim()) {
    query = query.ilike('trip_number', `%${tripNumber.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to load calculation history from Supabase', error);
    return { entries: [], hasMore: false };
  }

  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    entries: page.map(rowToCalculationHistoryEntry),
    hasMore,
  };
}

export async function deleteCalculationHistoryEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.CALCULATION_HISTORY)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Failed to delete calculation history entry', error);
    throw error;
  }
}

/** Wipes the entire automatic history log. Saved trips are untouched. */
export async function clearCalculationHistory(): Promise<void> {
  const { error } = await supabase
    .from(TABLES.CALCULATION_HISTORY)
    .delete()
    .not('id', 'is', null);
  if (error) {
    console.error('Failed to clear calculation history', error);
    throw error;
  }
}

// ============================================================================
// Multi-Vehicle Bulk Entry Groups
//
// For days with many vehicles/trips, the user adds them all at once as a
// list of {vehicleNumber, sellingPrice, buyingPrice} rows. Their selling and
// buying prices are summed, one calculation runs on the totals (same
// expenses/interest/TDS/tax engine as everywhere else), and the whole batch
// — vehicles + aggregated result — is saved as one "group" row so the user
// can later see exactly how much business was done on any given day.
// ============================================================================

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function rowToCalculationGroup(row: any): CalculationGroup {
  return {
    id: row.id,
    groupName: row.group_name,
    groupDate: row.group_date,
    vehicles: row.vehicles,
    totalSellingPrice: row.total_selling_price,
    totalBuyingPrice: row.total_buying_price,
    expenses: row.expenses,
    interestTranches: row.interest_tranches,
    tdsSettings: row.tds_settings,
    generalSettings: row.general_settings,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Sums a list of vehicle rows, runs the normal calculation engine once on
 * the totals, and saves the whole batch (vehicles + aggregated result) to
 * Supabase as one group.
 */
export async function saveCalculationGroup(
  groupName: string,
  vehicles: VehicleLineItem[],
  expenses: ExpenseItem[],
  interestTranches: InterestTranche[],
  tdsSettings: TdsRefundSettings,
  generalSettings: GeneralSettings,
  groupDate?: string
): Promise<CalculationGroup> {
  const totalSellingPrice = roundTo(
    vehicles.reduce((sum, v) => sum + (Number(v.sellingPrice) || 0), 0),
    2
  );
  const totalBuyingPrice = roundTo(
    vehicles.reduce((sum, v) => sum + (Number(v.buyingPrice) || 0), 0),
    2
  );

  const input: CalculationInput = {
    sellingPrice: totalSellingPrice,
    buyingPrice: totalBuyingPrice,
  };

  const result = calculateFreightProfit(
    input,
    expenses,
    interestTranches,
    tdsSettings,
    generalSettings
  );

  const nowIso = new Date().toISOString();
  const id = 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const resolvedGroupDate = groupDate || todayIsoDate();

  const group: CalculationGroup = {
    id,
    groupName: groupName.trim() || `Batch ${resolvedGroupDate}`,
    groupDate: resolvedGroupDate,
    vehicles: JSON.parse(JSON.stringify(vehicles)),
    totalSellingPrice,
    totalBuyingPrice,
    expenses: JSON.parse(JSON.stringify(expenses)),
    interestTranches: JSON.parse(JSON.stringify(interestTranches)),
    tdsSettings: JSON.parse(JSON.stringify(tdsSettings)),
    generalSettings: JSON.parse(JSON.stringify(generalSettings)),
    result,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const { error } = await supabase.from(TABLES.CALCULATION_GROUPS).insert({
    id: group.id,
    group_name: group.groupName,
    group_date: group.groupDate,
    vehicle_count: group.vehicles.length,
    total_selling_price: group.totalSellingPrice,
    total_buying_price: group.totalBuyingPrice,
    net_profit: group.result.tdsRefund.netProfitWithTdsSaving,
    vehicles: group.vehicles,
    expenses: group.expenses,
    interest_tranches: group.interestTranches,
    tds_settings: group.tdsSettings,
    general_settings: group.generalSettings,
    result: group.result,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
  });

  if (error) {
    console.error('Failed to save calculation group to Supabase', error);
    throw error;
  }

  return group;
}

export interface CalculationGroupPage {
  entries: CalculationGroup[];
  hasMore: boolean;
}

export interface LoadCalculationGroupsOptions {
  limit?: number;
  /** Keyset cursor (see loadCalculationHistory) — pass the last entry's
   *  createdAt to fetch the next page. */
  before?: string;
  /** Only groups whose groupDate falls in this inclusive range. Use the
   *  same value for both to get a single day. */
  dateFrom?: string;
  dateTo?: string;
}

export async function loadCalculationGroups(
  options: LoadCalculationGroupsOptions = {}
): Promise<CalculationGroupPage> {
  const { limit = 30, before, dateFrom, dateTo } = options;

  let query = supabase
    .from(TABLES.CALCULATION_GROUPS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (before) query = query.lt('created_at', before);
  if (dateFrom) query = query.gte('group_date', dateFrom);
  if (dateTo) query = query.lte('group_date', dateTo);

  const { data, error } = await query;

  if (error) {
    console.error('Failed to load calculation groups from Supabase', error);
    return { entries: [], hasMore: false };
  }

  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return { entries: page.map(rowToCalculationGroup), hasMore };
}

export async function deleteCalculationGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.CALCULATION_GROUPS)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Failed to delete calculation group', error);
    throw error;
  }
}

/**
 * Aggregates every group within [dateFrom, dateTo] into one row per day —
 * "how much did I do today / this week / this month". Only the lightweight
 * numeric columns are fetched (not the full vehicles/result JSONB), so this
 * stays fast even after years of daily use.
 */
export async function loadDailyGroupSummary(
  dateFrom: string,
  dateTo: string
): Promise<DailyGroupSummary[]> {
  const { data, error } = await supabase
    .from(TABLES.CALCULATION_GROUPS)
    .select('group_date, vehicle_count, total_selling_price, total_buying_price, net_profit')
    .gte('group_date', dateFrom)
    .lte('group_date', dateTo);

  if (error) {
    console.error('Failed to load daily group summary from Supabase', error);
    return [];
  }

  const byDate = new Map<string, DailyGroupSummary>();
  for (const row of data || []) {
    const existing = byDate.get(row.group_date) || {
      groupDate: row.group_date,
      groupCount: 0,
      vehicleCount: 0,
      totalSellingPrice: 0,
      totalBuyingPrice: 0,
      totalNetProfit: 0,
    };
    existing.groupCount += 1;
    existing.vehicleCount += row.vehicle_count || 0;
    existing.totalSellingPrice += Number(row.total_selling_price) || 0;
    existing.totalBuyingPrice += Number(row.total_buying_price) || 0;
    existing.totalNetProfit += Number(row.net_profit) || 0;
    byDate.set(row.group_date, existing);
  }

  return Array.from(byDate.values()).sort((a, b) =>
    b.groupDate.localeCompare(a.groupDate)
  );
}

// ============================================================================
// Master Data (Client Names, Truck Types, From/To Locations)
//
// Pure autocomplete suggestion lists — deliberately NOT foreign keys into
// saved_calculations / calculation_groups / calculation_history. Those
// tables keep their own copy of the name as plain text at the time it was
// entered, so renaming or deleting a client/truck type here never breaks
// (or silently rewrites) historical pricing records.
// ============================================================================

const MASTER_TABLE: Record<MasterDataKind, string> = {
  clients: TABLES.CLIENTS,
  truck_types: TABLES.TRUCK_TYPES,
  locations: TABLES.LOCATIONS,
};

export async function loadMasterData(
  kind: MasterDataKind
): Promise<MasterDataItem[]> {
  try {
    const { data, error } = await supabase
      .from(MASTER_TABLE[kind])
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.warn(`Failed to load ${kind} from Supabase`, error);
      return getLocalItem<MasterDataItem[]>(`master_${kind}_cache`, []);
    }
    if (data && Array.isArray(data)) {
      setLocalItem(`master_${kind}_cache`, data);
    }
    return data || [];
  } catch (err) {
    console.warn(`Network error loading ${kind} from Supabase`, err);
    return getLocalItem<MasterDataItem[]>(`master_${kind}_cache`, []);
  }
}

/**
 * Adds a new name to a master list, case-insensitively deduplicated (a
 * unique index on lower(name) enforces this at the DB level too — see
 * supabase-schema.sql). If the name already exists, returns the existing
 * row instead of erroring, so "Add New" is always safe to click.
 */
export async function addMasterDataItem(
  kind: MasterDataKind,
  name: string
): Promise<MasterDataItem | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const table = MASTER_TABLE[kind];
  const id = kind + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  try {
    const { data, error } = await supabase
      .from(table)
      .insert({ id, name: trimmed })
      .select('id, name')
      .single();

    if (!error && data) {
      const cached = getLocalItem<MasterDataItem[]>(`master_${kind}_cache`, []);
      setLocalItem(`master_${kind}_cache`, [...cached.filter((c) => c.id !== data.id), data]);
      return data;
    }

    // Likely a duplicate (unique index on lower(name)) — look up the existing
    // row instead of failing the "Add New" action.
    const { data: existing } = await supabase
      .from(table)
      .select('id, name')
      .ilike('name', trimmed)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const cached = getLocalItem<MasterDataItem[]>(`master_${kind}_cache`, []);
      setLocalItem(`master_${kind}_cache`, [...cached.filter((c) => c.id !== existing.id), existing]);
      return existing;
    }
  } catch (err) {
    console.warn(`Failed to add "${trimmed}" to ${kind} on Supabase`, err);
  }

  // Local fallback
  const localItem: MasterDataItem = { id, name: trimmed };
  const cached = getLocalItem<MasterDataItem[]>(`master_${kind}_cache`, []);
  if (!cached.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    setLocalItem(
      `master_${kind}_cache`,
      [...cached, localItem].sort((a, b) => a.name.localeCompare(b.name))
    );
  }
  return localItem;
}
