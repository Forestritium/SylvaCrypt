import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getCustomTheme } from '@/lib/customThemesStore';
import { hexToHSLString, isColorDark } from '@/lib/colorUtils';

type Theme = string;

interface AutoSchedule {
  enabled: boolean;
  lightStart: string; // HH:MM
  darkStart: string;  // HH:MM
  lightTheme: Theme;
  darkTheme: Theme;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  autoSchedule: AutoSchedule;
  setAutoSchedule: (schedule: AutoSchedule) => void;
  /** Temporarily override the active theme for a single contact's chat. */
  contactTheme: Theme | null;
  setContactTheme: (theme: Theme | null) => void;
}

const defaultAutoSchedule: AutoSchedule = {
  enabled: false,
  lightStart: '07:00',
  darkStart: '19:00',
  lightTheme: 'light',
  darkTheme: 'dark',
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  autoSchedule: defaultAutoSchedule,
  setAutoSchedule: () => {},
  contactTheme: null,
  setContactTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('sc_theme') as Theme | null;
      return stored ? stored : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [autoSchedule, setAutoScheduleState] = useState<AutoSchedule>(() => {
    try {
      const raw = localStorage.getItem('sc_theme_auto');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultAutoSchedule, ...parsed };
      }
    } catch { /* ignore */ }
    return defaultAutoSchedule;
  });

  const isDarkTheme = (t: Theme) => ['dark', 'mint-dark', 'ember', 'neon-noir'].includes(t);

  const toggleTheme = () => {
    setTheme(current => {
      if (isDarkTheme(current)) {
        return (localStorage.getItem('sc_theme_light') as Theme) || 'light';
      } else {
        return (localStorage.getItem('sc_theme_dark') as Theme) || 'dark';
      }
    });
  };

  const setAutoSchedule = (schedule: AutoSchedule) => {
    setAutoScheduleState(schedule);
    try { localStorage.setItem('sc_theme_auto', JSON.stringify(schedule)); } catch { /* ignore */ }
  };

  const applyScheduledTheme = (schedule: AutoSchedule) => {
    if (!schedule.enabled) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const [lh, lm] = schedule.lightStart.split(':').map(Number);
    const [dh, dm] = schedule.darkStart.split(':').map(Number);
    const lightMinutes = (lh || 0) * 60 + (lm || 0);
    const darkMinutes = (dh || 0) * 60 + (dm || 0);
    const next = lightMinutes <= darkMinutes
      ? (minutes >= lightMinutes && minutes < darkMinutes ? schedule.lightTheme : schedule.darkTheme)
      : (minutes >= darkMinutes && minutes < lightMinutes ? schedule.darkTheme : schedule.lightTheme);
    setTheme(next);
  };

  const [previewCustomTheme, setPreviewCustomTheme] = useState<any>(null);
  const [contactTheme, setContactThemeState] = useState<Theme | null>(null);

  const setContactTheme = useCallback((next: Theme | null) => {
    setContactThemeState(next);
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'THEME_PREVIEW') {
        setPreviewCustomTheme(e.data.theme);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Active theme is the per-contact override when present, otherwise the user's theme.
  const activeTheme = contactTheme || theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-mint', 'theme-mint-dark', 'theme-ember', 'theme-neon-noir');
    
    if (previewCustomTheme || activeTheme?.startsWith('custom_') || activeTheme?.startsWith('public_')) {
      const applyTheme = (ct: any) => {
        if (!ct) return;
        
        // Remove old style safely only when we are about to inject the new one
        const oldStyle = document.getElementById('sc-custom-theme-style');
        if (oldStyle) oldStyle.remove();
        
        const config = ct.id === 'preview' ? {
          backgroundColor: ct.bgColor || '#09090b',
          messageBubbleColor: ct.msgColor || '#3b82f6',
          sendButtonColor: ct.sendColor || '#3b82f6',
          headerColor: ct.headerColor,
          sidebarColor: ct.sidebarColor,
          cardColor: ct.cardColor,
          receivedBubbleColor: ct.recvColor,
          backgroundType: ct.bgType,
          backgroundImageDataUrl: ct.bgImage,
          fontFamily: ct.font,
          glassmorphism: ct.glassmorphism,
          glassmorphismUi: ct.glassmorphismUi
        } : (ct.config || {});

        // Force the color mode of the preview theme
        if (ct.mode) {
          root.classList.remove('light', 'dark');
          if (ct.mode !== 'unclassified') {
            root.classList.add(ct.mode);
          }
        }

        const bgHsl = config.backgroundColor ? hexToHSLString(config.backgroundColor) : '0 0% 10%';
        const msgHsl = config.messageBubbleColor ? hexToHSLString(config.messageBubbleColor) : '217 91% 50%';
        const sendHsl = config.sendButtonColor ? hexToHSLString(config.sendButtonColor) : '217 91% 50%';
        
        const isBgDark = config.backgroundColor ? isColorDark(config.backgroundColor) : true;
        const isMsgDark = config.messageBubbleColor ? isColorDark(config.messageBubbleColor) : true;
        const isSendDark = config.sendButtonColor ? isColorDark(config.sendButtonColor) : true;
        const isHeaderDark = config.headerColor ? isColorDark(config.headerColor) : isBgDark;
        const isSidebarDark = config.sidebarColor ? isColorDark(config.sidebarColor) : isBgDark;
        
        const headerHsl = config.headerColor ? hexToHSLString(config.headerColor) : bgHsl;
        const sidebarHsl = config.sidebarColor ? hexToHSLString(config.sidebarColor) : bgHsl;
        const cardHsl = config.cardColor ? hexToHSLString(config.cardColor) : (isBgDark ? '222 22% 13%' : '0 0% 100%');
        const inputHsl = config.inputBoxColor ? hexToHSLString(config.inputBoxColor) : cardHsl;
        
        const recvHsl = config.receivedBubbleColor ? hexToHSLString(config.receivedBubbleColor) : cardHsl;
        const isRecvDark = config.receivedBubbleColor ? isColorDark(config.receivedBubbleColor) : isBgDark;
        const recvForeground = isRecvDark ? '0 0% 100%' : '220 13% 13%';
        
        const foreground = isBgDark ? '0 0% 100%' : '220 13% 13%';
        const headerForeground = isHeaderDark ? '0 0% 100%' : '220 13% 13%';
        const sidebarForeground = isSidebarDark ? '0 0% 100%' : '220 13% 13%';
        const borderHsl = isBgDark ? '0 0% 100% / 0.1' : '0 0% 0% / 0.1';
        
        const msgForeground = isMsgDark ? '0 0% 100%' : '220 13% 13%';
        const sendForeground = isSendDark ? '0 0% 100%' : '220 13% 13%';

        if (isBgDark || ct.mode === 'dark') {
          root.classList.add('dark');
        }

        const styleEl = document.createElement('style');
        styleEl.id = 'sc-custom-theme-style';
        
        let bgImgCss = '';
        if (config.backgroundType === 'image' && config.backgroundImageDataUrl) {
          bgImgCss = `
            background-image: url("${config.backgroundImageDataUrl}") !important; 
            background-size: cover !important; 
            background-position: center !important; 
            background-attachment: fixed !important;
          `;
        } else if (config.backgroundType === 'color' || !config.backgroundType) {
          bgImgCss = `
            background-image: none !important;
          `;
        }
        
        const getGlassCss = (baseHsl: string, fgHsl: string, isUi: boolean) => (isUi ? config.glassmorphismUi : config.glassmorphism) ? `
          backdrop-filter: blur(12px) !important;
          background-color: hsl(${baseHsl} / 0.3) !important;
          border: 1px solid ${isBgDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'} !important;
          color: hsl(${fgHsl}) !important;
        ` : '';

        styleEl.innerHTML = `
          :root {
            --background: ${bgHsl};
            --foreground: ${foreground};
            --card: ${cardHsl};
            --card-foreground: ${foreground};
            --popover: ${cardHsl};
            --popover-foreground: ${foreground};
            --border: ${borderHsl};
            --input: ${borderHsl};
            
            --primary: ${sendHsl};
            --primary-foreground: ${sendForeground};
            
            --bubble-sent-bg: hsl(${msgHsl});
            --bubble-sent-text: hsl(${msgForeground});
            --bubble-recv-bg: hsl(${recvHsl});
            --bubble-recv-text: hsl(${recvForeground});
            --bubble-recv-border: transparent;
            
            --sidebar-background: ${sidebarHsl};
            --sidebar-foreground: ${sidebarForeground};
            --sidebar-primary: ${sendHsl};
            --sidebar-primary-foreground: ${sendForeground};
            --sidebar-accent: ${inputHsl};
            --sidebar-accent-foreground: ${sidebarForeground};
            --sidebar-border: ${borderHsl};

            --font-sans: ${(config.fontFamily && /^[a-zA-Z0-9\\s,\\-_'"]+$/.test(config.fontFamily)) ? config.fontFamily : 'Inter'}, sans-serif;
          }
          body {
            font-family: var(--font-sans);
          }
          body, .bg-background {
            ${bgImgCss}
          }
          .bg-card {
            background-color: hsl(${cardHsl}) !important;
            ${config.glassmorphismUi ? getGlassCss(cardHsl, foreground, true) : ''}
          }
          .bg-popover {
            background-color: hsl(${cardHsl}) !important;
            ${config.glassmorphismUi ? getGlassCss(cardHsl, foreground, true) : ''}
          }
          .bg-muted {
            background-color: hsl(${cardHsl} / 0.5) !important;
            ${config.glassmorphismUi ? getGlassCss(cardHsl, foreground, true) : ''}
          }
          .bg-sidebar-accent {
            background-color: hsl(${inputHsl} / 0.5);
            ${config.glassmorphismUi ? getGlassCss(inputHsl, sidebarForeground, true) : ''}
          }
          .message-input-box {
            background-color: hsl(${inputHsl}) !important;
            ${config.glassmorphismUi ? getGlassCss(inputHsl, foreground, true) : 'backdrop-filter: blur(10px);'}
          }
          header, .border-b.bg-card {
            background-color: hsl(${headerHsl}) !important;
            color: hsl(${headerForeground});
            ${getGlassCss(headerHsl, headerForeground, true)}
          }
          aside, nav, .bg-sidebar {
            background-color: hsl(${sidebarHsl}) !important;
            color: hsl(${sidebarForeground});
            ${getGlassCss(sidebarHsl, sidebarForeground, true)}
          }
          .bubble-sent {
            ${getGlassCss(msgHsl, msgForeground, false)}
          }
          .bubble-received {
            ${getGlassCss(recvHsl, recvForeground, false)}
          }
        `;
        document.head.appendChild(styleEl);
      };

      if (previewCustomTheme) {
        root.classList.add('dark'); // Apply fallback immediately
        applyTheme(previewCustomTheme);
      } else {
        root.classList.add('dark'); // Apply fallback immediately
        getCustomTheme(activeTheme).then(ct => {
          if (ct) {
            applyTheme(ct);
          } else {
            const oldStyle = document.getElementById('sc-custom-theme-style');
            if (oldStyle) oldStyle.remove();
          }
        }).catch(() => {
          console.warn('Failed to load theme, using fallback');
          const oldStyle = document.getElementById('sc-custom-theme-style');
          if (oldStyle) oldStyle.remove();
        });
      }
    } else {
      // For built-in themes, we can safely remove the custom style element immediately
      const oldStyle = document.getElementById('sc-custom-theme-style');
      if (oldStyle) oldStyle.remove();

      if (activeTheme === 'dark') {
        root.classList.add('dark');
      } else if (activeTheme === 'mint') {
        root.classList.add('theme-mint');
      } else if (activeTheme === 'mint-dark') {
        root.classList.add('dark', 'theme-mint-dark');
      } else if (activeTheme === 'ember') {
        root.classList.add('dark', 'theme-ember');
      } else if (activeTheme === 'neon-noir') {
        root.classList.add('dark', 'theme-neon-noir');
      } else if (activeTheme === 'light') {
        // Just empty, classes removed above
      }
    }

    // Persist only the user's chosen theme, not a temporary per-contact override.
    try {
      if (!contactTheme) {
        localStorage.setItem('sc_theme', theme);
        if (isDarkTheme(theme)) {
          localStorage.setItem('sc_theme_dark', theme);
        } else if (!theme.startsWith('custom_') && !theme.startsWith('public_')) {
          localStorage.setItem('sc_theme_light', theme);
        }
      }
    } catch { /* ignore */ }
  }, [theme, contactTheme, activeTheme]);

  // Auto-scheduling effect
  useEffect(() => {
    if (!autoSchedule.enabled) return;
    applyScheduledTheme(autoSchedule);
    const id = setInterval(() => applyScheduledTheme(autoSchedule), 60 * 1000);
    return () => clearInterval(id);
  }, [autoSchedule]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, autoSchedule, setAutoSchedule, contactTheme, setContactTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
