import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * DemoBadge
 * Small persistent indicator shown only when this build was compiled with
 * VITE_DEMO_MODE=true (the sales/presentation deployment) — a strict
 * string check, so it's a silent no-op unless a demo build deliberately
 * sets the flag. Production never sets it, so this renders null there.
 */
export function DemoBadge() {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return null;

  return (
    <div className="demo-mode-badge" role="status" title="Bu demo muhit — barcha ma'lumotlar fake">
      <Sparkles size={13} strokeWidth={2.25} />
      DEMO REJIMI
    </div>
  );
}

export default DemoBadge;
