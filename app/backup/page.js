'use client';

import { useEffect, useState } from 'react';

export default function BackupPage() {
  const [items, setItems] = useState([]);
  const [day, setDay] = useState('');
  const [kw, setKw] = useState('');
  const [status, setStatus] = useState('로딩…');

  const load = () => {
    setStatus('로딩…');
    fetch('/api/backup-log')
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.msg || '오류');
        setItems(res.items || []);
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
        <a className="btn" href="/" style={{ textDecoration: 'none', color: '#2d3748' }}>← 재고표로</a>
        <div id="status" className="ok">{status}</div>
      </div>
      <div className="container">
        <table style={{ minWidth: 1500 }}>
          <thead>
            <tr>
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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={18} style={{ padding: '30px 0', color: '#718096', fontWeight: 'bold' }}>
                백업 기록이 없습니다 — 매일 저녁 8시 자동 백업 시 출고가 있던 품목이 여기에 쌓입니다
              </td></tr>
            )}
            {filtered.slice(0, 1000).map((it, i) => (
              <tr key={i}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
