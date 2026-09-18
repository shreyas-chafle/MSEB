'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Phone, AlertCircle, ArrowRight, LogIn, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/services/authService';
import MahavitaranLogo from '@/components/ui/MahavitaranLogo';
import MahavitaranPageLoader from '@/components/ui/MahavitaranPageLoader';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
      });
      window.location.replace('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (!err.response) {
        setError('Unable to connect to backend server. Please check backend service.');
      } else {
        setError('Registration failed. Please check your details and try again.');
      }
    }
  };

  return (
    <div className="w-full max-w-md my-auto bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Official Mahavitaran Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <MahavitaranLogo size="lg" showSubtitle={true} />
          </div>
          <div className="pt-2">
            <h2 className="text-xl font-extrabold text-slate-900">Field Officer Self-Registration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create an official Mahavitaran field officer account to collect electricity bills and navigate consumer routes.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3.5 rounded-lg text-xs text-red-700 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          {/* Full Name */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rajesh Verma"
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Email *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@mahavitaran.in"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mobile Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98220 00000"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Password * (min 6 chars)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer mt-2"
          >
            {isLoading ? (
              <span>Creating Officer Account...</span>
            ) : (
              <>
                <span>Register & Access Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Login Navigation Link */}
        <div className="text-center pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1">
              <LogIn className="w-3.5 h-3.5" /> Sign In Here
            </Link>
          </p>
        </div>
      </div>
  );
}
