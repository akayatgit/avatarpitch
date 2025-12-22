'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Hourglass } from 'lucide-react';
import { useBanner } from '@/contexts/BannerContext';

export default function PromotionalBanner() {
  const { isBannerVisible: isVisible, setIsBannerVisible: setIsVisible } = useBanner();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 10,
    minutes: 34,
    seconds: 49,
  });

  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { days, hours, minutes, seconds } = prev;

        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        } else if (days > 0) {
          days--;
          hours = 23;
          minutes = 59;
          seconds = 59;
        }

        return { days, hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  if (!isVisible) return null;

  const formatTime = (value: number) => String(value).padStart(2, '0');

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-[#D1FE17] border-b border-black/10">
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 py-1 relative pr-8 sm:pr-10">
          {/* LAST CHANCE Button - Hidden on very small screens */}
          <button className="hidden sm:flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-pink-500 rounded-lg text-white text-[10px] md:text-xs font-semibold whitespace-nowrap">
            <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>LAST CHANCE</span>
          </button>

          {/* Timer Button - Compact on mobile */}
          <button className="flex items-center gap-1 px-1.5 py-1 sm:px-3 sm:py-1.5 bg-pink-500 rounded-lg text-white text-[10px] sm:text-xs font-semibold whitespace-nowrap">
            <Hourglass className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">
              Discount expires in {timeLeft.days}d {timeLeft.hours}h {formatTime(timeLeft.minutes)}m {formatTime(timeLeft.seconds)}s
            </span>
            <span className="sm:hidden">
              {timeLeft.days}d {timeLeft.hours}h {formatTime(timeLeft.minutes)}m
            </span>
          </button>

          {/* Promotional Message - Responsive text */}
          <p className="text-[10px] sm:text-xs lg:text-sm font-semibold text-black text-center flex-1 min-w-0">
            <span className="hidden sm:inline">Unlimited Carousels. Zero Limits. New Year Offer. Expires Jan 21, 2026</span>
            <span className="sm:hidden">Unlimited Carousels. Expires Jan 21, 2026</span>
          </p>

          {/* Close Button */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute right-1 sm:right-2 p-1 hover:bg-black/10 rounded transition-colors flex-shrink-0"
            aria-label="Close banner"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

