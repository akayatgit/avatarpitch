import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AvatarPitch',
  description: 'AI-powered video generation for your products',
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

