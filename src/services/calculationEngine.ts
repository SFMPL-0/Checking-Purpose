import {
  CalculationInput,
  CalculationResult,
  ExpenseCalculationDetail,
  ExpenseItem,
  GeneralSettings,
  InterestCalculationDetail,
  InterestTranche,
  TdsRefundResult,
  TdsRefundSettings,
} from '../types';

/**
 * Standard freight expense presets
 */
export const DEFAULT_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-tds',
    name: 'TDS',
    enabled: true,
    basis: 'selling_price',
    percentage: 2.0,
    fixedAmount: 0,
    isTds: true,
  },
  {
    id: 'exp-interest',
    name: 'Interest on 30 Days',
    enabled: true,
    basis: 'selling_price',
    percentage: 1.0,
    fixedAmount: 0,
  },
  {
    id: 'exp-salary',
    name: 'Salary (on Selling Price)',
    enabled: true,
    basis: 'selling_price',
    percentage: 0.75,
    fixedAmount: 0,
  },
  {
    id: 'exp-mgmt',
    name: 'Management Expenses',
    enabled: true,
    basis: 'selling_price',
    percentage: 1.0,
    fixedAmount: 0,
  },
  {
    id: 'exp-comm',
    name: 'Commission',
    enabled: true,
    basis: 'selling_price',
    percentage: 1.0,
    fixedAmount: 0,
  },
  {
    id: 'exp-consult',
    name: 'Consultation',
    enabled: true,
    basis: 'selling_price',
    percentage: 0.75,
    fixedAmount: 0,
  },
  {
    id: 'exp-ho',
    name: 'Ho Expenses',
    enabled: true,
    basis: 'selling_price',
    percentage: 0.25,
    fixedAmount: 0,
  },
  {
    id: 'exp-other',
    name: 'Other Expenses',
    enabled: true,
    basis: 'fixed_amount',
    percentage: 0,
    fixedAmount: 0,
  },
];

export const DEFAULT_INTEREST_TRANCHES: InterestTranche[] = [];

export const DEFAULT_TDS_SETTINGS: TdsRefundSettings = {
  enabled: true,
  refundCarryingRate: 1.5,
  refundCarryingPeriodMonths: 18,
  refundCarryingMode: 'monthly', // e.g. 1.5% per month for 18 months or annualized
  itInterestRate: 0.5,
  itInterestPeriodMonths: 6,
  itInterestMode: 'monthly', // 0.5% per month for 6 months (Section 244A)
  actualTaxRate: 27.0,
  nominalTdsRate: 2.0,
  calculationBasis: 'selling_price',
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  currencySymbol: '₹',
  currencyCode: 'INR',
  decimalPlaces: 2,
  defaultDays: 30,
  defaultInterestRate: 1.0,
  defaultIncomeTaxRate: 27.0,
  daysPerYear: 365,
  activeMode: 'quick',
};

/**
 * Returns India Financial Year End date (e.g. 2027-03-31) for a given reference date
 */
export function getDefaultFinancialYearEndDate(baseDateStr?: string): string {
  const d = baseDateStr ? new Date(baseDateStr) : new Date();
  const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const month = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  // Financial year in India runs April 1 to March 31
  // If month is Jan, Feb, Mar (0, 1, 2), FY ends March 31 of current calendar year
  // Otherwise March 31 of next calendar year
  const fyEndYear = month <= 2 ? year : year + 1;
  return `${fyEndYear}-03-31`;
}

/**
 * Computes credit period due date: lrDate + creditPeriodDays
 */
export function computeCreditPeriodDueDate(
  lrDate?: string,
  creditPeriodDays?: number
): string {
  if (!lrDate) return '';
  const parts = lrDate.split('-');
  const days =
    typeof creditPeriodDays === 'number' && !isNaN(creditPeriodDays)
      ? Math.round(creditPeriodDays)
      : 0;
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }
  const d = new Date(lrDate);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Computes TDS refund period months: ROUND((financialYearEndDate − lrDate) / 30, 1)
 */
export function computeTdsRefundPeriodMonths(
  financialYearEndDate?: string,
  lrDate?: string,
  fallbackMonths: number = 18
): { months: number; isComputed: boolean; isNegative: boolean } {
  if (!financialYearEndDate || !lrDate) {
    return { months: fallbackMonths, isComputed: false, isNegative: false };
  }
  const pFy = financialYearEndDate.split('-').map(Number);
  const pLr = lrDate.split('-').map(Number);
  if (pFy.length === 3 && pLr.length === 3 && !pFy.some(isNaN) && !pLr.some(isNaN)) {
    const dateFy = new Date(pFy[0], pFy[1] - 1, pFy[2]);
    const dateLr = new Date(pLr[0], pLr[1] - 1, pLr[2]);
    const diffTime = dateFy.getTime() - dateLr.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      return { months: 0, isComputed: true, isNegative: true };
    }
    return { months: roundTo(diffDays / 30, 1), isComputed: true, isNegative: false };
  }
  const dFy = new Date(financialYearEndDate).getTime();
  const dLr = new Date(lrDate).getTime();
  if (isNaN(dFy) || isNaN(dLr)) {
    return { months: fallbackMonths, isComputed: false, isNegative: false };
  }
  const diffDays = (dFy - dLr) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) {
    return { months: 0, isComputed: true, isNegative: true };
  }
  return { months: roundTo(diffDays / 30, 1), isComputed: true, isNegative: false };
}

/**
 * Helper to ensure loaded expenses contain all Excel P&L rows in exact order
 */
export function ensureDefaultExpenses(expenses: ExpenseItem[]): ExpenseItem[] {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return [...DEFAULT_EXPENSES];
  }
  const hasInterestRow = expenses.some(
    (e) => e.id === 'exp-interest' || e.name.toLowerCase().includes('interest on')
  );
  if (!hasInterestRow) {
    // Migrate to updated Excel P&L benchmark expenses
    return [...DEFAULT_EXPENSES];
  }
  return expenses;
}

const todayInit = new Date();
const todayDateString = `${todayInit.getFullYear()}-${String(todayInit.getMonth() + 1).padStart(2, '0')}-${String(todayInit.getDate()).padStart(2, '0')}`;

export const DEFAULT_INPUT: CalculationInput = {
  sellingPrice: 50000,
  buyingPrice: 45000,
  title: 'Trip Freight Calculation',
  tripNumber: 'TR-001',
  vehicleEntryMode: 'single',
  vehicles: [],
  truckNumber: '',
  lrDate: todayDateString,
  financialYearEndDate: getDefaultFinancialYearEndDate(todayDateString),
  creditPeriodDays: 30,
  annualInterestRate: 1.0,
  incomeTaxRate: 27.0,
  tdsRefundInterestRateMonthly: 1.5,
  itInterestPaidRateMonthly: 0.5,
  itInterestReceivedMonths: 6,
  tdsCalculationVariant: 'standard',
  itInterestMethod: 'linked',
};

/**
 * Format currency in Indian Numbering System: e.g. ₹51,500.00
 */
export function formatCurrency(
  value: number,
  currencySymbol = '₹',
  decimalPlaces = 2
): string {
  if (isNaN(value) || !isFinite(value)) return `${currencySymbol}0.00`;
  const isNegative = value < 0;
  const absVal = Math.abs(value);

  // Format using Indian locale
  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  return `${isNegative ? '-' : ''}${currencySymbol}${formatted}`;
}

/**
 * Format percentage with consistent precision
 */
export function formatPercent(value: number, decimalPlaces = 2): string {
  if (isNaN(value) || !isFinite(value)) return '0.00%';
  return `${value.toFixed(decimalPlaces)}%`;
}

/**
 * Safe rounding to avoid IEEE-754 floating point issues
 */
export function roundTo(value: number, decimals = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Resolves a Selling/Buying amount from its pricing method:
 * 'fixed' → the amount as typed; 'freight_pmt' → Freight Rate × PMT.
 */
export function computePricingAmount(
  method: 'fixed' | 'freight_pmt' | undefined,
  fixedAmount: number,
  freightRate?: number,
  pmt?: number
): number {
  if (method === 'freight_pmt') {
    return roundTo((freightRate || 0) * (pmt || 0), 2);
  }
  return roundTo(fixedAmount || 0, 2);
}

/**
 * Core Calculation Engine
 */
export function calculateFreightProfit(
  input: CalculationInput,
  expenses: ExpenseItem[] = DEFAULT_EXPENSES,
  interestTranches: InterestTranche[] = DEFAULT_INTEREST_TRANCHES,
  tdsSettings: TdsRefundSettings = DEFAULT_TDS_SETTINGS,
  generalSettings: GeneralSettings = DEFAULT_GENERAL_SETTINGS
): CalculationResult {
  const sellingPrice = Math.max(0, Number(input.sellingPrice) || 0);
  const buyingPrice = Math.max(0, Number(input.buyingPrice) || 0);
  const grossProfit = roundTo(sellingPrice - buyingPrice, 2);
  const grossProfitMargin =
    sellingPrice > 0 ? roundTo((grossProfit / sellingPrice) * 100, 4) : 0;

  const warnings: string[] = [];

  // Check allocation percentage total
  const allocationSum = interestTranches.reduce(
    (sum, t) => sum + (Number(t.allocationPercentage) || 0),
    0
  );
  if (interestTranches.length > 0 && Math.abs(allocationSum - 100) > 0.01) {
    warnings.push(
      `Interest allocation percentages sum to ${allocationSum.toFixed(
        1
      )}% (expected 100%).`
    );
  }

  // 1. Calculate Interest Tranches
  const interestDetails: InterestCalculationDetail[] = interestTranches.map(
    (tranche) => {
      const baseAmount =
        tranche.basis === 'buying_price' ? buyingPrice : sellingPrice;
      const allocPct = Number(tranche.allocationPercentage) || 0;
      const principal = roundTo(baseAmount * (allocPct / 100), 2);

      // Support override from trip creditPeriodDays or quick inputs
      const days =
        input.creditPeriodDays !== undefined && !isNaN(Number(input.creditPeriodDays))
          ? Math.round(Number(input.creditPeriodDays))
          : input.customDays !== undefined
          ? input.customDays
          : Number(tranche.days) || generalSettings.defaultDays || 20;
      const rate =
        input.customInterestRate !== undefined
          ? input.customInterestRate
          : Number(tranche.annualRate) || generalSettings.defaultInterestRate || 1.0;
      const daysInYear =
        Number(tranche.daysInYear) || generalSettings.daysPerYear || 365;

      let amount = 0;
      let formulaString = '';

      if (tranche.isDailyRate) {
        amount = roundTo(principal * (rate / 100) * days, 2);
        formulaString = `${formatCurrency(
          baseAmount,
          generalSettings.currencySymbol
        )} × ${allocPct}% × ${rate}%/day × ${days} days = ${formatCurrency(
          amount,
          generalSettings.currencySymbol
        )}`;
      } else {
        // Standard Excel Formula: Principal * Rate * Days / 365
        amount = roundTo(principal * (rate / 100) * (days / daysInYear), 2);
        formulaString = `${formatCurrency(
          baseAmount,
          generalSettings.currencySymbol
        )} × ${allocPct}% × ${rate}% × ${days} ÷ ${daysInYear} = ${formatCurrency(
          amount,
          generalSettings.currencySymbol
        )}`;
      }

      return {
        id: tranche.id,
        name: tranche.name,
        allocationPercent: allocPct,
        basisName:
          tranche.basis === 'buying_price' ? 'Buying Price' : 'Selling Price',
        principal,
        rate,
        isDailyRate: tranche.isDailyRate,
        days,
        daysInYear,
        amount,
        formulaString,
      };
    }
  );

  const trancheInterestTotal = roundTo(
    interestDetails.reduce((sum, item) => sum + item.amount, 0),
    2
  );

  // 2. Calculate Operating Expenses
  const expenseDetails: ExpenseCalculationDetail[] = expenses.map((exp) => {
    if (!exp.enabled) {
      return {
        id: exp.id,
        name: exp.name,
        basis: exp.basis,
        basisAmount: 0,
        percentage: exp.percentage,
        fixedAmount: exp.fixedAmount,
        amount: 0,
        formulaString: 'Disabled',
        isTds: !!exp.isTds,
        enabled: false,
      };
    }

    let basisAmount = 0;
    let basisLabel = '';

    switch (exp.basis) {
      case 'selling_price':
        basisAmount = sellingPrice;
        basisLabel = 'Selling Price';
        break;
      case 'buying_price':
        basisAmount = buyingPrice;
        basisLabel = 'Buying Price';
        break;
      case 'gross_profit':
        basisAmount = Math.max(0, grossProfit);
        basisLabel = 'Gross Profit';
        break;
      case 'fixed_amount':
        basisAmount = 0;
        basisLabel = 'Fixed';
        break;
      default:
        basisAmount = sellingPrice;
        basisLabel = 'Selling Price';
    }

    let amount = 0;
    let formulaString = '';

    if (exp.basis === 'fixed_amount') {
      const fixedVal = Number(exp.fixedAmount) || 0;
      if (fixedVal < 0) {
        warnings.push(
          `Expense "${exp.name}" amount cannot be negative. Value clamped to ₹0.`
        );
      }
      amount = roundTo(Math.max(0, fixedVal), 2);
      formulaString = `Fixed Amount = ${formatCurrency(
        amount,
        generalSettings.currencySymbol
      )}`;
    } else {
      const pct = Number(exp.percentage) || 0;
      amount = roundTo(basisAmount * (pct / 100), 2);
      formulaString = `${basisLabel} (${formatCurrency(
        basisAmount,
        generalSettings.currencySymbol
      )}) × ${pct}% = ${formatCurrency(
        amount,
        generalSettings.currencySymbol
      )}`;
    }

    return {
      id: exp.id,
      name: exp.name,
      basis: exp.basis,
      basisAmount,
      percentage: Number(exp.percentage) || 0,
      fixedAmount: Number(exp.fixedAmount) || 0,
      amount,
      formulaString,
      isTds: !!exp.isTds,
      enabled: true,
    };
  });

  // Check if expense list has an integrated interest row (e.g. "Interest on 30 Days")
  const hasInterestInExpenses = expenseDetails.some(
    (e) =>
      e.id === 'exp-interest' ||
      e.name.toLowerCase().includes('interest on')
  );

  const totalOperatingExpenses = roundTo(
    expenseDetails.reduce((sum, item) => sum + item.amount, 0),
    2
  );

  // When interest is an expense row in the sheet, Total Expenses is the sum of all enabled rows
  const totalInterest = hasInterestInExpenses
    ? roundTo(
        expenseDetails.find(
          (e) =>
            (e.id === 'exp-interest' ||
              e.name.toLowerCase().includes('interest on')) &&
            e.enabled
        )?.amount || 0,
        2
      )
    : roundTo(
        interestDetails.reduce((sum, item) => sum + item.amount, 0),
        2
      );

  const netTotalExpenses = hasInterestInExpenses
    ? totalOperatingExpenses
    : roundTo(totalOperatingExpenses + totalInterest, 2);

  // 3. Net Profit = Gross Profit − Total Expenses
  const netProfitBeforeTax = roundTo(grossProfit - netTotalExpenses, 2);
  const netProfitBeforeTaxMargin =
    sellingPrice > 0
      ? roundTo((netProfitBeforeTax / sellingPrice) * 100, 4)
      : 0;

  // 4. Income Tax on Net Profit = Net Profit × incomeTaxRate
  const taxRate =
    input.incomeTaxRate !== undefined && !isNaN(Number(input.incomeTaxRate))
      ? Number(input.incomeTaxRate)
      : Number(tdsSettings.actualTaxRate) ||
        generalSettings.defaultIncomeTaxRate ||
        27.0;

  // Income tax applies when net profit before tax is positive
  const taxableProfit = Math.max(0, netProfitBeforeTax);
  const incomeTax = roundTo(taxableProfit * (taxRate / 100), 2);

  // Profit After Tax = Net Profit − Income Tax
  const profitAfterTax = roundTo(netProfitBeforeTax - incomeTax, 2);
  const percentageOfSale =
    sellingPrice > 0 ? roundTo((profitAfterTax / sellingPrice) * 100, 4) : 0;

  // 5. TDS Claim / Refund Calculation
  // Notional Tax Computed = TDS amount from row 3 above
  const tdsExpense = expenseDetails.find((e) => e.isTds && e.enabled);
  const nominalTdsAmount = tdsExpense
    ? tdsExpense.amount
    : roundTo(
        (tdsSettings.calculationBasis === 'gross_profit'
          ? Math.max(0, grossProfit)
          : sellingPrice) *
          ((Number(tdsSettings.nominalTdsRate) || 2.0) / 100),
        2
      );
  const notionalTaxComputed = nominalTdsAmount;

  // Trip Credit Period Due Date: lrDate + creditPeriodDays
  const creditDays =
    input.creditPeriodDays !== undefined && !isNaN(Number(input.creditPeriodDays))
      ? Math.round(Number(input.creditPeriodDays))
      : input.customDays !== undefined && input.customDays > 0
      ? input.customDays
      : generalSettings.defaultDays || 30;

  const creditPeriodDueDate = input.lrDate
    ? computeCreditPeriodDueDate(input.lrDate, creditDays)
    : undefined;

  // TDS Refund Period (Months): ROUND((financialYearEndDate − lrDate) / 30, 1)
  let tdsRefundPeriodMonths = Number(tdsSettings.refundCarryingPeriodMonths) || 18;
  let isTdsRefundPeriodComputed = false;

  if (input.lrDate && input.financialYearEndDate) {
    const periodCalc = computeTdsRefundPeriodMonths(
      input.financialYearEndDate,
      input.lrDate,
      Number(tdsSettings.refundCarryingPeriodMonths) || 18
    );
    if (periodCalc.isNegative) {
      warnings.push(
        `Financial Year End Date (${input.financialYearEndDate}) is earlier than LR Date (${input.lrDate}). TDS refund period cannot be negative.`
      );
      tdsRefundPeriodMonths = 0;
      isTdsRefundPeriodComputed = true;
    } else {
      tdsRefundPeriodMonths = periodCalc.months;
      isTdsRefundPeriodComputed = true;
    }
  }

  // Less: Interest to Get TDS Refund = (TDS 2% − Income Tax 27%) × tdsRefundInterestRateMonthly × tdsRefundPeriodMonths
  const refundRate =
    input.tdsRefundInterestRateMonthly !== undefined &&
    !isNaN(Number(input.tdsRefundInterestRateMonthly))
      ? Number(input.tdsRefundInterestRateMonthly)
      : Number(tdsSettings.refundCarryingRate) || 1.5;

  const refundMonths = tdsRefundPeriodMonths;
  // Base for refund carrying cost is (TDS 2% − Income Tax 27%)
  const carryingCostBase = Math.max(0, nominalTdsAmount - incomeTax);
  let carryingCostAmount = 0;
  let carryingCostFormula = '';

  if (tdsSettings.refundCarryingMode === 'monthly') {
    // refundRate% per month for refundMonths on (TDS - Income Tax)
    carryingCostAmount = roundTo(
      carryingCostBase * (refundRate / 100) * refundMonths,
      2
    );
    carryingCostFormula = `(TDS [${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}] − IT [${formatCurrency(
      incomeTax,
      generalSettings.currencySymbol
    )}] = ${formatCurrency(
      carryingCostBase,
      generalSettings.currencySymbol
    )}) × ${refundRate}%/mo × ${refundMonths} mos = ${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}`;
  } else if (tdsSettings.refundCarryingMode === 'annual') {
    carryingCostAmount = roundTo(
      carryingCostBase * (refundRate / 100) * (refundMonths / 12),
      2
    );
    carryingCostFormula = `(TDS [${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}] − IT [${formatCurrency(
      incomeTax,
      generalSettings.currencySymbol
    )}] = ${formatCurrency(
      carryingCostBase,
      generalSettings.currencySymbol
    )}) × ${refundRate}%/yr × (${refundMonths}/12) = ${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}`;
  } else {
    carryingCostAmount = roundTo(carryingCostBase * (refundRate / 100), 2);
    carryingCostFormula = `(TDS [${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}] − IT [${formatCurrency(
      incomeTax,
      generalSettings.currencySymbol
    )}] = ${formatCurrency(
      carryingCostBase,
      generalSettings.currencySymbol
    )}) × ${refundRate}% = ${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}`;
  }
  const interestToGetTdsRefund = carryingCostAmount;

  // Add: Interest Paid by IT Dept on Excess TDS = (Notional Tax − Income Tax on Net Profit) × itInterestPaidRateMonthly × itInterestReceivedMonths
  const itMonthlyRate =
    input.itInterestPaidRateMonthly !== undefined &&
    !isNaN(Number(input.itInterestPaidRateMonthly))
      ? Number(input.itInterestPaidRateMonthly)
      : Number(tdsSettings.itInterestRate) || 0.5;

  const itMonths =
    input.itInterestReceivedMonths !== undefined &&
    !isNaN(Number(input.itInterestReceivedMonths))
      ? Number(input.itInterestReceivedMonths)
      : Number(tdsSettings.itInterestPeriodMonths) || 6;

  // Refundable principal = Notional Tax minus actual tax liability
  const refundableBase = Math.max(0, nominalTdsAmount - incomeTax);
  let itInterestAmount = 0;
  let itInterestFormula = '';

  // By default linked (0.5% × 6 = 3%). If flat_3pct is selected, hardcodes to flat 3%
  const itInterestPercentage =
    input.itInterestMethod === 'flat_3pct'
      ? 3.0
      : roundTo(itMonthlyRate * itMonths, 2);

  itInterestAmount = roundTo(
    refundableBase * (itInterestPercentage / 100),
    2
  );
  itInterestFormula = `Excess TDS (${formatCurrency(
    refundableBase,
    generalSettings.currencySymbol
  )}) × ${itInterestPercentage}% (${itMonthlyRate}%/mo × ${itMonths} mos) = ${formatCurrency(
    itInterestAmount,
    generalSettings.currencySymbol
  )}`;
  const interestPaidByItDept = itInterestAmount;

  // Less: Actual Income Tax Liability
  const actualTaxLiabilities = incomeTax;
  const actualIncomeTaxLiability = actualTaxLiabilities;
  const actualTaxFormula = `Income Tax on NP (${taxRate}%) = ${formatCurrency(
    actualTaxLiabilities,
    generalSettings.currencySymbol
  )}`;

  // Net Saving in TDS = Notional Tax − Interest to Get Refund + Interest Paid by IT Dept − Actual Income Tax Liability
  // Note on Excel Sheet Swap: If user tests excel_swapped, it computes:
  // Notional Tax − Interest to Get Refund + Actual Tax Liability − Interest Paid by IT Dept
  const isSheetSwapped = input.tdsCalculationVariant === 'excel_swapped';
  const netSavingInTds = isSheetSwapped
    ? roundTo(
        notionalTaxComputed -
          interestToGetTdsRefund +
          actualIncomeTaxLiability -
          interestPaidByItDept,
        2
      )
    : roundTo(
        notionalTaxComputed -
          interestToGetTdsRefund +
          interestPaidByItDept -
          actualIncomeTaxLiability,
        2
      );

  // Total Benefit = Profit After Tax + Net Saving in TDS
  const totalBenefit = roundTo(profitAfterTax + netSavingInTds, 2);
  const netProfitWithTdsSaving = totalBenefit;
  const netEffectiveProfitWithTds = totalBenefit;

  // % of Profit After TDS Saving to Sale = Net Saving in TDS ÷ Selling Price
  const percentageOfProfitAfterTdsSaving =
    sellingPrice > 0
      ? roundTo((netSavingInTds / sellingPrice) * 100, 4)
      : 0;

  // % To Sales = ROUND(Total Benefit ÷ Selling Price × 100, 0)
  const percentToSales =
    sellingPrice > 0
      ? Math.round((totalBenefit / sellingPrice) * 100)
      : 0;

  const tdsRefund: TdsRefundResult = {
    nominalTdsAmount,
    carryingCostAmount,
    carryingCostFormula,
    itInterestAmount,
    itInterestFormula,
    actualTaxLiabilities,
    actualTaxFormula,
    netSavingInTds,
    netProfitWithTdsSaving,
    netEffectiveProfitWithTds,
    percentageOfProfitAfterTdsSaving,
    formulaSummary: isSheetSwapped
      ? `[Sheet Swapped Formula] Notional TDS (${formatCurrency(
          notionalTaxComputed,
          generalSettings.currencySymbol
        )}) − Carrying Cost (${formatCurrency(
          interestToGetTdsRefund,
          generalSettings.currencySymbol
        )}) + Tax Liability (${formatCurrency(
          actualIncomeTaxLiability,
          generalSettings.currencySymbol
        )}) − IT Interest (${formatCurrency(
          interestPaidByItDept,
          generalSettings.currencySymbol
        )}) = ${formatCurrency(netSavingInTds, generalSettings.currencySymbol)}`
      : `Notional TDS (${formatCurrency(
          notionalTaxComputed,
          generalSettings.currencySymbol
        )}) − Carrying Cost (${formatCurrency(
          interestToGetTdsRefund,
          generalSettings.currencySymbol
        )}) + IT Interest (${formatCurrency(
          interestPaidByItDept,
          generalSettings.currencySymbol
        )}) − Tax Liability (${formatCurrency(
          actualIncomeTaxLiability,
          generalSettings.currencySymbol
        )}) = ${formatCurrency(netSavingInTds, generalSettings.currencySymbol)}`,
    refundPeriodMonths: refundMonths,
    isRefundPeriodComputed: isTdsRefundPeriodComputed,
    notionalTaxComputed,
    interestToGetTdsRefund,
    interestPaidByItDept,
    actualIncomeTaxLiability,
    totalBenefit,
    percentToSales,
  };

  // Warnings
  if (grossProfit < 0) {
    warnings.push(
      'Negative Gross Profit: Selling Price is lower than Buying Price.'
    );
  }
  if (netTotalExpenses > grossProfit) {
    warnings.push(
      `Expenses (${formatCurrency(
        netTotalExpenses,
        generalSettings.currencySymbol
      )}) exceed Gross Profit (${formatCurrency(
        grossProfit,
        generalSettings.currencySymbol
      )}). Resulting in a net loss.`
    );
  }
  if (profitAfterTax < 0) {
    warnings.push(
      `Net Profit After Tax is negative (${formatCurrency(
        profitAfterTax,
        generalSettings.currencySymbol
      )}).`
    );
  }

  return {
    sellingPrice,
    buyingPrice,
    grossProfit,
    grossProfitMargin,
    interestDetails,
    totalInterest,
    expenseDetails,
    totalOperatingExpenses,
    netTotalExpenses,
    netProfitBeforeTax,
    netProfitBeforeTaxMargin,
    incomeTaxRate: taxRate,
    incomeTax,
    profitAfterTax,
    percentageOfSale,
    netProfitWithTdsSaving,
    percentageOfProfitAfterTdsSaving,
    tdsRefund,
    warnings,
    isNegativeProfit: profitAfterTax < 0,
    isExpenseExceedingGross: netTotalExpenses > grossProfit,
    allocationSum,
    creditPeriodDueDate,
    tdsRefundPeriodMonths,
    isTdsRefundPeriodComputed,
    totalBenefit,
    percentToSales,
  };
}
