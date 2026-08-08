import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Link2,
  FileText,
  CalendarCheck2,
  TrendingUp,
  LogOut,
  Briefcase,
  Rocket,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

/**
 * Sidebar Component
 * Premium sidebar with role-based navigation and collapse functionality
 */
export function Sidebar({ isOpen, toggleSidebar }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const first = user.firstName ? user.firstName[0] : '';
    const last = user.lastName ? user.lastName[0] : '';
    return (first + last).toUpperCase() || user.email[0].toUpperCase();
  };

  const getRoleLabel = (role) => {
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    if (role === 'ADMIN') return 'Admin';
    if (role === 'HR') return 'HR Manager';
    return role;
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  // Unified brand styling — same modern design for Admin and HR alike.
  const isHR = true;
  const isHRRole = user?.role === 'HR';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className={`sidebar-logo-icon ${isHR ? 'sidebar-brand-icon' : ''}`}><Briefcase size={18} strokeWidth={2.25} /></div>
        <span className={`sidebar-logo-text ${isHR ? 'sidebar-brand-text' : ''}`}>Platform</span>
      </div>

      <nav className="sidebar-nav">
        {/* Admin Section */}
        {isAdmin && (
          <div className="sidebar-hr-section">
            <div className="sidebar-section-title">Admin Panel</div>
            
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><LayoutDashboard size={18} strokeWidth={2} /></span>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/admin/employees"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><Users size={18} strokeWidth={2} /></span>
              <span>Xodimlar</span>
            </NavLink>

            <NavLink
              to="/admin/kanban"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><KanbanSquare size={18} strokeWidth={2} /></span>
              <span>Lead</span>
            </NavLink>

            {isSuperAdmin && (
              <NavLink
                to="/admin/invites"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon"><Link2 size={18} strokeWidth={2} /></span>
                <span>Taklifnomalar</span>
              </NavLink>
            )}

            <NavLink
              to="/admin/ejm"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><FileText size={18} strokeWidth={2} /></span>
              <span>EJM</span>
            </NavLink>

            <NavLink
              to="/admin/attendance"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><CalendarCheck2 size={18} strokeWidth={2} /></span>
              <span>Davomat</span>
            </NavLink>

            <NavLink
              to="/admin/onboarding"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><Rocket size={18} strokeWidth={2} /></span>
              <span>Onboarding</span>
            </NavLink>
          </div>
        )}

        {/* HR Section */}
        {isHRRole && (
          <div className="sidebar-hr-section">
            <div className="sidebar-section-title">HR Panel</div>
            
            <NavLink
              to="/hr/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><TrendingUp size={18} strokeWidth={2} /></span>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/hr/employees"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><Users size={18} strokeWidth={2} /></span>
              <span>Xodimlar</span>
            </NavLink>

            <NavLink
              to="/hr/kanban"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><KanbanSquare size={18} strokeWidth={2} /></span>
              <span>Lead</span>
            </NavLink>

            <NavLink
              to="/hr/invites"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><Link2 size={18} strokeWidth={2} /></span>
              <span>Taklifnomalar</span>
            </NavLink>

            <NavLink
              to="/hr/ejm"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><FileText size={18} strokeWidth={2} /></span>
              <span>EJM</span>
            </NavLink>

            <NavLink
              to="/hr/attendance"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon"><CalendarCheck2 size={18} strokeWidth={2} /></span>
              <span>Davomat</span>
            </NavLink>

            <NavLink
              to="/hr/onboarding"
              className={({ isActive }) => `sidebar-link sidebar-link-onboarding ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon sidebar-link-icon-onboarding"><Rocket size={18} strokeWidth={2} /></span>
              <span>Onboarding</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className={`sidebar-avatar ${isHR ? 'sidebar-brand-icon' : ''}`}>
              {getUserInitials()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {user.firstName} {user.lastName}
              </div>
              <div className={`sidebar-user-role ${isHR ? 'sidebar-brand-role' : ''}`}>
                {getRoleLabel(user.role)}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-icon"
              title="Chiqish"
              style={{ padding: '0.25rem', minWidth: 'auto', minHeight: 'auto', color: 'var(--error)' }}
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
