/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Simple password gate shown in place of Engine Settings until the correct
 * password is entered. Client-side only — this deters casual access (e.g.
 * someone else picking up the phone), it is not a real access-control
 * boundary since the password lives in the bundled JS.
 */

import React, { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

const SETTINGS_PASSWORD = '1991';

interface SettingsPasswordGateProps {
  onUnlock: () => void;
}

export const SettingsPasswordGate: React.FC<SettingsPasswordGateProps> = ({
  onUnlock,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SETTINGS_PASSWORD) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-lg text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6 text-amber-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">Engine Settings Locked</h2>
        <p className="text-xs text-slate-400 mt-1">
          Enter the password to access Expenses, Interest, TDS and Tax
          configuration.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          className={`w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-center text-white tracking-widest focus:outline-none ${
            error ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {error && (
          <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs">
            <ShieldAlert className="w-3.5 h-3.5" />
            Incorrect password. Try again.
          </div>
        )}
        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold transition"
        >
          Unlock
        </button>
      </form>
    </div>
  );
};
