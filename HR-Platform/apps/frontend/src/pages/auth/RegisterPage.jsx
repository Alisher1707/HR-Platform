import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import authService from '../../services/authService';
import inviteService from '../../services/inviteService';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import ThemeToggle from '../../components/ui/ThemeToggle';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * RegisterPage Component
 * Handles registration using an invitation token with premium styles, validations,
 * and dynamic job requirements checklists.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isAuthenticated, isLoading: isRegistering, error: registerError, clearError } = useAuthStore();

  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [tokenError, setTokenError] = useState(null);
  const [inviteDetails, setInviteDetails] = useState(null);
  const [acceptedRequirements, setAcceptedRequirements] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState({});

  // 1. Get and validate token from URL
  useEffect(() => {
    const inviteToken = searchParams.get('token');
    if (!inviteToken) {
      setTokenError('Taklifnoma kodi topilmadi. Tizimga faqat maxsus taklifnoma orqali ro\'yxatdan o\'tish mumkin.');
      setIsValidating(false);
      return;
    }

    setToken(inviteToken);

    const validateToken = async () => {
      try {
        const validation = await authService.validateInviteToken(inviteToken);
        if (validation.valid) {
          setInviteDetails(validation.invite);
        } else {
          setTokenError(validation.message || 'Taklifnoma kodi yaroqsiz yoki muddati tugagan.');
        }
      } catch (err) {
        setTokenError(err.response?.data?.message || 'Taklifnomani tekshirishda xatolik yuz berdi.');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [searchParams]);

  // 2. Redirect if already authenticated ONLY if no token is in searchParams
  useEffect(() => {
    const token = searchParams.get('token');
    if (isAuthenticated && !token) {
      navigate('/');
    }
  }, [isAuthenticated, navigate, searchParams]);

  // 3. Clear errors on unmount
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear field error
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email.trim()) {
      errors.email = 'Email manzili majburiy';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email formati noto\'g\'ri';
    }

    if (!formData.firstName.trim()) {
      errors.firstName = 'Ism majburiy';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Familiya majburiy';
    }

    if (!formData.password) {
      errors.password = 'Parol majburiy';
    } else if (formData.password.length < 8) {
      errors.password = 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Parollar mos kelmadi';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await register({
        token,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        // Set user role to EMPLOYEE if they are registering for a specific job
        role: inviteDetails?.position ? 'EMPLOYEE' : 'ADMIN',
      });
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  const [candidateData, setCandidateData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    experience: '0',
    address: '',
    telegramUsername: '',
    notes: '',
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmittingCandidate, setIsSubmittingCandidate] = useState(false);
  const [candidateError, setCandidateError] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);

  const RESUME_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

  const handleResumeChange = (e) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file after removal
    e.target.value = '';

    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!RESUME_EXTENSIONS.includes(ext)) {
      setFormErrors((prev) => ({ ...prev, resume: 'Faqat PDF, DOC yoki DOCX fayl yuklash mumkin' }));
      return;
    }

    if (file.size > RESUME_MAX_SIZE) {
      setFormErrors((prev) => ({ ...prev, resume: 'Fayl hajmi 10MB dan oshmasligi kerak' }));
      return;
    }

    setFormErrors((prev) => ({ ...prev, resume: '' }));
    setResumeFile(file);
  };

  const handleResumeRemove = () => {
    setResumeFile(null);
    setFormErrors((prev) => ({ ...prev, resume: '' }));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCandidateChange = (e) => {
    const { name, value } = e.target;
    setCandidateData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear field error
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateCandidateForm = () => {
    const errors = {};

    if (!candidateData.firstName.trim()) {
      errors.firstName = 'Ism majburiy';
    }

    if (!candidateData.lastName.trim()) {
      errors.lastName = 'Familiya majburiy';
    }

    if (!candidateData.phone.trim()) {
      errors.phone = 'Telefon raqami majburiy';
    }

    if (!candidateData.birthDate) {
      errors.birthDate = 'Tug\'ilgan sana majburiy';
    }

    if (candidateData.experience === '' || isNaN(candidateData.experience) || parseInt(candidateData.experience) < 0) {
      errors.experience = 'Tajriba yillari yaroqsiz';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCandidateSubmit = async (e) => {
    e.preventDefault();

    if (!validateCandidateForm()) {
      return;
    }

    setIsSubmittingCandidate(true);
    setCandidateError(null);

    try {
      await inviteService.submitApplication({
        token,
        firstName: candidateData.firstName,
        lastName: candidateData.lastName,
        phone: candidateData.phone,
        birthDate: candidateData.birthDate,
        experience: parseInt(candidateData.experience),
        address: candidateData.address,
        telegramUsername: candidateData.telegramUsername,
        notes: candidateData.notes,
        resume: resumeFile,
      });
      setIsSubmitted(true);
    } catch (err) {
      setCandidateError(err.response?.data?.message || 'Ariza topshirishda xatolik yuz berdi.');
      console.error(err);
    } finally {
      setIsSubmittingCandidate(false);
    }
  };

  if (isValidating) {
    return (
      <div className="login-page">
        <LoadingSpinner fullScreen text="Taklifnomani tekshirilmoqda..." />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="login-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
          <ThemeToggle />
        </div>
        <div style={{
          width: '100%',
          maxWidth: '520px',
          padding: '3rem 2.75rem 2.25rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div
            aria-label="IT Live"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', userSelect: 'none', lineHeight: 1 }}
          >
            <span style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ED1C24' }}>iT</span>
            <span style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Live</span>
            <span style={{ width: '0.6rem', height: '0.6rem', background: '#ED1C24', borderRadius: '1px', marginTop: '0.25rem' }} />
          </div>

          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '2rem 0 1.5rem'
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5L10 17.5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: '0 0 1rem' }}>
            Arizangiz qabul qilindi
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            Hurmatli <strong style={{ color: 'var(--text-primary)' }}>{candidateData.firstName} {candidateData.lastName}</strong>,
            sizning <strong style={{ color: 'var(--text-primary)' }}>{inviteDetails?.position}</strong> lavozimiga topshirgan arizangiz muvaffaqiyatli qabul qilindi va tizimga saqlandi.
            HR xodimlarimiz uni tez orada ko'rib chiqishadi va siz bilan bog'lanishadi.
          </p>
          <div style={{ borderTop: '1px solid var(--border)', width: '100%', paddingTop: '1.25rem', marginTop: '2rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              HR Platform Recruiting Tizimi
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isCandidateInvite = !!inviteDetails?.position;
  const isRequirementsCheckNeeded = inviteDetails?.position && inviteDetails?.requirements?.length > 0;

  // Standalone Full-Screen Candidate Portal View
  if (isCandidateInvite && !tokenError) {
    return (
      <div className="candidate-portal-wrapper">
        <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
          <ThemeToggle />
        </div>

        <div className="candidate-portal-container animate-fade-in-up">
          <div className="candidate-header">
            <div className="candidate-badge">💼 HR PLATFORM RECRUITING</div>
            <h1 className="candidate-title">{inviteDetails.position} lavozimiga ariza</h1>
            <p className="candidate-subtitle">
              Ushbu taklifnoma orqali siz <strong>{inviteDetails.position}</strong> lavozimiga ishga kirish formasini to'ldirmoqdasiz.
            </p>
          </div>

          {candidateError && (
            <div className="login-error" style={{ marginBottom: '1.25rem', padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', fontSize: '0.875rem' }}>
              {candidateError}
            </div>
          )}

          <form onSubmit={handleCandidateSubmit} className="candidate-form">
            {inviteDetails.requirements && inviteDetails.requirements.length > 0 && (
              <div className="candidate-req-box">
                <div className="candidate-req-title">
                  <span>✨ Lavozim talablari va vazifalari</span>
                </div>
                <ul className="candidate-req-list">
                  {inviteDetails.requirements.map((req, idx) => (
                    <li key={idx} className="candidate-req-item">
                      <span className="candidate-req-check">✓</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>

                <label className="candidate-req-agree">
                  <input
                    type="checkbox"
                    checked={acceptedRequirements}
                    onChange={(e) => setAcceptedRequirements(e.target.checked)}
                    required
                  />
                  <span>Lavozim talablari va vazifalar bilan tanishdim va roziman</span>
                </label>
              </div>
            )}

            <div className="candidate-form-grid">
              <Input
                label="Ism *"
                type="text"
                name="firstName"
                value={candidateData.firstName}
                onChange={handleCandidateChange}
                placeholder="Ali"
                error={formErrors.firstName}
                required
              />
              <Input
                label="Familiya *"
                type="text"
                name="lastName"
                value={candidateData.lastName}
                onChange={handleCandidateChange}
                placeholder="Valiyev"
                error={formErrors.lastName}
                required
              />
            </div>

            <div className="candidate-form-grid">
              <Input
                label="Telefon raqami *"
                type="text"
                name="phone"
                value={candidateData.phone}
                onChange={handleCandidateChange}
                placeholder="+998901234567"
                error={formErrors.phone}
                required
              />
              <Input
                label="Tug'ilgan sana *"
                type="date"
                name="birthDate"
                value={candidateData.birthDate}
                onChange={handleCandidateChange}
                error={formErrors.birthDate}
                required
              />
            </div>

            <div className="candidate-form-grid">
              <Input
                label="Lavozimi *"
                type="text"
                name="position"
                value={inviteDetails?.position || ''}
                disabled
                required
              />
              <Input
                label="Ish tajribasi (yil) *"
                type="number"
                name="experience"
                value={candidateData.experience}
                onChange={handleCandidateChange}
                min="0"
                max="50"
                error={formErrors.experience}
                required
              />
            </div>

            <Input
              label="Manzil"
              type="text"
              name="address"
              value={candidateData.address}
              onChange={handleCandidateChange}
              placeholder="Toshkent shahar, Chilonzor tumani"
              error={formErrors.address}
            />

            <Input
              label="Telegram username"
              type="text"
              name="telegramUsername"
              value={candidateData.telegramUsername}
              onChange={handleCandidateChange}
              placeholder="@username"
              error={formErrors.telegramUsername}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Rezyume (PDF, DOC, DOCX)
              </label>

              {!resumeFile ? (
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  padding: '1.5rem 1rem',
                  border: `2px dashed ${formErrors.resume ? 'var(--error, #ef4444)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.2s ease'
                }}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleResumeChange}
                    style={{ display: 'none' }}
                  />
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V16" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Rezyume faylini tanlang
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    PDF, DOC yoki DOCX &middot; maksimal 10MB
                  </span>
                </label>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)'
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {resumeFile.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {formatFileSize(resumeFile.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResumeRemove}
                    aria-label="Rezyumeni olib tashlash"
                    style={{
                      flexShrink: 0,
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      borderRadius: '50%',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      lineHeight: 1
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {formErrors.resume && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error, #ef4444)' }}>
                  {formErrors.resume}
                </span>
              )}
            </div>

            <Textarea
              label="Qo'shimcha izohlar"
              name="notes"
              value={candidateData.notes}
              onChange={handleCandidateChange}
              placeholder="O'zingiz va tajribangiz haqida qo'shimcha ma'lumotlar..."
              rows={3}
            />

            <Button
              type="submit"
              fullWidth
              loading={isSubmittingCandidate}
              disabled={isSubmittingCandidate || (isRequirementsCheckNeeded && !acceptedRequirements)}
              style={{ marginTop: '0.5rem' }}
            >
              Tasdiqlash va Ariza Topshirish
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ overflowY: 'auto', padding: '2rem 1rem' }}>
      {/* Theme Toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
        <ThemeToggle />
      </div>

      {/* Left Branding Panel */}
      <div className="login-left">
        <div className="login-brand animate-fade-in-up">
          <h1>HR Platform</h1>
          <p>Yangi xodim sifatida ro'yxatdan o'tish va tizimda o'z faoliyatingizni boshlash.</p>
        </div>
      </div>

      {/* Right Registration Form */}
      <div className="login-right">
        <div className="login-form-wrapper" style={{ width: '100%', maxWidth: '480px' }}>
          <h2 className="login-form-title">Ro'yxatdan o'tish</h2>
          <p className="login-form-subtitle">Tizimga a'zo bo'lish uchun ma'lumotlaringizni to'ldiring.</p>

          {/* Token error or Global registration error */}
          {(tokenError || registerError) && (
            <div className="login-error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', fontSize: '0.875rem' }}>
              {tokenError || registerError}
            </div>
          )}

          {!tokenError && (
            // Standard Admin/HR Registration Form
            <form onSubmit={handleSubmit} className="login-form">
                
                {/* Display invited position and requirements checklist if present */}
                {inviteDetails && inviteDetails.position && (
                  <div style={{
                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      💼 Tanlangan lavozim: <span style={{ color: 'var(--text-primary)' }}>{inviteDetails.position}</span>
                    </h3>
                    
                    {inviteDetails.requirements && inviteDetails.requirements.length > 0 && (
                      <>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontWeight: '600' }}>
                          Lavozim majburiyatlari va kundalik vazifalar:
                        </p>
                        <ul style={{ 
                          listStyle: 'none', 
                          margin: 0, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.5rem',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.75rem',
                          background: 'var(--bg-secondary)'
                        }}>
                          {inviteDetails.requirements.map((req, idx) => (
                            <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                              <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.85rem' }}>✓</span>
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                        
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '0.5rem', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem', 
                          fontWeight: '600', 
                          color: 'var(--text-primary)', 
                          borderTop: '1px solid var(--border)', 
                          paddingTop: '0.75rem',
                          marginTop: '0.25rem',
                          userSelect: 'none'
                        }}>
                          <input
                            type="checkbox"
                            checked={acceptedRequirements}
                            onChange={(e) => setAcceptedRequirements(e.target.checked)}
                            style={{ marginTop: '0.1rem', cursor: 'pointer' }}
                            required
                          />
                          <span>Lavozim talablari va kundalik vazifalar bilan tanishdim va roziman</span>
                        </label>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Input
                    label="Ism"
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Ali"
                    error={formErrors.firstName}
                    required
                  />
                  <Input
                    label="Familiya"
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Valiyev"
                    error={formErrors.lastName}
                    required
                  />
                </div>

                <Input
                  label="Email manzili"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ali.valiyev@company.com"
                  error={formErrors.email}
                  required
                />

                <Input
                  label="Parol"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Kamida 8 belgi"
                  error={formErrors.password}
                  required
                />

                <Input
                  label="Parolni tasdiqlash"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••"
                  error={formErrors.confirmPassword}
                  required
                />

                <Button
                  type="submit"
                  fullWidth
                  loading={isRegistering}
                  disabled={isRegistering || (isRequirementsCheckNeeded && !acceptedRequirements)}
                  style={{ marginTop: '0.5rem' }}
                >
                  Ro'yxatdan o'tish
                </Button>
              </form>
          )}

          {tokenError && (
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate('/login')}
              style={{ marginTop: '1rem' }}
            >
              Kirish sahifasiga o'tish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
