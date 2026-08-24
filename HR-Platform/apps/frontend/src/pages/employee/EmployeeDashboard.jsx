import React from 'react';
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';

/**
 * EmployeeDashboard
 *
 * Landing page for the EMPLOYEE role. Every candidate who registers through
 * a position-bearing invite link ends up with this role (see
 * auth.service.js#registerUser), but until now there was no route allowed
 * for it — AppRouter only defined ADMIN/SUPER_ADMIN and HR pages, so an
 * EMPLOYEE who logged in successfully bounced between LoginPage and
 * RootRedirect forever (each sending them somewhere their role couldn't
 * access) without ever seeing a screen. This page is the minimum honest
 * fix: a real destination that explains the account's status instead of a
 * silent infinite redirect.
 */
export function EmployeeDashboard() {
  const { user } = useAuthStore();

  return (
    <div className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Xush kelibsiz{user?.firstName ? `, ${user.firstName}` : ''}!</h2>
          <p className="page-subtitle font-medium">Sizning hisobingiz faollashtirildi.</p>
        </div>
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--success-light, #e4f2ea)',
              color: 'var(--success, #146c43)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
              Ro'yxatdan o'tish yakunlandi
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Hisobingiz tizimda ro'yxatga olindi va HR bo'limi tomonidan ko'rib chiqilmoqda.
              Shaxsiy kabinet (davomat, jarimalar va onboarding rejangizni ko'rish) hozircha
              ishlab chiqilmoqda — tez orada shu sahifada mavjud bo'ladi.
            </p>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-color, #e6eaef)' }} />

        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mail size={20} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
              Savollaringiz bormi?
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Ish joyi, jadval yoki hujjatlar bo'yicha savollaringiz bo'lsa, to'g'ridan-to'g'ri
              HR bo'limiga murojaat qiling.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
          }}
        >
          <ShieldCheck size={14} strokeWidth={2} />
          <span>{user?.email}</span>
        </div>
      </Card>
    </div>
  );
}

export default EmployeeDashboard;
