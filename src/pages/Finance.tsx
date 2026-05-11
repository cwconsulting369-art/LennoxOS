import { DollarSign, TrendingUp, CreditCard, Clock, BarChart2 } from 'lucide-react';

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-os-border/50">
        <Clock size={20} className="text-os-muted" />
      </div>
      <p className="text-sm font-medium text-os-text">{title}</p>
      <p className="mt-1 text-xs text-os-muted">{description}</p>
      <span className="mt-3 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
        Kommt bald
      </span>
    </div>
  );
}

function PlaceholderKpi({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4 opacity-50">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-os-border/60">
          <Icon size={14} className="text-os-muted" />
        </div>
        <span className="text-xs font-medium text-os-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-os-muted">--</p>
      <p className="mt-0.5 text-xs text-os-muted">{sub}</p>
      <span className="mt-3 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
        Kommt bald
      </span>
    </div>
  );
}

export default function Finance() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
          <DollarSign size={18} className="text-os-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-os-text">Finance</h1>
          <p className="text-xs text-os-muted">Revenue, Rechnungen & Kosten</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-os-border bg-os-surface/50 px-4 py-3">
        <p className="text-xs text-os-muted">
          Finanzdaten werden aus Stripe und Bankdaten aggregiert —{' '}
          <span className="text-os-yellow font-medium">Integration pending</span>
        </p>
      </div>

      {/* Placeholder KPIs */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Kennzahlen</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PlaceholderKpi
            icon={TrendingUp}
            label="MRR"
            sub="Monthly Recurring Revenue"
          />
          <PlaceholderKpi
            icon={BarChart2}
            label="ARR"
            sub="Annual Recurring Revenue"
          />
          <PlaceholderKpi
            icon={DollarSign}
            label="Net Profit"
            sub="Aktueller Monat"
          />
        </div>
      </div>

      {/* Coming Soon sections */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Revenue Chart</p>
        <ComingSoon
          title="Revenue über Zeit"
          description="MRR/ARR Verlauf als Zeitreihen-Chart — Stripe-Webhook-Integration ausstehend"
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Rechnungen</p>
        <ComingSoon
          title="Invoice Overview"
          description="Offene, bezahlte und überfällige Rechnungen aus Stripe + manuellen Quellen"
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Kosten</p>
        <ComingSoon
          title="Cost Breakdown"
          description="VPS, APIs, Tools & Agents — monatliche Kostentransparenz"
        />
      </div>

      {/* Stripe link */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard size={14} className="text-os-muted" />
          <span className="text-sm font-semibold text-os-text">Direktzugriff</span>
        </div>
        <p className="text-xs text-os-muted mb-3">
          Bis zur Integration direkter Zugriff über externe Dashboards.
        </p>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-os-accent cursor-pointer hover:underline">
            → Stripe Dashboard öffnen
          </span>
          <span className="text-sm font-medium text-os-accent cursor-pointer hover:underline">
            → Stripe Revenue-Bericht
          </span>
        </div>
      </div>
    </div>
  );
}
