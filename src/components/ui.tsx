import type { ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-stone-900 border border-stone-700 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-display text-stone-100">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200 text-2xl leading-none">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  title,
  value,
  icon,
  accent = 'primary',
}: {
  label?: string;
  title?: string;
  value: string;
  icon: ReactNode;
  accent?: 'primary' | 'success' | 'error' | 'warning' | 'secondary';
}) {
  const displayLabel = label || title || '';
  const accentMap: Record<string, string> = {
    primary: 'text-primary-400 bg-primary-500/10',
    success: 'text-success-400 bg-success-500/10',
    error: 'text-error-400 bg-error-500/10',
    warning: 'text-warning-400 bg-warning-500/10',
    secondary: 'text-secondary-400 bg-secondary-500/10',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${accentMap[accent]}`}>{icon}</div>
      <div>
        <p className="text-sm text-stone-400">{displayLabel}</p>
        <p className="text-2xl font-bold font-display text-stone-100">{value}</p>
      </div>
    </div>
  );
}

export function Badge({ children, color = 'neutral' }: { children: ReactNode; color?: 'neutral' | 'success' | 'warning' | 'error' | 'primary' }) {
  const colorMap: Record<string, string> = {
    neutral: 'bg-stone-700 text-stone-200',
    success: 'bg-success-500/20 text-success-300',
    warning: 'bg-warning-500/20 text-warning-300',
    error: 'bg-error-500/20 text-error-300',
    primary: 'bg-primary-500/20 text-primary-300',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[color]}`}>{children}</span>;
}

export function EmptyState({ icon, title, message }: { icon: ReactNode; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center empty-state-motion px-4">
      <div className="relative mb-4">
        <span className="absolute -inset-2 rounded-full border border-amber-500/20 border-t-blue-400/30 opacity-80" aria-hidden />
        <div className="relative z-[1] text-stone-500 w-14 h-14 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-[10px] font-semibold tracking-widest text-amber-500/80 mb-1">GESMAK</p>
      <p className="text-lg font-semibold text-stone-300">{title}</p>
      <p className="text-sm text-stone-500 mt-1 max-w-xs leading-relaxed">{message}</p>
      <style>{`
        .empty-state-motion { animation: emptyIn .45s ease both; }
        @keyframes emptyIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .empty-state-motion { animation: none; }
        }
      `}</style>
    </div>
  );
}
