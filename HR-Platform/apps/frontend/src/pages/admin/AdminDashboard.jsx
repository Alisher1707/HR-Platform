import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCard from '../../components/ui/StatsCard';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import employeeService from '../../services/employeeService';
import inviteService from '../../services/inviteService';
import applicationService from '../../services/applicationService';

/**
 * AdminDashboard Page
 * Premium admin overview page showing metrics, recent additions and quick actions
 */
export function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalInvites: 0,
    totalApplications: 0,
  });
  const [recentEmployees, setRecentEmployees] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch employees
        const empResponse = await employeeService.getEmployees({ limit: 5 });
        const employeesList = empResponse.data || [];
        setRecentEmployees(employeesList);

        // Fetch total counts for stats
        const allEmpResponse = await employeeService.getEmployees({ limit: 1 });
        const invitesList = await inviteService.getInvites().catch(() => []);
        const applicationsList = await applicationService.getApplications().catch(() => []);

        setStats({
          totalEmployees: allEmpResponse.pagination?.total || employeesList.length,
          totalInvites: invitesList.length,
          totalApplications: applicationsList.length,
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen text="Dashboard yuklanmoqda..." />;
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Admin Boshqaruv Paneli</h2>
          <p className="page-subtitle">Tizimning umumiy ko'rsatkichlari va boshqaruv asboblari.</p>
        </div>
        <div className="page-header-right">
          <Button variant="primary" onClick={() => navigate('/admin/employees')} icon="👤">
            Xodimlarni boshqarish
          </Button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="stats-grid mb-6">
        <StatsCard
          label="Jami xodimlar"
          value={stats.totalEmployees}
          icon="👥"
          iconColor="indigo"
        />
        <StatsCard
          label="Nomzodlar arizalari"
          value={stats.totalApplications}
          icon="📋"
          iconColor="amber"
        />
        <StatsCard
          label="Faol taklifnomalar"
          value={stats.totalInvites}
          icon="🔗"
          iconColor="emerald"
        />
      </div>

      {/* Main Content Grid: Recent Employees & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }} className="responsive-grid">
        {/* Recent Employees List */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Oxirgi qo'shilgan xodimlar</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')}>
              Barchasi →
            </Button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>F.I.SH.</th>
                  <th>Lavozimi</th>
                  <th>Telefon</th>
                  <th>Tajriba</th>
                </tr>
              </thead>
              <tbody>
                {recentEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div className="font-semibold">{emp.first_name} {emp.last_name}</div>
                    </td>
                    <td>{emp.position || 'Kiritilmagan'}</td>
                    <td>{emp.phone || 'Kiritilmagan'}</td>
                    <td>{emp.experience ? `${emp.experience} yil` : 'Yo\'q'}</td>
                  </tr>
                ))}
                {recentEmployees.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                      Hech qanday xodim topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Actions Panel */}
        <Card variant="glass" className="flex flex-col gap-4">
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Tezkor Amallar</h3>
          
          <Button 
            variant="outline" 
            fullWidth 
            onClick={() => navigate('/admin/employees?action=add')}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <span style={{ marginRight: '0.75rem', fontSize: '1.25rem' }}>➕</span>
            Yangi xodim qo'shish
          </Button>

          <Button 
            variant="outline" 
            fullWidth 
            onClick={() => navigate('/admin/invites')}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <span style={{ marginRight: '0.75rem', fontSize: '1.25rem' }}>🔗</span>
            Taklifnoma yaratish
          </Button>

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Tizim boshqaruvchisi sifatida siz yangi xodimlarni qo'shishingiz, tizimga kirish uchun taklifnoma havolalarini yaratishingiz va nomzodlar ro'yxatini ko'rishingiz mumkin.
            </p>
          </div>
        </Card>
      </div>

      {/* Inject custom responsive layout styles for CSS Grid */}
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

export default AdminDashboard;
