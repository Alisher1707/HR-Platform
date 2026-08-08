import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import employeeService from '../../services/employeeService';
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
import Select from '../../components/ui/Select';
import SidePanel from '../../components/ui/SidePanel';
import Modal from '../../components/ui/Modal';

const TABS = [
  { value: 'rejalar', label: 'Rejalar', icon: BookOpen },
  { value: 'progress', label: 'Progress', icon: TrendingUp },
];

let stepSeq = 0;
function emptyStep() {
  stepSeq += 1;
  return { id: `new-${stepSeq}`, title: '', description: '' };
}

function emptyPlanForm() {
  return { name: '', description: '', steps: [emptyStep()] };
}

function getPublicLink(token) {
  return `${window.location.origin}/onboarding/public/${token}`;
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

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
    [employees]
  );

  // --- Plan create/edit ---
  const [isPlanPanelOpen, setIsPlanPanelOpen] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlanForm());
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const openCreatePlan = () => {
    setPlanForm(emptyPlanForm());
    setEditingPlanId(null);
    setIsPlanPanelOpen(true);
  };

  const openEditPlan = (plan) => {
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      steps: plan.steps.length > 0
        ? plan.steps.map((s) => ({ id: s.id, title: s.title, description: s.description || '' }))
        : [emptyStep()],
    });
    setEditingPlanId(plan.id);
    setIsPlanPanelOpen(true);
  };

  const addStep = () => setPlanForm((f) => ({ ...f, steps: [...f.steps, emptyStep()] }));
  const updateStep = (id, field, value) => setPlanForm((f) => ({
    ...f,
    steps: f.steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
  }));
  const removeStep = (id) => setPlanForm((f) => ({ ...f, steps: f.steps.filter((s) => s.id !== id) }));

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error('Reja nomini kiriting');
      return;
    }
    const validSteps = planForm.steps.filter((s) => s.title.trim());
    if (validSteps.length === 0) {
      toast.error("Kamida bitta bosqich qo'shing");
      return;
    }
    setIsSavingPlan(true);
    try {
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim(),
        steps: validSteps.map((s) => ({ title: s.title.trim(), description: s.description.trim() })),
      };
      if (editingPlanId) {
        await onboardingService.updatePlan(editingPlanId, payload);
        toast.success('Reja yangilandi');
      } else {
        await onboardingService.createPlan(payload);
        toast.success('Reja yaratildi');
      }
      setIsPlanPanelOpen(false);
      refreshPlans();
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

  // --- Assign to employee ---
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignPlan, setAssignPlan] = useState(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [createdAssignment, setCreatedAssignment] = useState(null);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  const openAssign = (plan) => {
    setAssignPlan(plan);
    setAssignEmployeeId('');
    setCreatedAssignment(null);
    setIsLinkCopied(false);
    setIsAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignEmployeeId) {
      toast.error('Xodimni tanlang');
      return;
    }
    setIsAssigning(true);
    try {
      const result = await onboardingService.createAssignment(assignPlan.id, assignEmployeeId);
      setCreatedAssignment(result);
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
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
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
    } catch (err) {
      toast.error(err.response?.data?.message || "Bekor qilishda xatolik");
    }
  };

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
                  <span><ListChecks size={14} strokeWidth={2.25} /> {plan.stepCount} bosqich</span>
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
                  <th>Joriy bosqich</th>
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

      {/* Plan create/edit panel */}
      <SidePanel
        isOpen={isPlanPanelOpen}
        onClose={() => setIsPlanPanelOpen(false)}
        title={editingPlanId ? 'Rejani tahrirlash' : 'Yangi reja'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsPlanPanelOpen(false)}>Bekor qilish</Button>
            <Button variant="primary" onClick={handleSavePlan} disabled={isSavingPlan} style={{ flex: 1 }}>
              {isSavingPlan ? 'Saqlanmoqda...' : editingPlanId ? 'Saqlash' : 'Yaratish'}
            </Button>
          </>
        }
      >
        <Input
          label="Reja nomi"
          name="planName"
          value={planForm.name}
          onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Masalan: Yangi sotuvchi uchun"
          required
        />
        <Textarea
          label="Tavsif (ixtiyoriy)"
          name="planDescription"
          value={planForm.description}
          onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Reja haqida qisqacha ma'lumot"
          rows={2}
        />

        <div className="onboarding-steps-header">
          <label className="form-label">Bosqichlar</label>
        </div>

        <div className="onboarding-steps-list">
          {planForm.steps.map((step, idx) => (
            <div key={step.id} className="onboarding-step-row">
              <span className="onboarding-step-number">{idx + 1}</span>
              <div className="onboarding-step-fields">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Bosqich nomi"
                  value={step.title}
                  onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Izoh (ixtiyoriy)"
                  value={step.description}
                  onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                />
              </div>
              <button
                type="button"
                className="onboarding-step-remove"
                aria-label="Bosqichni o'chirish"
                onClick={() => removeStep(step.id)}
              >
                <Trash2 size={15} strokeWidth={2.25} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="onboarding-step-add" onClick={addStep}>
          <Plus size={15} strokeWidth={2.5} /> Bosqich qo'shish
        </button>
      </SidePanel>

      {/* Assign to employee modal */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title={createdAssignment ? 'Havola tayyor' : 'Xodimga biriktirish'}
        size="sm"
        footer={
          createdAssignment ? (
            <Button variant="primary" onClick={() => setIsAssignOpen(false)} style={{ width: '100%' }}>
              Yopish
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="onboarding-btn-wide" onClick={() => setIsAssignOpen(false)}>Bekor qilish</Button>
              <Button variant="primary" className="onboarding-btn-wide" onClick={handleAssign} disabled={isAssigning}>
                {isAssigning ? 'Biriktirilmoqda...' : 'Biriktirish'}
              </Button>
            </>
          )
        }
      >
        {createdAssignment ? (
          <div className="attendance-device-created">
            <span className="attendance-device-created-icon"><Check size={26} strokeWidth={2.25} /></span>
            <h3>{createdAssignment.employeeName} uchun havola yaratildi</h3>
            <p>Bu shaxsiy havola — xodim login qilmasdan o'z bosqichlarini shu yerdan belgilaydi. Nusxalab, xodimga yuboring.</p>
            <div className="attendance-device-token-box">
              <code>{getPublicLink(createdAssignment.publicToken)}</code>
              <button type="button" className="attendance-device-token-copy" onClick={() => handleCopyLink(createdAssignment.publicToken)}>
                {isLinkCopied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2.25} />}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              <strong>{assignPlan?.name}</strong> rejasini qaysi xodimga biriktiramiz?
            </p>
            <Select
              label="Xodim"
              name="assignEmployee"
              value={assignEmployeeId}
              onChange={(e) => setAssignEmployeeId(e.target.value)}
              options={employeeOptions}
              required
            />
          </>
        )}
      </Modal>

      <ConfirmDialog {...confirmProps} />
    </div>
  );
}

export default OnboardingPage;
