'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pw }),
      });
      const res = await r.json();
      if (!res.ok) { setErr(res.msg || '로그인 실패'); setBusy(false); return; }
      window.location.href = '/';
    } catch (e) {
      setErr('오류: ' + e.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>2026 타이어 통합 관리</h1>
        <p>로그인 후 이용하세요</p>
        <input placeholder="아이디" value={id}
          onChange={e => setId(e.target.value)}
          onKeyUp={e => { if (e.key === 'Enter') submit(); }} autoFocus />
        <input type="password" placeholder="비밀번호" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyUp={e => { if (e.key === 'Enter') submit(); }} />
        <button onClick={submit} disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
        {err && <div className="login-err">{err}</div>}
      </div>
    </div>
  );
}
