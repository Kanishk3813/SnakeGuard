import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications, savePushToken } from '@/lib/notifications';

interface ResponderProfile {
  user_id: string;
  full_name?: string;
  is_responder?: boolean;
  expo_push_token?: string;
  responder_location_lat?: number;
  responder_location_lng?: number;
  responder_location_updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ResponderProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ResponderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data);
    return data;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
        try {
          const token = await registerForPushNotifications();
          if (token) await savePushToken(token);
        } catch (e) {
          console.log('Push notification registration skipped:', e);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Validate that user is a responder
    if (data.user) {
      const profileData = await fetchProfile(data.user.id);
      if (!profileData?.is_responder) {
        await supabase.auth.signOut();
        setProfile(null);
        return { error: 'This account is not registered as a responder. Please use the SnakeGuard user app instead.' };
      }
    }

    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
