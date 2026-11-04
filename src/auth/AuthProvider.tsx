import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/errors';
type AuthState = { session: Session | null; loading: boolean; error: string | null; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      eventReceived = true;
      if (active) { setSession(next); setError(null); setLoading(false); }
    });
    void client.auth.getSession().then(({ data, error: failure }) => {
      if (!active || eventReceived) return;
      setSession(data.session); setError(failure ? errorMessage(failure) : null); setLoading(false);
    }).catch((failure: unknown) => { if (active && !eventReceived) { setError(errorMessage(failure)); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    if (!supabase) return;
    const { error: failure } = await supabase.auth.signOut();
    if (failure) throw failure;
    setSession(null);
  }
  return <AuthContext.Provider value={{ session, loading, error, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
