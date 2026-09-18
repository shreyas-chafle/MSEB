'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import OfflineSyncBanner from '@/components/offline/OfflineSyncBanner';
import MahavitaranPageLoader from '@/components/ui/MahavitaranPageLoader';

const AUTH_PAGES = ['/login', '/register'];
const PUBLIC_PAGES = ['/', '/login', '/register'];

function readAuthFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('mv_token');
  const user = localStorage.getItem('mv_user');
  if (!token || !user) return false;

  try {
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      let base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      const payload = JSON.parse(
        decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      );
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('mv_token');
        localStorage.removeItem('mv_user');
        document.cookie = 'mv_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        return false;
      }
    }
  } catch {
    return false;
  }

  return true;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isMapPage = pathname === '/map' || pathname.startsWith('/map');

  useEffect(() => {
    const authenticated = readAuthFromStorage();
    setIsAuthenticated(authenticated);
    setAuthChecked(true);

    // If trying to access a protected page without auth, redirect to login
    if (!authenticated && !AUTH_PAGES.includes(pathname)) {
      router.replace('/login');
    }
    // If already authenticated and visiting login/register, redirect to dashboard
    if (authenticated && AUTH_PAGES.includes(pathname)) {
      router.replace('/dashboard');
    }
  }, [pathname, router]);

  // Listen for auth state changes (login/logout events)
  useEffect(() => {
    const handleAuthChange = () => {
      const authenticated = readAuthFromStorage();
      setIsAuthenticated(authenticated);
      if (!authenticated && !AUTH_PAGES.includes(pathname)) {
        router.replace('/login');
      } else if (authenticated && AUTH_PAGES.includes(pathname)) {
        router.replace('/dashboard');
      }
    };
    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [pathname, router]);

  // Show loader until we've checked auth
  if (!authChecked) {
    return <MahavitaranPageLoader message="Initializing Mahavitaran Field Portal..." fullScreen={true} />;
  }

  // Render auth pages (login/register) without sidebar
  if (isAuthPage) {
    return (
      <div className="h-[100dvh] h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    );
  }

  // If not authenticated and on a protected page, show redirecting loader
  if (!isAuthenticated) {
    return <MahavitaranPageLoader message="Authentication required. Redirecting to Login..." fullScreen={true} />;
  }

  // Map page layout
  if (isMapPage) {
    return (
      <div className="h-[100dvh] h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
        <OfflineSyncBanner />
        <div className="flex flex-1 relative overflow-hidden w-full min-h-0">
          <Sidebar />
          <main className="flex-1 w-full min-h-0 overflow-hidden relative">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Standard layout with navbar + sidebar
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />
      <OfflineSyncBanner />
      <div className="flex flex-1 relative overflow-hidden pb-16 md:pb-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
