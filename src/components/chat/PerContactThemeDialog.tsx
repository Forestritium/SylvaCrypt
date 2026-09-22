import { useState, useEffect } from 'react';
import { Check, Palette } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCustomThemes, type CustomTheme } from '@/lib/customThemesStore';
import { supabase } from '@/db/supabase';

const OFFICIAL_THEMES = [
  { id: 'light', name: 'Light (Default)', previewBg: 'bg-white', previewBorder: 'border-gray-200' },
  { id: 'dark', name: 'Dark (Default)', previewBg: 'bg-zinc-900', previewBorder: 'border-zinc-800' },
  { id: 'mint', name: 'Mint', previewBg: 'bg-slate-50', previewBorder: 'border-teal-200' },
  { id: 'mint-dark', name: 'Olive Dusk', previewBg: 'bg-slate-900', previewBorder: 'border-teal-800' },
  { id: 'ember', name: 'Ember', previewBg: 'bg-[#141211]', previewBorder: 'border-[#352b27]' },
  { id: 'neon-noir', name: 'Neon Noir', previewBg: 'bg-[#0d0d0d]', previewBorder: 'border-[#00e5ff]' },
];

interface ThemeOption {
  id: string;
  name: string;
  previewBg?: string;
  previewBorder?: string;
  source: 'official' | 'custom' | 'public';
}

interface PerContactThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentThemeId?: string | null;
  onSelect: (themeId: string | null) => void;
}

export function PerContactThemeDialog({
  open,
  onOpenChange,
  currentThemeId,
  onSelect,
}: PerContactThemeDialogProps) {
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [publicThemes, setPublicThemes] = useState<CustomTheme[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      getCustomThemes(),
      supabase.from('public_themes').select('*').order('downloads', { ascending: false }).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
        if (!data) return [];
        return data.map(d => ({
          id: `public_${d.id}`,
          name: d.name,
          description: d.description,
          mode: d.mode,
          isPublic: true,
          status: 'saved',
          config: d.config,
        })) as CustomTheme[];
      }),
    ]).then(([custom, pub]) => {
      setCustomThemes(custom);
      setPublicThemes(pub);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open]);

  const allOptions: ThemeOption[] = [
    { id: '_default', name: 'Use my default theme', previewBg: 'bg-muted', previewBorder: 'border-border', source: 'official' },
    ...OFFICIAL_THEMES.map(t => ({ ...t, source: 'official' as const })),
    ...customThemes.map(t => ({ id: t.id, name: t.name, source: 'custom' as const })),
    ...publicThemes.map(t => ({ id: t.id, name: t.name, source: 'public' as const })),
  ];

  const selectedId = currentThemeId ?? '_default';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Per-Contact Theme
          </DialogTitle>
          <DialogDescription>
            Choose a theme that will be applied only while chatting with this contact.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {allOptions.map(option => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id === '_default' ? null : option.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                selectedId === option.id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-card hover:bg-muted/50'
              }`}
            >
              {option.previewBg ? (
                <div className={`w-full aspect-video rounded-md border ${option.previewBg} ${option.previewBorder} flex items-center justify-center relative overflow-hidden shadow-sm`}>
                  <div className="absolute top-2 left-2 w-1/2 h-2 rounded-full bg-muted/50" />
                  <div className="absolute top-5 right-2 w-1/2 h-2 rounded-full bg-primary/50" />
                  {selectedId === option.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video rounded-md border border-border bg-muted flex items-center justify-center relative overflow-hidden">
                  <span className="text-xs text-muted-foreground">{option.source}</span>
                  {selectedId === option.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
              )}
              <span className="text-xs font-medium text-center w-full truncate">{option.name}</span>
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-xs text-muted-foreground text-center">Loading themes...</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
