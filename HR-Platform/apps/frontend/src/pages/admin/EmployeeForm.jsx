import React, { useState, useEffect, useRef } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import employeeService from '../../services/employeeService';
import useToast from '../../hooks/useToast';

/**
 * EmployeeForm Component
 * Professional form for creating or updating employee profiles
 */
export function EmployeeForm({ employee = null, onSubmitSuccess, onCancel }) {
  const { toast } = useToast();
  const isEditing = !!employee;
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    employeeNumber: '27',
    firstName: '',
    lastName: '',
    branch: '',
    department: '',
    position: '',
    joinDate: new Date().toISOString().split('T')[0],
    birthDate: '',
    pnfl: '',
    phone: '',
    email: '',
    address: '',
    experience: '',
    telegramUsername: '',
    salaryType: 'Oylik',
    salaryAmount: '',
    status: 'Faol',
    kpiTemplate: '',
    photo: null,
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Branch options
  const branches = [
    { value: '', label: 'Tanlang...' },
    { value: 'sayxun', label: 'Sayxun' },
    { value: "xalqlar do'stligi", label: "Xalqlar do'stligi" },
    { value: 'tuman', label: 'Tuman' },
  ];

  // Department options (Bo'lim)
  const departments = [
    { value: '', label: 'Tanlang...' },
    { value: 'moliya', label: 'Moliya' },
    { value: 'hr', label: 'HR' },
    { value: 'sotuv', label: 'Sotuv' },
    { value: 'kassir', label: 'Kassir' },
    { value: 'oquv', label: 'O\'quv' },
    { value: 'boshqaruv', label: 'Boshqaruv' },
    { value: 'texnik', label: 'Texnik bo\'lim' },
  ];

  // Position options (Lavozim)
  const positions = [
    { value: '', label: 'Tanlang...' },
    { value: 'moliya', label: 'Moliya' },
    { value: 'hr', label: 'HR' },
    { value: 'sotuv', label: 'Sotuv' },
    { value: 'kassir', label: 'Kassir' },
    { value: 'mentor', label: 'Mentor' },
    { value: 'boshqaruv', label: 'Boshqaruv' },
    { value: 'texnik', label: 'Texnik bo\'lim' },
  ];

  // Pre-fill form if editing
  useEffect(() => {
    if (employee) {
      // Parse employee data for editing
      let formattedJoinDate = '';
      let formattedBirthDate = '';

      if (employee.join_date) {
        try {
          formattedJoinDate = new Date(employee.join_date).toISOString().split('T')[0];
        } catch (e) {
          formattedJoinDate = employee.join_date;
        }
      }

      if (employee.birth_date) {
        try {
          formattedBirthDate = new Date(employee.birth_date).toISOString().split('T')[0];
        } catch (e) {
          formattedBirthDate = employee.birth_date;
        }
      }

      setFormData({
        employeeNumber: employee.employee_number || '27',
        firstName: employee.first_name || '',
        lastName: employee.last_name || '',
        branch: employee.branch || '',
        department: employee.department || '',
        position: employee.position || '',
        joinDate: formattedJoinDate,
        birthDate: formattedBirthDate,
        pnfl: employee.pnfl || '',
        phone: employee.phone || '',
        email: employee.email || '',
        address: employee.address || '',
        experience: employee.experience || '',
        telegramUsername: employee.telegram_username || '',
        salaryType: employee.salary_type || 'Oylik',
        salaryAmount: employee.salary_amount || '',
        status: employee.status || 'Faol',
        kpiTemplate: employee.kpi_template || '',
        photo: null,
      });

      if (employee.photo_url) {
        setPhotoPreview(employeeService.getPhotoUrl(employee.photo_url));
      }
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Fayl hajmi 5MB dan oshmasligi kerak');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Faqat rasm fayllari yuklash mumkin');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        photo: file,
      }));

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'Ism kiritilishi shart';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Familiya kiritilishi shart';
    }

    if (!formData.branch) {
      errors.branch = 'Filial tanlanishi shart';
    }

    if (!formData.position.trim()) {
      errors.position = 'Lavozim tanlanishi shart';
    }

    if (!formData.joinDate) {
      errors.joinDate = 'Ishga kirgan sana kiritilishi shart';
    }

    if (formData.pnfl && !/^\d{14}$/.test(formData.pnfl)) {
      errors.pnfl = 'PNFL 14 ta raqamdan iborat bo\'lishi kerak';
    }

    if (formData.phone && !/^\+?[0-9]{7,15}$/.test(formData.phone.replace(/[\s-()]/g, ''))) {
      errors.phone = 'Telefon raqam formati noto\'g\'ri (Masalan: +998901234567)';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email formati noto\'g\'ri';
    }

    if (!formData.salaryAmount || parseFloat(formData.salaryAmount) <= 0) {
      errors.salaryAmount = 'Maosh miqdori kiritilishi shart';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Iltimos, barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeNumber: formData.employeeNumber,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        branch: formData.branch,
        department: formData.department,
        position: formData.position,
        joinDate: formData.joinDate,
        birthDate: formData.birthDate || null,
        pnfl: formData.pnfl || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        experience: formData.experience ? parseInt(formData.experience) : 0,
        telegramUsername: formData.telegramUsername || null,
        salaryType: formData.salaryType,
        salaryAmount: parseFloat(formData.salaryAmount),
        status: formData.status,
        kpiTemplate: formData.kpiTemplate || null,
      };

      if (isEditing) {
        await employeeService.updateEmployee(employee.id, payload);
        if (formData.photo) {
          await employeeService.uploadPhoto(employee.id, formData.photo);
        }
        toast.success('Xodim ma\'lumotlari muvaffaqiyatli yangilandi!');
      } else {
        const created = await employeeService.createEmployee(payload);
        const newEmployeeId = created?.employee?.id;
        if (formData.photo && newEmployeeId) {
          await employeeService.uploadPhoto(newEmployeeId, formData.photo);
        }
        toast.success('Yangi xodim muvaffaqiyatli qo\'shildi!');
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const errors = {};
        err.response.data.errors.forEach((e) => {
          errors[e.field] = e.message;
        });
        setFormErrors(errors);
        toast.error('Kiritilgan ma\'lumotlarda xatolik bor, iltimos tekshiring.');
      } else {
        const errorMsg = err.response?.data?.message || 'Xatolik yuz berdi';
        toast.error(errorMsg);
      }
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="employee-form">
      {/* Full Width Row - Name and Employee Number */}
      <div className="form-row-grid">
        {/* Ism */}
        <div className="form-field">
          <label className="form-label">
            Ism <span className="required">*</span>
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="Alisher"
            className={`form-input ${formErrors.firstName ? 'input-error' : ''}`}
          />
          {formErrors.firstName && <span className="error-text">{formErrors.firstName}</span>}
        </div>

        {/* Familiya */}
        <div className="form-field">
          <label className="form-label">
            Familiya <span className="required">*</span>
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Karimov"
            className={`form-input ${formErrors.lastName ? 'input-error' : ''}`}
          />
          {formErrors.lastName && <span className="error-text">{formErrors.lastName}</span>}
        </div>

        {/* Xodim raqami */}
        <div className="form-field">
          <label className="form-label">Xodim raqami</label>
          <input
            type="text"
            name="employeeNumber"
            value={formData.employeeNumber}
            onChange={handleChange}
            placeholder="27"
            className="form-input"
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="form-grid">
        {/* Left Column */}
        <div className="form-column">

          {/* Filial */}
          <div className="form-field">
            <label className="form-label">
              Filial <span className="required">*</span>
            </label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              className={`form-input ${formErrors.branch ? 'input-error' : ''}`}
            >
              {branches.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </select>
            {formErrors.branch && <span className="error-text">{formErrors.branch}</span>}
          </div>

          {/* Lavozim */}
          <div className="form-field">
            <label className="form-label">
              Lavozim <span className="required">*</span>
            </label>
            <select
              name="position"
              value={formData.position}
              onChange={handleChange}
              className={`form-input ${formErrors.position ? 'input-error' : ''}`}
            >
              {positions.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
            {formErrors.position && <span className="error-text">{formErrors.position}</span>}
          </div>

          {/* Tug'ilgan kuni */}
          <div className="form-field">
            <label className="form-label">Tug'ilgan kuni (ixtiyoriy)</label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Telefon */}
          <div className="form-field">
            <label className="form-label">Telefon</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+998 90 123 45 67"
              className={`form-input ${formErrors.phone ? 'input-error' : ''}`}
            />
            {formErrors.phone && <span className="error-text">{formErrors.phone}</span>}
          </div>

          {/* Telegram Username */}
          <div className="form-field">
            <label className="form-label">Telegram username</label>
            <input
              type="text"
              name="telegramUsername"
              value={formData.telegramUsername}
              onChange={handleChange}
              placeholder="@username"
              className="form-input"
            />
          </div>

          {/* Tajriba */}
          <div className="form-field">
            <label className="form-label">Tajriba (yil)</label>
            <input
              type="number"
              name="experience"
              value={formData.experience}
              onChange={handleChange}
              placeholder="5"
              min="0"
              max="50"
              className="form-input"
            />
          </div>

          {/* Maosh turi */}
          <div className="form-field">
            <label className="form-label">Maosh turi</label>
            <select
              name="salaryType"
              value={formData.salaryType}
              onChange={handleChange}
              className="form-input"
            >
              <option value="Oylik">Oylik</option>
              <option value="Haftalik">Haftalik</option>
              <option value="15 Kunlik">15 Kunlik</option>
              <option value="Kunlik">Kunlik</option>
              <option value="Soatlik">Soatlik</option>
            </select>
          </div>

          {/* Holat */}
          <div className="form-field">
            <label className="form-label">Holat</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="form-input"
            >
              <option value="Faol">Faol</option>
              <option value="Nofaol">Nofaol</option>
              <option value="Ta'tilda">Ta'tilda</option>
              <option value="Bekor qilingan">Bekor qilingan</option>
            </select>
          </div>
        </div>

        {/* Right Column */}
        <div className="form-column">
          {/* Bo'lim */}
          <div className="form-field">
            <label className="form-label">Bo'lim</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="form-input"
            >
              {departments.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ishga kirgan sana */}
          <div className="form-field">
            <label className="form-label">
              Ishga kirgan sana <span className="required">*</span>
            </label>
            <input
              type="date"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleChange}
              className={`form-input ${formErrors.joinDate ? 'input-error' : ''}`}
            />
            {formErrors.joinDate && <span className="error-text">{formErrors.joinDate}</span>}
          </div>

          {/* PNFL */}
          <div className="form-field">
            <label className="form-label">PNFL (ixtiyoriy)</label>
            <input
              type="text"
              name="pnfl"
              value={formData.pnfl}
              onChange={handleChange}
              placeholder="12345678901234"
              maxLength={14}
              className={`form-input ${formErrors.pnfl ? 'input-error' : ''}`}
            />
            {formErrors.pnfl && <span className="error-text">{formErrors.pnfl}</span>}
          </div>

          {/* Email */}
          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="employee@company.com"
              className={`form-input ${formErrors.email ? 'input-error' : ''}`}
            />
            {formErrors.email && <span className="error-text">{formErrors.email}</span>}
          </div>

          {/* Manzil */}
          <div className="form-field">
            <label className="form-label">Manzil</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Toshkent shahar, Chilonzor tumani"
              className="form-input"
            />
          </div>

          {/* Maosh miqdori */}
          <div className="form-field">
            <label className="form-label">
              Maosh miqdori (UZS) <span className="required">*</span>
            </label>
            <input
              type="number"
              name="salaryAmount"
              value={formData.salaryAmount}
              onChange={handleChange}
              placeholder="5000000"
              className={`form-input ${formErrors.salaryAmount ? 'input-error' : ''}`}
            />
            {formErrors.salaryAmount && <span className="error-text">{formErrors.salaryAmount}</span>}
          </div>

          {/* KPI Shablon */}
          <div className="form-field">
            <label className="form-label">KPI Shablon</label>
            <select
              name="kpiTemplate"
              value={formData.kpiTemplate}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">— KPI shablon yo'q —</option>
              <option value="standard">Standart KPI</option>
              <option value="sales">Sotuv KPI</option>
              <option value="technical">Texnik KPI</option>
              <option value="management">Boshqaruv KPI</option>
            </select>
          </div>
        </div>
      </div>

      {/* Photo Upload - Full Width */}
      <div className="form-field-full">
        <label className="form-label">Xodim rasmi (yuz tekshiruvi uchun)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handlePhotoClick}
            icon="📷"
          >
            Rasm yuklash
          </Button>
          {photoPreview && (
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '2px solid var(--border)',
            }}>
              <img
                src={photoPreview}
                alt="Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Bekor qilish
        </Button>
        <Button variant="primary" type="submit" loading={submitting} disabled={submitting}>
          {isEditing ? 'Saqlash' : 'Qo\'shish'}
        </Button>
      </div>

      <style>{`
        .employee-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-row-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .form-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-field-full {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .required {
          color: var(--error);
          margin-left: 2px;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          font-size: 0.875rem;
          color: var(--text-primary);
          transition: all 0.2s;
          outline: none;
        }

        .form-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .form-input::placeholder {
          color: var(--text-secondary);
        }

        .input-error {
          border-color: var(--error);
        }

        .error-text {
          font-size: 0.75rem;
          color: var(--error);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        @media (max-width: 768px) {
          .form-row-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}

export default EmployeeForm;
