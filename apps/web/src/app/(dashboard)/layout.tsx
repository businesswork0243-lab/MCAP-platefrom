'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/store/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, fetchMe, user } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!user) fetchMe();
  }, [token]);

  if (!token) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
