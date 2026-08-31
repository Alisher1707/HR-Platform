import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Rocket,
  CheckCircle2,
  Circle,
  PartyPopper,
  Briefcase,
  FileText,
  Download,
  Send,
  Eye,
  Type,
  Upload,
  Link2,
  AlertCircle,
  Clock,
  Undo2,
} from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { extractYouTubeId } from '../../utils/youtube';

const SUBMISSION_TYPES = [
  { value: 'text', label: 'Matn', icon: Type },
  { value: 'file', label: 'Fayl', icon: Upload },
  { value: 'link', label: 'Havola', icon: Link2 },
];

const SUBMISSION_FILE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp';

/**
 * OnboardingPublicPage
 * No login, no sidebar — an employee opens their personal link and submits
 * each onboarding task (grouped into numbered bosqich) as text, a file, or
 * a link — their choice. Token-gated on the backend, not user-gated.
 */
export function OnboardingPublicPage() {
  const { token } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Submission modal ---
  const [modalTask, setModalTask] = useState(null);
  const [modalMode, setModalMode] = useState('edit'); // 'edit' | 'view'
  const [subType, setSubType] = useState('text');
  const [subText, setSubText] = useState('');
  const [subLink, setSubLink] = useState('');
  const [subFile, setSubFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await onboardingService.getPublicAssignment(token);
        setAssignment(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Havola topilmadi yoki eskirgan');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  const getCompletion = (taskId) => assignment?.completions?.find((c) => c.taskId === taskId) || null;

  const openSubmitModal = (task) => {
    const existing = getCompletion(task.id);
    // Qaytarilgan vazifa to'g'ridan-to'g'ri tahrirlash rejimida ochiladi
    // (avvalgi javob bilan to'ldirilgan holda) — xodim sababni ko'rib,
    // darhol tuzatib qayta topshirsin, alohida "Ko'rish" bosqichisiz.
    const shouldEdit = !existing || existing.reviewStatus === 'rejected';
    setModalTask(task);
    setModalMode(shouldEdit ? 'edit' : 'view');
    setSubType(existing?.submissionType || 'text');
    setSubText(existing?.submissionType === 'text' ? existing.submissionText || '' : '');
    setSubLink(existing?.submissionType === 'link' ? existing.submissionLink || '' : '');
    setSubFile(null);
    setFormError('');
  };

  const closeModal = () => setModalTask(null);

  const handleSubmit = async () => {
    if (subType === 'text' && !subText.trim()) {
      setFormError('Matn kiriting');
      return;
    }
    if (subType === 'link' && !/^https?:\/\/.+/i.test(subLink.trim())) {
      setFormError("To'g'ri havola kiriting (http:// yoki https:// bilan boshlanishi kerak)");
      return;
    }
    if (subType === 'file' && !subFile) {
      setFormError('Fayl tanlang');
      return;
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      const updated = await onboardingService.submitTask(token, modalTask.id, {
        type: subType,
        text: subText,
        link: subLink,
        file: subFile,
      });
      setAssignment(updated);
      setModalTask(null);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Topshirishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="onboarding-public-page">
        <LoadingSpinner fullScreen text="Yuklanmoqda..." />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="onboarding-public-page">
        <div className="onboarding-public-card onboarding-public-error">
          <span className="onboarding-public-error-icon"><Rocket size={32} strokeWidth={1.75} /></span>
          <h2>Havola topilmadi</h2>
          <p>{error || 'Bu havola noto\'g\'ri yoki muddati o\'tgan bo\'lishi mumkin.'}</p>
        </div>
      </div>
    );
  }

  const isComplete = assignment.progress === 100;
  const existingCompletion = modalTask ? getCompletion(modalTask.id) : null;

  return (
    <div className="onboarding-public-page">
      <div className="onboarding-public-card">
        <div className="onboarding-public-brand">
          <span className="onboarding-public-brand-icon"><Briefcase size={18} strokeWidth={2.25} /></span>
          <span>Platform</span>
        </div>

        <div className="onboarding-public-header">
          <span className="onboarding-public-header-icon">
            {isComplete ? <PartyPopper size={26} strokeWidth={2} /> : <Rocket size={26} strokeWidth={2} />}
          </span>
          <div>
            <h1>{assignment.planName}</h1>
            <p>Xush kelibsiz, {assignment.employeeName}!</p>
          </div>
        </div>

        <div className="onboarding-public-progress">
          <div className="onboarding-public-progress-track">
            <div
              className={`onboarding-public-progress-fill ${isComplete ? 'complete' : ''}`}
              style={{ width: `${assignment.progress}%` }}
            />
          </div>
          <span>{assignment.completedSteps} / {assignment.totalSteps} vazifa bajarildi ({assignment.progress}%)</span>
        </div>

        {isComplete && (
          <div className="onboarding-public-complete-banner">
            <PartyPopper size={18} strokeWidth={2.25} />
            Barcha vazifalarni muvaffaqiyatli yakunladingiz!
          </div>
        )}

        <div className="onboarding-public-steps">
          {assignment.steps.map((step, stepIdx) => (
            <div key={step.id} className="onboarding-public-step-group">
              <div className="onboarding-public-step-group-title">{stepIdx + 1}-bosqich</div>

              {step.tasks.map((task) => {
                const completion = getCompletion(task.id);
                const reviewStatus = completion?.reviewStatus || null; // null | pending | approved | rejected
                const youtubeId = task.type === 'video' ? extractYouTubeId(task.videoUrl) : null;
                return (
                  <div key={task.id} className="onboarding-public-task">
                    {youtubeId && (
                      <div className="onboarding-public-video">
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          title={task.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {task.type === 'hujjat' && task.documentUrl && (
                      <a
                        className="onboarding-public-doc"
                        href={onboardingService.getDocumentUrl(task.documentUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={16} strokeWidth={2.25} />
                        <span>{task.documentName || 'Hujjatni ko\'rish'}</span>
                        <Download size={14} strokeWidth={2.25} />
                      </a>
                    )}
                    <div className={`onboarding-public-step ${reviewStatus ? `review-${reviewStatus}` : ''}`}>
                      <span className="onboarding-public-step-check">
                        {reviewStatus === 'approved' && <CheckCircle2 size={22} strokeWidth={2} />}
                        {reviewStatus === 'pending' && <Clock size={22} strokeWidth={1.75} />}
                        {reviewStatus === 'rejected' && <AlertCircle size={22} strokeWidth={1.75} />}
                        {!reviewStatus && <Circle size={22} strokeWidth={1.75} />}
                      </span>
                      <span className="onboarding-public-step-text">
                        <span className="onboarding-public-step-title">{task.title}</span>
                        {task.description && <span className="onboarding-public-step-desc">{task.description}</span>}
                        {reviewStatus === 'pending' && (
                          <span className="onboarding-public-step-status pending">HR ko'rib chiqmoqda</span>
                        )}
                        {reviewStatus === 'rejected' && (
                          <span className="onboarding-public-step-status rejected">
                            {completion.reviewComment ? `Qaytarildi: ${completion.reviewComment}` : "Qaytarildi — qayta topshiring"}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className={`onboarding-public-submit-btn ${reviewStatus ? `status-${reviewStatus}` : ''}`}
                        onClick={() => openSubmitModal(task)}
                      >
                        {!reviewStatus && <><Send size={14} strokeWidth={2.25} /> Topshirish</>}
                        {(reviewStatus === 'pending' || reviewStatus === 'approved') && <><Eye size={14} strokeWidth={2.25} /> Ko'rish</>}
                        {reviewStatus === 'rejected' && <><Undo2 size={14} strokeWidth={2.25} /> Qayta topshirish</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={!!modalTask}
        onClose={closeModal}
        title={modalMode === 'view' ? 'Topshirilgan vazifa' : 'Vazifani topshirish'}
        size="sm"
        footer={
          modalMode === 'view' ? (
            <>
              <Button variant="ghost" className="onboarding-btn-wide" onClick={closeModal}>Yopish</Button>
              <Button variant="primary" className="onboarding-btn-wide" onClick={() => setModalMode('edit')}>
                Qayta topshirish
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="onboarding-btn-wide" onClick={closeModal}>Bekor qilish</Button>
              <Button variant="primary" className="onboarding-btn-wide" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Yuborilmoqda...' : 'Yuborish'}
              </Button>
            </>
          )
        }
      >
        {modalTask && (
          <>
            <p className="onboarding-submit-task-title">{modalTask.title}</p>

            {modalMode === 'view' && existingCompletion ? (
              <div className="onboarding-submission-view">
                <div className={`onboarding-submission-view-meta status-${existingCompletion.reviewStatus}`}>
                  {existingCompletion.reviewStatus === 'approved' && <CheckCircle2 size={15} strokeWidth={2.25} />}
                  {existingCompletion.reviewStatus === 'pending' && <Clock size={15} strokeWidth={2.25} />}
                  {existingCompletion.reviewStatus === 'approved' && 'HR tomonidan qabul qilindi'}
                  {existingCompletion.reviewStatus === 'pending' && "HR ko'rib chiqmoqda"}
                </div>
                <div className="onboarding-submission-view-date">
                  <Clock size={12} strokeWidth={2.25} /> Topshirilgan: {new Date(existingCompletion.completedAt).toLocaleString('uz-UZ')}
                </div>
                {existingCompletion.submissionType === 'text' && (
                  <p className="onboarding-submission-text">{existingCompletion.submissionText}</p>
                )}
                {existingCompletion.submissionType === 'link' && (
                  <a
                    href={existingCompletion.submissionLink}
                    target="_blank"
                    rel="noreferrer"
                    className="onboarding-public-doc"
                  >
                    <Link2 size={16} strokeWidth={2.25} />
                    <span>{existingCompletion.submissionLink}</span>
                  </a>
                )}
                {existingCompletion.submissionType === 'file' && (
                  <a
                    href={onboardingService.getDocumentUrl(existingCompletion.submissionFileUrl, token)}
                    target="_blank"
                    rel="noreferrer"
                    className="onboarding-public-doc"
                  >
                    <FileText size={16} strokeWidth={2.25} />
                    <span>{existingCompletion.submissionFileName || 'Fayl'}</span>
                    <Download size={14} strokeWidth={2.25} />
                  </a>
                )}
              </div>
            ) : (
              <>
                {existingCompletion?.reviewStatus === 'rejected' && (
                  <div className="onboarding-reject-banner">
                    <AlertCircle size={15} strokeWidth={2.25} />
                    <span>
                      {existingCompletion.reviewComment
                        ? `HR qaytardi: ${existingCompletion.reviewComment}`
                        : 'HR bu vazifani qaytardi — tuzatib qayta topshiring'}
                    </span>
                  </div>
                )}
                <div className="onboarding-submit-type-tabs">
                  {SUBMISSION_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`onboarding-submit-type-tab ${subType === t.value ? 'active' : ''}`}
                      onClick={() => { setSubType(t.value); setFormError(''); }}
                    >
                      <t.icon size={15} strokeWidth={2.25} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {subType === 'text' && (
                  <textarea
                    className="form-textarea"
                    rows={5}
                    placeholder="Bajargan ishingiz haqida yozing..."
                    value={subText}
                    onChange={(e) => setSubText(e.target.value)}
                    autoFocus
                  />
                )}
                {subType === 'link' && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://..."
                    value={subLink}
                    onChange={(e) => setSubLink(e.target.value)}
                    autoFocus
                  />
                )}
                {subType === 'file' && (
                  <label className={`onboarding-doc-upload-btn ${subFile ? 'has-file' : ''}`}>
                    <Upload size={14} strokeWidth={2.25} />
                    {subFile ? subFile.name : 'Fayl tanlash (PDF, DOC, DOCX, JPG, PNG)'}
                    <input
                      type="file"
                      accept={SUBMISSION_FILE_ACCEPT}
                      onChange={(e) => setSubFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}

                {formError && (
                  <span className="onboarding-task-field-error">
                    <AlertCircle size={12} strokeWidth={2.25} /> {formError}
                  </span>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

export default OnboardingPublicPage;
