'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function DevAuthContent() {
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

export default function DevAuth() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Setting up dev session...</div>}>
      <DevAuthContent />
    </Suspense>
  );
}
