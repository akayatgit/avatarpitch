'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, FileText, Bot, Menu, X, LogOut, FolderOpen, ChevronDown, User } from 'lucide-react';
import { useBanner } from '@/contexts/BannerContext';

interface NavItem {
  name: string;
  href: string;
}

export default function TopNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { isBannerVisible } = useBanner();

  const navigation: NavItem[] = [
    { name: 'Home', href: '/app' },
    { name: 'Projects', href: '/app/projects' },
    { name: 'Content Types', href: '/app/templates' },
    { name: 'Agents', href: '/app/agents' },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className={`fixed left-0 right-0 z-50 bg-black border-b border-gray-800 transition-top duration-300 ${isBannerVisible ? 'top-[40px]' : 'top-0'}`}>
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Logo and Navigation */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link href="/app" className="flex items-center gap-2 group">
                <div className="w-10 h-10 p-2 rounded-lg bg-transparent group-hover:bg-[#D1FE17]/20 transition-all duration-200">
                  <img 
                    src="/hauloo.png" 
                    alt="Hauloo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-xl font-bold text-white hidden sm:inline font-switzer group-hover:text-[#D1FE17] transition-colors duration-200">Hauloo</span>
              </Link>

              {/* Desktop Navigation */}
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

            {/* Right side - User actions */}
            <div className="flex items-center gap-4">
              {/* Credits - Desktop */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg">
                <span className="text-xs text-gray-400">Credits:</span>
                <span className="text-sm font-semibold text-white">∞</span>
              </div>

              {/* Asset Library Button */}
              <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-black border border-gray-800 rounded-lg text-white text-sm font-medium hover:bg-gray-900 transition-colors">
                <FolderOpen className="w-4 h-4" />
                <span>Asset library</span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 bg-black border border-gray-800 rounded-lg text-white text-sm font-medium hover:bg-gray-900 transition-colors"
                >
                  <span>Personal</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-black border border-gray-800 rounded-lg shadow-xl z-50">
                      <div className="p-2">
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-gray-900 rounded-lg transition-colors">
                          <User className="w-4 h-4" />
                          <span>Profile</span>
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-gray-900 rounded-lg transition-colors">
                          <span>Settings</span>
                        </button>
                        <div className="border-t border-gray-800 my-1" />
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-gray-900 rounded-lg transition-colors">
                          <LogOut className="w-4 h-4" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Avatar */}
              <div className="w-8 h-8 bg-[#D1FE17] rounded-full flex items-center justify-center">
                <span className="text-black font-semibold text-xs">U</span>
              </div>

              {/* Mobile Menu Button */}
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

        {/* Mobile Menu */}
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
                <div className="border-t border-gray-800 my-2" />
                <div className="px-4 py-2">
                  <div className="bg-gray-900 rounded-xl p-4 font-switzer">
                    <p className="text-xs text-gray-400 mb-1">Current credits</p>
                    <p className="text-2xl font-bold text-white mb-3">∞</p>
                    <button className="w-full btn-primary text-sm py-2.5">
                      Buy credits
                    </button>
                  </div>
                  <button className="w-full btn-ghost text-sm py-2.5 flex items-center justify-center gap-2 mt-3 font-switzer">
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </nav>
    </>
  );
}

