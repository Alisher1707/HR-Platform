import React from 'react';
import StatsCard from '../../components/ui/StatsCard';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

/**
 * MonitoringPage
 * System/employee activity monitoring placeholder — no metrics backend yet,
 * so figures are shown as "—" rather than misleading zeros.
 */
export function MonitoringPage() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Monitoring</h2>
          <p className="page-subtitle">Xodimlar faoliyati va tizim monitoringi.</p>
        </div>
      </div>

      <div className="stats-grid mb-6">
        <StatsCard label="Faol foydalanuvchilar" value="—" icon="🟢" iconColor="emerald" />
        <StatsCard label="Bugungi kirishlar" value="—" icon="🔑" iconColor="blue" />
        <StatsCard label="Ogohlantirishlar" value="—" icon="⚠️" iconColor="rose" />
        <StatsCard label="Server holati" value="—" icon="📡" iconColor="indigo" />
      </div>

      <Card>
        <EmptyState
          icon="📡"
          title="Monitoring ma'lumotlari hali ulanmagan"
          text="Bu bo'lim uchun jonli monitoring backend'i hali qo'shilmagan. Tayyor bo'lgach, bu yerda tizim va xodimlar faoliyati real vaqtda ko'rinadi."
        />
      </Card>
    </div>
  );
}

export default MonitoringPage;
