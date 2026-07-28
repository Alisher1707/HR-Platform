import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  UploadCloud,
  ImagePlus,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Briefcase,
  Building2,
  Camera,
  CalendarDays,
  LayoutGrid,
  Network,
  Search,
  Check,
  Pencil,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SidePanel from '../../components/ui/SidePanel';
import useToast from '../../hooks/useToast';
import employeeService from '../../services/employeeService';
import ScheduleFormPanel from './ScheduleFormPanel';
import { BranchLocationPicker } from './OrganizationPage';
import { CheckCircle2, Circle } from 'lucide-react';

// Sarlavha + tagliq (X) + footer bilan har bir qo'shimcha jonli-qo'shish
// paneli (Filial/Bo'lim/Lavozim) uchun bir xil "docked card" qobig'i —
// ScheduleFormPanel'ning o'zi ishlatadigan .qa-schedule-panel-* klasslari
// bilan bir xil ko'rinish, shunda barchasi bir-biriga mos qatorda ochiladi.
function DockedFormCard({ title, onClose, onSave, saveLabel = 'Saqlash', children }) {
  return (
    <div className="qa-schedule-panel" onClick={(e) => e.stopPropagation()}>
      <div className="qa-schedule-panel-header">
        <h3>{title}</h3>
        <button type="button" className="qa-close" onClick={onClose} aria-label="Yopish">
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="qa-schedule-panel-body">{children}</div>
      <div className="qa-schedule-panel-footer">
        <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>
          Bekor qilish
        </Button>
        <Button variant="primary" className="attendance-primary-btn" onClick={onSave} style={{ flex: 1 }}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

// Filiallar/Bo'lim/Lavozim/Jadval uchun bitta umumiy qidiruv+belgilash
// popover — har biri o'z sarlavhasi, ikonasi va ro'yxati bilan shu orqali
// chiziladi, shunda barcha to'rttasi bir xil ko'rinishda ishlaydi.
function FieldPicker({ title, icon, options, search, onSearchChange, isSelected, onToggle, onClose, emptyText }) {
  return (
    <div className="qa-filial-picker" onClick={(e) => e.stopPropagation()}>
      <div className="qa-filial-picker-header">
        <h4>{title}</h4>
      </div>
      <div className="qa-filial-search">
        <Search size={15} strokeWidth={2} />
        <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Qidiruv" />
      </div>
      <div className="qa-filial-list qa-scroll-hidden">
        {options.length === 0 ? (
          <div className="qa-filial-empty">{emptyText || 'Topilmadi'}</div>
        ) : (
          options.map((opt) => {
            const checked = isSelected(opt);
            return (
              <button type="button" key={opt.id} className="qa-filial-row" onClick={() => onToggle(opt)}>
                <span className="qa-filial-row-icon">{icon}</span>
                <span className="qa-filial-row-name">
                  {opt.name}
                  {opt.extra ? ` · ${opt.extra}` : ''}
                </span>
                <span className={`qa-filial-check ${checked ? 'checked' : ''}`}>
                  {checked && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            );
          })
        )}
      </div>
      <Button type="button" variant="primary" fullWidth className="attendance-primary-btn" onClick={onClose}>
        Saqlash
      </Button>
    </div>
  );
}

// Ish jadvallari backend'i hali qo'shilmagan (IshJadvallariPage'dagi
// MOCK_SCHEDULES bilan bir xil namunaviy qiymat), shuning uchun bu yerda
// ham vaqtinchalik ro'yxat sifatida qoladi.
const DEFAULT_SCHEDULES = ['8:00 - 18:00'];

/**
 * EmployeeQuickAddPanel
 * "Tashkilot tuzilmasi -> Xodimlar" tabidagi "Xodim qo'shish" tugmasi uchun
 * dizaynga mos qisqa forma — chap tomondan sirg'alib chiqadigan panel.
 * Shared Modal/SidePanel'dan mustaqil (o'lchami boshqacha bo'lgani uchun),
 * shuning uchun o'zining portal/overlay'ini o'zi boshqaradi.
 * Hozircha faqat UI: submit qilinganda "tez orada" xabari chiqadi, backend
 * bilan bog'lanmagan (Otasining ismi, Foydalanuvchi nomi, bir nechta Filial
 * va Jadval maydonlarining bazada joyi yo'q).
 */
export function EmployeeQuickAddPanel({
  isOpen,
  onClose,
  employee = null,
  branches = [],
  departments = [],
  positions = [],
  onCreateBranch,
  onCreateDepartment,
  onCreatePosition,
  onSubmitSuccess,
}) {
  const isEditing = !!employee;
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  // Filial/Bo'lim/Lavozim uchun "+" tugmasi — Tashkilot tuzilmasining o'z
  // tab-sahifalaridagi panelni EMAS, shu yerda yonma-yon ochiladigan mustaqil
  // mini-formani ochadi (aks holda ikkalasi ustma-ust chiqib qolar edi).
  const [isBranchCreateOpen, setIsBranchCreateOpen] = useState(false);
  const [branchCreateForm, setBranchCreateForm] = useState({
    name: '', address: '', lat: 41.2995, lng: 69.2401, radius: 50, verified: false,
  });
  const [isDepartmentCreateOpen, setIsDepartmentCreateOpen] = useState(false);
  const [departmentCreateName, setDepartmentCreateName] = useState('');
  const [isPositionCreateOpen, setIsPositionCreateOpen] = useState(false);
  const [positionCreateName, setPositionCreateName] = useState('');

  const closeAllCreatePanels = () => {
    setIsBranchCreateOpen(false);
    setIsDepartmentCreateOpen(false);
    setIsPositionCreateOpen(false);
  };

  const openBranchCreate = () => {
    closeAllCreatePanels();
    setBranchCreateForm({ name: '', address: '', lat: 41.2995, lng: 69.2401, radius: 50, verified: false });
    setIsBranchCreateOpen(true);
  };

  const openDepartmentCreate = () => {
    closeAllCreatePanels();
    setDepartmentCreateName('');
    setIsDepartmentCreateOpen(true);
  };

  const openPositionCreate = () => {
    closeAllCreatePanels();
    setPositionCreateName('');
    setIsPositionCreateOpen(true);
  };

  const handleBranchCreateSave = () => {
    if (!branchCreateForm.name.trim()) return;
    onCreateBranch?.({ ...branchCreateForm, name: branchCreateForm.name.trim() });
    setIsBranchCreateOpen(false);
  };

  const handleDepartmentCreateSave = () => {
    if (!departmentCreateName.trim()) return;
    onCreateDepartment?.({ name: departmentCreateName.trim() });
    setIsDepartmentCreateOpen(false);
  };

  const handlePositionCreateSave = () => {
    if (!positionCreateName.trim()) return;
    onCreatePosition?.({ name: positionCreateName.trim() });
    setIsPositionCreateOpen(false);
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [selectedBranches, setSelectedBranches] = useState([]);
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');

  const [schedules, setSchedules] = useState(DEFAULT_SCHEDULES);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULES[0]);
  const [isScheduleAddOpen, setIsScheduleAddOpen] = useState(false);

  // 'filial' | 'bolim' | 'lavozim' | 'jadval' | null — bir vaqtda faqat
  // bitta qidiruv+belgilash popover ochiladi.
  const [openPicker, setOpenPicker] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const openPickerFor = (key) => {
    setPickerSearch('');
    setOpenPicker(key);
  };
  const closePicker = () => setOpenPicker(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Panel yopilganda (X yoki fon bosilganda) hamma narsa tozalanadi —
  // keyingi safar ochilganda ochiq qolgan popover yoki eski kiritilgan
  // ma'lumotlar ko'rinmasligi uchun.
  useEffect(() => {
    if (isOpen) return;
    setFirstName('');
    setLastName('');
    setMiddleName('');
    setPhone('');
    setUsername('');
    setPhotoPreview(null);
    setPhotoFile(null);
    setSelectedBranches([]);
    setDepartment('');
    setPosition('');
    setSchedule(DEFAULT_SCHEDULES[0]);
    setOpenPicker(null);
    setPickerSearch('');
    setIsScheduleAddOpen(false);
    setIsBranchCreateOpen(false);
    setIsDepartmentCreateOpen(false);
    setIsPositionCreateOpen(false);
  }, [isOpen]);

  // Tahrirlash rejimida ochilganda mavjud xodim ma'lumotlari bilan
  // to'ldiriladi (faqat frontend — hozircha saqlash real API'ga ulanmagan).
  useEffect(() => {
    if (!isOpen || !employee) return;
    setFirstName(employee.first_name || '');
    setLastName(employee.last_name || '');
    setPhone(employee.phone || '');
    setUsername(employee.telegram_username || '');
    setPhotoPreview(employee.photo_url ? employeeService.getPhotoUrl(employee.photo_url) : null);
    setSelectedBranches(employee.branch ? [employee.branch] : []);
    setDepartment(employee.department || '');
    setPosition(employee.position || '');
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllari yuklash mumkin');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fayl hajmi 5MB dan oshmasligi kerak');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const toggleBranch = (name) => {
    setSelectedBranches((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]
    );
  };

  const removeBranch = (name) => {
    setSelectedBranches((prev) => prev.filter((b) => b !== name));
  };

  const matchesSearch = (name) => name.toLowerCase().includes(pickerSearch.trim().toLowerCase());

  const branchOptions = branches.filter((b) => matchesSearch(b.name)).map((b) => ({ id: b.id, name: b.name, extra: b.radius }));
  const departmentOptions = departments.filter((d) => matchesSearch(d.name)).map((d) => ({ id: d.id, name: d.name }));
  const positionOptions = positions.filter((p) => matchesSearch(p.name)).map((p) => ({ id: p.id, name: p.name }));
  const scheduleOptions = schedules.filter((s) => matchesSearch(s)).map((s) => ({ id: s, name: s }));

  const handleScheduleModalClose = () => {
    setIsScheduleAddOpen(false);
  };

  const handleScheduleSave = (scheduleForm) => {
    const name = scheduleForm.name;
    if (!name || schedules.includes(name)) return;
    setSchedules((prev) => [...prev, name]);
    setSchedule(name);
    handleScheduleModalClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Ism va familiya kiritilishi shart');
      return;
    }

    setSubmitting(true);
    try {
      // Otasining ismi, foydalanuvchi nomi (schedule bilan bir xil) va bir
      // nechta filial hozircha bazada joyi yo'q (fayl boshidagi izohda
      // aytilgan) — shu sabab bu yerda yuborilmaydi, faqat backend'da
      // haqiqatan mavjud maydonlar jo'natiladi.
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        branch: selectedBranches[0] || null,
        department: department || null,
        position: position || null,
        phone: phone || null,
        telegramUsername: username || null,
      };

      if (isEditing) {
        await employeeService.updateEmployee(employee.id, payload);
        if (photoFile) {
          await employeeService.uploadPhoto(employee.id, photoFile);
        }
        toast.success('Xodim ma\'lumotlari muvaffaqiyatli yangilandi!');
      } else {
        const created = await employeeService.createEmployee(payload);
        const newEmployeeId = created?.employee?.id;
        if (photoFile && newEmployeeId) {
          await employeeService.uploadPhoto(newEmployeeId, photoFile);
        }
        toast.success('Yangi xodim muvaffaqiyatli qo\'shildi!');
      }

      onSubmitSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Xatolik yuz berdi';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-panel-group">
      <div className="qa-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qa-panel-header">
          <div className="qa-header-title">
            <span className="qa-header-icon">
              {isEditing ? <Pencil size={18} strokeWidth={2.25} /> : <UserPlus size={20} strokeWidth={2} />}
            </span>
            <h3>{isEditing ? 'Xodimni tahrirlash' : "Xodim qo'shish"}</h3>
          </div>
          <button type="button" className="qa-close" onClick={onClose} aria-label="Yopish">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form className="qa-panel-body" onSubmit={handleSubmit}>
          <div className="qa-top">
            <div className="qa-fields">
              <div className="qa-field">
                <label className="qa-label">Ism</label>
                <input
                  className="qa-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ismi"
                />
              </div>
              <div className="qa-field">
                <label className="qa-label">Familiya</label>
                <input
                  className="qa-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Familiyasi"
                />
              </div>
              <div className="qa-field">
                <label className="qa-label">Otasining ismi</label>
                <input
                  className="qa-input"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Otasining ismi"
                />
              </div>
            </div>

            <div className="qa-photo">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
              <div className="qa-photo-wrap">
                <button type="button" className="qa-photo-circle" onClick={handlePhotoClick} aria-label="Rasm yuklash">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="qa-photo-img" />
                  ) : (
                    <UploadCloud size={30} strokeWidth={1.6} />
                  )}
                  <span className="qa-photo-overlay">
                    <Camera size={20} strokeWidth={2} />
                  </span>
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    className="qa-photo-remove"
                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                    aria-label="Rasmni olib tashlash"
                  >
                    <X size={13} strokeWidth={3} />
                  </button>
                )}
              </div>
              <button type="button" className="qa-photo-link" onClick={handlePhotoClick}>
                <ImagePlus size={14} strokeWidth={2} />
                Rasmni yuklash
              </button>
              <span className="qa-photo-hint">
                Rasm formati: JPG, PNG, WEBP
                <br />
                (5MB gacha)
              </span>
            </div>
          </div>

          <div className="qa-divider" />

          <div className="qa-row">
            <div className="qa-field">
              <label className="qa-label">Telefon raqam</label>
              <div className="qa-phone">
                <span className="qa-phone-flag">
                  🇺🇿 <ChevronDown size={13} />
                </span>
                <input
                  className="qa-phone-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998"
                />
              </div>
            </div>
            <div className="qa-field">
              <label className="qa-label">Foydalanuvchi nomi (Ixtiyoriy)</label>
              <input
                className="qa-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
              />
            </div>
          </div>

          <div className="qa-section-title">
            <span className="qa-section-icon">
              <Briefcase size={15} strokeWidth={2} />
            </span>
            Ish ma'lumotlari
          </div>

          <div className="qa-row">
            <div className="qa-field">
              <label className="qa-label">Filiallar</label>
              <div className="qa-select-row">
                <button type="button" className="qa-input qa-select-trigger" onClick={() => openPickerFor('filial')}>
                  <span>
                    {selectedBranches.length > 0
                      ? `${selectedBranches.length} ta filial tanlandi`
                      : 'Filialni tanlang'}
                  </span>
                  <ChevronRight size={15} strokeWidth={2.25} />
                </button>
                <button type="button" className="qa-add-btn" onClick={openBranchCreate} aria-label="Yangi filial qo'shish">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
              {selectedBranches.length > 0 && (
                <div className="qa-tags">
                  {selectedBranches.map((name) => (
                    <span key={name} className="qa-tag">
                      <Building2 size={11} strokeWidth={2.5} />
                      {name}
                      <button type="button" onClick={() => removeBranch(name)} aria-label={`${name} olib tashlash`}>
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="qa-field">
              <label className="qa-label">Bo'lim</label>
              <div className="qa-select-row">
                <button type="button" className="qa-input qa-select-trigger" onClick={() => openPickerFor('bolim')}>
                  <span>{department || "Bo'lim tanlang"}</span>
                  <ChevronRight size={15} strokeWidth={2.25} />
                </button>
                <button type="button" className="qa-add-btn" onClick={openDepartmentCreate} aria-label="Yangi bo'lim qo'shish">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          <div className="qa-row">
            <div className="qa-field">
              <label className="qa-label">Lavozim</label>
              <div className="qa-select-row">
                <button type="button" className="qa-input qa-select-trigger" onClick={() => openPickerFor('lavozim')}>
                  <span>{position || 'Lavozim tanlang'}</span>
                  <ChevronRight size={15} strokeWidth={2.25} />
                </button>
                <button type="button" className="qa-add-btn" onClick={openPositionCreate} aria-label="Yangi lavozim qo'shish">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="qa-field">
              <label className="qa-label">Jadval</label>
              <div className="qa-select-row">
                <button type="button" className="qa-input qa-select-trigger" onClick={() => openPickerFor('jadval')}>
                  <span>{schedule || 'Jadval tanlang'}</span>
                  <ChevronRight size={15} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="qa-add-btn"
                  onClick={() => setIsScheduleAddOpen(true)}
                  aria-label="Yangi jadval qo'shish"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={submitting}
            className="attendance-primary-btn qa-submit"
            icon={isEditing ? <Check size={17} strokeWidth={2.5} /> : <UserPlus size={17} strokeWidth={2.25} />}
          >
            {isEditing ? 'Saqlash' : "Xodim qo'shish"}
          </Button>
        </form>
      </div>

      {openPicker === 'filial' && (
        <FieldPicker
          title="Filiallar tanlang"
          icon={<Building2 size={15} strokeWidth={2} />}
          options={branchOptions}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          isSelected={(opt) => selectedBranches.includes(opt.name)}
          onToggle={(opt) => toggleBranch(opt.name)}
          onClose={closePicker}
          emptyText="Filial topilmadi"
        />
      )}

      {openPicker === 'bolim' && (
        <FieldPicker
          title="Bo'lim tanlang"
          icon={<LayoutGrid size={15} strokeWidth={2} />}
          options={departmentOptions}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          isSelected={(opt) => department === opt.name}
          onToggle={(opt) => setDepartment(opt.name)}
          onClose={closePicker}
          emptyText="Bo'lim topilmadi"
        />
      )}

      {openPicker === 'lavozim' && (
        <FieldPicker
          title="Lavozim tanlang"
          icon={<Network size={15} strokeWidth={2} />}
          options={positionOptions}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          isSelected={(opt) => position === opt.name}
          onToggle={(opt) => setPosition(opt.name)}
          onClose={closePicker}
          emptyText="Lavozim topilmadi"
        />
      )}

      {openPicker === 'jadval' && (
        <FieldPicker
          title="Jadval tanlang"
          icon={<CalendarDays size={15} strokeWidth={2} />}
          options={scheduleOptions}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          isSelected={(opt) => schedule === opt.name}
          onToggle={(opt) => setSchedule(opt.name)}
          onClose={closePicker}
          emptyText="Jadval topilmadi"
        />
      )}

      <ScheduleFormPanel
        isOpen={isScheduleAddOpen}
        onClose={handleScheduleModalClose}
        onSave={handleScheduleSave}
        title="Yangi jadval qo'shish"
      />

      {isBranchCreateOpen && (
        <DockedFormCard
          title="Yangi filial qo'shish"
          onClose={() => setIsBranchCreateOpen(false)}
          onSave={handleBranchCreateSave}
        >
          <Input
            label="Filial nomi"
            name="branchCreateName"
            value={branchCreateForm.name}
            onChange={(e) => setBranchCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Filial nomi"
            className="mb-6"
            required
          />
          <div className="form-group mb-6">
            <label className="form-label">Manzil</label>
            <BranchLocationPicker
              lat={branchCreateForm.lat}
              lng={branchCreateForm.lng}
              radius={branchCreateForm.radius}
              address={branchCreateForm.address}
              onAddressChange={(address) => setBranchCreateForm((prev) => ({ ...prev, address }))}
              onPositionChange={(lat, lng) => setBranchCreateForm((prev) => ({ ...prev, lat, lng }))}
            />
          </div>
          <Input
            label="Radius (metr)"
            name="branchCreateRadius"
            type="number"
            min="0"
            value={branchCreateForm.radius}
            onChange={(e) => setBranchCreateForm((prev) => ({ ...prev, radius: Number(e.target.value) }))}
            className="mb-6"
          />
          <button
            type="button"
            className="org-map-verify"
            onClick={() => setBranchCreateForm((prev) => ({ ...prev, verified: !prev.verified }))}
          >
            <span>Joylashuvni tekshirish</span>
            {branchCreateForm.verified ? (
              <CheckCircle2 size={20} style={{ color: '#f97316' }} />
            ) : (
              <Circle size={20} style={{ color: 'var(--text-muted)' }} />
            )}
          </button>
        </DockedFormCard>
      )}

      {isDepartmentCreateOpen && (
        <DockedFormCard
          title="Yangi bo'lim qo'shish"
          onClose={() => setIsDepartmentCreateOpen(false)}
          onSave={handleDepartmentCreateSave}
        >
          <Input
            label="Bo'lim nomi"
            name="departmentCreateName"
            value={departmentCreateName}
            onChange={(e) => setDepartmentCreateName(e.target.value)}
            placeholder="Bo'lim nomi"
            required
          />
        </DockedFormCard>
      )}

      {isPositionCreateOpen && (
        <DockedFormCard
          title="Yangi lavozim qo'shish"
          onClose={() => setIsPositionCreateOpen(false)}
          onSave={handlePositionCreateSave}
        >
          <Input
            label="Nomi"
            name="positionCreateName"
            value={positionCreateName}
            onChange={(e) => setPositionCreateName(e.target.value)}
            placeholder="Lavozim nomi"
            required
          />
        </DockedFormCard>
      )}
      </div>

      <style>{`
        .qa-overlay {
          position: fixed;
          inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: stretch;
          justify-content: flex-start;
          padding: 1.5rem;
          z-index: 1000;
          animation: qaFadeIn 0.2s ease;
        }

        .qa-panel-group {
          display: flex;
          align-items: stretch;
          gap: 1.5rem;
          min-height: 0;
        }

        .qa-panel {
          width: 660px;
          max-width: 94vw;
          max-height: 100%;
          min-height: 0;
          background: var(--bg-card-solid);
          border: 1px solid var(--border);
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: qaSlideInLeft 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .qa-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.75rem 2rem;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .qa-header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .qa-header-icon {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);
          flex-shrink: 0;
        }

        .qa-panel-header h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .qa-close {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .qa-close:hover {
          background: var(--error-bg);
          color: var(--error);
          transform: rotate(90deg);
        }

        .qa-panel-body {
          padding: 2rem;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }

        .qa-top {
          display: flex;
          justify-content: space-between;
          gap: 2rem;
        }

        .qa-fields {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
          min-width: 0;
        }

        .qa-field {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .qa-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .qa-input,
        .qa-phone-input {
          width: 100%;
          padding: 0.8rem 1rem;
          background: var(--bg-secondary);
          border: 1.5px solid transparent;
          border-radius: var(--radius-xl);
          font-size: 0.9375rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        .qa-input:focus,
        .qa-phone-input:focus {
          border-color: #f97316;
          background: var(--bg-primary);
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
        }

        .qa-select {
          cursor: pointer;
        }

        .qa-select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          text-align: left;
          color: var(--text-primary);
          cursor: pointer;
        }

        .qa-select-trigger span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .qa-select-trigger svg {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .qa-filial-picker {
          width: 380px;
          max-width: 90vw;
          max-height: 100%;
          flex-shrink: 0;
          background: var(--bg-card-solid);
          border: 1px solid var(--border);
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-xl);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow-y: auto;
          animation: qaFadeIn 0.18s ease;
        }

        .qa-filial-picker-header h4 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .qa-filial-search {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.7rem 1rem;
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          color: var(--text-muted);
        }

        .qa-filial-search input {
          flex: 1;
          border: none;
          background: none;
          outline: none;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .qa-filial-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          max-height: 260px;
          overflow-y: auto;
        }

        /* Scroll ishlaydi, lekin scrollbar ko'zga ko'rinmaydi (barcha
           asosiy brauzerlar uchun). */
        .qa-scroll-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .qa-scroll-hidden::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .qa-filial-empty {
          padding: 1rem 0;
          text-align: center;
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .qa-filial-row {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          width: 100%;
          padding: 0.7rem 0.85rem;
          background: var(--bg-secondary);
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .qa-filial-row:hover {
          background: rgba(249, 115, 22, 0.1);
        }

        .qa-filial-row-icon {
          width: 30px;
          height: 30px;
          border-radius: var(--radius);
          background: var(--bg-card-solid);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .qa-filial-row-name {
          flex: 1;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .qa-filial-check {
          width: 22px;
          height: 22px;
          border-radius: 7px;
          border: 1.5px solid var(--border-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fff;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .qa-filial-check.checked {
          background: #f97316;
          border-color: #f97316;
        }

        .qa-photo {
          flex-shrink: 0;
          width: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.6rem;
        }

        .qa-photo-circle {
          position: relative;
          width: 108px;
          height: 108px;
          border-radius: 50%;
          background: var(--bg-secondary);
          border: 1.5px dashed var(--border-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f97316;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        }

        .qa-photo-circle:hover {
          border-color: #f97316;
          background: rgba(249, 115, 22, 0.08);
          transform: scale(1.03);
        }

        .qa-photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .qa-photo-overlay {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.55);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .qa-photo-circle:hover .qa-photo-overlay {
          opacity: 1;
        }

        .qa-photo-wrap {
          position: relative;
        }

        .qa-photo-remove {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid var(--bg-card-solid);
          background: var(--error);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .qa-photo-remove:hover {
          background: #dc2626;
          transform: scale(1.08);
        }

        .qa-photo-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: none;
          border: none;
          padding: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #f97316;
          cursor: pointer;
        }

        .qa-photo-hint {
          font-size: 0.6875rem;
          line-height: 1.45;
          color: var(--text-muted);
        }

        .qa-divider {
          height: 1px;
          background: var(--border);
        }

        .qa-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .qa-phone {
          display: flex;
          align-items: center;
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          overflow: hidden;
          transition: box-shadow 0.2s ease;
        }

        .qa-phone-flag {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0 0.85rem;
          height: 100%;
          font-size: 0.9375rem;
          color: var(--text-secondary);
          border-right: 1px solid var(--border);
          flex-shrink: 0;
        }

        .qa-phone-input {
          border-radius: 0;
          background: transparent;
        }

        .qa-phone:focus-within {
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
        }

        .qa-section-title {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .qa-section-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--radius);
          background: rgba(249, 115, 22, 0.12);
          color: #f97316;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .qa-select-row {
          display: flex;
          gap: 0.6rem;
        }

        .qa-select-row .qa-input {
          flex: 1;
          min-width: 0;
        }

        .qa-add-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: var(--radius-xl);
          border: none;
          background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 3px 8px rgba(249, 115, 22, 0.25);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .qa-add-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 12px rgba(249, 115, 22, 0.35);
        }

        .qa-add-btn:active {
          transform: translateY(0);
        }

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

        .qa-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .qa-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          background: var(--text-primary);
          color: var(--bg-card-solid);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .qa-tag button {
          display: inline-flex;
          background: none;
          border: none;
          color: inherit;
          opacity: 0.7;
          cursor: pointer;
          padding: 0;
        }

        .qa-tag button:hover {
          opacity: 1;
        }

        .qa-submit {
          margin-top: 0.5rem;
          padding-top: 0.9rem;
          padding-bottom: 0.9rem;
          font-size: 0.9375rem;
        }

        @keyframes qaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes qaSlideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 900px) {
          .qa-panel-group {
            flex-direction: column;
          }

          .qa-filial-picker {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .qa-overlay {
            padding: 0;
          }

          .qa-panel {
            width: 100%;
            max-width: 100%;
            border-radius: 0;
          }

          .qa-top {
            flex-direction: column-reverse;
            align-items: center;
          }

          .qa-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

export default EmployeeQuickAddPanel;
