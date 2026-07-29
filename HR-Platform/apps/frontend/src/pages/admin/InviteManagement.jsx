import React, { useState, useEffect } from 'react';
import inviteService from '../../services/inviteService';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import useToast from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';

// Job templates directly derived from LAVOZIM YO'RIQNOMASI.md and generic roles
const JOB_TEMPLATES = {
  'Tozalik xodimasi': [
    'Kiyim toza va tartibli (shaxsiy ko‘rinish)',
    'Ish anjomlari va vositalari tayyor bo‘lishi (paqir, latta, vositalar)',
    'Xonalarda ortiqcha chiqindilar yo‘qligi (chiqindi qutilarini tekshirish)',
    'Pol toza va artilgan holatda bo‘lishi',
    'Deraza tokchalari changsiz bo‘lishi (podokonnik)',
    'Chiqindilar to‘liq olib chiqib tashlanganligi',
    'Kuller toza holatda bo‘lishi',
    'Parta va stul oyoqlari tozaligi (haftalik vazifa)',
    'Oynalar dog‘siz va toza bo‘lishi (haftalik vazifa)'
  ],
  'Dasturchi': [
    'Clean Code yozish va standartlarga rioya qilish',
    'Kodni Git-ga o\'z vaqtida yuklash va ko\'rib chiqishga topshirish',
    'Kundalik Scrum uchrashuvlarida qatnashish',
    'Buglar va xatoliklarni o\'z vaqtida tuzatish',
    'Code review jarayonida faol ishtirok etish'
  ],
  'HR Manager': [
    'Nomzodlarni intervyuga chaqirish va suhbat o\'tkazish',
    'Ishchilar ma\'lumotlarini to\'ldirish va yangilab borish',
    'Lead doskasini faol yuritish',
    'Tizim taklifnomalarini boshqarish'
  ],
  'SMM mutaxassisi': [
    'Ijtimoiy tarmoqlar uchun haftalik kontent-plan tayyorlash',
    'Postlar va dizaynlarni o\'z vaqtida joylashtirish',
    'Obunachilar sharhlari va xabarlariga javob berish',
    'Reklama kampaniyalarini sozlash va tahlil qilish'
  ]
};

/**
 * InviteManagement Component
 * Premium invite creation, table listing, deactivate, delete and copy clipboard actions
 */
export function InviteManagement() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const canDeactivate = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';
  const canDelete = user?.role === 'SUPER_ADMIN';
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [creating, setCreating] = useState(false);

  // Form states inside Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState('Tozalik xodimasi');
  const [customJob, setCustomJob] = useState('');
  const [requirements, setRequirements] = useState(JOB_TEMPLATES['Tozalik xodimasi']);
  const [customReq, setCustomReq] = useState('');

  const fetchInvites = async () => {
    try {
      const data = await inviteService.getInvites();
      setInvites(data || []);
    } catch (err) {
      toast.error('Taklifnomalarni yuklashda xatolik yuz berdi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleOpenModal = () => {
    setSelectedJob('Tozalik xodimasi');
    setCustomJob('');
    setRequirements(JOB_TEMPLATES['Tozalik xodimasi']);
    setCustomReq('');
    setIsModalOpen(true);
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const position = selectedJob === 'Boshqa' ? customJob : selectedJob;
      const newInvite = await inviteService.createInvite({
        position,
        requirements
      });
      toast.success('Yangi taklifnoma muvaffaqiyatli yaratildi!');
      setInvites((prev) => [newInvite, ...prev]);
      setIsModalOpen(false);
    } catch (err) {
      toast.error('Taklifnoma yaratishda xatolik yuz berdi');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRequirement = (req) => {
    if (requirements.includes(req)) {
      setRequirements(requirements.filter((r) => r !== req));
    } else {
      setRequirements([...requirements, req]);
    }
  };

  const handleAddCustomReq = () => {
    if (customReq.trim() && !requirements.includes(customReq.trim())) {
      setRequirements([...requirements, customReq.trim()]);
      setCustomReq('');
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await inviteService.deactivateInvite(id);
      toast.success('Taklifnoma muvaffaqiyatli faolsizlantirildi');
      // Update local state
      setInvites((prev) => 
        prev.map((inv) => (inv.id === id ? { ...inv, is_active: false } : inv))
      );
    } catch (err) {
      toast.error('Taklifnomani faolsizlantirishda xatolik yuz berdi');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Haqiqatan ham ushbu taklifnomani o\'chirib tashlamoqchimisiz?')) return;
    
    try {
      await inviteService.deleteInvite(id);
      toast.success('Taklifnoma o\'chirib tashlandi');
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      toast.error('Taklifnomani o\'chirishda xatolik yuz berdi');
      console.error(err);
    }
  };

  const copyToClipboard = async (url) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Taklifnoma havolasi buferga nusxalandi! 📋');
    } catch (err) {
      toast.error('Nusxalashda xatolik yuz berdi');
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Taklifnomalar ro'yxati yuklanmoqda..." />;
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Taklifnomalar havolalari</h2>
          <p className="page-subtitle">Kompaniyaning boshqa xodimlari ro'yxatdan o'tishi uchun taklifnomalar boshqaruvi.</p>
        </div>
        <div className="page-header-right">
          <Button 
            variant="primary" 
            onClick={handleOpenModal} 
            icon="🔗"
          >
            Havola yaratish
          </Button>
        </div>
      </div>

      <Card>
        {invites.length === 0 ? (
          <EmptyState
            title="Taklifnomalar mavjud emas"
            text="Hozircha hech qanday taklifnoma yaratilmagan. Yuqoridagi tugmani bosib yangi havola yaratishingiz mumkin."
            icon="🔗"
            action={
              <Button variant="primary" onClick={handleOpenModal}>
                Yangi havola yaratish
              </Button>
            }
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Yaratilgan sana</th>
                  <th>Lavozim</th>
                  <th>Amal qilish muddati</th>
                  <th>Yaratuvchi</th>
                  <th>Ishlatuvchi</th>
                  <th>Holati</th>
                  <th style={{ textAlign: 'right' }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  const isUsed = !!inv.used_at;
                  const isJobInvite = !!inv.position;
                  
                  let statusBadge = <Badge variant="success">Faol</Badge>;
                  if (isExpired) {
                    statusBadge = <Badge variant="error">Muddati o'tgan</Badge>;
                  } else if (!inv.is_active) {
                    statusBadge = <Badge variant="warning">Nofaol</Badge>;
                  } else if (isUsed && !isJobInvite) {
                    statusBadge = <Badge variant="info">Ishlatilgan</Badge>;
                  } else if (isUsed && isJobInvite) {
                    statusBadge = <Badge variant="success">Faol (Arizalar tushgan)</Badge>;
                  }

                  const canCopy = inv.is_active && !isExpired && (!isUsed || isJobInvite);

                  return (
                    <tr key={inv.id}>
                      <td>{formatDate(inv.created_at)}</td>
                      <td>
                        <strong style={{ color: 'var(--accent)' }}>
                          {inv.position || 'Umumiy (Lavozimsiz)'}
                        </strong>
                      </td>
                      <td>{formatDate(inv.expires_at)}</td>
                      <td>
                        {inv.created_by 
                          ? `${inv.created_by.first_name} ${inv.created_by.last_name}` 
                          : 'Tizim'}
                      </td>
                      <td>
                        {inv.used_by 
                          ? `${inv.used_by.first_name} ${inv.used_by.last_name} (${inv.used_by.email})` 
                          : (isJobInvite && isUsed ? 'Nomzodlar topshirgan' : '—')}
                      </td>
                      <td>{statusBadge}</td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                          {canCopy && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => copyToClipboard(inv.invite_url)}
                              >
                                Nusxalash
                              </Button>
                              {canDeactivate && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDeactivate(inv.id)}
                                  style={{ color: 'var(--warning)' }}
                                >
                                  Faolsizlantirish
                                </Button>
                              )}
                            </>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(inv.id)}
                              style={{ color: 'var(--error)' }}
                            >
                              O'chirish
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invite Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Yangi taklifnoma yaratish"
        size="md"
      >
        <form onSubmit={handleCreateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="form-label font-semibold" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Lavozim tanlash
            </label>
            <select
              className="form-input"
              value={selectedJob}
              onChange={(e) => {
                const job = e.target.value;
                setSelectedJob(job);
                if (job !== 'Boshqa') {
                  setRequirements(JOB_TEMPLATES[job] || []);
                } else {
                  setRequirements([]);
                }
              }}
              style={{ 
                width: '100%', 
                padding: '0.625rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border)', 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
              }}
            >
              <option value="Tozalik xodimasi">Tozalik xodimasi (LAVOZIM YO'RIQNOMASI.md)</option>
              <option value="Dasturchi">Dasturchi</option>
              <option value="HR Manager">HR Manager</option>
              <option value="SMM mutaxassisi">SMM mutaxassisi</option>
              <option value="Boshqa">Boshqa (Qo'lda kiritish...)</option>
            </select>
          </div>

          {selectedJob === 'Boshqa' && (
            <Input
              label="Lavozim nomini kiriting"
              type="text"
              value={customJob}
              onChange={(e) => setCustomJob(e.target.value)}
              placeholder="Masalan: Grafik dizayner"
              required
            />
          )}

          <div>
            <label className="form-label font-semibold" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Lavozim talablari va vazifalari
            </label>
            
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.75rem', 
              background: 'var(--bg-secondary)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem' 
            }}>
              {selectedJob !== 'Boshqa' && JOB_TEMPLATES[selectedJob]?.map((req, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={requirements.includes(req)}
                    onChange={() => handleToggleRequirement(req)}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <span>{req}</span>
                </label>
              ))}

              {requirements.filter(r => selectedJob === 'Boshqa' || !JOB_TEMPLATES[selectedJob]?.includes(r)).map((req, idx) => (
                <label key={`custom-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={requirements.includes(req)}
                    onChange={() => handleToggleRequirement(req)}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <span style={{ color: 'var(--accent)' }}>{req} (Qo'shilgan)</span>
                </label>
              ))}

              {requirements.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                  Hozircha hech qanday talab tanlanmadi.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              value={customReq}
              onChange={(e) => setCustomReq(e.target.value)}
              placeholder="Yangi talab yoki vazifa qo'shish..."
              style={{ flex: 1 }}
            />
            <Button type="button" variant="outline" onClick={handleAddCustomReq}>
              + Qo'shish
            </Button>
          </div>

          <div className="flex justify-end gap-3 mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={creating}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" loading={creating} disabled={creating || (!customJob.trim() && selectedJob === 'Boshqa')}>
              Havola yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default InviteManagement;
