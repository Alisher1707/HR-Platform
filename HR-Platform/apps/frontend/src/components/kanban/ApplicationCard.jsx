import React from 'react';
import { useDraggable } from '@dnd-kit/core';

/**
 * ApplicationCard Component
 * Draggable card representing a candidate application on the Kanban board
 */
export function ApplicationCard({ application, onClick }) {
  const { id, firstName, lastName, position, phone, createdAt, interviewDate, interviewStatus, status, sinovStartDate, sinovEndDate, contractStartDate, contractEndDate } = application;
  
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

  // Suhbat bugunga belgilanganmi (mahalliy sana bo'yicha)
  const isInterviewToday = (() => {
    if (!interviewDate) return false;
    const d = new Date(interviewDate);
    if (isNaN(d)) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  })();

  // Sinov muddati tugash kuni keldimi yoki o'tib ketdimi (mahalliy sana bo'yicha).
  // Tugash kuni kelganda karta rangi o'zgaradi.
  const sinovEndState = (() => {
    if (status !== 'SINOV_MUDDATI' || !sinovEndDate) return null;
    const end = new Date(sinovEndDate);
    if (isNaN(end)) return null;
    const now = new Date();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (today.getTime() === endDay.getTime()) return 'today';
    if (today > endDay) return 'overdue';
    return null;
  })();

  // Shartnoma tugashiga 2 oy yoki undan kam qolganmi (yoki muddati o'tganmi).
  // Shu holatda SHARTNOMA ustunidagi karta qizil bo'ladi.
  const contractEndState = (() => {
    if (status !== 'SHARTNOMA' || !contractEndDate) return null;
    const end = new Date(contractEndDate);
    if (isNaN(end)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (endDay < today) return 'expired';
    const threshold = new Date(today);
    threshold.setMonth(threshold.getMonth() + 2);
    if (endDay <= threshold) return 'expiring';
    return null;
  })();

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
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${(sinovEndState || contractEndState) ? 'sinov-ends' : (isInterviewToday ? 'interview-today' : '')}`}
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
      {status === 'SINOV_MUDDATI' && (sinovStartDate || sinovEndDate) && (
        <div className="kanban-card-date" style={{ marginTop: '0.375rem' }}>
          ⏳ Sinov: {formatDate(sinovStartDate) || '—'} — {formatDate(sinovEndDate) || '—'}
        </div>
      )}
      {sinovEndState && (
        <div className="sinov-ends-badge">
          {sinovEndState === 'today'
            ? '⏰ Bugun sinov muddati tugaydi'
            : '⏰ Sinov muddati tugagan'}
        </div>
      )}
      {status === 'SHARTNOMA' && (contractStartDate || contractEndDate) && (
        <div className="kanban-card-date" style={{ marginTop: '0.375rem' }}>
          📄 Shartnoma: {formatDate(contractStartDate) || '—'} — {formatDate(contractEndDate) || '—'}
        </div>
      )}
      {contractEndState && (
        <div className="sinov-ends-badge">
          {contractEndState === 'expired'
            ? '⚠️ Shartnoma muddati tugagan'
            : '⚠️ Shartnomaga 2 oydan kam qoldi'}
        </div>
      )}
      {interviewDate && (
        isInterviewToday ? (
          <div className="interview-today-badge">
            🔔 Bugun suhbat — {new Date(interviewDate).toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        ) : (
          <div className="kanban-card-date" style={{ marginTop: '0.375rem' }}>
            🕐 Suhbat: {new Date(interviewDate).toLocaleString('uz-UZ', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )
      )}
      {interviewStatus && (
        <div className={interviewStatus === 'KELDI' ? 'interview-today-badge' : 'sinov-ends-badge'}>
          {interviewStatus === 'KELDI' ? '✅ Suhbatga keldi' : '❌ Suhbatga kelmadi'}
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
