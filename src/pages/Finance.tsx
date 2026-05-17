import { Wallet, TrendingUp, Server, HardDrive, Brain, DollarSign, Target, ExternalLink } from 'lucide-react';

const COSTS = [
  { name: 'VPS Hetzner CX22', cost: '€ 4,76', icon: Server, color: 'text-os-accent' },
  { name: 'Storage Box BX11', cost: '€ 4,76', icon: HardDrive, color: 'text-os-yellow' },
  { name: 'OpenRouter API', cost: '~€ 4,50', icon: Brain, color: 'text-os-purple' },
  { name: 'Domain / Misc', cost: '€ 2,00', icon: DollarSign, color: 'text-os-secondary' },
];

const PIPELINE: { company: string; value: number; status: 'prospect' | 'qualified' | 'proposal' | 'won' }[] = [
  { company: 'Hoffmann Eitle', value: 123500, status: 'proposal' },
  { company: 'Patrick Thailand RE', value: 4500, status: 'qualified' },
];

const STATUS_LABEL: Record<string, string> = {
  prospect: 'Prospect',
  qualified: 'Qualified',
  proposal: 'Proposal',
  won: 'Won',
};

const STATUS_CLASS: Record<string, string> = {
  prospect: 'bg-os-yellow/10 text-os-yellow',
  qualified: 'bg-os-cyan/10 text-os-cyan',
  proposal: 'bg-os-accent/10 text-os-accent',
  won: 'bg-os-green/10 text-os-green',
};

function formatEUR(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function Finance() {
  const totalCosts = 4.76 + 4.76 + 4.50 + 2.00;
  const pipelineTotal = PIPELINE.reduce((s, d) => s + d.value, 0);
  const currentMRR = 0;
  const targetMRR = 10000;
  const mrrPct = currentMRR > 0 ? Math.min(100, Math.round((currentMRR / targetMRR) * 100)) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
          <Wallet size={18} className="text-os-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-os-text">Finance</h1>
          <p className="text-xs text-os-muted">Kosten · Pipeline · Revenue</p>
        </div>
      </div>

      {/* Top 3 cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* MRR */}
        <div className="rounded-lg border border-os-border bg-os-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-os-muted mb-2">
            <Target size={12} /> MRR
          </div>
          <p className="text-3xl font-bold text-os-text">{formatEUR(currentMRR)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-os-secondary mb-1">
              <span>Ziel: {formatEUR(targetMRR)}</span>
              <span>{mrrPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-os-elevated">
              <div
                className="h-full rounded-full bg-os-accent transition-all"
                style={{ width: `${mrrPct}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-os-muted">
            {currentMRR === 0 ? 'Stripe-Integration ausstehend' : 'Live via Stripe'}
          </p>
        </div>

        {/* Fixkosten */}
        <div className="rounded-lg border border-os-border bg-os-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-os-muted mb-2">
            <Server size={12} /> Fixkosten / Monat
          </div>
          <p className="text-3xl font-bold text-os-text">~€ {totalCosts.toFixed(2)}</p>
          <div className="mt-3 space-y-1.5">
            {COSTS.map(c => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-os-secondary">
                  <c.icon size={10} className={c.color} />
                  {c.name}
                </span>
                <span className="font-medium text-os-text">{c.cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline */}
        <div className="rounded-lg border border-os-border bg-os-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-os-muted mb-2">
            <TrendingUp size={12} /> Pipeline Wert
          </div>
          <p className="text-3xl font-bold text-os-cyan">{formatEUR(pipelineTotal)}</p>
          <div className="mt-3 space-y-1.5">
            {PIPELINE.map(d => (
              <div key={d.company} className="flex items-center justify-between text-xs">
                <span className="text-os-secondary">{d.company}</span>
                <span className="font-medium text-os-text">{formatEUR(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Table */}
      <div className="rounded-lg border border-os-border bg-os-card overflow-hidden">
        <div className="border-b border-os-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-os-text">AEVUM Pipeline</h2>
          <span className="text-xs text-os-muted">{PIPELINE.length} Deals · {formatEUR(pipelineTotal)} total</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-os-border text-[10px] uppercase tracking-wider text-os-muted">
              <th className="px-5 py-3">Firma</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Jahreswert</th>
            </tr>
          </thead>
          <tbody>
            {PIPELINE.map(d => (
              <tr key={d.company} className="border-b border-os-elevated/60 hover:bg-os-elevated/50 transition-colors">
                <td className="px-5 py-3 font-medium text-os-text">{d.company}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[d.status]}`}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-medium text-os-text">{formatEUR(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Links */}
      <div className="rounded-lg border border-os-border bg-os-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink size={13} className="text-os-muted" />
          <span className="text-sm font-semibold text-os-text">Direktzugriff</span>
        </div>
        <div className="flex gap-4">
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-os-accent hover:underline"
          >
            → Stripe Dashboard
          </a>
          <a
            href="https://console.hetzner.cloud"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-os-accent hover:underline"
          >
            → Hetzner Cloud
          </a>
          <a
            href="https://openrouter.ai/settings/billing"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-os-accent hover:underline"
          >
            → OpenRouter Billing
          </a>
        </div>
      </div>
    </div>
  );
}
