'use client';

import { useBanner } from '@/contexts/BannerContext';

export default function BannerAwareMain({ children }: { children: React.ReactNode }) {
  const { isBannerVisible } = useBanner();
  return (
    <main className={`flex-1 min-h-screen transition-all duration-300 ${isBannerVisible ? 'pt-[104px]' : 'pt-16'}`}>
      {children}
    </main>
  );
}

