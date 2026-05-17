import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Trash2, Key, Shield, RefreshCw } from 'lucide-react';

interface DashboardUser {
  id: number;
  dashboard: string;
  username: string;
  must_change_pw: boolean;
  created_at: string;
  last_login: string | null;
}

const DASHBOARDS = ['lennox', 'ketolabs', 'utilityhub', 'gts'];

export default function UsersPage() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [newUser, setNewUser] = useState({ dashboard: 'lennox', username: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<{id:number,username:string}|null>(null);
  const [tempPw, setTempPw] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/users');
      const j = await r.json();
      setUsers(j);
    } catch { setMsg('Fehler beim Laden'); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  async function createUser() {
    if (!newUser.username || !newUser.password) return;
    setCreating(true);
    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const j = await r.json();
      if (j.error) flash('Fehler: ' + j.error);
      else { flash('User erstellt'); setNewUser({ dashboard: 'lennox', username: '', password: '' }); load(); }
    } catch { flash('Netzwerkfehler'); }
    setCreating(false);
  }

  async function deleteUser(id: number, username: string) {
    if (!confirm(`${username} löschen?`)) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    flash(`${username} gelöscht`);
    load();
  }

  async function resetPw() {
    if (!resetTarget || !tempPw) return;
    const r = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_password: tempPw }),
    });
    const j = await r.json();
    if (j.ok) { flash(`Passwort zurückgesetzt für ${resetTarget.username}`); setResetTarget(null); setTempPw(''); load(); }
    else flash('Fehler: ' + j.error);
  }

  const filtered = users.filter(u =>
    !filter || u.dashboard.includes(filter) || u.username.includes(filter)
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-os-cyan/10 rounded-lg"><Shield size={20} className="text-os-cyan" /></div>
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard-Nutzer</h1>
          <p className="text-xs text-os-muted">Zugang zu geschützten OS-Dashboards</p>
        </div>
        <button onClick={load} className="ml-auto p-2 text-os-muted hover:text-os-cyan transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-os-cyan/10 border border-os-cyan/20 rounded text-os-cyan text-sm">
          {msg}
        </div>
      )}

      {/* Create form */}
      <div className="bg-os-surface border border-os-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Plus size={14} className="text-os-cyan" /> Neuer Nutzer
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <select
            value={newUser.dashboard}
            onChange={e => setNewUser(p => ({ ...p, dashboard: e.target.value }))}
            className="bg-os-bg border border-os-border rounded px-3 py-2 text-sm text-os-text"
          >
            {DASHBOARDS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            placeholder="Benutzername"
            value={newUser.username}
            onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
            className="bg-os-bg border border-os-border rounded px-3 py-2 text-sm text-os-text placeholder-os-muted"
          />
          <input
            type="password"
            placeholder="Temp-Passwort"
            value={newUser.password}
            onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
            className="bg-os-bg border border-os-border rounded px-3 py-2 text-sm text-os-text placeholder-os-muted"
          />
        </div>
        <button
          onClick={createUser}
          disabled={creating || !newUser.username || !newUser.password}
          className="mt-3 px-4 py-2 bg-os-cyan/10 hover:bg-os-cyan/20 border border-os-cyan/30 text-os-cyan text-sm rounded transition-colors disabled:opacity-50"
        >
          {creating ? 'Erstelle...' : 'Nutzer erstellen'}
        </button>
        <p className="text-xs text-os-muted mt-2">Nutzer muss beim ersten Login Passwort ändern.</p>
      </div>

      {/* Filter */}
      <div className="mb-3">
        <input
          placeholder="Filter nach Dashboard oder Username..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-os-surface border border-os-border rounded px-3 py-2 text-sm text-os-text placeholder-os-muted"
        />
      </div>

      {/* User list */}
      {loading ? (
        <div className="text-os-muted text-sm">Lade...</div>
      ) : (
        <div className="bg-os-surface border border-os-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-os-border">
                <th className="text-left px-4 py-3 text-os-muted font-medium text-xs">Dashboard</th>
                <th className="text-left px-4 py-3 text-os-muted font-medium text-xs">Username</th>
                <th className="text-left px-4 py-3 text-os-muted font-medium text-xs">Status</th>
                <th className="text-left px-4 py-3 text-os-muted font-medium text-xs">Letzter Login</th>
                <th className="text-left px-4 py-3 text-os-muted font-medium text-xs">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-os-border/50 hover:bg-white/2">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-os-cyan/10 text-os-cyan text-xs rounded">{u.dashboard}</span>
                  </td>
                  <td className="px-4 py-3 text-os-text font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    {u.must_change_pw ? (
                      <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">PW ändern</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">Aktiv</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-os-muted text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleString('de') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setResetTarget({ id: u.id, username: u.username }); setTempPw(''); }}
                        className="p-1.5 text-os-muted hover:text-os-cyan transition-colors"
                        title="Passwort zurücksetzen"
                      >
                        <Key size={13} />
                      </button>
                      <button
                        onClick={() => deleteUser(u.id, u.username)}
                        className="p-1.5 text-os-muted hover:text-red-400 transition-colors"
                        title="Nutzer löschen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-os-muted text-sm">Keine Nutzer</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset PW modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-os-surface border border-os-border rounded-lg p-6 w-80">
            <h3 className="font-semibold text-white mb-1">Passwort zurücksetzen</h3>
            <p className="text-xs text-os-muted mb-4">{resetTarget.username}</p>
            <input
              type="password"
              placeholder="Neues Temp-Passwort"
              value={tempPw}
              onChange={e => setTempPw(e.target.value)}
              className="w-full bg-os-bg border border-os-border rounded px-3 py-2 text-sm text-os-text placeholder-os-muted mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={resetPw} className="flex-1 px-3 py-2 bg-os-cyan/10 hover:bg-os-cyan/20 border border-os-cyan/30 text-os-cyan text-sm rounded">
                Zurücksetzen
              </button>
              <button onClick={() => setResetTarget(null)} className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-os-muted text-sm rounded">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
