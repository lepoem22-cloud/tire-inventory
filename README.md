# 2026 타이어 통합 관리 (Vercel + 자체 DB)

기존 Google Apps Script 재고표를 Next.js + Postgres(Neon) 기반으로 옮긴 버전입니다.
스프레드시트 의존 없이 자체 DB에 저장되며, 화면 구성과 동작(검색·정렬·가상 스크롤·자동 저장·재시도·미저장 복구·판매등록 체크박스·매일 20시 백업/차감)은 기존과 동일합니다.

## 구조

| 경로 | 역할 |
|---|---|
| `app/page.js` | 메인 재고표 화면 |
| `app/import/page.js` | 시트 데이터 최초 이관 (붙여넣기) |
| `app/api/items` | 전체 조회 |
| `app/api/batch` | 셀 배치 저장 (할인율·할인가는 서버에서 수정 차단) |
| `app/api/reset` | 백업 + 재고 차감 + 출고열(J~Q) 초기화 — 매일 20:00 KST 크론 |
| `app/api/import` | 데이터 일괄 입력 |
| `lib/db.js` | Postgres 스키마 자동 생성 (`tires`, `backup_log`) |

## 배포 순서

1. **GitHub에 올리기**
   ```bash
   cd tire-inventory
   git init && git add . && git commit -m "init"
   # GitHub에서 새 저장소(비공개 권장) 만든 뒤
   git remote add origin https://github.com/<아이디>/<저장소>.git
   git push -u origin main
   ```

2. **Vercel 연결**
   - vercel.com → Add New → Project → 방금 만든 GitHub 저장소 Import
   - Framework는 Next.js로 자동 인식됨 → Deploy

3. **DB 붙이기 (Neon Postgres)**
   - Vercel 프로젝트 → **Storage** 탭 → **Create Database** → **Neon (Postgres)** 선택 → 프로젝트에 Connect
   - `POSTGRES_URL` 환경변수가 자동 주입됨 → **Redeploy** 한 번
   - 첫 API 호출 시 테이블이 자동 생성되므로 별도 SQL 실행 불필요

4. **환경변수 (선택, 권장)**
   - `CRON_SECRET`: 아무 긴 임의 문자열. 설정하면 `/api/reset`을 크론 외에는 호출 못 하게 보호됨 (Vercel이 크론 호출 시 자동으로 헤더에 넣어줌)

5. **데이터 이관**
   - 배포된 주소의 `/import` 페이지 접속
   - 구글 시트에서 2행부터 A~V열 전체 복사 → 붙여넣기 → 입력 실행

## 매일 백업/차감 (기존 `backupdateandreset` 대체)

- `vercel.json`의 크론이 매일 **11:00 UTC = 20:00 KST**에 `/api/reset` 호출
- 출고합계(J~Q) > 0인 행만 `backup_log`에 스냅샷 저장 후, `수량 = 수량 − 출고합계`(마이너스 허용)로 차감하고 출고열을 0으로 초기화
- 백업이 실패해도 차감은 진행 (기존 로직과 동일)
- 주의: Vercel 크론은 **프로덕션 배포**에서만 동작

## 기존과 달라진 점

- `onEdit`/`pending_sync`(시트 직접 편집 동기화)는 시트가 없어졌으므로 제거
- 행 번호 대신 DB의 `id`(고유키)로 저장하므로 정렬·삭제에도 안전
- 할인율(R)·할인가(S)는 화면 표시 전용이며 서버 화이트리스트에서 차단됨 — 값 변경은 DB에서 직접 하거나 필요 시 API 화이트리스트에 추가

## 로컬 개발

```bash
npm install
# .env.local 에 POSTGRES_URL="postgres://..." (Neon 대시보드에서 복사)
npm run dev
```
