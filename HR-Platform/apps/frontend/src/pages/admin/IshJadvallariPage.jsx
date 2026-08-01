import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  format,
} from 'date-fns';
import {
  CalendarClock,
  CalendarDays,
  PartyPopper,
  Plus,
  Minus,
  Search,
  Eye,
  Pencil,
  Settings2,
  Repeat,
  SearchX,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Filter,
  PackageX,
  Building2,
  LayoutGrid,
  Network,
  Users,
  Trash2,
  Copy,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import SidePanel from '../../components/ui/SidePanel';
import useToast from '../../hooks/useToast';
import workScheduleService from '../../services/workScheduleService';
import employeeService from '../../services/employeeService';

const SCHEDULE_TABS = [
  { value: 'jadvallar', label: 'Jadvallar', icon: CalendarClock },
  { value: 'bayramlar', label: 'Bayramlar', icon: PartyPopper },
];

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

// Filiallar/Bo'limlar/Lavozimlar uchun hali alohida backend yo'q — tashkilot
// bo'limidagi kabi (OrganizationPage), shu sabab faqat kompaniyaning o'zi
// ("IT Live") mavjud filial sifatida ko'rsatiladi.
const BRANCH_OPTIONS = [{ value: 'it-live', label: 'IT Live' }];
const DEPARTMENT_OPTIONS = [];
const POSITION_OPTIONS = [];

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const UZ_WEEKDAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];

function formatUzDate(date) {
  return `${date.getDate()} ${UZ_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// "Filter" panelidagi sana oralig'i maydonlari uchun — "Iyun 25, 2026" tartibi.
function formatUzDateAlt(date) {
  return `${UZ_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function defaultDayConfig(dayNumber) {
  return { dayNumber, isWorkDay: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' };
}

function emptyScheduleForm() {
  const cycle = 7;
  return {
    type: 'moslashuvchan',
    name: '',
    startDate: new Date(),
    cycle,
    countOvertime: false,
    deductBreak: false,
    extendedHours: 4,
    limitType: 'kunlik',
    limitHours: 0,
    shiftLimitHours: 1,
    days: Array.from({ length: cycle }, (_, idx) => defaultDayConfig(idx + 1)),
    employeeIds: [],
  };
}

/**
 * Keeps form.days in sync with the "Sikl" (cycle) length — growing it with
 * fresh default days or trimming it, never dropping days the user already
 * configured within the new length.
 */
function resizeDays(days, cycleLength) {
  if (days.length === cycleLength) return days;
  if (days.length > cycleLength) return days.slice(0, cycleLength);
  const extra = Array.from({ length: cycleLength - days.length }, (_, idx) => defaultDayConfig(days.length + idx + 1));
  return [...days, ...extra];
}

/** Converts a backend schedule (camelCase, from workScheduleService) into the form/table shape above. */
function apiScheduleToItem(s) {
  const loadedDays = (s.days && s.days.length > 0 ? s.days : [defaultDayConfig(1)]).map((d) => ({
    dayNumber: d.dayNumber,
    isWorkDay: d.isWorkDay,
    startTime: (d.startTime || '09:00').slice(0, 5),
    endTime: (d.endTime || '18:00').slice(0, 5),
    breakStart: (d.breakStart || '13:00').slice(0, 5),
    breakEnd: (d.breakEnd || '14:00').slice(0, 5),
  }));
  // Self-heals if a schedule's saved day count ever drifts from its cycle
  // length (e.g. cycle was edited elsewhere) instead of silently hiding days.
  const days = resizeDays(loadedDays, s.cycleDays);

  return {
    id: s.id,
    type: s.type,
    name: s.name,
    startDate: new Date(s.startDate),
    cycle: s.cycleDays,
    countOvertime: s.countOvertime,
    deductBreak: s.deductBreak,
    extendedHours: s.extendedHours,
    limitType: s.limitType || 'kunlik',
    limitHours: s.limitHours ?? 0,
    shiftLimitHours: s.shiftLimitHours ?? 1,
    days,
    employeeIds: s.employeeIds || [],
    employees: s.employees || [],
  };
}

function scheduleToPayload(form) {
  return {
    name: form.name.trim(),
    type: form.type,
    startDate: form.startDate,
    cycleDays: form.cycle,
    countOvertime: form.countOvertime,
    deductBreak: form.deductBreak,
    extendedHours: form.extendedHours,
    limitType: form.limitType,
    limitHours: form.limitHours,
    shiftLimitHours: form.shiftLimitHours,
    days: form.days,
    employeeIds: form.employeeIds,
  };
}

function emptyHolidayForm() {
  return {
    name: '',
    description: '',
    date: new Date(),
    repeatsYearly: false,
    branches: [],
    departments: [],
    positions: [],
    scheduleIds: [],
  };
}

/**
 * Inline calendar popover for the "Boshlanish sanasi" field — self-contained
 * (no shared DatePicker component exists yet), reusing the same
 * attendance-cal-* classes the Davomat page's own date picker uses.
 */
function ScheduleDatePicker({ value, onChange, disabled, formatter = formatUzDate }) {
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
        <CalendarDays size={15} strokeWidth={2.25} /> {formatter(value)}
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

/**
 * Custom single-select dropdown ("Limit turi") — reuses the same
 * attendance-schedule-* classes the Davomat page's filter dropdown uses,
 * swapping the checkbox list for a single checkmark.
 */
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

/**
 * Multi-select dropdown ("Filiallar" / "Bo'limlar" / "Lavozimlar" / "Jadvallar") —
 * search box + checkbox list + an explicit "Saqlash" button that closes the
 * panel, so picking several items doesn't close it after every click.
 */
function MultiSelectDropdown({ options, selected, onChange, icon: Icon, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  const filtered = options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()));

  const toggleOption = (value) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const selectedLabels = options.filter((opt) => selected.includes(opt.value)).map((opt) => opt.label).join(', ');

  return (
    <div className="attendance-schedule-select" ref={wrapperRef}>
      <button
        type="button"
        className={`attendance-schedule-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        style={disabled ? { opacity: 0.65, cursor: 'default' } : undefined}
      >
        <span className={selectedLabels ? '' : 'placeholder'}>{selectedLabels || placeholder}</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="attendance-schedule-panel">
          <div className="attendance-schedule-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Qidiruv"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="attendance-schedule-list">
            {filtered.length === 0 ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Hech narsa topilmadi
              </div>
            ) : (
              filtered.map((opt) => {
                const isChecked = selected.includes(opt.value);
                return (
                  <label key={opt.value} className={`attendance-schedule-item ${isChecked ? 'checked' : ''}`}>
                    {Icon && <Icon size={16} className="attendance-schedule-item-icon" />}
                    <span>{opt.label}</span>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleOption(opt.value)} />
                  </label>
                );
              })
            )}
          </div>

          <div style={{ padding: '0 0.5rem 0.5rem' }}>
            <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={() => setIsOpen(false)}>
              Saqlash
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact +/- number stepper for cycle length / extended hours. */
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

/** Orange circular checkbox pill (label + dot), matching the Davomat report field style. */
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
 * IshJadvallariPage
 * Work-schedule management — schedules are created/edited via the
 * work-schedules API and assigned to one or more employees at once;
 * Davomat (attendance) recording reads that assignment to flag late scans.
 */
export function IshJadvallariPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('jadvallar');
  const [search, setSearch] = useState('');
  const [holidaySearch, setHolidaySearch] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterRange, setFilterRange] = useState(() => ({ start: subMonths(new Date(), 1), end: new Date() }));
  const [holidays, setHolidays] = useState([]);
  const [isHolidayPanelOpen, setIsHolidayPanelOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState('create'); // 'create' | 'edit' | 'view'
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(emptyScheduleForm);

  const notReady = () => toast.info("Bu imkoniyat tez orada qo'shiladi");

  const typeLabelOf = (value) => SCHEDULE_TYPES.find((t) => t.value === value)?.label || value;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [scheduleList, employeeResp] = await Promise.all([
          workScheduleService.getSchedules(),
          employeeService.getEmployees({ limit: 100 }),
        ]);
        if (cancelled) return;
        setSchedules(scheduleList.map(apiScheduleToItem));
        setEmployees(employeeResp.data || []);
      } catch (err) {
        if (!cancelled) toast.error("Jadvallarni yuklashda xatolik yuz berdi");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
    [employees]
  );

  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schedules;
    return schedules.filter(
      (s) => s.name.toLowerCase().includes(q) || typeLabelOf(s.type).toLowerCase().includes(q)
    );
  }, [search, schedules]);

  const openCreatePanel = () => {
    setPanelMode('create');
    setActiveId(null);
    setForm(emptyScheduleForm());
    setIsPanelOpen(true);
  };

  const openEditPanel = (schedule) => {
    const { id, ...scheduleForm } = schedule;
    setPanelMode('edit');
    setActiveId(id);
    setForm(scheduleForm);
    setIsPanelOpen(true);
  };

  const openViewPanel = (schedule) => {
    const { id, ...scheduleForm } = schedule;
    setPanelMode('view');
    setActiveId(id);
    setForm(scheduleForm);
    setIsPanelOpen(true);
  };

  const closePanel = () => setIsPanelOpen(false);

  const updateDay = (dayNumber, field, value) => {
    setForm((f) => ({
      ...f,
      days: f.days.map((d) => (d.dayNumber === dayNumber ? { ...d, [field]: value } : d)),
    }));
  };

  const updateCycle = (newCycle) => {
    setForm((f) => ({ ...f, cycle: newCycle, days: resizeDays(f.days, newCycle) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Jadval nomini kiriting');
      const nameField = document.getElementById('scheduleName');
      nameField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameField?.focus();
      return;
    }
    if (form.employeeIds.length === 0) {
      toast.error('Kamida bitta xodim tanlang — jadval xodimga biriktirilishi shart');
      return;
    }

    setIsSaving(true);
    try {
      const payload = scheduleToPayload(form);

      if (panelMode === 'edit') {
        const updated = await workScheduleService.updateSchedule(activeId, payload);
        setSchedules((prev) => prev.map((s) => (s.id === activeId ? apiScheduleToItem(updated) : s)));
        toast.success('Jadval yangilandi');
      } else {
        const created = await workScheduleService.createSchedule(payload);
        setSchedules((prev) => [apiScheduleToItem(created), ...prev]);
        toast.success("Yangi jadval qo'shildi");
      }
      setIsPanelOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Jadvalni saqlashda xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (schedule) => {
    if (!window.confirm(`"${schedule.name}" jadvalini o'chirmoqchimisiz?`)) return;
    try {
      await workScheduleService.deleteSchedule(schedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
      toast.success("Jadval o'chirildi");
    } catch (err) {
      toast.error(err.response?.data?.message || "Jadvalni o'chirishda xatolik yuz berdi");
    }
  };

  const isReadOnly = panelMode === 'view';
  const selectedTypeLabel = typeLabelOf(form.type);

  const scheduleOptions = useMemo(
    () => schedules.map((s) => ({ value: String(s.id), label: s.name })),
    [schedules]
  );

  const filteredHolidays = useMemo(() => {
    const q = holidaySearch.trim().toLowerCase();
    if (!q) return holidays;
    return holidays.filter((h) => h.name.toLowerCase().includes(q));
  }, [holidaySearch, holidays]);

  const openHolidayPanel = () => {
    setHolidayForm(emptyHolidayForm());
    setIsHolidayPanelOpen(true);
  };

  const closeHolidayPanel = () => setIsHolidayPanelOpen(false);

  const handleSaveHoliday = () => {
    if (!holidayForm.name.trim()) {
      toast.error('Bayram nomini kiriting');
      return;
    }

    const coverageParts = [];
    if (holidayForm.branches.length) coverageParts.push(`${holidayForm.branches.length} filial`);
    if (holidayForm.departments.length) coverageParts.push(`${holidayForm.departments.length} bo'lim`);
    if (holidayForm.positions.length) coverageParts.push(`${holidayForm.positions.length} lavozim`);
    if (holidayForm.scheduleIds.length) coverageParts.push(`${holidayForm.scheduleIds.length} jadval`);

    setHolidays((prev) => [
      {
        id: Date.now(),
        name: holidayForm.name.trim(),
        date: holidayForm.date,
        coverage: coverageParts.length ? coverageParts.join(', ') : 'Barchasi',
        repeatsYearly: holidayForm.repeatsYearly,
      },
      ...prev,
    ]);
    toast.success("Bayram qo'shildi");
    setIsHolidayPanelOpen(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="org-tabs-row">
        <div className="org-tabs">
          {SCHEDULE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`org-tab ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              <tab.icon size={15} strokeWidth={2.25} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'jadvallar' ? (
          <Button
            variant="primary"
            className="attendance-primary-btn"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={openCreatePanel}
          >
            Yangi jadval
          </Button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ maxWidth: '220px' }}>
              <span className="search-icon" style={{ display: 'inline-flex' }}>
                <Search size={16} strokeWidth={2} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Qidiruv"
                value={holidaySearch}
                onChange={(e) => setHolidaySearch(e.target.value)}
              />
            </div>
            <Button variant="outline" icon={<Filter size={16} strokeWidth={2} />} onClick={() => setIsFilterPanelOpen(true)}>
              Filtr
            </Button>
            <Button
              variant="primary"
              className="attendance-primary-btn"
              icon={<Plus size={16} strokeWidth={2.5} />}
              onClick={openHolidayPanel}
            >
              Bayram qo'shish
            </Button>
          </div>
        )}
      </div>

      {activeTab === 'jadvallar' ? (
        <Card>
          <div className="org-toolbar">
            <h2 className="org-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarClock size={20} strokeWidth={2.25} style={{ color: 'var(--accent)' }} />
              Ish jadvallari
            </h2>
            <div className="search-bar" style={{ maxWidth: '260px' }}>
              <span className="search-icon" style={{ display: 'inline-flex' }}>
                <Search size={16} strokeWidth={2} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Qidiruv"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>
          ) : filteredSchedules.length === 0 ? (
            <EmptyState
              icon={<SearchX size={44} strokeWidth={1.5} />}
              title="Jadvallar topilmadi"
              text={
                search
                  ? `"${search}" so'rovi bo'yicha hech qanday jadval topilmadi.`
                  : "Hali jadval yaratilmagan. \"Yangi jadval\" tugmasi orqali xodimga jadval biriktiring."
              }
            />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nomi</th>
                    <th>Turi</th>
                    <th>Boshlanish sanasi</th>
                    <th>Sikl</th>
                    <th>Xodimlar</th>
                    <th style={{ textAlign: 'right' }}>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '10px',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366f1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <CalendarClock size={17} strokeWidth={2} />
                          </div>
                          <div className="font-semibold">{schedule.name}</div>
                        </div>
                      </td>
                      <td><span className="status-badge status-faol">{typeLabelOf(schedule.type)}</span></td>
                      <td>{format(schedule.startDate, 'yyyy-MM-dd')}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}>
                          <Repeat size={14} strokeWidth={2} />
                          {schedule.cycle} kun
                        </span>
                      </td>
                      <td>
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)' }}
                          title={schedule.employees.map((e) => `${e.firstName} ${e.lastName}`).join(', ')}
                        >
                          <Users size={14} strokeWidth={2} />
                          {schedule.employees.length} xodim
                        </span>
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openViewPanel(schedule)} title="Ko'rish">
                            <Eye size={16} strokeWidth={2} />
                          </Button>
                          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openEditPanel(schedule)} title="Tahrirlash">
                            <Pencil size={16} strokeWidth={2} />
                          </Button>
                          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDeleteSchedule(schedule)} title="O'chirish">
                            <Trash2 size={16} strokeWidth={2} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <Button variant="ghost" size="sm" className="btn-icon" onClick={notReady} title="Sozlamalar">
              <Settings2 size={16} strokeWidth={2} />
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="org-toolbar">
            <h2 className="org-title">Bayramlar</h2>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bayram</th>
                  <th>Sana</th>
                  <th>Qamrov</th>
                  <th>Istisnolar</th>
                  <th>Holat</th>
                </tr>
              </thead>
              {filteredHolidays.length > 0 && (
                <tbody>
                  {filteredHolidays.map((holiday) => (
                    <tr key={holiday.id}>
                      <td><div className="font-semibold">{holiday.name}</div></td>
                      <td>{format(holiday.date, 'yyyy-MM-dd')}</td>
                      <td>{holiday.coverage}</td>
                      <td style={{ color: 'var(--text-muted)' }}>—</td>
                      <td>
                        <span className="status-badge status-faol">
                          {holiday.repeatsYearly ? 'Har yili' : 'Bir martalik'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>

          {filteredHolidays.length === 0 && (
            <EmptyState
              icon={<PackageX size={56} strokeWidth={1.25} />}
              title="Bayramlar topilmadi"
              text={
                holidaySearch
                  ? `"${holidaySearch}" so'rovi bo'yicha hech qanday bayram topilmadi.`
                  : "Bu bo'lim uchun hali bayram qo'shilmagan. \"Bayram qo'shish\" tugmasi orqali yangi bayram yarating."
              }
            />
          )}

          <div style={{ marginTop: '1rem' }}>
            <Button variant="ghost" size="sm" className="btn-icon" onClick={notReady} title="Sozlamalar">
              <Settings2 size={16} strokeWidth={2} />
            </Button>
          </div>
        </Card>
      )}

      <SidePanel
        isOpen={isPanelOpen}
        onClose={closePanel}
        title={panelMode === 'view' ? form.name : panelMode === 'edit' ? 'Jadvalni tahrirlash' : 'Yangi jadval'}
        footer={
          isReadOnly ? (
            <Button variant="outline" onClick={closePanel} style={{ width: '100%' }}>
              Yopish
            </Button>
          ) : (
            <div style={{ display: 'flex', width: '100%', gap: '0.75rem' }}>
              <Button variant="outline" onClick={closePanel} style={{ flex: 1 }}>
                Bekor qilish
              </Button>
              <Button variant="primary" className="attendance-primary-btn" onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>
                {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Jadval turi */}
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
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && setForm((f) => ({ ...f, type: t.value }))}
                  style={{
                    flex: 1,
                    padding: '0.625rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    fontFamily: 'inherit',
                    cursor: isReadOnly ? 'default' : 'pointer',
                    transition: 'var(--transition-fast)',
                    background: selected
                      ? (isReadOnly ? 'rgba(249, 115, 22, 0.35)' : 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)')
                      : 'transparent',
                    color: selected ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: selected && !isReadOnly ? '0 2px 8px rgba(249, 115, 22, 0.3)' : 'none',
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
            placeholder="Masalan: Ertalabki smena"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={isReadOnly}
          />

          <div className="form-group">
            <label className="form-label">Xodim(lar)</label>
            <MultiSelectDropdown
              options={employeeOptions}
              selected={form.employeeIds}
              onChange={(v) => setForm((f) => ({ ...f, employeeIds: v }))}
              icon={Users}
              placeholder="Xodimlarni tanlang"
              disabled={isReadOnly}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Bu jadval tanlangan xodim(lar)ning Davomat hisobiga ta'sir qiladi (kech qolishni aniqlash uchun).
            </p>
          </div>

          {form.type === 'gibrid' ? (
            <>
              <div className="form-group">
                <label className="form-label">Boshlanish sanasi</label>
                <ScheduleDatePicker
                  value={form.startDate}
                  onChange={(date) => setForm((f) => ({ ...f, startDate: date }))}
                  disabled={isReadOnly}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Limit turi</label>
                <SingleSelectDropdown
                  value={form.limitType}
                  options={LIMIT_TYPES}
                  onChange={(v) => setForm((f) => ({ ...f, limitType: v }))}
                  disabled={isReadOnly}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Limit soatlar</label>
                <Stepper value={form.limitHours} onChange={(v) => setForm((f) => ({ ...f, limitHours: v }))} min={0} max={24} disabled={isReadOnly} />
              </div>

              <div className="form-group">
                <label className="form-label">Smena limit soatlari</label>
                <Stepper value={form.shiftLimitHours} onChange={(v) => setForm((f) => ({ ...f, shiftLimitHours: v }))} min={0} max={24} disabled={isReadOnly} />
              </div>
            </>
          ) : form.type === 'erkin' ? (
            <>
              <div className="form-group">
                <label className="form-label">Boshlanish sanasi</label>
                <ScheduleDatePicker
                  value={form.startDate}
                  onChange={(date) => setForm((f) => ({ ...f, startDate: date }))}
                  disabled={isReadOnly}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Smena limit soatlari</label>
                <Stepper value={form.shiftLimitHours} onChange={(v) => setForm((f) => ({ ...f, shiftLimitHours: v }))} min={0} max={24} disabled={isReadOnly} />
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
                    disabled={isReadOnly}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sikl</label>
                  <Stepper value={form.cycle} onChange={updateCycle} min={1} max={31} disabled={isReadOnly} />
                </div>
              </div>

              <CheckPill
                spread
                label="Qo'shimcha ish vaqtini hisoblash"
                checked={form.countOvertime}
                onChange={(v) => setForm((f) => ({ ...f, countOvertime: v }))}
                disabled={isReadOnly}
              />

              <CheckPill
                spread
                label="Tanaffus vaqtini ayirish"
                checked={form.deductBreak}
                onChange={(v) => setForm((f) => ({ ...f, deductBreak: v }))}
                disabled={isReadOnly}
              />

              <div className="form-group">
                <label className="form-label">Uzaytirilgan ish vaqti</label>
                <Stepper value={form.extendedHours} onChange={(v) => setForm((f) => ({ ...f, extendedHours: v }))} min={0} max={12} disabled={isReadOnly} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedTypeLabel} jadval tafsilotlari
                  </h3>
                  {!isReadOnly && form.days.length > 1 && (
                    <button
                      type="button"
                      className="schedule-copy-day1-btn"
                      title="Kun 1 sozlamalarini barcha kunlarga nusxalash"
                      onClick={() => {
                        const template = form.days[0];
                        setForm((f) => ({
                          ...f,
                          days: f.days.map((d) => (d.dayNumber === 1 ? d : { ...template, dayNumber: d.dayNumber })),
                        }));
                      }}
                    >
                      <Copy size={13} strokeWidth={2.25} /> Kun 1 ni hammasiga qo'llash
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {form.days.map((day) => (
                    <div
                      key={day.dayNumber}
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
                        <span style={{ fontWeight: 700 }}>Kun {day.dayNumber}</span>
                        <CheckPill
                          label="Ish kuni"
                          checked={day.isWorkDay}
                          onChange={(v) => updateDay(day.dayNumber, 'isWorkDay', v)}
                          disabled={isReadOnly}
                        />
                      </div>

                      {day.isWorkDay && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <Input
                            label="Boshlanish vaqti"
                            type="time"
                            name={`dayStartTime-${day.dayNumber}`}
                            icon={<Clock size={15} strokeWidth={2} />}
                            value={day.startTime}
                            onChange={(e) => updateDay(day.dayNumber, 'startTime', e.target.value)}
                            disabled={isReadOnly}
                          />
                          <Input
                            label="Tugash vaqti"
                            type="time"
                            name={`dayEndTime-${day.dayNumber}`}
                            icon={<Clock size={15} strokeWidth={2} />}
                            value={day.endTime}
                            onChange={(e) => updateDay(day.dayNumber, 'endTime', e.target.value)}
                            disabled={isReadOnly}
                          />
                          <Input
                            label="Tanaffus boshlanishi"
                            type="time"
                            name={`dayBreakStart-${day.dayNumber}`}
                            icon={<Clock size={15} strokeWidth={2} />}
                            value={day.breakStart}
                            onChange={(e) => updateDay(day.dayNumber, 'breakStart', e.target.value)}
                            disabled={isReadOnly}
                          />
                          <Input
                            label="Tanaffus tugashi"
                            type="time"
                            name={`dayBreakEnd-${day.dayNumber}`}
                            icon={<Clock size={15} strokeWidth={2} />}
                            value={day.breakEnd}
                            onChange={(e) => updateDay(day.dayNumber, 'breakEnd', e.target.value)}
                            disabled={isReadOnly}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SidePanel>

      <SidePanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        title="Filter"
        footer={
          <Button
            variant="primary"
            className="attendance-primary-btn"
            style={{ width: '100%' }}
            onClick={() => {
              toast.success('Filtr saqlandi');
              setIsFilterPanelOpen(false);
            }}
          >
            Saqlash
          </Button>
        }
      >
        <div className="form-group">
          <label className="form-label">Sana oralig'i</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <ScheduleDatePicker
                value={filterRange.start}
                onChange={(date) => setFilterRange((f) => ({ ...f, start: date }))}
                formatter={formatUzDateAlt}
              />
            </div>
            <div style={{ flex: 1 }}>
              <ScheduleDatePicker
                value={filterRange.end}
                onChange={(date) => setFilterRange((f) => ({ ...f, end: date }))}
                formatter={formatUzDateAlt}
              />
            </div>
          </div>
        </div>
      </SidePanel>

      <SidePanel
        isOpen={isHolidayPanelOpen}
        onClose={closeHolidayPanel}
        title="Bayram yaratish"
        footer={
          <div style={{ display: 'flex', width: '100%', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={closeHolidayPanel}>
              Bekor qilish
            </Button>
            <Button variant="primary" className="attendance-primary-btn" onClick={handleSaveHoliday}>
              O'zgarishlarni saqlash
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Input
            label="Bayram nomi"
            name="holidayName"
            value={holidayForm.name}
            onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
          />

          <Input
            label="Tavsif"
            name="holidayDescription"
            placeholder="Ixtiyoriy..."
            value={holidayForm.description}
            onChange={(e) => setHolidayForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className="form-group">
            <label className="form-label">Sana</label>
            <ScheduleDatePicker
              value={holidayForm.date}
              onChange={(date) => setHolidayForm((f) => ({ ...f, date }))}
              formatter={(d) => format(d, 'yyyy-MM-dd')}
            />
          </div>

          <CheckPill
            label="Har yili takrorlanadi"
            checked={holidayForm.repeatsYearly}
            onChange={(v) => setHolidayForm((f) => ({ ...f, repeatsYearly: v }))}
          />

          <div className="form-group">
            <label className="form-label">Filiallar</label>
            <MultiSelectDropdown
              options={BRANCH_OPTIONS}
              selected={holidayForm.branches}
              onChange={(v) => setHolidayForm((f) => ({ ...f, branches: v }))}
              icon={Building2}
              placeholder="Filiallarni tanlang"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bo'limlar</label>
            <MultiSelectDropdown
              options={DEPARTMENT_OPTIONS}
              selected={holidayForm.departments}
              onChange={(v) => setHolidayForm((f) => ({ ...f, departments: v }))}
              icon={LayoutGrid}
              placeholder="Bo'limlarni tanlang"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Lavozimlar</label>
            <MultiSelectDropdown
              options={POSITION_OPTIONS}
              selected={holidayForm.positions}
              onChange={(v) => setHolidayForm((f) => ({ ...f, positions: v }))}
              icon={Network}
              placeholder="Lavozimlarni tanlang"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Jadvallar</label>
            <MultiSelectDropdown
              options={scheduleOptions}
              selected={holidayForm.scheduleIds}
              onChange={(v) => setHolidayForm((f) => ({ ...f, scheduleIds: v }))}
              icon={CalendarClock}
              placeholder="Jadvallarni tanlang"
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1rem 1.125rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Istisnolar</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Istisno qilingan foydalanuvchilar yo'q</div>
            </div>
            <Button variant="outline" size="sm" onClick={notReady}>
              Boshqarish
            </Button>
          </div>
        </div>
      </SidePanel>
    </div>
  );
}

export default IshJadvallariPage;
