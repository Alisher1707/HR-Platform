import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Rocket,
  BookOpen,
  TrendingUp,
  Plus,
  Trash2,
  Pencil,
  UserPlus,
  ListChecks,
  Users,
  Copy,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  Save,
  X,
  Video,
  FileText,
  Zap,
  AlertCircle,
  Upload,
  Paperclip,
  Percent,
  CalendarCheck,
} from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import employeeService from '../../services/employeeService';
import { isValidYouTubeInput } from '../../utils/youtube';
import useToast from '../../hooks/useToast';
import useConfirm from '../../hooks/useConfirm';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';

const TABS = [
  { value: 'rejalar', label: 'Rejalar', icon: BookOpen },
  { value: 'progress', label: 'Progress', icon: TrendingUp },
  { value: 'statistika', label: 'Statistika', icon: Percent },
];

let stepSeq = 0;
function emptyStep() {
  stepSeq += 1;
  // A bosqich has no content of its own — it's just a numbered container
  // for one or more vazifa (tasks), added via the "+ Vazifa qo'shish"
  // trigger inside its card.
  return { id: `new-${stepSeq}`, tasks: [] };
}

let taskSeq = 0;
function emptyTask() {
  taskSeq += 1;
  return { id: `newtask-${taskSeq}`, type: 'video', title: '', videoUrl: '', documentUrl: '', documentName: '', description: '' };
}

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function emptyPlanForm() {
  return { name: '', description: '', steps: [emptyStep()], employeeIds: [] };
}

function getPublicLink(token) {
  return `${window.location.origin}/onboarding/public/${token}`;
}

const TASK_TYPES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'hujjat', label: 'Hujjat', icon: FileText },
  { value: 'harakat', label: 'Harakat', icon: Zap },
];

/**
 * TaskTypeSelect
 * Small custom dropdown for the "Turi" field — only 3 fixed options, so no
 * search is needed, but a native <select>'s dropdown can't be restyled, so
 * this portals its own panel the same safe way SearchableSelect does
 * elsewhere in the app (position:fixed with top/bottom explicitly set to
 * 'auto', never left undefined — otherwise a leftover CSS fallback value
 * fights the inline one and collapses the panel to ~0 height).
 */
function TaskTypeSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 120 });
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
    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 6, bottom: 'auto', left: rect.left, width: Math.max(rect.width, 140) });
    }
    setIsOpen((prev) => !prev);
  };

  const selected = TASK_TYPES.find((t) => t.value === value) || TASK_TYPES[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="onboarding-type-select" ref={wrapperRef}>
      <button type="button" className={`onboarding-type-trigger ${isOpen ? 'open' : ''}`} onClick={toggleOpen}>
        <SelectedIcon size={14} strokeWidth={2.25} />
        <span>{selected.label}</span>
        <ChevronDown size={14} strokeWidth={2.25} />
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="onboarding-type-panel"
          style={{ position: 'fixed', top: popupPos.top, bottom: popupPos.bottom, left: popupPos.left, width: popupPos.width }}
        >
          {TASK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`onboarding-type-option ${t.value === value ? 'selected' : ''}`}
              onClick={() => { onChange(t.value); setIsOpen(false); }}
            >
              <t.icon size={14} strokeWidth={2.25} />
              {t.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export function OnboardingPage() {
  const { toast } = useToast();
  const { confirm, confirmProps } = useConfirm();

  const [activeTab, setActiveTab] = useState('rejalar');
  const [plans, setPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const refreshPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const data = await onboardingService.getPlans();
      setPlans(data);
    } catch (err) {
      toast.error('Rejalarni yuklashda xatolik');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const refreshAssignments = async () => {
    setIsLoadingAssignments(true);
    try {
      const data = await onboardingService.getAssignments();
      setAssignments(data);
    } catch (err) {
      toast.error('Progressni yuklashda xatolik');
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  const refreshStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await onboardingService.getStats();
      setStats(data);
    } catch (err) {
      toast.error('Statistikani yuklashda xatolik');
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    refreshPlans();
    refreshAssignments();
    refreshStats();
    (async () => {
      try {
        const response = await employeeService.getEmployees({ limit: 100 });
        setEmployees(response.data || []);
      } catch (err) {
        toast.error("Xodimlar ro'yxatini yuklashda xatolik");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bo'lim nomi bo'yicha guruhlangan xodimlar — "Bo'limlar (Kimlar uchun?)"
  // checkboxi shu bo'limdagi hamma xodimni bir zumda tanlaydi/bekor qiladi.
  const departmentGroups = useMemo(() => {
    const groups = {};
    employees.forEach((e) => {
      const dept = e.department || "Bo'limsiz";
      (groups[dept] ||= []).push(e.id);
    });
    return Object.entries(groups).map(([name, employeeIds]) => ({ name, employeeIds }));
  }, [employees]);

  // --- Plan create/edit ---
  const [isPlanPanelOpen, setIsPlanPanelOpen] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlanForm());
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [uploadingTaskId, setUploadingTaskId] = useState(null);

  const handleUploadDocument = async (stepId, taskId, file) => {
    if (!file) return;
    if (!DOCUMENT_MIME_TYPES.includes(file.type)) {
      toast.error("Hujjat faqat PDF, DOC yoki DOCX formatida bo'lishi kerak");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Hujjat hajmi 10MB dan oshmasligi kerak");
      return;
    }
    setUploadingTaskId(taskId);
    try {
      const result = await onboardingService.uploadDocument(file);
      updateTaskFields(stepId, taskId, { documentUrl: result.documentUrl, documentName: result.documentName });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hujjat yuklashda xatolik');
    } finally {
      setUploadingTaskId(null);
    }
  };

  const openCreatePlan = () => {
    setPlanForm(emptyPlanForm());
    setEditingPlanId(null);
    setEmployeeSearch('');
    setIsPlanPanelOpen(true);
  };

  const openEditPlan = (plan) => {
    const alreadyAssignedIds = assignments
      .filter((a) => a.planId === plan.id)
      .map((a) => a.employeeId);
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      steps: plan.steps.length > 0
        ? plan.steps.map((s) => ({
            id: s.id,
            tasks: s.tasks.map((t) => ({
              id: t.id,
              type: t.type,
              title: t.title,
              videoUrl: t.videoUrl || '',
              documentUrl: t.documentUrl || '',
              documentName: t.documentName || '',
              description: t.description || '',
            })),
          }))
        : [emptyStep()],
      employeeIds: alreadyAssignedIds,
    });
    setEditingPlanId(plan.id);
    setEmployeeSearch('');
    setIsPlanPanelOpen(true);
  };

  const addStep = () => setPlanForm((f) => ({ ...f, steps: [...f.steps, emptyStep()] }));
  const removeStep = (id) => setPlanForm((f) => ({ ...f, steps: f.steps.filter((s) => s.id !== id) }));

  const addTaskToStep = (stepId) => setPlanForm((f) => ({
    ...f,
    steps: f.steps.map((s) => (s.id === stepId ? { ...s, tasks: [...s.tasks, emptyTask()] } : s)),
  }));
  const updateTask = (stepId, taskId, field, value) => setPlanForm((f) => ({
    ...f,
    steps: f.steps.map((s) => (
      s.id === stepId
        ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)) }
        : s
    )),
  }));
  const updateTaskFields = (stepId, taskId, fields) => setPlanForm((f) => ({
    ...f,
    steps: f.steps.map((s) => (
      s.id === stepId
        ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...fields } : t)) }
        : s
    )),
  }));
  const removeTask = (stepId, taskId) => setPlanForm((f) => ({
    ...f,
    steps: f.steps.map((s) => (s.id === stepId ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s)),
  }));

  const toggleEmployeeSelection = (employeeId) => setPlanForm((f) => ({
    ...f,
    employeeIds: f.employeeIds.includes(employeeId)
      ? f.employeeIds.filter((id) => id !== employeeId)
      : [...f.employeeIds, employeeId],
  }));

  const isDepartmentFullySelected = (dept) => dept.employeeIds.every((id) => planForm.employeeIds.includes(id));
  const toggleDepartment = (dept) => setPlanForm((f) => {
    const fullySelected = dept.employeeIds.every((id) => f.employeeIds.includes(id));
    return {
      ...f,
      employeeIds: fullySelected
        ? f.employeeIds.filter((id) => !dept.employeeIds.includes(id))
        : [...new Set([...f.employeeIds, ...dept.employeeIds])],
    };
  });

  const filteredEmployeesForPicker = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error('Reja nomini kiriting');
      return;
    }
    const hasInvalidVideoLink = planForm.steps.some((s) => s.tasks.some(
      (t) => t.title.trim() && t.type === 'video' && t.videoUrl.trim() && !isValidYouTubeInput(t.videoUrl)
    ));
    if (hasInvalidVideoLink) {
      toast.error("Video vazifalarga faqat YouTube havolasi yoki video ID kiriting");
      return;
    }

    const validSteps = planForm.steps
      .map((s) => ({
        tasks: s.tasks
          .filter((t) => t.title.trim())
          .map((t) => ({
            type: t.type,
            title: t.title.trim(),
            videoUrl: t.videoUrl?.trim() || '',
            documentUrl: t.documentUrl?.trim() || '',
            documentName: t.documentName?.trim() || '',
            description: t.description?.trim() || '',
          })),
      }))
      .filter((s) => s.tasks.length > 0);
    if (validSteps.length === 0) {
      toast.error("Kamida bitta vazifa qo'shing");
      return;
    }
    setIsSavingPlan(true);
    try {
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim(),
        steps: validSteps,
      };
      let planId = editingPlanId;
      if (editingPlanId) {
        await onboardingService.updatePlan(editingPlanId, payload);
      } else {
        const created = await onboardingService.createPlan(payload);
        planId = created.id;
      }

      // Tanlangan xodimlardan hali ushbu rejaga biriktirilmaganlariga
      // shaxsiy havola yaratiladi — allaqachon biriktirilganlar qayta
      // yaratilmaydi (o'z havolasini yo'qotmasligi uchun).
      const alreadyAssignedIds = new Set(
        assignments.filter((a) => a.planId === planId).map((a) => a.employeeId)
      );
      const toAssign = planForm.employeeIds.filter((id) => !alreadyAssignedIds.has(id));
      if (toAssign.length > 0) {
        await Promise.allSettled(toAssign.map((employeeId) => onboardingService.createAssignment(planId, employeeId)));
      }

      toast.success(
        editingPlanId
          ? 'Reja yangilandi'
          : toAssign.length > 0
            ? `Reja yaratildi, ${toAssign.length} ta xodimga havola yuborildi`
            : 'Reja yaratildi'
      );
      setIsPlanPanelOpen(false);
      refreshPlans();
      refreshAssignments();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejani saqlashda xatolik');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan) => {
    const ok = await confirm({
      title: 'Rejani o\'chirish',
      message: `"${plan.name}" rejasini o'chirmoqchimisiz? Unga biriktirilgan xodimlarning havolalari ham ishlamay qoladi.`,
    });
    if (!ok) return;
    try {
      await onboardingService.deletePlan(plan.id);
      toast.success("Reja o'chirildi");
      refreshPlans();
      refreshAssignments();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejani o'chirishda xatolik");
    }
  };

  // --- Assign to employee (bir nechta xodimni bir vaqtda tanlab biriktirish) ---
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignPlan, setAssignPlan] = useState(null);
  const [assignEmployeeIds, setAssignEmployeeIds] = useState([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [createdAssignments, setCreatedAssignments] = useState([]);
  const [copiedToken, setCopiedToken] = useState(null);

  const openAssign = (plan) => {
    setAssignPlan(plan);
    setAssignEmployeeIds([]);
    setAssignSearch('');
    setCreatedAssignments([]);
    setCopiedToken(null);
    setIsAssignOpen(true);
  };

  const toggleAssignEmployee = (employeeId) => setAssignEmployeeIds((ids) => (
    ids.includes(employeeId) ? ids.filter((id) => id !== employeeId) : [...ids, employeeId]
  ));

  const alreadyAssignedToPlan = useMemo(() => {
    if (!assignPlan) return new Set();
    return new Set(assignments.filter((a) => a.planId === assignPlan.id).map((a) => a.employeeId));
  }, [assignments, assignPlan]);

  const assignPickerEmployees = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    return employees
      .filter((e) => !alreadyAssignedToPlan.has(e.id))
      .filter((e) => !q || `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
  }, [employees, assignSearch, alreadyAssignedToPlan]);

  const handleAssign = async () => {
    if (assignEmployeeIds.length === 0) {
      toast.error('Kamida bitta xodimni tanlang');
      return;
    }
    setIsAssigning(true);
    try {
      const results = await Promise.allSettled(
        assignEmployeeIds.map((employeeId) => onboardingService.createAssignment(assignPlan.id, employeeId))
      );
      const created = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      const failedCount = results.length - created.length;
      setCreatedAssignments(created);
      if (failedCount > 0) {
        toast.error(`${failedCount} ta xodimga biriktirishda xatolik yuz berdi`);
      }
      refreshPlans();
      refreshAssignments();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Biriktirishda xatolik');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCopyLink = async (token) => {
    try {
      await navigator.clipboard.writeText(getPublicLink(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      toast.error("Nusxalashda xatolik — havolani qo'lda belgilab oling");
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    const ok = await confirm({
      title: 'Biriktirishni bekor qilish',
      message: `${assignment.employeeName} uchun "${assignment.planName}" rejasini bekor qilmoqchimisiz? Havola ishlamay qoladi.`,
    });
    if (!ok) return;
    try {
      await onboardingService.deleteAssignment(assignment.id);
      toast.success("Biriktirish bekor qilindi");
      refreshAssignments();
      refreshPlans();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Bekor qilishda xatolik");
    }
  };

  if (isPlanPanelOpen) {
    return (
      <div className="animate-fade-in onboarding-form-page">
        <div className="onboarding-form-topbar">
          <div className="onboarding-form-topbar-left">
            <button
              type="button"
              className="onboarding-back-btn"
              aria-label="Orqaga"
              onClick={() => setIsPlanPanelOpen(false)}
            >
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>
            <h2 className="onboarding-form-title">{editingPlanId ? 'Tahrirlash' : "Qo'shish"}</h2>
          </div>
          <div className="onboarding-form-topbar-actions">
            <Button variant="ghost" className="onboarding-btn-wide" onClick={() => setIsPlanPanelOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              className="onboarding-btn-wide"
              onClick={handleSavePlan}
              disabled={isSavingPlan}
              icon={<Save size={16} strokeWidth={2.25} />}
            >
              {isSavingPlan ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </div>

        <div className="onboarding-form-grid">
          <div className="onboarding-form-left">
            <Input
              label="Reja nomi"
              name="planName"
              value={planForm.name}
              onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Masalan: Yangi xodim uchun"
              required
            />
            <Textarea
              label="Tavsif"
              name="planDescription"
              value={planForm.description}
              onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Reja haqida qisqacha ma'lumot"
              rows={3}
            />

            <div className="onboarding-picker-section">
              <label className="form-label">Bo'limlar (Kimlar uchun?)</label>
              <div className="onboarding-department-list">
                {departmentGroups.map((dept) => (
                  <label key={dept.name} className="onboarding-checkbox-row">
                    <input
                      type="checkbox"
                      checked={isDepartmentFullySelected(dept)}
                      onChange={() => toggleDepartment(dept)}
                    />
                    <span>{dept.name}</span>
                    <span className="onboarding-checkbox-count">{dept.employeeIds.length}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="onboarding-picker-section">
              <label className="form-label">Maxsus xodimlar</label>
              <input
                type="text"
                className="form-input"
                placeholder="Xodim ismini yozing..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
              <div className="onboarding-employee-list">
                {filteredEmployeesForPicker.map((e) => (
                  <label key={e.id} className="onboarding-checkbox-row onboarding-employee-row">
                    <input
                      type="checkbox"
                      checked={planForm.employeeIds.includes(e.id)}
                      onChange={() => toggleEmployeeSelection(e.id)}
                    />
                    <span className="onboarding-employee-row-info">
                      <span className="onboarding-employee-row-name">{e.first_name} {e.last_name}</span>
                      {e.department && <span className="onboarding-employee-row-dept">{e.department}</span>}
                    </span>
                  </label>
                ))}
                {filteredEmployeesForPicker.length === 0 && (
                  <p className="onboarding-employee-list-empty">Xodim topilmadi</p>
                )}
              </div>
            </div>
          </div>

          <div className="onboarding-form-right">
            {planForm.steps.map((step, idx) => (
              <div key={step.id} className="onboarding-step-card">
                <div className="onboarding-step-card-header">
                  <span className="onboarding-step-card-badge">{idx + 1}</span>
                  <span className="onboarding-step-card-title">{idx + 1}-bosqich</span>
                  <button
                    type="button"
                    className="onboarding-step-card-delete"
                    aria-label="Bosqichni o'chirish"
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 size={15} strokeWidth={2.25} />
                  </button>
                </div>
                {step.tasks.map((task) => {
                  const videoUrlTouched = task.videoUrl.trim().length > 0;
                  const videoUrlInvalid = task.type === 'video' && videoUrlTouched && !isValidYouTubeInput(task.videoUrl);
                  return (
                    <div key={task.id} className="onboarding-task-block">
                      <div className="onboarding-task-row">
                        <div className="onboarding-task-field-type">
                          <label>Turi</label>
                          <TaskTypeSelect
                            value={task.type}
                            onChange={(type) => updateTask(step.id, task.id, 'type', type)}
                          />
                        </div>
                        <div className="onboarding-task-field-name">
                          <label>Vazifa nomi</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Vazifa nomi"
                            value={task.title}
                            onChange={(e) => updateTask(step.id, task.id, 'title', e.target.value)}
                            autoFocus
                          />
                        </div>
                        <button
                          type="button"
                          className="onboarding-task-remove"
                          aria-label="Vazifani o'chirish"
                          onClick={() => removeTask(step.id, task.id)}
                        >
                          <X size={16} strokeWidth={2.25} />
                        </button>
                      </div>

                      {task.type === 'video' && (
                        <div className="onboarding-task-field">
                          <label><Video size={13} strokeWidth={2.25} /> YouTube havolasi</label>
                          <input
                            type="text"
                            className={`form-input ${videoUrlInvalid ? 'error' : ''}`}
                            placeholder="ID yoki to'liq URL"
                            value={task.videoUrl}
                            onChange={(e) => updateTask(step.id, task.id, 'videoUrl', e.target.value)}
                          />
                          {videoUrlInvalid && (
                            <span className="onboarding-task-field-error">
                              <AlertCircle size={12} strokeWidth={2.25} /> Faqat YouTube havolasi yoki video ID qabul qilinadi
                            </span>
                          )}
                        </div>
                      )}

                      {task.type === 'hujjat' && (
                        <div className="onboarding-task-field">
                          <label><FileText size={13} strokeWidth={2.25} /> Hujjat (PDF, DOC, DOCX)</label>
                          {task.documentUrl ? (
                            <div className="onboarding-doc-attached">
                              <a
                                href={onboardingService.getDocumentUrl(task.documentUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="onboarding-doc-attached-name"
                              >
                                <Paperclip size={13} strokeWidth={2.25} /> {task.documentName || 'Hujjat'}
                              </a>
                              <button
                                type="button"
                                className="onboarding-doc-remove"
                                aria-label="Hujjatni olib tashlash"
                                onClick={() => updateTaskFields(step.id, task.id, { documentUrl: '', documentName: '' })}
                              >
                                <X size={13} strokeWidth={2.25} />
                              </button>
                            </div>
                          ) : (
                            <label className={`onboarding-doc-upload-btn ${uploadingTaskId === task.id ? 'uploading' : ''}`}>
                              <Upload size={14} strokeWidth={2.25} />
                              {uploadingTaskId === task.id ? 'Yuklanmoqda...' : 'Fayl tanlash'}
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                disabled={uploadingTaskId === task.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  handleUploadDocument(step.id, task.id, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}

                      <div className="onboarding-task-field">
                        <label>Ko'rsatma (Tavsif)</label>
                        <textarea
                          className="form-textarea"
                          placeholder="Vazifa bo'yicha qisqacha ko'rsatma..."
                          rows={2}
                          value={task.description}
                          onChange={(e) => updateTask(step.id, task.id, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="onboarding-task-add"
                  onClick={() => addTaskToStep(step.id)}
                >
                  <Plus size={15} strokeWidth={2.5} /> Vazifa qo'shish
                </button>
              </div>
            ))}

            <button type="button" className="onboarding-step-add-page" onClick={addStep}>
              <Plus size={16} strokeWidth={2.5} /> Yangi bosqich qo'shish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="onboarding-title-icon"><Rocket size={20} strokeWidth={2.25} /></span>
            Onboarding tizimi
          </h2>
          <p className="page-subtitle">Yangi xodimlar uchun moslashuv rejalarini yarating va kuzating</p>
        </div>
        <div className="page-header-right">
          <Button variant="primary" className="onboarding-btn-wide" icon={<Plus size={16} strokeWidth={2.5} />} onClick={openCreatePlan}>
            Yangi reja
          </Button>
        </div>
      </div>

      <div className="org-tabs" style={{ marginBottom: '1.5rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`org-tab ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            <tab.icon size={15} strokeWidth={2.25} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'rejalar' && (
        isLoadingPlans ? (
          <div style={{ padding: '2rem' }}><LoadingSpinner /></div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<Rocket size={44} strokeWidth={1.5} />}
            title="Rejalar mavjud emas"
            text="Yangi xodimlar uchun birinchi onboarding rejangizni yarating"
            action={
              <Button variant="primary" className="onboarding-btn-wide" onClick={openCreatePlan} icon={<Plus size={16} strokeWidth={2.5} />}>
                Qo'shish
              </Button>
            }
          />
        ) : (
          <div className="onboarding-plans-grid">
            {plans.map((plan) => (
              <Card key={plan.id} className="onboarding-plan-card">
                <div className="onboarding-plan-card-header">
                  <span className="onboarding-plan-icon"><BookOpen size={18} strokeWidth={2.25} /></span>
                  <div>
                    <h3>{plan.name}</h3>
                    {plan.description && <p>{plan.description}</p>}
                  </div>
                </div>
                <div className="onboarding-plan-stats">
                  <span><ListChecks size={14} strokeWidth={2.25} /> {plan.stepCount} bosqich, {plan.taskCount} vazifa</span>
                  <span><Users size={14} strokeWidth={2.25} /> {plan.assignmentCount} xodim</span>
                </div>
                <div className="onboarding-plan-actions">
                  <Button variant="outline" size="sm" onClick={() => openAssign(plan)} icon={<UserPlus size={14} strokeWidth={2.25} />}>
                    Xodimga biriktirish
                  </Button>
                  <button type="button" className="attendance-toggle-btn" title="Tahrirlash" onClick={() => openEditPlan(plan)}>
                    <Pencil size={15} strokeWidth={2.25} />
                  </button>
                  <button type="button" className="attendance-toggle-btn" title="O'chirish" onClick={() => handleDeletePlan(plan)}>
                    <Trash2 size={15} strokeWidth={2.25} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {activeTab === 'progress' && (
        <Card style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Xodim</th>
                  <th>Reja</th>
                  <th>Joriy vazifa</th>
                  <th>Progress</th>
                  <th>Holati</th>
                  <th>Havola</th>
                  <th></th>
                </tr>
              </thead>
              {isLoadingAssignments ? null : assignments.length > 0 && (
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="attendance-employee-cell">
                          {a.employeePhotoUrl ? (
                            <img className="attendance-avatar" src={employeeService.getPhotoUrl(a.employeePhotoUrl)} alt={a.employeeName} />
                          ) : (
                            <div className="attendance-avatar-fallback">
                              {a.employeeName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                          )}
                          <div className="attendance-employee-name">{a.employeeName}</div>
                        </div>
                      </td>
                      <td>{a.planName}</td>
                      <td>
                        {a.currentStepTitle ? (
                          <span className="onboarding-current-step">{a.currentStepTitle}</span>
                        ) : (
                          <span className="onboarding-current-step complete">
                            <CheckCircle2 size={14} strokeWidth={2.25} /> Yakunlandi
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="onboarding-progress-cell">
                          <div className="onboarding-progress-track">
                            <div
                              className={`onboarding-progress-fill ${a.progress === 100 ? 'complete' : ''}`}
                              style={{ width: `${a.progress}%` }}
                            />
                          </div>
                          <span className="onboarding-progress-label">{a.progress}%</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={a.status === 'completed' ? 'success' : 'warning'}>
                          {a.status === 'completed' ? 'Yakunlandi' : 'Jarayonda'}
                        </Badge>
                      </td>
                      <td>
                        <button type="button" className="attendance-token-chip" onClick={() => handleCopyLink(a.publicToken)}>
                          <Copy size={13} strokeWidth={2.25} /> <code>{a.publicToken.slice(0, 10)}...</code>
                        </button>
                      </td>
                      <td>
                        <button type="button" className="attendance-toggle-btn" title="Bekor qilish" onClick={() => handleDeleteAssignment(a)}>
                          <Trash2 size={15} strokeWidth={2.25} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {isLoadingAssignments ? (
            <div style={{ padding: '2rem' }}><LoadingSpinner /></div>
          ) : assignments.length === 0 && (
            <p className="onboarding-progress-empty">Progress ma'lumotlari mavjud emas</p>
          )}
        </Card>
      )}

      {activeTab === 'statistika' && (
        isLoadingStats ? (
          <div style={{ padding: '2rem' }}><LoadingSpinner /></div>
        ) : !stats || stats.totalAssignments === 0 ? (
          <EmptyState
            icon={<Percent size={44} strokeWidth={1.5} />}
            title="Statistika mavjud emas"
            text="Xodimlarga reja biriktirilgach, umumiy statistika shu yerda ko'rinadi"
          />
        ) : (
          <div className="onboarding-stats-grid">
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><BookOpen size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{stats.totalPlans}</span>
                <span className="onboarding-stat-label">Jami rejalar</span>
              </div>
            </div>
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><Users size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{stats.totalAssignments}</span>
                <span className="onboarding-stat-label">Biriktirilgan xodimlar</span>
              </div>
            </div>
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><CheckCircle2 size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{stats.completionRate}%</span>
                <span className="onboarding-stat-label">{stats.completedCount} / {stats.totalAssignments} yakunlagan</span>
              </div>
            </div>
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><CalendarCheck size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{stats.within7DaysRate}%</span>
                <span className="onboarding-stat-label">7 kun ichida yakunlagan ({stats.within7DaysCount} xodim)</span>
              </div>
            </div>
          </div>
        )
      )}

      {/* Assign to employee modal — bir nechta xodimni bir vaqtda tanlab biriktirish */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title={createdAssignments.length > 0 ? 'Havolalar tayyor' : 'Xodimga biriktirish'}
        size="md"
        footer={
          createdAssignments.length > 0 ? (
            <Button variant="primary" onClick={() => setIsAssignOpen(false)} style={{ width: '100%' }}>
              Yopish
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="onboarding-btn-wide" onClick={() => setIsAssignOpen(false)}>Bekor qilish</Button>
              <Button variant="primary" className="onboarding-btn-wide" onClick={handleAssign} disabled={isAssigning}>
                {isAssigning
                  ? 'Biriktirilmoqda...'
                  : `Biriktirish${assignEmployeeIds.length > 0 ? ` (${assignEmployeeIds.length})` : ''}`}
              </Button>
            </>
          )
        }
      >
        {createdAssignments.length > 0 ? (
          <div className="onboarding-assign-created-list">
            <div className="attendance-device-created" style={{ paddingBottom: 0 }}>
              <span className="attendance-device-created-icon"><Check size={26} strokeWidth={2.25} /></span>
              <h3>{createdAssignments.length} ta xodimga havola yaratildi</h3>
              <p>Bular shaxsiy havolalar — xodimlar login qilmasdan o'z bosqichlarini shu yerdan belgilaydi. Nusxalab, har biriga yuboring.</p>
            </div>
            {createdAssignments.map((a) => (
              <div key={a.id} className="attendance-device-token-box onboarding-assign-created-row">
                <span className="onboarding-assign-created-name">{a.employeeName}</span>
                <code>{getPublicLink(a.publicToken)}</code>
                <button type="button" className="attendance-device-token-copy" onClick={() => handleCopyLink(a.publicToken)}>
                  {copiedToken === a.publicToken ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2.25} />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              <strong>{assignPlan?.name}</strong> rejasini qaysi xodimlarga biriktiramiz? Bir nechtasini tanlashingiz mumkin.
            </p>
            <input
              type="text"
              className="form-input"
              placeholder="Xodim ismini yozing..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              style={{ marginBottom: '0.75rem' }}
            />
            <div className="onboarding-employee-list">
              {assignPickerEmployees.map((e) => (
                <label key={e.id} className="onboarding-checkbox-row onboarding-employee-row">
                  <input
                    type="checkbox"
                    checked={assignEmployeeIds.includes(e.id)}
                    onChange={() => toggleAssignEmployee(e.id)}
                  />
                  <span className="onboarding-employee-row-info">
                    <span className="onboarding-employee-row-name">{e.first_name} {e.last_name}</span>
                    {e.department && <span className="onboarding-employee-row-dept">{e.department}</span>}
                  </span>
                </label>
              ))}
              {assignPickerEmployees.length === 0 && (
                <p className="onboarding-employee-list-empty">
                  {alreadyAssignedToPlan.size > 0 ? 'Barcha mos xodimlar allaqachon biriktirilgan' : 'Xodim topilmadi'}
                </p>
              )}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog {...confirmProps} />
    </div>
  );
}

export default OnboardingPage;
