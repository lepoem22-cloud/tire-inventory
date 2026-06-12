import './globals.css';

export const metadata = { title: '2026 타이어 통합 관리' };
export const viewport = { width: 'device-width', initialScale: 0.8, maximumScale: 2.0 };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="sb-zone">
          <div className="sb-tab">☰</div>
          <nav className="sb-panel">
            <div className="sb-title">메뉴</div>
            <a href="/">재고표</a>
            <a href="/backup">재고 백업로그</a>
            <a href="/logs">사용기록</a>
            <div style={{ borderTop: '1px solid #4a5568', margin: '12px 0' }} />
            <a href="/logout" style={{ color: '#fc8181' }}>🔓 로그아웃</a>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}
