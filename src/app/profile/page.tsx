'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { User, Shield, Mail, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    setSavedMsg('');

    try {
      await supabase
        .from('temutask_profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq('id', user.id);

      setSavedMsg('Profile updated successfully!');
      await refreshProfile();
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Profile & Settings</h1>
          <p className="text-xs text-[#6B7280]">
            Manage your personal profile and account credentials.
          </p>
        </div>

        {savedMsg && (
          <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#059669] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}

        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-4 border-b border-[#E5E7EB] pb-5">
            <div className="w-14 h-14 rounded-full bg-[#111827] text-white flex items-center justify-center font-bold text-xl uppercase">
              {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#111827]">{profile?.full_name}</h3>
                <Badge variant={profile?.tier === 'pro' ? 'premium' : 'secondary'}>
                  {profile?.tier?.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-[#6B7280]">{profile?.email}</p>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Contact Phone Number"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111827]">Google Email Address</label>
              <div className="w-full px-3.5 py-2.5 text-sm bg-[#F3F4F6] border border-[#E5E7EB] rounded-md text-[#6B7280]">
                {profile?.email} (Verified by Google OAuth)
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111827]">Unique Permanent Referral Code</label>
              <div className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F3F4F6] border border-[#E5E7EB] rounded-md text-[#111827]">
                {profile?.referral_code}
              </div>
            </div>

            <Button type="submit" size="md" variant="primary" className="w-full" isLoading={isUpdating}>
              Save Profile Changes
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
