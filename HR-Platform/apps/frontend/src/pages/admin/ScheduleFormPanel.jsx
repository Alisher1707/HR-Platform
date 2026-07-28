import React, { useEffect, useRef, useState } from 'react';
import {
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  subMonths,
  addMonths,
} from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Minus,
  Plus,
  Clock,
  X,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useToast from '../../hooks/useToast';

// Aynan Ish jadvallari sahifasidagi "Yangi jadval" paneli bilan bir xil
// forma — Xodim qo'shish/tahrirlash panelidagi "Jadval" maydoni uchun ham
// shu dizayn kerak bo'lgani sababli mustaqil komponent sifatida chiqarilgan.

const SCHEDULE_TYPES = [
  { value: 'moslashuvchan', label: 'Moslashuvchan' },
  { value: 'gibrid', label: 'Gibrid' },
  { value: 'erkin', label: 'Erkin' },
];

const LIMIT_TYPES = [
  { value: 'kunlik', label: 'Kunlik' },
  { value: 'haftalik', label: 'Haftalik' },
  { value: 'oylik', label: 'Oylik' },
];

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const UZ_WEEKDAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];

function formatUzDate(date) {
  return `${date.getDate()} ${UZ_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function emptyScheduleForm() {
  return {
    type: 'moslashuvchan',
    name: '',
    startDate: new Date(),
    cycle: 7,
    countOvertime: false,
    deductBreak: false,
    extendedHours: 4,
    limitType: 'kunlik',
    limitHours: 0,
    shiftLimitHours: 1,
    day: { isWorkDay: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  };
}

function ScheduleDatePicker({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) setViewDate(value);
    setIsOpen((prev) => !prev);
  };

  const gridStart = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="attendance-date-picker" ref={wrapperRef}>
      <button
        type="button"
        className="attendance-date-field"
        onClick={toggleOpen}
        disabled={disabled}
        style={disabled ? { opacity: 0.65, cursor: 'default' } : undefined}
      >
        <CalendarDays size={15} strokeWidth={2.25} /> {formatUzDate(value)}
      </button>

      {isOpen && (
        <div className="attendance-cal-popup" style={{ position: 'absolute', marginTop: '0.5rem' }}>
          <div className="attendance-cal-header">
            <button type="button" className="attendance-toggle-btn" onClick={() => setViewDate((p) => subMonths(p, 1))} title="Oldingi oy">
              <ChevronLeft size={16} />
            </button>
            <span>{UZ_MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <button type="button" className="attendance-toggle-btn" onClick={() => setViewDate((p) => addMonths(p, 1))} title="Keyingi oy">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="attendance-cal-weekdays">
            {UZ_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="attendance-cal-grid">
            {days.map((day) => {
              const outside = !isSameMonth(day, viewDate);
              const selected = isSameDay(day, value);
              const today = isToday(day) && !selected;
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  className={['attendance-cal-day', outside ? 'outside' : '', selected ? 'selected' : '', today ? 'today' : ''].filter(Boolean).join(' ')}
                  onClick={() => { onChange(day); setIsOpen(false); }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({ value, options, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  return (
    <div className="attendance-schedule-select" ref={wrapperRef}>
      <button
        type="button"
        className={`attendance-schedule-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        style={disabled ? { opacity: 0.65, cursor: 'default' } : undefined}
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="attendance-schedule-panel">
          <div className="attendance-schedule-list">
            {options.map((opt) => {
              const checked = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`attendance-schedule-item ${checked ? 'checked' : ''}`}
                  style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', fontSize: 'inherit' }}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                >
                  <div style={{ width: '14px', flexShrink: 0, display: 'inline-flex' }}>
                    {checked && <Check size={14} strokeWidth={2.5} />}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, min = 0, max = 99, disabled }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.625rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.3rem 0.5rem',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button type="button" className="attendance-toggle-btn" onClick={() => onChange(Math.max(min, value - 1))} title="Kamaytirish" disabled={disabled}>
        <Minus size={14} />
      </button>
      <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 700, fontSize: '0.9375rem' }}>{value}</span>
      <button type="button" className="attendance-toggle-btn" onClick={() => onChange(Math.min(max, value + 1))} title="Oshirish" disabled={disabled}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function CheckPill({ checked, onChange, label, spread, disabled }) {
  return (
    <label
      className={`attendance-check-pill ${checked ? 'checked' : ''}`}
      style={{
        ...(spread ? { display: 'flex', width: '100%', justifyContent: 'space-between' } : {}),
        ...(disabled ? { opacity: 0.6, pointerEvents: 'none' } : {}),
      }}
    >
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="attendance-check-dot" />
    </label>
  );
}

/**
 * ScheduleFormPanel
 * The exact "Yangi jadval" form used on the Ish jadvallari page, packaged so
 * it can also open from the employee add/edit form's "Jadval" field. Renders
 * as a plain card (no portal/overlay of its own) so the caller can dock it
 * beside another panel — e.g. next to the employee form, the same way
 * FieldPicker docks beside it — instead of stacking on top and hiding it.
 * Manages its own form state; calls onSave(form) with the finished schedule
 * and lets the caller decide where the result goes (no backend yet).
 */
export function ScheduleFormPanel({ isOpen, onClose, onSave, title = 'Yangi jadval' }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyScheduleForm);

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyScheduleForm());
  }, [isOpen]);

  if (!isOpen) return null;

  const updateDay = (field, value) => {
    setForm((f) => ({ ...f, day: { ...f.day, [field]: value } }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Jadval nomini kiriting');
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  };

  const selectedTypeLabel = SCHEDULE_TYPES.find((t) => t.value === form.type)?.label || form.type;

  return (
    <div className="qa-schedule-panel" onClick={(e) => e.stopPropagation()}>
      <div className="qa-schedule-panel-header">
        <h3>{title}</h3>
        <button type="button" className="qa-close" onClick={onClose} aria-label="Yopish">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="qa-schedule-panel-body">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            gap: '0.375rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.3rem',
          }}
        >
          {SCHEDULE_TYPES.map((t) => {
            const selected = form.type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                style={{
                  flex: 1,
                  padding: '0.625rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  background: selected ? 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' : 'transparent',
                  color: selected ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: selected ? '0 2px 8px rgba(249, 115, 22, 0.3)' : 'none',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <Input
          label="Nomi"
          name="scheduleName"
          placeholder="Jadval nomini kiriting"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />

        {form.type === 'gibrid' ? (
          <>
            <div className="form-group">
              <label className="form-label">Boshlanish sanasi</label>
              <ScheduleDatePicker
                value={form.startDate}
                onChange={(date) => setForm((f) => ({ ...f, startDate: date }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Limit turi</label>
              <SingleSelectDropdown
                value={form.limitType}
                options={LIMIT_TYPES}
                onChange={(v) => setForm((f) => ({ ...f, limitType: v }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Limit soatlar</label>
              <Stepper value={form.limitHours} onChange={(v) => setForm((f) => ({ ...f, limitHours: v }))} min={0} max={24} />
            </div>

            <div className="form-group">
              <label className="form-label">Smena limit soatlari</label>
              <Stepper value={form.shiftLimitHours} onChange={(v) => setForm((f) => ({ ...f, shiftLimitHours: v }))} min={0} max={24} />
            </div>
          </>
        ) : form.type === 'erkin' ? (
          <>
            <div className="form-group">
              <label className="form-label">Boshlanish sanasi</label>
              <ScheduleDatePicker
                value={form.startDate}
                onChange={(date) => setForm((f) => ({ ...f, startDate: date }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Smena limit soatlari</label>
              <Stepper value={form.shiftLimitHours} onChange={(v) => setForm((f) => ({ ...f, shiftLimitHours: v }))} min={0} max={24} />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                <label className="form-label">Boshlanish sanasi</label>
                <ScheduleDatePicker
                  value={form.startDate}
                  onChange={(date) => setForm((f) => ({ ...f, startDate: date }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sikl</label>
                <Stepper value={form.cycle} onChange={(v) => setForm((f) => ({ ...f, cycle: v }))} min={1} max={31} />
              </div>
            </div>

            <CheckPill
              spread
              label="Qo'shimcha ish vaqtini hisoblash"
              checked={form.countOvertime}
              onChange={(v) => setForm((f) => ({ ...f, countOvertime: v }))}
            />

            <CheckPill
              spread
              label="Tanaffus vaqtini ayirish"
              checked={form.deductBreak}
              onChange={(v) => setForm((f) => ({ ...f, deductBreak: v }))}
            />

            <div className="form-group">
              <label className="form-label">Uzaytirilgan ish vaqti</label>
              <Stepper value={form.extendedHours} onChange={(v) => setForm((f) => ({ ...f, extendedHours: v }))} min={0} max={12} />
            </div>

            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
                {selectedTypeLabel} jadval tafsilotlari
              </h3>

              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.125rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>Kun 1</span>
                  <CheckPill
                    label="Ish kuni"
                    checked={form.day.isWorkDay}
                    onChange={(v) => updateDay('isWorkDay', v)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Input
                    label="Boshlanish vaqti"
                    type="time"
                    name="dayStartTime"
                    icon={<Clock size={15} strokeWidth={2} />}
                    value={form.day.startTime}
                    onChange={(e) => updateDay('startTime', e.target.value)}
                    disabled={!form.day.isWorkDay}
                  />
                  <Input
                    label="Tugash vaqti"
                    type="time"
                    name="dayEndTime"
                    icon={<Clock size={15} strokeWidth={2} />}
                    value={form.day.endTime}
                    onChange={(e) => updateDay('endTime', e.target.value)}
                    disabled={!form.day.isWorkDay}
                  />
                  <Input
                    label="Tanaffus boshlanishi"
                    type="time"
                    name="dayBreakStart"
                    icon={<Clock size={15} strokeWidth={2} />}
                    value={form.day.breakStart}
                    onChange={(e) => updateDay('breakStart', e.target.value)}
                    disabled={!form.day.isWorkDay}
                  />
                  <Input
                    label="Tanaffus tugashi"
                    type="time"
                    name="dayBreakEnd"
                    icon={<Clock size={15} strokeWidth={2} />}
                    value={form.day.breakEnd}
                    onChange={(e) => updateDay('breakEnd', e.target.value)}
                    disabled={!form.day.isWorkDay}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      </div>

      <div className="qa-schedule-panel-footer">
        <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>
          Bekor qilish
        </Button>
        <Button variant="primary" className="attendance-primary-btn" onClick={handleSave} style={{ flex: 1 }}>
          Saqlash
        </Button>
      </div>

      <style>{`
        .qa-schedule-panel {
          width: 460px;
          max-width: 90vw;
          max-height: 100%;
          min-height: 0;
          background: var(--bg-card-solid);
          border: 1px solid var(--border);
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
          animation: qaScheduleSlideIn 0.22s ease;
        }

        .qa-schedule-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 1.75rem;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .qa-schedule-panel-header h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .qa-schedule-panel-body {
          padding: 1.75rem;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        .qa-schedule-panel-footer {
          display: flex;
          gap: 0.75rem;
          padding: 1rem 1.75rem;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        @keyframes qaScheduleSlideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 900px) {
          .qa-schedule-panel {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default ScheduleFormPanel;
