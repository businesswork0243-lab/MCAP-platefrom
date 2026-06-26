'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [error, setError] = useState('');

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      router.push('/onboarding');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start generating enterprise-quality content</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Full Name</label>
              <Input placeholder="Jane Smith" value={form.name} onChange={set('name')} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Company</label>
              <Input placeholder="Acme Inc." value={form.companyName} onChange={set('companyName')} required />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} minLength={8} required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" loading={isLoading}>
            Create Account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
