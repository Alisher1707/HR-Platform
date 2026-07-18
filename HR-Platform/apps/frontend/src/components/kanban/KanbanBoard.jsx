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

  // Suhbati BUGUN bo'lganlar (soatidan qat'i nazar) va kelgusi suhbatlilar
  // ustun tepasiga chiqadi — eng yaqin vaqt birinchi. Qolganlari mavjud
  // tartibida qoladi (sort barqaror).
  const prioritizeUpcomingInterviews = (apps) => {
    const now = new Date();

    const isPriority = (time) => {
      if (isNaN(time)) return false;
      const d = new Date(time);
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      return isToday || time >= now.getTime();
    };

    return [...apps].sort((a, b) => {
      const aTime = a.interviewDate ? new Date(a.interviewDate).getTime() : NaN;
      const bTime = b.interviewDate ? new Date(b.interviewDate).getTime() : NaN;
      const aPriority = isPriority(aTime);
      const bPriority = isPriority(bTime);
      if (aPriority && bPriority) return aTime - bTime;
      if (aPriority) return -1;
      if (bPriority) return 1;
      return 0;
    });
  };

  // Sinov muddati tugash kuni kelgan yoki o'tib ketgan (qizil) kartalar
  // ustunning eng tepasiga chiqadi — eng ko'p kechikkani birinchi.
  // Qolganlari mavjud tartibida qoladi (sort barqaror).
  const prioritizeSinovEnding = (apps) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const endDayTime = (app) => {
      if (!app.sinovEndDate) return NaN;
      const d = new Date(app.sinovEndDate);
      if (isNaN(d)) return NaN;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    return [...apps].sort((a, b) => {
      const aEnd = endDayTime(a);
      const bEnd = endDayTime(b);
      const aPriority = !isNaN(aEnd) && aEnd <= todayStart;
      const bPriority = !isNaN(bEnd) && bEnd <= todayStart;
      if (aPriority && bPriority) return aEnd - bEnd;
      if (aPriority) return -1;
      if (bPriority) return 1;
      return 0;
    });
  };

  // Shartnoma tugashiga 2 oy yoki undan kam qolgan (qizil) kartalar
  // ustunning eng tepasiga chiqadi — eng yaqin tugaydigani birinchi.
  const prioritizeContractEnding = (apps) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threshold = new Date(todayStart);
    threshold.setMonth(threshold.getMonth() + 2);
    const thresholdTime = threshold.getTime();

    const endDayTime = (app) => {
      if (!app.contractEndDate) return NaN;
      const d = new Date(app.contractEndDate);
      if (isNaN(d)) return NaN;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    return [...apps].sort((a, b) => {
      const aEnd = endDayTime(a);
      const bEnd = endDayTime(b);
      const aPriority = !isNaN(aEnd) && aEnd <= thresholdTime;
      const bPriority = !isNaN(bEnd) && bEnd <= thresholdTime;
      if (aPriority && bPriority) return aEnd - bEnd;
      if (aPriority) return -1;
      if (bPriority) return 1;
      return 0;
    });
  };

  // Group applications by status
  const keldiApps = prioritizeUpcomingInterviews(applications.filter(app => app.status === 'KELDI'));
  const qoshildiApps = prioritizeUpcomingInterviews(applications.filter(app => app.status === 'QOSHILDI'));
  const sinovMuddatiApps = prioritizeSinovEnding(prioritizeUpcomingInterviews(applications.filter(app => app.status === 'SINOV_MUDDATI')));
  const shartnomaApps = prioritizeContractEnding(prioritizeUpcomingInterviews(applications.filter(app => app.status === 'SHARTNOMA')));
  const radEtildiApps = prioritizeUpcomingInterviews(applications.filter(app => app.status === 'RAD_ETILDI'));

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
