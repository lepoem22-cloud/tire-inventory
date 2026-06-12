'use client';

import { useState } from 'react';

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="sb-tab" onClick={() => setOpen(o => !o)} aria-label="메뉴">☰</button>
      {open && <div className="sb-backdrop" onClick={() => setOpen(false)} />}
      <nav className={'sb-panel' + (open ? ' open' : '')}>
        <div className="sb-title">메뉴</div>
        <a href="/">재고표</a>
        <a href="/backup">재고 백업로그</a>
        <a href="/logs">사용기록</a>
        <div style={{ borderTop: '1px solid #4a5568', margin: '12px 0' }} />
        <a href="/logout" style={{ color: '#fc8181' }}>🔓 로그아웃</a>
      </nav>
    </>
  );
}
