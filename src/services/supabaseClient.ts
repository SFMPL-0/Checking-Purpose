/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Falls back to the values below if no environment variables are set,
// so the app works out of the box. For production builds it's best
// practice to move these into a .env file (see .env.example) instead
// of hard-coding them.
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://oafjuhjnnddgegjzvghw.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_I8my-cbQctHNWVB42UrTMw_vOPhQPDt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Table names centralised here so a rename only needs one edit.
export const TABLES = {
  APP_STATE: 'app_state',
  SAVED_CALCULATIONS: 'saved_calculations',
  CALCULATION_HISTORY: 'calculation_history',
  CALCULATION_GROUPS: 'calculation_groups',
  CLIENTS: 'clients',
  TRUCK_TYPES: 'truck_types',
  LOCATIONS: 'locations',
} as const;

// Keys used inside the app_state key/value table.
export const APP_STATE_KEYS = {
  INPUT: 'current_input',
  EXPENSES: 'current_expenses',
  INTEREST: 'current_interest_tranches',
  TDS: 'current_tds_settings',
  GENERAL: 'current_general_settings',
  SCENARIOS: 'scenarios',
  COMPANY_PROFILES: 'company_profiles',
} as const;
