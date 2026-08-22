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
  Eye,
  Link2,
  Clock,
  ThumbsUp,
  Undo2,
} from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import employeeService from '../../services/employeeService';
import { useAuthStore } from '../../store/authStore';
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
import Select from '../../components/ui/Select';

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
  return { name: '', description: '', department: '', steps: [emptyStep()], employeeIds: [] };
}

function getPublicLink(token) {
  return `${window.location.origin}/onboarding/public/${token}`;
}

const REVIEW_STATUS_CONFIG = {
  pending: { label: "Ko'rib chiqilmoqda", variant: 'info', icon: Clock },
  approved: { label: 'Qabul qilindi', variant: 'success', icon: CheckCircle2 },
  rejected: { label: 'Qaytarildi', variant: 'error', icon: AlertCircle },
};

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
  const { user } = useAuthStore();
  // Rejani butunlay o'chirish faqat Admin/Super Admin uchun (backend ham
  // shunday cheklaydi) — HR kunlik ishni (yaratish/tahrirlash/biriktirish/
  // ko'rib chiqish) to'liq qila oladi, faqat shablonni o'chira olmaydi.
  const canDeletePlan = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState('rejalar');
  const [plans, setPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

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

  // Progress jadvalida bitta xodim uchun bir nechta reja biriktirilgan
  // bo'lsa ham bitta qator ko'rsatiladi — hammasi umumlashtirilib, ustiga
  // bosilganda barcha rejalari birga ochiladi (pastda openViewSubmissions).
  const employeeProgressGroups = useMemo(() => {
    const groups = {};
    assignments.forEach((a) => {
      const group = (groups[a.employeeId] ||= {
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        employeePhotoUrl: a.employeePhotoUrl,
        assignments: [],
        totalTasks: 0,
        completedTasks: 0,
      });
      group.assignments.push(a);
      group.totalTasks += a.totalSteps;
      group.completedTasks += a.completedSteps;
    });
    return Object.values(groups).map((g) => ({
      ...g,
      progress: g.totalTasks > 0 ? Math.round((g.completedTasks / g.totalTasks) * 100) : 0,
      allCompleted: g.assignments.every((a) => a.status === 'completed'),
    }));
  }, [assignments]);

  useEffect(() => {
    refreshPlans();
    refreshAssignments();
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

  // Reja "Bo'lim" tanlovi uchun — faqat xodimlarda haqiqatan mavjud
  // bo'lim nomlari, "Bo'limsiz" guruhi bundan mustasno.
  const departmentSelectOptions = useMemo(() => (
    [...new Set(employees.map((e) => e.department).filter(Boolean))]
      .sort()
      .map((name) => ({ value: name, label: name }))
  ), [employees]);

  // Onboarding sahifasi endi bo'lim bo'yicha navigatsiya bilan ishlaydi:
  // null = bosh sahifa (bo'lim kartalari), '__umumiy__' = umumiy (barcha
  // bo'limlar uchun) rejalar, aks holda tanlangan bo'lim nomi — shu holatda
  // Rejalar/Progress/Statistika faqat o'sha bo'limga tegishli ma'lumotni
  // ko'rsatadi.
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const employeeDeptMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.department || null])),
    [employees]
  );
  const planDeptMap = useMemo(
    () => Object.fromEntries(plans.map((p) => [p.id, p.department || null])),
    [plans]
  );

  // Bosh sahifadagi bo'lim kartalari — har bo'lim uchun reja/xodim soni,
  // plus "Umumiy" (barcha bo'limlar uchun umumiy rejalar) kartasi.
  const departmentCards = useMemo(() => {
    const cards = departmentGroups
      .filter((d) => d.name !== "Bo'limsiz")
      .map((d) => ({
        key: d.name,
        label: d.name,
        employeeCount: d.employeeIds.length,
        planCount: plans.filter((p) => p.department === d.name).length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const generalPlanCount = plans.filter((p) => !p.department).length;
    return [
      ...cards,
      { key: '__umumiy__', label: 'Umumiy', employeeCount: employees.length, planCount: generalPlanCount },
    ];
  }, [departmentGroups, plans, employees]);

  // Tanlangan bo'lim uchun rejalar — o'ziga tegishli + "Umumiy" rejalar
  // (Umumiy bo'lim tanlangan bo'lsa, faqat umumiy rejalar).
  const filteredPlans = useMemo(() => {
    if (!selectedDepartment) return plans;
    if (selectedDepartment === '__umumiy__') return plans.filter((p) => !p.department);
    return plans.filter((p) => !p.department || p.department === selectedDepartment);
  }, [plans, selectedDepartment]);

  // Progress tabi — tanlangan bo'limga tegishli xodimlargina (Umumiy
  // tanlansa, faqat umumiy rejadan topshirilgan vazifalar hisoblanadi).
  const filteredEmployeeProgressGroups = useMemo(() => {
    if (!selectedDepartment) return employeeProgressGroups;
    if (selectedDepartment === '__umumiy__') {
      return employeeProgressGroups
        .map((g) => {
          const generalAssignments = g.assignments.filter((a) => !planDeptMap[a.planId]);
          if (generalAssignments.length === 0) return null;
          const totalTasks = generalAssignments.reduce((sum, a) => sum + a.totalSteps, 0);
          const completedTasks = generalAssignments.reduce((sum, a) => sum + a.completedSteps, 0);
          return {
            ...g,
            assignments: generalAssignments,
            totalTasks,
            completedTasks,
            progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            allCompleted: generalAssignments.every((a) => a.status === 'completed'),
          };
        })
        .filter(Boolean);
    }
    return employeeProgressGroups.filter((g) => employeeDeptMap[g.employeeId] === selectedDepartment);
  }, [employeeProgressGroups, selectedDepartment, employeeDeptMap, planDeptMap]);

  // Statistika tabi — tanlangan bo'lim doirasida qayta hisoblanadi
  // (backenddagi global /stats o'rniga, allaqachon yuklangan
  // assignments'dan mijoz tomonida).
  const departmentStats = useMemo(() => {
    if (!selectedDepartment) return null;
    const groups = filteredEmployeeProgressGroups;
    const relevantAssignments = groups.flatMap((g) => g.assignments);
    const totalAssignments = relevantAssignments.length;
    const completedCount = relevantAssignments.filter((a) => a.status === 'completed').length;
    const within7DaysCount = relevantAssignments.filter((a) => {
      if (a.status !== 'completed' || !a.completedAt) return false;
      const days = (new Date(a.completedAt) - new Date(a.createdAt)) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;
    return {
      totalPlans: filteredPlans.length,
      totalAssignments,
      completedCount,
      completionRate: totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0,
      within7DaysCount,
      within7DaysRate: totalAssignments > 0 ? Math.round((within7DaysCount / totalAssignments) * 100) : 0,
    };
  }, [selectedDepartment, filteredEmployeeProgressGroups, filteredPlans]);

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

  const openCreatePlan = (presetDepartment) => {
    setPlanForm({ ...emptyPlanForm(), department: typeof presetDepartment === 'string' ? presetDepartment : '' });
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
      department: plan.department || '',
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
    return employees
      .filter((e) => !planForm.department || e.department === planForm.department)
      .filter((e) => !q || `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
  }, [employees, employeeSearch, planForm.department]);

  // "Bo'limlar (Kimlar uchun?)" ro'yxati ham reja bo'limiga mos xodimlar
  // guruhinigina ko'rsatadi — reja bo'limga bog'langan bo'lsa.
  const pickerDepartmentGroups = useMemo(() => {
    if (!planForm.department) return departmentGroups;
    return departmentGroups.filter((d) => d.name === planForm.department);
  }, [departmentGroups, planForm.department]);

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
        department: planForm.department || '',
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
      // Bo'limga bog'langan reja faqat o'sha bo'lim xodimlariga taklif
      // qilinadi — "Umumiy" (department=null) reja esa hammaga.
      .filter((e) => !assignPlan?.department || e.department === assignPlan.department)
      .filter((e) => !q || `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
  }, [employees, assignSearch, alreadyAssignedToPlan, assignPlan]);

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

  // --- View submissions (Progress jadvalida xodim ustiga bosilganda) ---
  // Bitta xodimning barcha rejalari (biriktirishlari) shu bitta oynada,
  // har biri o'z bo'limi sifatida, birga ko'rsatiladi.
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [viewAssignments, setViewAssignments] = useState([]);
  const [isLoadingView, setIsLoadingView] = useState(false);

  const openViewSubmissions = async (group) => {
    setIsViewOpen(true);
    setIsLoadingView(true);
    setViewEmployee({ name: group.employeeName, photoUrl: group.employeePhotoUrl });
    setViewAssignments([]);
    try {
      const details = await Promise.all(
        group.assignments.map((a) => onboardingService.getAssignmentDetail(a.id))
      );
      setViewAssignments(details);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tafsilotlarni yuklashda xatolik');
      setIsViewOpen(false);
    } finally {
      setIsLoadingView(false);
    }
  };

  // Vazifani qabul qilish/qaytarish — rad javobi uchun sabab kiritish
  // maydoni shu vazifa kartasi ichida ochiladi (rejectingTaskId shu
  // vazifani belgilaydi).
  const [rejectingTaskId, setRejectingTaskId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  const applyReviewedAssignment = (updated) => {
    setViewAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    refreshAssignments();
  };

  const handleApproveTask = async (assignment, task) => {
    setIsReviewing(true);
    try {
      const updated = await onboardingService.reviewTask(assignment.id, task.id, 'approved');
      applyReviewedAssignment(updated);
      toast.success('Vazifa qabul qilindi');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Vazifani qabul qilishda xatolik');
    } finally {
      setIsReviewing(false);
    }
  };

  const openRejectReason = (taskId) => {
    setRejectingTaskId(taskId);
    setRejectReason('');
  };

  const cancelRejectReason = () => {
    setRejectingTaskId(null);
    setRejectReason('');
  };

  const handleRejectTask = async (assignment, task) => {
    setIsReviewing(true);
    try {
      const updated = await onboardingService.reviewTask(assignment.id, task.id, 'rejected', rejectReason.trim());
      applyReviewedAssignment(updated);
      toast.success('Vazifa qaytarildi');
      setRejectingTaskId(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Vazifani qaytarishda xatolik');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDeleteAssignmentFromView = async (assignment) => {
    const ok = await confirm({
      title: 'Biriktirishni bekor qilish',
      message: `${assignment.employeeName} uchun "${assignment.planName}" rejasini bekor qilmoqchimisiz? Havola ishlamay qoladi.`,
    });
    if (!ok) return;
    try {
      await onboardingService.deleteAssignment(assignment.id);
      toast.success("Biriktirish bekor qilindi");
      setViewAssignments((prev) => {
        const next = prev.filter((a) => a.id !== assignment.id);
        if (next.length === 0) setIsViewOpen(false);
        return next;
      });
      refreshAssignments();
      refreshPlans();
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
            <Select
              label="Bo'lim"
              name="planDepartment"
              value={planForm.department}
              onChange={(e) => {
                const department = e.target.value;
                setPlanForm((f) => ({
                  ...f,
                  department,
                  // Boshqa bo'limdan avval tanlangan xodimlar endi mos
                  // kelmaydi — ro'yxatdan yashirin qolib ketmasin uchun
                  // tanlovdan ham olib tashlanadi.
                  employeeIds: department
                    ? f.employeeIds.filter((id) => employees.find((emp) => emp.id === id)?.department === department)
                    : f.employeeIds,
                }));
              }}
              options={departmentSelectOptions}
              placeholder="Umumiy (barcha bo'limlar uchun)"
            />

            <div className="onboarding-picker-section">
              <label className="form-label">Bo'limlar (Kimlar uchun?)</label>
              <div className="onboarding-department-list">
                {pickerDepartmentGroups.map((dept) => (
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

  if (selectedDepartment === null) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="page-header-left">
            <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="onboarding-title-icon"><Rocket size={20} strokeWidth={2.25} /></span>
              Onboarding tizimi
            </h2>
            <p className="page-subtitle">Bo'limni tanlang — har bir bo'limning o'z rejalari, progressi va statistikasi alohida</p>
          </div>
        </div>

        {departmentCards.length === 0 ? (
          <EmptyState
            icon={<Users size={44} strokeWidth={1.5} />}
            title="Xodimlar mavjud emas"
            text="Xodimlar qo'shilgach, ularning bo'limlari shu yerda kartalar sifatida ko'rinadi"
          />
        ) : (
          <div className="onboarding-dept-card-grid">
            {departmentCards.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`onboarding-dept-card ${d.key === '__umumiy__' ? 'general' : ''}`}
                onClick={() => setSelectedDepartment(d.key)}
              >
                <span className="onboarding-dept-card-icon">
                  {d.key === '__umumiy__' ? <Rocket size={20} strokeWidth={2.25} /> : <Users size={20} strokeWidth={2.25} />}
                </span>
                <span className="onboarding-dept-card-name">{d.label}</span>
                <span className="onboarding-dept-card-meta">
                  <span>{d.planCount} reja</span>
                  <span>{d.employeeCount} xodim</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedDepartmentLabel = selectedDepartment === '__umumiy__' ? 'Umumiy' : selectedDepartment;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <button type="button" className="onboarding-back-btn" onClick={() => setSelectedDepartment(null)}>
            <ChevronLeft size={16} strokeWidth={2.5} /> Bo'limlar
          </button>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="onboarding-title-icon"><Rocket size={20} strokeWidth={2.25} /></span>
            {selectedDepartmentLabel}
          </h2>
          <p className="page-subtitle">Bu bo'lim uchun moslashuv rejalarini yarating va kuzating</p>
        </div>
        <div className="page-header-right">
          <Button
            variant="primary"
            className="onboarding-btn-wide"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={() => openCreatePlan(selectedDepartment === '__umumiy__' ? '' : selectedDepartment)}
          >
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
        ) : filteredPlans.length === 0 ? (
          <EmptyState
            icon={<Rocket size={44} strokeWidth={1.5} />}
            title="Rejalar mavjud emas"
            text="Bu bo'lim uchun birinchi onboarding rejangizni yarating"
            action={
              <Button
                variant="primary"
                className="onboarding-btn-wide"
                onClick={() => openCreatePlan(selectedDepartment === '__umumiy__' ? '' : selectedDepartment)}
                icon={<Plus size={16} strokeWidth={2.5} />}
              >
                Qo'shish
              </Button>
            }
          />
        ) : (
            <div className="onboarding-plans-grid">
            {filteredPlans.map((plan) => (
              <Card key={plan.id} className="onboarding-plan-card">
                <div className="onboarding-plan-card-header">
                  <span className="onboarding-plan-icon"><BookOpen size={18} strokeWidth={2.25} /></span>
                  <div>
                    <h3>{plan.name}</h3>
                    {plan.description && <p>{plan.description}</p>}
                  </div>
                  <Badge variant={plan.department ? 'info' : 'notes'} className="onboarding-plan-dept-badge">
                    {plan.department || 'Umumiy'}
                  </Badge>
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
                  {canDeletePlan && (
                    <button type="button" className="attendance-toggle-btn" title="O'chirish" onClick={() => handleDeletePlan(plan)}>
                      <Trash2 size={15} strokeWidth={2.25} />
                    </button>
                  )}
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
                  <th>Rejalar</th>
                  <th>Progress</th>
                  <th>Holati</th>
                  <th></th>
                </tr>
              </thead>
              {isLoadingAssignments ? null : filteredEmployeeProgressGroups.length > 0 && (
                <tbody>
                  {filteredEmployeeProgressGroups.map((g) => (
                    <tr key={g.employeeId} className="onboarding-progress-row" onClick={() => openViewSubmissions(g)}>
                      <td>
                        <div className="attendance-employee-cell">
                          {g.employeePhotoUrl ? (
                            <img className="attendance-avatar" src={employeeService.getPhotoUrl(g.employeePhotoUrl)} alt={g.employeeName} />
                          ) : (
                            <div className="attendance-avatar-fallback">
                              {g.employeeName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                          )}
                          <div className="attendance-employee-name">{g.employeeName}</div>
                        </div>
                      </td>
                      <td>
                        <div className="onboarding-plan-pills">
                          {g.assignments.slice(0, 2).map((a) => (
                            <span key={a.id} className="onboarding-plan-pill">{a.planName}</span>
                          ))}
                          {g.assignments.length > 2 && (
                            <span className="onboarding-plan-pill onboarding-plan-pill-more">+{g.assignments.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="onboarding-progress-cell">
                          <div className="onboarding-progress-track">
                            <div
                              className={`onboarding-progress-fill ${g.progress === 100 ? 'complete' : ''}`}
                              style={{ width: `${g.progress}%` }}
                            />
                          </div>
                          <span className="onboarding-progress-label">{g.progress}%</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={g.allCompleted ? 'success' : 'warning'}>
                          {g.allCompleted ? 'Yakunlandi' : 'Jarayonda'}
                        </Badge>
                      </td>
                      <td>
                        <span className="onboarding-progress-view-hint">
                          <Eye size={14} strokeWidth={2.25} /> Ko'rish
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {isLoadingAssignments ? (
            <div style={{ padding: '2rem' }}><LoadingSpinner /></div>
          ) : filteredEmployeeProgressGroups.length === 0 && (
            <p className="onboarding-progress-empty">Progress ma'lumotlari mavjud emas</p>
          )}
        </Card>
      )}

      {activeTab === 'statistika' && (
        isLoadingAssignments ? (
          <div style={{ padding: '2rem' }}><LoadingSpinner /></div>
        ) : !departmentStats || departmentStats.totalAssignments === 0 ? (
          <EmptyState
            icon={<Percent size={44} strokeWidth={1.5} />}
            title="Statistika mavjud emas"
            text="Xodimlarga reja biriktirilgach, shu bo'lim statistikasi shu yerda ko'rinadi"
          />
        ) : (
          <div className="onboarding-stats-grid">
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><BookOpen size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{departmentStats.totalPlans}</span>
                <span className="onboarding-stat-label">Jami rejalar</span>
              </div>
            </div>
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><Users size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{departmentStats.totalAssignments}</span>
                <span className="onboarding-stat-label">Biriktirilgan xodimlar</span>
              </div>
            </div>
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><CheckCircle2 size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{departmentStats.completionRate}%</span>
                <span className="onboarding-stat-label">{departmentStats.completedCount} / {departmentStats.totalAssignments} yakunlagan</span>
              </div>
            </div>
            <div className="onboarding-stat-card">
              <span className="onboarding-stat-icon"><CalendarCheck size={20} strokeWidth={2.25} /></span>
              <div>
                <span className="onboarding-stat-value">{departmentStats.within7DaysRate}%</span>
                <span className="onboarding-stat-label">7 kun ichida yakunlagan ({departmentStats.within7DaysCount} xodim)</span>
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

      {/* View submissions modal — Progress jadvalida xodim ustiga bosilganda,
          uning barcha rejalari (biriktirishlari) shu bitta joyda */}
      <Modal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title="Topshirilgan vazifalar"
        size="md"
        footer={
          <Button variant="primary" onClick={() => setIsViewOpen(false)} style={{ width: '100%' }}>
            Yopish
          </Button>
        }
      >
        {isLoadingView ? (
          <div style={{ padding: '1.5rem' }}><LoadingSpinner /></div>
        ) : viewAssignments.length > 0 && (
          <div className="onboarding-view-submissions">
            <div className="onboarding-view-header">
              {viewEmployee?.photoUrl ? (
                <img className="attendance-avatar" src={employeeService.getPhotoUrl(viewEmployee.photoUrl)} alt={viewEmployee.name} />
              ) : (
                <div className="attendance-avatar-fallback">
                  {viewEmployee?.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
              )}
              <div>
                <strong>{viewEmployee?.name}</strong>
                <span>{viewAssignments.length} ta reja biriktirilgan</span>
              </div>
            </div>

            {viewAssignments.map((assignment) => (
              <div key={assignment.id} className="onboarding-view-plan-section">
                <div className="onboarding-view-plan-header">
                  <span className="onboarding-view-plan-icon"><BookOpen size={14} strokeWidth={2.25} /></span>
                  <span className="onboarding-view-plan-name">{assignment.planName}</span>
                  <Badge variant={assignment.status === 'completed' ? 'success' : 'warning'}>
                    {assignment.progress}%
                  </Badge>
                  <button
                    type="button"
                    className="attendance-toggle-btn"
                    title="Havolani nusxalash"
                    onClick={() => handleCopyLink(assignment.publicToken)}
                  >
                    <Copy size={14} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="attendance-toggle-btn"
                    title="Bekor qilish"
                    onClick={() => handleDeleteAssignmentFromView(assignment)}
                  >
                    <Trash2 size={14} strokeWidth={2.25} />
                  </button>
                </div>

                {assignment.steps.map((step, idx) => (
                  <div key={step.id} className="onboarding-view-step-group">
                    <div className="onboarding-view-step-title">{idx + 1}-bosqich</div>
                    {step.tasks.map((task) => {
                      const completion = assignment.completions.find((c) => c.taskId === task.id);
                      const TaskIcon = TASK_TYPES.find((t) => t.value === task.type)?.icon || Zap;
                      const reviewCfg = completion ? REVIEW_STATUS_CONFIG[completion.reviewStatus] : null;
                      const ReviewIcon = reviewCfg?.icon;
                      const isRejectingThis = rejectingTaskId === task.id;
                      return (
                        <div key={task.id} className={`onboarding-view-task ${completion ? `review-${completion.reviewStatus}` : ''}`}>
                          <div className="onboarding-view-task-header">
                            <span className="onboarding-view-task-icon"><TaskIcon size={14} strokeWidth={2.25} /></span>
                            <span className="onboarding-view-task-title">{task.title}</span>
                            <Badge variant={completion ? reviewCfg.variant : 'warning'}>
                              {ReviewIcon && <ReviewIcon size={11} strokeWidth={2.25} />}
                              {completion ? reviewCfg.label : 'Topshirilmagan'}
                            </Badge>
                          </div>
                          {completion && (
                            <div className="onboarding-view-task-submission">
                              {completion.submissionType === 'text' && <p>{completion.submissionText}</p>}
                              {completion.submissionType === 'link' && (
                                <a href={completion.submissionLink} target="_blank" rel="noreferrer">
                                  <Link2 size={13} strokeWidth={2.25} /> {completion.submissionLink}
                                </a>
                              )}
                              {completion.submissionType === 'file' && (
                                <a href={onboardingService.getDocumentUrl(completion.submissionFileUrl)} target="_blank" rel="noreferrer">
                                  <FileText size={13} strokeWidth={2.25} /> {completion.submissionFileName || 'Fayl'}
                                </a>
                              )}
                              <span className="onboarding-view-task-date">
                                <Clock size={11} strokeWidth={2.25} /> Topshirilgan: {new Date(completion.completedAt).toLocaleString('uz-UZ')}
                              </span>

                              {completion.reviewStatus === 'pending' && !isRejectingThis && (
                                <div className="onboarding-review-actions">
                                  <button
                                    type="button"
                                    className="onboarding-review-btn approve"
                                    disabled={isReviewing}
                                    onClick={() => handleApproveTask(assignment, task)}
                                  >
                                    <ThumbsUp size={13} strokeWidth={2.25} /> Qabul qildim
                                  </button>
                                  <button
                                    type="button"
                                    className="onboarding-review-btn reject"
                                    disabled={isReviewing}
                                    onClick={() => openRejectReason(task.id)}
                                  >
                                    <Undo2 size={13} strokeWidth={2.25} /> Qaytarish
                                  </button>
                                </div>
                              )}

                              {isRejectingThis && (
                                <div className="onboarding-reject-reason">
                                  <textarea
                                    className="form-textarea"
                                    rows={2}
                                    placeholder="Qaytarish sababi (ixtiyoriy)..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    autoFocus
                                  />
                                  <div className="onboarding-review-actions">
                                    <button
                                      type="button"
                                      className="onboarding-review-btn reject"
                                      disabled={isReviewing}
                                      onClick={() => handleRejectTask(assignment, task)}
                                    >
                                      <Undo2 size={13} strokeWidth={2.25} /> Qaytarishni tasdiqlash
                                    </button>
                                    <button
                                      type="button"
                                      className="onboarding-review-btn cancel"
                                      disabled={isReviewing}
                                      onClick={cancelRejectReason}
                                    >
                                      Bekor qilish
                                    </button>
                                  </div>
                                </div>
                              )}

                              {completion.reviewStatus === 'rejected' && (
                                <div className="onboarding-review-note rejected">
                                  <AlertCircle size={13} strokeWidth={2.25} />
                                  <span>
                                    {completion.reviewComment ? `Sabab: ${completion.reviewComment}` : 'Qaytarildi — xodim qayta topshirishi kerak'}
                                    {completion.reviewedAt && ` · ${new Date(completion.reviewedAt).toLocaleString('uz-UZ')}`}
                                  </span>
                                </div>
                              )}

                              {completion.reviewStatus === 'approved' && completion.reviewedAt && (
                                <div className="onboarding-review-note approved">
                                  <CheckCircle2 size={13} strokeWidth={2.25} />
                                  <span>Qabul qilingan: {new Date(completion.reviewedAt).toLocaleString('uz-UZ')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog {...confirmProps} />
    </div>
  );
}

export default OnboardingPage;
