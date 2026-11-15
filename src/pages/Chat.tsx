import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Loader2, Search, Users, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/ui';
import type { Member } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

interface GroupMessage {
  id: string;
  establishment_id: string;
  sender_id: string;
  sender_name: string | null;
  message: string;
  created_at: string;
}

interface DirectMessage {
  id: string;
  establishment_id: string | null;
  sender_id: string;
  recipient_id: string;
  sender_name: string | null;
  message: string;
  created_at: string;
}

type Mode = 'group' | 'dm';

export default function ChatPage() {
  const { member, user } = useAuth();
  const [mode, setMode] = useState<Mode>('group');
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [peer, setPeer] = useState<Member | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canChat = Boolean(member?.establishment_id && member?.status === 'active');

  const filteredTeam = useMemo(() => {
    const q = search.toLowerCase().trim();
    return team.filter((m) => {
      if (m.user_id === user?.id) return false;
      if (m.status !== 'active') return false;
      if (!q) return true;
      return (
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
      );
    });
  }, [team, search, user?.id]);

  async function loadTeam() {
    if (!member?.establishment_id) return;
    let query = supabase
      .from('members')
      .select('*')
      .eq('status', 'active')
      .order('full_name');

    // Super admin peut voir plus large; sinon même établissement
    if (member.role !== 'super_admin') {
      query = query.eq('establishment_id', member.establishment_id);
    } else if (member.establishment_id) {
      query = query.eq('establishment_id', member.establishment_id);
    }
    const { data } = await query;
    setTeam((data ?? []) as Member[]);
  }

  async function loadGroup() {
    if (!member?.establishment_id) return;
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (err) setError(err.message);
    setGroupMessages((data ?? []) as GroupMessage[]);
  }

  async function loadDm(otherId: string) {
    if (!user?.id) return;
    const { data, error: err } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(300);
    if (err) setError(err.message);
    setDmMessages((data ?? []) as DirectMessage[]);
  }

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      await Promise.all([loadTeam(), loadGroup()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.establishment_id]);

  useEffect(() => {
    if (!member?.establishment_id) return;
    const channel = supabase
      .channel(`chat-group-${member.establishment_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `establishment_id=eq.${member.establishment_id}`,
        },
        (payload) => {
          const msg = payload.new as GroupMessage;
          setGroupMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          scrollBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [member?.establishment_id]);

  useEffect(() => {
    if (!peer || !user?.id) return;
    loadDm(peer.user_id);
    const channel = supabase
      .channel(`dm-${user.id}-${peer.user_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const msg = payload.new as DirectMessage;
          const involves =
            (msg.sender_id === user.id && msg.recipient_id === peer.user_id) ||
            (msg.sender_id === peer.user_id && msg.recipient_id === user.id);
          if (!involves) return;
          setDmMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          scrollBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer?.user_id, user?.id]);

  function scrollBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function notifyUser(userId: string, title: string, message: string, link: string) {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      read: false,
      link,
      type: 'chat',
      action_label: 'Ouvrir le chat',
    });
  }

  async function notifyTeamGroup(preview: string) {
    if (!member?.establishment_id || !user) return;
    const { data: teammates } = await supabase
      .from('members')
      .select('user_id')
      .eq('establishment_id', member.establishment_id)
      .eq('status', 'active')
      .neq('user_id', user.id);
    for (const t of teammates ?? []) {
      if (!t.user_id) continue;
      await notifyUser(
        t.user_id,
        'Nouveau message équipe',
        preview.slice(0, 120),
        '/chat'
      );
    }
  }

  async function send() {
    if (!text.trim() || !member || !user) return;
    setSending(true);
    setError(null);
    const body = text.trim();
    const senderName = member.full_name || member.email;

    try {
      if (mode === 'group') {
        const { error: err } = await supabase.from('chat_messages').insert({
          establishment_id: member.establishment_id,
          sender_id: user.id,
          sender_name: senderName,
          message: body,
        });
        if (err) throw err;
        await notifyTeamGroup(`${senderName}: ${body}`);
      } else {
        if (!peer) throw new Error('Choisissez un contact');
        const { error: err } = await supabase.from('direct_messages').insert({
          establishment_id: member.establishment_id,
          sender_id: user.id,
          recipient_id: peer.user_id,
          sender_name: senderName,
          message: body,
        });
        if (err) throw err;
        await notifyUser(
          peer.user_id,
          `Message de ${senderName}`,
          body.slice(0, 120),
          '/chat'
        );
      }
      setText('');
      scrollBottom();
    } catch (e: any) {
      setError(e?.message || 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }

  function openDm(m: Member) {
    setPeer(m);
    setMode('dm');
    setSearch('');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement chat…</div>;
  }

  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<MessageCircle size={48} />}
        title="Aucun établissement"
        message="Créez ou rattachez un établissement dans Paramètres pour utiliser le chat."
      />
    );
  }

  if (!canChat) {
    return (
      <EmptyState
        icon={<MessageCircle size={48} />}
        title="Accès chat"
        message="Votre compte doit être actif et rattaché à un établissement."
      />
    );
  }

  const messagesToShow = mode === 'group' ? groupMessages : dmMessages;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Contacts */}
      <div className="lg:w-72 shrink-0 card p-3 flex flex-col min-h-[200px] max-h-[40vh] lg:max-h-none">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => { setMode('group'); setPeer(null); }}
            className={`flex-1 text-xs py-2 rounded-xl border ${
              mode === 'group' ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'border-stone-700 text-stone-400'
            }`}
          >
            <Users size={14} className="inline mr-1" /> Équipe
          </button>
          <button
            type="button"
            onClick={() => setMode('dm')}
            className={`flex-1 text-xs py-2 rounded-xl border ${
              mode === 'dm' ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'border-stone-700 text-stone-400'
            }`}
          >
            <User size={14} className="inline mr-1" /> Privé
          </button>
        </div>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            className="input-field pl-8 text-sm py-2"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredTeam.length === 0 && (
            <p className="text-xs text-stone-500 p-2">Aucun membre trouvé. Créez des accès dans Mon équipe.</p>
          )}
          {filteredTeam.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => openDm(m)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                peer?.id === m.id ? 'bg-stone-700 text-stone-100' : 'hover:bg-stone-800 text-stone-300'
              }`}
            >
              <p className="font-medium truncate">{m.full_name || m.email}</p>
              <p className="text-[11px] text-stone-500">{ROLE_LABELS[m.role] || m.role}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-3">
          <h1 className="text-xl font-bold font-display text-stone-100 flex items-center gap-2">
            <MessageCircle size={22} className="text-primary-400" />
            {mode === 'group'
              ? 'Chat équipe'
              : peer
                ? `Discussion avec ${peer.full_name || peer.email}`
                : 'Messages privés'}
          </h1>
          <p className="text-stone-400 text-sm">
            {mode === 'group'
              ? 'Tous les membres actifs de l’établissement'
              : peer
                ? 'Conversation privée — notifications activées'
                : 'Recherchez et sélectionnez un contact pour écrire'}
          </p>
        </div>

        {error && (
          <div className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        <div className="flex-1 card overflow-y-auto p-4 space-y-3 min-h-0">
          {mode === 'dm' && !peer && (
            <p className="text-center text-stone-500 text-sm py-10">Sélectionnez un membre à gauche pour démarrer.</p>
          )}
          {mode === 'group' && messagesToShow.length === 0 && (
            <p className="text-center text-stone-500 text-sm py-10">Aucun message d’équipe. Écrivez le premier.</p>
          )}
          {(mode === 'group' || peer) &&
            (mode === 'group' ? groupMessages : dmMessages).map((m) => {
              const mine = m.sender_id === user?.id;
              const name = 'sender_name' in m ? m.sender_name : null;
              const body = m.message;
              const at = m.created_at;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      mine ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-100'
                    }`}
                  >
                    {!mine && <p className="text-xs font-semibold opacity-70 mb-0.5">{name ?? 'Membre'}</p>}
                    <p className="text-sm whitespace-pre-wrap">{body}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'text-primary-200' : 'text-stone-500'}`}>
                      {new Date(at).toLocaleString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          <div ref={bottomRef} />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              mode === 'group'
                ? "Message à toute l'équipe…"
                : peer
                  ? `Écrire à ${peer.full_name || 'ce contact'}…`
                  : 'Choisissez un contact…'
            }
            className="input-field flex-1"
            disabled={mode === 'dm' && !peer}
          />
          <button
            onClick={send}
            disabled={sending || !text.trim() || (mode === 'dm' && !peer)}
            className="btn-primary px-4 flex items-center gap-2"
          >
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
