'use client';

import { useState, useEffect } from 'react';
import { User } from '@/types';
import { authService } from '@/services/authService';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Read from localStorage on mount (localStorage is safe on server too — guard with typeof window)
    const storedUser = authService.getCurrentUser();
    setUser(storedUser);
    setIsLoading(false);

    // Re-sync whenever auth-change or storage events fire
    const handleAuthChange = () => {
      const current = authService.getCurrentUser();
      setUser(current);
      setIsLoading(false);
    };

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isOfficer: user?.role === 'field_officer',
    isLoading,
  };
}
