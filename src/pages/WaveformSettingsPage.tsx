import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWaveformSettings, WaveformType } from '@/hooks/use-waveform-settings';

export default function WaveformSettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useWaveformSettings();

  const handleTypeChange = (type: WaveformType) => {
    updateSettings({ type });
  };

  const colors = [
    { id: 'primary', name: 'Primary (Theme)', value: 'hsl(var(--primary))' },
    { id: '#10b981', name: 'Emerald', value: '#10b981' },
    { id: '#3b82f6', name: 'Blue', value: '#3b82f6' },
    { id: '#8b5cf6', name: 'Indigo', value: '#8b5cf6' },
    { id: '#ec4899', name: 'Violet', value: '#ec4899' },
    { id: '#f43f5e', name: 'Rose', value: '#f43f5e' },
    { id: '#f59e0b', name: 'Amber', value: '#f59e0b' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold">Waveform Settings</h1>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-8">
        
        {/* Type Selection */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Style</h2>
            <p className="text-sm text-muted-foreground">
              Choose how your voice messages are visualized during recording.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleTypeChange('legacy')}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                settings.type === 'legacy' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
              }`}
            >
              <div className="w-full aspect-video rounded-md border border-border bg-background flex flex-row items-center justify-center p-2 relative overflow-hidden shadow-sm">
                <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                  <path d="M0,20 Q10,10 20,20 T40,20 T60,20 T80,20 T100,20" fill="none" stroke={settings.color === 'primary' ? 'hsl(var(--primary))' : settings.color} strokeWidth="2" />
                  <path d="M0,20 Q10,30 20,20 T40,20 T60,20 T80,20 T100,20" fill="none" stroke={settings.color === 'primary' ? 'hsl(var(--primary))' : settings.color} strokeWidth="2" opacity="0.5" />
                </svg>
              </div>
              <span className="text-sm font-medium">Legacy (Line)</span>
            </button>

            <button
              onClick={() => handleTypeChange('modern')}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                settings.type === 'modern' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
              }`}
            >
              <div className="w-full aspect-video rounded-md border border-border bg-background flex flex-row items-center justify-center p-2 relative overflow-hidden shadow-sm gap-1">
                {[12, 24, 16, 32, 18, 28, 14, 22].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-full" style={{ height: `${h}px`, backgroundColor: settings.color === 'primary' ? 'hsl(var(--primary))' : settings.color }} />
                ))}
              </div>
              <span className="text-sm font-medium">Modern (Bars)</span>
            </button>
          </div>
        </section>

        {/* Color Selection */}
        <section className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Color</h2>
            <p className="text-sm text-muted-foreground">
              Customize the color of the recording waveform.
            </p>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {colors.map(c => (
              <button
                key={c.id}
                onClick={() => updateSettings({ color: c.id })}
                className="flex flex-col items-center gap-2 group outline-none"
                title={c.name}
              >
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border-2 transition-transform group-hover:scale-105 group-focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    settings.color === c.id ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                >
                  {settings.color === c.id && (
                    <Check className="w-6 h-6 text-white mix-blend-difference" />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground text-center truncate w-full px-1">{c.name}</span>
              </button>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
