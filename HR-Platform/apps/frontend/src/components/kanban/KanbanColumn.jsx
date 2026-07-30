import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import ApplicationCard from './ApplicationCard';
import { useAuthStore } from '../../store/authStore';

/**
 * KanbanColumn Component
 * Droppable column container representing an application status phase (e.g. KELDI, QOSHILDI, SHARTNOMA)
 */
export function KanbanColumn({ status, title, applications = [], onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });
  const { user } = useAuthStore();
  // Unified brand styling — same modern design for Admin and HR alike.
  const isHR = true;

  const getDotClass = (stat) => {
    return stat.toLowerCase();
  };

  return (
    <div className={`kanban-column ${isHR ? 'hr-dash-kanban-column' : ''}`}>
      <div className="kanban-column-header">
        <div className="kanban-column-header-left">
          <span className={`kanban-column-dot ${getDotClass(status)}`} />
          <span className="kanban-column-title">{title}</span>
        </div>
        <span className="kanban-column-count">{applications.length}</span>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`kanban-column-body ${isOver ? 'drag-over' : ''}`}
      >
        {applications.map((app) => (
          <ApplicationCard 
            key={app.id} 
            application={app} 
            onClick={onCardClick} 
          />
        ))}
        {applications.length === 0 && !isOver && (
          <div style={{ padding: '2rem 1rem', textCenter: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
            Nomzodlar yo'q
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanColumn;
