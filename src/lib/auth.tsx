import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toAuthEmail } from './login';
import { isOnline, cacheAuthProfile, getCachedAuthProfile, prefetchForOffline } from './offline';
import { getLoginLockRemaining, registerLoginFailure, registerLoginSuccess, isSafeLogin, safeErrorMessage, isStrongEnoughPassword, isPasswordBreached } from './security';
import type { Member, AccessRequest, Establishment } from './types';

export interface MyEstablishment extends Establishment {
  member_role?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: Member | null;
  accessRequest: AccessRequest | null;
  loading: boolean;
  needsAccess: boolean;
  /** Rôle effectif pour menus (owner peut basculer vers un rôle équipe) */
  viewAsRole: Member['role'] | null;
  effectiveRole: Member['role'] | null;
  setViewAsRole: (role: Member['role'] | null) => void;
  /** Établissements auxquels l'utilisateur est rattaché (phase 2) */
  myEstablishments: MyEstablishment[];
  activeEstablishment: MyEstablishment | null;
  switchEstablishment: (establishmentId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [viewAsRole, setViewAsRoleState] = useState<Member['role'] | null>(null);

  function setViewAsRole(role: Member['role'] | null) {
    if (role && !['manager', 'cashier', 'employee', 'owner'].includes(role)) return;
    setViewAsRoleState(role);
    try {
      if (role) localStorage.setItem('mm_view_as_role', role);
      else localStorage.removeItem('mm_view_as_role');
    } catch { /* */ }
  }

  useEffect(() => {
    try {
      const v = localStorage.getItem('mm_view_as_role') as Member['role'] | null;
      if (v && ['manager', 'cashier', 'employee'].includes(v)) setViewAsRoleState(v);
    } catch { /* */ }
  }, []);

  const effectiveRole: Member['role'] | null = (() => {
    if (!member) return null;
    if (member.role === 'super_admin' || member.role === 'admin') return member.role;
    if (member.role === 'owner' && viewAsRole) return viewAsRole;
    return member.role;
  })();
  const [myEstablishments, setMyEstablishments] = useState<MyEstablishment[]>([]);
  // Init synchrone : au refresh l'établissement est connu immédiatement (pas d'attente réseau)
  const [activeEstablishment, setActiveEstablishment] = useState<MyEstablishment | null>(null);

  /** Nettoie le cache établissement (évite de coller un maquis d'un autre compte) */
  function clearEstablishmentCache() {
    try {
      localStorage.removeItem('mm_active_est');
      localStorage.removeItem('mm_est_ids');
      // anciennes clés par user
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('mm_active_est:') || k.startsWith('mm_est_ids:'))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch { /* */ }
  }

  function saveActiveEstForUser(userId: string | undefined, est: { id: string; type?: string; name?: string } | null) {
    try {
      if (!userId || !est?.id) return;
      const payload = JSON.stringify({ id: est.id, type: est.type, name: est.name });
      localStorage.setItem(`mm_active_est:${userId}`, payload);
      localStorage.setItem('mm_active_est', payload); // compat
    } catch { /* */ }
  }



  async function loadMyEstablishments(currentUser: User, currentMember: Member | null) {
    try {
      const { data: links } = await supabase
        .from('member_establishments')
        .select('establishment_id, role, status')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

      let estIds = (links ?? []).map((l) => l.establishment_id);
      if (currentMember?.establishment_id && !estIds.includes(currentMember.establishment_id)) {
        estIds = [...estIds, currentMember.establishment_id];
      }

      if (currentMember && ['super_admin', 'admin', 'owner'].includes(currentMember.role)) {
        const { data: owned } = await supabase
          .from('establishments')
          .select('id')
          .eq('created_by', currentUser.id);
        for (const o of owned ?? []) {
          if (!estIds.includes(o.id)) estIds.push(o.id);
        }
      }

      let list: MyEstablishment[] = [];
      const roleMap = new Map((links ?? []).map((l) => [l.establishment_id, l.role]));

      if (estIds.length > 0) {
        const { data: ests } = await supabase.from('establishments').select('*').in('id', estIds);
        list = (ests ?? []).map((e) => ({
          ...(e as Establishment),
          member_role: roleMap.get(e.id) ?? currentMember?.role,
        }));
      }

      // Filet de sécurité : si le membre a un establishment_id mais la liste est vide (RLS)
      if (list.length === 0 && currentMember?.establishment_id) {
        const { data: one } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', currentMember.establishment_id)
          .maybeSingle();
        if (one) {
          list = [{ ...(one as Establishment), member_role: currentMember.role }];
        }
      }

      setMyEstablishments(list);
      let active =
        list.find((e) => e.id === currentMember?.establishment_id) ?? list[0] ?? null;

      // Mobile / réseau : si la liste est vide mais le membre a un establishment_id, ne JAMAIS effacer
      if (!active && currentMember?.establishment_id) {
        active = {
          id: currentMember.establishment_id,
          name: 'Mon établissement',
          type: 'maquis',
          member_role: currentMember.role,
        } as MyEstablishment;
        // Enrichir depuis le cache user si dispo
        try {
          const raw = localStorage.getItem(`mm_active_est:${currentUser.id}`);
          if (raw) {
            const c = JSON.parse(raw);
            if (c?.id === currentMember.establishment_id) {
              active = { ...active, name: c.name || active.name, type: c.type || active.type };
            }
          }
        } catch { /* */ }
      }

      setActiveEstablishment(active);
      try {
        if (active?.id) {
          localStorage.setItem('mm_est_ids', JSON.stringify(list.length ? list.map((e) => e.id) : [active.id]));
          localStorage.setItem(`mm_est_ids:${currentUser.id}`, JSON.stringify(list.length ? list.map((e) => e.id) : [active.id]));
          saveActiveEstForUser(currentUser.id, active);
        } else if (!currentMember?.establishment_id) {
          // Uniquement si vraiment aucun établissement serveur
          clearEstablishmentCache();
          setActiveEstablishment(null);
        }
      } catch { /* */ }
    } catch (e) {
      console.error('loadMyEstablishments', e);
      // Erreur réseau mobile : conserver établissement du membre
      try {
        if (currentMember?.establishment_id) {
          const uid = currentUser.id;
          let payload: MyEstablishment = {
            id: currentMember.establishment_id,
            name: 'Mon établissement',
            type: 'maquis',
            member_role: currentMember.role,
          } as MyEstablishment;
          const raw = localStorage.getItem(`mm_active_est:${uid}`);
          if (raw) {
            const c = JSON.parse(raw);
            if (c?.id === currentMember.establishment_id) {
              payload = { ...payload, name: c.name || payload.name, type: c.type || payload.type };
            }
          }
          setActiveEstablishment((prev) => prev || payload);
          setMyEstablishments((prev) => (prev.length ? prev : [payload]));
        }
      } catch { /* */ }
    }
  }

  async function switchEstablishment(establishmentId: string) {
    if (!user || !member) return;
    const target = myEstablishments.find((e) => e.id === establishmentId);
    if (!target) return;

    // Palier : multi-sites / max établissements
    const primary = myEstablishments[0];
    const plan = getEffectivePlan(primary as any);
    if (!plan.multiSite && establishmentId !== (member.establishment_id || primary?.id)) {
      alert(
        `Offre ${plan.label} : un seul établissement. Passez en Pro pour gérer plusieurs sites.`,
      );
      return;
    }
    if (myEstablishments.length > plan.maxEstablishments && establishmentId !== member.establishment_id) {
      // si déjà trop de sites liés, on autorise le switch mais on a prévenu à la création
      const allowedIds = myEstablishments.slice(0, plan.maxEstablishments).map((e) => e.id);
      if (!allowedIds.includes(establishmentId) && member.role !== 'super_admin' && member.role !== 'admin') {
        alert(`Offre ${plan.label} : maximum ${plan.maxEstablishments} établissement(s).`);
        return;
      }
    }

    const role = (target?.member_role as Member['role']) || member.role;

    await supabase
      .from('members')
      .update({ establishment_id: establishmentId, role })
      .eq('user_id', user.id);

    await supabase.from('member_establishments').upsert(
      {
        user_id: user.id,
        establishment_id: establishmentId,
        role,
        status: 'active',
      },
      { onConflict: 'user_id,establishment_id' }
    );

    await loadMemberData(user);
  }

  function buildFallbackMember(currentUser: User): Member {
    const email = currentUser.email ?? '';
    return {
      id: currentUser.id,
      user_id: currentUser.id,
      email,
      full_name:
        (currentUser.user_metadata?.full_name as string) ||
        (currentUser.user_metadata?.name as string) ||
        email.split('@')[0] ||
        'Utilisateur',
      role: 'owner',
      status: 'active',
      establishment_id: null,
      created_at: new Date().toISOString(),
    } as Member;
  }

  
  /** Assure que staff (employé/gérant/caissier) a establishment + rôle depuis member_establishments */
  async function ensureStaffEstablishment(currentUser: User, existing: Member): Promise<Member> {
    let m = { ...existing };
    try {
      const { data: links } = await supabase
        .from('member_establishments')
        .select('establishment_id, role, status')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

      const link = (links && links[0]) || null;
      if (link?.establishment_id) {
        const needUpdate =
          m.establishment_id !== link.establishment_id ||
          (link.role && m.role !== link.role) ||
          m.status !== 'active';
        if (needUpdate) {
          const payload: Record<string, unknown> = {
            establishment_id: link.establishment_id,
            status: 'active',
          };
          if (link.role && !['super_admin', 'admin'].includes(m.role)) {
            payload.role = link.role;
          }
          await supabase.from('members').update(payload).eq('user_id', currentUser.id);
          const { data: refreshed } = await supabase
            .from('members')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          if (refreshed) m = refreshed as Member;
          else m = { ...m, establishment_id: link.establishment_id, role: (link.role as Member['role']) || m.role };
        }
      }

      // Charger établissement actif + propriétaire (created_by)
      if (m.establishment_id) {
        const { data: est } = await supabase
          .from('establishments')
          .select('id, name, type, created_by, owner_user_id, owner_email, owner_phone')
          .eq('id', m.establishment_id)
          .maybeSingle();
        if (est) {
          try {
            localStorage.setItem(
              'mm_active_est',
              JSON.stringify({
                id: est.id,
                type: est.type,
                name: est.name,
                owner_user_id: est.owner_user_id || est.created_by,
              })
            );
            localStorage.setItem('mm_est_ids', JSON.stringify([est.id]));
          } catch { /* */ }
          setActiveEstablishment({
            ...(est as any),
            member_role: m.role,
          });
          setMyEstablishments([{ ...(est as any), member_role: m.role }]);
        }
      }
    } catch (e) {
      console.error('ensureStaffEstablishment', e);
    }
    return m;
  }

  async function loadMemberData(currentUser: User): Promise<Member> {
    const fallback = buildFallbackMember(currentUser);
    try {
      // 1) RPC SECURITY DEFINER : fiable mobile (bypass RLS race session)
      try {
        const { data: boot, error: bootErr } = await supabase.rpc('bootstrap_my_session');
        if (!bootErr && boot && typeof boot === 'object') {
          const payload = boot as { member?: Member; establishment?: { id: string; name?: string; type?: string } | null; error?: string };
          if (payload.member && payload.member.user_id) {
            const m = payload.member as Member;
            setMember(m);
            setAccessRequest(null);
            setNeedsAccess(false);
            if (payload.establishment?.id) {
              const est = {
                id: payload.establishment.id,
                name: payload.establishment.name || 'Mon établissement',
                type: payload.establishment.type || 'maquis',
                member_role: m.role,
              } as MyEstablishment;
              setActiveEstablishment(est);
              setMyEstablishments([est]);
              try {
                saveActiveEstForUser(currentUser.id, est);
                localStorage.setItem('mm_est_ids', JSON.stringify([est.id]));
                localStorage.setItem(`mm_est_ids:${currentUser.id}`, JSON.stringify([est.id]));
              } catch { /* */ }
            } else if (m.establishment_id) {
              try { await loadMyEstablishments(currentUser, m); } catch { /* */ }
            }
            try { await cacheAuthProfile({ userId: currentUser.id, member: m }); } catch { /* */ }
            return m;
          }
        } else if (bootErr) {
          console.warn('bootstrap_my_session', bootErr);
        }
      } catch (e) {
        console.warn('bootstrap_my_session throw', e);
      }

      // Cache local : prioritaire hors-ligne ; aussi en secours si réseau flaky
      try {
        const cached = await getCachedAuthProfile(currentUser.id);
        if (cached?.member && (cached.member as Member).establishment_id) {
          if (!isOnline()) {
            const cm = cached.member as Member;
            setMember(cm);
            setAccessRequest(null);
            setNeedsAccess(false);
            try { await loadMyEstablishments(currentUser, cm); } catch { /* */ }
            return cm;
          }
          // En ligne : garder comme filet si les SELECT suivants échouent
          (loadMemberData as any)._cachedMember = cached.member;
        }
      } catch {
        /* ignore */
      }

      let existingMember: Member | null = null;
      for (let i = 0; i < 3 && !existingMember; i++) {
        try {
          if (i > 0) await new Promise((r) => setTimeout(r, 350 * i));
          const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          if (error) console.error('members select error', error);
          existingMember = (data as Member) || null;
        } catch (e) {
          console.error('members select throw', e);
        }
      }
      // Mobile offline / RLS : profil cache IndexedDB
      if (!existingMember) {
        try {
          const { getCachedAuthProfile } = await import('./offline');
          const cached = await getCachedAuthProfile(currentUser.id);
          if (cached?.member) {
            existingMember = cached.member as Member;
          }
        } catch { /* */ }
      }

      // Toujours rattacher staff → établissement + propriétaire
      if (existingMember) {
        existingMember = await ensureStaffEstablishment(currentUser, existingMember);
      }

      if (existingMember && !existingMember.establishment_id) {
        try {
          // Priorité: lien équipe (member_establishments)
          {
            const { data: linkFirst } = await supabase
              .from('member_establishments')
              .select('establishment_id, role')
              .eq('user_id', currentUser.id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();
            if (linkFirst?.establishment_id) {
              await supabase
                .from('members')
                .update({
                  establishment_id: linkFirst.establishment_id,
                  role: (linkFirst.role as any) || existingMember.role,
                })
                .eq('user_id', currentUser.id);
              const { data: refreshed } = await supabase
                .from('members')
                .select('*')
                .eq('user_id', currentUser.id)
                .maybeSingle();
              if (refreshed) existingMember = refreshed as Member;
            }
          }
          let estId: string | null = null;
          const { data: owned } = await supabase
            .from('establishments')
            .select('id')
            .eq('created_by', currentUser.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (owned?.id) estId = owned.id;
          if (!estId) {
            const { data: link } = await supabase
              .from('member_establishments')
              .select('establishment_id')
              .eq('user_id', currentUser.id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();
            if (link?.establishment_id) estId = link.establishment_id;
          }
          if (estId) {
            await supabase
              .from('members')
              .update({ establishment_id: estId })
              .eq('user_id', currentUser.id);
            const { data: refreshed } = await supabase
              .from('members')
              .select('*')
              .eq('user_id', currentUser.id)
              .maybeSingle();
            if (refreshed) existingMember = refreshed as Member;
            else existingMember = { ...existingMember, establishment_id: estId };
          }
        } catch {
          /* ignore */
        }
      }

      if (existingMember) {
        setMember(existingMember);
        setAccessRequest(null);
        setNeedsAccess(false);
        try {
          await loadMyEstablishments(currentUser, existingMember);
        } catch {
          /* ignore */
        }
        try {
          await cacheAuthProfile({ userId: currentUser.id, member: existingMember });
        } catch {
          /* ignore */
        }
        return existingMember;
      }

      // Récupérer un établissement existant (créé par l'user ou via member_establishments)
      let recoveredEstId: string | null = null;
      try {
        const { data: owned } = await supabase
          .from('establishments')
          .select('id')
          .eq('created_by', currentUser.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (owned?.id) recoveredEstId = owned.id;
      } catch { /* */ }
      if (!recoveredEstId) {
        try {
          const { data: link } = await supabase
            .from('member_establishments')
            .select('establishment_id')
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
          if (link?.establishment_id) recoveredEstId = link.establishment_id;
        } catch { /* */ }
      }

      const payload: Record<string, unknown> = {
        user_id: currentUser.id,
        email: fallback.email,
        full_name: fallback.full_name,
        role: 'owner',
        status: 'active',
      };
      if (recoveredEstId) payload.establishment_id = recoveredEstId;

      try {
        // insert only if absent — ne pas écraser un establishment_id existant avec null
        const { data: inserted, error: insErr } = await supabase
          .from('members')
          .insert(payload)
          .select()
          .maybeSingle();
        if (!insErr && inserted) {
          const m = inserted as Member;
          setMember(m);
          setAccessRequest(null);
          setNeedsAccess(false);
          try { await loadMyEstablishments(currentUser, m); } catch { /* */ }
          return m;
        }
        // Si conflit (déjà existant) : recharger sans upsert destructif
        const { data: again } = await supabase
          .from('members')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (again) {
          let m = again as Member;
          if (!m.establishment_id && recoveredEstId) {
            await supabase.from('members').update({ establishment_id: recoveredEstId }).eq('user_id', currentUser.id);
            m = { ...m, establishment_id: recoveredEstId };
          }
          setMember(m);
          setAccessRequest(null);
          setNeedsAccess(false);
          try { await loadMyEstablishments(currentUser, m); } catch { /* */ }
          return m;
        }
        if (insErr) console.error('member insert error', insErr);
      } catch (e) {
        console.error('member insert throw', e);
      }

      // Dernier recours : fallback AVEC établissement récupéré si possible
      const fb = recoveredEstId
        ? { ...fallback, establishment_id: recoveredEstId }
        : fallback;
      setMember(fb);
      setAccessRequest(null);
      setNeedsAccess(false);
      if (recoveredEstId) {
        try { await loadMyEstablishments(currentUser, fb); } catch { /* */ }
      } else {
        // Nouveau propriétaire : vider tout cache établissement (sinon RCO d'un autre compte)
        clearEstablishmentCache();
        setMyEstablishments([]);
        setActiveEstablishment(null);
      }
      return fb;
    } catch (e) {
      console.error('loadMemberData', e);
      try {
        const cached = (loadMemberData as any)._cachedMember as Member | undefined;
        if (cached?.establishment_id) {
          setMember(cached);
          setNeedsAccess(false);
          try { await loadMyEstablishments(currentUser, cached); } catch { /* */ }
          return cached;
        }
        const { getCachedAuthProfile } = await import('./offline');
        const c2 = await getCachedAuthProfile(currentUser.id);
        if (c2?.member && (c2.member as Member).establishment_id) {
          const cm = c2.member as Member;
          setMember(cm);
          setNeedsAccess(false);
          try { await loadMyEstablishments(currentUser, cm); } catch { /* */ }
          return cm;
        }
      } catch { /* */ }
      setMember(fallback);
      setNeedsAccess(false);
      return fallback;
    }
  }



  useEffect(() => {
    let mounted = true;
    let memberLoadSeq = 0;

    async function ensureMember(u: User) {
      const seq = ++memberLoadSeq;
      try {
        // JAMAIS de Promise.race timeout : un réseau lent ≠ compte nouveau
        await loadMemberData(u);
      } catch (e) {
        console.error('ensureMember', e);
        if (mounted && seq === memberLoadSeq) {
          // Préserver membre déjà connu ; sinon cache offline
          try {
            const { getCachedAuthProfile } = await import('./offline');
            const cached = await getCachedAuthProfile(u.id);
            if (cached?.member) {
              setMember(cached.member as Member);
              if ((cached.member as Member).establishment_id) {
                try { await loadMyEstablishments(u, cached.member as Member); } catch { /* */ }
              }
            } else {
              setMember((prev) => prev ?? buildFallbackMember(u));
            }
          } catch {
            setMember((prev) => prev ?? buildFallbackMember(u));
          }
          setNeedsAccess(false);
        }
      }
    }

    async function boot() {
      // Restaure la session depuis localStorage (persistSession: true).
      // Ne JAMAIS forcer user=null par timeout — seule cause légitime = pas de token / signOut.
      const safety = window.setTimeout(() => {
        if (mounted) setLoading(false);
      }, 15000);
      try {
        let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) console.error('getSession', error);
          session = data?.session ?? null;
        } catch (e) {
          console.error('getSession', e);
        }
        // Session absente mais refresh token présent → un seul essai
        if (!session) {
          try {
            const { data: ref } = await supabase.auth.refreshSession();
            session = ref?.session ?? null;
          } catch { /* */ }
        }
        if (!mounted) return;
        // Important : ne poser null que si vraiment aucune session
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          await ensureMember(session.user);
        } else {
          // Ne pas écraser un user éventuellement posé par INITIAL_SESSION
          setSession((prev) => prev ?? null);
          setUser((prev) => prev ?? null);
        }
      } catch (e) {
        console.error('boot', e);
      } finally {
        window.clearTimeout(safety);
        if (mounted) setLoading(false);
      }
    }

    boot();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setMember(null);
        setAccessRequest(null);
        setNeedsAccess(false);
        setMyEstablishments([]);
        setActiveEstablishment(null);
        setViewAsRoleState(null);
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED sans session : garder l'utilisateur actuel (réseau instable)
      if (event === 'TOKEN_REFRESHED' && !newSession?.user) {
        return;
      }

      if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        // Ne pas recharger le membre ni lever TypePicker
        return;
      }

      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        // INITIAL_SESSION / SIGNED_IN / USER_UPDATED → charger le profil (await via void, loading géré)
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          // INITIAL_SESSION = restauration localStorage au refresh : garder user/session
          if (event === 'INITIAL_SESSION') {
            if (newSession?.user) {
              setSession(newSession);
              setUser(newSession.user);
              // membre chargé par boot() ; ne pas rebloquer loading
            }
            return;
          }
          // Ne pas rebloquer loading : signIn() a déjà posé user/session.
          // ensureMember en fond uniquement (évite spinner login infini).
          void ensureMember(newSession.user).catch((e) =>
            console.warn('SIGNED_IN ensureMember', e),
          );
        } else {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(login: string, password: string) {
    try {
      const lockLeft = getLoginLockRemaining();
      if (lockLeft > 0) {
        const min = Math.ceil(lockLeft / 60000);
        return { error: `Trop de tentatives. Réessayez dans ${min} min.` };
      }
      if (!login.trim()) return { error: 'Saisissez votre identifiant ou e-mail.' };
      if (!password) return { error: 'Saisissez votre mot de passe.' };
      if (!isSafeLogin(login)) {
        return { error: 'Identifiant invalide (e-mail ou login simple sans espaces).' };
      }
      const email = toAuthEmail(login);
      setLoading(true);

      // Auth seul — timeout 12s (mobile 4G parfois lent vers Supabase)
      type AuthRes = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      let data: AuthRes['data'] | null = null;
      let error: AuthRes['error'] | null = null;
      try {
        const raced = await Promise.race([
          supabase.auth.signInWithPassword({ email, password }).then((r) => ({
            kind: 'ok' as const,
            r,
          })),
          new Promise<{ kind: 'timeout' }>((resolve) =>
            setTimeout(() => resolve({ kind: 'timeout' }), 12000),
          ),
        ]);
        if (raced.kind === 'timeout') {
          setLoading(false);
          return {
            error:
              'Le serveur met trop de temps à répondre. Réessayez dans quelques secondes.',
          };
        }
        data = raced.r.data;
        error = raced.r.error;
      } catch (netErr: any) {
        setLoading(false);
        return {
          error:
            netErr?.message ||
            'Impossible de contacter le serveur. Vérifiez Internet et réessayez.',
        };
      }

      if (error) {
        registerLoginFailure();
        setLoading(false);
        return { error: safeErrorMessage(error, 'Identifiant ou mot de passe incorrect') };
      }
      registerLoginSuccess();
      const signedUser = data?.user ?? data?.session?.user ?? null;
      // signInWithPassword a déjà posé la session dans le client — ne PAS await setSession (bloquant mobile)
      if (data?.session) {
        setSession(data.session);
      }
      if (!signedUser) {
        setLoading(false);
        return { error: 'Identifiant ou mot de passe incorrect' };
      }
      setUser(signedUser);

      // Cache autres comptes — synchrone et léger
      try {
        const keep = `mm_active_est:${signedUser.id}`;
        const keepIds = `mm_est_ids:${signedUser.id}`;
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k === 'mm_active_est' || k === 'mm_est_ids') toRemove.push(k);
          if (k.startsWith('mm_active_est:') && k !== keep) toRemove.push(k);
          if (k.startsWith('mm_est_ids:') && k !== keepIds) toRemove.push(k);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      } catch { /* */ }

      setLoading(false);
      // Profil membre en fond — ne bloque jamais le bouton
      void loadMemberData(signedUser).catch((e) => {
        console.warn('background loadMemberData', e);
        void (async () => {
          try {
            const { getCachedAuthProfile } = await import('./offline');
            const cached = await getCachedAuthProfile(signedUser.id);
            if (cached?.member) setMember(cached.member as Member);
            else setMember((prev) => prev ?? buildFallbackMember(signedUser));
          } catch {
            setMember((prev) => prev ?? buildFallbackMember(signedUser));
          }
        })();
      });
      return { error: null };
    } catch (e: any) {
      registerLoginFailure();
      setLoading(false);
      return {
        error:
          e?.message ||
          'Connexion impossible. Vérifiez Internet et réessayez.',
      };
    }
  }

  async function signUp(login: string, password: string, fullName: string) {
    clearEstablishmentCache();
    setActiveEstablishment(null);
    setMyEstablishments([]);
    if (!login.trim()) return { error: 'E-mail ou identifiant requis.' };
    if (!isSafeLogin(login)) {
      return { error: 'Identifiant invalide (e-mail ou login simple).' };
    }
    const strength = isStrongEnoughPassword(password);
    if (!strength.ok) return { error: strength.reason };
    const email = toAuthEmail(login);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || login, name: fullName || login },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      const alreadyMsg =
        'Cet identifiant est déjà utilisé. Utilisez « Se connecter » ou « Mot de passe oublié ».';

      if (error && /already|registered|exists|duplicate/i.test(error.message || '')) {
        setLoading(false);
        return { error: alreadyMsg };
      }
      if (error) {
        setLoading(false);
        return { error: safeErrorMessage(error, error.message) };
      }

      // Doublon masqué Supabase
      const identities = data?.user?.identities;
      if (data?.user && Array.isArray(identities) && identities.length === 0 && !data.session) {
        setLoading(false);
        return { error: alreadyMsg };
      }

      // Profil membre propriétaire
      if (data?.user?.id) {
        try {
          await supabase.from('members').upsert(
            {
              user_id: data.user.id,
              email: data.user.email || email,
              full_name: fullName || login,
              role: 'owner',
              status: 'active',
              establishment_id: null,
            },
            { onConflict: 'user_id' }
          );
        } catch {
          /* trigger ou RLS */
        }
      }

      // Session disponible (confirm e-mail désactivé côté Supabase) → connecter
      if (data.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        try {
          await loadMemberData(data.session.user);
        } catch {
          setMember(buildFallbackMember(data.session.user));
          setNeedsAccess(false);
        }
        setLoading(false);
        return { error: null };
      }

      // Pas de session (confirm e-mail activé) → tentative de connexion immédiate
      // (nécessaire pour identifiants @maquis.local sans boîte mail)
      try {
        const { data: s2, error: e2 } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!e2 && s2.session?.user) {
          setSession(s2.session);
          setUser(s2.session.user);
          try {
            await loadMemberData(s2.session.user);
          } catch {
            setMember(buildFallbackMember(s2.session.user));
            setNeedsAccess(false);
          }
          setLoading(false);
          return { error: null };
        }
        if (e2 && /confirm|verification|email not confirmed/i.test(e2.message || '')) {
          setLoading(false);
          return {
            error:
              'Confirmez votre e-mail via le lien reçu, puis connectez-vous. (Pour un identifiant sans e-mail réel, demandez à l’admin de désactiver la confirmation e-mail dans Supabase.)',
          };
        }
      } catch { /* */ }

      setLoading(false);
      return { error: null };
    } catch (e: any) {
      setLoading(false);
      const msg = e?.message || 'Inscription impossible';
      if (/already|registered|exists|duplicate/i.test(msg)) {
        return {
          error: 'Cet identifiant est déjà utilisé. Utilisez « Se connecter » ou « Mot de passe oublié ».',
        };
      }
      return { error: msg };
    }
  }

  async function signInWithGoogle() {
    const origin = window.location.origin.replace(/\/$/, '');
    // Callback dédié PKCE (allow-list Supabase : …/auth/callback)
    const redirectTo = `${origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // Une seule navigation : on contrôle l'URL retournée
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'online',
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      const msg = error.message || '';
      if (/provider is not enabled/i.test(msg)) {
        throw new Error(
          "Google n'est pas activé sur Supabase. Activez Authentication → Providers → Google."
        );
      }
      if (/redirect/i.test(msg)) {
        throw new Error(
          `URL de retour non autorisée (${redirectTo}). Ajoutez-la dans Supabase → Authentication → URL Configuration.`
        );
      }
      throw error;
    }
    if (!data?.url) {
      throw new Error('Connexion Google impossible (URL OAuth manquante). Réessayez.');
    }
    window.location.assign(data.url);
  }

  async function signOut() {
    clearEstablishmentCache();
    setSession(null);
    setUser(null);
    setMember(null);
    setAccessRequest(null);
    setNeedsAccess(false);
    setMyEstablishments([]);
    setActiveEstablishment(null);
    setViewAsRoleState(null);
    setLoading(false);
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch { /* réseau : état déjà vidé */ }
  }

  /* Déconnexion auto désactivée : session jusqu'au bouton Déconnexion */


  async function refresh() {
    if (user) {
      try {
        await loadMemberData(user);
      } catch (e) {
        console.error('refresh', e);
      }
    }
  }

  
  // Présence admin : dernière activité
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    async function beat() {
      try {
        await supabase
          .from('members')
          .update({ last_seen: new Date().toISOString() } as any)
          .eq('user_id', user!.id);
      } catch {
        /* colonne absente = ignorer */
      }
    }
    void beat();
    const id = window.setInterval(() => {
      if (!cancelled && document.visibilityState === 'visible') void beat();
    }, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void beat();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user?.id]);

return (
    <AuthContext.Provider
      value={{
        session,
        user,
        member,
        accessRequest,
        loading,
        needsAccess,
        viewAsRole,
        effectiveRole,
        setViewAsRole,
        myEstablishments,
        activeEstablishment,
        switchEstablishment,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
