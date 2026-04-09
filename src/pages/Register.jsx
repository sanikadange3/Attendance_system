import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Cpu, Lock, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-surface-950">

      {/* Ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 w-full max-w-md mx-4 animate-scale-in">
        {/* Card */}
        <div className="bg-surface-900/80 backdrop-blur-xl border border-surface-700/50 rounded-3xl p-8 shadow-2xl">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-primary-600 flex items-center justify-center shadow-xl shadow-accent-500/30 mb-4">
              <Cpu size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Setup</h1>
            <p className="text-surface-400 text-sm mt-1">Create your master credentials</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-danger-500/10 border border-danger-500/30 text-danger-400 text-sm px-4 py-3 rounded-xl mb-5 animate-fade-in">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 bg-success-500/10 border border-success-500/30 text-success-400 text-sm px-4 py-3 rounded-xl mb-5 animate-fade-in">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              Admin account created! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="reg-email">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@attendai.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-800 border border-surface-700 text-white placeholder-surface-500
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500
                    transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="reg-password">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-800 border border-surface-700 text-white placeholder-surface-500
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500
                    transition-all duration-200"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="reg-confirm">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-800 border border-surface-700 text-white placeholder-surface-500
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500
                    transition-all duration-200"
                />
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading || success}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white
                bg-gradient-to-r from-accent-600 to-primary-600
                hover:from-accent-500 hover:to-primary-500
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-200 shadow-lg shadow-accent-500/30
                hover:shadow-accent-500/50 hover:scale-[1.01] active:scale-[0.99]
                mt-2"
            >
              {loading ? 'Creating account…' : 'Create Admin Account'}
            </button>
          </form>

          <button 
            type="button" 
            onClick={() => navigate('/')} 
            className="w-full mt-6 flex items-center justify-center gap-2 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
