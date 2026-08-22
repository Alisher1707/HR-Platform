import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { Building2 } from 'lucide-react';

const SEGMENTS = [
  { key: 'onTime', label: 'Vaqtida keldi', color: 'var(--success)', gradientId: 'dept-grad-success' },
  { key: 'late', label: 'Kech keldi', color: 'var(--warning)', gradientId: 'dept-grad-warning' },
  { key: 'absent', label: 'Kelmagan', color: 'var(--error)', gradientId: 'dept-grad-error' },
  { key: 'pending', label: 'Kutilmoqda', color: 'var(--text-secondary)', gradientId: null },
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="dept-attendance-tooltip">
      <div className="dept-attendance-tooltip-row">
        <span className="dept-attendance-tooltip-dot" style={{ background: item.payload.color }} />
        <span>{item.name}</span>
        <strong>{item.value}</strong>
      </div>
    </div>
  );
}

function DepartmentDonutCard({ row }) {
  const segments = SEGMENTS.map((seg) => ({ ...seg, name: seg.label, value: row[seg.key] })).filter((s) => s.value > 0);
  const onTimePct = row.total > 0 ? Math.round((row.onTime / row.total) * 100) : 0;

  return (
    <div className="dept-card">
      <div className="dept-card-header">
        <span className="dept-card-icon">
          <Building2 size={16} strokeWidth={2.25} />
        </span>
        <div className="dept-card-header-text">
          <span className="dept-card-name">{row.department}</span>
          <span className="dept-card-total">{row.total} xodim</span>
        </div>
      </div>

      <div className="dept-card-body">
        <div className="dept-card-donut">
          <ResponsiveContainer width={104} height={104}>
            <PieChart>
              <defs>
                <linearGradient id="dept-grad-success" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success-grad-from)" />
                  <stop offset="100%" stopColor="var(--success-grad-to)" />
                </linearGradient>
                <linearGradient id="dept-grad-warning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--warning-grad-from)" />
                  <stop offset="100%" stopColor="var(--warning-grad-to)" />
                </linearGradient>
                <linearGradient id="dept-grad-error" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--error-grad-from)" />
                  <stop offset="100%" stopColor="var(--error-grad-to)" />
                </linearGradient>
              </defs>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={50}
                startAngle={90}
                endAngle={-270}
                paddingAngle={segments.length > 1 ? 3 : 0}
                stroke="none"
              >
                {segments.map((s) => (
                  <Cell key={s.key} fill={s.gradientId ? `url(#${s.gradientId})` : s.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="dept-card-donut-center">
            <span className="dept-card-donut-value">{onTimePct}%</span>
            <span className="dept-card-donut-label">vaqtida</span>
          </div>
        </div>

        <div className="dept-card-breakdown">
          {SEGMENTS.map((seg) => (
            row[seg.key] > 0 && (
              <div key={seg.key} className="dept-card-breakdown-row">
                <span className="dept-card-breakdown-dot" style={{ background: seg.color }} />
                <span className="dept-card-breakdown-label">{seg.label}</span>
                <span className="dept-card-breakdown-count">{row[seg.key]}</span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Bo'limlar kesimida BUGUNGI kunning jonli davomat holati — har bo'lim
 * o'zining alohida donut-diagrammasida Vaqtida/Kech/Kelmagan/Kutilmoqda
 * ulushlarini ko'rsatadi (markazda "vaqtida kelganlar" foizi). Diagramma
 * ranglari — mavjud "Kech keldi"/"Ichkarida"/"Tashqarida" belgilaridagi
 * bilan bir xil (--success/--warning/--error), faqat halqada chuqurlik
 * hissi uchun gradient qo'shilgan.
 */
export function DepartmentAttendanceChart({ data, loading }) {
  const hasData = data && data.length > 0;

  return (
    <Card className="mb-6 dept-attendance-card">
      <div className="dept-attendance-header">
        <div className="dept-attendance-header-title">
          <Building2 size={17} strokeWidth={2.25} />
          <h3>Bo'limlar bo'yicha bugungi davomat</h3>
        </div>
        <div className="dept-attendance-legend">
          {SEGMENTS.map((seg) => (
            <span key={seg.key} className="dept-attendance-legend-item">
              <span className="dept-attendance-legend-dot" style={{ background: seg.color }} />
              {seg.label}
            </span>
          ))}
        </div>
      </div>

      {loading && !hasData ? (
        <div className="dept-attendance-loading"><LoadingSpinner /></div>
      ) : !hasData ? (
        <EmptyState
          icon={<Building2 size={32} strokeWidth={1.5} />}
          title="Bo'limlar topilmadi"
          text="Xodimlarga bo'lim biriktirilgach, bu yerda bugungi davomat diagrammasi ko'rinadi"
        />
      ) : (
        <div className="dept-card-grid">
          {data.map((row) => (
            <DepartmentDonutCard key={row.department} row={row} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default DepartmentAttendanceChart;
