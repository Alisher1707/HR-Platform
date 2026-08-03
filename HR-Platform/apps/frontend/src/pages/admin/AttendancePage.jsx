import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  subDays,
  isSameDay,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';
import {
  Building2,
  CalendarDays,
  Settings,
  Users,
  ClipboardList,
  Filter,
  Plus,
  Briefcase,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ExternalLink,
  LayoutList,
  History,
  Sun,
  CloudSun,
  Zap,
  PackageX,
  Search,
  ShieldAlert,
  Clock,
  ArrowLeft,
  FileText,
  BarChart3,
  Smartphone,
  LayoutGrid,
  Wallet,
  Download,
  ArrowUpRight,
  Trash2,
  PiggyBank,
  AlertTriangle,
  RefreshCw,
  Eye,
  UserPlus,
  Folder,
  X,
  LogOut,
  DoorClosed,
  DoorOpen,
  CalendarOff,
  Paperclip,
  Copy,
  Check,
  KeyRound,
  LogIn,
  Pencil,
} from 'lucide-react';
import employeeService from '../../services/employeeService';
import attendanceService from '../../services/attendanceService';
import devicesService from '../../services/devicesService';
import fineService from '../../services/fineService';
import { exportAttendanceReportToExcel } from '../../utils/exportExcel';
import useToast from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatsCard from '../../components/ui/StatsCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Input from '../../components/ui/Input';
import SidePanel from '../../components/ui/SidePanel';
import Modal from '../../components/ui/Modal';

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const UZ_WEEKDAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];

function formatUzDate(date) {
  return `${UZ_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Colors a Davomat "Izohlar" note by what it says happened — keyword match
 * against the free-text notes managers type on manual entries, since the
 * field itself carries no structured status.
 */
function getNoteBadgeVariant(notes) {
  if (!notes) return null;
  const text = notes.toLowerCase();
  if (text.includes('kech')) return 'warning'; // kech keldi
  if (text.includes('kelmadi') || text.includes('kelmagan')) return 'error'; // ishga kelmadi
  if (text.includes('ketib') || text.includes('ketdi')) return 'left'; // ketib qoldi
  if (text.includes('keld')) return 'success'; // keldi (o'z vaqtida)
  return 'notes';
}

/**
 * Renders a Monitoring > Hisobotlar result set (per-employee attendance
 * summary) — shared by both "Davomat hisoboti" and "Davr bo'yicha hisobot",
 * which return the same row shape from attendanceService.getReport().
 * `results` is null before the first generate click, [] after a generate
 * that matched nobody, or a populated array.
 */
function AttendanceReportTable({ results, fields, isLoading }) {
  if (isLoading) {
    return <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>;
  }
  if (!results) return null;
  if (results.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Bu davr uchun ma'lumot topilmadi"
        text="Filtrlarni o'zgartirib qayta urinib ko'ring."
      />
    );
  }

  return (
    <div className="table-container" style={{ marginTop: '1rem' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Xodim</th>
            <th>Bo'lim</th>
            <th>Kelgan kunlar</th>
            {fields.includes('kechikishlar') && <th>Kechikishlar</th>}
            {fields.includes('erta_ketishlar') && <th>Erta ketishlar</th>}
            {fields.includes('qoshimcha_soatlar') && <th>Qo'shimcha soatlar</th>}
            {fields.includes('umumiy_soatlar') && <th>Umumiy soatlar</th>}
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.employeeId}>
              <td className="font-semibold">{row.firstName} {row.lastName}</td>
              <td>{row.department || '-'}</td>
              <td>{row.daysPresent}</td>
              {fields.includes('kechikishlar') && <td>{row.daysLate}</td>}
              {fields.includes('erta_ketishlar') && <td>{row.daysEarlyLeave}</td>}
              {fields.includes('qoshimcha_soatlar') && <td>{row.overtimeHours} soat</td>}
              {fields.includes('umumiy_soatlar') && <td>{row.totalHours} soat</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTerminalClock(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()} ${date.getMonth() + 1} ${date.getDate()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatUZS(amount) {
  return `${Math.round(amount || 0).toLocaleString('ru-RU')} UZS`;
}

const FINANCE_TYPE_META = {
  bonus: { label: 'Bonuslar', addLabel: "Bonus qo'shish" },
  fine: { label: 'Jarimalar', addLabel: "Jarima qo'shish" },
  payment: { label: "To'lovlar", addLabel: "To'lov qilish" },
};

const FINE_TEMPLATE_TYPES = [
  { value: 'kech_kelish', label: 'Kech kelish', color: '#f43f5e', icon: Clock },
  { value: 'erta_ketish', label: 'Erta ketish', color: '#f97316', icon: LogOut },
  { value: 'chiqish_yoq', label: "Chiqish yo'q", color: '#d97706', icon: DoorClosed },
  { value: 'kelmagan_kun', label: 'Kelmagan kun', color: '#a855f7', icon: CalendarOff },
];

const CUSTOM_FINE_TYPE_COLOR = '#6366f1';

// Har bir "Jazo turi" (fine_types) elementiga barqaror, alohida rang beradi —
// yaratilish tartibi bo'yicha shu palitradan aylanma tanlanadi (id o'zgarmas
// bo'lgani uchun rang ham doim bir xil qoladi).
const FINE_TYPE_COLOR_PALETTE = ['#6366f1', '#f43f5e', '#f97316', '#0ea5e9', '#10b981', '#a855f7', '#ec4899', '#eab308'];
function getFineTypeColor(id, fineTypes) {
  const idx = fineTypes.findIndex((t) => t.id === id);
  return idx >= 0 ? FINE_TYPE_COLOR_PALETTE[idx % FINE_TYPE_COLOR_PALETTE.length] : CUSTOM_FINE_TYPE_COLOR;
}

const FINE_TIME_LIMIT_OPTIONS = ['00:05', '00:10', '00:15', '00:20', '00:30', '00:45', '01:00']
  .map((v) => ({ value: v, label: v }));

function getDefaultManualForm() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    employeeId: '',
    branch: '',
    date: now,
    time: `${hh}:${mm}`,
    type: 'kelish',
    comment: '',
  };
}

const TASK_PRIORITIES = [
  { value: 'past', label: 'Past', icon: Sun, color: '#10b981' },
  { value: 'orta', label: "O'rta", icon: CloudSun, color: '#f59e0b' },
  { value: 'yuqori', label: 'Yuqori', icon: Zap, color: '#ef4444' },
];

function getDefaultTaskForm() {
  return {
    name: '',
    description: '',
    dueDate: new Date(),
    priority: 'orta',
    assigneeIds: [],
    file: null,
  };
}

const TASK_FILE_ACCEPT = '.png,.jpg,.jpeg,.pdf';
const TASK_FILE_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const TASK_FILE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

const REPORT_FIELDS = [
  { value: 'kechikishlar', label: 'Kechikishlar' },
  { value: 'erta_ketishlar', label: 'Erta ketishlar' },
  { value: 'qoshimcha_soatlar', label: "Qo'shimcha soatlar" },
  { value: 'umumiy_soatlar', label: 'Umumiy soatlar' },
];

function getDefaultReportForm() {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    branches: [],
    departments: [],
    schedules: [],
    positions: [],
    employeeId: '',
    fields: [],
  };
}

function getDefaultPayrollReportForm() {
  const now = new Date();
  return {
    startDate: startOfMonth(now),
    endDate: now,
    branches: [],
    departments: [],
    schedules: [],
    positions: [],
    employeeId: '',
  };
}

function getDefaultPeriodReportForm() {
  const now = new Date();
  return {
    startDate: startOfMonth(now),
    endDate: now,
    branches: [],
    departments: [],
    schedules: [],
    positions: [],
    employeeId: '',
    fields: [],
  };
}

/**
 * DatePicker
 * Pill button that opens a calendar popup for picking a single date.
 */
const CAL_POPUP_WIDTH = 300;

function DatePicker({ value, onChange, trigger = 'pill' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      setViewDate(value);
      const rect = wrapperRef.current.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(rect.right - CAL_POPUP_WIDTH, window.innerWidth - CAL_POPUP_WIDTH - 8)
      );
      setPopupPos({ top: rect.bottom + 8, left });
    }
    setIsOpen((prev) => !prev);
  };

  const gridStart = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="attendance-date-picker" ref={wrapperRef}>
      <button
        type="button"
        className={trigger === 'field' ? 'attendance-date-field' : 'attendance-pill'}
        onClick={toggleOpen}
      >
        <CalendarDays size={15} strokeWidth={2.25} /> {formatUzDate(value)}
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="attendance-cal-popup"
          style={{ position: 'fixed', top: popupPos.top, left: popupPos.left }}
        >
          <div className="attendance-cal-header">
            <button
              type="button"
              className="attendance-toggle-btn"
              onClick={() => setViewDate((prev) => subMonths(prev, 1))}
              title="Oldingi oy"
            >
              <ChevronLeft size={16} />
            </button>
            <span>{UZ_MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <button
              type="button"
              className="attendance-toggle-btn"
              onClick={() => setViewDate((prev) => addMonths(prev, 1))}
              title="Keyingi oy"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="attendance-cal-weekdays">
            {UZ_WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
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
                  className={[
                    'attendance-cal-day',
                    outside ? 'outside' : '',
                    selected ? 'selected' : '',
                    today ? 'today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    onChange(day);
                    setIsOpen(false);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * MonthPicker
 * Compact pill button ("Iyul 2026") that opens a prev/next month stepper —
 * used by the Moliya tab where filtering is per-month, not per-day.
 */
function MonthPicker({ value, onChange }) {
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

  return (
    <div className="finance-month-picker" ref={wrapperRef}>
      <button
        type="button"
        className="finance-month-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <CalendarDays size={15} strokeWidth={2.25} />
        {UZ_MONTHS[value.getMonth()]} {value.getFullYear()}
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="finance-month-popup">
          <button
            type="button"
            className="attendance-toggle-btn"
            onClick={() => onChange(subMonths(value, 1))}
            title="Oldingi oy"
          >
            <ChevronLeft size={16} />
          </button>
          <span>{UZ_MONTHS[value.getMonth()]} {value.getFullYear()}</span>
          <button
            type="button"
            className="attendance-toggle-btn"
            onClick={() => onChange(addMonths(value, 1))}
            title="Keyingi oy"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const SCHEDULE_OPTIONS = [
  { value: '08-18', label: '8:00 - 18:00' },
];

const DATE_RANGE_PRESETS = [
  { label: "So'nggi 3 kun", days: 3 },
  { label: "So'nggi 7 kun", days: 7 },
  { label: "So'nggi 15 kun", days: 15 },
  { label: "So'nggi 1 oy", months: 1 },
  { label: "So'nggi 2 oy", months: 2 },
  { label: "So'nggi 3 oy", months: 3 },
];

/**
 * SearchableSelect
 * Dropdown with a search box and checkbox-style rows. Supports both
 * multi-select (e.g. "Jadvallar") and single-select (e.g. "Xodim") —
 * single-select just closes itself as soon as a row is picked.
 */
function SearchableSelect({
  options,
  selected,
  onChange,
  icon: Icon,
  iconColor,
  placeholder,
  searchPlaceholder = 'Qidiruv',
  multiple = false,
  // Optional: (option) => { Icon, color } — per-option icon/rang, masalan har xil
  // rangdagi jazo turlari uchun. Berilmasa, yuqoridagi yagona icon/iconColor ishlatiladi.
  getOptionIcon,
  // Optional: (name) => void — berilsa, panel pastida "+ createLabel" tugmasi chiqadi,
  // bosilganda faqat nom so'raydigan inline forma ochiladi (yangi variant yaratish uchun).
  onCreateNew,
  createLabel = "Yangi qo'shish",
  // Optional: 'pill' — trigger'ni toolbar-pill ko'rinishida chizadi (attendance-pill uslubi).
  variant,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 240, maxHeight: 320 });
  const wrapperRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // DatePicker'lar kabi o'z ichidagi elementlar ham document.body'ga
      // alohida portal qilib ochilishi mumkin (masalan "Yangi qo'shish"
      // shakli ichida) — shu sabab wrapper VA panel ikkalasi ham tekshiriladi.
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Panel endi document.body'ga portal qilinadi (Card'lar orasidagi z-index/
  // stacking-context ziddiyati sabab pastdagi kartaning orqasida ko'rinib
  // qolmasligi uchun) — shu sabab ochilishdan oldin ekrandagi joyi hisoblanadi.
  // Trigger oyna (modal) pastiga yaqin bo'lsa, pastda joy yetarli bo'lmasligi
  // mumkin — shu holatda panel yuqoriga ochiladi (aks holda ko'rinmas joyga
  // chiqib, tanlov ro'yxati "bo'sh" ko'rinib qolar edi).
  const toggleOpen = () => {
    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const margin = 8;
      const minNeeded = 220;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openAbove = spaceBelow < minNeeded && spaceAbove > spaceBelow;

      setPopupPos(
        openAbove
          ? { bottom: window.innerHeight - rect.top + margin, top: undefined, left: rect.left, width: rect.width, maxHeight: spaceAbove }
          : { top: rect.bottom + margin, bottom: undefined, left: rect.left, width: rect.width, maxHeight: spaceBelow }
      );
    }
    setIsOpen((prev) => !prev);
  };

  const selectedValues = multiple ? selected : (selected ? [selected] : []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (value) => {
    if (multiple) {
      onChange(
        selectedValues.includes(value)
          ? selectedValues.filter((v) => v !== value)
          : [...selectedValues, value]
      );
    } else {
      onChange(value);
      setIsOpen(false);
    }
  };

  const selectedLabels = options
    .filter((opt) => selectedValues.includes(opt.value))
    .map((opt) => opt.label)
    .join(', ');

  const selectedOption = !multiple && selected ? options.find((opt) => opt.value === selected) : null;
  const triggerIconMeta = selectedOption && getOptionIcon ? getOptionIcon(selectedOption) : null;
  const TriggerIcon = triggerIconMeta?.Icon || Icon;

  const handleCreateSubmit = () => {
    const name = newName.trim();
    if (!name || !onCreateNew) return;
    onCreateNew(name);
    setNewName('');
    setIsCreating(false);
  };

  return (
    <div className="attendance-schedule-select" ref={wrapperRef}>
      <button
        type="button"
        className={
          variant === 'pill'
            ? `attendance-pill ${isOpen ? 'active' : ''}`
            : `attendance-schedule-trigger ${isOpen ? 'open' : ''}`
        }
        onClick={toggleOpen}
      >
        {TriggerIcon && (
          <TriggerIcon size={variant === 'pill' ? 15 : 16} style={triggerIconMeta ? { color: triggerIconMeta.color } : undefined} />
        )}
        <span className={selectedLabels ? '' : 'placeholder'}>
          {selectedLabels || placeholder}
        </span>
        <ChevronDown size={variant === 'pill' ? 14 : 16} />
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="attendance-schedule-panel"
          style={{
            position: 'fixed',
            top: popupPos.top,
            bottom: popupPos.bottom,
            left: popupPos.left,
            right: 'auto',
            width: popupPos.width,
            maxHeight: popupPos.maxHeight,
            overflowY: 'auto',
          }}
        >
          {isCreating ? (
            <div className="fine-type-select-create">
              <input
                type="text"
                className="fine-type-select-create-input"
                placeholder="Nomi"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="fine-type-select-create-actions">
                <button
                  type="button"
                  className="fine-type-select-create-cancel"
                  onClick={() => {
                    setIsCreating(false);
                    setNewName('');
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  className="fine-type-select-create-save"
                  disabled={!newName.trim()}
                  onClick={handleCreateSubmit}
                >
                  Qo'shish
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="attendance-schedule-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="attendance-schedule-list">
                {filtered.map((opt) => {
                  const isChecked = selectedValues.includes(opt.value);
                  const optIconMeta = getOptionIcon ? getOptionIcon(opt) : null;
                  const OptIcon = optIconMeta?.Icon || Icon;
                  return (
                  <label key={opt.value} className={`attendance-schedule-item ${isChecked ? 'checked' : ''}`}>
                    {OptIcon && (
                      <OptIcon
                        size={16}
                        className="attendance-schedule-item-icon"
                        style={{ color: optIconMeta?.color || iconColor }}
                      />
                    )}
                    <span>{opt.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.value)}
                    />
                  </label>
                  );
                })}
              </div>

              {multiple && (
                <button
                  type="button"
                  className="attendance-schedule-save"
                  onClick={() => setIsOpen(false)}
                >
                  Saqlash
                </button>
              )}

              {onCreateNew && (
                <button type="button" className="fine-type-select-add" onClick={() => setIsCreating(true)}>
                  <Plus size={14} strokeWidth={2.25} /> {createLabel}
                </button>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * FineTypeCreateButton
 * Toolbar'dagi ixcham "Jazo yaratish" tugmasi — bosilganda nomini so'raydigan
 * professional popover-card ochadi (jazo turlari katalogini kengaytirish uchun).
 */
function FineTypeCreateButton({ onCreate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Boshlanish/Tugash sanasi maydonlarining o'z kalendar oynasi
      // (DatePicker) ham alohida portal sifatida document.body'ga ochiladi
      // (bu popover'ning DOM ichiga emas) — shu sabab sana bosilishi
      // "tashqariga bosildi" deb noto'g'ri hisoblanib, butun kartani
      // sana tanlanishidan oldin yopib yuborar edi.
      if (e.target.closest('.attendance-cal-popup')) return;
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 8, left: rect.left });
    }
    setIsOpen((prev) => !prev);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      await onCreate(trimmed);
      setName('');
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fine-type-create" ref={wrapperRef}>
      <button
        type="button"
        className={`attendance-pill fine-type-create-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleOpen}
      >
        <Plus size={15} strokeWidth={2.25} />
        Jazo yaratish
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fine-type-create-popover"
          style={{ position: 'fixed', top: popupPos.top, left: popupPos.left }}
        >
          <div className="fine-type-create-popover-header">
            <span className="fine-type-create-popover-icon">
              <AlertTriangle size={15} strokeWidth={2.25} />
            </span>
            <span className="fine-type-create-popover-title">Yangi jazo turi</span>
            <button
              type="button"
              className="fine-type-create-popover-close"
              aria-label="Yopish"
              onClick={() => setIsOpen(false)}
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          </div>

          <div className="fine-type-create-field">
            <label>Nomi</label>
            <input
              type="text"
              className="fine-type-select-create-input"
              placeholder="Masalan: Ogohlantirish"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <button
            type="button"
            className="fine-type-select-create-save fine-type-create-popover-submit"
            disabled={!name.trim() || isSaving}
            onClick={handleSubmit}
          >
            <Plus size={14} strokeWidth={2.25} /> {isSaving ? 'Saqlanmoqda...' : "Qo'shish"}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * TaskAssigneePicker
 * "Hodim qo'shish" pill trigger that opens a full "Hodimlar" side panel
 * (docked next to the task panel, not a small popover) with bo'lim/lavozim
 * filters, search, "select all" and a checkable employee list. Selected
 * employees render as removable chips above the trigger.
 */
function TaskAssigneePicker({ employees, departmentOptions, positionOptions, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');

  const filtered = employees.filter((emp) => {
    if (department && emp.department !== department) return false;
    if (position && emp.position !== position) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  const toggleOne = (id) => {
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id]);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((emp) => selected.includes(emp.id));

  const toggleAll = () => {
    const filteredIds = filtered.map((emp) => emp.id);
    onChange(
      allFilteredSelected
        ? selected.filter((id) => !filteredIds.includes(id))
        : [...new Set([...selected, ...filteredIds])]
    );
  };

  const selectedEmployees = employees.filter((emp) => selected.includes(emp.id));

  return (
    <div className="task-assignee-picker">
      {selectedEmployees.length > 0 && (
        <div className="task-assignee-chips">
          {selectedEmployees.map((emp) => (
            <button
              key={emp.id}
              type="button"
              className="task-assignee-avatar-chip"
              onClick={() => toggleOne(emp.id)}
            >
              <span className="task-assignee-avatar-chip-tooltip">
                {emp.first_name} {emp.last_name}
              </span>
              {emp.photo_url ? (
                <img
                  className="attendance-avatar"
                  src={employeeService.getPhotoUrl(emp.photo_url)}
                  alt={`${emp.first_name} ${emp.last_name}`}
                />
              ) : (
                <span className="attendance-avatar-fallback">
                  {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                </span>
              )}
              <span className="task-assignee-avatar-chip-name">
                {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="task-assignee-add-btn"
        onClick={() => setIsOpen(true)}
      >
        <UserPlus size={15} strokeWidth={2.25} /> Hodim qo'shish
      </button>

      {isOpen && ReactDOM.createPortal(
        <div className="task-assignee-overlay" onClick={() => setIsOpen(false)}>
          <div className="task-assignee-side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="attendance-filter-header">
              <h3>Hodimlar</h3>
              <button type="button" className="modal-close" onClick={() => setIsOpen(false)} aria-label="Yopish">
                &times;
              </button>
            </div>

            <div className="attendance-filter-body">
              <div className="task-assignee-filters">
                {department ? (
                  <button
                    type="button"
                    className="task-assignee-filter-chip"
                    onClick={() => setDepartment('')}
                  >
                    {departmentOptions.find((o) => o.value === department)?.label || department}
                    <span className="task-assignee-filter-chip-remove">
                      <X size={12} strokeWidth={2.5} />
                    </span>
                  </button>
                ) : (
                  <SearchableSelect
                    options={departmentOptions}
                    selected={department}
                    onChange={setDepartment}
                    icon={LayoutGrid}
                    iconColor="var(--text-secondary)"
                    placeholder="Bo'limlar"
                  />
                )}

                {position ? (
                  <button
                    type="button"
                    className="task-assignee-filter-chip"
                    onClick={() => setPosition('')}
                  >
                    {positionOptions.find((o) => o.value === position)?.label || position}
                    <span className="task-assignee-filter-chip-remove">
                      <X size={12} strokeWidth={2.5} />
                    </span>
                  </button>
                ) : (
                  <SearchableSelect
                    options={positionOptions}
                    selected={position}
                    onChange={setPosition}
                    icon={Briefcase}
                    iconColor="var(--text-secondary)"
                    placeholder="Lavozimlar"
                  />
                )}

                <div className="finance-search">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Hodim qidirish"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <label className="task-assignee-select-all">
                <span><Users size={16} strokeWidth={2.25} /> Barcha hodimlarni tanlash</span>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </label>

              <div className="task-assignee-list">
                {filtered.length === 0 ? (
                  <p className="attendance-muted-center">Hodim topilmadi</p>
                ) : (
                  filtered.map((emp) => {
                    const checked = selected.includes(emp.id);
                    return (
                      <label key={emp.id} className={`task-assignee-row ${checked ? 'checked' : ''}`}>
                        {emp.photo_url ? (
                          <img
                            className="attendance-avatar"
                            src={employeeService.getPhotoUrl(emp.photo_url)}
                            alt={`${emp.first_name} ${emp.last_name}`}
                          />
                        ) : (
                          <div className="attendance-avatar-fallback">
                            {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                          </div>
                        )}
                        <div className="task-assignee-row-info">
                          <div className="attendance-employee-name">{emp.first_name} {emp.last_name}</div>
                          {emp.department && (
                            <div className="task-assignee-row-meta">
                              <Briefcase size={12} strokeWidth={2.25} /> {emp.department}
                            </div>
                          )}
                        </div>
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(emp.id)} />
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const TREND_SERIES = [
  { key: 'kechQolish', label: 'Kech qolish', color: '--warning' },
  { key: 'kelmaslik', label: 'Ishga kelmaslik', color: '--error' },
  { key: 'kelgan', label: 'Kelgan', color: '--success' },
];

const ANALYTICS_RANKINGS = [
  { key: 'late', title: 'Kech qolish', subtitle: 'Ishga kech qolgan xodimlar reytingi', tone: 'warning' },
  { key: 'absence', title: 'Ishga kelmaslik', subtitle: "Sabab ko'rsatmaganlar reytingi", tone: 'error' },
  { key: 'onTime', title: "O'z vaqtida kelish", subtitle: 'Intizomli xodimlar reytingi', tone: 'success' },
];

const CHART_VIEW_WIDTH = 1000;
const CHART_VIEW_HEIGHT = 260;
const CHART_PAD = { top: 20, right: 16, bottom: 30, left: 30 };

function niceMax(value) {
  if (value <= 5) return 5;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

/**
 * TrendChart
 * Lightweight custom SVG line chart (no charting dependency) for the
 * "Xodimlar davomat grafigi" — daily counts for a fixed set of series
 * over a date range, with a hover crosshair + tooltip and a line-key legend.
 */
function TrendChart({ data, series }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const plotWidth = CHART_VIEW_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_VIEW_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const maxValue = useMemo(() => {
    const values = data.flatMap((d) => series.map((s) => d[s.key] ?? 0));
    return niceMax(Math.max(0, ...values));
  }, [data, series]);

  const xAt = (i) => CHART_PAD.left + i * xStep;
  const yAt = (v) => CHART_PAD.top + plotHeight - (v / maxValue) * plotHeight;

  const linePath = (key) => data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(d[key] ?? 0).toFixed(2)}`)
    .join(' ');

  const labelIndices = useMemo(() => {
    const count = Math.min(7, data.length);
    if (data.length <= count) return data.map((_, i) => i);
    const step = (data.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(i * step));
  }, [data.length]);

  const handleMove = (e) => {
    if (!svgRef.current || xStep === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CHART_VIEW_WIDTH / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    const rawIndex = Math.round((x - CHART_PAD.left) / xStep);
    setHoverIndex(Math.min(Math.max(rawIndex, 0), data.length - 1));
  };

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const lastIndex = data.length - 1;

  return (
    <div className="attendance-trend-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_VIEW_WIDTH} ${CHART_VIEW_HEIGHT}`}
        className="attendance-trend-svg"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[0, maxValue].map((tick) => (
          <g key={tick}>
            <line
              x1={CHART_PAD.left}
              x2={CHART_VIEW_WIDTH - CHART_PAD.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              className="attendance-trend-grid"
            />
            <text x={CHART_PAD.left - 8} y={yAt(tick) + 3} className="attendance-trend-axis-label" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        {labelIndices.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={CHART_VIEW_HEIGHT - 8}
            className="attendance-trend-axis-label"
            textAnchor="middle"
          >
            {data[i].label}
          </text>
        ))}

        {series.map((s) => (
          <path
            key={s.key}
            d={linePath(s.key)}
            className="attendance-trend-line"
            style={{ stroke: `var(${s.color})` }}
          />
        ))}

        {series.map((s) => (
          <circle
            key={`${s.key}-end`}
            cx={xAt(lastIndex)}
            cy={yAt(data[lastIndex][s.key] ?? 0)}
            r={5}
            className="attendance-trend-end-dot"
            style={{ fill: `var(${s.color})` }}
          />
        ))}

        {hovered && (
          <>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={CHART_PAD.top}
              y2={CHART_VIEW_HEIGHT - CHART_PAD.bottom}
              className="attendance-trend-crosshair"
            />
            {series.map((s) => (
              <circle
                key={`${s.key}-hover`}
                cx={xAt(hoverIndex)}
                cy={yAt(hovered[s.key] ?? 0)}
                r={4}
                className="attendance-trend-hover-dot"
                style={{ fill: `var(${s.color})` }}
              />
            ))}
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="attendance-trend-tooltip"
          style={{ left: `${(xAt(hoverIndex) / CHART_VIEW_WIDTH) * 100}%` }}
        >
          <div className="attendance-trend-tooltip-date">{hovered.label}</div>
          {series.map((s) => (
            <div key={s.key} className="attendance-trend-tooltip-row">
              <span className="attendance-trend-tooltip-key" style={{ background: `var(${s.color})` }} />
              <span className="attendance-trend-tooltip-label">{s.label}</span>
              <span className="attendance-trend-tooltip-value">{hovered[s.key] ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      <div className="attendance-trend-legend">
        {series.map((s) => (
          <span key={s.key} className="attendance-trend-legend-item">
            <span className="attendance-trend-legend-line" style={{ background: `var(${s.color})` }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * AttendancePage
 * Davomat (attendance) overview: employee list with placeholder check-in/out
 * columns — backend attendance tracking is not implemented yet.
 */
export function AttendancePage() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isArizalarOpen, setIsArizalarOpen] = useState(true);

  // Kept in the URL (?section=, ?tasksTab=) instead of plain useState so a
  // page refresh stays on the section/tab the user was looking at.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSectionParam = searchParams.get('section');
  const activeSection = ['topshiriqlar', 'monitoring', 'moliya'].includes(activeSectionParam)
    ? activeSectionParam
    : 'davomat';
  const setActiveSection = (section) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('section', section);
      return next;
    });
  };
  const tasksTab = searchParams.get('tasksTab') === 'history' ? 'history' : 'all';
  const setTasksTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tasksTab', tab);
      return next;
    });
  };
  const monitoringTab = ['analitika', 'terminallar'].includes(searchParams.get('monitoringTab'))
    ? searchParams.get('monitoringTab')
    : 'hisobotlar';
  const setMonitoringTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('monitoringTab', tab);
      return next;
    });
  };
  const moliyaTab = ['tolovlar', 'jarimalar'].includes(searchParams.get('moliyaTab'))
    ? searchParams.get('moliyaTab')
    : 'umumiy';
  const setMoliyaTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('moliyaTab', tab);
      return next;
    });
  };
  const [moliyaMonth, setMoliyaMonth] = useState(new Date());
  const [moliyaFilters, setMoliyaFilters] = useState({
    department: '',
    position: '',
    branch: '',
    schedules: [],
    employeeId: '',
    startDate: subMonths(new Date(), 1),
    endDate: new Date(),
    qarziBor: false,
    search: '',
  });
  // Payroll/bonus/fine tracking has no backend yet — kept in local state only,
  // keyed per employee+month so switching months shows genuinely empty data
  // instead of silently carrying figures over.
  const [financeRecords, setFinanceRecords] = useState({});
  const [financePanel, setFinancePanel] = useState(null); // { employeeId, type: 'bonus' | 'fine' | 'payment' }
  const [financeForm, setFinanceForm] = useState({ amount: '', note: '' });
  const [reportForm, setReportForm] = useState(getDefaultReportForm());
  const [reportResults, setReportResults] = useState(null); // null = not generated yet, [] = generated, no data
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [payrollForm, setPayrollForm] = useState(getDefaultPayrollReportForm());
  const [isPayrollReportGenerated, setIsPayrollReportGenerated] = useState(false);
  const [periodReportForm, setPeriodReportForm] = useState(getDefaultPeriodReportForm());
  const [periodReportResults, setPeriodReportResults] = useState(null);
  const [isPeriodReportLoading, setIsPeriodReportLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    branch: '',
    department: '',
    schedules: [],
    position: '',
    employeeId: '',
    startDate: subMonths(new Date(), 1),
    endDate: new Date(),
  });
  const presetScrollRef = useRef(null);
  const moliyaPresetScrollRef = useRef(null);
  const [terminalClock, setTerminalClock] = useState(new Date());
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
  const [manualForm, setManualForm] = useState(getDefaultManualForm());
  const [isSavingManualAttendance, setIsSavingManualAttendance] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(getDefaultTaskForm());
  const [taskPriorityFilter, setTaskPriorityFilter] = useState(null);
  const toggleTaskPriorityFilter = (value) => {
    setTaskPriorityFilter((prev) => (prev === value ? null : value));
  };
  const taskFileInputRef = useRef(null);
  const [isTaskDropzoneActive, setIsTaskDropzoneActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const canDeleteAttendance = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const handleDeleteAttendanceRecord = async (id) => {
    try {
      await attendanceService.deleteAttendance(id);
      toast.success("Yozuv o'chirildi");
      await refreshAttendance();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Yozuvni o'chirishda xatolik");
    }
  };

  const branchOptions = useMemo(() => (
    [...new Set(employees.map((e) => e.branch).filter(Boolean))]
      .map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
  ), [employees]);

  const departmentOptions = useMemo(() => (
    [...new Set(employees.map((e) => e.department).filter(Boolean))]
      .map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
  ), [employees]);

  const positionOptions = useMemo(() => (
    [...new Set(employees.map((e) => e.position).filter(Boolean))]
      .map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
  ), [employees]);

  const employeeOptions = useMemo(() => (
    employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))
  ), [employees]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => current - 2 + i)
      .map((y) => ({ value: String(y), label: String(y) }));
  }, []);

  const monthOptions = useMemo(() => (
    UZ_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))
  ), []);

  // Real last-30-days attendance data for the Analitika tab — fetched only
  // while that tab is actually open, since it's a separate range query from
  // the single-day records the rest of the page uses.
  const [analyticsRecords, setAnalyticsRecords] = useState([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (activeSection !== 'monitoring' || monitoringTab !== 'analitika') return;
    let cancelled = false;

    (async () => {
      setIsAnalyticsLoading(true);
      try {
        const end = new Date();
        const start = subDays(end, 29);
        const records = await attendanceService.getAttendance({
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        });
        if (!cancelled) setAnalyticsRecords(records);
      } catch (err) {
        if (!cancelled) toast.error("Analitika ma'lumotlarini yuklashda xatolik");
      } finally {
        if (!cancelled) setIsAnalyticsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, monitoringTab]);

  const trendData = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 29);
    const recordsByDay = {};
    analyticsRecords.forEach((r) => {
      const key = format(new Date(r.recorded_at), 'yyyy-MM-dd');
      (recordsByDay[key] ||= []).push(r);
    });

    const totalEmployees = employees.length;

    return eachDayOfInterval({ start, end }).map((date) => {
      const dayRecords = recordsByDay[format(date, 'yyyy-MM-dd')] || [];
      const keldiToday = new Set(dayRecords.filter((r) => r.type === 'keldi').map((r) => r.employee_id));
      const kechQolish = dayRecords.filter((r) => r.type === 'keldi' && r.is_late === true).length;

      return {
        label: format(date, "'M'MM d"),
        kechQolish,
        kelmaslik: Math.max(0, totalEmployees - keldiToday.size),
        kelgan: keldiToday.size,
      };
    });
  }, [analyticsRecords, employees]);

  const rankingsData = useMemo(() => {
    const employeeInfo = (e) => ({
      employeeId: e.id,
      name: `${e.first_name} ${e.last_name}`,
      position: e.position || '',
      photoUrl: e.photo_url || null,
    });
    const employeeById = Object.fromEntries(employees.map((e) => [e.id, employeeInfo(e)]));

    const late = {};
    const onTime = {};
    const daysPresent = {};

    analyticsRecords.forEach((r) => {
      if (r.type !== 'keldi') return;
      const key = r.employee_id;
      const info = employeeById[key] || {
        employeeId: key, name: `${r.first_name} ${r.last_name}`, position: r.position || '', photoUrl: r.photo_url || null,
      };
      const day = format(new Date(r.recorded_at), 'yyyy-MM-dd');

      (daysPresent[key] ||= { ...info, days: new Set() }).days.add(day);
      if (r.is_late === true) (late[key] ||= { ...info, count: 0 }).count += 1;
      if (r.is_late === false) (onTime[key] ||= { ...info, count: 0 }).count += 1;
    });

    const totalDays = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }).length;
    const absence = {};
    employees.forEach((e) => {
      const present = daysPresent[e.id]?.days.size || 0;
      absence[e.id] = { ...employeeInfo(e), count: totalDays - present };
    });

    const toRanked = (obj) => Object.values(obj).filter((v) => v.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);

    return {
      late: toRanked(late),
      absence: toRanked(absence),
      onTime: toRanked(onTime),
    };
  }, [analyticsRecords, employees]);

  const [expandedRankings, setExpandedRankings] = useState({ late: false, absence: false, onTime: false });

  const getFinanceKey = (employeeId) => `${employeeId}:${format(moliyaMonth, 'yyyy-MM')}`;

  const getFinanceRecord = (employeeId) => (
    financeRecords[getFinanceKey(employeeId)] || { bonuses: [], fines: [], payments: [] }
  );

  const financeListKeyFor = (type) => (type === 'bonus' ? 'bonuses' : type === 'fine' ? 'fines' : 'payments');

  const sumEntries = (entries) => entries.reduce((sum, e) => sum + e.amount, 0);

  const addFinanceEntry = (employeeId, type, amount, note) => {
    const key = getFinanceKey(employeeId);
    const listKey = financeListKeyFor(type);
    setFinanceRecords((prev) => {
      const record = prev[key] || { bonuses: [], fines: [], payments: [] };
      return {
        ...prev,
        [key]: {
          ...record,
          [listKey]: [...record[listKey], { id: Date.now(), amount, note, date: new Date() }],
        },
      };
    });
  };

  const removeFinanceEntry = (employeeId, type, entryId) => {
    const key = getFinanceKey(employeeId);
    const listKey = financeListKeyFor(type);
    setFinanceRecords((prev) => {
      const record = prev[key];
      if (!record) return prev;
      return {
        ...prev,
        [key]: { ...record, [listKey]: record[listKey].filter((e) => e.id !== entryId) },
      };
    });
  };

  const openFinancePanel = (employeeId, type) => {
    setFinanceForm({ amount: '', note: '' });
    setFinancePanel({ employeeId, type });
  };

  const handleAddFinanceEntry = () => {
    if (!financePanel) return;
    const amount = Number(financeForm.amount);
    if (!amount || amount <= 0) return;
    addFinanceEntry(financePanel.employeeId, financePanel.type, amount, financeForm.note.trim());
    setFinanceForm({ amount: '', note: '' });
  };

  const financeRows = useMemo(() => employees.map((emp) => {
    const record = getFinanceRecord(emp.id);
    const baseSalary = emp.salary_amount || 0;
    const bonusTotal = sumEntries(record.bonuses);
    const fineTotal = sumEntries(record.fines);
    const jami = baseSalary + bonusTotal - fineTotal;
    const paidTotal = sumEntries(record.payments);
    const qoldiq = jami - paidTotal;
    return { emp, baseSalary, bonusTotal, fineTotal, jami, paidTotal, qoldiq, record };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [employees, financeRecords, moliyaMonth]);

  const filteredFinanceRows = useMemo(() => financeRows.filter(({ emp, qoldiq }) => {
    if (moliyaFilters.department && emp.department !== moliyaFilters.department) return false;
    if (moliyaFilters.position && emp.position !== moliyaFilters.position) return false;
    if (moliyaFilters.branch && emp.branch !== moliyaFilters.branch) return false;
    if (moliyaFilters.qarziBor && qoldiq <= 0) return false;
    if (moliyaFilters.search) {
      const q = moliyaFilters.search.toLowerCase();
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  }), [financeRows, moliyaFilters]);

  const totalSalary = useMemo(
    () => filteredFinanceRows.reduce((sum, r) => sum + r.jami, 0),
    [filteredFinanceRows]
  );
  const totalQoldiq = useMemo(
    () => filteredFinanceRows.reduce((sum, r) => sum + r.qoldiq, 0),
    [filteredFinanceRows]
  );

  const allPayments = useMemo(() => filteredFinanceRows
    .flatMap((r) => r.record.payments.map((p) => ({ ...p, emp: r.emp })))
    .sort((a, b) => b.date - a.date), [filteredFinanceRows]);

  const allFines = useMemo(() => filteredFinanceRows
    .flatMap((r) => r.record.fines.map((f) => ({ ...f, emp: r.emp, empName: `${r.emp.first_name} ${r.emp.last_name}` })))
    .sort((a, b) => b.date - a.date), [filteredFinanceRows]);

  const financePanelRow = financePanel
    ? financeRows.find((r) => r.emp.id === financePanel.employeeId)
    : null;

  const [isMoliyaFilterOpen, setIsMoliyaFilterOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const getDefaultAddPaymentForm = () => ({
    employeeId: '',
    amount: '',
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  });
  const [addPaymentForm, setAddPaymentForm] = useState(getDefaultAddPaymentForm());

  const handleOpenAddPayment = () => {
    setAddPaymentForm(getDefaultAddPaymentForm());
    setIsAddPaymentOpen(true);
  };

  const addPaymentAmountNum = Number(addPaymentForm.amount);

  const handleSubmitAddPayment = () => {
    if (!addPaymentForm.employeeId || !addPaymentAmountNum || addPaymentAmountNum <= 0) return;
    addFinanceEntry(addPaymentForm.employeeId, 'payment', addPaymentAmountNum, '');
    setIsAddPaymentOpen(false);
  };

  const [isAddFineOpen, setIsAddFineOpen] = useState(false);
  const getDefaultFineForm = () => ({ name: '', enabled: true, templates: [] });
  const [fineForm, setFineForm] = useState(getDefaultFineForm());
  const [editingFinePolicyId, setEditingFinePolicyId] = useState(null);
  const [isSavingFinePolicy, setIsSavingFinePolicy] = useState(false);
  const [isAssignedFinesOpen, setIsAssignedFinesOpen] = useState(false);
  const [assignedFinesEmployeeFilter, setAssignedFinesEmployeeFilter] = useState('');

  // "Turi" — jarima sababi (Kech kelish/Erta ketish/Chiqish yo'q/Kelmagan kun).
  // Doim FINE_TEMPLATE_TYPES'dagi 4 ta belgilangan tur — foydalanuvchi
  // tomonidan yaratilmaydi.
  const violationTypeOptions = useMemo(
    () => FINE_TEMPLATE_TYPES.map((t) => ({ value: t.value, label: t.label })),
    []
  );
  const getViolationTypeIcon = (opt) => {
    const type = FINE_TEMPLATE_TYPES.find((t) => t.value === opt.value);
    return type ? { Icon: type.icon, color: type.color } : null;
  };

  // "Jazo turi" — sababga nisbatan qo'llanadigan chora (masalan "Ogohlantirish").
  // Backenddagi fine_types jadvalidan yuklanadi va "Jazo yaratish" orqali
  // to'ldiriladi — sahifa yangilansa ham saqlanib qoladi.
  const [fineTypes, setFineTypes] = useState([]);
  const punishmentTypeOptions = useMemo(
    () => fineTypes.map((t) => ({ value: t.id, label: t.name })),
    [fineTypes]
  );
  const getPunishmentTypeIcon = (opt) => ({ Icon: AlertTriangle, color: getFineTypeColor(opt.value, fineTypes) });

  const [finePolicies, setFinePolicies] = useState([]);
  const [isLoadingFinePolicies, setIsLoadingFinePolicies] = useState(false);

  const refreshFineTypes = async () => {
    try {
      const data = await fineService.getFineTypes();
      setFineTypes(data);
    } catch (err) {
      toast.error('Jazo turlarini yuklashda xatolik');
    }
  };

  const refreshFinePolicies = async () => {
    setIsLoadingFinePolicies(true);
    try {
      const data = await fineService.getFinePolicies();
      setFinePolicies(data);
    } catch (err) {
      toast.error('Jarima siyosatlarini yuklashda xatolik');
    } finally {
      setIsLoadingFinePolicies(false);
    }
  };

  useEffect(() => {
    if (activeSection !== 'moliya' || moliyaTab !== 'jarimalar') return;
    refreshFineTypes();
    refreshFinePolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, moliyaTab]);

  // Yangi jazo turini backendga saqlaydi va yaratilgan (yoki nomi mos keluvchi
  // mavjud) turning id'sini qaytaradi — chaqiruvchi (toolbar tugmasi yoki
  // shablon-kartadagi "Jazo turi" select) buni o'zining joriy tanlovi
  // sifatida belgilash-belgilamasligiga o'zi qaror qiladi.
  const handleCreateFineType = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      const created = await fineService.createFineType(trimmed);
      setFineTypes((prev) => (prev.some((t) => t.id === created.id) ? prev : [...prev, created]));
      toast.success(`"${created.name}" jazo turi qo'shildi`);
      return created.id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Jazo turi yaratishda xatolik');
      return null;
    }
  };

  const assignedFinesFiltered = useMemo(
    () => (assignedFinesEmployeeFilter ? allFines.filter((f) => f.emp.id === assignedFinesEmployeeFilter) : allFines),
    [allFines, assignedFinesEmployeeFilter]
  );

  const handleOpenAddFine = () => {
    setFineForm(getDefaultFineForm());
    setEditingFinePolicyId(null);
    setIsAddFineOpen(true);
  };

  const handleEditFinePolicy = (policy) => {
    setFineForm({
      name: policy.name,
      enabled: policy.enabled,
      templates: policy.templates.map((t) => ({
        id: t.id,
        type: t.violationType,
        timeLimit: t.timeLimit || '00:15',
        amount: t.amount != null ? String(t.amount) : '',
        jazoType: t.fineTypeId || '',
      })),
    });
    setEditingFinePolicyId(policy.id);
    setIsAddFineOpen(true);
  };

  const handleDeleteFinePolicy = async (policy) => {
    if (!window.confirm(`"${policy.name}" jarima siyosatini o'chirmoqchimisiz?`)) return;
    try {
      await fineService.deleteFinePolicy(policy.id);
      toast.success('Jarima siyosati o\'chirildi');
      refreshFinePolicies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Jarima siyosatini o'chirishda xatolik");
    }
  };

  const addFineTemplate = (type) => {
    setFineForm((prev) => ({
      ...prev,
      templates: [
        ...prev.templates,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: type.value, timeLimit: '00:15', amount: '', jazoType: '' },
      ],
    }));
  };

  const updateFineTemplate = (id, patch) => {
    setFineForm((prev) => ({
      ...prev,
      templates: prev.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const removeFineTemplate = (id) => {
    setFineForm((prev) => ({ ...prev, templates: prev.templates.filter((t) => t.id !== id) }));
  };

  const handleFineNextStep = async () => {
    if (!fineForm.name.trim() || isSavingFinePolicy) return;
    setIsSavingFinePolicy(true);
    const payload = {
      name: fineForm.name.trim(),
      enabled: fineForm.enabled,
      templates: fineForm.templates.map((t) => ({
        violationType: t.type,
        timeLimit: t.timeLimit || null,
        amount: Number(t.amount) || 0,
        fineTypeId: t.jazoType || null,
      })),
    };
    try {
      if (editingFinePolicyId) {
        await fineService.updateFinePolicy(editingFinePolicyId, payload);
        toast.success('Jarima siyosati yangilandi');
      } else {
        await fineService.createFinePolicy(payload);
        toast.success('Jarima siyosati yaratildi');
      }
      setIsAddFineOpen(false);
      refreshFinePolicies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Jarima siyosatini saqlashda xatolik');
    } finally {
      setIsSavingFinePolicy(false);
    }
  };

  const toggleReportField = (value) => {
    setReportForm((prev) => ({
      ...prev,
      fields: prev.fields.includes(value)
        ? prev.fields.filter((f) => f !== value)
        : [...prev.fields, value],
    }));
  };

  const handleGenerateReport = async () => {
    setIsReportLoading(true);
    try {
      const monthDate = new Date(Number(reportForm.year), Number(reportForm.month) - 1, 1);
      const rows = await attendanceService.getReport({
        startDate: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
        branches: reportForm.branches,
        departments: reportForm.departments,
        positions: reportForm.positions,
        employeeId: reportForm.employeeId,
      });
      setReportResults(rows);
      if (rows.length > 0) {
        exportAttendanceReportToExcel(rows, `davomat-hisoboti-${reportForm.year}-${String(reportForm.month).padStart(2, '0')}.xlsx`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hisobotni tayyorlashda xatolik');
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleGeneratePayrollReport = () => {
    setIsPayrollReportGenerated(true);
  };

  const togglePeriodReportField = (value) => {
    setPeriodReportForm((prev) => ({
      ...prev,
      fields: prev.fields.includes(value)
        ? prev.fields.filter((f) => f !== value)
        : [...prev.fields, value],
    }));
  };

  const handleGeneratePeriodReport = async () => {
    setIsPeriodReportLoading(true);
    try {
      const rows = await attendanceService.getReport({
        startDate: format(periodReportForm.startDate, 'yyyy-MM-dd'),
        endDate: format(periodReportForm.endDate, 'yyyy-MM-dd'),
        branches: periodReportForm.branches,
        departments: periodReportForm.departments,
        positions: periodReportForm.positions,
        employeeId: periodReportForm.employeeId,
      });
      setPeriodReportResults(rows);
      if (rows.length > 0) {
        const startLabel = format(periodReportForm.startDate, 'yyyy-MM-dd');
        const endLabel = format(periodReportForm.endDate, 'yyyy-MM-dd');
        exportAttendanceReportToExcel(rows, `davomat-hisoboti-${startLabel}_${endLabel}.xlsx`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hisobotni tayyorlashda xatolik');
    } finally {
      setIsPeriodReportLoading(false);
    }
  };

  const handleOpenFilter = () => {
    setIsFilterOpen(true);
  };

  const applyDatePreset = (preset) => {
    const endDate = new Date();
    const startDate = preset.days ? subDays(endDate, preset.days) : subMonths(endDate, preset.months);
    setFilters((prev) => ({ ...prev, startDate, endDate }));
  };

  const scrollPresets = (direction) => {
    presetScrollRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
  };

  const applyMoliyaDatePreset = (preset) => {
    const endDate = new Date();
    const startDate = preset.days ? subDays(endDate, preset.days) : subMonths(endDate, preset.months);
    setMoliyaFilters((prev) => ({ ...prev, startDate, endDate }));
  };

  const scrollMoliyaPresets = (direction) => {
    moliyaPresetScrollRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
  };

  const handleOpenManualAttendance = () => {
    setManualForm(getDefaultManualForm());
    setIsManualAttendanceOpen(true);
  };

  const handleOpenNewTask = () => {
    setTaskForm(getDefaultTaskForm());
    setIsNewTaskOpen(true);
  };

  const handleTaskFileSelect = (file) => {
    if (!file) return;
    if (!TASK_FILE_ALLOWED_TYPES.includes(file.type)) {
      toast.error('Fayl PNG, JPG yoki PDF formatida bo\'lishi kerak');
      return;
    }
    if (file.size > TASK_FILE_MAX_SIZE) {
      toast.error('Fayl hajmi 5MB dan oshmasligi kerak');
      return;
    }
    setTaskForm((prev) => ({ ...prev, file }));
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const response = await employeeService.getEmployees({ limit: 100 });
        setEmployees(response.data || []);
        setTotal(response.pagination?.total ?? (response.data || []).length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');

  const refreshAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const records = await attendanceService.getAttendance({ date: selectedDateKey });
      setAttendanceRecords(records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    refreshAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateKey]);

  // Kameradan hodisalar istalgan vaqt kelishi mumkin — sahifa ochiq turganda
  // Davomat bo'limi o'zi vaqti-vaqti bilan yangilanib tursin, foydalanuvchi
  // har safar qo'lda yangilashi shart bo'lmasin.
  useEffect(() => {
    if (activeSection !== 'davomat') return;
    const intervalId = setInterval(() => {
      refreshAttendance();
    }, 20000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, selectedDateKey]);

  const recordsByEmployee = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((r) => {
      if (!map[r.employee_id]) map[r.employee_id] = [];
      map[r.employee_id].push(r);
    });
    return map;
  }, [attendanceRecords]);

  const getAttendanceSummary = (employeeId) => {
    const records = recordsByEmployee[employeeId] || [];
    const keldiRecords = records.filter((r) => r.type === 'keldi');
    const ketdiRecords = records.filter((r) => r.type === 'ketdi');
    const firstKeldi = keldiRecords[0] || null;
    const lastKetdi = ketdiRecords[ketdiRecords.length - 1] || null;

    let totalLabel = '-';
    if (firstKeldi && lastKetdi) {
      const minutes = Math.max(0, Math.round(
        (new Date(lastKetdi.recorded_at) - new Date(firstKeldi.recorded_at)) / 60000
      ));
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      totalLabel = `${h}s ${m}d`;
    }

    const hasKeldi = Boolean(firstKeldi);
    const hasKetdi = Boolean(lastKetdi);
    // Ish jadvallari bo'limida xodimga biriktirilgan jadval asosida backend
    // hisoblab beradi (null — xodimga hali jadval biriktirilmagan).
    const isLate = hasKeldi && firstKeldi.is_late === true;

    // done: keldi+ketdi ikkalasi ham bor (ish kuni yakunlangan)
    // present: keldi bor, ketdi yo'q (hozir ishda)
    // none: hech narsa yo'q (kelmagan)
    const status = hasKeldi && hasKetdi ? 'done' : hasKeldi ? 'present' : 'none';

    return {
      records,
      kirish: hasKeldi ? format(new Date(firstKeldi.recorded_at), 'HH:mm') : '-',
      chiqish: hasKetdi ? format(new Date(lastKetdi.recorded_at), 'HH:mm') : '-',
      jami: totalLabel,
      status,
      hasKeldi,
      hasKetdi,
      isLate,
    };
  };

  const attendanceStats = useMemo(() => {
    let ishda = 0;
    let kechKelgan = 0;
    let kelganlar = 0;
    employees.forEach((emp) => {
      const summary = getAttendanceSummary(emp.id);
      if (summary.hasKeldi) kelganlar += 1;
      if (summary.hasKeldi && !summary.hasKetdi) ishda += 1;
      if (summary.isLate) kechKelgan += 1;
    });
    return {
      ishda,
      kechKelgan,
      ishdaEmas: Math.max(0, total - kelganlar),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, recordsByEmployee, total]);

  const handleSaveManualAttendance = async () => {
    if (!manualForm.employeeId) return;

    setIsSavingManualAttendance(true);
    try {
      const [hh, mm] = manualForm.time.split(':').map(Number);
      const recordedAt = new Date(manualForm.date);
      recordedAt.setHours(hh || 0, mm || 0, 0, 0);

      await attendanceService.createAttendance({
        employeeId: manualForm.employeeId,
        type: manualForm.type === 'ketish' ? 'ketdi' : 'keldi',
        recordedAt: recordedAt.toISOString(),
        notes: manualForm.comment,
      });

      toast.success("Davomat yozuvi qo'shildi");
      setIsManualAttendanceOpen(false);
      await refreshAttendance();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Davomat yozuvini saqlashda xatolik");
    } finally {
      setIsSavingManualAttendance(false);
    }
  };

  useEffect(() => {
    if (activeSection !== 'monitoring' || monitoringTab !== 'terminallar') return;
    const id = setInterval(() => setTerminalClock(new Date()), 1000);
    return () => clearInterval(id);
  }, [activeSection, monitoringTab]);

  const [terminals, setTerminals] = useState([]);
  const [isTerminalsLoading, setIsTerminalsLoading] = useState(false);

  const refreshTerminals = async () => {
    setIsTerminalsLoading(true);
    try {
      const data = await devicesService.getTerminals();
      setTerminals(data);
    } catch (err) {
      toast.error("Terminallar ro'yxatini yuklashda xatolik");
    } finally {
      setIsTerminalsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection !== 'monitoring' || monitoringTab !== 'terminallar') return;
    refreshTerminals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, monitoringTab]);

  // "Qurilma yaratish" paneli — nomi kiritilib yaratiladi, backend token
  // generatsiya qilib qaytaradi, keyin shu token nusxalab olish uchun
  // ko'rsatiladi (kameraga kiritish uchun kerak bo'ladi).
  const [isCreateDeviceOpen, setIsCreateDeviceOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isCreatingDevice, setIsCreatingDevice] = useState(false);
  const [createdDevice, setCreatedDevice] = useState(null);
  const [isTokenCopied, setIsTokenCopied] = useState(false);

  const openCreateDevicePanel = () => {
    setNewDeviceName('');
    setCreatedDevice(null);
    setIsTokenCopied(false);
    setIsCreateDeviceOpen(true);
  };

  const closeCreateDevicePanel = () => setIsCreateDeviceOpen(false);

  const handleCreateDevice = async () => {
    if (!newDeviceName.trim()) {
      toast.error('Qurilma nomini kiriting');
      return;
    }
    setIsCreatingDevice(true);
    try {
      const device = await devicesService.createDevice(newDeviceName.trim());
      setCreatedDevice(device);
      refreshTerminals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Qurilma yaratishda xatolik');
    } finally {
      setIsCreatingDevice(false);
    }
  };

  const handleCopyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setIsTokenCopied(true);
      setTimeout(() => setIsTokenCopied(false), 2000);
    } catch (err) {
      toast.error('Nusxalashda xatolik — tokenni qo\'lda belgilab oling');
    }
  };

  const handleDeleteDevice = async (device) => {
    if (!window.confirm(`"${device.name}" qurilmasini o'chirmoqchimisiz? Kamera bu tokendan foydalanishni to'xtatadi.`)) return;
    try {
      await devicesService.deleteDevice(device.id);
      toast.success("Qurilma o'chirildi");
      refreshTerminals();
    } catch (err) {
      toast.error(err.response?.data?.message || "Qurilmani o'chirishda xatolik");
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Sub toolbar */}
      <div className="attendance-subtoolbar">
        <div className="attendance-toolbar-left">
          <button
            type="button"
            className={`attendance-pill ${activeSection === 'davomat' ? 'active' : ''}`}
            onClick={() => setActiveSection('davomat')}
          >
            <Users size={15} strokeWidth={2.25} /> Xodimlar ma'lumotlari
          </button>
          <button
            type="button"
            className={`attendance-pill ${activeSection === 'topshiriqlar' ? 'active' : ''}`}
            onClick={() => setActiveSection('topshiriqlar')}
          >
            <ClipboardList size={15} strokeWidth={2.25} /> Topshiriqlar
          </button>
        </div>
        <div className="attendance-toolbar-right">
          {activeSection === 'davomat' && (
            <>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
              <button type="button" className="attendance-pill" onClick={handleOpenFilter}>
                <Filter size={15} strokeWidth={2.25} /> Filtr
              </button>
              <Button
                variant="primary"
                className="attendance-primary-btn"
                icon={<Plus size={16} strokeWidth={2.5} />}
                onClick={handleOpenManualAttendance}
              >
                Qo'lda davomat yaratish
              </Button>
            </>
          )}
          {activeSection === 'topshiriqlar' && (
            <Button
              variant="primary"
              className="attendance-primary-btn"
              icon={<Plus size={16} strokeWidth={2.5} />}
              onClick={handleOpenNewTask}
            >
              Yangi topshiriq yaratish
            </Button>
          )}
        </div>
      </div>

      {activeSection === 'davomat' && (
        <>
          {/* Stats */}
          <div className="stats-grid attendance-stats-grid mb-6">
            <StatsCard label="Barchasi" value={total} icon={<Briefcase size={20} strokeWidth={2} />} iconColor="emerald" />
            <StatsCard label="Ishda" value={attendanceStats.ishda} icon={<Briefcase size={20} strokeWidth={2} />} iconColor="blue" />
            <StatsCard label="Kech kelgan" value={attendanceStats.kechKelgan} icon={<Briefcase size={20} strokeWidth={2} />} iconColor="amber" />
            <StatsCard label="Ishda emas" value={attendanceStats.ishdaEmas} icon={<Briefcase size={20} strokeWidth={2} />} iconColor="rose" />
          </div>

          {/* Arizalar */}
          <Card className="mb-6" style={{ padding: 0 }}>
            <div className="attendance-section-header">
              <div className="attendance-section-header-title">
                <h3>Arizalar</h3>
                <button
                  type="button"
                  className="attendance-toggle-btn"
                  onClick={() => setIsArizalarOpen((prev) => !prev)}
                  title={isArizalarOpen ? 'Yig\'ish' : 'Yoyish'}
                >
                  {isArizalarOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button type="button" className="attendance-toggle-btn accent" title="Kengaytirish">
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
            {isArizalarOpen && (
              <p className="attendance-muted-center">Kutilayotgan arizalar yo'q</p>
            )}
          </Card>

          {/* Davomat */}
          <Card style={{ padding: 0 }}>
            {detailEmployee ? (
              <>
                <div className="attendance-detail-header">
                  <button
                    type="button"
                    className="attendance-toggle-btn"
                    onClick={() => setDetailEmployee(null)}
                    title="Orqaga"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div className="attendance-detail-title">
                      {detailEmployee.first_name} {detailEmployee.last_name}
                      {detailEmployee.current_presence && (
                        <span className={`attendance-presence-badge ${detailEmployee.current_presence === 'ichkarida' ? 'inside' : 'outside'}`}>
                          {detailEmployee.current_presence === 'ichkarida'
                            ? <DoorOpen size={13} strokeWidth={2.25} />
                            : <DoorClosed size={13} strokeWidth={2.25} />}
                          {detailEmployee.current_presence === 'ichkarida' ? 'Ichkarida' : 'Tashqarida'}
                        </span>
                      )}
                    </div>
                    <div className="attendance-detail-subtitle">
                      {format(selectedDate, 'yyyy-MM-dd')} ga tegishli belgilar
                    </div>
                  </div>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vaqt</th>
                        <th>Faoliyat</th>
                        <th>Holati</th>
                        <th>Izohlar</th>
                        <th>Manba</th>
                        <th>Tasdiqlash</th>
                      </tr>
                    </thead>
                    {(recordsByEmployee[detailEmployee.id] || []).length > 0 && (
                      <tbody>
                        {(recordsByEmployee[detailEmployee.id] || []).map((record) => {
                          return (
                            <tr key={record.id}>
                              <td>{format(new Date(record.recorded_at), 'HH:mm')}</td>
                              <td>{record.type === 'keldi' ? 'Keldi' : 'Ketdi'}</td>
                              <td>
                                {record.type === 'keldi' ? (
                                  record.is_late === null || record.is_late === undefined ? (
                                    <Badge variant="info" title="Xodimning biriktirilgan jadvali bu kunni dam olish kuni deb belgilagan">
                                      <CalendarOff size={12} strokeWidth={2.25} /> Dam olish kuni
                                    </Badge>
                                  ) : record.is_late && record.is_after_hours ? (
                                    <Badge variant="info" title="Ish kuni allaqachon tugagandan keyin kelgan">
                                      <LogIn size={12} strokeWidth={2.25} /> Keldi
                                    </Badge>
                                  ) : (
                                    <Badge variant={record.is_late ? 'warning' : 'success'}>
                                      <LogIn size={12} strokeWidth={2.25} /> {record.is_late ? 'Kech keldi' : 'Vaqtida keldi'}
                                    </Badge>
                                  )
                                ) : (
                                  record.is_early_leave === null || record.is_early_leave === undefined ? (
                                    <Badge variant="info" title="Xodimning biriktirilgan jadvali bu kunni dam olish kuni deb belgilagan">
                                      <CalendarOff size={12} strokeWidth={2.25} /> Dam olish kuni
                                    </Badge>
                                  ) : (
                                    <Badge variant={record.is_early_leave ? 'warning' : 'success'}>
                                      <LogOut size={12} strokeWidth={2.25} /> {record.is_early_leave ? 'Erta ketdi' : 'Vaqtida ketdi'}
                                    </Badge>
                                  )
                                )}
                              </td>
                              <td>
                                {record.notes ? (
                                  <Badge variant={getNoteBadgeVariant(record.notes)}>{record.notes}</Badge>
                                ) : '-'}
                              </td>
                              <td>
                                <Badge variant="info">
                                  {record.source === 'manual' ? "Qo'lda" : 'Qurilma'}
                                </Badge>
                              </td>
                              <td>
                                {record.source === 'manual' && canDeleteAttendance ? (
                                  <button
                                    type="button"
                                    className="attendance-toggle-btn"
                                    title="O'chirish"
                                    style={{ color: 'var(--error)' }}
                                    onClick={() => handleDeleteAttendanceRecord(record.id)}
                                  >
                                    <X size={14} />
                                  </button>
                                ) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    )}
                  </table>
                </div>

                {(recordsByEmployee[detailEmployee.id] || []).length === 0 && (
                  <EmptyState
                    icon="📦"
                    title="Belgilar topilmadi"
                    text=""
                  />
                )}

                <div className="attendance-table-footer">
                  <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                    <Settings size={15} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="attendance-section-header">
                  <div className="attendance-section-header-title">
                    <h3>Davomat</h3>
                  </div>
                </div>

            {loading ? (
              <LoadingSpinner text="Yuklanmoqda..." />
            ) : employees.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="Xodimlar topilmadi"
                text="Davomat ko'rsatish uchun avval xodimlar qo'shing."
              />
            ) : (
              <>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Xodim</th>
                        <th>Kirish</th>
                        <th>Chiqish</th>
                        <th>Jami</th>
                        <th>Qo'shimcha</th>
                        <th>Filial</th>
                        <th>Holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => {
                        const summary = getAttendanceSummary(emp.id);
                        return (
                        <tr key={emp.id}>
                          <td>
                            <div className="attendance-employee-cell">
                              {emp.photo_url ? (
                                <img
                                  className="attendance-avatar"
                                  src={employeeService.getPhotoUrl(emp.photo_url)}
                                  alt={`${emp.first_name} ${emp.last_name}`}
                                />
                              ) : (
                                <div className="attendance-avatar-fallback">
                                  {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                                </div>
                              )}
                              <div>
                                <div className="attendance-employee-name" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                  {emp.first_name} {emp.last_name}
                                  {emp.person_id ? (
                                    <span
                                      className="attendance-person-id-badge"
                                      title="Kamera Person ID"
                                    >
                                      ID: {emp.person_id}
                                    </span>
                                  ) : (
                                    <span
                                      className="attendance-person-id-badge attendance-person-id-badge--missing"
                                      title="Kameraga bog'lanmagan — Person ID kiritilmagan"
                                    >
                                      ID yo'q
                                    </span>
                                  )}
                                </div>
                                {emp.position && (
                                  <div className="attendance-employee-role">{emp.position}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{summary.kirish}</td>
                          <td>{summary.chiqish}</td>
                          <td>{summary.jami}</td>
                          <td>-</td>
                          <td>
                            <div className="attendance-branch-cell">
                              <Building2 size={14} strokeWidth={2.25} /> {emp.branch || '-'}
                            </div>
                          </td>
                          <td>
                            <div className="attendance-status-cell">
                              {summary.status === 'none' && <Badge variant="error">Kelmagan</Badge>}
                              {summary.status === 'present' && (
                                <Badge variant={summary.isLate ? 'warning' : 'info'}>
                                  {summary.isLate ? 'Kech keldi' : 'Ishda'}
                                </Badge>
                              )}
                              {summary.status === 'done' && (
                                <Badge variant={summary.isLate ? 'warning' : 'success'}>
                                  {summary.isLate ? 'Kech keldi' : 'Keldi'}
                                </Badge>
                              )}
                              <button
                                type="button"
                                className="attendance-toggle-btn"
                                title="Batafsil"
                                onClick={() => { setDetailEmployee(emp); refreshAttendance(); }}
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="attendance-table-footer">
                  <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                    <Settings size={15} />
                  </button>
                </div>
              </>
            )}
              </>
            )}
          </Card>
        </>
      )}

      {activeSection === 'topshiriqlar' && (
        /* Topshiriqlar */
        <Card style={{ padding: 0 }}>
          <div className="attendance-tasks-header">
            <div className="attendance-tasks-tabs">
              <button
                type="button"
                className={`attendance-tab ${tasksTab === 'all' ? 'active' : ''}`}
                onClick={() => setTasksTab('all')}
              >
                <LayoutList size={15} strokeWidth={2.25} /> Barcha topshiriqlar
              </button>
              <button
                type="button"
                className={`attendance-tab ${tasksTab === 'history' ? 'active' : ''}`}
                onClick={() => setTasksTab('history')}
              >
                <History size={15} strokeWidth={2.25} /> Topshiriqlar tarixi
              </button>
            </div>
            <div className="attendance-tasks-filters">
              {[
                { value: 'past', label: 'Past', tone: 'low', icon: Sun },
                { value: 'orta', label: "O'rta", tone: 'medium', icon: CloudSun },
                { value: 'yuqori', label: 'Yuqori', tone: 'high', icon: Zap },
              ].map((p) => {
                const active = taskPriorityFilter === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`attendance-priority-pill ${p.tone} ${active ? 'active' : ''}`}
                    onClick={() => toggleTaskPriorityFilter(p.value)}
                  >
                    <p.icon size={14} strokeWidth={2.25} /> {p.label}
                    {active && (
                      <span className="attendance-priority-pill-remove">
                        <X size={11} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
              <button type="button" className="attendance-toggle-btn lg" title="Kengaytirish">
                <Maximize2 size={15} />
              </button>
              <button type="button" className="attendance-toggle-btn lg" title="Sozlamalar">
                <Settings size={15} />
              </button>
            </div>
          </div>

          <div className="attendance-tasks-body">
            <PackageX size={64} strokeWidth={1.25} className="attendance-empty-icon" />
            <p className="attendance-empty-title">
              {tasksTab === 'all' ? "Topshiriqlar yo'q" : 'Tarix bo\'sh'}
            </p>
            {tasksTab === 'all' && (
              <Button
                variant="primary"
                className="attendance-primary-btn"
                icon={<Plus size={16} strokeWidth={2.5} />}
                onClick={handleOpenNewTask}
              >
                Yangi topshiriq yaratish
              </Button>
            )}
          </div>
        </Card>
      )}

      {activeSection === 'monitoring' && (
        /* Monitoring */
        <>
          <Card className="mb-6" style={{ padding: 0 }}>
            <div className="attendance-tasks-header">
              <div className="attendance-tasks-tabs">
                <button
                  type="button"
                  className={`attendance-tab ${monitoringTab === 'hisobotlar' ? 'active' : ''}`}
                  onClick={() => setMonitoringTab('hisobotlar')}
                >
                  <FileText size={15} strokeWidth={2.25} /> Hisobotlar
                </button>
                <button
                  type="button"
                  className={`attendance-tab ${monitoringTab === 'analitika' ? 'active' : ''}`}
                  onClick={() => setMonitoringTab('analitika')}
                >
                  <BarChart3 size={15} strokeWidth={2.25} /> Analitika
                </button>
                <button
                  type="button"
                  className={`attendance-tab ${monitoringTab === 'terminallar' ? 'active' : ''}`}
                  onClick={() => setMonitoringTab('terminallar')}
                >
                  <Smartphone size={15} strokeWidth={2.25} /> Terminallar
                </button>
              </div>

              {monitoringTab === 'analitika' && (
                <button type="button" className="attendance-pill" onClick={handleOpenFilter}>
                  <Filter size={15} strokeWidth={2.25} /> Filtr
                </button>
              )}

              {monitoringTab === 'terminallar' && (
                <div className="attendance-terminal-clock">
                  <span className="attendance-terminal-clock-text">
                    {formatTerminalClock(terminalClock)}
                  </span>
                  <button type="button" className="attendance-pill" onClick={refreshTerminals} disabled={isTerminalsLoading}>
                    <RefreshCw size={15} strokeWidth={2.25} /> Ro'yxatni yangilash
                  </button>
                  <Button
                    variant="primary"
                    className="attendance-primary-btn"
                    icon={<Plus size={16} strokeWidth={2.5} />}
                    onClick={openCreateDevicePanel}
                  >
                    Qurilma yaratish
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {monitoringTab === 'hisobotlar' && (
            <div className="attendance-reports-stack">
              <Card className="mb-6">
              <div className="attendance-report-title">
                <FileText size={18} strokeWidth={2.25} />
                <h3>Davomat hisoboti</h3>
              </div>

              <div className="candidate-form-grid">
                <Select
                  label="Yil"
                  name="reportYear"
                  value={reportForm.year}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, year: e.target.value }))}
                  options={yearOptions}
                  placeholder={null}
                />
                <Select
                  label="Oy"
                  name="reportMonth"
                  value={reportForm.month}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, month: e.target.value }))}
                  options={monthOptions}
                  placeholder={null}
                />
                <div className="form-group">
                  <label className="form-label">Filiallar</label>
                  <SearchableSelect
                    options={branchOptions}
                    selected={reportForm.branches}
                    onChange={(branches) => setReportForm((prev) => ({ ...prev, branches }))}
                    icon={Building2}
                    iconColor="var(--text-secondary)"
                    placeholder="Filiallarni tanlang"
                    multiple
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bo'limlar</label>
                  <SearchableSelect
                    options={departmentOptions}
                    selected={reportForm.departments}
                    onChange={(departments) => setReportForm((prev) => ({ ...prev, departments }))}
                    icon={LayoutGrid}
                    iconColor="var(--text-secondary)"
                    placeholder="Bo'limlarni tanlang"
                    multiple
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jadvallar</label>
                  <SearchableSelect
                    options={SCHEDULE_OPTIONS}
                    selected={reportForm.schedules}
                    onChange={(schedules) => setReportForm((prev) => ({ ...prev, schedules }))}
                    icon={ShieldAlert}
                    iconColor="#f59e0b"
                    placeholder="Jadvallarni tanlang"
                    multiple
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Lavozimlar</label>
                  <SearchableSelect
                    options={positionOptions}
                    selected={reportForm.positions}
                    onChange={(positions) => setReportForm((prev) => ({ ...prev, positions }))}
                    icon={Briefcase}
                    iconColor="var(--text-secondary)"
                    placeholder="Lavozimlarni tanlang"
                    multiple
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Xodimlar</label>
                  <SearchableSelect
                    options={employeeOptions}
                    selected={reportForm.employeeId}
                    onChange={(employeeId) => setReportForm((prev) => ({ ...prev, employeeId }))}
                    icon={Users}
                    iconColor="var(--text-secondary)"
                    placeholder="Xodimlarni tanlang"
                  />
                </div>
              </div>

              <div className="attendance-report-fields">
                <span className="attendance-report-fields-label">Kiritiladigan maydonlar</span>
                <div className="attendance-report-fields-list">
                  {REPORT_FIELDS.map((field) => {
                    const checked = reportForm.fields.includes(field.value);
                    return (
                      <label
                        key={field.value}
                        className={`attendance-check-pill ${checked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReportField(field.value)}
                        />
                        <span className="attendance-check-dot" />
                        {field.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="attendance-report-actions">
                <Button
                  variant="primary"
                  className="attendance-primary-btn"
                  icon={<FileText size={16} strokeWidth={2.5} />}
                  onClick={handleGenerateReport}
                  disabled={isReportLoading}
                >
                  {isReportLoading ? 'Tayyorlanmoqda...' : "Hisobotni ko'rish"}
                </Button>
              </div>

              <AttendanceReportTable results={reportResults} fields={reportForm.fields} isLoading={isReportLoading} />
              </Card>

              <Card>
                <div className="attendance-report-title">
                  <Wallet size={18} strokeWidth={2.25} />
                  <h3>Ish haqi hisoboti</h3>
                </div>

                <div className="candidate-form-grid">
                  <div className="form-group">
                    <label className="form-label">Boshlanish sanasi</label>
                    <DatePicker
                      trigger="field"
                      value={payrollForm.startDate}
                      onChange={(startDate) => setPayrollForm((prev) => ({ ...prev, startDate }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tugash sanasi</label>
                    <DatePicker
                      trigger="field"
                      value={payrollForm.endDate}
                      onChange={(endDate) => setPayrollForm((prev) => ({ ...prev, endDate }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Filiallar</label>
                    <SearchableSelect
                      options={branchOptions}
                      selected={payrollForm.branches}
                      onChange={(branches) => setPayrollForm((prev) => ({ ...prev, branches }))}
                      icon={Building2}
                      iconColor="var(--text-secondary)"
                      placeholder="Filiallarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bo'limlar</label>
                    <SearchableSelect
                      options={departmentOptions}
                      selected={payrollForm.departments}
                      onChange={(departments) => setPayrollForm((prev) => ({ ...prev, departments }))}
                      icon={LayoutGrid}
                      iconColor="var(--text-secondary)"
                      placeholder="Bo'limlarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jadvallar</label>
                    <SearchableSelect
                      options={SCHEDULE_OPTIONS}
                      selected={payrollForm.schedules}
                      onChange={(schedules) => setPayrollForm((prev) => ({ ...prev, schedules }))}
                      icon={ShieldAlert}
                      iconColor="#f59e0b"
                      placeholder="Jadvallarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lavozimlar</label>
                    <SearchableSelect
                      options={positionOptions}
                      selected={payrollForm.positions}
                      onChange={(positions) => setPayrollForm((prev) => ({ ...prev, positions }))}
                      icon={Briefcase}
                      iconColor="var(--text-secondary)"
                      placeholder="Lavozimlarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Xodimlar</label>
                    <SearchableSelect
                      options={employeeOptions}
                      selected={payrollForm.employeeId}
                      onChange={(employeeId) => setPayrollForm((prev) => ({ ...prev, employeeId }))}
                      icon={Users}
                      iconColor="var(--text-secondary)"
                      placeholder="Xodimlarni tanlang"
                    />
                  </div>
                </div>

                <div className="attendance-report-actions">
                  <Button
                    variant="primary"
                    className="attendance-primary-btn"
                    icon={<Download size={16} strokeWidth={2.5} />}
                    onClick={handleGeneratePayrollReport}
                  >
                    Hisobotni yuklash
                  </Button>
                </div>

                {isPayrollReportGenerated && (
                  <EmptyState
                    icon="💰"
                    title="Bu davr uchun ma'lumot topilmadi"
                    text="Filtrlarni o'zgartirib qayta urinib ko'ring."
                  />
                )}
              </Card>

              <Card>
                <div className="attendance-report-title">
                  <CalendarDays size={18} strokeWidth={2.25} />
                  <h3>Davomat hisoboti (Davr bo'yicha)</h3>
                </div>

                <div className="candidate-form-grid">
                  <div className="form-group">
                    <label className="form-label">Boshlanish sanasi</label>
                    <DatePicker
                      trigger="field"
                      value={periodReportForm.startDate}
                      onChange={(startDate) => setPeriodReportForm((prev) => ({ ...prev, startDate }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tugash sanasi</label>
                    <DatePicker
                      trigger="field"
                      value={periodReportForm.endDate}
                      onChange={(endDate) => setPeriodReportForm((prev) => ({ ...prev, endDate }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Filiallar</label>
                    <SearchableSelect
                      options={branchOptions}
                      selected={periodReportForm.branches}
                      onChange={(branches) => setPeriodReportForm((prev) => ({ ...prev, branches }))}
                      icon={Building2}
                      iconColor="var(--text-secondary)"
                      placeholder="Filiallarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bo'limlar</label>
                    <SearchableSelect
                      options={departmentOptions}
                      selected={periodReportForm.departments}
                      onChange={(departments) => setPeriodReportForm((prev) => ({ ...prev, departments }))}
                      icon={LayoutGrid}
                      iconColor="var(--text-secondary)"
                      placeholder="Bo'limlarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jadvallar</label>
                    <SearchableSelect
                      options={SCHEDULE_OPTIONS}
                      selected={periodReportForm.schedules}
                      onChange={(schedules) => setPeriodReportForm((prev) => ({ ...prev, schedules }))}
                      icon={ShieldAlert}
                      iconColor="#f59e0b"
                      placeholder="Jadvallarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lavozimlar</label>
                    <SearchableSelect
                      options={positionOptions}
                      selected={periodReportForm.positions}
                      onChange={(positions) => setPeriodReportForm((prev) => ({ ...prev, positions }))}
                      icon={Briefcase}
                      iconColor="var(--text-secondary)"
                      placeholder="Lavozimlarni tanlang"
                      multiple
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Xodimlar</label>
                    <SearchableSelect
                      options={employeeOptions}
                      selected={periodReportForm.employeeId}
                      onChange={(employeeId) => setPeriodReportForm((prev) => ({ ...prev, employeeId }))}
                      icon={Users}
                      iconColor="var(--text-secondary)"
                      placeholder="Xodimlarni tanlang"
                    />
                  </div>
                </div>

                <div className="attendance-report-fields">
                  <span className="attendance-report-fields-label">Kiritiladigan maydonlar</span>
                  <div className="attendance-report-fields-list">
                    {REPORT_FIELDS.map((field) => {
                      const checked = periodReportForm.fields.includes(field.value);
                      return (
                        <label
                          key={field.value}
                          className={`attendance-check-pill ${checked ? 'checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePeriodReportField(field.value)}
                          />
                          <span className="attendance-check-dot" />
                          {field.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="attendance-report-actions">
                  <Button
                    variant="primary"
                    className="attendance-primary-btn"
                    icon={<Download size={16} strokeWidth={2.5} />}
                    onClick={handleGeneratePeriodReport}
                    disabled={isPeriodReportLoading}
                  >
                    {isPeriodReportLoading ? 'Tayyorlanmoqda...' : 'Hisobotni yuklash'}
                  </Button>
                </div>

                <AttendanceReportTable results={periodReportResults} fields={periodReportForm.fields} isLoading={isPeriodReportLoading} />
              </Card>
            </div>
          )}

          {monitoringTab === 'analitika' && (
            <div className="attendance-analytics">
              <Card className="mb-6">
                <div className="attendance-report-title">
                  <BarChart3 size={18} strokeWidth={2.25} />
                  <div>
                    <h3>Xodimlar davomat grafigi</h3>
                    <p className="attendance-analytics-subtitle">Xodimlar davomatidagi trendlarni kuzating</p>
                  </div>
                </div>

                <TrendChart data={trendData} series={TREND_SERIES} />
              </Card>

              <div className="attendance-analytics-grid">
                {ANALYTICS_RANKINGS.map((ranking) => (
                  <Card key={ranking.key}>
                    <div className="attendance-ranking-header">
                      <span className={`attendance-ranking-icon ${ranking.tone}`}>
                        <Clock size={18} strokeWidth={2.25} />
                      </span>
                      <div>
                        <div className="attendance-ranking-title">{ranking.title}</div>
                        <div className="attendance-ranking-subtitle">{ranking.subtitle}</div>
                      </div>
                    </div>
                    <div className="attendance-ranking-body">
                      {rankingsData[ranking.key].length === 0 ? (
                        <p className="attendance-muted-center">
                          {isAnalyticsLoading ? 'Yuklanmoqda...' : "Ma'lumot yo'q"}
                        </p>
                      ) : (
                        <>
                          <div className="attendance-ranking-list">
                            {(expandedRankings[ranking.key]
                              ? rankingsData[ranking.key]
                              : rankingsData[ranking.key].slice(0, 3)
                            ).map((item, idx) => (
                              <div className="attendance-ranking-row" key={`${ranking.key}-${item.employeeId}-${idx}`}>
                                {item.photoUrl ? (
                                  <img
                                    className="attendance-ranking-avatar"
                                    src={employeeService.getPhotoUrl(item.photoUrl)}
                                    alt={item.name}
                                  />
                                ) : (
                                  <div className="attendance-ranking-avatar-fallback">
                                    {item.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                                  </div>
                                )}
                                <div className="attendance-ranking-row-info">
                                  <div className="attendance-ranking-row-name">{item.name}</div>
                                  {item.position && <div className="attendance-ranking-row-position">{item.position}</div>}
                                </div>
                                <Badge variant={ranking.tone === 'success' ? 'success' : ranking.tone === 'warning' ? 'warning' : 'error'}>
                                  {item.count} marta
                                </Badge>
                              </div>
                            ))}
                          </div>

                          {rankingsData[ranking.key].length > 3 && (
                            <button
                              type="button"
                              className="attendance-ranking-more"
                              onClick={() => setExpandedRankings((prev) => ({ ...prev, [ranking.key]: !prev[ranking.key] }))}
                            >
                              {expandedRankings[ranking.key] ? 'Kamroq ko\'rsatish' : "Ko'proq ko'rsatish"}
                              <ChevronRight size={14} strokeWidth={2.5} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {monitoringTab === 'terminallar' && (
            <Card style={{ padding: 0 }}>
              <div className="attendance-section-header">
                <div className="attendance-section-header-title">
                  <h3>Terminallar</h3>
                  <p className="attendance-analytics-subtitle">
                    Kameradan haqiqatda kelgan so'rovlar asosida — qo'shimcha sozlash shart emas.
                  </p>
                </div>
              </div>

              {isTerminalsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>
              ) : terminals.length === 0 ? (
                <EmptyState
                  icon={<Smartphone size={44} strokeWidth={1.5} />}
                  title="Hali qurilma yo'q"
                  text={'"Qurilma yaratish" tugmasi orqali yangi terminal qo\'shing — token avtomatik generatsiya qilinadi.'}
                />
              ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nomi</th>
                        <th>Qurilma tokeni</th>
                        <th>Holati</th>
                        <th>Oxirgi faollik</th>
                        <th>Hodisalar (30 kun)</th>
                        <th>Tanilgan xodimlar</th>
                        <th style={{ textAlign: 'right' }}>Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terminals.map((t) => (
                        <tr key={t.deviceToken}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <div className="attendance-device-icon">
                                <Smartphone size={16} strokeWidth={2} />
                              </div>
                              {t.name ? (
                                <span className="font-semibold">{t.name}</span>
                              ) : (
                                <Badge variant="info" title="Bu token 'Qurilma yaratish' orqali ro'yxatdan o'tmagan, kameradan avtomatik aniqlangan">
                                  Ro'yxatdan o'tmagan
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="attendance-token-chip"
                              onClick={() => handleCopyToken(t.deviceToken)}
                              title="Nusxalash"
                            >
                              <code>{t.deviceToken}</code>
                              <Copy size={13} strokeWidth={2.25} />
                            </button>
                          </td>
                          <td>
                            {!t.lastSeen ? (
                              <Badge variant="warning">Kutilmoqda</Badge>
                            ) : (
                              <Badge variant={t.isOnline ? 'success' : 'error'}>
                                {t.isOnline ? 'Faol' : 'Nofaol'}
                              </Badge>
                            )}
                          </td>
                          <td>{t.lastSeen ? format(new Date(t.lastSeen), 'yyyy-MM-dd HH:mm:ss') : '-'}</td>
                          <td>{t.events30d} ({t.accessEvents30d} tanilgan)</td>
                          <td>{t.matchedEmployees}</td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                              {t.id ? (
                                <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDeleteDevice(t)} title="O'chirish">
                                  <Trash2 size={16} strokeWidth={2} />
                                </Button>
                              ) : '-'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="attendance-table-footer">
                <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                  <Settings size={15} />
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {activeSection === 'moliya' && (
        /* Moliya */
        <>
          <Card className="mb-6" style={{ padding: 0 }}>
            <div className="attendance-tasks-header">
              <div className="attendance-tasks-tabs">
                <button
                  type="button"
                  className={`attendance-tab ${moliyaTab === 'umumiy' ? 'active' : ''}`}
                  onClick={() => setMoliyaTab('umumiy')}
                >
                  <Wallet size={15} strokeWidth={2.25} /> Umumiy
                </button>
                <button
                  type="button"
                  className={`attendance-tab ${moliyaTab === 'tolovlar' ? 'active' : ''}`}
                  onClick={() => setMoliyaTab('tolovlar')}
                >
                  <ArrowUpRight size={15} strokeWidth={2.25} /> Ish haqi to'lovlari
                </button>
                <button
                  type="button"
                  className={`attendance-tab ${moliyaTab === 'jarimalar' ? 'active' : ''}`}
                  onClick={() => setMoliyaTab('jarimalar')}
                >
                  <AlertTriangle size={15} strokeWidth={2.25} /> Jarimalar
                </button>
              </div>

              {moliyaTab === 'umumiy' && (
                <MonthPicker value={moliyaMonth} onChange={setMoliyaMonth} />
              )}
              {moliyaTab === 'tolovlar' && (
                <div className="attendance-toolbar-right">
                  <button
                    type="button"
                    className="attendance-toggle-btn lg"
                    title="Filtr"
                    onClick={() => setIsMoliyaFilterOpen(true)}
                  >
                    <Filter size={16} strokeWidth={2.25} />
                  </button>
                  <Button
                    variant="primary"
                    className="attendance-primary-btn"
                    icon={<Plus size={16} strokeWidth={2.5} />}
                    onClick={handleOpenAddPayment}
                  >
                    Ish haqi to'lovini qo'shish
                  </Button>
                </div>
              )}
              {moliyaTab === 'jarimalar' && (
                <div className="attendance-toolbar-right">
                  <FineTypeCreateButton onCreate={handleCreateFineType} />
                  {isAssignedFinesOpen ? (
                    <>
                      <SearchableSelect
                        options={employeeOptions}
                        selected={assignedFinesEmployeeFilter}
                        onChange={setAssignedFinesEmployeeFilter}
                        icon={Users}
                        iconColor="var(--text-secondary)"
                        placeholder="Barchasi"
                      />
                      <button
                        type="button"
                        className="attendance-toggle-btn lg"
                        title="Filtr"
                        onClick={() => setIsMoliyaFilterOpen(true)}
                      >
                        <Filter size={16} strokeWidth={2.25} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="attendance-pill active"
                      title="Tayinlangan jarimalar ro'yxati"
                      onClick={() => setIsAssignedFinesOpen(true)}
                    >
                      <Eye size={15} strokeWidth={2.25} /> Tayinlangan jarimalar ro'yxati
                    </button>
                  )}
                  <Button
                    variant="primary"
                    className="attendance-primary-btn"
                    icon={<Plus size={16} strokeWidth={2.5} />}
                    onClick={handleOpenAddFine}
                  >
                    Jarima yaratish
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {moliyaTab === 'umumiy' && (
            <>
              <div className="finance-summary-grid">
                <div className="finance-summary-card blue">
                  <span className="finance-summary-icon">
                    <Wallet size={20} strokeWidth={2} />
                  </span>
                  <div>
                    <div className="finance-summary-label">Jami ish haqi</div>
                    <div className="finance-summary-value">{formatUZS(totalSalary)}</div>
                  </div>
                </div>
                <div className="finance-summary-card green">
                  <span className="finance-summary-icon">
                    <PiggyBank size={20} strokeWidth={2} />
                  </span>
                  <div>
                    <div className="finance-summary-label">Jami qoldiq</div>
                    <div className="finance-summary-value">{formatUZS(totalQoldiq)}</div>
                  </div>
                </div>
              </div>

              <Card style={{ padding: 0 }}>
                <div className="attendance-section-header">
                  <div className="attendance-section-header-title">
                    <h3>Umumiy</h3>
                  </div>
                </div>

                <div className="finance-filters-row">
                  <SearchableSelect
                    options={departmentOptions}
                    selected={moliyaFilters.department}
                    onChange={(department) => setMoliyaFilters((prev) => ({ ...prev, department }))}
                    icon={LayoutGrid}
                    iconColor="var(--text-secondary)"
                    placeholder="Bo'limlar"
                  />
                  <SearchableSelect
                    options={positionOptions}
                    selected={moliyaFilters.position}
                    onChange={(position) => setMoliyaFilters((prev) => ({ ...prev, position }))}
                    icon={Briefcase}
                    iconColor="var(--text-secondary)"
                    placeholder="Lavozimlar"
                  />
                  <SearchableSelect
                    options={branchOptions}
                    selected={moliyaFilters.branch}
                    onChange={(branch) => setMoliyaFilters((prev) => ({ ...prev, branch }))}
                    icon={Building2}
                    iconColor="var(--text-secondary)"
                    placeholder="Filiallar"
                  />
                  <button
                    type="button"
                    className={`attendance-pill ${moliyaFilters.qarziBor ? 'active' : ''}`}
                    onClick={() => setMoliyaFilters((prev) => ({ ...prev, qarziBor: !prev.qarziBor }))}
                  >
                    <AlertTriangle size={15} strokeWidth={2.25} /> Qarzi bor
                  </button>
                  <div className="finance-search">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Xodimni qidirish"
                      value={moliyaFilters.search}
                      onChange={(e) => setMoliyaFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                </div>

                {loading ? (
                  <LoadingSpinner text="Yuklanmoqda..." />
                ) : filteredFinanceRows.length === 0 ? (
                  <EmptyState
                    icon="💰"
                    title="Xodim topilmadi"
                    text="Filtrlarni o'zgartirib qayta urinib ko'ring."
                  />
                ) : (
                  <>
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Xodim</th>
                            <th>Asosiy ish haqi</th>
                            <th>Bonuslar</th>
                            <th>Jarimalar</th>
                            <th>Jami</th>
                            <th>To'langan</th>
                            <th>Qoldiq</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFinanceRows.map(({ emp, baseSalary, bonusTotal, fineTotal, jami, paidTotal, qoldiq }) => (
                            <tr key={emp.id} className={qoldiq > 0 ? 'finance-debt-row' : ''}>
                              <td>
                                <div className="attendance-employee-cell">
                                  {emp.photo_url ? (
                                    <img
                                      className="attendance-avatar"
                                      src={employeeService.getPhotoUrl(emp.photo_url)}
                                      alt={`${emp.first_name} ${emp.last_name}`}
                                    />
                                  ) : (
                                    <div className="attendance-avatar-fallback">
                                      {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                                    </div>
                                  )}
                                  <div>
                                    <div className="attendance-employee-name">
                                      {emp.first_name} {emp.last_name}
                                    </div>
                                    {emp.position && (
                                      <div className="attendance-employee-role">{emp.position}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>{formatUZS(baseSalary)}</td>
                              <td>
                                <div className="finance-cell-amount">
                                  <button
                                    type="button"
                                    className="finance-amount-link"
                                    onClick={() => openFinancePanel(emp.id, 'bonus')}
                                  >
                                    {formatUZS(bonusTotal)} <ArrowUpRight size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="finance-add-btn"
                                    title="Bonus qo'shish"
                                    onClick={() => openFinancePanel(emp.id, 'bonus')}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </td>
                              <td>
                                <div className="finance-cell-amount">
                                  <button
                                    type="button"
                                    className="finance-amount-link fine"
                                    onClick={() => openFinancePanel(emp.id, 'fine')}
                                  >
                                    {formatUZS(fineTotal)} <ArrowUpRight size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="finance-add-btn"
                                    title="Jarima qo'shish"
                                    onClick={() => openFinancePanel(emp.id, 'fine')}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </td>
                              <td>{formatUZS(jami)}</td>
                              <td>
                                <div className="finance-cell-amount">
                                  <button
                                    type="button"
                                    className="finance-amount-link"
                                    onClick={() => openFinancePanel(emp.id, 'payment')}
                                  >
                                    {formatUZS(paidTotal)} <ArrowUpRight size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="finance-add-btn"
                                    title="To'lov qilish"
                                    onClick={() => openFinancePanel(emp.id, 'payment')}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </td>
                              <td className={qoldiq > 0 ? 'finance-fine-value' : ''}>{formatUZS(qoldiq)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="attendance-table-footer">
                      <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                        <Settings size={15} />
                      </button>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}

          {moliyaTab === 'tolovlar' && (
            <Card style={{ padding: 0 }}>
              <div className="attendance-section-header">
                <div className="attendance-section-header-title">
                  <h3>Ish haqi to'lovlari</h3>
                </div>
              </div>
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Xodim</th>
                      <th>Miqdor</th>
                      <th>Oy</th>
                      <th>Yil</th>
                      <th>Yaratilgan vaqt</th>
                    </tr>
                  </thead>
                  {allPayments.length > 0 && (
                    <tbody>
                      {allPayments.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="attendance-employee-cell">
                              {p.emp.photo_url ? (
                                <img
                                  className="attendance-avatar"
                                  src={employeeService.getPhotoUrl(p.emp.photo_url)}
                                  alt={`${p.emp.first_name} ${p.emp.last_name}`}
                                />
                              ) : (
                                <div className="attendance-avatar-fallback">
                                  {(p.emp.first_name?.[0] || '') + (p.emp.last_name?.[0] || '')}
                                </div>
                              )}
                              <div>
                                <div className="attendance-employee-name">
                                  {p.emp.first_name} {p.emp.last_name}
                                </div>
                                {p.emp.position && (
                                  <div className="attendance-employee-role">{p.emp.position}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="finance-payment-amount">
                              <ArrowUpRight size={14} strokeWidth={2.5} /> {formatUZS(p.amount)}
                            </span>
                          </td>
                          <td>
                            <span className="finance-payment-month-pill">
                              {UZ_MONTHS[moliyaMonth.getMonth()]}
                            </span>
                          </td>
                          <td>{moliyaMonth.getFullYear()}</td>
                          <td>
                            <span className="finance-payment-time">
                              <Clock size={13} strokeWidth={2.25} /> {format(p.date, 'dd.MM.yyyy HH:mm')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
              {allPayments.length === 0 && (
                <EmptyState
                  icon="📦"
                  title="Ish haqi to'lovlari topilmadi"
                  text=""
                />
              )}
              <div className="attendance-table-footer">
                <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                  <Settings size={15} />
                </button>
              </div>
            </Card>
          )}

          {moliyaTab === 'jarimalar' && !isAssignedFinesOpen && (
            <Card className="mb-6">
              <div className="attendance-section-header-title" style={{ marginBottom: '0.75rem' }}>
                <h3>Jazo turlari</h3>
              </div>
              {fineTypes.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {fineTypes.map((t) => {
                    const color = getFineTypeColor(t.id, fineTypes);
                    return (
                      <span
                        key={t.id}
                        className="fine-template-type-pill"
                        style={{ '--fine-pill-color': color, cursor: 'default' }}
                      >
                        <AlertTriangle size={13} strokeWidth={2.25} />
                        {t.name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  Hali jazo turi yaratilmagan — yuqoridagi "Jazo yaratish" tugmasi orqali qo'shing.
                </p>
              )}
            </Card>
          )}

          {moliyaTab === 'jarimalar' && !isAssignedFinesOpen && (
            <Card style={{ padding: 0 }}>
              <div className="attendance-section-header">
                <div className="attendance-section-header-title">
                  <h3>Jarima siyosatlari</h3>
                </div>
              </div>
              {isLoadingFinePolicies ? (
                <div style={{ padding: '2rem' }}><LoadingSpinner /></div>
              ) : (
                <>
                  <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Jarima nomi</th>
                          <th>Holat</th>
                          <th>Shablonlar</th>
                          <th>Jarima turlari</th>
                          <th>Yangilangan</th>
                          <th></th>
                        </tr>
                      </thead>
                      {finePolicies.length > 0 && (
                        <tbody>
                          {finePolicies.map((policy) => {
                            const uniqueViolationLabels = [...new Set(policy.templates.map((t) => t.violationType))]
                              .map((v) => FINE_TEMPLATE_TYPES.find((ft) => ft.value === v)?.label || v);
                            return (
                              <tr key={policy.id}>
                                <td>
                                  <div className="attendance-employee-name">{policy.name}</div>
                                </td>
                                <td>
                                  <Badge variant={policy.enabled ? 'success' : 'info'}>
                                    {policy.enabled ? 'Faol' : "O'chirilgan"}
                                  </Badge>
                                </td>
                                <td>{policy.templates.length}</td>
                                <td>
                                  {uniqueViolationLabels.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                      {uniqueViolationLabels.map((label) => (
                                        <Badge key={label} variant="error">{label}</Badge>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td>
                                  <span className="finance-payment-time">
                                    <Clock size={13} strokeWidth={2.25} /> {format(new Date(policy.updatedAt), 'dd.MM.yyyy HH:mm')}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      className="attendance-toggle-btn"
                                      title="Tahrirlash"
                                      onClick={() => handleEditFinePolicy(policy)}
                                    >
                                      <Pencil size={15} strokeWidth={2.25} />
                                    </button>
                                    <button
                                      type="button"
                                      className="attendance-toggle-btn"
                                      title="O'chirish"
                                      onClick={() => handleDeleteFinePolicy(policy)}
                                    >
                                      <Trash2 size={15} strokeWidth={2.25} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      )}
                    </table>
                  </div>
                  {finePolicies.length === 0 && (
                    <EmptyState
                      icon={<PackageX size={56} strokeWidth={1.25} />}
                      title="Jarima siyosatlari topilmadi"
                      text=""
                    />
                  )}
                </>
              )}
            </Card>
          )}

          {moliyaTab === 'jarimalar' && isAssignedFinesOpen && (
            <Card style={{ padding: 0 }}>
              <div className="attendance-detail-header">
                <button
                  type="button"
                  className="attendance-toggle-btn"
                  onClick={() => setIsAssignedFinesOpen(false)}
                  title="Orqaga"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <div className="attendance-detail-title">Tayinlangan jarimalar ro'yxati</div>
                  <div className="attendance-detail-subtitle">
                    Ish beruvchilarga tayinlangan jarimalarni ko'rish va boshqarish
                  </div>
                </div>
              </div>

              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sana</th>
                      <th>Xodim</th>
                      <th>Miqdor</th>
                      <th>Jarima turi</th>
                      <th>Tafsilotlar</th>
                      <th>Fayl</th>
                    </tr>
                  </thead>
                  {assignedFinesFiltered.length > 0 && (
                    <tbody>
                      {assignedFinesFiltered.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <span className="finance-payment-time">
                              <CalendarDays size={13} strokeWidth={2.25} /> {format(f.date, 'dd.MM.yyyy HH:mm')}
                            </span>
                          </td>
                          <td>
                            <div className="attendance-employee-cell">
                              {f.emp.photo_url ? (
                                <img
                                  className="attendance-avatar"
                                  src={employeeService.getPhotoUrl(f.emp.photo_url)}
                                  alt={f.empName}
                                />
                              ) : (
                                <div className="attendance-avatar-fallback">
                                  {(f.emp.first_name?.[0] || '') + (f.emp.last_name?.[0] || '')}
                                </div>
                              )}
                              <div className="attendance-employee-name">{f.empName}</div>
                            </div>
                          </td>
                          <td>
                            <Badge variant="error">{formatUZS(f.amount)}</Badge>
                          </td>
                          <td>
                            {f.note ? (
                              <Badge variant="warning">{f.note}</Badge>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="attendance-toggle-btn"
                              title="Fayl biriktirilmagan"
                              disabled
                            >
                              <Paperclip size={14} strokeWidth={2.25} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
              {assignedFinesFiltered.length === 0 && (
                <EmptyState
                  icon={<PackageX size={56} strokeWidth={1.25} />}
                  title="Tayinlangan jarimalar topilmadi"
                  text=""
                />
              )}
              <div className="attendance-table-footer">
                <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                  <Settings size={15} />
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      <SidePanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter"
        footer={
          <Button
            variant="primary"
            className="attendance-primary-btn"
            onClick={() => setIsFilterOpen(false)}
          >
            Saqlash
          </Button>
        }
      >
        <div className="candidate-form-grid">
          <div className="form-group">
            <label className="form-label">Filiallar</label>
            <SearchableSelect
              options={branchOptions}
              selected={filters.branch}
              onChange={(branch) => setFilters((prev) => ({ ...prev, branch }))}
              icon={Building2}
              iconColor="var(--text-secondary)"
              placeholder="Filiallarni tanlang"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Bo'limlar</label>
            <SearchableSelect
              options={departmentOptions}
              selected={filters.department}
              onChange={(department) => setFilters((prev) => ({ ...prev, department }))}
              icon={LayoutGrid}
              iconColor="var(--text-secondary)"
              placeholder="Bo'limlarni tanlang"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Jadvallar</label>
            <SearchableSelect
              options={SCHEDULE_OPTIONS}
              selected={filters.schedules}
              onChange={(schedules) => setFilters((prev) => ({ ...prev, schedules }))}
              icon={ShieldAlert}
              iconColor="#f59e0b"
              placeholder="Jadvallarni tanlang"
              multiple
            />
          </div>
          <div className="form-group">
            <label className="form-label">Lavozimlar</label>
            <SearchableSelect
              options={positionOptions}
              selected={filters.position}
              onChange={(position) => setFilters((prev) => ({ ...prev, position }))}
              icon={Briefcase}
              iconColor="var(--text-secondary)"
              placeholder="Lavozimlarni tanlang"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Xodimlar</label>
            <SearchableSelect
              options={employeeOptions}
              selected={filters.employeeId}
              onChange={(employeeId) => setFilters((prev) => ({ ...prev, employeeId }))}
              icon={Users}
              iconColor="var(--text-secondary)"
              placeholder="Xodimlarni tanlang"
            />
          </div>
          <div className="form-group form-group-full">
            <label className="form-label">Sana oralig'i</label>
            <div className="filter-date-range-row">
              <div style={{ flex: 1 }}>
                <DatePicker
                  trigger="field"
                  value={filters.startDate}
                  onChange={(startDate) => setFilters((prev) => ({ ...prev, startDate }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <DatePicker
                  trigger="field"
                  value={filters.endDate}
                  onChange={(endDate) => setFilters((prev) => ({ ...prev, endDate }))}
                />
              </div>
            </div>

            <div className="filter-preset-row">
              <button
                type="button"
                className="filter-preset-arrow"
                onClick={() => scrollPresets(-1)}
                aria-label="Chapga"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="filter-preset-scroll" ref={presetScrollRef}>
                {DATE_RANGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="filter-preset-pill"
                    onClick={() => applyDatePreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="filter-preset-arrow"
                onClick={() => scrollPresets(1)}
                aria-label="O'ngga"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </SidePanel>

      <SidePanel
        isOpen={isManualAttendanceOpen}
        onClose={() => setIsManualAttendanceOpen(false)}
        title="Qo'lda davomat yaratish"
        footer={
          <Button
            variant="primary"
            fullWidth
            className="attendance-primary-btn"
            disabled={!manualForm.employeeId || isSavingManualAttendance}
            loading={isSavingManualAttendance}
            onClick={handleSaveManualAttendance}
          >
            Saqlash
          </Button>
        }
      >
        <div className="candidate-form-grid mb-6">
          <div className="form-group">
            <label className="form-label">Xodim</label>
            <SearchableSelect
              options={employeeOptions}
              selected={manualForm.employeeId}
              onChange={(employeeId) => setManualForm((prev) => ({ ...prev, employeeId }))}
              icon={Users}
              iconColor="var(--text-secondary)"
              placeholder="Xodimni tanlang"
              searchPlaceholder="Qidiruv"
            />
          </div>
          <Select
            label="Filial"
            name="manualBranch"
            value={manualForm.branch}
            onChange={(e) => setManualForm((prev) => ({ ...prev, branch: e.target.value }))}
            options={branchOptions}
            placeholder="Filialni tanlang"
          />
          <div className="form-group">
            <label className="form-label">Sana</label>
            <DatePicker
              trigger="field"
              value={manualForm.date}
              onChange={(date) => setManualForm((prev) => ({ ...prev, date }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vaqt</label>
            <div className="attendance-time-field">
              <Clock size={15} strokeWidth={2.25} />
              <input
                type="time"
                value={manualForm.time}
                onChange={(e) => setManualForm((prev) => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="attendance-toggle-group mb-6">
          <button
            type="button"
            className={`attendance-toggle-option ${manualForm.type === 'kelish' ? 'active' : ''}`}
            onClick={() => setManualForm((prev) => ({ ...prev, type: 'kelish' }))}
          >
            Kelish
          </button>
          <button
            type="button"
            className={`attendance-toggle-option ${manualForm.type === 'ketish' ? 'active' : ''}`}
            onClick={() => setManualForm((prev) => ({ ...prev, type: 'ketish' }))}
          >
            Ketish
          </button>
        </div>

        <Textarea
          name="comment"
          placeholder="Izoh (Ixtiyoriy)"
          value={manualForm.comment}
          onChange={(e) => setManualForm((prev) => ({ ...prev, comment: e.target.value }))}
          rows={5}
        />
      </SidePanel>

      <SidePanel
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        title="Yangi topshiriq yaratish"
      >
        <Input
          label="Topshiriq nomi"
          name="taskName"
          value={taskForm.name}
          onChange={(e) => setTaskForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Topshiriq nomi"
          className="mb-6"
        />

        <Textarea
          label="Tavsif"
          name="taskDescription"
          value={taskForm.description}
          onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Tavsifni yozing"
          rows={4}
          className="mb-6"
        />

        <div className="form-group mb-6">
          <label className="form-label">Tugash sanasi</label>
          <DatePicker
            trigger="field"
            value={taskForm.dueDate}
            onChange={(dueDate) => setTaskForm((prev) => ({ ...prev, dueDate }))}
          />
        </div>

        <div className="attendance-task-divider" />

        <div className="form-group mb-6">
          <label className="form-label">Muhimlik darajasi</label>
          <div className="attendance-priority-select">
            {TASK_PRIORITIES.map((p) => {
              const active = taskForm.priority === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  className={`attendance-priority-card ${active ? `active active-${p.value}` : ''}`}
                  onClick={() => setTaskForm((prev) => ({ ...prev, priority: p.value }))}
                >
                  <p.icon size={20} style={{ color: active ? '#ffffff' : p.color }} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="attendance-task-divider" />

        <div className="form-group mb-6">
          <label className="form-label">Hodim biriktirish</label>
          <div className="attendance-task-assign-box">
            <TaskAssigneePicker
              employees={employees}
              departmentOptions={departmentOptions}
              positionOptions={positionOptions}
              selected={taskForm.assigneeIds}
              onChange={(assigneeIds) => setTaskForm((prev) => ({ ...prev, assigneeIds }))}
            />
          </div>
        </div>

        <div className="form-group mb-6">
          <label className="form-label">Fayl biriktirish</label>
          <input
            ref={taskFileInputRef}
            type="file"
            accept={TASK_FILE_ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              handleTaskFileSelect(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {taskForm.file ? (
            <div className="attendance-task-file-chip">
              <FileText size={16} strokeWidth={2.25} />
              <span>{taskForm.file.name}</span>
              <button
                type="button"
                aria-label="Faylni olib tashlash"
                onClick={() => setTaskForm((prev) => ({ ...prev, file: null }))}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <div
              className={`attendance-task-dropzone ${isTaskDropzoneActive ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => taskFileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  taskFileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setIsTaskDropzoneActive(true); }}
              onDragLeave={() => setIsTaskDropzoneActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsTaskDropzoneActive(false);
                handleTaskFileSelect(e.dataTransfer.files?.[0]);
              }}
            >
              <Folder size={22} strokeWidth={1.5} className="attendance-task-dropzone-icon" />
              <p className="attendance-task-dropzone-text">
                <span className="attendance-task-dropzone-link">Yuklash uchun bosing</span> yoki sudrab olib keling
              </p>
              <span className="attendance-task-dropzone-hint">PNG, JPG, PDF — 5 MB</span>
            </div>
          )}
        </div>

        <div className="attendance-task-divider" />

        <div className="attendance-task-actions">
          <Button
            variant="primary"
            className="attendance-primary-btn"
            onClick={() => setIsNewTaskOpen(false)}
          >
            Yaratish
          </Button>
        </div>
      </SidePanel>

      {financePanel && (() => {
        const entries = financePanelRow ? financePanelRow.record[financeListKeyFor(financePanel.type)] : [];
        const meta = FINANCE_TYPE_META[financePanel.type];
        const amountNum = Number(financeForm.amount);

        return (
          <SidePanel
            isOpen={!!financePanel}
            onClose={() => setFinancePanel(null)}
            title={financePanelRow ? `${financePanelRow.emp.first_name} ${financePanelRow.emp.last_name} — ${meta.label}` : meta.label}
          >
            {entries.length === 0 ? (
              <p className="attendance-muted-center" style={{ padding: '0 0 1.25rem' }}>Yozuvlar yo'q</p>
            ) : (
              <div className="finance-history-list mb-6">
                {entries.map((entry) => (
                  <div key={entry.id} className="finance-history-item">
                    <div>
                      <div className={`finance-history-amount ${financePanel.type === 'fine' ? 'finance-fine-value' : ''}`}>
                        {formatUZS(entry.amount)}
                      </div>
                      {entry.note && <div className="finance-history-note">{entry.note}</div>}
                      <div className="finance-history-date">{format(entry.date, 'dd.MM.yyyy HH:mm')}</div>
                    </div>
                    <button
                      type="button"
                      className="attendance-toggle-btn"
                      title="O'chirish"
                      onClick={() => removeFinanceEntry(financePanel.employeeId, financePanel.type, entry.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="attendance-task-divider" />

            {financePanel.type === 'payment' && financePanelRow && (
              <p className="finance-balance-hint">
                Joriy qoldiq: <strong>{formatUZS(financePanelRow.qoldiq)}</strong>
              </p>
            )}

            <div className="mb-4" style={{ marginTop: '1rem' }}>
              <Input
                label="Summa (UZS)"
                type="number"
                name="financeAmount"
                min="0"
                value={financeForm.amount}
                onChange={(e) => setFinanceForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <Textarea
              name="financeNote"
              placeholder="Izoh (ixtiyoriy)"
              value={financeForm.note}
              onChange={(e) => setFinanceForm((prev) => ({ ...prev, note: e.target.value }))}
              rows={3}
              className="mb-4"
            />
            <Button
              variant="primary"
              fullWidth
              className="attendance-primary-btn"
              disabled={!financeForm.amount || amountNum <= 0}
              onClick={handleAddFinanceEntry}
            >
              {meta.addLabel}
            </Button>
          </SidePanel>
        );
      })()}

      <SidePanel
        isOpen={isMoliyaFilterOpen}
        onClose={() => setIsMoliyaFilterOpen(false)}
        title="Filtr"
        footer={
          <Button
            variant="primary"
            className="attendance-primary-btn"
            onClick={() => setIsMoliyaFilterOpen(false)}
          >
            Saqlash
          </Button>
        }
      >
        <div className="candidate-form-grid">
          <div className="form-group">
            <label className="form-label">Filiallar</label>
            <SearchableSelect
              options={branchOptions}
              selected={moliyaFilters.branch}
              onChange={(branch) => setMoliyaFilters((prev) => ({ ...prev, branch }))}
              icon={Building2}
              iconColor="var(--text-secondary)"
              placeholder="Filiallarni tanlang"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Bo'limlar</label>
            <SearchableSelect
              options={departmentOptions}
              selected={moliyaFilters.department}
              onChange={(department) => setMoliyaFilters((prev) => ({ ...prev, department }))}
              icon={LayoutGrid}
              iconColor="var(--text-secondary)"
              placeholder="Bo'limlarni tanlang"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Jadvallar</label>
            <SearchableSelect
              options={SCHEDULE_OPTIONS}
              selected={moliyaFilters.schedules}
              onChange={(schedules) => setMoliyaFilters((prev) => ({ ...prev, schedules }))}
              icon={ShieldAlert}
              iconColor="#f59e0b"
              placeholder="Jadvallarni tanlang"
              multiple
            />
          </div>
          <div className="form-group">
            <label className="form-label">Lavozimlar</label>
            <SearchableSelect
              options={positionOptions}
              selected={moliyaFilters.position}
              onChange={(position) => setMoliyaFilters((prev) => ({ ...prev, position }))}
              icon={Briefcase}
              iconColor="var(--text-secondary)"
              placeholder="Lavozimlarni tanlang"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Xodimlar</label>
            <SearchableSelect
              options={employeeOptions}
              selected={moliyaFilters.employeeId}
              onChange={(employeeId) => setMoliyaFilters((prev) => ({ ...prev, employeeId }))}
              icon={Users}
              iconColor="var(--text-secondary)"
              placeholder="Xodimlarni tanlang"
            />
          </div>
          <div className="form-group form-group-full">
            <label className="form-label">Sana oralig'i</label>
            <div className="filter-date-range-row">
              <div style={{ flex: 1 }}>
                <DatePicker
                  trigger="field"
                  value={moliyaFilters.startDate}
                  onChange={(startDate) => setMoliyaFilters((prev) => ({ ...prev, startDate }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <DatePicker
                  trigger="field"
                  value={moliyaFilters.endDate}
                  onChange={(endDate) => setMoliyaFilters((prev) => ({ ...prev, endDate }))}
                />
              </div>
            </div>

            <div className="filter-preset-row">
              <button
                type="button"
                className="filter-preset-arrow"
                onClick={() => scrollMoliyaPresets(-1)}
                aria-label="Chapga"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="filter-preset-scroll" ref={moliyaPresetScrollRef}>
                {DATE_RANGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="filter-preset-pill"
                    onClick={() => applyMoliyaDatePreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="filter-preset-arrow"
                onClick={() => scrollMoliyaPresets(1)}
                aria-label="O'ngga"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </SidePanel>

      <Modal
        isOpen={isAddPaymentOpen}
        onClose={() => setIsAddPaymentOpen(false)}
        title="Ish haqi to'lovini qo'shish."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddPaymentOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              disabled={!addPaymentForm.employeeId || !addPaymentAmountNum || addPaymentAmountNum <= 0}
              onClick={handleSubmitAddPayment}
            >
              Saqlash
            </Button>
          </>
        }
      >
        <div className="form-group mb-4">
          <label className="form-label">Xodim <span className="required">*</span></label>
          <SearchableSelect
            options={employeeOptions}
            selected={addPaymentForm.employeeId}
            onChange={(employeeId) => setAddPaymentForm((prev) => ({ ...prev, employeeId }))}
            icon={Users}
            iconColor="var(--text-secondary)"
            placeholder="Xodimni tanlang"
            searchPlaceholder="Qidiruv"
          />
        </div>

        <div className="mb-4">
          <Input
            label="Miqdor"
            required
            type="number"
            name="addPaymentAmount"
            min="0"
            value={addPaymentForm.amount}
            onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Miqdorni kiriting"
          />
        </div>

        <div className="mb-4">
          <Select
            label="Oy"
            required
            name="addPaymentMonth"
            value={addPaymentForm.month}
            onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, month: e.target.value }))}
            options={monthOptions}
            placeholder={null}
          />
        </div>

        <Select
          label="Yil"
          required
          name="addPaymentYear"
          value={addPaymentForm.year}
          onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, year: e.target.value }))}
          options={yearOptions}
          placeholder={null}
        />
      </Modal>

      <Modal
        isOpen={isAddFineOpen}
        onClose={() => setIsAddFineOpen(false)}
        title={<>{editingFinePolicyId ? 'Jarima siyosatini tahrirlash' : 'Jarima yaratish'} <span className="fine-modal-step-label">Qadam 1/2</span></>}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddFineOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              disabled={!fineForm.name.trim() || isSavingFinePolicy}
              onClick={handleFineNextStep}
            >
              {isSavingFinePolicy ? 'Saqlanmoqda...' : editingFinePolicyId ? 'Saqlash' : 'Yaratish'}
            </Button>
          </>
        }
      >
        <div className="fine-modal-step">
          <span className="fine-step-badge">1</span>
          <div className="fine-modal-step-body">
            <h4 className="fine-step-title">Asosiy ma'lumotlar</h4>
            <div className="candidate-form-grid">
              <Input
                label="Jarima nomi"
                name="fineName"
                value={fineForm.name}
                onChange={(e) => setFineForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Sotuvchilar, ofitsiantlar..."
              />
              <div className="form-group">
                <label className="form-label">Holat</label>
                <label className="fine-toggle-row">
                  <input
                    type="checkbox"
                    className="fine-toggle-switch"
                    checked={fineForm.enabled}
                    onChange={(e) => setFineForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>{fineForm.enabled ? 'Yoqilgan' : "O'chirilgan"}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="fine-modal-step">
          <span className="fine-step-badge">2</span>
          <div className="fine-modal-step-body">
            <h4 className="fine-step-title">Jarima shablonlari</h4>
            <p className="fine-step-subtitle">Sozlamoqchi bo'lgan jarima turlarini tanlang</p>

            <div className="fine-template-type-pills">
              {FINE_TEMPLATE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className="fine-template-type-pill"
                  style={{ '--fine-pill-color': type.color }}
                  onClick={() => addFineTemplate(type)}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  {type.label}
                </button>
              ))}
            </div>

            {fineForm.templates.length === 0 ? (
              <div className="fine-template-empty">
                <span className="fine-template-empty-icon">
                  <PackageX size={26} strokeWidth={1.5} />
                </span>
                <p className="fine-template-empty-title">Hali hech qanday shablon sozlanmagan</p>
                <p className="fine-template-empty-hint">Jarima shablonlarini qo'shish uchun yuqoridagi tugmalarni bosing</p>
              </div>
            ) : (
              <div className="fine-template-configured">
                <div className="fine-template-configured-header">
                  <span className="fine-template-configured-title">Sozlangan shablonlar</span>
                  <span className="fine-template-count-pill">{fineForm.templates.length} Shablonlar</span>
                </div>

                <div className="fine-template-list">
                  {fineForm.templates.map((tpl) => {
                    const typeMeta = FINE_TEMPLATE_TYPES.find((t) => t.value === tpl.type);
                    return (
                      <div key={tpl.id} className="fine-template-card" style={{ '--fine-pill-color': typeMeta.color }}>
                        <span className="fine-template-card-tag">{typeMeta.label}</span>

                        <div className="fine-template-card-field">
                          <label>Turi</label>
                          <SearchableSelect
                            options={violationTypeOptions}
                            selected={tpl.type}
                            onChange={(type) => updateFineTemplate(tpl.id, { type })}
                            getOptionIcon={getViolationTypeIcon}
                            icon={AlertTriangle}
                            placeholder="Turini tanlang"
                          />
                        </div>

                        <div className="fine-template-card-field">
                          <label>Vaqt chegarasi</label>
                          <Select
                            name={`fineTemplateTime-${tpl.id}`}
                            value={tpl.timeLimit}
                            onChange={(e) => updateFineTemplate(tpl.id, { timeLimit: e.target.value })}
                            options={FINE_TIME_LIMIT_OPTIONS}
                            placeholder={null}
                          />
                        </div>

                        <div className="fine-template-card-field">
                          <label>Miqdor - summada</label>
                          <div className="fine-template-amount-field">
                            <input
                              type="number"
                              min="0"
                              value={tpl.amount}
                              onChange={(e) => updateFineTemplate(tpl.id, { amount: e.target.value })}
                              placeholder="0"
                            />
                            <span>so'm</span>
                          </div>
                        </div>

                        <div className="fine-template-card-field">
                          <label>Jazo turi</label>
                          <SearchableSelect
                            options={punishmentTypeOptions}
                            selected={tpl.jazoType}
                            onChange={(jazoType) => updateFineTemplate(tpl.id, { jazoType })}
                            getOptionIcon={getPunishmentTypeIcon}
                            icon={AlertTriangle}
                            placeholder="Jazo turi"
                            searchPlaceholder="Jazo turini qidirish"
                            onCreateNew={async (name) => {
                              const value = await handleCreateFineType(name);
                              if (value) updateFineTemplate(tpl.id, { jazoType: value });
                            }}
                            createLabel="Jazo yaratish"
                          />
                        </div>

                        <button
                          type="button"
                          className="fine-template-card-delete"
                          aria-label="Shablonni o'chirish"
                          onClick={() => removeFineTemplate(tpl.id)}
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <SidePanel
        isOpen={isCreateDeviceOpen}
        onClose={closeCreateDevicePanel}
        title="Qurilma yaratish"
        footer={
          createdDevice ? (
            <Button variant="primary" className="attendance-primary-btn" onClick={closeCreateDevicePanel} style={{ width: '100%' }}>
              Yopish
            </Button>
          ) : (
            <div style={{ display: 'flex', width: '100%', gap: '0.75rem' }}>
              <Button variant="outline" onClick={closeCreateDevicePanel} style={{ flex: 1 }}>
                Bekor qilish
              </Button>
              <Button
                variant="primary"
                className="attendance-primary-btn"
                onClick={handleCreateDevice}
                disabled={isCreatingDevice}
                style={{ flex: 1 }}
              >
                {isCreatingDevice ? 'Yaratilmoqda...' : 'Yaratish'}
              </Button>
            </div>
          )
        }
      >
        {createdDevice ? (
          <div className="attendance-device-created">
            <div className="attendance-device-created-icon">
              <Check size={22} strokeWidth={2.5} />
            </div>
            <h3>"{createdDevice.name}" yaratildi</h3>
            <p>
              Quyidagi tokenni nusxalab, kameraning HTTP Listening (ISAPI) sozlamalariga kiriting.
              Bu tokenni faqat shu yerda ko'rasiz — keyinroq kerak bo'lsa, ro'yxatdagi qatordan ham nusxalab olishingiz mumkin.
            </p>
            <div className="attendance-device-token-box">
              <KeyRound size={16} strokeWidth={2} />
              <code>{createdDevice.token}</code>
              <button
                type="button"
                className="attendance-device-token-copy"
                onClick={() => handleCopyToken(createdDevice.token)}
                title="Nusxalash"
              >
                {isTokenCopied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
              </button>
            </div>
            <p className="attendance-device-endpoint">
              Hodisa yuborish manzili: <code>/api/v1/devices/{createdDevice.token}/events</code>
            </p>
          </div>
        ) : (
          <div className="form-group">
            <Input
              label="Qurilma nomi"
              name="deviceName"
              placeholder="Masalan: Bosh kirish kamerasi"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              icon={<Smartphone size={15} strokeWidth={2} />}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Nomi shu qurilmani Terminallar ro'yxatida tanib olish uchun — token avtomatik generatsiya qilinadi, qo'lda kiritilmaydi.
            </p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

export default AttendancePage;
