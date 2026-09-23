/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A text input that doubles as a searchable dropdown over a small master
 * list (Client Name, Truck Type, From/To locations). Typing filters the
 * suggestions; picking one fills the field; typing a name that doesn't
 * exist yet offers "+ Add ... as new".
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { MasterDataItem } from '../types';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: MasterDataItem[];
  loading?: boolean;
  onAddNew: (name: string) => Promise<MasterDataItem | null>;
  placeholder?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  loading,
  onAddNew,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the visible text in sync if the value changes from outside
  // (e.g. reopening a saved calculation).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === query.trim().toLowerCase()
  );

  const handleSelect = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const handleAddNew = async () => {
    const name = query.trim();
    if (!name) return;
    setAdding(true);
    try {
      const created = await onAddNew(name);
      if (created) {
        handleSelect(created.name);
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {filtered.length === 0 && !query.trim() && (
                <div className="px-3 py-2 text-xs text-slate-500">
                  Start typing to search…
                </div>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.name)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                >
                  <span>{opt.name}</span>
                  {opt.name === value && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
              {query.trim() && !exactMatch && (
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={adding}
                  className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-slate-800 flex items-center gap-1.5 border-t border-slate-800 disabled:opacity-50"
                >
                  {adding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Add "{query.trim()}" as new {label.toLowerCase()}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
