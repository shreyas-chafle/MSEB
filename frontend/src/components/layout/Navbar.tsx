'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Power, User as UserIcon } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';

import MahavitaranLogo from '@/components/ui/MahavitaranLogo';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isAuthPage = pathname === '/login' || pathname === '/register';

  const handleLogout = async () => {
    await authService.logout();
    router.push('/login');
  };

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-95 transition-opacity">
          <MahavitaranLogo size="md" showSubtitle={true} />
        </Link>

        {user && !isAuthPage && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full p-1 pr-3 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-slate-500 capitalize font-medium">
                  Field Officer
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex flex-col items-center justify-center gap-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-xs transition-colors cursor-pointer shrink-0"
              title="Sign out"
            >
              <Power className="w-4 h-4 text-rose-600" />
              <span className="text-[8px] font-extrabold text-rose-700 leading-none">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
