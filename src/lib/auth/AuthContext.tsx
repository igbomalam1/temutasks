'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  referral_code: string;
  referred_by?: string;
  role: 'user' | 'admin' | 'moderator';
  tier: 'basic' | 'pro';
  pro_expires_at?: string;
  status: 'active' | 'suspended' | 'restricted';
  phone?: string;
}

export interface UserWallet {
  balance_kobo: string;
  pending_kobo: string;
  reserved_kobo: string;
  total_earned_kobo: string;
  total_withdrawn_kobo: string;
  total_airtime_kobo: string;
  total_referral_earned_kobo: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  wallet: UserWallet | null;
  isLoading: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  wallet: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, walletRes] = await Promise.all([
        supabase.from('temutask_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('temutask_wallets').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.data && profileRes.data.referral_code && walletRes.data) {
        setProfile(profileRes.data as UserProfile);
        setWallet(walletRes.data as UserWallet);
      } else {
        // Ensure profile, referral_code, and wallet exist on the server via admin client
        const savedRef =
          typeof window !== 'undefined' ? localStorage.getItem('temutask_ref') : null;
        const res = await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: savedRef }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) setProfile(data.profile as UserProfile);
          if (data.wallet) setWallet(data.wallet as UserWallet);
        }
      }
    } catch (err) {
      console.error('Error loading user profile or wallet:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);

      if (data.session?.user) {
        await fetchUserData(data.session.user.id);
      }
      setIsLoading(false);
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);
        if (currentUser) {
          await fetchUserData(currentUser.id);
        } else {
          setProfile(null);
          setWallet(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (redirectPath: string = '/dashboard') => {
    // Check for referral code stored in localStorage
    const savedRef = typeof window !== 'undefined' ? localStorage.getItem('temutask_ref') : null;
    const callbackUrl = `${window.location.origin}/auth/callback${savedRef ? `?ref=${encodeURIComponent(savedRef)}` : ''}`;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setWallet(null);
    window.location.href = '/';
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        wallet,
        isLoading,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
