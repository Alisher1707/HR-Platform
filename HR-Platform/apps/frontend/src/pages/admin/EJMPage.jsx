import React from 'react';

/**
 * EJM Page Component
 * Displays the Employee Journey Map (48 bosqich) in an iframe
 */
export function EJMPage() {
  return (
    <div style={{
      width: '100%',
      height: 'calc(100vh - 80px)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      margin: '0'
    }}>
      <div style={{
        padding: '1rem 1.5rem',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>📄</span>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          margin: '0',
          color: 'var(--text-primary)'
        }}>
          EJM - Xodim Hayot Sikli (48 Bosqich)
        </h1>
      </div>

      <iframe
        src="/ejm.html"
        title="Employee Journey Map"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          background: 'white'
        }}
      />
    </div>
  );
}

export default EJMPage;
