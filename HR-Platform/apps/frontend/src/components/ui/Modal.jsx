import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Modal Component
 * Reusable modal popup with overlay, transitions, sizes and ESC support
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md', // 'sm', 'md', 'lg'
  align, // undefined (centered, default) | 'top'
}) {
  // Close on Escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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
    <div className={`modal-overlay ${align === 'top' ? 'modal-overlay-top' : ''}`} onClick={onClose}>
      <div 
        className={`modal-content modal-${size}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Yopish">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
