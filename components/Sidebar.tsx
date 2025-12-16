'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/app', icon: '🏠' },
  { name: 'Workspaces', href: '/app/workspaces', icon: '📁' },
  { name: 'Templates', href: '/app/templates', icon: '📄' },
  { name: 'Agents', href: '/app/agents', icon: '🤖' },
  { name: 'Create Project', href: '/app/create', icon: '✨' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">AvatarPitch</h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
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
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">AvatarPitch</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 lg:px-4 py-4 lg:py-6 space-y-1 lg:space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl transition-all active:scale-95 touch-manipulation ${
                  isActive
                    ? 'bg-purple-50 text-purple-700 font-medium shadow-sm'
                    : 'text-gray-700 active:bg-gray-100'
                }`}
              >
                <span className="text-xl lg:text-2xl">{item.icon}</span>
                <span className="text-base lg:text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 lg:p-4 border-t border-gray-200">
          <div className="bg-gray-50 rounded-xl p-3 lg:p-4 mb-3 lg:mb-4">
            <p className="text-xs lg:text-sm text-gray-600 mb-1 lg:mb-2">Current credits</p>
            <p className="text-xl lg:text-2xl font-bold text-gray-900 mb-2 lg:mb-3">∞</p>
            <button className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl active:bg-purple-700 active:scale-95 transition-all text-sm font-medium shadow-sm touch-manipulation">
              Buy credits
            </button>
          </div>
          <button className="w-full px-4 py-3 text-gray-700 active:bg-gray-100 rounded-xl transition-all text-sm touch-manipulation">
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}
