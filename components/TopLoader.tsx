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
            setVisible(true);
            setProgress(10);
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div
        className="h-1 bg-[#e05a2b] shadow-[0_1px_10px_#e05a2b] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  );
}
