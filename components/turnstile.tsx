'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: 'dark' | 'light' | 'auto';
          callback: (token: string) => void;
          'expired-callback'?: () => void;
        },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Cloudflare Turnstile. Loaded only on the sign-in page; CSP allows exactly its origin. */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (t: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    let widget: string | null = null;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget = window.turnstile.render(box.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (t) => cb.current(t),
        'expired-callback': () => cb.current(null),
      });
    };
    if (window.turnstile) mount();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', mount);
    }
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [siteKey]);

  return <div ref={box} className="min-h-[65px]" />;
}
