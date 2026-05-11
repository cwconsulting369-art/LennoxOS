'use client';

import { useState, useEffect, useCallback } from 'react';
import { Network, Wifi, RefreshCw, Globe, Server, Clock } from 'lucide-react';

interface Port {
  proto: string;
  local: string;
  port: number;
  state: string;
}

interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

interface NetworkResponse {
  ports: Port[];
  interfaces: NetworkInterface[];
}

function fmtBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(2) + ' GB';
  if (b > 1e6) return (b / 1e6).toFixed(2) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

const WELL_KNOWN: Record<number, { label: string; color: string }> = {
  80: { label: 'HTTP', color: 'text-os-green border-os-green/40 bg-os-green/10' },
  443: { label: 'HTTPS', color: 'text-os-cyan border-os-cyan/40 bg-os-cyan/10' },
  3100: { label: 'Paperclip', color: 'text-os-accent border-os-accent/40 bg-os-accent/10' },
  4000: { label: 'LennoxOS', color: 'text-os-yellow border-os-yellow/40 bg-os-yellow/10' },
  7681: { label: 'Terminal', color: 'text-os-red border-os-red/40 bg-os-red/10' },
  5432: { label: 'Postgres', color: 'text-os-green border-os-green/40 bg-os-green/10' },
};

export default function NetworkMonitor() {
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portSearch, setPortSearch] = useState('');

  const fetchNetwork = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/network');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: NetworkResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
    const id = setInterval(fetchNetwork, 30000);
    return () => clearInterval(id);
  }, [fetchNetwork]);

  const ports = data?.ports ?? [];
  const interfaces = data?.interfaces ?? [];

  const filteredPorts = portSearch.trim()
    ? ports.filter(
        (p) =>
          String(p.port).includes(portSearch) ||
          p.local.toLowerCase().includes(portSearch.toLowerCase()) ||
          p.proto.toLowerCase().includes(portSearch.toLowerCase()) ||
          (WELL_KNOWN[p.port]?.label ?? '').toLowerCase().includes(portSearch.toLowerCase())
      )
    : ports;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Network Monitor</h1>
        </div>
        <button
          onClick={fetchNetwork}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-os-border text-os-muted hover:text-os-text text-xs transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-os-muted mb-1">
            Open Ports
          </div>
          <div className="text-2xl font-semibold text-os-text font-mono">{ports.length}</div>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-os-muted mb-1">Interfaces</div>
          <div className="text-2xl font-semibold text-os-text font-mono">{interfaces.length}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/5 px-4 py-3 text-xs text-os-red font-mono">
          Error: {error}
        </div>
      )}

      {/* Listening Ports */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-os-muted" />
            <h2 className="text-sm font-medium text-os-text">Listening Ports</h2>
            <span className="text-xs px-2 py-0.5 rounded-full border border-os-border text-os-muted font-mono">
              {filteredPorts.length}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-os-border bg-os-surface">
            <Globe className="w-3.5 h-3.5 text-os-muted shrink-0" />
            <input
              type="text"
              placeholder="Filter ports..."
              value={portSearch}
              onChange={(e) => setPortSearch(e.target.value)}
              className="bg-transparent text-xs text-os-text placeholder-os-muted outline-none w-32"
            />
          </div>
        </div>

        <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-os-elevated">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  Proto
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  Port
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  Address
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredPorts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-os-muted text-xs">
                    Loading ports...
                  </td>
                </tr>
              ) : filteredPorts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-os-muted text-xs">
                    No ports found
                  </td>
                </tr>
              ) : (
                filteredPorts.map((p, i) => {
                  const known = WELL_KNOWN[p.port];
                  return (
                    <tr
                      key={i}
                      className="border-t border-os-border hover:bg-os-elevated/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-os-muted uppercase">
                        {p.proto}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className={known ? 'text-os-text font-semibold' : 'text-os-muted'}
                          >
                            {p.port}
                          </span>
                          {known && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${known.color}`}
                            >
                              {known.label}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-os-text">{p.local}</td>
                      <td className="px-3 py-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            p.state === 'LISTEN' || p.state === 'LISTENING'
                              ? 'text-os-green border-os-green/30 bg-os-green/10'
                              : p.state === 'ESTABLISHED'
                              ? 'text-os-cyan border-os-cyan/30 bg-os-cyan/10'
                              : 'text-os-muted border-os-border'
                          }`}
                        >
                          {p.state}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-os-border">
            <span className="text-[10px] text-os-muted">auto-refresh 30s</span>
          </div>
        </div>
      </div>

      {/* Network Interfaces */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-os-muted" />
          <h2 className="text-sm font-medium text-os-text">Network Interfaces</h2>
        </div>

        <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-os-elevated">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  Interface
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  RX
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  TX
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  RX Packets
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted">
                  TX Packets
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && interfaces.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-os-muted text-xs">
                    Loading interfaces...
                  </td>
                </tr>
              ) : interfaces.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-os-muted text-xs">
                    No interfaces found
                  </td>
                </tr>
              ) : (
                interfaces.map((iface, i) => (
                  <tr
                    key={i}
                    className="border-t border-os-border hover:bg-os-elevated/50 transition-colors"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-os-cyan font-medium">
                      {iface.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-os-green">
                      {fmtBytes(iface.rxBytes)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-os-yellow">
                      {fmtBytes(iface.txBytes)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-os-muted">
                      {iface.rxPackets.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-os-muted">
                      {iface.txPackets.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Monitoring placeholder */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-os-muted" />
          <h2 className="text-sm font-medium text-os-text">Advanced Monitoring (Grafana)</h2>
        </div>

        <div className="rounded-xl border border-dashed border-os-border bg-os-surface p-6 text-center">
          <div className="w-10 h-10 rounded-full border border-os-border bg-os-elevated flex items-center justify-center mx-auto mb-3">
            <Network className="w-5 h-5 text-os-muted" />
          </div>
          <div className="text-sm font-medium text-os-text mb-1">Kommt bald</div>
          <div className="text-xs text-os-muted max-w-sm mx-auto">
            Zeitreihen, Bandbreitengraph und Verbindungstracking kommen mit Grafana-Integration
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-os-border text-[10px] text-os-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-os-muted/40 inline-block" />
            Geplant
          </div>
        </div>
      </div>
    </div>
  );
}
