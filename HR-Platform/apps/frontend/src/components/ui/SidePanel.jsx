import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * SidePanel
 * Left-docked floating panel — not the shared centered Modal. Used across
 * the Davomat/Tashkilot pages wherever a form needs more room than the
 * standard modal.
 */
export function SidePanel({ isOpen, onClose, title, children, footer }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="attendance-filter-overlay" onClick={onClose}>
      <div className="attendance-filter-panel" onClick={(e) => e.stopPropagation()}>
        <div className="attendance-filter-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Yopish">
            &times;
          </button>
        </div>
        <div className="attendance-filter-body">
          {children}
        </div>
        {footer && (
          <div className="attendance-filter-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default SidePanel;
