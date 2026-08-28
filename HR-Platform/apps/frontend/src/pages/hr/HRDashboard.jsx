import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, MessagesSquare, Handshake, KanbanSquare } from 'lucide-react';
import StatsCard from '../../components/ui/StatsCard';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import applicationService from '../../services/applicationService';
import { formatPhone } from '../../utils/formatPhone';

/**
 * HRDashboard Component
 * Overview dashboard for HR users containing metrics, navigation to Kanban, and listing recent entries
 */
export function HRDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  
  const [stats, setStats] = useState({
    keldi: 0,
    qoshildi: 0,
    shartnoma: 0,
  });

  useEffect(() => {
    const fetchHRDashboardData = async () => {
      setLoading(true);
      try {
        const apps = await applicationService.getApplications();
        setApplications(apps || []);

        // Count applications per status
        const counts = { keldi: 0, qoshildi: 0, shartnoma: 0 };
        apps.forEach((app) => {
          if (app.status === 'KELDI') counts.keldi++;
          else if (app.status === 'QOSHILDI') counts.qoshildi++;
          else if (app.status === 'SHARTNOMA') counts.shartnoma++;
        });
        setStats(counts);
      } catch (err) {
        console.error('Error loading HR Dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHRDashboardData();
  }, []);

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="HR Dashboard yuklanmoqda..." />;
  }

  // Get recent 5 candidates
  const recentApps = applications
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Nomzodlar Boshqaruvi (HR)</h2>
          <p className="page-subtitle font-medium">Ishga qabul qilish monitoringi, nomzodlar va suhbatlar bosqichlari.</p>
        </div>
        <div className="page-header-right">
          <Button
            variant="primary"
            className="hr-dash-cta"
            onClick={() => navigate('/hr/kanban')}
            icon={<KanbanSquare size={16} strokeWidth={2.25} />}
          >
            Lead taxtasiga o'tish
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-grid mb-6">
        <StatsCard
          className="hr-dash-stat"
          label="Yangi kelgan arizalar"
          value={stats.keldi}
          icon={<Inbox size={20} strokeWidth={2} />}
          iconColor="brand-gold"
        />
        <StatsCard
          className="hr-dash-stat"
          label="Suhbat bosqichidagilar"
          value={stats.qoshildi}
          icon={<MessagesSquare size={20} strokeWidth={2} />}
          iconColor="brand-orange"
        />
        <StatsCard
          className="hr-dash-stat"
          label="Muvaffaqiyatli yakunlanganlar"
          value={stats.shartnoma}
          icon={<Handshake size={20} strokeWidth={2} />}
          iconColor="brand-red"
        />
      </div>

      {/* Grid: Recent Applications & Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }} className="responsive-grid">
        {/* Recent Applications Table */}
        <Card className="hr-dash-card">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Oxirgi kelgan arizalar</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/kanban')}>
              Lead'da ko'rish →
            </Button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nomzod</th>
                  <th>Lavozim</th>
                  <th>Kelgan sana</th>
                  <th>Bosqich</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map((app) => {
                  let badgeColor = 'gold';
                  let statusText = 'Keldi';
                  if (app.status === 'QOSHILDI') {
                    badgeColor = 'blue';
                    statusText = 'Suhbatda';
                  } else if (app.status === 'SINOV_MUDDATI') {
                    badgeColor = 'violet';
                    statusText = 'Sinov muddati';
                  } else if (app.status === 'SHARTNOMA') {
                    badgeColor = 'green';
                    statusText = 'Shartnoma';
                  } else if (app.status === 'RAD_ETILDI') {
                    badgeColor = 'red';
                    statusText = 'Rad etilgan';
                  }

                  return (
                    <tr key={app.id}>
                      <td>
                        <div className="font-semibold">{app.firstName} {app.lastName}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatPhone(app.phone) || 'Kiritilmagan'}</div>
                      </td>
                      <td>{app.position || 'Kiritilmagan'}</td>
                      <td>{formatDate(app.createdAt)}</td>
                      <td>
                        <span className={`badge hr-dash-badge hr-dash-badge-${badgeColor}`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {recentApps.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                      Nomzodlar arizalari topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* HR helper tips */}
        <Card variant="glass" className="hr-dash-card flex flex-col gap-4">
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>HR Eslatmalar</h3>
          
          <div className="hr-dash-tip-gold" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
            <div className="font-semibold text-sm mb-1">Nomzodlarni saralash</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Yangi kelgan nomzodlar bilan bog'lanib, ularning rezyumelari va suhbat vaqtini belgilang. Lead taxtasida kartalarni surish orqali nomzod holatini tez o'zgartiring.
            </p>
          </div>

          <div className="hr-dash-tip-red" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
            <div className="font-semibold text-sm mb-1">Shartnoma tuzish</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Suhbatdan muvaffaqiyatli o'tgan nomzodlarni "Shartnoma" bosqichiga o'tkazing va kerakli hujjatlarni rasmiylashtiring.
            </p>
          </div>
        </Card>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .responsive-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default HRDashboard;
