import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, BellOff, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Notification } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui';

function notifAccent(type?: string | null): string {
  if (type === 'report_delay' || type === 'report_delay_owner') return 'border-red-500/40 bg-red-500/10';
  if (type === 'report_reminder' || type === 'owner_report_reminder') return 'border-amber-500/40 bg-amber-500/10';
  return 'border-stone-800 bg-stone-900/60';
}

function notifBadge(type?: string | null): string | null {
  if (type === 'report_delay' || type === 'report_delay_owner') return 'Retard';
  if (type === 'report_reminder' || type === 'owner_report_reminder') return 'Rappel point';
  return null;
}

export default function Notifications() {

  const { member } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    if (!member?.user_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false })
      .limit(80);
    setNotifs((data ?? []) as Notification[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (!member?.user_id) return;
    const channel = supabase
      .channel(`notifs-${member.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${member.user_id}`,
        },
        (payload) => {
          setNotifs((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.user_id]);

  async function markAllRead() {
    const unread = notifs.filter((n) => !n.read);
    for (const n of unread) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    await load();
  }

  async function remove(n: Notification) {
    await supabase.from('notifications').delete().eq('id', n.id);
    setNotifs((prev) => prev.filter((x) => x.id !== n.id));
  }

  async function openNotif(n: Notification) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setExpanded((id) => (id === n.id ? null : n.id));
  }

  async function goTo(n: Notification) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    const link = n.link || guessLink(n);
    if (link) navigate(link);
  }

  function guessLink(n: Notification): string | null {
    const t = `${notifBadge(n.type) && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-600/30 text-red-200 mr-2">
                          {notifBadge(n.type)}
                        </span>
                      )}
                      {n.title} ${n.message || ''} ${n.type || ''}`.toLowerCase();
    if (t.includes('chat') || t.includes('message')) return '/chat';
    if (t.includes('stock') || t.includes('inventaire') || t.includes('rupture')) return '/inventory';
    if (t.includes('clôture') || t.includes('cloture') || t.includes('rapport')) return '/daily-report';
    if (t.includes('vente') || t.includes('caisse')) return '/pos';
    if (t.includes('équipe') || t.includes('employ')) return '/team';
    return null;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Notifications</h1>
          <p className="text-stone-400 text-sm">
            {unreadCount} non lue{unreadCount > 1 ? 's' : ''} — touchez pour lire, ouvrez pour aller à la page
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-ghost flex items-center gap-2">
            <CheckCheck size={18} /> Tout marquer lu
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <EmptyState
          icon={<BellOff size={48} />}
          title="Aucune notification"
          message="Les messages du chat et alertes apparaîtront ici."
        />
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const isOpen = expanded === n.id;
            const link = n.link || guessLink(n);
            return (
              <div
                key={n.id}
                className={`card transition-all ${!n.read ? 'border-primary-500/30 bg-primary-500/5' : ''}`}
              >
                <button type="button" onClick={() => openNotif(n)} className="w-full text-left flex items-start gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-stone-600' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`font-medium truncate ${n.read ? 'text-stone-300' : 'text-stone-100'}`}>{n.title}</p>
                      {isOpen ? <ChevronUp size={16} className="text-stone-500" /> : <ChevronDown size={16} className="text-stone-500" />}
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{formatDateTime(n.created_at)}</p>
                    {!isOpen && n.message && (
                      <p className="text-sm text-stone-400 mt-1 line-clamp-1">{n.message}</p>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-stone-800 space-y-3">
                    <p className="text-sm text-stone-200 whitespace-pre-wrap">{n.message || 'Aucun détail'}</p>
                    <div className="flex flex-wrap gap-2">
                      {link && (
                        <button
                          type="button"
                          onClick={() => goTo(n)}
                          className="btn-primary text-sm flex items-center gap-1.5"
                        >
                          <ExternalLink size={14} /> {n.action_label || 'Ouvrir'}
                        </button>
                      )}
                      <button type="button" onClick={() => remove(n)} className="btn-ghost text-sm flex items-center gap-1 text-red-400">
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
