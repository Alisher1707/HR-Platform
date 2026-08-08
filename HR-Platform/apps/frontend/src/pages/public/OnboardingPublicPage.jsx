import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Rocket, CheckCircle2, Circle, PartyPopper, Briefcase } from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * OnboardingPublicPage
 * No login, no sidebar — an employee opens their personal link and ticks
 * off onboarding steps directly. Token-gated on the backend, not user-gated.
 */
export function OnboardingPublicPage() {
  const { token } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingStepId, setTogglingStepId] = useState(null);

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

  const handleToggle = async (stepId, currentlyDone) => {
    setTogglingStepId(stepId);
    try {
      const updated = await onboardingService.toggleStep(token, stepId, !currentlyDone);
      setAssignment(updated);
    } catch (err) {
      // Silently keep the previous state — the checkbox simply won't move.
    } finally {
      setTogglingStepId(null);
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
          <span>{assignment.completedSteps} / {assignment.totalSteps} bosqich bajarildi ({assignment.progress}%)</span>
        </div>

        {isComplete && (
          <div className="onboarding-public-complete-banner">
            <PartyPopper size={18} strokeWidth={2.25} />
            Barcha bosqichlarni muvaffaqiyatli yakunladingiz!
          </div>
        )}

        <div className="onboarding-public-steps">
          {assignment.steps.map((step) => {
            const done = assignment.completedStepIds.includes(step.id);
            const isToggling = togglingStepId === step.id;
            return (
              <button
                key={step.id}
                type="button"
                className={`onboarding-public-step ${done ? 'done' : ''}`}
                onClick={() => handleToggle(step.id, done)}
                disabled={isToggling}
              >
                <span className="onboarding-public-step-check">
                  {done ? <CheckCircle2 size={22} strokeWidth={2} /> : <Circle size={22} strokeWidth={1.75} />}
                </span>
                <span className="onboarding-public-step-text">
                  <span className="onboarding-public-step-title">{step.title}</span>
                  {step.description && <span className="onboarding-public-step-desc">{step.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OnboardingPublicPage;
