'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Ctx = { session: Session | null; isAdmin: boolean; ready: boolean; signOut: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ session: null, isAdmin: false, ready: false, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

async function checkAdmin(userId: string) {
  const { data } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const apply = async (s: Session | null) => {
      const admin = s ? await checkAdmin(s.user.id) : false;
      if (!alive) return;
      setSession(s);
      setIsAdmin(admin);
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onLogin = pathname === '/login';
    if (!(session && isAdmin) && !onLogin) router.replace('/login');
    if (session && isAdmin && onLogin) router.replace('/');
  }, [ready, session, isAdmin, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return <AuthCtx.Provider value={{ session, isAdmin, ready, signOut }}>{children}</AuthCtx.Provider>;
}

// Bloqueia o conteúdo até confirmar que é administrador
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { ready, session, isAdmin } = useAuth();
  if (!ready || !session || !isAdmin) return <div className="loading">Carregando…</div>;
  return <>{children}</>;
}
