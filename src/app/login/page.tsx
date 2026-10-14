'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { user, signInWithGoogle, isLoading } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string>('/dashboard');
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.push(nextPath);
    }
  }, [user, router, nextPath]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) setAuthError(err);

      const next = params.get('next');
      if (next && next.startsWith('/')) {
        setNextPath(next);
      }

      const ref = params.get('ref');
      if (ref) {
        const cleanRef = ref.trim().toUpperCase();
        localStorage.setItem('temutask_ref', cleanRef);
        setRefCode(cleanRef);
      } else {
        const savedRef = localStorage.getItem('temutask_ref');
        if (savedRef) setRefCode(savedRef);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="flex flex-col items-center">
          <Link href="/" className="inline-block mb-3">
            <Logo size="lg" />
          </Link>
          <h1 className="text-xl font-bold text-[#111827]">Sign in to TemuTasks</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Sign in to access your wallet, create tasks, or earn rewards.
          </p>
        </div>

        {refCode && (
          <div className="p-3 bg-[#FFF5F0] border border-[#F95700]/20 rounded-lg text-xs text-[#111827]">
            Referred by code: <strong className="text-[#F95700] font-mono">{refCode}</strong>
          </div>
        )}

        {authError && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626]">
            {authError}
          </div>
        )}

        <div className="space-y-4 pt-2">
          <Button
            size="lg"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 border-[#D1D5DB] hover:border-[#111827]"
            onClick={() => signInWithGoogle(nextPath)}
            isLoading={isLoading}
            loadingText="Signing in..."
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="font-semibold text-sm">Sign in</span>
          </Button>

          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-[#111827]">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-[#111827]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
