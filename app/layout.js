import './globals.css';

export const metadata = {
  title: '2026 타이어 통합 관리',
  description: '타이어 재고 통합 관리',
};

export const viewport = {
  width: 'device-width',
  initialScale: 0.8,
  maximumScale: 2.0,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
