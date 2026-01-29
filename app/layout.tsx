import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Agentic Book Writer',
  description: 'Pipeline-driven book drafting with validators.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
