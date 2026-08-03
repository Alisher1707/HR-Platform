import { useCallback, useRef, useState } from 'react';

/**
 * useConfirm Hook
 * Promise-based replacement for window.confirm(): `await confirm(message)`
 * resolves true/false depending on which button the user pressed. Spread
 * `confirmProps` onto a <ConfirmDialog /> rendered once in the component.
 */
export function useConfirm() {
  const [state, setState] = useState({ isOpen: false, message: '', title: undefined, danger: false, confirmLabel: undefined, cancelLabel: undefined });
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    setState({ isOpen: true, ...opts });
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolveRef.current?.(false);
  }, []);

  return {
    confirm,
    confirmProps: {
      ...state,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}

export default useConfirm;
