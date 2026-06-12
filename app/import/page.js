'use client';

import { useState } from 'react';

// 시트 A~V열 순서 그대로 매핑
const FIELDS = [
  'brand', 'pattern', 'pcode', 'size', 'pr', 'dot',
  'factory', 'qty', '_change_skip',
  'mount', 'direct', 'daily_del', 'ping_del', 'ping_dir',
  'store11', 'storefarm', 'lotte',
  'dc_rate', 'dc_price', 'tire_id', 'product_code', 'note',
];

export default function ImportPage() {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const parse = () => {
    const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '');
    const rows = [];
    for (const line of lines) {
      const cells = line.split('\t');
      // 헤더 행으로 보이면 스킵
      if (cells[0] && cells[0].includes('브랜드')) continue;
      const row = {};
      FIELDS.forEach((f, i) => { if (f !== '_change_skip') row[f] = cells[i] ?? ''; });
      if (!String(row.brand || '').trim() && !String(row.pattern || '').trim()) continue;
      rows.push(row);
    }
    return rows;
  };

  const run = async () => {
    const rows = parse();
    if (!rows.length) { setResult('인식된 행이 없습니다. 시트에서 A~V열 범위를 그대로 복사해 붙여넣어 주세요.'); return; }
    if (replace && !confirm(`기존 데이터를 모두 지우고 ${rows.length}행을 새로 입력합니다. 진행할까요?`)) return;
    setBusy(true);
    setResult('업로드 중…');
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, replace }),
      });
      const res = await r.json();
      setResult(res.ok ? `완료: ${res.inserted}행 입력됨. 메인 화면으로 돌아가 확인하세요.` : '실패: ' + res.msg);
    } catch (e) {
      setResult('실패: ' + e.message);
    }
    setBusy(false);
  };

  return (
    <div className="import-wrap">
      <h2>스프레드시트 → DB 데이터 이관</h2>
      <p>
        구글 시트 「2026 재고표」에서 <b>2행부터 A~V열 전체</b>를 선택해 복사(Ctrl+C)한 뒤,
        아래 칸에 붙여넣고(Ctrl+V) 「입력 실행」을 누르세요.<br />
        열 순서: 브랜드 / 패턴 / 코드 / 사이즈 / 피수 / DOT / 공장가 / 수량 / 변동(무시) / 장착 / 직배 / 택배 / 핑택 / 핑직 / 11번 / 스팜 / 롯데 / 할인율 / 할인가 / 타이어ID / 상품코드 / 메모
      </p>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="여기에 붙여넣기" />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <label className="chk-area">
          <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
          기존 데이터 전체 삭제 후 입력
        </label>
        <button className="btn" onClick={run} disabled={busy}>{busy ? '처리 중…' : '입력 실행'}</button>
        <a className="btn" href="/" style={{ textDecoration: 'none', color: '#2d3748' }}>← 재고표로</a>
      </div>
      {result && <p style={{ fontWeight: 'bold', color: result.startsWith('완료') ? '#276749' : '#c53030' }}>{result}</p>}
    </div>
  );
}
