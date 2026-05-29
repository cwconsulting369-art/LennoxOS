import { Building2, LineChart, FlaskConical, GitBranch } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import DomainTile, { Stat } from './DomainTile';

interface UhBoard {
  counts: { customers: number; organizations: number; documents: number; pendingErasure: number; auditLogs: number };
}
interface GtsStats {
  signals?: { total: number; lastSignal?: string };
}
interface KetoBoard {
  sources?: { klaviyo?: { connected?: boolean; account_email?: string } };
}
interface Pipeline {
  leads: unknown[];
  prospects: unknown[];
  customers: unknown[];
}

type Nav = (s: string) => void;

/**
 * Operations Deck — second zone. Customer/business boards on real data.
 * Fills the 4K lower zone with relevant ops state, not filler.
 */
export default function OperationsDeck({ onNavigate }: { onNavigate: Nav }) {
  const uh = useApi<UhBoard>('/api/uh/board', 60_000);
  const gts = useApi<GtsStats>('/api/gts/stats', 60_000);
  const keto = useApi<KetoBoard>('/api/ketolabs/board', 120_000);
  const pipe = useApi<Pipeline>('/api/pipeline', 60_000);

  const klaviyo = keto.data?.sources?.klaviyo;

  return (
    <div className="cc-ops">
      <div className="cc-zone-title"><span className="cc-zone-title__bar" />Operations Deck</div>
      <div className="cc-ops-grid">
        {/* UtilityHub */}
        <DomainTile label="UtilityHub" icon={Building2} color="info" badge={<span className="cc-badge-dim">live</span>} onOpen={() => onNavigate('aevum')} error={uh.error && !uh.loaded}>
          <div className="cc-row-3">
            <Stat label="Hausverwaltungen">{uh.data?.counts.organizations ?? '—'}</Stat>
            <Stat label="Lieferstellen">{uh.data?.counts.customers ?? '—'}</Stat>
            <Stat label="Dokumente">{uh.data?.counts.documents ?? '—'}</Stat>
          </div>
          <div className="cc-mini-legend">
            <span>Audit-Logs {uh.data?.counts.auditLogs ?? 0}</span>
            <span>Löschanträge {uh.data?.counts.pendingErasure ?? 0}</span>
          </div>
        </DomainTile>

        {/* GTS */}
        <DomainTile label="GoldTraderSociety" icon={LineChart} color="amber" onOpen={() => onNavigate('aevum')} error={gts.error && !gts.loaded}>
          <div className="cc-row-2">
            <Stat label="Signale gesamt">{gts.data?.signals?.total ?? '—'}</Stat>
            <Stat label="Letztes Signal">{gts.data?.signals?.lastSignal ? new Date(gts.data.signals.lastSignal).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) : '—'}</Stat>
          </div>
        </DomainTile>

        {/* Ketolabs */}
        <DomainTile label="Ketolabs" icon={FlaskConical} color="emerald" onOpen={() => onNavigate('aevum')} error={keto.error && !keto.loaded}>
          <div className="cc-row-2">
            <Stat label="Klaviyo" accent={klaviyo?.connected ? 'var(--status-success)' : 'var(--text-muted)'}>
              {klaviyo?.connected ? 'verbunden' : 'offen'}
            </Stat>
            <Stat label="Account"><span style={{ fontSize: 12 }}>{klaviyo?.account_email ?? '—'}</span></Stat>
          </div>
        </DomainTile>

        {/* Pipeline */}
        <DomainTile label="Sales Pipeline" icon={GitBranch} color="violet" onOpen={() => onNavigate('aevum')} error={pipe.error && !pipe.loaded}>
          <div className="cc-row-3">
            <Stat label="Leads">{pipe.data?.leads.length ?? 0}</Stat>
            <Stat label="Prospects">{pipe.data?.prospects.length ?? 0}</Stat>
            <Stat label="Kunden">{pipe.data?.customers.length ?? 0}</Stat>
          </div>
        </DomainTile>
      </div>
    </div>
  );
}
