'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Whenever pathname or search parameters change, complete loading
    if (visible) {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (visible && progress < 90) {
      interval = setInterval(() => {
        setProgress((prev) => {
          // Slow down progress as it approaches 90%
          const step = prev < 50 ? 8 : prev < 75 ? 4 : 1.5;
          const next = prev + step;
          return next > 90 ? 90 : next;
        });
      }, 120);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, progress]);

  useEffect(() => {
    let safetyTimer: NodeJS.Timeout;
    if (visible) {
      safetyTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 8000); // 8 seconds safety fallback
    }
    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [visible]);

  useEffect(() => {
    const handleStart = () => {
      setVisible(true);
      setProgress(10);
    };

    const handleAnchorClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }

      if (target && target instanceof HTMLAnchorElement) {
        const href = target.getAttribute('href');
        const targetAttr = target.getAttribute('target');

        // Ignore external, hash-only, mailto/tel, and new window links
        if (
          href &&
          !href.startsWith('http') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:') &&
          !href.startsWith('#') &&
          targetAttr !== '_blank' &&
          e.button === 0 && // Left click only
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey // No modifier keys
        ) {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(href, window.location.href);

          // Trigger loader if path or query string is changing
          if (
            currentUrl.pathname !== targetUrl.pathname ||
            currentUrl.search !== targetUrl.search
          ) {
            handleStart();
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    window.addEventListener('nextjs-navigation-start', handleStart);
    window.addEventListener('popstate', handleStart);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      window.removeEventListener('nextjs-navigation-start', handleStart);
      window.removeEventListener('popstate', handleStart);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-white z-[99999] flex flex-col items-center justify-center cursor-wait">
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        {/* Pulsing Brand Logo */}
        <div className="animate-pulse duration-1000">
          <svg viewBox="0 0 815.87 616.68" className="w-16 h-16 text-[#1a5c3a]" role="img" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.57,572.97 C-14.62,339.44 2.09,154.1 54.52,6.42 C131.36,20.31 232.4,73.22 354.99,164.82 C404.05,86.33 455.12,32.57 500.69,0 C663.72,152.93 769.22,344.53 815.87,575.22 C672.26,616.9 459.11,628.39 186.41,604.02 C196.86,520.39 228.65,425.92 266.84,328.03 L188.35,216.96 L87.47,383.14 L136.67,386.07 L70.38,505.35 L136.98,507.05 L136.13,597.9 C87.58,590.41 37.72,582.23 13.57,572.97 Z" fill="currentColor" fillRule="evenodd" />
          </svg>
        </div>
        
        {/* Spinner */}
        <div className="w-6 h-6 rounded-full border-2 border-[#1a5c3a]/25 border-t-[#1a5c3a] animate-spin" />
      </div>
    </div>
  );
}

