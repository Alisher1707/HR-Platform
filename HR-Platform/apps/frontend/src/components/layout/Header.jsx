import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Radar,
  CalendarDays,
  Globe,
  Settings,
  Factory,
  ChevronDown,
  Sparkles,
  Check,
} from 'lucide-react';
import { useLanguageStore, LANGUAGES } from '../../store/languageStore';
import ThemeToggle from '../ui/ThemeToggle';

/**
 * Header Component
 * Premium top navigation bar with module pills, theme switcher and
 * responsive menu toggler
 */
export function Header({ onMenuClick }) {
  const { language, setLanguage } = useLanguageStore();
  const location = useLocation();
  const activeSection = new URLSearchParams(location.search).get('section') || 'davomat';
  const isAttendancePage = location.pathname === '/admin/attendance';

  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="btn btn-ghost btn-icon"
          onClick={onMenuClick}
          style={{ display: 'none' /* Will be toggled on mobile via CSS */ }}
          id="mobile-menu-toggle"
        >
          ☰
        </button>

        <div className="header-logo">
          <Sparkles size={17} strokeWidth={2.25} />
        </div>

        <nav className="header-nav">
          <Link
            to="/admin/attendance"
            className={`header-pill ${isAttendancePage && activeSection === 'davomat' ? 'active' : ''}`}
          >
            <LayoutDashboard size={15} strokeWidth={2.25} /> Boshqaruv paneli <ChevronDown size={13} />
          </Link>
          <NavLink
            to="/admin/organization"
            className={({ isActive }) => `header-pill ${isActive ? 'active' : ''}`}
          >
            <Building2 size={15} strokeWidth={2.25} /> Tashkilot tuzilmasi <ChevronDown size={13} />
          </NavLink>
          <Link
            to="/admin/attendance?section=moliya"
            className={`header-pill ${isAttendancePage && activeSection === 'moliya' ? 'active' : ''}`}
          >
            <CreditCard size={15} strokeWidth={2.25} /> Moliya <ChevronDown size={13} />
          </Link>
          <Link
            to="/admin/attendance?section=monitoring"
            className={`header-pill ${isAttendancePage && activeSection === 'monitoring' ? 'active' : ''}`}
          >
            <Radar size={15} strokeWidth={2.25} /> Monitoring <ChevronDown size={13} />
          </Link>
          <NavLink
            to="/admin/ish-jadvallari"
            className={({ isActive }) => `header-pill ${isActive ? 'active' : ''}`}
          >
            <CalendarDays size={15} strokeWidth={2.25} /> Ish jadvallari <ChevronDown size={13} />
          </NavLink>
        </nav>
      </div>

      <div className="header-right">
        <div className="header-lang" ref={langRef}>
          <button
            type="button"
            className="header-pill"
            onClick={() => setIsLangOpen((prev) => !prev)}
          >
            <Globe size={15} strokeWidth={2.25} /> {language.toUpperCase()} <ChevronDown size={13} />
          </button>
          {isLangOpen && (
            <div className="header-lang-menu">
              {LANGUAGES.map((lang) => (
                <button
                  type="button"
                  key={lang.code}
                  className={`header-lang-option ${lang.code === language ? 'active' : ''}`}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsLangOpen(false);
                  }}
                >
                  <span>{lang.label}</span>
                  {lang.code === language && <Check size={14} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <ThemeToggle className="header-icon-btn" />
        <span className="header-icon-btn" title="Sozlamalar">
          <Settings size={16} strokeWidth={2.25} />
        </span>
        <span className="header-pill">
          <Factory size={15} strokeWidth={2.25} /> IT Live
        </span>
      </div>
    </header>
  );
}

export default Header;
