/**
 * Reset Password Page
 * Sends password reset email for email/password users.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { Button, Input } from '@/components/ui';
import { resetPassword } from '@/services/authService';
import { parseErrorMessage, isValidEmail } from '@/lib/utils';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !isValidEmail(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      toast.success('Password reset email sent. Check your inbox.');
    } catch (error) {
      toast.error(parseErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card p-8"
      >
        <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-gray-400 mb-6">
          Enter your account email to receive a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            disabled={isLoading}
          />

          <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
            Send Reset Link
          </Button>
        </form>

        <p className="mt-6 text-sm text-gray-400">
          Remembered your password?{' '}
          <Link href="/auth/login" className="text-neon-cyan hover:underline">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
