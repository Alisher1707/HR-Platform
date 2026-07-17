import React from 'react';
import { useDraggable } from '@dnd-kit/core';

/**
 * ApplicationCard Component
 * Draggable card representing a candidate application on the Kanban board
 */
export function ApplicationCard({ application, onClick }) {
  const { id, firstName, lastName, position, phone, createdAt, interviewDate } = application;
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: {
      application
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 999 : undefined,
  } : undefined;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="kanban-card-name">
        {firstName} {lastName}
      </div>
      <div className="kanban-card-position">
        {position || 'Lavozim kiritilmagan'}
      </div>
      <div className="kanban-card-footer">
        <div className="kanban-card-phone">
          📞 {phone || 'Noma\'lum'}
        </div>
        <div className="kanban-card-date">
          📅 {formatDate(createdAt)}
        </div>
      </div>
      {interviewDate && (
        <div className="kanban-card-date" style={{ marginTop: '0.375rem' }}>
          🕐 Suhbat: {new Date(interviewDate).toLocaleString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
      <button
        className="kanban-card-detail-btn"
        onClick={(e) => {
          e.stopPropagation();
          onClick(application);
        }}
        style={{
          marginTop: '0.5rem',
          width: '100%',
          padding: '0.375rem 0.625rem',
          background: '#4338ca',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontSize: '0.6875rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(67, 56, 202, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#3730a3';
          e.target.style.boxShadow = '0 2px 4px rgba(67, 56, 202, 0.25)';
          e.target.style.transform = 'translateY(-0.5px)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#4338ca';
          e.target.style.boxShadow = '0 1px 2px rgba(67, 56, 202, 0.15)';
          e.target.style.transform = 'translateY(0)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>Batafsil</span>
      </button>
    </div>
  );
}

export default ApplicationCard;
