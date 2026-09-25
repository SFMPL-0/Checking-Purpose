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
    id: 'exp-salary',
    name: 'Salary expenses',
    enabled: true,
    basis: 'selling_price',
    percentage: 1.0,
    fixedAmount: 0,
  },
  {
    id: 'exp-mgmt',
    name: 'Management expenses',
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
    name: 'Consultation expenses',
    enabled: true,
    basis: 'selling_price',
    percentage: 1.0,
    fixedAmount: 0,
  },
];

export const DEFAULT_INTEREST_TRANCHES: InterestTranche[] = [
  {
    id: 'int-75',
    name: 'Interest on 75% amount',
    allocationPercentage: 75.0,
    annualRate: 1.0,
    days: 20,
    daysInYear: 365,
    isDailyRate: false,
    basis: 'selling_price',
  },
  {
    id: 'int-25',
    name: 'Interest on 25% amount',
    allocationPercentage: 25.0,
    annualRate: 1.0,
    days: 20,
    daysInYear: 365,
    isDailyRate: false,
    basis: 'selling_price',
  },
];

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
  defaultDays: 20,
  defaultInterestRate: 1.0,
  defaultIncomeTaxRate: 27.0,
  daysPerYear: 365,
  activeMode: 'quick',
};

export const DEFAULT_INPUT: CalculationInput = {
  sellingPrice: 50000,
  buyingPrice: 45000,
  title: 'Trip Freight Calculation',
  tripNumber: 'TR-001',
  vehicleEntryMode: 'single',
  vehicles: [],
  truckNumber: '',
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
  if (Math.abs(allocationSum - 100) > 0.01) {
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

      // Support override from quick inputs
      const days =
        input.customDays !== undefined
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

  const totalInterest = roundTo(
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
      amount = roundTo(Number(exp.fixedAmount) || 0, 2);
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

  const totalOperatingExpenses = roundTo(
    expenseDetails.reduce((sum, item) => sum + item.amount, 0),
    2
  );

  const netTotalExpenses = roundTo(totalOperatingExpenses + totalInterest, 2);

  // 3. Net Profit Before Tax
  const netProfitBeforeTax = roundTo(grossProfit - netTotalExpenses, 2);
  const netProfitBeforeTaxMargin =
    sellingPrice > 0
      ? roundTo((netProfitBeforeTax / sellingPrice) * 100, 4)
      : 0;

  // 4. Income Tax
  const taxRate =
    Number(tdsSettings.actualTaxRate) ||
    generalSettings.defaultIncomeTaxRate ||
    27.0;
  // Income tax applies when net profit before tax is positive
  const taxableProfit = Math.max(0, netProfitBeforeTax);
  const incomeTax = roundTo(taxableProfit * (taxRate / 100), 2);

  // 5. Profit After Tax
  const profitAfterTax = roundTo(netProfitBeforeTax - incomeTax, 2);
  const percentageOfSale =
    sellingPrice > 0 ? roundTo((profitAfterTax / sellingPrice) * 100, 4) : 0;

  // 6. TDS Claim / Refund Calculation
  // Find nominal TDS from expense list, or calculate from settings
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

  // Less Interest for 18 Months @ 1.5% to Get Refund
  const refundRate = Number(tdsSettings.refundCarryingRate) || 1.5;
  const refundMonths = Number(tdsSettings.refundCarryingPeriodMonths) || 18;
  let carryingCostAmount = 0;
  let carryingCostFormula = '';

  if (tdsSettings.refundCarryingMode === 'monthly') {
    // 1.5% per month for 18 months
    carryingCostAmount = roundTo(
      nominalTdsAmount * (refundRate / 100) * refundMonths,
      2
    );
    carryingCostFormula = `TDS (${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}) × ${refundRate}%/mo × ${refundMonths} mos = ${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}`;
  } else if (tdsSettings.refundCarryingMode === 'annual') {
    // 1.5% per annum for 18 months
    carryingCostAmount = roundTo(
      nominalTdsAmount * (refundRate / 100) * (refundMonths / 12),
      2
    );
    carryingCostFormula = `TDS (${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}) × ${refundRate}%/yr × (${refundMonths}/12) = ${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}`;
  } else {
    // Flat
    carryingCostAmount = roundTo(nominalTdsAmount * (refundRate / 100), 2);
    carryingCostFormula = `TDS (${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}) × ${refundRate}% = ${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}`;
  }

  // Add Interest Paid by IT @ 0.5% for 6 Months (Sec 244A)
  const itRate = Number(tdsSettings.itInterestRate) || 0.5;
  const itMonths = Number(tdsSettings.itInterestPeriodMonths) || 6;
  // Refundable principal = Nominal TDS minus actual tax liability
  const refundableBase = Math.max(0, nominalTdsAmount - incomeTax);
  let itInterestAmount = 0;
  let itInterestFormula = '';

  if (tdsSettings.itInterestMode === 'monthly') {
    itInterestAmount = roundTo(
      refundableBase * (itRate / 100) * itMonths,
      2
    );
    itInterestFormula = `Refund Base (${formatCurrency(
      refundableBase,
      generalSettings.currencySymbol
    )}) × ${itRate}%/mo × ${itMonths} mos = ${formatCurrency(
      itInterestAmount,
      generalSettings.currencySymbol
    )}`;
  } else {
    itInterestAmount = roundTo(
      refundableBase * (itRate / 100) * (itMonths / 12),
      2
    );
    itInterestFormula = `Refund Base (${formatCurrency(
      refundableBase,
      generalSettings.currencySymbol
    )}) × ${itRate}%/yr × (${itMonths}/12) = ${formatCurrency(
      itInterestAmount,
      generalSettings.currencySymbol
    )}`;
  }

  // Less Actual IT Liabilities
  const actualTaxLiabilities = incomeTax;
  const actualTaxFormula = `Computed IT on Profit (${taxRate}%) = ${formatCurrency(
    actualTaxLiabilities,
    generalSettings.currencySymbol
  )}`;

  // Net Saving in TDS
  // Gross TDS recovered - Carrying/opportunity cost + IT refund interest - Actual IT liabilities
  const netSavingInTds = roundTo(
    nominalTdsAmount -
      carryingCostAmount +
      itInterestAmount -
      actualTaxLiabilities,
    2
  );

  // Net Profit = Profit After Tax + Net Saving in TDS
  // % of Profit After TDS Saving = Net Profit / Selling Price (Freight Charged to Client) * 100
  const netProfitWithTdsSaving = roundTo(profitAfterTax + netSavingInTds, 2);
  const netEffectiveProfitWithTds = netProfitWithTdsSaving;
  const percentageOfProfitAfterTdsSaving =
    sellingPrice > 0
      ? roundTo((netProfitWithTdsSaving / sellingPrice) * 100, 4)
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
    formulaSummary: `Nominal TDS (${formatCurrency(
      nominalTdsAmount,
      generalSettings.currencySymbol
    )}) − Carrying Cost (${formatCurrency(
      carryingCostAmount,
      generalSettings.currencySymbol
    )}) + IT Interest (${formatCurrency(
      itInterestAmount,
      generalSettings.currencySymbol
    )}) − Tax Liability (${formatCurrency(
      actualTaxLiabilities,
      generalSettings.currencySymbol
    )}) = ${formatCurrency(netSavingInTds, generalSettings.currencySymbol)}`,
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
  };
}
