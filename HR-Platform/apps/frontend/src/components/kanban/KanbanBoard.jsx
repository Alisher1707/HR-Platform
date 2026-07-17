import React from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';

/**
 * KanbanBoard Component
 * Implements Drag and Drop context wrapper for managing column sorting
 */
export function KanbanBoard({ applications = [], onStatusChange, onCardClick }) {
  // Use PointerSensor to prevent collision with click handlers inside card
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts after moving 8px
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const cardId = active.id;
    const newStatus = over.id; // column ID
    
    const card = applications.find(app => app.id === cardId);
    
    if (card && card.status !== newStatus) {
      onStatusChange(cardId, newStatus);
    }
  };

  // Group applications by status
  const keldiApps = applications.filter(app => app.status === 'KELDI');
  const qoshildiApps = applications.filter(app => app.status === 'QOSHILDI');
  const sinovMuddatiApps = applications.filter(app => app.status === 'SINOV_MUDDATI');
  const shartnomaApps = applications.filter(app => app.status === 'SHARTNOMA');
  const radEtildiApps = applications.filter(app => app.status === 'RAD_ETILDI');

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-board animate-fade-in">
        <KanbanColumn
          status="KELDI"
          title="Yangi Arizalar"
          applications={keldiApps}
          onCardClick={onCardClick}
        />
        <KanbanColumn
          status="QOSHILDI"
          title="Suhbat / Qabul Qilingan"
          applications={qoshildiApps}
          onCardClick={onCardClick}
        />
        <KanbanColumn
          status="SINOV_MUDDATI"
          title="Sinov Muddati"
          applications={sinovMuddatiApps}
          onCardClick={onCardClick}
        />
        <KanbanColumn
          status="RAD_ETILDI"
          title="Rad Etildi"
          applications={radEtildiApps}
          onCardClick={onCardClick}
        />
        <KanbanColumn
          status="SHARTNOMA"
          title="Shartnoma Imzolandi"
          applications={shartnomaApps}
          onCardClick={onCardClick}
        />
      </div>
    </DndContext>
  );
}

export default KanbanBoard;
