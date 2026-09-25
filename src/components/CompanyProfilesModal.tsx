import React, { useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  Percent,
  Plus,
  Save,
  Search,
  Sliders,
  Trash2,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import {
  CompanyProfile,
  ExpenseItem,
  GeneralSettings,
  InterestTranche,
  TdsRefundSettings,
} from '../types';
import {
  DEFAULT_EXPENSES,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_INTEREST_TRANCHES,
  DEFAULT_TDS_SETTINGS,
} from '../services/calculationEngine';

interface CompanyProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: CompanyProfile[];
  activeClientName?: string;
  onSaveProfile: (profile: CompanyProfile) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onApplyProfile: (profile: CompanyProfile) => void;
  // Current active calculator engine settings that can be copied to a profile
  currentExpenses: ExpenseItem[];
  currentInterestTranches: InterestTranche[];
  currentTdsSettings: TdsRefundSettings;
  currentGeneralSettings: GeneralSettings;
}

export const CompanyProfilesModal: React.FC<CompanyProfilesModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeClientName,
  onSaveProfile,
  onDeleteProfile,
  onApplyProfile,
  currentExpenses,
  currentInterestTranches,
  currentTdsSettings,
  currentGeneralSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEngineDetails, setShowEngineDetails] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPaymentDays, setFormPaymentDays] = useState<number>(20);
  const [formInterestRate, setFormInterestRate] = useState<number>(1.0);

  // Form Engine Settings
  const [formExpenses, setFormExpenses] = useState<ExpenseItem[]>(DEFAULT_EXPENSES);
  const [formInterestTranches, setFormInterestTranches] = useState<InterestTranche[]>(
    DEFAULT_INTEREST_TRANCHES
  );
  const [formTdsSettings, setFormTdsSettings] = useState<TdsRefundSettings>(
    DEFAULT_TDS_SETTINGS
  );
  const [formGeneralSettings, setFormGeneralSettings] = useState<GeneralSettings>(
    DEFAULT_GENERAL_SETTINGS
  );

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.gstin && p.gstin.toLowerCase().includes(q)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  });

  const handleStartCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormGstin('');
    setFormContactPerson('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormNotes('');
    setFormPaymentDays(currentGeneralSettings.defaultDays || 20);
    setFormInterestRate(currentGeneralSettings.defaultInterestRate || 1.0);
    // Default to current engine settings so it's pre-populated with working numbers
    setFormExpenses(JSON.parse(JSON.stringify(currentExpenses)));
    setFormInterestTranches(JSON.parse(JSON.stringify(currentInterestTranches)));
    setFormTdsSettings(JSON.parse(JSON.stringify(currentTdsSettings)));
    setFormGeneralSettings(JSON.parse(JSON.stringify(currentGeneralSettings)));
    setShowEngineDetails(true);
    setIsEditing(true);
  };

  const handleStartEdit = (profile: CompanyProfile) => {
    setEditingId(profile.id);
    setFormName(profile.name);
    setFormGstin(profile.gstin || '');
    setFormContactPerson(profile.contactPerson || '');
    setFormPhone(profile.phone || '');
    setFormEmail(profile.email || '');
    setFormAddress(profile.address || '');
    setFormNotes(profile.notes || '');
    setFormPaymentDays(
      profile.paymentTermsDays ??
        profile.interestTranches?.[0]?.days ??
        profile.generalSettings?.defaultDays ??
        20
    );
    setFormInterestRate(
      profile.interestRate ??
        profile.interestTranches?.[0]?.annualRate ??
        profile.generalSettings?.defaultInterestRate ??
        1.0
    );
    setFormExpenses(
      profile.expenses ? JSON.parse(JSON.stringify(profile.expenses)) : JSON.parse(JSON.stringify(currentExpenses))
    );
    setFormInterestTranches(
      profile.interestTranches
        ? JSON.parse(JSON.stringify(profile.interestTranches))
        : JSON.parse(JSON.stringify(currentInterestTranches))
    );
    setFormTdsSettings(
      profile.tdsSettings
        ? JSON.parse(JSON.stringify(profile.tdsSettings))
        : JSON.parse(JSON.stringify(currentTdsSettings))
    );
    setFormGeneralSettings(
      profile.generalSettings
        ? JSON.parse(JSON.stringify(profile.generalSettings))
        : JSON.parse(JSON.stringify(currentGeneralSettings))
    );
    setShowEngineDetails(true);
    setIsEditing(true);
  };

  const handleCopyCurrentEngineSettings = () => {
    setFormExpenses(JSON.parse(JSON.stringify(currentExpenses)));
    setFormInterestTranches(JSON.parse(JSON.stringify(currentInterestTranches)));
    setFormTdsSettings(JSON.parse(JSON.stringify(currentTdsSettings)));
    setFormGeneralSettings(JSON.parse(JSON.stringify(currentGeneralSettings)));
    setFormPaymentDays(currentGeneralSettings.defaultDays || 20);
    setFormInterestRate(currentGeneralSettings.defaultInterestRate || 1.0);
    setSuccessMessage('✓ Copied current calculator engine settings!');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Please enter a Company / Client Name.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const id = editingId || 'cp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Keep interest tranche 1 days & rate synced with the primary inputs
      const tranches = formInterestTranches.map((t, idx) => {
        if (idx === 0) {
          return {
            ...t,
            days: formPaymentDays,
            annualRate: formInterestRate,
          };
        }
        return t;
      });

      const profile: CompanyProfile = {
        id,
        name: formName.trim(),
        gstin: formGstin.trim() || undefined,
        contactPerson: formContactPerson.trim() || undefined,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined,
        paymentTermsDays: formPaymentDays,
        interestRate: formInterestRate,
        expenses: formExpenses,
        interestTranches: tranches,
        tdsSettings: formTdsSettings,
        generalSettings: {
          ...formGeneralSettings,
          defaultDays: formPaymentDays,
          defaultInterestRate: formInterestRate,
        },
        createdAt: editingId
          ? profiles.find((p) => p.id === editingId)?.createdAt || now
          : now,
        updatedAt: now,
      };

      await onSaveProfile(profile);
      setIsEditing(false);
      setEditingId(null);
      setSuccessMessage(`✓ Company Profile "${profile.name}" saved!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save Company Profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Company Profiles (Clients)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {profiles.length} Profiles
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Each company has its own calculation rules & engine settings (credit days, TDS, interest, expenses).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner if any */}
        {successMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-800 text-emerald-300 text-xs px-4 py-2 font-medium flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!isEditing ? (
            <>
              {/* Top controls: Search & Add Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search company name, GSTIN, contact person..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500"
                  />
                </div>

                <button
                  id="btn-add-company-profile"
                  onClick={handleStartCreate}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Company Profile</span>
                </button>
              </div>

              {/* Profiles List */}
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/50 border border-slate-800 rounded-2xl p-6">
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <div className="text-sm font-bold text-slate-300">
                    {searchQuery ? `No profiles match "${searchQuery}"` : 'No Company Profiles Added Yet'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Add company profiles so that each client gets its own custom credit days, TDS rates, and interest engine automatically!
                  </p>
                  <button
                    onClick={handleStartCreate}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    + Create First Company Profile
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredProfiles.map((profile) => {
                    const isActive =
                      activeClientName &&
                      activeClientName.toLowerCase() === profile.name.toLowerCase();

                    const creditDays =
                      profile.paymentTermsDays ??
                      profile.interestTranches?.[0]?.days ??
                      20;
                    const interestRate =
                      profile.interestRate ??
                      profile.interestTranches?.[0]?.annualRate ??
                      1.0;
                    const tdsRate =
                      profile.tdsSettings?.nominalTdsRate ?? 2.0;

                    return (
                      <div
                        key={profile.id}
                        className={`bg-slate-950/70 border rounded-xl p-4 transition space-y-3 flex flex-col justify-between ${
                          isActive
                            ? 'border-amber-500/80 ring-1 ring-amber-500/50 shadow-md'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-white truncate">
                                  {profile.name}
                                </h3>
                                {isActive && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                    Active in Calculator
                                  </span>
                                )}
                              </div>
                              {profile.gstin && (
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  GSTIN: {profile.gstin}
                                </div>
                              )}
                              {profile.contactPerson && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Contact: {profile.contactPerson} {profile.phone ? `(${profile.phone})` : ''}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Financial Engine Badges */}
                          <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg p-2 mt-3 text-[11px]">
                            <div>
                              <div className="text-[10px] text-slate-500 font-medium">Credit Days</div>
                              <div className="text-white font-mono font-bold">{creditDays}d</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-medium">Interest</div>
                              <div className="text-amber-400 font-mono font-bold">{interestRate}%</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-medium">TDS Rate</div>
                              <div className="text-cyan-300 font-mono font-bold">{tdsRate}%</div>
                            </div>
                          </div>

                          {profile.notes && (
                            <div className="text-[11px] text-slate-400 italic mt-2 line-clamp-2">
                              "{profile.notes}"
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onApplyProfile(profile);
                              onClose();
                            }}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              isActive
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{isActive ? 'Active (Re-apply)' : 'Apply to Calculator'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(profile)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit Profile & Engine Settings"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete company profile "${profile.name}"?`)) {
                                onDeleteProfile(profile.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* EDIT / CREATE FORM */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>{editingId ? 'Edit Company Profile & Engine' : 'New Company Profile & Engine'}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCurrentEngineSettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition"
                    title="Load whatever is currently configured in the main calculator engine"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Copy Current Calculator Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Company Info Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Company / Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Tata Steel Ltd / Reliance Logistics"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GSTIN / Tax ID
                  </label>
                  <input
                    type="text"
                    value={formGstin}
                    onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Address / Notes
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Branch, Plant location, or special payment terms"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Dedicated Financial Engine Settings for this Company */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Company Engine Settings (Applied when this Client is selected)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEngineDetails(!showEngineDetails)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <span>{showEngineDetails ? 'Hide Detailed Toggles' : 'Show Detailed Toggles'}</span>
                    {showEngineDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Primary Financial Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Payment Credit Period (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formPaymentDays}
                      onChange={(e) => setFormPaymentDays(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500">Days to realize payment from client</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formInterestRate}
                      onChange={(e) => setFormInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500">Capital interest / finance charge %</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Client TDS Deduction Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formTdsSettings.nominalTdsRate}
                      onChange={(e) =>
                        setFormTdsSettings((p) => ({
                          ...p,
                          nominalTdsRate: Math.max(0, parseFloat(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500">Nominal TDS % deducted on Selling Price</span>
                  </div>
                </div>

                {/* Extended Engine Toggles (Expenses & TDS rules) */}
                {showEngineDetails && (
                  <div className="space-y-4 pt-3 border-t border-slate-800">
                    {/* TDS Extended Settings */}
                    <div>
                      <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                        TDS Claim & Carrying Cost Rules
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-400 mb-1">IT Section 244A Interest (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formTdsSettings.itInterestRate}
                            onChange={(e) =>
                              setFormTdsSettings((p) => ({
                                ...p,
                                itInterestRate: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Refund Carrying Rate (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formTdsSettings.refundCarryingRate}
                            onChange={(e) =>
                              setFormTdsSettings((p) => ({
                                ...p,
                                refundCarryingRate: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Carrying Period (Months)</label>
                          <input
                            type="number"
                            value={formTdsSettings.refundCarryingPeriodMonths}
                            onChange={(e) =>
                              setFormTdsSettings((p) => ({
                                ...p,
                                refundCarryingPeriodMonths: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expense Defaults */}
                    <div>
                      <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                        Default Expense Rules for this Company
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {formExpenses.map((exp, idx) => (
                          <div
                            key={exp.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                          >
                            <label className="flex items-center gap-2 text-slate-300 font-medium">
                              <input
                                type="checkbox"
                                checked={exp.enabled}
                                onChange={(e) => {
                                  const updated = [...formExpenses];
                                  updated[idx] = { ...updated[idx], enabled: e.target.checked };
                                  setFormExpenses(updated);
                                }}
                                className="accent-amber-500 rounded"
                              />
                              <span className="truncate max-w-[140px]">{exp.name}</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={exp.percentage}
                                onChange={(e) => {
                                  const updated = [...formExpenses];
                                  updated[idx] = {
                                    ...updated[idx],
                                    percentage: parseFloat(e.target.value) || 0,
                                  };
                                  setFormExpenses(updated);
                                }}
                                className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-right font-mono"
                              />
                              <span className="text-slate-500">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : editingId ? 'Update Company Profile' : 'Save Company Profile'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
