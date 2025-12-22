import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hauloo',
  description: 'AI-powered video generation for your products',
  icons: {
    icon: '/hauloo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

