'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const FIELD_KO = {
  brand: '브랜드', pattern: '패턴', pcode: '코드', size: '사이즈', pr: '피수', dot: 'DOT',
  factory: '공장가', qty: '수량', mount: '장착', direct: '직배', daily_del: '택배',
  ping_del: '핑택', ping_dir: '핑직', store11: '11번가', storefarm: '스토어팜', lotte: '롯데',
  dc_rate: '할인율', dc_price: '할인가', note: '판매등록', tire_id: '타이어ID',
  product_code: '상품코드', '행추가': '행 추가',
};

export default function LogsPage() {
  const [items, setItems] = useState([]);
  const [kw, setKw] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('로딩…');
  const [isAdmin, setIsAdmin] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const lastIdx = useRef(null);

  const load = useCallback((p = page, q = kw) => {
    setStatus('로딩…');
    fetch(`/api/logs?page=${p}&q=${encodeURIComponent(q.trim())}`)
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.msg || '오류');
        setItems(res.items || []);
        setTotalPages(res.totalPages || 1);
        setTotal(res.total || 0);
        setPage(res.page || 1);
        setIsAdmin(res.me && res.me.role === 'admin');
        setPicked(new Set());
        setStatus(`전체 ${res.total}건 · ${res.page}/${res.totalPages} 페이지`);
      })
      .catch(e => setStatus('로딩 실패: ' + e.message));
  }, [page, kw]);

  useEffect(() => { load(1, ''); /* eslint-disable-next-line */ }, []);

  // 검색어 입력 시 디바운스로 1페이지부터 다시 조회
  useEffect(() => {
    const t = setTimeout(() => load(1, kw), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [kw]);

  const goPage = (p) => { if (p >= 1 && p <= totalPages) load(p, kw); };

  const togglePick = (id, idx, shift) => {
    setPicked(prev => {
      const n = new Set(prev);
      if (shift && lastIdx.current != null) {
        const a = Math.min(lastIdx.current, idx), b = Math.max(lastIdx.current, idx);
        for (let i = a; i <= b; i++) if (items[i]) n.add(items[i].id);
      } else {
        if (n.has(id)) n.delete(id); else n.add(id);
      }
      return n;
    });
    lastIdx.current = idx;
  };

  const allPicked = items.length > 0 && items.every(it => picked.has(it.id));
  const toggleAll = () => {
    setPicked(prev => {
      if (allPicked) return new Set();
      return new Set(items.map(it => it.id));
    });
  };

  const delPicked = async () => {
    const ids = [...picked];
    if (!ids.length) { alert('삭제할 항목을 선택하세요'); return; }
    if (!confirm(`이 페이지에서 선택한 ${ids.length}건을 삭제할까요?`)) return;
    setStatus('삭제 중…');
    const r = await fetch('/api/logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    const res = await r.json();
    if (res.ok) load(page, kw); else setStatus('삭제 실패: ' + res.msg);
  };
  const delAll = async () => {
    if (!confirm('모든 페이지의 사용기록을 전부 삭제합니다. 되돌릴 수 없습니다.\n진행할까요?')) return;
    if (!confirm('한 번 더 확인합니다. 정말 전체 삭제합니까?')) return;
    setStatus('전체 삭제 중…');
    const r = await fetch('/api/logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    const res = await r.json();
    if (res.ok) load(1, kw); else setStatus('삭제 실패: ' + res.msg);
  };

  return (
    <>
      <div className="nav">
        <b style={{ fontSize: 14 }}>사용기록</b>
        <input placeholder="사용자/품목/날짜 검색" value={kw} onChange={e => setKw(e.target.value)} />
        <button className="btn" onClick={() => load(page, kw)}>새로고침</button>
        {isAdmin && (
          <>
            <button className="btn" onClick={toggleAll}>{allPicked ? '전체해제' : '전체선택'}</button>
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
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: 30, background: '#fed7d7' }}>
                  <input type="checkbox" checked={allPicked} readOnly onClick={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
              )}
              <th style={{ width: 90 }}>날짜</th>
              <th style={{ width: 76 }}>시간</th>
              <th style={{ width: 90 }}>사용자</th>
              <th style={{ width: 90 }}>브랜드</th>
              <th style={{ width: 120 }}>패턴</th>
              <th style={{ width: 130 }}>사이즈</th>
              <th style={{ width: 80 }}>항목</th>
              <th>입력값</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={isAdmin ? 9 : 8} style={{ padding: '30px 0', color: '#718096', fontWeight: 'bold' }}>기록이 없습니다</td></tr>
            )}
            {items.map((it, i) => (
              <tr key={it.id ?? i}>
                {isAdmin && (
                  <td style={{ background: picked.has(it.id) ? '#fed7d7' : '#fff5f5' }}>
                    <input type="checkbox" checked={picked.has(it.id)} readOnly
                      onClick={e => togglePick(it.id, i, e.shiftKey)} style={{ cursor: 'pointer' }} />
                  </td>
                )}
                <td>{it.ymd}</td>
                <td>{it.hms}</td>
                <td style={{ fontWeight: 'bold', color: '#3730a3' }}>{it.user_id}</td>
                <td>{it.brand}</td>
                <td>{it.pattern}</td>
                <td>{it.size}</td>
                <td style={{ fontWeight: 'bold' }}>{FIELD_KO[it.field] || it.field}</td>
                <td>{it.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} goPage={goPage} />
    </>
  );
}

function Pager({ page, totalPages, goPage }) {
  if (totalPages <= 1) return null;
  const nums = [];
  const from = Math.max(1, page - 2), to = Math.min(totalPages, page + 2);
  for (let i = from; i <= to; i++) nums.push(i);
  return (
    <div className="pager">
      <button className="btn" disabled={page <= 1} onClick={() => goPage(1)}>« 처음</button>
      <button className="btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>‹ 이전</button>
      {from > 1 && <span className="pager-dots">…</span>}
      {nums.map(n => (
        <button key={n} className={'btn' + (n === page ? ' pager-cur' : '')} onClick={() => goPage(n)}>{n}</button>
      ))}
      {to < totalPages && <span className="pager-dots">…</span>}
      <button className="btn" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>다음 ›</button>
      <button className="btn" disabled={page >= totalPages} onClick={() => goPage(totalPages)}>끝 »</button>
    </div>
  );
}
