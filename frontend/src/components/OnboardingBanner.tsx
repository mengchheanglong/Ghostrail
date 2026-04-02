import { motion } from 'framer-motion';

const STEPS = [
  'Describe what you want to build or change in plain language.',
  'Click "Generate Pack" — Ghostrail structures your goal into constraints, criteria, and risks.',
  'Review the pack, then export it to GitHub or hand it to your AI coding agent.',
];

export function OnboardingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      className="onboarding-banner"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
            👋 Welcome to Ghostrail
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Ghostrail keeps AI-generated code changes aligned with your intent — before, during, and after coding.
          </p>
          <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {STEPS.map((step, i) => (
              <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <button
          className="btn btn-ghost"
          onClick={onDismiss}
          style={{ flexShrink: 0, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
          aria-label="Dismiss onboarding banner"
        >
          Got it, hide this
        </button>
      </div>
    </motion.div>
  );
}
