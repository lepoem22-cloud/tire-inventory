'use client';

import { useEffect, useState, useRef } from 'react';

export default function BackupPage() {
  const [items, setItems] = useState([]);
  const [day, setDay] = useState('');
  const [kw, setKw] = useState('');
  const [status, setStatus] = useState('로딩…');
  const [isAdmin, setIsAdmin] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const lastIdx = useRef(null);

  const load = () => {
    setStatus('로딩…');
    fetch('/api/backup-log')
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.msg || '오류');
        setItems(res.items || []);
        setIsAdmin(res.me && res.me.role === 'admin');
        setPicked(new Set());
        setStatus('최근 ' + (res.items || []).length + '건');
      })
      .catch(e => setStatus('로딩 실패: ' + e.message));
  };
  useEffect(load, []);

  const days = [...new Set(items.map(it => it.ymd))];
  const k = kw.trim().toLowerCase();
  const filtered = items.filter(it => {
    if (day && it.ymd !== day) return false;
    if (k && ![it.brand, it.pattern, it.pcode, it.size, it.dot].join(' ').toLowerCase().includes(k)) return false;
    return true;
  });
  const shown = filtered.slice(0, 1000);

  const togglePick = (id, idx, shift) => {
    setPicked(prev => {
      const n = new Set(prev);
      if (shift && lastIdx.current != null) {
        const a = Math.min(lastIdx.current, idx), b = Math.max(lastIdx.current, idx);
        for (let i = a; i <= b; i++) if (shown[i]) n.add(shown[i].id);
      } else {
        if (n.has(id)) n.delete(id); else n.add(id);
      }
      return n;
    });
    lastIdx.current = idx;
  };

  const delPicked = async () => {
    const ids = [...picked];
    if (!ids.length) { alert('삭제할 항목을 선택하세요'); return; }
    if (!confirm(`선택한 ${ids.length}건을 삭제할까요?`)) return;
    setStatus('삭제 중…');
    const r = await fetch('/api/backup-log', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    const res = await r.json();
    if (res.ok) load(); else setStatus('삭제 실패: ' + res.msg);
  };
  const delAll = async () => {
    if (!confirm('재고 백업로그를 전부 삭제합니다. 되돌릴 수 없습니다.\n진행할까요?')) return;
    if (!confirm('한 번 더 확인합니다. 정말 전체 삭제합니까?')) return;
    setStatus('전체 삭제 중…');
    const r = await fetch('/api/backup-log', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    const res = await r.json();
    if (res.ok) load(); else setStatus('삭제 실패: ' + res.msg);
  };

  return (
    <>
      <div className="nav">
        <b style={{ fontSize: 14 }}>재고 백업로그</b>
        <select value={day} onChange={e => setDay(e.target.value)}>
          <option value="">전체 날짜</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input placeholder="브랜드/패턴/사이즈 검색" value={kw} onChange={e => setKw(e.target.value)} />
        <button className="btn" onClick={load}>새로고침</button>
        {isAdmin && (
          <>
            <button className="btn" style={{ background: '#fff5f5', borderColor: '#fc8181', color: '#c53030', fontWeight: 'bold' }}
              onClick={delPicked}>🗑 선택 삭제{picked.size ? ` (${picked.size})` : ''}</button>
            <button className="btn" style={{ background: '#742a2a', borderColor: '#742a2a', color: '#fff', fontWeight: 'bold' }}
              onClick={delAll}>전체 삭제</button>
          </>
        )}
        <a className="btn" href="/" style={{ textDecoration: 'none', color: '#2d3748' }}>← 재고표로</a>
        <div id="status" className="ok">{status}</div>
      </div>
      <div className="container">
        <table style={{ minWidth: 1700 }}>
          <thead>
            <tr>
              {isAdmin && <th style={{ width: 30, background: '#fed7d7' }}>✓</th>}
              <th style={{ width: 86 }}>날짜</th>
              <th style={{ width: 70 }}>시간</th>
              <th style={{ width: 80 }}>브랜드</th>
              <th style={{ width: 110 }}>패턴</th>
              <th style={{ width: 60 }}>코드</th>
              <th style={{ width: 125 }}>사이즈</th>
              <th style={{ width: 60 }}>DOT</th>
              <th style={{ width: 60 }}>이전수량</th>
              <th style={{ width: 50 }}>장착</th>
              <th style={{ width: 50 }}>직배</th>
              <th style={{ width: 50 }}>택배</th>
              <th style={{ width: 50 }}>핑택</th>
              <th style={{ width: 50 }}>핑직</th>
              <th style={{ width: 50 }}>11번</th>
              <th style={{ width: 50 }}>스팜</th>
              <th style={{ width: 50 }}>롯데</th>
              <th style={{ width: 66 }} className="bi">출고합계</th>
              <th style={{ width: 76 }} className="bs">처리후수량</th>
              <th style={{ width: 200 }}>특이사항(메모)</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={isAdmin ? 20 : 19} style={{ padding: '30px 0', color: '#718096', fontWeight: 'bold' }}>
                백업 기록이 없습니다 — 매일 저녁 8시 자동 백업 시 출고가 있던 품목이 여기에 쌓입니다
              </td></tr>
            )}
            {shown.map((it, i) => (
              <tr key={it.id ?? i}>
                {isAdmin && (
                  <td style={{ background: picked.has(it.id) ? '#fed7d7' : '#fff5f5' }}>
                    <input type="checkbox" checked={picked.has(it.id)} readOnly
                      onClick={e => togglePick(it.id, i, e.shiftKey)} style={{ cursor: 'pointer' }} />
                  </td>
                )}
                <td>{it.ymd}</td>
                <td>{it.hm}</td>
                <td>{it.brand}</td>
                <td>{it.pattern}</td>
                <td>{it.pcode}</td>
                <td>{it.size}</td>
                <td>{it.dot}</td>
                <td>{it.qty}</td>
                <td>{it.mount || ''}</td>
                <td>{it.direct || ''}</td>
                <td>{it.daily_del || ''}</td>
                <td>{it.ping_del || ''}</td>
                <td>{it.ping_dir || ''}</td>
                <td>{it.store11 || ''}</td>
                <td>{it.storefarm || ''}</td>
                <td>{it.lotte || ''}</td>
                <td className="bi">{it.sales_total}</td>
                <td className="bs">{it.new_qty}</td>
                <td style={{ textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: 11 }}>{it.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
