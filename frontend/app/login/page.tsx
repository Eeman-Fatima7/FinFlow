'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      router.replace(user.role === 'admin' ? '/admin/overview' : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-emerald-100 via-cyan-100 to-blue-100">
        <div>
          <p className="text-2xl font-semibold">FinFlow</p>
        </div>
        <div>
          <h2 className="text-5xl font-bold leading-tight">
            Welcome back to
            <span className="block bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
              financial clarity
            </span>
          </h2>
          <p className="mt-5 text-lg text-zinc-700 max-w-md">
            Sign in to continue tracking transactions, budgets, goals, and AI-driven guidance in PKR.
          </p>
        </div>
        <div className="text-sm text-zinc-600">AI Personal Finance Advisor • Final Year Project</div>
      </section>

      <section className="grid place-items-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-600">Access your finance dashboard.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl border px-3 py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl border px-3 py-2.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-white disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

          <p className="mt-4 text-sm text-zinc-600">
            New here?{' '}
            <Link className="font-medium text-zinc-900 underline" href="/register">
              Create account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
