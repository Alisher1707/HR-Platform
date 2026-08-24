import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Trash2, X } from 'lucide-react';
import Button from './Button';

/**
 * ConfirmDialog
 * Styled replacement for window.confirm() — reuses the same centered
 * delete-confirmation look already established in OrganizationPage
 * (icon badge + title + message + two full-width buttons), just made
 * reusable via the useConfirm() hook.
 */
export function ConfirmDialog({
  isOpen,
  title = "Amalni tasdiqlash",
  message,
  confirmLabel = "O'chirish",
  cancelLabel = 'Bekor qilish',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-sm org-delete-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="org-delete-icon">
          <Trash2 size={26} strokeWidth={1.5} />
          <span className="org-delete-icon-badge">
            <X size={12} strokeWidth={3} />
          </span>
        </div>
        <h3 className="org-delete-title">{title}</h3>
        <p className="org-delete-message">{message}</p>
        <div className="org-delete-actions">
          <Button variant="primary" fullWidth onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="outline" fullWidth onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmDialog;
