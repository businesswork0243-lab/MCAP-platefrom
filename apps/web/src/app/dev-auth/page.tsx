'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function DevAuth() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    const redirect = params.get('redirect') || '/dashboard';
    if (token) {
      localStorage.setItem('mcap_token', token);
      router.replace(redirect);
    }
  }, [params, router]);

  return <div style={{ padding: 24 }}>Setting up dev session...</div>;
}
