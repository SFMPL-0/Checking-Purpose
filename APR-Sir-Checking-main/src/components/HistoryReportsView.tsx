import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  CalculationGroup,
  CalculationHistoryEntry,
  CalculationInput,
  CalculationResult,
  DailyGroupSummary,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  SavedCalculation,
  TdsRefundSettings,
} from '../types';
import {
  CalculationGroupPage,
  CalculationHistoryPage,
  LoadCalculationGroupsOptions,
  LoadCalculationHistoryOptions,
} from '../services/storage';
import {
  exportCalculationToExcel,
  exportCalculationToPdf,
  exportHistoryToExcel,
  printCalculationReport,
} from '../services/exportService';
import { formatCurrency, formatPercent } from '../services/calculationEngine';

interface HistoryReportsViewProps {
  savedCalculations: SavedCalculation[];
  onReopenCalculation: (saved: SavedCalculation) => void;
  onDuplicateCalculation: (id: string) => void;
  onDeleteCalculation: (id: string) => void;
  currentInput: CalculationInput;
  currentResult: CalculationResult;
  expenses: ExpenseItem[];
  interestTranches: InterestTranche[];
  tdsSettings: TdsRefundSettings;
  generalSettings: GeneralSettings;
  onSaveCurrent: () => void;
  onLoadCalculationHistory: (
    options?: LoadCalculationHistoryOptions
  ) => Promise<CalculationHistoryPage>;
  onClearCalculationHistory: () => Promise<void>;
  onReopenHistoryEntry: (entry: CalculationHistoryEntry) => void;
  onSaveHistoryEntry: (entry: CalculationHistoryEntry, name: string) => Promise<void>;
  onLoadCalculationGroups: (
    options?: LoadCalculationGroupsOptions
  ) => Promise<CalculationGroupPage>;
  onLoadDailyGroupSummary: (
    dateFrom: string,
    dateTo: string
  ) => Promise<DailyGroupSummary[]>;
  onDeleteCalculationGroup: (id: string) => Promise<void>;
  onReopenGroup: (group: CalculationGroup) => void;
  onNavigateTab: (tab: string) => void;
}

export const HistoryReportsView: React.FC<HistoryReportsViewProps> = ({
  savedCalculations,
  onReopenCalculation,
  onDuplicateCalculation,
  onDeleteCalculation,
  currentInput,
  currentResult,
  expenses,
  interestTranches,
  tdsSettings,
  generalSettings,
  onSaveCurrent,
  onLoadCalculationHistory,
  onClearCalculationHistory,
  onReopenHistoryEntry,
  onSaveHistoryEntry,
  onLoadCalculationGroups,
  onLoadDailyGroupSummary,
  onDeleteCalculationGroup,
  onReopenGroup,
  onNavigateTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'history' | 'autolog' | 'groups' | 'reports'
  >('history');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReportType, setSelectedReportType] = useState<
    'profit' | 'expense' | 'interest' | 'tds' | 'tax'
  >('profit');

  // Auto Log (calculation_history) state — paginated (keyset cursor) since
  // this table can hold years of data; we never load it all at once.
  const [autoHistory, setAutoHistory] = useState<CalculationHistoryEntry[]>([]);
  const [autoHistoryLoading, setAutoHistoryLoading] = useState(false);
  const [autoHistoryLoaded, setAutoHistoryLoaded] = useState(false);
  const [autoHistoryHasMore, setAutoHistoryHasMore] = useState(false);
  const [autoHistorySearch, setAutoHistorySearch] = useState('');
  const PAGE_SIZE = 50;

  const runAutoHistorySearch = (tripNumber: string) => {
    setAutoHistoryLoading(true);
    onLoadCalculationHistory({ limit: PAGE_SIZE, tripNumber })
      .then((page) => {
        setAutoHistory(page.entries);
        setAutoHistoryHasMore(page.hasMore);
        setAutoHistoryLoaded(true);
      })
      .finally(() => setAutoHistoryLoading(false));
  };

  const refreshAutoHistory = () => runAutoHistorySearch(autoHistorySearch);

  const loadMoreAutoHistory = () => {
    if (autoHistory.length === 0) return;
    const cursor = autoHistory[autoHistory.length - 1].createdAt;
    setAutoHistoryLoading(true);
    onLoadCalculationHistory({
      limit: PAGE_SIZE,
      before: cursor,
      tripNumber: autoHistorySearch,
    })
      .then((page) => {
        setAutoHistory((prev) => [...prev, ...page.entries]);
        setAutoHistoryHasMore(page.hasMore);
      })
      .finally(() => setAutoHistoryLoading(false));
  };

  useEffect(() => {
    if (activeSubTab === 'autolog' && !autoHistoryLoaded) {
      refreshAutoHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  const handleClearAutoHistory = async () => {
    if (
      !window.confirm(
        'Clear the entire automatic calculation log? Your named "Saved Trips" archive is not affected. This cannot be undone.'
      )
    ) {
      return;
    }
    await onClearCalculationHistory();
    setAutoHistory([]);
    setAutoHistoryHasMore(false);
  };

  const handlePromoteEntry = async (entry: CalculationHistoryEntry) => {
    const name = window.prompt(
      'Save this calculation to your named archive as:',
      entry.input.title || `Trip ${entry.input.tripNumber || ''}`.trim()
    );
    if (!name || !name.trim()) return;
    await onSaveHistoryEntry(entry, name.trim());
    alert(`Saved "${name.trim()}" to your archive.`);
  };

  // Vehicle Groups (multi-vehicle bulk entry batches) state — paginated the
  // same way as Auto Log, plus a Daily Summary computed server-side over a
  // date range so "how much did I do today/this week/this month" is instant.
  const [groups, setGroups] = useState<CalculationGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [groupsHasMore, setGroupsHasMore] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const [dailySummary, setDailySummary] = useState<DailyGroupSummary[]>([]);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [summaryRangeDays, setSummaryRangeDays] = useState(30);
  const GROUP_PAGE_SIZE = 20;

  function isoDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
  const todayIso = () => new Date().toISOString().slice(0, 10);

  const refreshGroups = () => {
    setGroupsLoading(true);
    onLoadCalculationGroups({ limit: GROUP_PAGE_SIZE })
      .then((page) => {
        setGroups(page.entries);
        setGroupsHasMore(page.hasMore);
        setGroupsLoaded(true);
      })
      .finally(() => setGroupsLoading(false));
  };

  const loadMoreGroups = () => {
    if (groups.length === 0) return;
    const cursor = groups[groups.length - 1].createdAt;
    setGroupsLoading(true);
    onLoadCalculationGroups({ limit: GROUP_PAGE_SIZE, before: cursor })
      .then((page) => {
        setGroups((prev) => [...prev, ...page.entries]);
        setGroupsHasMore(page.hasMore);
      })
      .finally(() => setGroupsLoading(false));
  };

  const refreshDailySummary = (rangeDays: number) => {
    setDailySummaryLoading(true);
    onLoadDailyGroupSummary(isoDaysAgo(rangeDays - 1), todayIso())
      .then(setDailySummary)
      .finally(() => setDailySummaryLoading(false));
  };

  useEffect(() => {
    if (activeSubTab === 'groups' && !groupsLoaded) {
      refreshGroups();
      refreshDailySummary(summaryRangeDays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  const handleChangeSummaryRange = (days: number) => {
    setSummaryRangeDays(days);
    refreshDailySummary(days);
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Delete this batch? This cannot be undone.')) return;
    await onDeleteCalculationGroup(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
    refreshDailySummary(summaryRangeDays);
  };

  const grandTotalForRange = dailySummary.reduce(
    (acc, d) => ({
      groupCount: acc.groupCount + d.groupCount,
      vehicleCount: acc.vehicleCount + d.vehicleCount,
      totalSellingPrice: acc.totalSellingPrice + d.totalSellingPrice,
      totalBuyingPrice: acc.totalBuyingPrice + d.totalBuyingPrice,
      totalNetProfit: acc.totalNetProfit + d.totalNetProfit,
    }),
    { groupCount: 0, vehicleCount: 0, totalSellingPrice: 0, totalBuyingPrice: 0, totalNetProfit: 0 }
  );

  // Filter calculations by query
  const filteredCalculations = savedCalculations.filter((calc) => {
    const q = searchQuery.toLowerCase();
    return (
      calc.name.toLowerCase().includes(q) ||
      (calc.tripNumber && calc.tripNumber.toLowerCase().includes(q)) ||
      (calc.notes && calc.notes.toLowerCase().includes(q))
    );
  });

  const handleExportAllToExcel = () => {
    exportHistoryToExcel(savedCalculations);
  };

  const handlePrintCurrent = () => {
    printCalculationReport(
      currentInput,
      currentResult,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings
    );
  };

  const handleExportCurrentToExcel = () => {
    exportCalculationToExcel(
      currentInput,
      currentResult,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      `Freight_${currentInput.tripNumber || 'Trip'}.xlsx`
    );
  };

  const handleExportCurrentToPdf = async () => {
    await exportCalculationToPdf(
      currentInput,
      currentResult,
      expenses,
      interestTranches,
      tdsSettings,
      generalSettings,
      `Freight_Report_${currentInput.tripNumber || 'Trip'}.pdf`
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <History className="w-4 h-4" />
              <span>Offline Database & Audit Trails</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
              Trip History & Business Reports
            </h1>
            <p className="text-sm text-slate-400">
              Preserves isolated snapshot configurations so reopened historical trips never alter silently.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSaveCurrent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
            >
              <span>Save Current Trip</span>
            </button>
            <button
              onClick={handleExportAllToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export History (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-2 mt-4 border-t border-slate-700/80 pt-3">
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Saved Trips Archive ({savedCalculations.length})
          </button>
          <button
            onClick={() => setActiveSubTab('autolog')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'autolog'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Auto Log{autoHistoryLoaded ? ` (${autoHistory.length})` : ''}
          </button>
          <button
            onClick={() => setActiveSubTab('groups')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'groups'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Vehicle Groups{groupsLoaded ? ` (${groups.length})` : ''}
          </button>
          <button
            onClick={() => setActiveSubTab('reports')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'reports'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Structured Profit & Tax Reports
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: SAVED HISTORY ARCHIVE */}
      {activeSubTab === 'history' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by trip name, LR number (e.g. TR-001), or notes..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500"
            />
          </div>

          {filteredCalculations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No saved calculations found. Click "Save Current Trip" to archive a record.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCalculations.map((calc) => (
                <div
                  key={calc.id}
                  className="bg-slate-900/70 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-4 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {calc.name}
                        </span>
                        {calc.tripNumber && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                            {calc.tripNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(calc.createdAt).toLocaleString()}</span>
                        {calc.notes && <span>• {calc.notes}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onReopenCalculation(calc)}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                      >
                        Reopen Snapshot
                      </button>
                      <button
                        onClick={() =>
                          exportCalculationToPdf(
                            calc.input,
                            calc.result,
                            calc.expenses,
                            calc.interestTranches,
                            calc.tdsSettings,
                            calc.generalSettings,
                            `Freight_Report_${calc.tripNumber || calc.name}.pdf`
                          )
                        }
                        className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 transition"
                        title="Export PDF to Mobile Storage"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDuplicateCalculation(calc.id)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${calc.name}"?`
                            )
                          ) {
                            onDeleteCalculation(calc.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-[11px]">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Selling Price</div>
                      <div className="text-white font-mono font-bold">
                        {formatCurrency(calc.result.sellingPrice, generalSettings.currencySymbol)}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Buying Price</div>
                      <div className="text-slate-300 font-mono">
                        {formatCurrency(calc.result.buyingPrice, generalSettings.currencySymbol)}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Gross Profit</div>
                      <div className="text-emerald-400 font-mono font-bold">
                        {formatCurrency(calc.result.grossProfit, generalSettings.currencySymbol)}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Net Expenses</div>
                      <div className="text-amber-300 font-mono">
                        {formatCurrency(calc.result.netTotalExpenses, generalSettings.currencySymbol)}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Profit (PAT)</div>
                      <div className="text-emerald-400 font-mono font-bold">
                        {formatCurrency(calc.result.profitAfterTax, generalSettings.currencySymbol)}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">TDS Saving</div>
                      <div className="text-amber-400 font-mono font-bold">
                        {formatCurrency(calc.result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 1.5: AUTOMATIC CALCULATION LOG */}
      {activeSubTab === 'autolog' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <p className="text-xs text-slate-400 max-w-xl">
              Every calculation you run is logged here automatically in the
              background — even if you never click "Save Current Trip" — so
              old numbers are never lost, going back as far as you've used
              the app.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={refreshAutoHistory}
                disabled={autoHistoryLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${autoHistoryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleClearAutoHistory}
                disabled={autoHistoryLoading || autoHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-semibold transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Log
              </button>
            </div>
          </div>

          {/* Search by trip/LR number — hits the trip_number index rather
              than scanning the whole log, so this stays quick even years in. */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={autoHistorySearch}
              onChange={(e) => setAutoHistorySearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runAutoHistorySearch(autoHistorySearch);
              }}
              placeholder="Search by trip/LR number, then press Enter..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-24 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500"
            />
            <button
              onClick={() => runAutoHistorySearch(autoHistorySearch)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition"
            >
              Search
            </button>
          </div>

          {autoHistoryLoading && autoHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Loading calculation log from Supabase…
            </div>
          ) : autoHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {autoHistorySearch
                ? `No entries found matching "${autoHistorySearch}".`
                : 'No automatic history yet. Make a calculation on the Dashboard and it will appear here within a few seconds.'}
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {autoHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-slate-900/70 border border-slate-700/80 hover:border-slate-600 rounded-xl p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                        {entry.input.tripNumber && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                            {entry.input.tripNumber}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
                        <div>
                          <span className="text-slate-500">Selling: </span>
                          <span className="text-white font-mono font-bold">
                            {formatCurrency(entry.result.sellingPrice, generalSettings.currencySymbol)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Buying: </span>
                          <span className="text-white font-mono font-bold">
                            {formatCurrency(entry.result.buyingPrice, generalSettings.currencySymbol)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Net Profit: </span>
                          <span
                            className={`font-mono font-bold ${
                              entry.result.tdsRefund.netProfitWithTdsSaving >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {formatCurrency(entry.result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">TDS Saving: </span>
                          <span className="text-amber-400 font-mono font-bold">
                            {formatCurrency(entry.result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onReopenHistoryEntry(entry)}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                      >
                        Reopen
                      </button>
                      <button
                        onClick={() => handlePromoteEntry(entry)}
                        className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-slate-800 transition"
                        title="Save to named archive"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {autoHistoryHasMore && (
                <div className="text-center pt-2">
                  <button
                    onClick={loadMoreAutoHistory}
                    disabled={autoHistoryLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {autoHistoryLoading ? 'Loading…' : `Load Older Entries (${PAGE_SIZE} more)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 1.75: MULTI-VEHICLE GROUPS + DAILY SUMMARY */}
      {activeSubTab === 'groups' && (
        <div className="space-y-4">
          {/* Daily Summary */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-400" />
                Daily Totals — "How Much Did I Do?"
              </h2>
              <div className="flex items-center gap-1.5">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleChangeSummaryRange(d)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      summaryRangeDays === d
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Last {d}d
                  </button>
                ))}
              </div>
            </div>

            {dailySummaryLoading ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Loading daily totals…
              </div>
            ) : dailySummary.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No vehicle batches saved in the last {summaryRangeDays} days yet.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div>
                    <div className="text-slate-500">Batches</div>
                    <div className="text-white font-mono font-bold">{grandTotalForRange.groupCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Vehicles</div>
                    <div className="text-white font-mono font-bold">{grandTotalForRange.vehicleCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Selling</div>
                    <div className="text-white font-mono font-bold">
                      {formatCurrency(grandTotalForRange.totalSellingPrice, generalSettings.currencySymbol)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Buying</div>
                    <div className="text-white font-mono font-bold">
                      {formatCurrency(grandTotalForRange.totalBuyingPrice, generalSettings.currencySymbol)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Net Profit</div>
                    <div
                      className={`font-mono font-bold ${
                        grandTotalForRange.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatCurrency(grandTotalForRange.totalNetProfit, generalSettings.currencySymbol)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 text-left border-b border-slate-700/80">
                        <th className="py-2 font-semibold">Date</th>
                        <th className="py-2 font-semibold">Batches</th>
                        <th className="py-2 font-semibold">Vehicles</th>
                        <th className="py-2 font-semibold">Selling</th>
                        <th className="py-2 font-semibold">Buying</th>
                        <th className="py-2 font-semibold">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.map((d) => (
                        <tr key={d.groupDate} className="border-b border-slate-800/60">
                          <td className="py-2 text-white font-mono">{d.groupDate}</td>
                          <td className="py-2 text-slate-300">{d.groupCount}</td>
                          <td className="py-2 text-slate-300">{d.vehicleCount}</td>
                          <td className="py-2 text-white font-mono">
                            {formatCurrency(d.totalSellingPrice, generalSettings.currencySymbol)}
                          </td>
                          <td className="py-2 text-white font-mono">
                            {formatCurrency(d.totalBuyingPrice, generalSettings.currencySymbol)}
                          </td>
                          <td
                            className={`py-2 font-mono font-bold ${
                              d.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatCurrency(d.totalNetProfit, generalSettings.currencySymbol)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Batch list */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                All Batches
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateTab('bulk')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                >
                  + Add Vehicles
                </button>
                <button
                  onClick={refreshGroups}
                  disabled={groupsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${groupsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {groupsLoading && groups.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Loading vehicle batches from Supabase…
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No batches yet. Use "Multi-Vehicle Entry" to add several
                vehicles at once instead of one-by-one.
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="bg-slate-900/70 border border-slate-700/80 hover:border-slate-600 rounded-xl p-3.5 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold text-sm">{group.groupName}</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                              {group.groupDate}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-bold">
                              {group.vehicles.length} vehicles
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
                            <div>
                              <span className="text-slate-500">Selling: </span>
                              <span className="text-white font-mono font-bold">
                                {formatCurrency(group.totalSellingPrice, generalSettings.currencySymbol)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Buying: </span>
                              <span className="text-white font-mono font-bold">
                                {formatCurrency(group.totalBuyingPrice, generalSettings.currencySymbol)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Net Profit: </span>
                              <span
                                className={`font-mono font-bold ${
                                  group.result.tdsRefund.netProfitWithTdsSaving >= 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {formatCurrency(group.result.tdsRefund.netProfitWithTdsSaving, generalSettings.currencySymbol)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">TDS Saving: </span>
                              <span className="text-amber-400 font-mono font-bold">
                                {formatCurrency(group.result.tdsRefund.netSavingInTds, generalSettings.currencySymbol)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              setExpandedGroupId(expandedGroupId === group.id ? null : group.id)
                            }
                            className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
                          >
                            {expandedGroupId === group.id ? 'Hide Vehicles' : 'Show Vehicles'}
                          </button>
                          <button
                            onClick={() => onReopenGroup(group)}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                            title="Delete batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {expandedGroupId === group.id && (
                        <div className="mt-3 pt-3 border-t border-slate-700/80 overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-slate-500 text-left">
                                <th className="py-1 font-semibold">Vehicle / LR No.</th>
                                <th className="py-1 font-semibold">Selling</th>
                                <th className="py-1 font-semibold">Buying</th>
                                <th className="py-1 font-semibold">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.vehicles.map((v) => (
                                <tr key={v.id} className="border-t border-slate-800/60">
                                  <td className="py-1 text-white">{v.vehicleNumber || '—'}</td>
                                  <td className="py-1 text-white font-mono">
                                    {formatCurrency(v.sellingPrice, generalSettings.currencySymbol)}
                                  </td>
                                  <td className="py-1 text-white font-mono">
                                    {formatCurrency(v.buyingPrice, generalSettings.currencySymbol)}
                                  </td>
                                  <td className="py-1 text-slate-400">{v.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {groupsHasMore && (
                  <div className="text-center pt-2">
                    <button
                      onClick={loadMoreGroups}
                      disabled={groupsLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      {groupsLoading ? 'Loading…' : `Load Older Batches (${GROUP_PAGE_SIZE} more)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: STRUCTURED REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-5">
          {/* Report Category Selector */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'profit', label: '1. Profit & Loss Report' },
              { id: 'expense', label: '2. Operating Expenses Audit' },
              { id: 'interest', label: '3. Financing / Interest Report' },
              { id: 'tds', label: '4. TDS Refund Claim Statement' },
              { id: 'tax', label: '5. Income Tax Computation' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReportType(r.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedReportType === r.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Action Bar for Report */}
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <span className="text-xs text-slate-400 font-medium">
              Black & white print ready • Formal freight accounting layout
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleExportCurrentToPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition active:scale-95"
                title="Export PDF directly to mobile storage"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
              <button
                onClick={handlePrintCurrent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={handleExportCurrentToExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Render Active Report Preview */}
          <div className="bg-white text-slate-900 rounded-xl p-6 shadow-inner space-y-4 font-sans text-xs">
            {/* Formal Report Header */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="text-base font-black uppercase tracking-wider text-slate-900">
                Freight Logistics Profit & Accounting Statement
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 mt-1">
                <span>Trip: {currentInput.tripNumber || 'TR-001'} ({currentInput.title || 'Freight Reference'})</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {selectedReportType === 'profit' && (
              <div className="space-y-3">
                <table className="w-full text-left border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2">Line Item</th>
                      <th className="p-2 text-right">Amount (INR)</th>
                      <th className="p-2 text-right">% of Sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 font-semibold">Selling Price (Revenue)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.sellingPrice, '₹')}</td>
                      <td className="p-2 text-right">100.00%</td>
                    </tr>
                    <tr>
                      <td className="p-2">Buying Price (Lorry Hire Cost)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.buyingPrice, '₹')}</td>
                      <td className="p-2 text-right">{((currentResult.buyingPrice / (currentResult.sellingPrice || 1)) * 100).toFixed(2)}%</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="p-2">Gross Profit</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.grossProfit, '₹')}</td>
                      <td className="p-2 text-right">{currentResult.grossProfitMargin}%</td>
                    </tr>
                    <tr>
                      <td className="p-2">Financing Interest Charges</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.totalInterest, '₹')}</td>
                      <td className="p-2 text-right">{((currentResult.totalInterest / (currentResult.sellingPrice || 1)) * 100).toFixed(2)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2">Operating & Statutory Expenses</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.totalOperatingExpenses, '₹')}</td>
                      <td className="p-2 text-right">{((currentResult.totalOperatingExpenses / (currentResult.sellingPrice || 1)) * 100).toFixed(2)}%</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="p-2">Net Total Expenses</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.netTotalExpenses, '₹')}</td>
                      <td className="p-2 text-right">{((currentResult.netTotalExpenses / (currentResult.sellingPrice || 1)) * 100).toFixed(2)}%</td>
                    </tr>
                    <tr className="bg-slate-100 font-bold">
                      <td className="p-2">Net Profit Before Tax (NPBT)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.netProfitBeforeTax, '₹')}</td>
                      <td className="p-2 text-right">{currentResult.netProfitBeforeTaxMargin}%</td>
                    </tr>
                    <tr>
                      <td className="p-2">Income Tax Liability (@ {currentResult.incomeTaxRate}%)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.incomeTax, '₹')}</td>
                      <td className="p-2 text-right">{((currentResult.incomeTax / (currentResult.sellingPrice || 1)) * 100).toFixed(2)}%</td>
                    </tr>
                    <tr className="bg-emerald-50 text-emerald-950 font-black border-t-2 border-slate-900">
                      <td className="p-2 text-sm">Profit After Tax (PAT)</td>
                      <td className="p-2 text-right font-mono text-sm">{formatCurrency(currentResult.profitAfterTax, '₹')}</td>
                      <td className="p-2 text-right text-sm">{currentResult.percentageOfSale}%</td>
                    </tr>
                    <tr className="bg-amber-50 text-amber-950 font-bold">
                      <td className="p-2">Net Saving in TDS</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.tdsRefund.netSavingInTds, '₹')}</td>
                      <td className="p-2 text-right">{((currentResult.tdsRefund.netSavingInTds / (currentResult.sellingPrice || 1)) * 100).toFixed(2)}%</td>
                    </tr>
                    <tr className="bg-emerald-100 text-emerald-950 font-black border-t-2 border-emerald-900">
                      <td className="p-2 text-sm">Net Profit (PAT + Net Saving in TDS)</td>
                      <td className="p-2 text-right font-mono text-sm text-emerald-900">{formatCurrency(currentResult.tdsRefund.netProfitWithTdsSaving, '₹')}</td>
                      <td className="p-2 text-right text-sm text-emerald-900">{currentResult.tdsRefund.percentageOfProfitAfterTdsSaving.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {selectedReportType === 'tds' && (
              <div className="space-y-3">
                <table className="w-full text-left border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2">TDS Refund Component</th>
                      <th className="p-2">Basis & Rule</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 font-semibold">Nominal TDS Deducted</td>
                      <td className="p-2 text-slate-600">2% on Selling Price</td>
                      <td className="p-2 text-right font-mono">+{formatCurrency(currentResult.tdsRefund.nominalTdsAmount, '₹')}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Less: Carrying Cost (Factor / Financing)</td>
                      <td className="p-2 text-slate-600">{currentResult.tdsRefund.carryingCostFormula}</td>
                      <td className="p-2 text-right font-mono text-rose-700">−{formatCurrency(currentResult.tdsRefund.carryingCostAmount, '₹')}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Add: Interest Paid by IT Department</td>
                      <td className="p-2 text-slate-600">{currentResult.tdsRefund.itInterestFormula}</td>
                      <td className="p-2 text-right font-mono text-cyan-700">+{formatCurrency(currentResult.tdsRefund.itInterestAmount, '₹')}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Less: Actual IT Liabilities</td>
                      <td className="p-2 text-slate-600">{currentResult.tdsRefund.actualTaxFormula}</td>
                      <td className="p-2 text-right font-mono text-rose-700">−{formatCurrency(currentResult.tdsRefund.actualTaxLiabilities, '₹')}</td>
                    </tr>
                    <tr className="bg-amber-50 font-bold">
                      <td className="p-2">Net Saving in TDS</td>
                      <td className="p-2 text-slate-600">Recovered TDS balance</td>
                      <td className="p-2 text-right font-mono text-amber-900">{formatCurrency(currentResult.tdsRefund.netSavingInTds, '₹')}</td>
                    </tr>
                    <tr className="bg-emerald-50 font-black border-t-2 border-emerald-900">
                      <td className="p-2">Net Profit (After TDS Saving)</td>
                      <td className="p-2 text-slate-600">Profit After Tax + Net Saving in TDS</td>
                      <td className="p-2 text-right font-mono text-emerald-900">{formatCurrency(currentResult.tdsRefund.netProfitWithTdsSaving, '₹')}</td>
                    </tr>
                    <tr className="bg-cyan-50 font-bold">
                      <td className="p-2">% of Profit After TDS Saving</td>
                      <td className="p-2 text-slate-600">Net Profit ÷ Selling Price (Freight Charged) × 100</td>
                      <td className="p-2 text-right font-mono text-cyan-900">{currentResult.tdsRefund.percentageOfProfitAfterTdsSaving.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {selectedReportType === 'expense' && (
              <div className="space-y-3">
                <table className="w-full text-left border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2">Expense Item</th>
                      <th className="p-2">Calculation Basis</th>
                      <th className="p-2">Configured % / Fixed</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentResult.expenseDetails.map((e) => (
                      <tr key={e.id} className={!e.enabled ? 'opacity-40' : ''}>
                        <td className="p-2 font-semibold">{e.name}</td>
                        <td className="p-2 capitalize">{e.basis.replace(/_/g, ' ')}</td>
                        <td className="p-2 font-mono">{e.basis === 'fixed_amount' ? `₹${e.fixedAmount}` : `${e.percentage}%`}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(e.amount, '₹')}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold">
                      <td className="p-2" colSpan={3}>Total Operating Expenses</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.totalOperatingExpenses, '₹')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {selectedReportType === 'interest' && (
              <div className="space-y-3">
                <table className="w-full text-left border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2">Portion Name</th>
                      <th className="p-2">Allocation</th>
                      <th className="p-2">Rate & Days</th>
                      <th className="p-2">Formula</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentResult.interestDetails.map((i) => (
                      <tr key={i.id}>
                        <td className="p-2 font-semibold">{i.name}</td>
                        <td className="p-2 font-mono">{i.allocationPercent}%</td>
                        <td className="p-2 font-mono">{i.rate}% for {i.days}d</td>
                        <td className="p-2 font-mono text-[10px] text-slate-600">{i.formulaString}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(i.amount, '₹')}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold">
                      <td className="p-2" colSpan={4}>Total Interest Financing Cost</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.totalInterest, '₹')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {selectedReportType === 'tax' && (
              <div className="space-y-3">
                <table className="w-full text-left border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2">Tax Assessment Parameter</th>
                      <th className="p-2">Computation Rule</th>
                      <th className="p-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 font-semibold">Gross Profit</td>
                      <td className="p-2">Selling Price − Buying Price</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.grossProfit, '₹')}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Total Allowable Deductions & Expenses</td>
                      <td className="p-2">Operating Expenses + Interest</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.netTotalExpenses, '₹')}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="p-2">Net Taxable Profit (NPBT)</td>
                      <td className="p-2">Gross Profit − Total Expenses</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(currentResult.netProfitBeforeTax, '₹')}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold">Income Tax Payable</td>
                      <td className="p-2">Taxable Profit × {currentResult.incomeTaxRate}%</td>
                      <td className="p-2 text-right font-mono text-rose-800">{formatCurrency(currentResult.incomeTax, '₹')}</td>
                    </tr>
                    <tr className="bg-emerald-50 font-black">
                      <td className="p-2">Profit After Tax (PAT)</td>
                      <td className="p-2">NPBT − Income Tax</td>
                      <td className="p-2 text-right font-mono text-emerald-900">{formatCurrency(currentResult.profitAfterTax, '₹')} ({currentResult.percentageOfSale}%)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
