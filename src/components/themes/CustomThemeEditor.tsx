import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CustomTheme } from '@/lib/customThemesStore';
import { saveCustomTheme } from '@/lib/customThemesStore';
import { UploadCloud, Send, Smartphone, Monitor } from 'lucide-react';

const ColorPickerCircle = ({ value, onChange, label }: { value: string, onChange: (v: string) => void, label: string }) => (
  <div className="flex flex-col items-center gap-2 shrink-0">
    <div 
      className="w-12 h-12 rounded-full overflow-hidden border-2 border-border shadow-sm cursor-pointer relative"
      style={{ backgroundColor: value }}
    >
      <input 
        type="color" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="opacity-0 absolute inset-0 w-[200%] h-[200%] cursor-pointer -translate-x-1/4 -translate-y-1/4" 
        title={label}
      />
    </div>
    <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[60px]">{label}</span>
  </div>
);

export function CustomThemeEditor({ 
  open, 
  onClose, 
  initialTheme, 
  onSave 
}: { 
  open: boolean; 
  onClose: () => void; 
  initialTheme?: CustomTheme; 
  onSave: () => void; 
}) {
  const [name, setName] = useState(initialTheme?.name ?? '');
  const [isPublic, setIsPublic] = useState(initialTheme?.isPublic ?? false);
  const [msgColor, setMsgColor] = useState(initialTheme?.config.messageBubbleColor ?? '#0088ff');
  const [recvColor, setRecvColor] = useState(initialTheme?.config.receivedBubbleColor ?? '#ffffff');
  const [sendColor, setSendColor] = useState(initialTheme?.config.sendButtonColor ?? '#0088ff');
  const [bgColor, setBgColor] = useState(initialTheme?.config.backgroundColor ?? '#ffffff');
  const [font, setFont] = useState(initialTheme?.config.fontFamily ?? 'Inter');
  const [bgImage, setBgImage] = useState<string | undefined>(initialTheme?.config.backgroundImageDataUrl);
  const [bgType, setBgType] = useState<'color' | 'image'>(initialTheme?.config.backgroundType ?? 'color');
  
  const [headerColor, setHeaderColor] = useState(initialTheme?.config.headerColor ?? '#ffffff');
  const [sidebarColor, setSidebarColor] = useState(initialTheme?.config.sidebarColor ?? '#f4f4f5');
  const [cardColor, setCardColor] = useState(initialTheme?.config.cardColor ?? '#ffffff');
  const [glassmorphism, setGlassmorphism] = useState(initialTheme?.config.glassmorphism ?? false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('mobile');

  // Use a ref to keep track of the current theme ID to avoid regenerating random UUIDs on every render
  const themeIdRef = useRef(initialTheme?.id ?? `custom_${crypto.randomUUID()}`);
  const statusRef = useRef(initialTheme?.status ?? 'draft');

  useEffect(() => {
    const handleAutosave = async () => {
      const theme: CustomTheme = {
        id: themeIdRef.current,
        name: name.trim() || 'Untitled Draft',
        isPublic,
        status: 'draft',
        config: {
          messageBubbleColor: msgColor,
          receivedBubbleColor: recvColor,
          sendButtonColor: sendColor,
          backgroundColor: bgColor,
          backgroundType: bgType,
          fontFamily: font,
          backgroundImageDataUrl: bgImage,
          headerColor,
          sidebarColor,
          cardColor,
          glassmorphism
        }
      };
      await saveCustomTheme(theme);
    };

    // Auto-save on any change if it's currently a draft or if we are actively editing
    // Wait for 500ms debounce
    const timer = setTimeout(() => {
      if (statusRef.current === 'draft') {
        handleAutosave();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [name, isPublic, msgColor, recvColor, sendColor, bgColor, bgType, font, bgImage, headerColor, sidebarColor, cardColor, glassmorphism]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setBgImage(ev.target?.result as string);
        setBgType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setBgImage(ev.target?.result as string);
        setBgType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (asDraft: boolean) => {
    if (!asDraft && !name.trim()) {
      alert("Theme must be named before saving or publishing.");
      return;
    }
    const finalStatus = asDraft || !name.trim() ? 'draft' : 'saved';
    statusRef.current = finalStatus;
    const theme: CustomTheme = {
      id: themeIdRef.current,
      name: name.trim() || 'Untitled Draft',
      isPublic,
      status: finalStatus,
      config: {
        messageBubbleColor: msgColor,
        receivedBubbleColor: recvColor,
        sendButtonColor: sendColor,
        backgroundColor: bgColor,
        backgroundType: bgType,
        fontFamily: font,
        backgroundImageDataUrl: bgImage,
        headerColor,
        sidebarColor,
        cardColor,
        glassmorphism
      }
    };
    await saveCustomTheme(theme);
    
    // Also push to supabase if it is public
    if (isPublic && finalStatus === 'saved') {
      try {
        const { supabase } = await import('@/db/supabase');
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const rawId = theme.id.replace('custom_', '').replace('public_', '');
          const isUuid = rawId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          let payloadId = isUuid ? rawId : undefined;
          
          await supabase.from('public_themes').upsert({
            ...(payloadId ? { id: payloadId } : {}),
            name: theme.name,
            config: theme.config
          });
        }
      } catch (e) {
        console.error("Failed to publish theme to public directory", e);
      }
    }
    
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] md:max-w-4xl overflow-y-auto max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>{initialTheme ? 'Edit Custom Theme' : 'Create Custom Theme'}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row gap-8 py-4">
          <div className="w-full md:w-5/12 flex flex-col gap-4">
            {/* Live Preview */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Live Preview</Label>
              <div className="flex items-center bg-muted rounded-md p-0.5">
                <button 
                  onClick={() => setPreviewMode('mobile')}
                  className={`p-1 rounded-sm transition-colors ${previewMode === 'mobile' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setPreviewMode('desktop')}
                  className={`p-1 rounded-sm transition-colors ${previewMode === 'desktop' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Monitor className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className={`w-full flex justify-center bg-muted/20 rounded-xl p-4 border border-border ${previewMode === 'desktop' ? 'aspect-video' : ''}`}>
              <div 
                className={`rounded-xl border border-border shadow-md overflow-hidden flex relative transition-all ${previewMode === 'desktop' ? 'w-full h-full flex-row' : 'w-full max-w-[260px] aspect-[9/16] flex-col mx-auto'}`}
                style={{
                  backgroundColor: bgType === 'color' ? bgColor : undefined,
                  backgroundImage: bgType === 'image' && bgImage ? `url(${bgImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  fontFamily: font
                }}
              >
                {previewMode === 'desktop' && (
                  <div className="w-1/3 border-r border-border/20 shrink-0" style={{ backgroundColor: sidebarColor }}>
                    <div className="h-10 border-b border-border/20 px-3 flex items-center">
                      <div className="w-20 h-4 rounded bg-foreground/20" />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 p-2 rounded-md bg-foreground/5">
                        <img src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bsa31zk3mzgg/app-bu2wys49rfgh/20260724/icon-512x512.png" className="w-8 h-8 rounded-full object-cover" alt="Sylva" />
                        <div className="flex-1">
                          <div className="h-3 w-16 rounded bg-foreground/30 mb-1" />
                          <div className="h-2 w-24 rounded bg-foreground/20" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="h-12 border-b border-border flex items-center px-3 gap-3 shrink-0" style={{ backgroundColor: headerColor }}>
                    <img src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bsa31zk3mzgg/app-bu2wys49rfgh/20260724/icon-512x512.png" className="w-8 h-8 rounded-full object-cover shadow-sm" alt="Sylva" />
                    <div className="font-semibold text-sm drop-shadow-sm mix-blend-luminosity">Sylva</div>
                  </div>
                  
                  <div className="flex-1 p-3 flex flex-col gap-3 justify-end overflow-hidden">
                    <div 
                      className={`self-start max-w-[80%] p-2.5 rounded-2xl rounded-bl-sm text-xs shadow-sm ${glassmorphism ? 'backdrop-blur-md !bg-white/10 !border !border-white/20' : 'border border-border/5'}`} 
                      style={{ 
                        backgroundColor: glassmorphism ? 'transparent' : recvColor,
                        color: glassmorphism ? '#fff' : undefined // In real app depends on contrast, we mock it here
                      }}
                    >
                      Hello! Nice theme!
                    </div>
                    <div 
                      className={`self-end max-w-[80%] p-2.5 rounded-2xl rounded-br-sm text-xs shadow-sm ${glassmorphism ? 'backdrop-blur-md !bg-white/10 !border !border-white/20' : ''}`} 
                      style={{ 
                        backgroundColor: glassmorphism ? 'transparent' : msgColor,
                        color: '#fff' // Sent bubbles are typically white text
                      }}
                    >
                      Thanks, I customized it myself!
                    </div>
                  </div>
                  
                  <div className="h-14 border-t border-border flex items-center px-3 gap-2 shrink-0" style={{ backgroundColor: cardColor }}>
                    <div className="flex-1 h-9 rounded-full bg-foreground/10 border border-border/30" />
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: sendColor }}>
                      <Send className="w-4 h-4 ml-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-7/12 space-y-5">
            <div className="space-y-2">
              <Label>Theme Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Cool Theme" />
            </div>
            
            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
              <Label>Make Public</Label>
              <input 
                type="checkbox" 
                checked={isPublic} 
                onChange={e => setIsPublic(e.target.checked)} 
                className="w-5 h-5 accent-primary rounded cursor-pointer" 
              />
            </div>
            
            <div className="space-y-3">
              <Label>Background</Label>
              <div className="w-full border border-border rounded-lg bg-card overflow-hidden">
                <div className="w-full grid grid-cols-2 bg-muted/50 p-1 border-b border-border">
                  <button 
                    className={`py-1.5 text-sm font-medium rounded-md transition-colors ${bgType === 'color' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setBgType('color')}
                  >
                    Solid Color
                  </button>
                  <button 
                    className={`py-1.5 text-sm font-medium rounded-md transition-colors ${bgType === 'image' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setBgType('image')}
                  >
                    Image
                  </button>
                </div>
                
                {bgType === 'color' && (
                  <div className="p-4 flex justify-center">
                    <ColorPickerCircle value={bgColor} onChange={setBgColor} label="Background" />
                  </div>
                )}
                
                {bgType === 'image' && (
                  <div className="p-4">
                    <div 
                      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'} ${bgImage ? 'py-4' : 'py-8'}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                      {bgImage ? (
                        <div className="relative group">
                          <img src={bgImage} alt="bg preview" className="w-32 h-32 object-cover rounded-md border border-border shadow-sm" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center text-white text-xs cursor-pointer">
                            Change
                          </div>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setBgImage(undefined); setBgType('color'); }} 
                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="w-8 h-8 text-muted-foreground" />
                          <div className="text-center cursor-pointer">
                            <p className="text-sm font-medium">Click or drag and drop</p>
                            <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG or GIF</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <Label>Component Colors</Label>
              <div className="flex flex-wrap gap-4 p-4 bg-muted/20 rounded-xl border border-border justify-start">
                <ColorPickerCircle value={msgColor} onChange={setMsgColor} label="Sent Bubble" />
                <ColorPickerCircle value={recvColor} onChange={setRecvColor} label="Received Bubble" />
                <ColorPickerCircle value={sendColor} onChange={setSendColor} label="Send Button" />
                <ColorPickerCircle value={headerColor} onChange={setHeaderColor} label="Header" />
                <ColorPickerCircle value={sidebarColor} onChange={setSidebarColor} label="Sidebar" />
                <ColorPickerCircle value={cardColor} onChange={setCardColor} label="Cards / UI" />
              </div>
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label>Glassmorphism Bubbles</Label>
                <p className="text-[10px] text-muted-foreground">Applies a frosted glass effect to sent messages.</p>
              </div>
              <input 
                type="checkbox" 
                checked={glassmorphism} 
                onChange={e => setGlassmorphism(e.target.checked)} 
                className="w-5 h-5 accent-primary rounded cursor-pointer" 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Font Family</Label>
              <select className="w-full h-10 px-3 border border-border bg-card rounded-md shadow-sm" value={font} onChange={e => setFont(e.target.value)}>
                <option value="Inter">Inter (Default)</option>
                <option value="system-ui">System Default</option>
                <option value="monospace">Monospace</option>
                <option value="serif">Serif</option>
                <option value="Comic Sans MS">Comic Sans</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => handleSave(true)}>
            Save Draft
          </Button>
          <Button onClick={() => handleSave(false)}>
            {isPublic ? 'Publish' : 'Save Theme'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
