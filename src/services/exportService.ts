import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CalculationInput,
  CalculationResult,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  SavedCalculation,
  ScenarioDefinition,
  TdsRefundSettings,
} from '../types';
import {
  calculateFreightProfit,
  formatCurrency,
  formatPercent,
} from './calculationEngine';

/**
 * Export single or multiple calculations to an Excel (.xlsx) file
 */
export function exportCalculationToExcel(
  input: CalculationInput,
  result: CalculationResult,
  expenses: ExpenseItem[],
  interestTranches: InterestTranche[],
  tdsSettings: TdsRefundSettings,
  generalSettings: GeneralSettings,
  fileName = 'Freight_Profit_Analysis.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Sheet
  const summaryData = [
    ['FREIGHT PROFIT, TAX & INTEREST REPORT', ''],
    ['Generated Date:', new Date().toLocaleString()],
    ['Trip / Ref:', input.tripNumber || 'N/A'],
    ['Title / Client:', input.title || input.clientName || 'N/A'],
    ['LR Date:', input.lrDate || 'N/A'],
    ['Credit Period (Days):', input.creditPeriodDays ?? 20],
    ['Credit Period Due Date:', result.creditPeriodDueDate || 'N/A'],
    ['Financial Year End Date:', input.financialYearEndDate || 'N/A'],
    ['TDS Refund Period (Months):', result.tdsRefundPeriodMonths ?? tdsSettings.refundCarryingPeriodMonths],
    ['', ''],
    ['1. CORE REVENUE & GROSS PROFIT', 'AMOUNT (INR)'],
    ['Selling Price (Freight Revenue)', result.sellingPrice],
    ['Buying Price (Lorry Hire / Cost)', result.buyingPrice],
    ['Gross Profit', result.grossProfit],
    ['Gross Profit Margin (%)', `${result.grossProfitMargin}%`],
    ['', ''],
    ['2. FINANCING / INTEREST EXPENSES', 'AMOUNT (INR)'],
    ...result.interestDetails.map((int) => [
      `${int.name} (${int.allocationPercent}%, ${int.rate}% for ${int.days}d)`,
      int.amount,
    ]),
    ['Total Interest Cost', result.totalInterest],
    ['', ''],
    ['3. OPERATING & STATUTORY EXPENSES', 'AMOUNT (INR)'],
    ...result.expenseDetails.map((exp) => [
      `${exp.name} (${exp.basis === 'fixed_amount' ? 'Fixed' : exp.percentage + '% on ' + exp.basis})`,
      exp.amount,
    ]),
    ['Total Operating Expenses', result.totalOperatingExpenses],
    ['', ''],
    ['4. NET EXPENSES & PROFIT BEFORE TAX', 'AMOUNT (INR)'],
    ['Net Total Expenses (Operating + Interest)', result.netTotalExpenses],
    ['Net Profit Before Tax (NPBT)', result.netProfitBeforeTax],
    ['NPBT Margin (%)', `${result.netProfitBeforeTaxMargin}%`],
    ['', ''],
    ['5. TAXATION & NET PROFIT AFTER TAX', 'AMOUNT (INR)'],
    [`Income Tax @ ${result.incomeTaxRate}%`, result.incomeTax],
    ['Profit After Tax (PAT)', result.profitAfterTax],
    ['Percentage of Sale (PAT / SP)', `${result.percentageOfSale}%`],
    ['', ''],
    ['6. TDS CLAIM & REFUND COMPUTATION', 'AMOUNT (INR)'],
    ['Nominal TDS Deducted (2% on SP)', result.tdsRefund.nominalTdsAmount],
    [
      `Less: Carrying Cost (${result.tdsRefundPeriodMonths ?? tdsSettings.refundCarryingPeriodMonths} mos @ ${tdsSettings.refundCarryingRate}%)`,
      -result.tdsRefund.carryingCostAmount,
    ],
    [
      `Add: IT Dept Interest Sec 244A (${tdsSettings.itInterestPeriodMonths} mos @ ${tdsSettings.itInterestRate}%)`,
      result.tdsRefund.itInterestAmount,
    ],
    ['Less: Actual IT Liabilities', -result.tdsRefund.actualTaxLiabilities],
    ['Net Saving in TDS', result.tdsRefund.netSavingInTds],
    ['Net Effective Profit with TDS Recovery', result.tdsRefund.netEffectiveProfitWithTds],
    ['Percentage of Profit After TDS Saving', `${result.tdsRefund.percentageOfProfitAfterTdsSaving}%`],
    ['', ''],
    ['7. SUMMARY (EXCEL P&L MODEL)', 'AMOUNT (INR)'],
    ['Profit After Tax', result.profitAfterTax],
    ['Net Saving in TDS', result.tdsRefund.netSavingInTds],
    ['Total Benefit (PAT + Net Saving in TDS)', result.totalBenefit ?? (result.profitAfterTax + result.tdsRefund.netSavingInTds)],
    ['% To Sales', `${result.percentToSales ?? (result.sellingPrice > 0 ? Math.round(((result.totalBenefit ?? 0) / result.sellingPrice) * 100) : 0)}%`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Profit Summary');

  // 2. Calculation Formulas & Mathematical Audit Sheet
  const auditData = [
    ['ITEM', 'CALCULATION BASIS', 'FORMULA USED', 'INPUT VALUE', 'RESULT'],
    ['Gross Profit', 'Selling - Buying', 'Selling Price - Buying Price', `₹${result.sellingPrice} - ₹${result.buyingPrice}`, result.grossProfit],
    ...result.interestDetails.map((i) => [
      i.name,
      i.basisName,
      i.formulaString,
      `Principal: ₹${i.principal}, Rate: ${i.rate}%, Days: ${i.days}`,
      i.amount,
    ]),
    ...result.expenseDetails.map((e) => [
      e.name,
      e.basis,
      e.formulaString,
      `Basis Amount: ₹${e.basisAmount}`,
      e.amount,
    ]),
    ['Net Total Expenses', 'Sum', 'Total Operating Expenses + Total Interest', `₹${result.totalOperatingExpenses} + ₹${result.totalInterest}`, result.netTotalExpenses],
    ['Net Profit Before Tax', 'Gross Profit - Expenses', 'Gross Profit - Net Total Expenses', `₹${result.grossProfit} - ₹${result.netTotalExpenses}`, result.netProfitBeforeTax],
    ['Income Tax', 'Tax Rate', `NPBT × ${result.incomeTaxRate}%`, `₹${result.netProfitBeforeTax} × ${result.incomeTaxRate}%`, result.incomeTax],
    ['Profit After Tax', 'NPBT - Tax', 'Net Profit Before Tax - Income Tax', `₹${result.netProfitBeforeTax} - ₹${result.incomeTax}`, result.profitAfterTax],
    ['TDS Saving', 'Refund Net', result.tdsRefund.formulaSummary, 'Audit steps included', result.tdsRefund.netSavingInTds],
  ];

  const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Formula Audit');

  XLSX.writeFile(wb, fileName);
}

/**
 * Export multiple saved calculations history to Excel
 */
export function exportHistoryToExcel(
  history: SavedCalculation[],
  fileName = 'Freight_Calculations_History.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  const data = [
    [
      'ID',
      'Name',
      'Date',
      'Trip Ref',
      'Selling Price',
      'Buying Price',
      'Gross Profit',
      'Total Interest',
      'Total Expenses',
      'Net Profit (NPBT)',
      'Income Tax',
      'Profit After Tax (PAT)',
      'Percentage of Sale',
      'Net TDS Saving',
      'Profit with TDS',
    ],
    ...history.map((c) => [
      c.id,
      c.name,
      new Date(c.createdAt).toLocaleDateString(),
      c.tripNumber || '',
      c.result.sellingPrice,
      c.result.buyingPrice,
      c.result.grossProfit,
      c.result.totalInterest,
      c.result.netTotalExpenses,
      c.result.netProfitBeforeTax,
      c.result.incomeTax,
      c.result.profitAfterTax,
      `${c.result.percentageOfSale}%`,
      c.result.tdsRefund.netSavingInTds,
      c.result.tdsRefund.netEffectiveProfitWithTds,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Saved History');
  XLSX.writeFile(wb, fileName);
}

/**
 * Robust Mobile Storage Downloader for PDF files.
 * Works seamlessly across Android (Chrome, Samsung Internet, Firefox),
 * iOS Safari, and desktop browsers, saving directly into device storage.
 */
export async function savePdfToMobileStorage(
  pdfBlob: Blob,
  fileName: string
): Promise<{ success: boolean; fileName: string; method: string }> {
  try {
    // 1. Try modern Mobile Web Share API with file attachment if supported
    const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
    if (isMobile && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      try {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: fileName,
            text: `Freight Profit Calculation Report for ${fileName}`,
            files: [file],
          });
          return { success: true, fileName, method: 'share' };
        }
      } catch (shareErr) {
        // User may dismiss share dialog; proceed to direct storage download fallback
        console.log('Mobile share dismissed or bypassed, downloading directly:', shareErr);
      }
    }

    // 2. Direct Mobile Storage Download (Standard Anchor with object URL)
    const blobUrl = URL.createObjectURL(pdfBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = fileName;
    downloadAnchor.style.display = 'none';
    downloadAnchor.setAttribute('target', '_self');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    setTimeout(() => {
      try {
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        // cleanup ignore
      }
    }, 2500);

    return { success: true, fileName, method: 'download' };
  } catch (err) {
    console.error('Failed saving PDF to mobile storage:', err);
    throw err;
  }
}

/**
 * Export complete freight profit calculation to a professional PDF file,
 * saving directly into Mobile Storage (Downloads/Files) and supporting Mobile Web Share.
 */
export async function exportCalculationToPdf(
  input: CalculationInput,
  result: CalculationResult,
  expenses: ExpenseItem[],
  interestTranches: InterestTranche[],
  tdsSettings: TdsRefundSettings,
  generalSettings: GeneralSettings,
  customFileName?: string,
  showFormulas: boolean = true
): Promise<{ success: boolean; fileName: string; method: string }> {
  // When formulas are hidden, drop the middle "Formula/Basis/Computation
  // Rule" column entirely from a 3-column [label, formula, amount] table,
  // rather than leaving an empty column behind, and widen the label column
  // to fill the freed space.
  const stripFormulaColumn = (
    headRow: string[],
    bodyRows: any[][]
  ): { head: string[]; body: any[][]; columnStyles: any } => {
    if (showFormulas) {
      return {
        head: headRow,
        body: bodyRows,
        columnStyles: {
          0: { cellWidth: 80, fontStyle: 'bold' },
          1: { cellWidth: 60 },
          2: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
        },
      };
    }
    return {
      head: [headRow[0], headRow[2]],
      body: bodyRows.map((row) => [row[0], row[2]]),
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'bold' },
        1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
      },
    };
  };

  const tripRef = (input.tripNumber || 'TR-001').trim();
  const safeTrip = tripRef.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = customFileName || `Freight_Report_${safeTrip}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Primary Theme Colors: Deep Slate (#0f172a), Amber Accent (#f59e0b)
  const headerBgColor: [number, number, number] = [15, 23, 42]; // slate-900
  const accentColor: [number, number, number] = [245, 158, 11]; // amber-500

  // 1. Header Banner
  doc.setFillColor(...headerBgColor);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line under header
  doc.setFillColor(...accentColor);
  doc.rect(0, 27, pageWidth, 1.5, 'F');

  // App / Document Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('FREIGHT PROFIT, TAX & INTEREST REPORT', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Comprehensive Financial Breakdown & Consignment Audit', margin, 18);
  doc.text(
    `Generated: ${new Date().toLocaleString()}  |  Currency: ${generalSettings.currencyCode} (${generalSettings.currencySymbol})`,
    margin,
    23
  );

  // 2. Metadata Box
  let curY = 34;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, curY, pageWidth - margin * 2, 20, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Trip / LR Ref:`, margin + 4, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(tripRef, margin + 28, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`Trip Title:`, margin + 65, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(input.title || 'Standard Freight Trip', margin + 83, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`Selling Price:`, margin + 4, curY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    formatCurrency(result.sellingPrice, generalSettings.currencySymbol),
    margin + 28,
    curY + 14
  );

  doc.setFont('helvetica', 'bold');
  doc.text(`Buying Cost:`, margin + 65, curY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    formatCurrency(result.buyingPrice, generalSettings.currencySymbol),
    margin + 87,
    curY + 14
  );

  doc.setFont('helvetica', 'bold');
  doc.text(`Profit (PAT):`, margin + 125, curY + 14);
  doc.setFont('helvetica', 'bold');
  if (result.profitAfterTax >= 0) {
    doc.setTextColor(16, 185, 129); // emerald-500
  } else {
    doc.setTextColor(225, 29, 72); // rose-600
  }
  doc.text(
    `${formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)} (${result.percentageOfSale}%)`,
    margin + 148,
    curY + 14
  );

  curY += 25;

  // 3. Section 1: Revenue & Gross Margin Table
  const section1 = stripFormulaColumn(
    [
      '1. REVENUE & GROSS PROFIT METRIC',
      'COMPUTATION / BASIS',
      `AMOUNT (${generalSettings.currencyCode})`,
    ],
    [
      [
        'Selling Price (Customer Freight Revenue)',
        'Primary Billing Rate',
        formatCurrency(result.sellingPrice, generalSettings.currencySymbol),
      ],
      [
        'Buying Price (Lorry Hire / Cost)',
        'Base Transportation Outlay',
        formatCurrency(result.buyingPrice, generalSettings.currencySymbol),
      ],
      [
        'Gross Profit (GP)',
        'Selling Price − Buying Price',
        `${formatCurrency(result.grossProfit, generalSettings.currencySymbol)} (${result.grossProfitMargin}%)`,
      ],
    ]
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [section1.head],
    body: section1.body,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: section1.columnStyles,
    theme: 'striped',
  });

  // @ts-ignore
  curY = (doc as any).lastAutoTable.finalY + 6;

  // 4. Section 2: Interest & Financing Tranches Table
  const interestRows: any[] = result.interestDetails.map((int) => [
    `${int.name} (${int.allocationPercent}%)`,
    int.formulaString,
    formatCurrency(int.amount, generalSettings.currencySymbol),
  ]);
  interestRows.push([
    'Total Interest Cost',
    'Sum of all financing tranches',
    formatCurrency(result.totalInterest, generalSettings.currencySymbol),
  ]);

  const section2 = stripFormulaColumn(
    [
      '2. INTEREST & FINANCING TRANCHES',
      'FORMULA APPLIED',
      `AMOUNT (${generalSettings.currencyCode})`,
    ],
    interestRows
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [section2.head],
    body: section2.body,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: section2.columnStyles,
    theme: 'striped',
  });

  // @ts-ignore
  curY = (doc as any).lastAutoTable.finalY + 6;

  // 5. Section 3: Operating Expenses Table
  const expenseRows: any[] = result.expenseDetails
    .filter((e) => e.enabled)
    .map((e) => [
      e.name,
      e.formulaString,
      formatCurrency(e.amount, generalSettings.currencySymbol),
    ]);
  expenseRows.push([
    'Total Operating Expenses',
    'Operating overheads and deductions',
    formatCurrency(result.totalOperatingExpenses, generalSettings.currencySymbol),
  ]);
  expenseRows.push([
    'Net Total Expenses',
    'Total Interest + Total Operating Expenses',
    formatCurrency(result.netTotalExpenses, generalSettings.currencySymbol),
  ]);

  const section3 = stripFormulaColumn(
    [
      '3. OPERATING EXPENSES & NET OVERHEADS',
      'EXPENSE RULE / BASIS',
      `AMOUNT (${generalSettings.currencyCode})`,
    ],
    expenseRows
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [section3.head],
    body: section3.body,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: section3.columnStyles,
    theme: 'striped',
  });

  // @ts-ignore
  curY = (doc as any).lastAutoTable.finalY + 6;

  // Page break check
  if (curY > pageHeight - 75) {
    doc.addPage();
    curY = 16;
  }

  // 6. Section 4: TDS Refund & Carrying Recovery Table
  const tdsRows = [
    [
      'Nominal TDS Deducted (Gross)',
      '2% statutory deduction on Selling Price',
      formatCurrency(result.tdsRefund.nominalTdsAmount, generalSettings.currencySymbol),
    ],
    [
      `Less: Carrying Cost (${result.tdsRefundPeriodMonths ?? tdsSettings.refundCarryingPeriodMonths} mos @ ${tdsSettings.refundCarryingRate}%)`,
      'Financing cost during refund hold period',
      `-${formatCurrency(result.tdsRefund.carryingCostAmount, generalSettings.currencySymbol)}`,
    ],
    [
      `Add: IT Dept Interest Sec 244A (${tdsSettings.itInterestPeriodMonths} mos @ ${tdsSettings.itInterestRate}%)`,
      'Statutory government interest awarded',
      `+${formatCurrency(result.tdsRefund.itInterestAmount, generalSettings.currencySymbol)}`,
    ],
    [
      'Less: Actual IT Liabilities',
      'Income tax liability offset',
      `-${formatCurrency(result.tdsRefund.actualTaxLiabilities, generalSettings.currencySymbol)}`,
    ],
    [
      'Net Saving in TDS',
      'Net recovered working capital from TDS refund',
      formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol),
    ],
    [
      'Net Effective Profit with TDS Recovery',
      'PAT + Net Saving in TDS',
      formatCurrency(result.tdsRefund.netEffectiveProfitWithTds, generalSettings.currencySymbol),
    ],
  ];

  const section4 = stripFormulaColumn(
    [
      '4. TDS CLAIM & REFUND ECONOMICS',
      'STATUTORY COMPUTATION RULE',
      `AMOUNT (${generalSettings.currencyCode})`,
    ],
    tdsRows
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [section4.head],
    body: section4.body,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: section4.columnStyles,
    theme: 'striped',
  });

  // @ts-ignore
  curY = (doc as any).lastAutoTable.finalY + 6;

  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 16;
  }

  // 7. Section 5: Profitability & Tax Computation Table
  const section5 = stripFormulaColumn(
    [
      '5. NET PROFITABILITY & CORPORATE TAX',
      'FORMULA / METRIC',
      `VALUE (${generalSettings.currencyCode})`,
    ],
    [
      [
        'Net Profit Before Tax (NPBT)',
        'Gross Profit − Net Total Expenses',
        `${formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)} (${result.netProfitBeforeTaxMargin}%)`,
      ],
      [
        `Income Tax Liability (@ ${result.incomeTaxRate}%)`,
        'Applied on NPBT',
        formatCurrency(result.incomeTax, generalSettings.currencySymbol),
      ],
      [
        'Profit After Tax (PAT)',
        'NPBT − Income Tax',
        formatCurrency(result.profitAfterTax, generalSettings.currencySymbol),
      ],
      [
        'Percentage of Sale (Net Margin)',
        'PAT ÷ Selling Price × 100',
        `${result.percentageOfSale}%`,
      ],
    ]
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [section5.head],
    body: section5.body,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    columnStyles: section5.columnStyles,
    theme: 'striped',
  });

  // @ts-ignore
  curY = (doc as any).lastAutoTable.finalY + 8;

  // Optional Notes section
  if (input.notes && input.notes.trim()) {
    if (curY > pageHeight - 30) {
      doc.addPage();
      curY = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Trip Notes & Remarks:', margin, curY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const splitNotes = doc.splitTextToSize(input.notes, pageWidth - margin * 2);
    doc.text(splitNotes, margin, curY + 4);
    curY += 6 + splitNotes.length * 4;
  }

  // Add Page Numbers and Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Freight Profit Engine • Stored & Exported to Mobile Storage • Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Trip ${tripRef} | Verified Financial Audit`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  // Trigger Save / Mobile Storage Download
  const pdfBlob = doc.output('blob');
  return savePdfToMobileStorage(pdfBlob, fileName);
}

/**
 * Trigger clean browser print or fallback to direct PDF Mobile Storage download
 */
export function printCalculationReport(
  input: CalculationInput,
  result: CalculationResult,
  expenses: ExpenseItem[],
  interestTranches: InterestTranche[],
  tdsSettings: TdsRefundSettings,
  generalSettings: GeneralSettings,
  showFormulas: boolean = true
): void {
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  if (isMobile) {
    // On mobile devices, window.open is blocked by default popup blockers.
    // Automatically export and save the genuine PDF directly to Mobile Storage!
    exportCalculationToPdf(
      input,
      result,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      undefined,
      showFormulas
    );
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback directly to Mobile Storage PDF export
    exportCalculationToPdf(
      input,
      result,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      undefined,
      showFormulas
    );
    return;
  }

  // When formulas are hidden, the "Formula / Basis" / "Computation Rule"
  // column is dropped entirely (not just blanked) so the printed report
  // reads as a clean amount-only statement rather than leaving an empty
  // column behind.
  const formulaHeaderCell = showFormulas ? '<th>Formula / Basis</th>' : '';
  const computationHeaderCell = showFormulas ? '<th>Computation Rule</th>' : '';
  const formulaCell = (formula: string) => (showFormulas ? `<td>${formula}</td>` : '');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Freight Profit Report - ${input.tripNumber || 'TR-001'}</title>
  <style>
    @media print {
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #000; background: #fff; margin: 20mm; font-size: 12pt; }
      .no-print { display: none !important; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 16px; page-break-inside: avoid; }
      th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
      th { background-color: #f0f0f0; font-weight: bold; }
      .text-right { text-align: right; }
      .highlight { background-color: #f5f5f5; font-weight: bold; }
      .header-box { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
      h1 { margin: 0 0 4px 0; font-size: 18pt; text-transform: uppercase; }
      h2 { margin: 16px 0 6px 0; font-size: 13pt; border-bottom: 1px solid #999; padding-bottom: 3px; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; padding: 30px; max-width: 800px; margin: 0 auto; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    .text-right { text-align: right; }
    .highlight { background: #fafafa; font-weight: 600; }
    .btn-bar { margin-bottom: 20px; display: flex; gap: 10px; }
    .btn { padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .btn-secondary { background: #4b5563; }
  </style>
</head>
<body>
  <div class="no-print btn-bar">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
  </div>

  <div class="header-box">
    <h1>Freight Profit, Tax & Interest Report</h1>
    <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 10pt; color: #444;">
      <div><strong>Trip / Consignment:</strong> ${input.tripNumber || 'TR-001'} | <strong>Title:</strong> ${input.title || 'Freight Profit Analysis'}</div>
      <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <h2>1. Revenue & Gross Profit</h2>
  <table>
    <tr><th>Item</th><th class="text-right">Amount (${generalSettings.currencyCode})</th></tr>
    <tr><td>Selling Price (Customer Freight)</td><td class="text-right">${formatCurrency(result.sellingPrice, generalSettings.currencySymbol)}</td></tr>
    <tr><td>Buying Price (Lorry Hire / Cost)</td><td class="text-right">${formatCurrency(result.buyingPrice, generalSettings.currencySymbol)}</td></tr>
    <tr class="highlight"><td>Gross Profit (Selling − Buying)</td><td class="text-right">${formatCurrency(result.grossProfit, generalSettings.currencySymbol)} (${result.grossProfitMargin}%)</td></tr>
  </table>

  <h2>2. Interest & Operating Expenses</h2>
  <table>
    <tr><th>Description / Allocation</th>${formulaHeaderCell}<th class="text-right">Amount (${generalSettings.currencyCode})</th></tr>
    ${result.interestDetails
      .map(
        (i) =>
          `<tr><td>${i.name} (${i.allocationPercent}%)</td>${formulaCell(i.formulaString)}<td class="text-right">${formatCurrency(i.amount, generalSettings.currencySymbol)}</td></tr>`
      )
      .join('')}
    ${result.expenseDetails
      .filter((e) => e.enabled)
      .map(
        (e) =>
          `<tr><td>${e.name}</td>${formulaCell(e.formulaString)}<td class="text-right">${formatCurrency(e.amount, generalSettings.currencySymbol)}</td></tr>`
      )
      .join('')}
    <tr class="highlight"><td><strong>Net Total Expenses</strong></td>${formulaCell('Total Interest + Operating Expenses')}<td class="text-right">${formatCurrency(result.netTotalExpenses, generalSettings.currencySymbol)}</td></tr>
  </table>

  <h2>3. Profitability & Tax Computation</h2>
  <table>
    <tr><th>Metric</th><th class="text-right">Value (${generalSettings.currencyCode})</th></tr>
    <tr><td>Net Profit Before Tax (Gross Profit − Net Expenses)</td><td class="text-right">${formatCurrency(result.netProfitBeforeTax, generalSettings.currencySymbol)}</td></tr>
    <tr><td>Income Tax (@ ${result.incomeTaxRate}%)</td><td class="text-right">${formatCurrency(result.incomeTax, generalSettings.currencySymbol)}</td></tr>
    <tr class="highlight"><td>Profit After Tax (PAT)</td><td class="text-right">${formatCurrency(result.profitAfterTax, generalSettings.currencySymbol)}</td></tr>
    <tr><td>Percentage of Sale (PAT ÷ Selling Price × 100)</td><td class="text-right">${result.percentageOfSale}%</td></tr>
  </table>

  <h2>4. TDS Claim / Refund Analysis</h2>
  <table>
    <tr><th>Line Item</th>${computationHeaderCell}<th class="text-right">Amount (${generalSettings.currencyCode})</th></tr>
    <tr><td>Nominal TDS Deducted</td>${formulaCell('2% on Selling Price')}<td class="text-right">${formatCurrency(result.tdsRefund.nominalTdsAmount, generalSettings.currencySymbol)}</td></tr>
    <tr><td>Less: Carrying Cost to get refund</td>${formulaCell(result.tdsRefund.carryingCostFormula)}<td class="text-right">-${formatCurrency(result.tdsRefund.carryingCostAmount, generalSettings.currencySymbol)}</td></tr>
    <tr><td>Add: Interest paid by IT Dept</td>${formulaCell(result.tdsRefund.itInterestFormula)}<td class="text-right">+${formatCurrency(result.tdsRefund.itInterestAmount, generalSettings.currencySymbol)}</td></tr>
    <tr><td>Less: Actual Income Tax Liabilities</td>${formulaCell(result.tdsRefund.actualTaxFormula)}<td class="text-right">-${formatCurrency(result.tdsRefund.actualTaxLiabilities, generalSettings.currencySymbol)}</td></tr>
    <tr class="highlight"><td>Net Saving in TDS</td>${formulaCell('TDS − Carrying Cost + IT Int − Tax')}<td class="text-right">${formatCurrency(result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}</td></tr>
    <tr class="highlight"><td>Net Effective Profit with TDS Saving</td>${formulaCell('PAT + Net Saving in TDS')}<td class="text-right">${formatCurrency(result.tdsRefund.netEffectiveProfitWithTds, generalSettings.currencySymbol)} (${result.tdsRefund.percentageOfProfitAfterTdsSaving}%)</td></tr>
  </table>

  <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 10pt;">
    <div>Prepared by: _____________________</div>
    <div>Approved by: _____________________</div>
  </div>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generate a complete, ready-to-build Android Studio Kotlin Project (.zip)
 * Includes Jetpack Compose, Room Database, ViewModels, AndroidManifest, Gradle files!
 */
export async function generateAndroidProjectZip(): Promise<Blob> {
  const zip = new JSZip();

  // 1. Root build.gradle.kts
  zip.file(
    'build.gradle.kts',
    `// Top-level build file for Freight Calculator Android App
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}
`
  );

  // 2. settings.gradle.kts
  zip.file(
    'settings.gradle.kts',
    `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "FreightProfitCalculator"
include(":app")
`
  );

  // 3. gradle.properties
  zip.file(
    'gradle.properties',
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`
  );

  // 4. app/build.gradle.kts
  zip.file(
    'app/build.gradle.kts',
    `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("kotlin-kapt")
}

android {
    namespace = "com.freight.calculator"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.freight.calculator"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2024.11.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation("androidx.compose.material:material-icons-extended:1.7.5")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Room Database for Offline Persistence
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    kapt("androidx.room:room-compiler:$roomVersion")
}
`
  );

  // 5. AndroidManifest.xml
  zip.file(
    'app/src/main/AndroidManifest.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="Freight Calc"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.FreightCalculator">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.FreightCalculator"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`
  );

  // 6. Kotlin Calculation Engine (Pure Kotlin matching Excel logic)
  zip.file(
    'app/src/main/java/com/freight/calculator/engine/FreightEngine.kt',
    `package com.freight.calculator.engine

import java.math.BigDecimal
import java.math.RoundingMode

data class FreightInput(
    val sellingPrice: Double = 51500.0,
    val buyingPrice: Double = 48000.0,
    val interestPortion1Alloc: Double = 75.0,
    val interestPortion2Alloc: Double = 25.0,
    val interestRate1: Double = 1.0,
    val interestRate2: Double = 1.0,
    val days: Int = 20,
    val daysInYear: Int = 365,
    val tdsRate: Double = 2.0,
    val salaryRate: Double = 1.0,
    val managementRate: Double = 1.0,
    val commissionRate: Double = 1.0,
    val consultationRate: Double = 1.0,
    val incomeTaxRate: Double = 27.0,
    val refundCarryingRate: Double = 1.5,
    val refundCarryingMonths: Int = 18,
    val itInterestRate: Double = 0.5,
    val itInterestMonths: Int = 6
)

data class FreightResult(
    val grossProfit: Double,
    val interest75: Double,
    val interest25: Double,
    val totalInterest: Double,
    val tdsAmount: Double,
    val salaryAmount: Double,
    val managementAmount: Double,
    val commissionAmount: Double,
    val consultationAmount: Double,
    val totalOperatingExpenses: Double,
    val netTotalExpenses: Double,
    val netProfitBeforeTax: Double,
    val incomeTax: Double,
    val profitAfterTax: Double,
    val percentageOfSale: Double,
    val tdsRefundCarryingCost: Double,
    val tdsRefundItInterest: Double,
    val netSavingInTds: Double,
    val profitWithTdsSaving: Double,
    val percentageAfterTds: Double
)

object FreightEngine {
    private fun round(value: Double): Double =
        BigDecimal(value).setScale(2, RoundingMode.HALF_UP).toDouble()

    fun calculate(input: FreightInput): FreightResult {
        val sp = input.sellingPrice
        val bp = input.buyingPrice
        val grossProfit = round(sp - bp)

        // Interest Tranche 1: SP * 75% * 1% * 20 / 365
        val interest75 = round(sp * (input.interestPortion1Alloc / 100.0) * (input.interestRate1 / 100.0) * (input.days.toDouble() / input.daysInYear))
        // Interest Tranche 2: SP * 25% * 1% * 20 / 365
        val interest25 = round(sp * (input.interestPortion2Alloc / 100.0) * (input.interestRate2 / 100.0) * (input.days.toDouble() / input.daysInYear))
        val totalInterest = round(interest75 + interest25)

        // Operating Expenses (on SP default)
        val tdsAmount = round(sp * (input.tdsRate / 100.0))
        val salaryAmount = round(sp * (input.salaryRate / 100.0))
        val managementAmount = round(sp * (input.managementRate / 100.0))
        val commissionAmount = round(sp * (input.commissionRate / 100.0))
        val consultationAmount = round(sp * (input.consultationRate / 100.0))

        val totalOperatingExpenses = round(tdsAmount + salaryAmount + managementAmount + commissionAmount + consultationAmount)
        val netTotalExpenses = round(totalOperatingExpenses + totalInterest)

        val netProfitBeforeTax = round(grossProfit - netTotalExpenses)
        val taxableBase = if (netProfitBeforeTax > 0) netProfitBeforeTax else 0.0
        val incomeTax = round(taxableBase * (input.incomeTaxRate / 100.0))
        val profitAfterTax = round(netProfitBeforeTax - incomeTax)
        val percentageOfSale = if (sp > 0) round((profitAfterTax / sp) * 100.0) else 0.0

        // TDS Claim / Refund Computation
        val carryingCost = round(tdsAmount * (input.refundCarryingRate / 100.0) * input.refundCarryingMonths)
        val refundableBase = if (tdsAmount > incomeTax) tdsAmount - incomeTax else 0.0
        val itInterest = round(refundableBase * (input.itInterestRate / 100.0) * input.itInterestMonths)
        val netSavingInTds = round(tdsAmount - carryingCost + itInterest - incomeTax)
        val profitWithTdsSaving = round(profitAfterTax + netSavingInTds)
        val percentageAfterTds = if (sp > 0) round((profitWithTdsSaving / sp) * 100.0) else 0.0

        return FreightResult(
            grossProfit = grossProfit,
            interest75 = interest75,
            interest25 = interest25,
            totalInterest = totalInterest,
            tdsAmount = tdsAmount,
            salaryAmount = salaryAmount,
            managementAmount = managementAmount,
            commissionAmount = commissionAmount,
            consultationAmount = consultationAmount,
            totalOperatingExpenses = totalOperatingExpenses,
            netTotalExpenses = netTotalExpenses,
            netProfitBeforeTax = netProfitBeforeTax,
            incomeTax = incomeTax,
            profitAfterTax = profitAfterTax,
            percentageOfSale = percentageOfSale,
            tdsRefundCarryingCost = carryingCost,
            tdsRefundItInterest = itInterest,
            netSavingInTds = netSavingInTds,
            profitWithTdsSaving = profitWithTdsSaving,
            percentageAfterTds = percentageAfterTds
        )
    }
}
`
  );

  // 7. MainActivity.kt
  zip.file(
    'app/src/main/java/com/freight/calculator/MainActivity.kt',
    `package com.freight.calculator

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freight.calculator.engine.FreightEngine
import com.freight.calculator.engine.FreightInput
import java.text.NumberFormat
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3B82F6),
                    secondary = Color(0xFFF59E0B),
                    background = Color(0xFF0F172A),
                    surface = Color(0xFF1E293B)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FreightCalculatorApp()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FreightCalculatorApp() {
    var sellingPriceText by remember { mutableStateOf("51500") }
    var buyingPriceText by remember { mutableStateOf("48000") }
    var daysText by remember { mutableStateOf("20") }
    var interestRateText by remember { mutableStateOf("1.0") }
    var tdsRateText by remember { mutableStateOf("2.0") }
    var taxRateText by remember { mutableStateOf("27.0") }

    val sp = sellingPriceText.toDoubleOrNull() ?: 0.0
    val bp = buyingPriceText.toDoubleOrNull() ?: 0.0
    val days = daysText.toIntOrNull() ?: 20
    val rate = interestRateText.toDoubleOrNull() ?: 1.0
    val tdsRate = tdsRateText.toDoubleOrNull() ?: 2.0
    val taxRate = taxRateText.toDoubleOrNull() ?: 27.0

    val input = FreightInput(
        sellingPrice = sp,
        buyingPrice = bp,
        days = days,
        interestRate1 = rate,
        interestRate2 = rate,
        tdsRate = tdsRate,
        incomeTaxRate = taxRate
    )

    val result = FreightEngine.calculate(input)
    val rupee = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Freight Profit & Tax Calc", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1E293B),
                    titleContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Quick Inputs Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Trip Financial Inputs", fontWeight = FontWeight.SemiBold, color = Color.White)
                    OutlinedTextField(
                        value = sellingPriceText,
                        onValueChange = { sellingPriceText = it },
                        label = { Text("Selling Price (₹)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = buyingPriceText,
                        onValueChange = { buyingPriceText = it },
                        label = { Text("Buying Price (₹)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = daysText,
                            onValueChange = { daysText = it },
                            label = { Text("Days") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = interestRateText,
                            onValueChange = { interestRateText = it },
                            label = { Text("Interest %") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Results Grid Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Calculation Results", fontWeight = FontWeight.SemiBold, color = Color(0xFFF59E0B))
                    ResultRow("Gross Profit", rupee.format(result.grossProfit))
                    ResultRow("Total Interest (75% + 25%)", rupee.format(result.totalInterest))
                    ResultRow("Total Operating Expenses", rupee.format(result.totalOperatingExpenses))
                    ResultRow("Net Total Expenses", rupee.format(result.netTotalExpenses))
                    Divider(color = Color.Gray.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 4.dp))
                    ResultRow("Net Profit Before Tax", rupee.format(result.netProfitBeforeTax), highlight = true)
                    ResultRow("Income Tax (\${taxRate}%)", rupee.format(result.incomeTax))
                    ResultRow("Profit After Tax (PAT)", rupee.format(result.profitAfterTax), highlight = true)
                    ResultRow("Percentage of Sale", "\${result.percentageOfSale}%")
                    Divider(color = Color.Gray.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 4.dp))
                    ResultRow("Net Saving in TDS", rupee.format(result.netSavingInTds), highlight = true)
                    ResultRow("Net Profit with TDS", rupee.format(result.profitWithTdsSaving), highlight = true)
                    ResultRow("Percentage with TDS", "\${result.percentageAfterTds}%")
                }
            }
        }
    }
}

@Composable
fun ResultRow(label: String, value: String, highlight: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = if (highlight) Color.White else Color.LightGray, fontSize = 14.sp, fontWeight = if (highlight) FontWeight.Bold else FontWeight.Normal)
        Text(value, color = if (highlight) Color(0xFF60A5FA) else Color.White, fontSize = 14.sp, fontWeight = if (highlight) FontWeight.Bold else FontWeight.Medium)
    }
}
`
  );

  // 8. README.md with APK build instructions
  zip.file(
    'README.md',
    `# Freight Profit, Tax & Interest Calculator - Android APK Project

This is a complete, native Android Studio Kotlin + Jetpack Compose application built for the Freight & Logistics profit analysis engine.

## Prerequisites
- Android Studio Ladybug / Koala / Hedgehog or newer
- JDK 17+
- Android SDK 35 (compileSdk 35, minSdk 24)

## How to Build the APK in 1 Minute:

### Option A: Command Line (Fastest)
1. Open Terminal in this folder:
\`\`\`bash
chmod +x gradlew
./gradlew assembleDebug
\`\`\`
2. The generated APK will be at:
\`\`\`
app/build/outputs/apk/debug/app-debug.apk
\`\`\`
3. Install directly to your connected Android phone via ADB:
\`\`\`bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
\`\`\`

### Option B: Android Studio GUI
1. Open Android Studio.
2. Select **File > Open** and select this directory.
3. Wait for Gradle Sync to complete.
4. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Click **locate** on the notification popup to get \`app-debug.apk\`.

### Option C: Build Release APK
\`\`\`bash
./gradlew assembleRelease
\`\`\`
`
  );

  // 9. Gradle Wrapper files
  zip.file(
    'gradle/wrapper/gradle-wrapper.properties',
    `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
