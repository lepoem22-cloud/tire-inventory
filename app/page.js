'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════
//  상수
// ═══════════════════════════════════════════════
const EDIT_GUARD_MS    = 30000;
const CRASH_KEY        = 'TIRE_CRASH_PENDING';
const INFLIGHT_TIMEOUT = 45000;
const RETRY_DELAY      = 3000;

const SALES_FIELDS = ['mount', 'direct', 'daily_del', 'ping_del', 'ping_dir', 'store11', 'storefarm', 'lotte'];
const JQ_BG = ['#d9d2e9', '#b7e1cd', '#b7e1cd', '#fff2cc', '#fff2cc', '#c9daf8', '#c9daf8', '#c9daf8'];

// 체크박스 5개 레이블 (note 컬럼에 "1,0,1,0,1" 형식 저장)
const CB_LABELS = ['스토어팜', '11번가', '번개장터', '장사나라', '중고나라'];

// 헤더 열 번호 → 수정 가능 필드 (붙여넣기 시 계산 열은 건너뛰되 칸 수는 유지)
const COL_FIELD = {
  0: 'brand', 1: 'pattern', 2: 'pcode', 3: 'size', 4: 'pr', 5: 'dot',
  6: 'factory', 7: 'qty',
  9: 'mount', 10: 'direct', 11: 'daily_del', 12: 'ping_del',
  13: 'ping_dir', 14: 'store11', 15: 'storefarm', 16: 'lotte',
  17: 'dc_rate', 18: 'dc_price',
};
const FIELD_COL = Object.fromEntries(Object.entries(COL_FIELD).map(([k, v]) => [v, +k]));
const TEXT_SET = new Set(['brand', 'pattern', 'pcode', 'size', 'pr', 'dot']);
// 선택/복사 가능한 열(헤더 인덱스) 목록 — 계산열 제외
const SELECTABLE_COLS = Object.keys(COL_FIELD).map(Number).sort((a, b) => a - b);
const ADMIN_ONLY_COLS = new Set([0, 1, 2, 3, 4, 5, 6, 7]); // A~H 전부 관리자 전용
// 방향키 좌우 이동 순서
const NAV_FIELDS = ['brand', 'pattern', 'pcode', 'size', 'pr', 'dot', 'factory', 'qty', 'mount', 'direct', 'daily_del', 'ping_del', 'ping_dir', 'store11', 'storefarm', 'lotte', 'dc_rate', 'dc_price', '_calc'];

const HDR = [
  { n: '브랜드', w: 78,  k: 'brand' },
  { n: '패턴', w: 104,  k: 'pattern' },
  { n: '코드', w: 62,   k: 'pcode' },
  { n: '사이즈', w: 128, k: 'size' },
  { n: '피수', w: 34,   k: 'pr' },
  { n: 'DOT', w: 70,    k: 'dot' },
  { n: '공장가(G)', w: 92, k: 'factory' },
  { n: '수량(H)', w: 60,  k: 'qty' },
  { n: '변동(I)', w: 62,  k: '_change', cls: 'bi' },
  { n: '장착(J)', w: 56,  k: 'mount',     bg: JQ_BG[0] },
  { n: '직배(K)', w: 52,  k: 'direct',    bg: JQ_BG[1] },
  { n: '택배(L)', w: 52,  k: 'daily_del', bg: JQ_BG[2] },
  { n: '핑택(M)', w: 52,  k: 'ping_del',  bg: JQ_BG[3] },
  { n: '핑직(N)', w: 52,  k: 'ping_dir',  bg: JQ_BG[4] },
  { n: '11번(O)', w: 52,  k: 'store11',   bg: JQ_BG[5] },
  { n: '스팜(P)', w: 52,  k: 'storefarm', bg: JQ_BG[6] },
  { n: '롯데(Q)', w: 56,  k: 'lotte',     bg: JQ_BG[7] },
  { n: '할인율(R)', w: 66, k: 'dc_rate',  cls: 'br' },
  { n: '할인 적용가(S)', w: 92, k: 'dc_price', cls: 'bs' },
  { n: '매일할인', w: 42,  k: null, cls: 'bt' },
  { n: '매일 원가', w: 98, k: null, cls: 'bu' },
  { n: '판매등록', w: 200, k: null, cls: 'bn' },
];

// ═══════════════════════════════════════════════
//  유틸
// ═══════════════════════════════════════════════
function toN(v) { const n = +v; return isFinite(n) ? n : 0; }
function krw(v) { const n = Math.floor(toN(v)); return n ? '₩' + n.toLocaleString() : ''; }
function pct(v) { if (v === '' || v == null) return ''; return toN(v) + '%'; }
function disc(g, t) { const n = Math.floor(toN(g) * (1 - toN(t) / 100)); return isFinite(n) ? n : ''; }
function normKey(s) { return String(s || '').toLowerCase().replace(/[\/r\s]/g, ''); }
function salesOf(d) { let s = 0; for (const f of SALES_FIELDS) s += toN(d[f]); return s; }

function encodeChecks(arr) { return arr.map(v => (v ? '1' : '0')).join(','); }
function decodeChecks(str) {
  if (!str || !String(str).trim()) return [false, false, false, false, false];
  return String(str).split(',').map(v => v.trim() === '1');
}

// ═══════════════════════════════════════════════
//  메인 컴포넌트
// ═══════════════════════════════════════════════
export default function Page() {
  // 화면 갱신용 state
  const [, force] = useState(0);
  const rerender = useCallback(() => force(x => x + 1), []);
  const [epoch, setEpoch] = useState(0); // 데이터 리로드 시 입력값 강제 갱신
  const [status, setStatus] = useState({ msg: '연결중…', cls: 'loading' });
  const [toasts, setToasts] = useState([]);
  // K·L 출고 메모 모달
  const [memoModal, setMemoModal] = useState(null); // {id, channel, label, items, text} | null

  // 필터 state
  const [brand, setBrand] = useState('');
  const [kw, setKw] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [onlySales, setOnlySales] = useState(false);
  const [sortInfo, setSortInfo] = useState({ idx: null, dir: true });
  const [viewStart, setViewStart] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myName, setMyName] = useState('');

  // 변하지 않는 참조들
  const DB         = useRef([]);
  const byId       = useRef(new Map());
  const calcMap    = useRef(new Map());
  const pending    = useRef(new Map());
  const isSending  = useRef(false);
  const mergeTimer = useRef(0);
  const timeoutId  = useRef(0);
  const activeEdit = useRef(null);
  const lastEdit   = useRef(0);
  const composing  = useRef(false);
  const containerRef = useRef(null);
  const rowH       = useRef(26);
  const viewRows   = useRef(60);
  const toastSeq   = useRef(0);
  const filterRef  = useRef({ brand: '', kw: '', showAll: false, onlySales: false });
  filterRef.current = { brand, kw, showAll, onlySales };
  const filteredRef = useRef([]);
  // ── 셀 범위 선택 상태 ──
  const [sel, setSel] = useState(null); // {aRow,aCol,bRow,bCol} (filtered 인덱스, 헤더열 인덱스)
  const selecting = useRef(false);
  const dragOrigin = useRef(null);
  const selRef = useRef(null);
  selRef.current = sel;

  // ── 토스트 ─────────────────────────────────
  const toast = useCallback((msg, type = 'save', ms = 1800) => {
    const id = ++toastSeq.current;
    setToasts(t => [...t, { id, msg, type, show: false }]);
    requestAnimationFrame(() =>
      setToasts(t => t.map(x => (x.id === id ? { ...x, show: true } : x)))
    );
    setTimeout(() => {
      setToasts(t => t.map(x => (x.id === id ? { ...x, show: false } : x)));
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 220);
    }, ms);
  }, []);

  // ── crashSave ──────────────────────────────
  const crashSave = useCallback((updates) => {
    try {
      if (!updates || !updates.length) { localStorage.removeItem(CRASH_KEY); return; }
      localStorage.setItem(CRASH_KEY, JSON.stringify({ ts: Date.now(), updates }));
    } catch (e) {}
  }, []);
  const crashClear = useCallback(() => { try { localStorage.removeItem(CRASH_KEY); } catch (e) {} }, []);
  const syncCrashSave = useCallback(() => {
    crashSave([...pending.current.values()].map(it => ({ id: it.id, field: it.field, value: it.value })));
  }, [crashSave]);

  // ── 전송 ───────────────────────────────────
  const sendBatch = useCallback(() => {
    if (pending.current.size === 0) { isSending.current = false; return; }
    isSending.current = true;
    const items = [...pending.current.values()];
    pending.current.clear();
    const updates = items.map(it => ({ id: it.id, field: it.field, value: it.value }));
    const cnt = updates.length;
    setStatus({ msg: cnt > 1 ? `저장중… (${cnt}건)` : '저장중…', cls: 'saving' });
    crashSave(updates);

    const fail = (errMsg, isTimeout) => {
      isSending.current = false;
      items.forEach(it => {
        const key = it.id + '_' + it.field;
        if (!pending.current.has(key)) pending.current.set(key, it);
        if (it.el && it.el.isConnected) { it.el.classList.remove('saved'); it.el.classList.add('dirty'); }
      });
      syncCrashSave();
      setStatus({ msg: isTimeout ? '시간초과 — 재시도 필요' : '저장실패 — 재시도 중', cls: 'err' });
      toast(isTimeout ? '저장 시간초과. 자동 재시도합니다.' : `저장 실패: ${errMsg} (자동 재시도)`, 'err', 3000);
      setTimeout(triggerSendRef.current, RETRY_DELAY);
    };

    clearTimeout(timeoutId.current);
    const ctrl = new AbortController();
    timeoutId.current = setTimeout(() => { ctrl.abort(); fail('', true); }, INFLIGHT_TIMEOUT);

    fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(res => {
        clearTimeout(timeoutId.current);
        if (!res.ok) return fail(res.msg || '오류', false);
        isSending.current = false;
        crashClear();
        if (typeof res.updated === 'number' && res.updated < updates.length) {
          setStatus({ msg: '일부 저장 안 됨', cls: 'err' });
          toast(`${updates.length - res.updated}건이 저장되지 않았습니다 — app/api/batch/route.js 파일이 최신 버전인지 확인하세요`, 'err', 5000);
        } else {
          setStatus({ msg: '저장됨', cls: 'ok' });
        }
        if (!filterRef.current.showAll && updates.some(u => u.field === 'qty')) rerender();
        if (pending.current.size > 0) sendBatch();
      })
      .catch(err => {
        if (ctrl.signal.aborted) return; // 타임아웃 처리 완료
        clearTimeout(timeoutId.current);
        fail((err && err.message) || '네트워크 오류', false);
      });
  }, [crashSave, crashClear, syncCrashSave, toast, rerender]);

  const triggerSend = useCallback(() => {
    clearTimeout(mergeTimer.current);
    if (pending.current.size === 0) return;
    if (isSending.current) return;
    sendBatch();
  }, [sendBatch]);
  const triggerSendRef = useRef(triggerSend);
  triggerSendRef.current = triggerSend;

  // ── crashRecover ───────────────────────────
  const crashRecover = useCallback(() => {
    try {
      const raw = localStorage.getItem(CRASH_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || !obj.updates || Date.now() - obj.ts > 86400000) { crashClear(); return; }
      const cnt = obj.updates.length;
      setStatus({ msg: `미저장 ${cnt}건 복구 중…`, cls: 'recover' });
      toast(`${cnt}개 미저장 셀 복구 중…`, 'recover', 3000);
      obj.updates.forEach(u => pending.current.set(u.id + '_' + u.field, { id: u.id, field: u.field, value: u.value, el: null }));
      crashClear();
      triggerSendRef.current();
    } catch (e) { crashClear(); }
  }, [crashClear, toast]);

  // ── 로드 ───────────────────────────────────
  const load = useCallback(() => {
    if (activeEdit.current || pending.current.size > 0 || isSending.current) return;
    if (Date.now() - lastEdit.current < EDIT_GUARD_MS) return;
    setStatus({ msg: '로딩…', cls: 'loading' });
    fetch('/api/items')
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.msg || '오류');
        if (res.me) { setIsAdmin(res.me.role === 'admin'); setMyName(res.me.id || ''); }
        if (activeEdit.current || Date.now() - lastEdit.current < EDIT_GUARD_MS) { setStatus({ msg: '준비', cls: 'ok' }); return; }
        DB.current = res.items || [];
        byId.current.clear();
        for (const d of DB.current) {
          d.brandLower = String(d.brand || '').toLowerCase();
          d.key = normKey(d.pcode + d.pattern + d.dot) + normKey(d.size);
          byId.current.set(d.id, d);
          if (!calcMap.current.has(d.id)) calcMap.current.set(d.id, { t: '', u: toN(d.factory) });
        }
        try { sessionStorage.setItem('TIRE_CACHE', JSON.stringify(res.items || [])); } catch (e) {}
        setEpoch(e => e + 1);
        setStatus({ msg: '준비', cls: 'ok' });
        crashRecover();
        measureRowH();
      })
      .catch(err => {
        setStatus({ msg: '로딩실패', cls: 'err' });
        toast('로딩 실패: ' + ((err && err.message) || '오류'), 'err', 3000);
      });
  }, [crashRecover, toast]);

  const measureRowH = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    viewRows.current = Math.ceil(c.getBoundingClientRect().height / rowH.current) + 10;
  }, []);

  // ── 마운트 ─────────────────────────────────
  useEffect(() => {
    // 캐시가 있으면 먼저 즉시 그려서 체감 속도 향상 (서버 응답 오면 갱신됨)
    try {
      const cached = sessionStorage.getItem('TIRE_CACHE');
      if (cached) {
        const items = JSON.parse(cached);
        if (Array.isArray(items) && items.length) {
          DB.current = items;
          byId.current.clear();
          for (const d of DB.current) {
            d.brandLower = String(d.brand || '').toLowerCase();
            d.key = normKey(d.pcode + d.pattern + d.dot) + normKey(d.size);
            byId.current.set(d.id, d);
            if (!calcMap.current.has(d.id)) calcMap.current.set(d.id, { t: '', u: toN(d.factory) });
          }
          setEpoch(e => e + 1);
        }
      }
    } catch (e) {}
    load(); // me 정보도 이 응답에 포함됨
    measureRowH();

    // 매일 8시 자동 새로고침
    let t8;
    const schedule8am = () => {
      const now = new Date(), next = new Date(now);
      next.setHours(8, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      t8 = setTimeout(() => { load(); schedule8am(); }, next - now);
    };
    schedule8am();

    // 5분 유휴 시 자동 리로드
    const iv = setInterval(() => {
      if (!activeEdit.current && pending.current.size === 0 && !isSending.current && Date.now() - lastEdit.current > EDIT_GUARD_MS) load();
    }, 300000);

    const onVis = () => {
      if (document.visibilityState === 'hidden' && pending.current.size > 0) {
        syncCrashSave(); triggerSendRef.current();
      }
    };
    const flushBeacon = () => {
      const all = [...pending.current.values()];
      if (!all.length) return;
      const updates = all.map(it => ({ id: it.id, field: it.field, value: it.value }));
      try {
        fetch('/api/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }), keepalive: true,
        });
        crashClear();
      } catch (ex) { syncCrashSave(); }
    };
    const onPageHide = () => { if (pending.current.size > 0) flushBeacon(); else syncCrashSave(); };
    const onBeforeUnload = (e) => {
      if (pending.current.size > 0) {
        flushBeacon(); syncCrashSave();
        if (isSending.current) { e.preventDefault(); e.returnValue = '저장 중인 데이터가 있습니다.'; }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearTimeout(t8); clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 스크롤 (가상 스크롤) ────────────────────
  const rafPending = useRef(false);
  const onScroll = useCallback(() => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      if (pending.current.size > 0) triggerSendRef.current();
      const c = containerRef.current;
      if (!c) return;
      const ns = Math.floor(c.scrollTop / rowH.current);
      setViewStart(v => (ns !== v ? ns : v));
    });
  }, []);

  // ── 셀 입력 ────────────────────────────────
  const registerInput = useCallback((el, id, field) => {
    pending.current.set(id + '_' + field, { id, field, value: el.value, el });
    syncCrashSave();
  }, [syncCrashSave]);

  const queueSend = useCallback(() => {
    clearTimeout(mergeTimer.current);
    mergeTimer.current = setTimeout(triggerSendRef.current, 16);
  }, []);

  const onCellInput = useCallback((e, id, field) => {
    const el = e.target;
    lastEdit.current = Date.now();

    // 매일할인(로컬 계산 전용)
    if (field === '_calc') {
      const d = byId.current.get(id); if (!d) return;
      const t = el.value;
      const u = t.trim() === '' ? toN(d.factory) : disc(d.factory, t);
      calcMap.current.set(id, { t, u });
      const uel = document.getElementById('u-' + id);
      if (uel) uel.textContent = krw(u);
      return;
    }

    const d = byId.current.get(id);
    if (d) {
      d[field] = el.value;
      if (field === 'qty' || SALES_FIELDS.includes(field)) {
        const s = salesOf(d);
        const iel = document.getElementById('i-' + id);
        if (iel) iel.textContent = toN(d.qty) ? (toN(d.qty) - s) : '';
      }
      if (field === 'factory') {
        const calc = calcMap.current.get(id) || { t: '', u: 0 };
        const u = String(calc.t).trim() === '' ? toN(el.value) : disc(el.value, calc.t);
        calcMap.current.set(id, { t: calc.t, u });
        const uel = document.getElementById('u-' + id);
        if (uel) uel.textContent = krw(u);
      }
    }

    el.classList.remove('dirty', 'saved');
    clearTimeout(el._savedTimer);
    el._savedTimer = setTimeout(() => el.classList.add('saved'), 0);

    if (composing.current) return;
    registerInput(el, id, field);
    queueSend();
  }, [registerInput, queueSend]);

  const onCompositionEnd = useCallback((e) => {
    composing.current = false;
    const el = e.target;
    if (!el || !el.classList.contains('edit')) return;
    const { id, f } = el.dataset;
    if (!id || !f || f === '_calc') return;
    el.classList.remove('dirty', 'saved');
    clearTimeout(el._savedTimer);
    el._savedTimer = setTimeout(() => el.classList.add('saved'), 0);
    registerInput(el, +id, f);
    queueSend();
  }, [registerInput, queueSend]);

  const onKeyDown = useCallback((e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('edit')) return;
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return; }

    // ── 방향키 셀 이동 (시트처럼) ──
    if (!e.key.startsWith('Arrow')) return;
    const f = el.dataset.f, id = +el.dataset.id;
    const focusCell = (tid, tf) => {
      const sel = `input.edit[data-id="${tid}"][data-f="${tf}"]`;
      const t = document.querySelector(sel);
      if (t) { t.focus(); t.select && t.select(); return true; }
      return false;
    };

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // 텍스트 중간에서는 커서 이동, 끝/처음에서만 셀 이동
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
      const selAll = el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;
      const ni = NAV_FIELDS.indexOf(f) + (e.key === 'ArrowRight' ? 1 : -1);
      if (ni < 0 || ni >= NAV_FIELDS.length) return;
      if (e.key === 'ArrowLeft' && !(atStart || selAll)) return;
      if (e.key === 'ArrowRight' && !(atEnd || selAll)) return;
      e.preventDefault();
      focusCell(id, NAV_FIELDS[ni]);
      return;
    }

    // 위/아래
    e.preventDefault();
    const list = filteredRef.current;
    const i = list.findIndex(d => d.id === id);
    if (i < 0) return;
    const ti = i + (e.key === 'ArrowDown' ? 1 : -1);
    if (ti < 0 || ti >= list.length) return;
    const tid = list[ti].id;
    if (!focusCell(tid, f)) {
      // 가상 스크롤 범위 밖이면 스크롤 후 재시도
      const c = containerRef.current;
      if (c) c.scrollTop += (e.key === 'ArrowDown' ? 1 : -1) * rowH.current * 6;
      requestAnimationFrame(() => requestAnimationFrame(() => focusCell(tid, f)));
    }
  }, []);

  // ── 블록 붙여넣기 (시트에서 복사한 여러 셀) ──
  // 비관리자가 수정할 수 없는 A~H 필드 (붙여넣기에서 건너뜀)
  const ADMIN_ONLY = new Set(['brand', 'pattern', 'pcode', 'size', 'pr', 'dot', 'factory', 'qty']);

  const onPaste = useCallback((e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('edit')) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    // 탭/줄바꿈 없으면 단일 값 → 기본 붙여넣기 동작 유지
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    e.preventDefault();

    const f0 = el.dataset.f;
    const id0 = +el.dataset.id;
    const startCol = FIELD_COL[f0];
    if (startCol == null) { toast('이 칸에는 블록 붙여넣기를 할 수 없습니다', 'warn'); return; }
    // 붙여넣기 시작 시점의 화면 순서를 즉시 고정(스냅샷)하고, 이후엔 각 행의 고유 id로만 저장.
    // → 도중에 다른 사람이 입력하거나 필터/정렬이 바뀌어도 항상 같은 행에 안전하게 기록됨.
    const list = filteredRef.current.slice();
    const rIdx = list.findIndex(d => d.id === id0);
    if (rIdx < 0) return;

    const lines = text.replace(/\r/g, '').split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();

    let applied = 0, skippedAdmin = 0;
    lines.forEach((line, i) => {
      const d = list[rIdx + i];
      if (!d) return;
      line.split('\t').forEach((val, j) => {
        const fld = COL_FIELD[startCol + j];
        if (!fld) return; // 계산 열은 칸 수만 차지하고 건너뜀
        if (!isAdmin && ADMIN_ONLY.has(fld)) { skippedAdmin++; return; } // 권한 없는 열 건너뜀
        const v = TEXT_SET.has(fld) ? String(val).trim() : String(val).replace(/[^0-9.-]/g, '');
        d[fld] = v;
        pending.current.set(d.id + '_' + fld, { id: d.id, field: fld, value: v, el: null });
        applied++;
      });
    });

    if (!applied) {
      toast(skippedAdmin ? '관리자만 수정할 수 있는 열입니다' : '붙여넣을 수 있는 칸이 없습니다', 'warn');
      return;
    }
    lastEdit.current = Date.now();
    syncCrashSave();
    setEpoch(x => x + 1); // 화면 입력칸 값 갱신
    queueSend();
    toast(`${applied}개 셀 붙여넣음${skippedAdmin ? ` (권한 없는 ${skippedAdmin}칸 제외)` : ''} — 저장 중`, 'save', 2200);
  }, [syncCrashSave, queueSend, toast, isAdmin]);

  const onKeyUp = useCallback((e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('edit')) return;
    const { id, f } = el.dataset;
    if (e.key === 'Enter') {
      if (f !== '_calc') { registerInput(el, +id, f); triggerSendRef.current(); }
      const all = Array.from(document.querySelectorAll(`input.edit[data-f="${f}"]`));
      const idx = all.indexOf(el);
      if (idx >= 0 && idx + 1 < all.length) all[idx + 1].focus();
    }
    if (e.key === 'Tab') {
      if (f !== '_calc') { registerInput(el, +id, f); triggerSendRef.current(); }
      const all = Array.from(document.querySelectorAll('input.edit'));
      const idx = all.indexOf(el);
      if (idx >= 0 && idx + 1 < all.length) all[idx + 1].focus();
    }
  }, [registerInput]);

  const onFocusIn = useCallback((e) => {
    const el = e.target;
    if (el.classList && el.classList.contains('edit')) activeEdit.current = { id: el.dataset.id, f: el.dataset.f };
  }, []);
  const onFocusOut = useCallback((e) => {
    const el = e.target;
    if (el.classList && el.classList.contains('edit')) {
      activeEdit.current = null;
      if (pending.current.size > 0) triggerSendRef.current();
    }
  }, []);

  // ── 체크박스 ───────────────────────────────
  const onCheck = useCallback((id, idx, checked) => {
    const d = byId.current.get(id);
    if (!d) return;
    const checks = decodeChecks(d.note);
    checks[idx] = checked;
    d.note = encodeChecks(checks);
    pending.current.set(id + '_note', { id, field: 'note', value: d.note, el: null });
    syncCrashSave();
    queueSend();
    lastEdit.current = Date.now();
  }, [syncCrashSave, queueSend]);

  // ── 행 추가 (인라인 입력, prompt 미사용) ──────
  const [addOpen, setAddOpen] = useState(false);
  const [addCount, setAddCount] = useState('10');
  const addRows = useCallback(async () => {
    const count = Math.trunc(Number(addCount) || 0);
    if (count < 1) { toast('추가할 행 수를 입력하세요', 'warn'); return; }
    setAddOpen(false);
    setStatus({ msg: '행 추가 중…', cls: 'saving' });
    try {
      const r = await fetch('/api/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const res = await r.json();
      if (!res.ok) throw new Error(res.msg || '오류');
      for (const d of res.items) {
        d.brandLower = '';
        d.key = '';
        DB.current.push(d);
        byId.current.set(d.id, d);
        calcMap.current.set(d.id, { t: '', u: 0 });
      }
      setShowAll(true); // 새 행은 수량 0이라 품절포함 켜야 보임
      setEpoch(e => e + 1);
      setStatus({ msg: '준비', cls: 'ok' });
      toast(`${res.items.length}행 추가됨 — 「품절포함」 상태로 표시 중`, 'save', 2500);
    } catch (e) {
      setStatus({ msg: '행 추가 실패', cls: 'err' });
      toast('행 추가 실패: ' + e.message, 'err', 3000);
    }
  }, [addCount, toast]);

  // ── 셀 범위 선택 ────────────────────────────
  const selNorm = useCallback((sv) => {
    if (!sv) return null;
    return {
      r0: Math.min(sv.aRow, sv.bRow), r1: Math.max(sv.aRow, sv.bRow),
      c0: Math.min(sv.aCol, sv.bCol), c1: Math.max(sv.aCol, sv.bCol),
    };
  }, []);
  const inSel = useCallback((rowIdx, colIdx) => {
    const n = selNorm(selRef.current);
    if (!n) return false;
    return rowIdx >= n.r0 && rowIdx <= n.r1 && colIdx >= n.c0 && colIdx <= n.c1;
  }, [selNorm]);

  const onCellMouseDown = useCallback((e, rowIdx, colIdx) => {
    const isInput = e.target.tagName === 'INPUT';
    // Shift+클릭: 기존 선택에서 범위 확장
    if (e.shiftKey && selRef.current) {
      e.preventDefault();
      setSel(s => ({ ...s, bRow: rowIdx, bCol: colIdx }));
      return;
    }
    // 어느 칸이든 일단 시작점 기록하고 드래그 감지 대기.
    // 입력칸이면 편집도 허용하되, 다른 칸으로 드래그가 시작되면 영역 선택으로 전환.
    setSel({ aRow: rowIdx, aCol: colIdx, bRow: rowIdx, bCol: colIdx });
    selecting.current = true;
    dragOrigin.current = { rowIdx, colIdx, isInput };
    // 입력칸이 아니면 텍스트 선택 방지
    if (!isInput) e.preventDefault();
  }, []);

  const onCellMouseEnter = useCallback((rowIdx, colIdx) => {
    if (!selecting.current) return;
    const o = dragOrigin.current;
    // 다른 칸으로 넘어온 순간 = 진짜 드래그 → 영역 선택. 입력 포커스 해제.
    if (o && (o.rowIdx !== rowIdx || o.colIdx !== colIdx)) {
      if (o.isInput && document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
      o.isInput = false; // 이후로는 선택 모드 유지
    }
    setSel(s => (s ? { ...s, bRow: rowIdx, bCol: colIdx } : s));
  }, []);

  useEffect(() => {
    const up = () => { selecting.current = false; dragOrigin.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // 필터/정렬이 바뀌면 행 순서가 달라지므로 선택 해제 (잘못된 영역 조작 방지)
  useEffect(() => { setSel(null); }, [brand, kw, showAll, onlySales, sortInfo.idx, sortInfo.dir]);

  // 선택 영역 복사 (Ctrl+C) / 삭제 (Delete)
  const copySelection = useCallback(() => {
    const n = selNorm(selRef.current);
    if (!n) return false;
    const list = filteredRef.current;
    const cols = SELECTABLE_COLS.filter(c => c >= n.c0 && c <= n.c1);
    if (!cols.length) return false;
    const lines = [];
    for (let r = n.r0; r <= n.r1; r++) {
      const d = list[r];
      if (!d) continue;
      const cells = cols.map(c => {
        const f = COL_FIELD[c];
        let v = d[f];
        if (f === 'factory' || f === 'qty' || SALES_FIELDS.includes(f) || f === 'dc_price' || f === 'dc_rate')
          v = toN(v) || '';
        return v == null ? '' : String(v);
      });
      lines.push(cells.join('\t'));
    }
    const tsv = lines.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv);
      else {
        const ta = document.createElement('textarea');
        ta.value = tsv; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      toast(`${lines.length}행 복사됨`, 'save', 1400);
    } catch (e) { toast('복사 실패', 'err'); }
    return true;
  }, [selNorm, toast]);

  const deleteSelection = useCallback(() => {
    const n = selNorm(selRef.current);
    if (!n) return false;
    const list = filteredRef.current;
    const cols = SELECTABLE_COLS.filter(c => c >= n.c0 && c <= n.c1);
    let cleared = 0, denied = 0;
    for (let r = n.r0; r <= n.r1; r++) {
      const d = list[r];
      if (!d) continue;
      for (const c of cols) {
        if (!isAdmin && ADMIN_ONLY_COLS.has(c)) { denied++; continue; }
        const f = COL_FIELD[c];
        d[f] = '';
        pending.current.set(d.id + '_' + f, { id: d.id, field: f, value: '', el: null });
        cleared++;
      }
    }
    if (!cleared) { toast(denied ? '관리자만 지울 수 있는 열입니다' : '지울 칸이 없습니다', 'warn'); return true; }
    lastEdit.current = Date.now();
    syncCrashSave();
    setEpoch(x => x + 1);
    queueSend();
    toast(`${cleared}칸 비움 — 저장 중`, 'save', 1600);
    return true;
  }, [selNorm, isAdmin, syncCrashSave, queueSend, toast]);

  // 표 전역 키 처리 (선택 영역 복사/삭제)
  useEffect(() => {
    const onKey = (e) => {
      const n = selNorm(selRef.current);
      if (!n) return;
      const multi = n.r0 !== n.r1 || n.c0 !== n.c1;
      const el = document.activeElement;
      const editing = el && el.tagName === 'INPUT' && el.classList.contains('edit');
      // 복사: 다중 선택이면 입력칸 포커스 중이라도 영역 복사
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (multi) { e.preventDefault(); copySelection(); }
        return;
      }
      // 삭제: 입력 편집 중이 아니거나 다중 선택일 때
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (multi || !editing) { e.preventDefault(); deleteSelection(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selNorm, copySelection, deleteSelection]);

  // ── K·L 출고 메모 ──────────────────────────
  const MEMO_LABEL = { direct: '직배(K)', daily_del: '택배(L)' };
  const openMemo = useCallback((e, id, channel) => {
    e.preventDefault();
    setMemoModal({ id, channel, label: MEMO_LABEL[channel] || channel, items: null, text: '' });
    fetch('/api/memo?id=' + id)
      .then(r => r.json())
      .then(res => setMemoModal(m => (m && m.id === id && m.channel === channel ? { ...m, items: res.ok ? res.items : [] } : m)))
      .catch(() => setMemoModal(m => (m ? { ...m, items: [] } : m)));
  }, []);
  const saveMemo = useCallback(() => {
    setMemoModal(m => {
      if (!m) return m;
      const text = (m.text || '').trim();
      if (!text) { toast('메모 내용을 입력하세요', 'warn'); return m; }
      fetch('/api/memo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, channel: m.channel, memo: text }),
      })
        .then(r => r.json())
        .then(res => {
          if (!res.ok) { toast('메모 저장 실패: ' + (res.msg || ''), 'err'); return; }
          const d = byId.current.get(m.id);
          if (d) {
            d.memoCount = { ...(d.memoCount || {}) };
            d.memoCount[m.channel] = (res.items || []).filter(x => x.channel === m.channel).length;
            setEpoch(x => x + 1);
          }
          setMemoModal(cur => (cur && cur.id === m.id ? { ...cur, items: res.items || [], text: '' } : cur));
          toast('메모 저장됨', 'save', 1500);
        })
        .catch(err => toast('메모 저장 실패: ' + (err.message || ''), 'err'));
      return { ...m, text };
    });
  }, [toast]);

  // ── 정렬 ───────────────────────────────────
  const doSort = useCallback((i) => {
    const k = HDR[i] && HDR[i].k;
    if (!k) return;
    setSortInfo(s => ({ idx: i, dir: s.idx === i ? !s.dir : true }));
  }, []);

  // ── 필터 + 정렬 + 가상화 계산 ───────────────
  const b = brand.toLowerCase(), k = normKey(kw);
  let filtered = [];
  for (const d of DB.current) {
    const s = salesOf(d);
    if (!showAll && toN(d.qty) <= 0) continue;
    if (onlySales && s <= 0) continue;
    if (b && d.brandLower !== b) continue;
    if (k && !d.key.includes(k)) continue;
    filtered.push(d);
  }
  if (sortInfo.idx !== null) {
    const key = HDR[sortInfo.idx].k;
    const get = key === '_change' ? (d) => toN(d.qty) - salesOf(d) : (d) => d[key];
    filtered = [...filtered].sort((a, c) => {
      const v1 = get(a), v2 = get(c);
      if (v1 === v2) return 0;
      return sortInfo.dir ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });
  }

  const brandSet = new Set();
  for (const d of DB.current) if (d.brand) brandSet.add(d.brand);
  const brands = [...brandSet].sort();
  filteredRef.current = filtered;

  const total = filtered.length;
  const OVERSCAN = 15; // 빠른 휠 스크롤 대비 위아래 여유 행
  const anchor = Math.max(0, Math.min(viewStart, Math.max(0, total - 1)));
  const start = Math.max(0, anchor - OVERSCAN);
  const end = Math.min(total, anchor + viewRows.current + OVERSCAN);
  const visible = filtered.slice(start, end);

  // ═════════════════════════════════════════
  //  렌더
  // ═════════════════════════════════════════
  return (
    <>
      <div className="nav">
        <span className="user-badge" title={isAdmin ? '관리자' : '직원'}>
          {isAdmin ? '👑 ' : '👤 '}{myName || '…'}
        </span>
        {(() => {
          const n = selNorm(sel);
          if (!n) return null;
          const rows = n.r1 - n.r0 + 1, cols = n.c1 - n.c0 + 1;
          if (rows * cols <= 1) return null;
          const cnt = SELECTABLE_COLS.filter(c => c >= n.c0 && c <= n.c1).length * rows;
          return <span className="sel-badge">선택 {rows}×{cols} · Delete로 {cnt}칸 삭제</span>;
        })()}
        <select value={brand} onChange={e => { setBrand(e.target.value); setViewStart(0); if (containerRef.current) containerRef.current.scrollTop = 0; }}>
          <option value="">전체 브랜드</option>
          {brands.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <input
          placeholder="코드/패턴/사이즈/DOT 검색"
          value={kw}
          onChange={e => { setKw(e.target.value); setViewStart(0); if (containerRef.current) containerRef.current.scrollTop = 0; }}
        />
        <label className="chk-area">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> 품절포함
        </label>
        <label className="chk-area chk-sales">
          <input type="checkbox" checked={onlySales} onChange={e => setOnlySales(e.target.checked)} /> 출고만
        </label>
        <button className="btn" onClick={() => setSortInfo({ idx: null, dir: true })}>정렬초기화</button>
        <button className="btn" title="다른 사람이 입력한 최신 내용 불러오기"
          onClick={() => { lastEdit.current = 0; activeEdit.current = null; load(); }}>↻ 새로고침</button>
        <button className="btn" style={{ background: '#ebf8ff', borderColor: '#90cdf4', fontWeight: 'bold' }} onClick={() => setAddOpen(o => !o)}>＋ 행 추가</button>
        {addOpen && (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input type="number" min="1" max="500" value={addCount}
              onChange={e => setAddCount(e.target.value)}
              onKeyUp={e => { if (e.key === 'Enter') addRows(); }}
              style={{ width: 52 }} autoFocus />
            <button className="btn" style={{ background: '#c6f6d5', borderColor: '#9ae6b4', fontWeight: 'bold' }} onClick={addRows}>확인</button>
            <button className="btn" onClick={() => setAddOpen(false)}>취소</button>
          </span>
        )}
        <div className="mobile-hint">좌우 스크롤로 전체 열 확인</div>
        <div id="status" className={status.cls}>{status.msg}</div>
      </div>

      <div className="container" ref={containerRef} onScroll={onScroll}>
        <table>
          <thead>
            <tr>
              {HDR.map((h, i) => (
                <th key={h.n} style={{ width: h.w, ...(h.bg ? { background: h.bg } : {}) }}
                    className={h.cls || ''} onClick={() => doSort(i)}>
                  {h.n}{sortInfo.idx === i ? (sortInfo.dir ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onPaste={onPaste}
            onFocus={onFocusIn}
            onBlur={onFocusOut}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={onCompositionEnd}
          >
            {start > 0 && (
              <tr style={{ height: start * rowH.current }}><td colSpan={HDR.length}></td></tr>
            )}
            {total === 0 && (
              <tr>
                <td colSpan={HDR.length} style={{ padding: '30px 0', color: '#718096', fontWeight: 'bold' }}>
                  표시할 데이터가 없습니다 — 위의 「＋ 행 추가」로 빈 행을 만들거나 「품절포함」을 체크하세요
                </td>
              </tr>
            )}
            {visible.map((d, vi) => {
              const id = d.id;
              const rowIdx = start + vi; // filtered 배열 기준 절대 행 인덱스
              const s = salesOf(d);
              const inv = toN(d.qty) - s;
              const calc = calcMap.current.get(id) || { t: '', u: toN(d.factory) };
              const checks = decodeChecks(d.note);
              const ek = (f) => `${id}:${f}:${epoch}`;
              const tdCls = (colIdx, base) => (base || '') + (inSel(rowIdx, colIdx) ? ' cell-sel' : '');
              const tdProps = (colIdx) => ({
                onMouseDown: (e) => onCellMouseDown(e, rowIdx, colIdx),
                onMouseEnter: () => onCellMouseEnter(rowIdx, colIdx),
              });
              return (
                <tr key={id}>
                  {['brand', 'pattern', 'pcode', 'size', 'pr'].map((f, ci) => (
                    <td key={f} className={tdCls(ci)} {...tdProps(ci)}>
                      {isAdmin
                        ? <input key={ek(f)} className="edit" data-id={id} data-f={f}
                            defaultValue={d[f]} onInput={e => onCellInput(e, id, f)} />
                        : <span className="ro-txt">{d[f]}</span>}
                    </td>
                  ))}
                  <td className={tdCls(5)} {...tdProps(5)}>
                    {isAdmin
                      ? <input key={ek('dot')} className="edit" data-id={id} data-f="dot"
                          defaultValue={d.dot} onInput={e => onCellInput(e, id, 'dot')} />
                      : <span className="ro-txt">{d.dot}</span>}
                  </td>
                  <td className={tdCls(6)} {...tdProps(6)}>
                    {isAdmin
                      ? <input key={ek('factory')} className="edit" data-id={id} data-f="factory"
                          defaultValue={toN(d.factory) || ''} onInput={e => onCellInput(e, id, 'factory')} />
                      : <span className="ro-txt">{toN(d.factory) ? '₩'+toN(d.factory).toLocaleString() : ''}</span>}
                  </td>
                  <td className={tdCls(7)} {...tdProps(7)}>
                    {isAdmin
                      ? <input key={ek('qty')} className="edit" data-id={id} data-f="qty"
                          defaultValue={toN(d.qty) || ''} onInput={e => onCellInput(e, id, 'qty')} />
                      : <span className="ro-txt">{toN(d.qty) || ''}</span>}
                  </td>
                  <td className="bi" id={'i-' + id}>{toN(d.qty) ? inv : ''}</td>
                  {SALES_FIELDS.map((f, fi) => {
                    const memoable = (f === 'direct' || f === 'daily_del');
                    const mc = memoable && d.memoCount ? (d.memoCount[f] || 0) : 0;
                    return (
                      <td key={f} className={tdCls(9 + fi) + (memoable ? ' memo-cell' : '')}
                        style={{ background: JQ_BG[fi] }} {...tdProps(9 + fi)}
                        onContextMenu={memoable ? (e) => openMemo(e, id, f) : undefined}
                        title={memoable ? '우클릭으로 출고 메모' : undefined}>
                        <input key={ek(f)} className="edit" data-id={id} data-f={f}
                          defaultValue={toN(d[f]) || ''} onInput={e => onCellInput(e, id, f)} />
                        {mc > 0 && <span className="memo-dot" title={mc + '개 메모'}>{mc}</span>}
                      </td>
                    );
                  })}
                  <td className={tdCls(17, 'br')} {...tdProps(17)}>
                    <input key={ek('dc_rate')} className="edit" data-id={id} data-f="dc_rate"
                      defaultValue={toN(d.dc_rate) || ''} onInput={e => onCellInput(e, id, 'dc_rate')} />
                  </td>
                  <td className={tdCls(18, 'bs')} {...tdProps(18)}>
                    <input key={ek('dc_price')} className="edit" data-id={id} data-f="dc_price"
                      defaultValue={toN(d.dc_price) || ''} onInput={e => onCellInput(e, id, 'dc_price')} />
                  </td>
                  <td className="bt">
                    <div className="tbox">
                      <input key={ek('_calc')} className="edit" data-id={id} data-f="_calc"
                        defaultValue={calc.t} onInput={e => onCellInput(e, id, '_calc')} />
                    </div>
                  </td>
                  <td className="bu" id={'u-' + id}>{krw(calc.u)}</td>
                  <td className="cb-cell">
                    <div className="cb-wrap">
                      {CB_LABELS.map((label, ci) => (
                        <label key={label} className="cb-item">
                          <input type="checkbox" checked={!!checks[ci]}
                            onChange={e => { onCheck(id, ci, e.target.checked); rerender(); }} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {end < total && (
              <tr style={{ height: (total - end) * rowH.current }}><td colSpan={HDR.length}></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div id="toast-rack">
        {toasts.map(t => (
          <div key={t.id} className={`toast t-${t.type}${t.show ? ' show' : ''}`}>{t.msg}</div>
        ))}
      </div>

      {memoModal && (() => {
        const d = byId.current.get(memoModal.id) || {};
        const list = (memoModal.items || []).filter(x => x.channel === memoModal.channel);
        return (
          <div className="memo-backdrop" onClick={() => setMemoModal(null)}>
            <div className="memo-box" onClick={e => e.stopPropagation()}>
              <div className="memo-head">
                <b>{memoModal.label} 출고 메모</b>
                <span className="memo-sub">{d.brand} {d.pattern} {d.size}</span>
                <button className="memo-x" onClick={() => setMemoModal(null)}>✕</button>
              </div>
              <div className="memo-list">
                {memoModal.items === null && <div className="memo-empty">불러오는 중…</div>}
                {memoModal.items !== null && list.length === 0 && <div className="memo-empty">아직 메모가 없습니다</div>}
                {list.map(it => (
                  <div className="memo-item" key={it.id}>
                    <div className="memo-meta">{it.at} · {it.user_id}</div>
                    <div className="memo-text">{it.memo}</div>
                  </div>
                ))}
              </div>
              <div className="memo-input">
                <textarea placeholder="예: 스토어팜 4개 / 직거래 4개" value={memoModal.text}
                  onChange={e => setMemoModal(m => (m ? { ...m, text: e.target.value } : m))}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveMemo(); }} autoFocus />
                <button className="btn memo-save" onClick={saveMemo}>메모 추가 (Ctrl+Enter)</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
