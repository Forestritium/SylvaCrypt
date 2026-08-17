import { useState, useEffect } from 'react';
import { getWaveformSettingsPref, setWaveformSettingsPref } from '@/lib/localStore';

export type WaveformType = 'legacy' | 'modern';

export interface WaveformSettings {
  type: WaveformType;
  color: string;
}

const defaultSettings: WaveformSettings = {
  type: 'modern',
  color: 'primary',
};

/** Read from sessionStorage write-through cache (populated on vault unlock). */
function readCachedSettings(): WaveformSettings {
  try {
    const cached = sessionStorage.getItem('sc_waveform_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...defaultSettings, ...parsed };
    }
  } catch { /* ignore */ }
  // Fallback: try the old cleartext key for first-boot migration
  try {
    const legacy = localStorage.getItem('sc_waveform_settings');
    if (legacy) return { ...defaultSettings, ...JSON.parse(legacy) };
  } catch { /* ignore */ }
  return defaultSettings;
}

export function useWaveformSettings() {
  const [settings, setSettings] = useState<WaveformSettings>(readCachedSettings);

  const updateSettings = (newSettings: Partial<WaveformSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      // Persist to encrypted store (fire-and-forget); also updates sessionStorage cache.
      setWaveformSettingsPref(next.type, next.color).catch(() => {});
      // Remove the legacy cleartext key once we have written to the encrypted store.
      try { localStorage.removeItem('sc_waveform_settings'); } catch { /* ignore */ }
      return next;
    });
  };

  // Re-sync when the sessionStorage cache is updated from another call
  // (e.g. after vault unlock seeds the caches).
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sc_waveform_cache' && e.newValue) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(e.newValue) });
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Also subscribe to the encrypted prefs: re-read from cache on mount to pick
  // up any value seeded by _seedNotificationCaches() after vault unlock.
  useEffect(() => {
    // Async load from encrypted store on first render to hydrate if cache is cold.
    getWaveformSettingsPref().then(({ type, color }) => {
      setSettings(prev => {
        if (prev.type === type && prev.color === color) return prev;
        return { type: type as WaveformType, color };
      });
    }).catch(() => {});
  }, []);

  return { settings, updateSettings };
}
