import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { Building2 } from 'lucide-react';

const SEGMENTS = [
  { key: 'onTime', label: 'Vaqtida keldi', color: 'var(--success)' },
  { key: 'late', label: 'Kech keldi', color: 'var(--warning)' },
  { key: 'absent', label: 'Kelmagan', color: 'var(--error)' },
  { key: 'pending', label: 'Kutilmoqda', color: 'var(--text-secondary)' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;

  return (
    <div className="dept-attendance-tooltip">
      <div className="dept-attendance-tooltip-title">{label}</div>
      <div className="dept-attendance-tooltip-total">Jami: {row.total} xodim</div>
      {SEGMENTS.map((seg) => (
        row[seg.key] > 0 && (
          <div key={seg.key} className="dept-attendance-tooltip-row">
            <span className="dept-attendance-tooltip-dot" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <strong>{row[seg.key]}</strong>
          </div>
        )
      ))}
    </div>
  );
}

/**
 * Bo'limlar kesimida BUGUNGI kunning jonli davomat holati — har bo'lim
 * o'zining jami xodimlar soniga nisbatan 100% sifatida ko'rsatiladi
 * (stackOffset="expand"), shu 100% ichida Vaqtida/Kech/Kelmagan/Kutilmoqda
 * ulushlari qanday taqsimlanganini ko'rsatadi.
 */
export function DepartmentAttendanceChart({ data, loading }) {
  const hasData = data && data.length > 0;
  const chartHeight = Math.max(160, (data?.length || 0) * 44 + 40);

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
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            stackOffset="expand"
            margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
            barCategoryGap={14}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="department"
              width={150}
              tick={{ fill: 'var(--text-primary)', fontSize: 13 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-secondary)' }} />
            {SEGMENTS.map((seg) => (
              <Bar key={seg.key} dataKey={seg.key} stackId="a" fill={seg.color} name={seg.label} radius={0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export default DepartmentAttendanceChart;
