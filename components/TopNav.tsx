'use client';

import Link from 'next/link';
import { useBanner } from '@/contexts/BannerContext';

export default function TopNav() {
  const { isBannerVisible } = useBanner();

  return (
    <nav className={`fixed left-0 right-0 z-50 bg-black border-b border-gray-800 transition-top duration-300 ${isBannerVisible ? 'top-[40px]' : 'top-0'}`}>
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/app" className="flex items-center gap-2 group">
            <div className="w-10 h-10 p-2 rounded-lg bg-transparent group-hover:bg-[#D1FE17]/20 transition-all duration-200">
              <img
                src="/hauloo.png"
                alt="Hauloo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-bold text-white hidden sm:inline font-switzer group-hover:text-[#D1FE17] transition-colors duration-200">
              Hauloo
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
