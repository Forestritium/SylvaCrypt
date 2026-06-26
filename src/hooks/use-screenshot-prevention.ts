/**
 * useScreenshotPrevention
 *
 * Applies document-level, best-effort screenshot deterrents while the calling
 * component is mounted.  Attach the returned `overlayVisible` boolean to render
 * a full-screen blur/hide overlay in the component tree.
 *
 * Layers applied:
 *  1. CSS (document.documentElement): disables text selection + drag site-wide.
 *  2. Context-menu suppression on every <img> and [data-chat-message] element.
 *  3. PrintScreen / Ctrl+P / Ctrl+S / Cmd+P / Cmd+S key interception.
 *  4. Page Visibility API: hides sensitive content whenever the tab loses focus
 *     (snipping tools, screen recorders, Alt+Tab during capture).
 *  5. @media print: injects a style rule that hides <body> during printing / Print-to-PDF.
 *
 * All listeners are attached to `document` / `window` so they fire regardless of
 * which element inside the page currently has focus.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseScreenshotPreventionReturn {
  /** Render a full-screen overlay in your JSX when this is true. */
  overlayVisible: boolean;
  /** Spread on any container to suppress right-click save on images. */
  containerProps: {
    onContextMenu: (e: React.MouseEvent) => void;
  };
}

export function useScreenshotPrevention(): UseScreenshotPreventionReturn {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Layer 1 — Disable text selection / drag at the document root
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.userSelect;
    root.style.userSelect = 'none';
    root.style.webkitUserSelect = 'none';
    return () => {
      root.style.userSelect = prev;
      root.style.webkitUserSelect = prev;
    };
  }, []);

  // Layer 3 — PrintScreen / Ctrl+P / Ctrl+S / Cmd+P / Cmd+S key interception
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isCapture =
        key === 'printscreen' ||
        (e.ctrlKey && key === 'p') ||
        (e.metaKey && key === 'p') ||
        (e.ctrlKey && key === 's') ||
        (e.metaKey && key === 's');

      if (isCapture) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toast.warning('Screen capture is not permitted in this conversation.', {
          duration: 4000,
          id: 'sc-screenshot-warn',
        });
      }
    };

    document.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => document.removeEventListener('keyup', handleKeyUp, { capture: true });
  }, []);

  // Layer 4 — Page Visibility API: show overlay when tab loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        setOverlayVisible(true);
      } else {
        toast.info('Screen capture protection is active.', {
          duration: 2000,
          id: 'sc-visibility-return',
        });
        // Keep overlay for 1.5 s after regaining focus so any in-progress capture misses content
        warningTimeoutRef.current = setTimeout(() => setOverlayVisible(false), 1500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  // Layer 5 — CSS @media print: hide entire body when printing / saving as PDF
  useEffect(() => {
    const styleId = 'sc-no-print-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = '@media print { body { display: none !important; } }';
      document.head.appendChild(style);
    }
    return () => document.getElementById(styleId)?.remove();
  }, []);

  // Layer 2 — Context-menu suppression on images / message elements
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'IMG' ||
      target.closest('img') ||
      target.closest('[data-chat-message]')
    ) {
      e.preventDefault();
      toast.warning('Right-click is disabled in this conversation.', {
        duration: 2500,
        id: 'sc-contextmenu-warn',
      });
    }
  }, []);

  return { overlayVisible, containerProps: { onContextMenu: handleContextMenu } };
}
