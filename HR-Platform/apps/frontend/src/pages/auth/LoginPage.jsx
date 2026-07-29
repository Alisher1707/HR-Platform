import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ThemeToggle from '../../components/ui/ThemeToggle';

/**
 * LoginPage Component
 * Professional minimal design with modern aesthetics
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [formErrors, setFormErrors] = useState({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const user = useAuthStore.getState().user;
      if (user?.role === 'HR') {
        navigate('/hr/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    }
  }, [isAuthenticated, navigate]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear field error on change
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
      errors.email = 'Email majburiy';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email formati noto\'g\'ri';
    }

    if (!formData.password) {
      errors.password = 'Parol majburiy';
    } else if (formData.password.length < 8) {
      errors.password = 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak';
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
      await login(formData.email, formData.password);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  return (
    <div className="login-page-modern">
      {/* Theme Toggle - Top Right */}
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      {/* Left side: Minimal Branding */}
      <div className="login-brand-section">
        <div className="login-brand-content">
          <div className="login-logo-wrapper">
            <div className="login-logo">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="48" height="48" rx="12" fill="url(#gradient)" />
                <path
                  d="M16 18H20V30H16V18Z"
                  fill="white"
                />
                <path
                  d="M24 18H28V24H32V28H28V30H24V18Z"
                  fill="white"
                />
                <defs>
                  <linearGradient
                    id="gradient"
                    x1="0"
                    y1="0"
                    x2="48"
                    y2="48"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="login-brand-title">HR Platform</h1>
          </div>

          <p className="login-brand-subtitle">
            Kompaniya xodimlari va ishga qabul qilish jarayonlarini boshqarish tizimi
          </p>

          <div className="login-features-minimal">
            <div className="feature-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <span>Dashboard & Analitika</span>
            </div>
            <div className="feature-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <span>Lead Board</span>
            </div>
            <div className="feature-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Xodimlar boshqaruvi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Login form */}
      <div className="login-form-section">
        <div className="login-form-container">
          <div className="login-form-header">
            <h2>Xush kelibsiz!</h2>
            <p>Tizimga kirish uchun login ma'lumotlaringizni kiriting</p>
          </div>

          {/* Global error message */}
          {error && (
            <div className="login-alert-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form-modern">
            <Input
              label="Email manzili"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@hrplatform.com"
              error={formErrors.email}
              required
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              }
            />

            <Input
              label="Maxfiy parol"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              error={formErrors.password}
              required
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
            >
              Kirish
            </Button>
          </form>

          {/* Demo account helper */}
          {import.meta.env.DEV && (
            <div className="login-demo-card">
              <div className="demo-card-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>Demo Hisoblar</span>
              </div>

              <div className="demo-accounts">
                <div className="demo-account-item">
                  <span className="demo-label">Admin:</span>
                  <div className="demo-credentials">
                    <code>admin@hrplatform.com</code>
                    <span className="demo-divider">/</span>
                    <code>Admin123!@#</code>
                  </div>
                </div>

                <div className="demo-account-item">
                  <span className="demo-label">HR Manager:</span>
                  <div className="demo-credentials">
                    <code>hr@hrplatform.com</code>
                    <span className="demo-divider">/</span>
                    <code>HR123!@#</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
