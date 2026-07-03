import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  const isHR = user?.role === 'HR';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">HR</div>
        <span className="sidebar-logo-text">Platform</span>
      </div>

      <nav className="sidebar-nav">
        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="sidebar-section-title">Admin Panel</div>
            
            <NavLink 
              to="/admin/dashboard" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">📊</span>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/admin/employees"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">👥</span>
              <span>Xodimlar</span>
            </NavLink>

            <NavLink
              to="/admin/kanban"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">📋</span>
              <span>Kanban Doska</span>
            </NavLink>

            {isSuperAdmin && (
              <NavLink
                to="/admin/invites"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon">🔗</span>
                <span>Taklifnomalar</span>
              </NavLink>
            )}

            <NavLink
              to="/admin/ejm"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">📄</span>
              <span>EJM</span>
            </NavLink>
          </>
        )}

        {/* HR Section */}
        {isHR && (
          <>
            <div className="sidebar-section-title">HR Panel</div>
            
            <NavLink 
              to="/hr/dashboard" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">📈</span>
              <span>Dashboard</span>
            </NavLink>

            <NavLink 
              to="/hr/kanban" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">📋</span>
              <span>Kanban Doska</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {getUserInitials()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {user.firstName} {user.lastName}
              </div>
              <div className="sidebar-user-role">
                {getRoleLabel(user.role)}
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="btn btn-ghost btn-icon"
              title="Chiqish"
              style={{ padding: '0.25rem', minWidth: 'auto', minHeight: 'auto', color: 'var(--error)' }}
            >
              🚪
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
