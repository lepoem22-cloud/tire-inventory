'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.replace('/login'));
  }, []);
  return <div style={{ padding: 40, textAlign: 'center' }}>로그아웃 중…</div>;
}
