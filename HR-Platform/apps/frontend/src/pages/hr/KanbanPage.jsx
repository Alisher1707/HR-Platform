import React, { useState, useEffect } from 'react';
import useKanban from '../../hooks/useKanban';
import applicationService from '../../services/applicationService';
import employeeService from '../../services/employeeService';
import KanbanBoard from '../../components/kanban/KanbanBoard';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useToast from '../../hooks/useToast';

/**
 * KanbanPage Component
 * Renders the main recruiter page with filters, search, the Kanban board, and detailed overlay modal.
 */
export function KanbanPage() {
  const { toast } = useToast();
  
  // State for search and position filters
  const [search, setSearch] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Query hook
  const { 
    applications, 
    isLoading, 
    updateStatus, 
    updateDetails 
  } = useKanban();

  // Modal states
  const [selectedApp, setSelectedApp] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  
  // Edit detail form states inside Modal
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [updatingInfo, setUpdatingInfo] = useState(false);

  // Suhbatga chaqirish: vaqt tanlash paneli.
  // Sana va vaqt alohida maydonlarda — datetime-local'da vaqt kiritilmaguncha
  // qiymat bo'sh qolib, qo'lda kiritishda tugma ochilmasdi.
  const [showInterviewPicker, setShowInterviewPicker] = useState(false);
  const [interviewDatePart, setInterviewDatePart] = useState('');
  const [interviewTimePart, setInterviewTimePart] = useState('09:00');

  // ISO sanani date/time input qiymatlariga ajratish (mahalliy vaqt)
  const toDateTimeParts = (iso) => {
    if (!iso) return { date: '', time: '09:00' };
    const d = new Date(iso);
    if (isNaN(d)) return { date: '', time: '09:00' };
    const pad = (n) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };

  // Suhbat vaqtini o'qish uchun format: 17.07.2026, 14:30
  const formatInterviewDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return iso;
    }
  };

  // Fetch employees list for assigning
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await employeeService.getEmployees({ limit: 100 });
        const empList = response.data || [];
        setAllEmployees(empList.map(e => ({
          value: e.id,
          label: `${e.firstName || e.first_name} ${e.lastName || e.last_name}`
        })));
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmployees();
  }, []);

  // Fetch history when application is selected
  useEffect(() => {
    if (selectedApp) {
      setNotes(selectedApp.notes || '');
      setAssignedTo(selectedApp.assignedTo || '');
      setStatusComment('');
      setShowInterviewPicker(false);
      const parts = toDateTimeParts(selectedApp.interviewDate);
      setInterviewDatePart(parts.date);
      setInterviewTimePart(parts.time);
      
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const logs = await applicationService.getApplicationHistory(selectedApp.id);
          setHistory(logs || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingHistory(false);
        }
      };
      
      fetchHistory();
    }
  }, [selectedApp]);

  // Handle status changes (Drag & Drop or quick transition button)
  const handleStatusChange = async (id, newStatus, comment = 'Holati yangilandi', interviewDate = undefined) => {
    try {
      setChangingStatus(true);
      await updateStatus({ id, status: newStatus, comment, interviewDate });

      // If modal is open, update its local status display or re-fetch details
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp(prev => ({
          ...prev,
          status: newStatus,
          ...(interviewDate !== undefined ? { interviewDate } : {}),
        }));
        // Refresh history
        const logs = await applicationService.getApplicationHistory(id);
        setHistory(logs || []);
        setStatusComment('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChangingStatus(false);
    }
  };

  // Suhbat vaqti tasdiqlanganda: statusni QOSHILDI ga o'tkazib, vaqtni saqlaymiz
  const handleInterviewConfirm = async () => {
    if (!selectedApp || !interviewDatePart) return;
    const localDateTime = `${interviewDatePart}T${interviewTimePart || '09:00'}`;
    const iso = new Date(localDateTime).toISOString();
    const comment = statusComment || `Suhbatga chaqirildi — ${formatInterviewDate(localDateTime)}`;
    await handleStatusChange(selectedApp.id, 'QOSHILDI', comment, iso);
    setShowInterviewPicker(false);
  };

  // Handle saving details (notes and assignment)
  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    setUpdatingInfo(true);
    try {
      await updateDetails({
        id: selectedApp.id,
        data: {
          notes: notes || null,
          assignedTo: assignedTo || null,
        }
      });
      setSelectedApp(prev => ({ ...prev, notes, assignedTo }));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingInfo(false);
    }
  };

  // Bugun suhbati belgilangan nomzodlar soni (filtrlardan qat'i nazar)
  const todayInterviewCount = applications.filter((app) => {
    if (!app.interviewDate) return false;
    const d = new Date(app.interviewDate);
    if (isNaN(d)) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  // Filter positions options dynamically
  const uniquePositions = [...new Set(applications.map(app => app.position).filter(Boolean))];
  const positionOptions = uniquePositions.map(pos => ({ value: pos, label: pos }));

  // Apply filters in memory
  const filteredApps = applications.filter((app) => {
    const searchLower = search.toLowerCase();
    const fullName = `${app.firstName || ''} ${app.lastName || ''}`.toLowerCase();
    const position = (app.position || app.employeePosition || '').toLowerCase();
    const phone = app.phone || '';

    const searchMatch = !search ||
      fullName.includes(searchLower) ||
      position.includes(searchLower) ||
      phone.includes(search);

    const positionMatch = !selectedPosition || app.position === selectedPosition;

    // Sana oralig'i bo'yicha filtr (ariza topshirilgan sana — createdAt)
    let dateMatch = true;
    if (startDate || endDate) {
      if (!app.createdAt) {
        dateMatch = false;
      } else {
        const appTime = new Date(app.createdAt);
        if (startDate && appTime < new Date(`${startDate}T00:00:00`)) dateMatch = false;
        if (endDate && appTime > new Date(`${endDate}T23:59:59.999`)) dateMatch = false;
      }
    }

    return searchMatch && positionMatch && dateMatch;
  });

  const getStatusLabel = (s) => {
    if (s === 'KELDI') return 'Yangi ariza';
    if (s === 'QOSHILDI') return 'Suhbatda';
    if (s === 'SINOV_MUDDATI') return 'Sinov muddatida';
    if (s === 'SHARTNOMA') return 'Shartnoma tuzilgan';
    if (s === 'RAD_ETILDI') return 'Rad etildi';
    return s;
  };

  const getStatusBadgeVariant = (s) => {
    if (s === 'KELDI') return 'warning';
    if (s === 'QOSHILDI') return 'info';
    if (s === 'SINOV_MUDDATI') return 'primary';
    if (s === 'SHARTNOMA') return 'success';
    if (s === 'RAD_ETILDI') return 'danger';
    return 'info';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Ishga qabul kanbani</h2>
          <p className="page-subtitle font-medium">Nomzodlarni statuslar bo'yicha ko'chirish va suhbatlarni boshqarish.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="mb-6 flex gap-4 flex-wrap items-center" style={{ padding: '1rem' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '240px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Nomzod ismi yoki telefoni..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div style={{ width: '200px' }}>
          <Select
            placeholder="Barcha lavozimlar"
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            options={positionOptions}
            style={{ padding: '0.5rem' }}
          />
        </div>

        {/* Sana oralig'i: boshlanish — tugash (ariza topshirilgan sana bo'yicha) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="date"
            className="form-input"
            title="Boshlanish sanasi"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: '160px', padding: '0.5rem' }}
          />
          <span>—</span>
          <input
            type="date"
            className="form-input"
            title="Tugash sanasi"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '160px', padding: '0.5rem' }}
          />
        </div>

        {todayInterviewCount > 0 && (
          <div className="interview-today-badge" style={{ marginTop: 0, padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
            🔔 Bugun suhbatlar: {todayInterviewCount} ta
          </div>
        )}

        {(search || selectedPosition || startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSelectedPosition(''); setStartDate(''); setEndDate(''); }}>
            Filtrlarni tozalash
          </Button>
        )}
      </Card>

      {/* Kanban Board rendering */}
      {isLoading ? (
        <LoadingSpinner text="Kanban doskasi yuklanmoqda..." />
      ) : (
        <KanbanBoard 
          applications={filteredApps} 
          onStatusChange={(id, status) => handleStatusChange(id, status, 'Kanban taxtasida ko\'chirildi')} 
          onCardClick={setSelectedApp}
        />
      )}

      {/* Detail View Modal */}
      <Modal
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="📋 Nomzod haqida batafsil ma'lumot"
        size="xl"
      >
        {selectedApp && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }} className="modal-split">
            {/* Left side: Info & update details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Candidate Header */}
              <div style={{
                background: 'linear-gradient(135deg, var(--accent-light) 0%, rgba(99, 102, 241, 0.05) 100%)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--accent)',
                borderWidth: '2px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--accent-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.75rem',
                    fontWeight: '800',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}>
                    {selectedApp.firstName?.charAt(0)}{selectedApp.lastName?.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                      {selectedApp.firstName} {selectedApp.lastName}
                    </h3>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant={getStatusBadgeVariant(selectedApp.status)} showDot>
                        {getStatusLabel(selectedApp.status)}
                      </Badge>
                      {selectedApp.position && (
                        <span style={{
                          fontSize: '0.875rem',
                          color: 'var(--accent)',
                          fontWeight: '600',
                          background: 'var(--bg-card-solid)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--accent)'
                        }}>
                          💼 {selectedApp.position}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* General details card */}
              <Card style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                <h5 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>ℹ️</span> Umumiy ma'lumotlar
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Ism</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.firstName || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Familiya</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.lastName || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Telefon raqami</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.phone || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Email</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.email || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Tug'ilgan sana</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.birthDate ? new Date(selectedApp.birthDate).toLocaleDateString('uz-UZ') : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Yoshi</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.age ? `${selectedApp.age} yosh` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Lavozim</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.employeePosition || selectedApp.position || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Ish tajribasi (yil)</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.experience ? `${selectedApp.experience} yil` : 'Tajribasiz'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Manzil</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.address || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Telegram</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedApp.telegramUsername ? `@${selectedApp.telegramUsername}` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Rezyume</span>
                    {selectedApp.resumeUrl ? (
                      <a
                        href={applicationService.getResumeUrl(selectedApp.resumeUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          textDecoration: 'none',
                          transition: 'border-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--accent-light, rgba(99, 102, 241, 0.12))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 2V8H20" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedApp.resumeOriginalName || 'Rezyume fayli'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Nomzod yuklagan rezyume
                          </div>
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--accent)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Ochish
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Rezyume yuklanmagan
                      </span>
                    )}
                  </div>
                  {selectedApp.notes && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Qo'shimcha izohlar</span>
                      <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {selectedApp.notes}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Status transition section */}
              <Card style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                <h5 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔄</span> Bosqichni o'zgartirish
                </h5>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }} className="status-buttons">
                  <Button
                    variant={selectedApp.status === 'KELDI' ? 'primary' : 'outline'}
                    size="sm"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange(selectedApp.id, 'KELDI', statusComment || 'Suhbatga qaytarildi')}
                  >
                    Yangi Keldi
                  </Button>
                  <Button
                    variant={selectedApp.status === 'QOSHILDI' ? 'primary' : 'outline'}
                    size="sm"
                    disabled={changingStatus}
                    onClick={() => setShowInterviewPicker((v) => !v)}
                  >
                    Suhbatga chaqirish
                  </Button>
                  <Button
                    variant={selectedApp.status === 'SINOV_MUDDATI' ? 'primary' : 'outline'}
                    size="sm"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange(selectedApp.id, 'SINOV_MUDDATI', statusComment || 'Sinov muddatiga chaqirildi')}
                  >
                    Sinov Muddatiga chaqirish
                  </Button>
                  <Button
                    variant={selectedApp.status === 'SHARTNOMA' ? 'primary' : 'outline'}
                    size="sm"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange(selectedApp.id, 'SHARTNOMA', statusComment || 'Shartnoma tuzishga kelishildi')}
                  >
                    Shartnoma imzolash
                  </Button>
                  <Button
                    variant={selectedApp.status === 'RAD_ETILDI' ? 'danger' : 'outline'}
                    size="sm"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange(selectedApp.id, 'RAD_ETILDI', statusComment || 'Ariza rad etildi')}
                  >
                    Rad etish
                  </Button>
                </div>

                {/* Suhbat vaqtini belgilash paneli */}
                {showInterviewPicker && (
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'flex-end',
                    flexWrap: 'wrap',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: 'var(--accent-light)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--accent)',
                  }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <Input
                        label="Suhbat sanasi"
                        type="date"
                        value={interviewDatePart}
                        onChange={(e) => setInterviewDatePart(e.target.value)}
                      />
                    </div>
                    <div style={{ width: '110px' }}>
                      <Input
                        label="Vaqti"
                        type="time"
                        value={interviewTimePart}
                        onChange={(e) => setInterviewTimePart(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!interviewDatePart || changingStatus}
                      loading={changingStatus}
                      onClick={handleInterviewConfirm}
                    >
                      ✅ Tasdiqlash
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={changingStatus}
                      onClick={() => setShowInterviewPicker(false)}
                    >
                      Bekor qilish
                    </Button>
                  </div>
                )}

                {/* Belgilangan suhbat vaqti */}
                {selectedApp.interviewDate && !showInterviewPicker && (
                  <div style={{
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                  }}>
                    🕐 Belgilangan suhbat vaqti: {formatInterviewDate(selectedApp.interviewDate)}
                  </div>
                )}

                <Input
                  label="Izoh (Status o'zgarishi uchun sabab)"
                  type="text"
                  placeholder="Masalan: rezyume ma'qul keldi, suhbat yaxshi o'tdi"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                />
              </Card>

              {/* Edit Application Form */}
              <Card style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                <h5 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✏️</span> Qo'shimcha ma'lumotlar
                </h5>
                <form onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <Select
                    label="Mas'ul xodim"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    options={allEmployees}
                  />

                  <Textarea
                    label="Nomzod bo'yicha maxsus eslatmalar / izohlar"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Uchrashuv natijalari, rezyume bo'yicha kamchiliklar..."
                    rows={4}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    loading={updatingInfo}
                    disabled={updatingInfo}
                    style={{ width: '100%' }}
                  >
                    💾 Saqlash
                  </Button>
                </form>
              </Card>
            </div>

            {/* Right side: History timeline */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📜</span> O'zgarishlar tarixi
              </h4>
              
              {loadingHistory ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
                  <LoadingSpinner text="Tarix yuklanmoqda..." />
                </div>
              ) : history.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border)'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                  O'zgarishlar tarixi mavjud emas
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    overflowY: 'auto',
                    maxHeight: '500px',
                    paddingRight: '0.75rem'
                  }}
                  className="timeline"
                >
                  {history.map((log, index) => (
                    <div key={log.id || index} style={{
                      position: 'relative',
                      paddingLeft: '1.75rem',
                      paddingBottom: '1rem',
                      borderBottom: index < history.length - 1 ? '1px dashed var(--border)' : 'none'
                    }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '0',
                          top: '6px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          border: '3px solid var(--bg-secondary)',
                          boxShadow: '0 0 0 3px var(--accent-light)'
                        }}
                      />
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginBottom: '0.5rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        🕐 {formatDate(log.changedAt || log.changed_at)}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        <span>Holat:</span>
                        <Badge variant={getStatusBadgeVariant(log.newStatus || log.new_status)} showDot>
                          {getStatusLabel(log.newStatus || log.new_status)}
                        </Badge>
                      </div>
                      {log.comment && (
                        <div style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                          background: 'var(--bg-card)',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-lg)',
                          marginTop: '0.5rem',
                          borderLeft: '3px solid var(--accent)',
                          lineHeight: '1.5'
                        }}>
                          💬 {log.comment}
                        </div>
                      )}
                      {log.changedBy && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem'
                        }}>
                          <span>👤</span>
                          <span style={{ fontWeight: '600' }}>
                            {log.changedBy.firstName || log.changedBy.first_name} {log.changedBy.lastName || log.changedBy.last_name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @media (max-width: 800px) {
          .modal-split {
            grid-template-columns: 1fr !important;
          }
          .modal-split > div:last-child {
            border-left: none !important;
            padding-left: 0 !important;
            margin-top: 1.5rem;
            border-top: 1px solid var(--border);
            padding-top: 1.5rem;
          }
          .status-buttons {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

export default KanbanPage;
