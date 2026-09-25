/**
 * Domain types for Freight Profit, Tax & Interest Calculator
 */

export type ExpenseBasis =
  | 'selling_price'
  | 'buying_price'
  | 'gross_profit'
  | 'net_profit_before_tax'
  | 'fixed_amount';

export interface ExpenseItem {
  id: string;
  name: string;
  enabled: boolean;
  basis: ExpenseBasis;
  percentage: number; // e.g. 2.0 for 2%
  fixedAmount: number; // e.g. 5000
  isTds?: boolean; // Marks this expense as TDS (used in TDS claim section)
}

export interface InterestTranche {
  id: string;
  name: string;
  allocationPercentage: number; // e.g. 75 for 75%
  annualRate: number; // e.g. 1.0 for 1%
  days: number; // e.g. 20
  daysInYear: number; // e.g. 365
  isDailyRate: boolean; // false = annual (rate * days / 365), true = daily (rate * days)
  basis: 'selling_price' | 'buying_price';
}

export type TdsRefundMode = 'monthly' | 'annual' | 'flat';

export interface TdsRefundSettings {
  enabled: boolean;
  refundCarryingRate: number; // default 1.5%
  refundCarryingPeriodMonths: number; // default 18
  refundCarryingMode: TdsRefundMode; // 'monthly' = rate * months, 'annual' = rate * (months/12), 'flat' = rate
  itInterestRate: number; // default 0.5% (Section 244A IT Act)
  itInterestPeriodMonths: number; // default 6
  itInterestMode: TdsRefundMode; // default 'monthly' (0.5% per month for 6 months = 3%)
  actualTaxRate: number; // default 27%
  nominalTdsRate: number; // default 2%
  calculationBasis: 'selling_price' | 'gross_profit';
}

export interface GeneralSettings {
  currencySymbol: string; // '₹'
  currencyCode: string; // 'INR'
  decimalPlaces: number; // 2
  defaultDays: number; // 20
  defaultInterestRate: number; // 1.0
  defaultIncomeTaxRate: number; // 27.0
  daysPerYear: number; // 365
  activeMode: 'quick' | 'detailed' | 'scenario';
}

// Core Trip Pricing: how a Selling/Buying amount is derived.
// 'fixed' = user types the amount directly.
// 'freight_pmt' = amount is auto-calculated as Freight Rate × PMT (per
// metric ton rate × tonnage/quantity).
export type PricingMethod = 'fixed' | 'freight_pmt';

export interface CalculationInput {
  sellingPrice: number;
  buyingPrice: number;
  truckNumber?: string; // Single Entry: Truck No. / Vehicle No. (e.g. MH12AB1234)
  title?: string;
  tripNumber?: string;
  notes?: string;
  customDays?: number;
  customInterestRate?: number;
  // Core Trip Pricing — searchable master-data / company profile fields
  clientName?: string;
  companyProfileId?: string;
  fromLocation?: string;
  toLocation?: string;
  truckType?: string;
  // Single Entry pricing method for Selling/Buying Price. sellingPrice /
  // buyingPrice above always hold the final amount actually used by the
  // calculation engine — when the method is 'freight_pmt' they're kept in
  // sync automatically (freightRate × pmt) by the Dashboard.
  sellingPricingMethod?: PricingMethod;
  sellingFreightRate?: number;
  sellingPmt?: number;
  buyingPricingMethod?: PricingMethod;
  buyingFreightRate?: number;
  buyingPmt?: number;
  // Multiple Entry: when set to 'multiple', sellingPrice/buyingPrice above
  // are auto-computed as the sum of every row in `vehicles` instead of
  // being edited directly.
  vehicleEntryMode?: 'single' | 'multiple';
  vehicles?: VehiclePricingEntry[];
}

// One vehicle's full pricing details inside Multiple Entry mode. Each has
// its own pricing method per side (Fixed Amount or Freight × PMT).
export interface VehiclePricingEntry {
  id: string;
  vehicleNumber: string;
  truckType?: string;
  sellingPricingMethod: PricingMethod;
  sellingAmount: number; // final amount, kept in sync with method below
  sellingFreightRate?: number;
  sellingPmt?: number;
  buyingPricingMethod: PricingMethod;
  buyingAmount: number;
  buyingFreightRate?: number;
  buyingPmt?: number;
}

export interface InterestCalculationDetail {
  id: string;
  name: string;
  allocationPercent: number;
  basisName: string;
  principal: number;
  rate: number;
  isDailyRate: boolean;
  days: number;
  daysInYear: number;
  amount: number;
  formulaString: string;
}

export interface ExpenseCalculationDetail {
  id: string;
  name: string;
  basis: ExpenseBasis;
  basisAmount: number;
  percentage: number;
  fixedAmount: number;
  amount: number;
  formulaString: string;
  isTds: boolean;
  enabled: boolean;
}

export interface TdsRefundResult {
  nominalTdsAmount: number;
  carryingCostAmount: number;
  carryingCostFormula: string;
  itInterestAmount: number;
  itInterestFormula: string;
  actualTaxLiabilities: number;
  actualTaxFormula: string;
  netSavingInTds: number;
  netProfitWithTdsSaving: number; // Net Profit = Profit After Tax + Net Saving in TDS
  netEffectiveProfitWithTds: number; // alias for netProfitWithTdsSaving
  percentageOfProfitAfterTdsSaving: number; // Net Profit / Selling Price * 100
  formulaSummary: string;
}

export interface CalculationResult {
  sellingPrice: number;
  buyingPrice: number;
  grossProfit: number;
  grossProfitMargin: number; // (GP / SP) * 100

  interestDetails: InterestCalculationDetail[];
  totalInterest: number;

  expenseDetails: ExpenseCalculationDetail[];
  totalOperatingExpenses: number; // sum of expenses without interest
  netTotalExpenses: number; // all enabled expenses + interest

  netProfitBeforeTax: number;
  netProfitBeforeTaxMargin: number; // (NPBT / SP) * 100

  incomeTaxRate: number;
  incomeTax: number;

  profitAfterTax: number;
  percentageOfSale: number; // (PAT / SP) * 100

  netProfitWithTdsSaving: number; // Net Profit = Profit After Tax + Net Saving in TDS
  percentageOfProfitAfterTdsSaving: number; // (netProfitWithTdsSaving / sellingPrice) * 100

  tdsRefund: TdsRefundResult;

  warnings: string[];
  isNegativeProfit: boolean;
  isExpenseExceedingGross: boolean;
  allocationSum: number;
}

export interface SavedCalculation {
  id: string;
  name: string;
  createdAt: string; // ISO String
  updatedAt: string;
  tripNumber?: string;
  notes?: string;
  input: CalculationInput;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  result: CalculationResult;
}

// Automatic, unnamed snapshot of every calculation performed — logged in the
// background (debounced) so nothing is ever lost even if the user never
// clicks "Save". Distinct from SavedCalculation, which is an explicit,
// user-named archive entry.
export interface CalculationHistoryEntry {
  id: string;
  createdAt: string; // ISO String
  input: CalculationInput;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  result: CalculationResult;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  sellingPrice: number;
  buyingPrice: number;
  days: number;
  interestRate: number;
  incomeTaxRate?: number;
  notes?: string;
}

// Company Profile (Client = Company Profile)
// Each company/client profile can store its own customized Engine Settings
// (expenses, interest tranches, TDS settings, general settings, and payment terms).
// When selected in the calculator, its engine settings are automatically applied.
export interface CompanyProfile {
  id: string;
  name: string; // Company / Client Name
  gstin?: string; // GST Number
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTermsDays?: number; // e.g. 20, 30, 45, 60 days
  interestRate?: number; // e.g. 1.0%, 1.5%
  // Specific Engine Settings configured for this client/company:
  expenses?: ExpenseItem[];
  interestTranches?: InterestTranche[];
  tdsSettings?: TdsRefundSettings;
  generalSettings?: GeneralSettings;
  defaultTruckType?: string;
  defaultFromLocation?: string;
  defaultToLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// One vehicle/trip's raw selling & buying price inside a multi-vehicle
// bulk-entry batch (see CalculationGroup below).
export interface VehicleLineItem {
  id: string;
  vehicleNumber: string; // truck no. / LR no. / any label the user wants
  sellingPrice: number;
  buyingPrice: number;
  truckType?: string;
  notes?: string;
}

// A single day's (or session's) batch of multiple vehicles entered together.
// Their selling/buying prices are summed into one totalSellingPrice /
// totalBuyingPrice, and the rest of the calculation (expenses, interest,
// TDS, tax) runs once on those totals — exactly like a normal calculation,
// just fed an aggregated input instead of one vehicle's numbers.
export interface CalculationGroup {
  id: string;
  groupName: string;
  groupDate: string; // 'YYYY-MM-DD', used to group/report "how much per day"
  vehicles: VehicleLineItem[];
  totalSellingPrice: number;
  totalBuyingPrice: number;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  result: CalculationResult;
  createdAt: string;
  updatedAt: string;
}

// Aggregated totals for one calendar day, across every group logged that
// day — this is what answers "how much did I do today".
export interface DailyGroupSummary {
  groupDate: string;
  groupCount: number;
  vehicleCount: number;
  totalSellingPrice: number;
  totalBuyingPrice: number;
  totalNetProfit: number;
}

// Simple master-data name lists (Client Name, Truck Type, From/To locations)
// used to power the searchable "type to filter, or add new" dropdowns in
// Core Trip Pricing. Deliberately just an id + name — these exist purely to
// power autocomplete suggestions, not as foreign keys into historical
// records (so renaming/removing one never touches past calculations, which
// keep their own copy of the name as text).
export type MasterDataKind = 'clients' | 'truck_types' | 'locations';

export interface MasterDataItem {
  id: string;
  name: string;
}
