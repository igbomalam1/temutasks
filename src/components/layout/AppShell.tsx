'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  Wallet,
  Users,
  User,
  ShieldAlert,
  LogOut,
  Sparkles,
  PlusCircle,
  Smartphone,
  ArrowUpRight,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatNaira } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { user, profile, wallet, signOut, signInWithGoogle, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Available Tasks', href: '/tasks', icon: CheckSquare },
    { label: 'Create Task', href: '/tasks/create', icon: PlusCircle },
    { label: 'My Tasks', href: '/my-tasks', icon: ListTodo },
    { label: 'Wallet & Ledger', href: '/wallet', icon: Wallet },
    { label: 'Buy Airtime', href: '/wallet/airtime', icon: Smartphone },
    { label: 'Cash Out', href: '/wallet/cashout', icon: ArrowUpRight },
    { label: 'Referrals', href: '/referrals', icon: Users },
    { label: 'Pro Membership', href: '/pro', icon: Sparkles },
    { label: 'Profile & Settings', href: '/profile', icon: User },
  ];

  const mobileBottomItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', href: '/tasks', icon: CheckSquare },
    { label: 'My Tasks', href: '/my-tasks', icon: ListTodo },
    { label: 'Wallet', href: '/wallet', icon: Wallet },
    { label: 'Referrals', href: '/referrals', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop (only on small screens when drawer is open) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Clean White & Orange Fairly-Used Left Sidebar (Side-by-side on desktop, Drawer on mobile) */}
      <aside
        className={`bg-white border-r border-[#E5E7EB] flex flex-col justify-between transition-all duration-200 shrink-0 ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          sidebarOpen
            ? 'fixed inset-y-0 left-0 z-50 w-64 shadow-xl'
            : 'hidden lg:flex lg:sticky lg:top-0 lg:h-screen'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Sidebar Header / Brand */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#E5E7EB]">
            <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
              <Logo size="sm" showText={!collapsed} />
            </Link>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-[#6B7280] hover:text-[#F95700] hover:bg-[#FFF5F0] transition-colors"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Wallet Quick Summary inside Sidebar */}
          {!collapsed && (
            <div className="p-4 mx-3 mt-4 rounded-xl bg-[#FFF5F0] border border-[#F95700]/20 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#F95700] uppercase tracking-wider">
                <span>Wallet Balance</span>
                <Wallet className="w-3.5 h-3.5 text-[#F95700]" />
              </div>
              <div className="text-xl font-black text-[#111827]">
                {wallet ? formatNaira(BigInt(wallet.balance_kobo)) : '₦0.00'}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href="/wallet/airtime"
                  onClick={() => setSidebarOpen(false)}
                  className="flex-1 text-center py-1.5 rounded-lg bg-[#F95700] hover:bg-[#E04E00] text-white text-[11px] font-bold transition-colors shadow-xs"
                >
                  Airtime
                </Link>
                <Link
                  href="/wallet/cashout"
                  onClick={() => setSidebarOpen(false)}
                  className="flex-1 text-center py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:text-[#F95700] text-[#111827] text-[11px] font-bold transition-colors"
                >
                  Cash Out
                </Link>
              </div>
            </div>
          )}

          {/* Sidebar Navigation Items */}
          <nav className="p-3 space-y-1 flex-1 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#F95700] text-white shadow-xs'
                      : 'text-[#4B5563] hover:text-[#F95700] hover:bg-[#FFF5F0]'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-[#6B7280]'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}

            {profile?.role === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#FFF5F0] text-[#F95700] hover:bg-[#F95700] hover:text-white mt-4 border border-[#F95700]/30 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Admin Console</span>}
              </Link>
            )}
          </nav>
        </div>

        {/* Sidebar Bottom User Profile */}
        <div className="p-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
          {user ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-[#E5E7EB]">
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#111827] truncate">
                    {profile?.full_name || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-[#6B7280] truncate">{user.email}</div>
                </div>
              )}
              <button
                onClick={() => signOut()}
                className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-lg transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="primary"
              className="w-full text-xs"
              onClick={() => signInWithGoogle()}
              isLoading={isLoading}
              loadingText="Connecting..."
            >
              {collapsed ? '→' : 'Sign in'}
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content Area (Never blocked by sidebar!) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Header Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] h-16 px-4 sm:px-6 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#4B5563] hover:text-[#F95700] hover:bg-[#FFF5F0] border border-[#E5E7EB]"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>
            <span className="hidden lg:inline-block text-sm font-bold text-[#111827] capitalize">
              {pathname === '/dashboard'
                ? 'Overview Dashboard'
                : pathname.replace('/', '').replace('/', ' / ').replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {profile?.tier === 'pro' ? (
              <Badge variant="premium" className="gap-1">
                <Sparkles className="w-3 h-3" /> PRO MEMBER
              </Badge>
            ) : (
              <Link href="/pro">
                <Badge
                  variant="secondary"
                  className="hover:border-[#F95700] hover:text-[#F95700] cursor-pointer"
                >
                  Upgrade to Pro (₦200)
                </Badge>
              </Link>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E5E7EB] px-2 py-1.5 flex justify-around items-center shadow-lg">
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                isActive ? 'text-[#F95700]' : 'text-[#6B7280]'
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 ${
                  isActive ? 'text-[#F95700]' : 'text-[#9CA3AF]'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
