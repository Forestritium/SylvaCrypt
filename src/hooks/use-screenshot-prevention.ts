/**
 * useScreenshotPrevention
 *
 * Applies a best-effort multi-layer screenshot deterrent to the page while the
 * component that calls this hook is mounted.  Because browsers give no reliable
 * API to *block* screenshots, the goal is to maximise friction and signal intent:
 *
 *  Layer 1 — CSS: disables text selection and drag on the protected container.
 *  Layer 2 — Context-menu suppression: removes the browser's Save/Copy menu on images.
 *  Layer 3 — PrintScreen key interception: shows a toast warning on keyup.
 *  Layer 4 — Visibility change detection: shows a brief warning overlay whenever
 *             the tab loses focus (snipping tools, screen recorders, Alt+Tab during
 *             capture) and re-shows it on focus return with a yellow reminder banner.
 *  Layer 5 — CSS print media: hides the page content when printing / "Print to PDF".
 *
 * Usage:
 *   const { containerProps } = useScreenshotPrevention();
 *   <div {...containerProps}>…sensitive content…</div>
 *
 * The hook is intentionally lightweight — no external dependencies.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseScreenshotPreventionReturn {
  /** Spread these props onto the container whose content should be protected. */
  containerProps: {
    style: React.CSSProperties;
    onContextMenu: (e: React.MouseEvent) => void;
  };
  /** True while the page visibility warning overlay should be shown. */
  showCaptureWarning: boolean;
}

export function useScreenshotPrevention(): UseScreenshotPreventionReturn {
  const [showCaptureWarning, setShowCaptureWarning] = useState(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Layer 3 — PrintScreen / Ctrl+P / Ctrl+S key interception
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isCapture =
        key === 'printscreen' ||
        (e.ctrlKey && key === 'p') ||   // Ctrl+P → Print / Save as PDF
        (e.metaKey && key === 'p') ||   // Cmd+P (macOS)
        (e.ctrlKey && key === 's') ||   // Ctrl+S → Save page
        (e.metaKey && key === 's');     // Cmd+S

      if (isCapture) {
        e.preventDefault();
        toast.warning('Screen capture is not permitted in this conversation.', {
          duration: 4000,
          id: 'sc-screenshot-warn',
        });
      }
    };

    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => window.removeEventListener('keyup', handleKeyUp, { capture: true });
  }, []);

  // Layer 4 — Page Visibility API: detect when the screen may be captured
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden — could be a snipping tool, screen recorder, or Alt+Tab
        setShowCaptureWarning(true);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      } else {
        // Tab regained focus — show a brief reminder then dismiss
        warningTimeoutRef.current = setTimeout(() => setShowCaptureWarning(false), 2500);
        toast.info('Screen capture protection is active.', {
          duration: 2500,
          id: 'sc-visibility-return',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  // Layer 5 — CSS print media (injected once, removed on unmount)
  useEffect(() => {
    const styleId = 'sc-no-print-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@media print { body { display: none !important; } }`;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  // Layer 2 — Context-menu suppression for images and text
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

  // Layer 1 — CSS: disable selection and drag on the container
  const containerStyle: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none' as React.CSSProperties['WebkitTouchCallout'],
    // Pointer-events remain enabled so clicks/scrolls work normally
  };

  return {
    containerProps: {
      style: containerStyle,
      onContextMenu: handleContextMenu,
    },
    showCaptureWarning,
  };
}
