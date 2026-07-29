import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

/**
 * AppLayout Component
 * Main app layout wrapper with responsive sidebar drawer and layout styling
 */
export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const HEADER_NAV_PATHS = ['/admin/attendance', '/admin/organization', '/admin/monitoring', '/admin/ish-jadvallari'];
  const showHeader = HEADER_NAV_PATHS.includes(location.pathname);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={closeSidebar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-overlay)',
            zIndex: 90,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Main Content Area */}
      <div className={`app-content ${showHeader ? '' : 'app-content--no-header'}`}>
        {showHeader && <Header onMenuClick={toggleSidebar} />}
        <main className="app-content-inner animate-fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
