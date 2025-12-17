'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, FileText, Bot, Menu, X, LogOut } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navigation: NavItem[] = [
    { name: 'Home', href: '/app', icon: <Home className="w-5 h-5" /> },
    { name: 'Templates', href: '/app/templates', icon: <FileText className="w-5 h-5" /> },
    { name: 'Agents', href: '/app/agents', icon: <Bot className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">AvatarPitch</h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 touch-manipulation"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-5 h-5" strokeWidth={2} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 w-64`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">AvatarPitch</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`nav-item touch-manipulation ${
                  isActive ? 'nav-item-active' : 'nav-item-inactive'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-600 mb-1">Current credits</p>
            <p className="text-2xl font-bold text-gray-900 mb-3">∞</p>
            <button className="w-full btn-primary text-sm py-2.5">
              Buy credits
            </button>
          </div>
          <button className="w-full btn-ghost text-sm py-2.5 flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}
