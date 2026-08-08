'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, FolderOpen, Clapperboard } from 'lucide-react';
import { useBanner } from '@/contexts/BannerContext';

interface NavItem {
  name: string;
  href: string;
}

export default function TopNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isBannerVisible } = useBanner();

  const navigation: NavItem[] = [
    { name: 'Home', href: '/app' },
    { name: 'Studio', href: '/app/studio' },
    { name: 'Projects', href: '/app/projects' },
    { name: 'Content Types', href: '/app/templates' },
    { name: 'Agents', href: '/app/agents' },
  ];

  return (
    <>
      <nav className={`fixed left-0 right-0 z-50 bg-black border-b border-gray-800 transition-top duration-300 ${isBannerVisible ? 'top-[40px]' : 'top-0'}`}>
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
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

              <div className="hidden md:flex items-center gap-1">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-200 font-switzer tracking-wide ${
                        isActive
                          ? 'bg-gray-900 text-[#D1FE17]'
                          : 'text-gray-400 hover:text-[#D1FE17] hover:bg-gray-900'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/app/studio"
                className="flex items-center gap-2 px-4 py-2 bg-[#D1FE17] text-black rounded-lg text-sm font-bold hover:bg-[#B8E014] active:scale-95 transition-all duration-200 touch-manipulation"
              >
                <Clapperboard className="w-4 h-4" />
                <span>Studio</span>
              </Link>

              <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-black border border-gray-800 rounded-lg text-white text-sm font-medium hover:bg-gray-900 transition-colors">
                <FolderOpen className="w-4 h-4" />
                <span>Asset library</span>
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-white hover:bg-gray-900 transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <Menu className="w-5 h-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className={`md:hidden bg-black border-t border-gray-800 fixed left-0 right-0 z-50 ${isBannerVisible ? 'top-[104px]' : 'top-16'}`}>
              <div className="px-4 py-3 space-y-1">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-4 py-2 rounded-lg text-base font-medium transition-all duration-200 font-switzer tracking-wide ${
                        isActive
                          ? 'bg-gray-900 text-[#D1FE17]'
                          : 'text-gray-400 hover:text-[#D1FE17] hover:bg-gray-900'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>
    </>
  );
}
