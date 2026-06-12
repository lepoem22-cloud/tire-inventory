'use client';

import { useEffect, useState } from 'react';

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
  const [status, setStatus] = useState('로딩…');

  const load = () => {
    setStatus('로딩…');
    fetch('/api/logs')
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.msg || '오류');
        setItems(res.items || []);
        setStatus('최근 ' + (res.items || []).length + '건');
      })
      .catch(e => setStatus('로딩 실패: ' + e.message));
  };
  useEffect(load, []);

  const k = kw.trim().toLowerCase();
  const filtered = k
    ? items.filter(it =>
        [it.user_id, it.brand, it.pattern, it.size, FIELD_KO[it.field] || it.field, it.value, it.ymd]
          .join(' ').toLowerCase().includes(k))
    : items;

  return (
    <>
      <div className="nav">
        <b style={{ fontSize: 14 }}>사용기록</b>
        <input placeholder="사용자/품목/날짜 검색" value={kw} onChange={e => setKw(e.target.value)} />
        <button className="btn" onClick={load}>새로고침</button>
        <a className="btn" href="/" style={{ textDecoration: 'none', color: '#2d3748' }}>← 재고표로</a>
        <div id="status" className="ok">{status}</div>
      </div>
      <div className="container">
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
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
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '30px 0', color: '#718096', fontWeight: 'bold' }}>기록이 없습니다</td></tr>
            )}
            {filtered.slice(0, 1000).map((it, i) => (
              <tr key={i}>
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
    </>
  );
}
