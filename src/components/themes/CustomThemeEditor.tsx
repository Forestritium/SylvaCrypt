import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CustomTheme } from '@/lib/customThemesStore';
import { saveCustomTheme } from '@/lib/customThemesStore';
import { isColorDark, hexToHSLString } from '@/lib/colorUtils';
import { UploadCloud, Smartphone, Monitor } from 'lucide-react';

export const MockPreview = ({ 
  previewMode = 'mobile', 
  msgColor = '#4a5c50', 
  recvColor = '#232a26', 
  sendColor = '#6b8a75', 
  bgColor = '#1a1f1c', 
  bgType = 'color', 
  font = 'Inter', 
  bgImage, 
  headerColor, 
  sidebarColor, 
  cardColor, 
  inputColor, 
  glassmorphism = false, 
  glassmorphismUi = false
}: any) => {
  const isBgDark = isColorDark(bgColor);
  const isSidebarDark = sidebarColor ? isColorDark(sidebarColor) : isBgDark;
  const isHeaderDark = headerColor ? isColorDark(headerColor) : isBgDark;
  const isMsgDark = isColorDark(msgColor);
  const isRecvDark = recvColor ? isColorDark(recvColor) : isBgDark;
  
  const getGlassCss = (hex: string, isUi: boolean) => {
    if (!(isUi ? glassmorphismUi : glassmorphism)) return {};
    const hsl = hexToHSLString(hex).split(' ').join(', ');
    return {
      backdropFilter: 'blur(12px)',
      backgroundColor: `hsla(${hsl}, 0.15)`,
      border: `1px solid ${isBgDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    };
  };

  const containerStyle: any = {
    fontFamily: font || 'inherit',
    backgroundColor: bgColor,
    color: isBgDark ? '#fff' : '#1a1a1a',
    ...(bgType === 'image' && bgImage ? {
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    } : {})
  };

  const sidebarStyle: any = {
    backgroundColor: sidebarColor || bgColor,
    color: isSidebarDark ? '#fff' : '#1a1a1a',
    borderRight: `1px solid ${isBgDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    ...(glassmorphismUi ? getGlassCss(sidebarColor || bgColor, true) : {})
  };

  const headerStyle: any = {
    backgroundColor: headerColor || bgColor,
    color: isHeaderDark ? '#fff' : '#1a1a1a',
    borderBottom: `1px solid ${isBgDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    ...(glassmorphismUi ? getGlassCss(headerColor || bgColor, true) : {})
  };

  const sentBubbleStyle: any = {
    backgroundColor: msgColor,
    color: isMsgDark ? '#fff' : '#1a1a1a',
    ...(glassmorphism ? getGlassCss(msgColor, false) : {})
  };

  const recvBubbleStyle: any = {
    backgroundColor: recvColor || cardColor || (isBgDark ? '#1a1a1a' : '#fff'),
    color: isRecvDark ? '#fff' : '#1a1a1a',
    ...(glassmorphism ? getGlassCss(recvColor || cardColor || bgColor, false) : {})
  };

  const cardStyle: any = {
    backgroundColor: cardColor || bgColor,
    borderTop: `1px solid ${isBgDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    ...(glassmorphismUi ? getGlassCss(cardColor || bgColor, true) : {})
  };

  const inputStyle: any = {
    backgroundColor: inputColor || cardColor || (isBgDark ? 'rgba(0,0,0,0.2)' : '#fff'),
    border: `1px solid ${isBgDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    ...(glassmorphismUi ? getGlassCss(inputColor || cardColor || bgColor, true) : {})
  };

  return (
    <div 
      className={`rounded-xl shadow-md overflow-hidden isolate flex transition-all ${previewMode === 'desktop' ? 'w-full aspect-video flex-row' : 'w-full max-w-[260px] aspect-[9/16] flex-col mx-auto'}`}
      style={containerStyle}
    >
      {/* Sidebar */}
      <div style={sidebarStyle} className={`flex flex-col shrink-0 min-w-0 ${previewMode === 'desktop' ? 'w-[30%] max-w-[140px] h-full' : 'hidden'}`}>
        <div className="p-3 border-b border-white/10 font-medium text-xs flex items-center gap-2">
          <div className="w-5 h-5 shrink-0 rounded-full bg-black/20 flex items-center justify-center">S</div>
          <span className="truncate">SylvaCrypt</span>
        </div>
        <div className="flex-1 p-2 space-y-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/10 min-w-0">
            <div className="w-5 h-5 shrink-0 rounded-full bg-white/20"></div>
            <div className="flex-1 min-w-0">
              <div className="h-2 w-3/4 bg-white/20 rounded mb-1"></div>
              <div className="h-1.5 w-full bg-white/10 rounded"></div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg min-w-0">
            <div className="w-5 h-5 shrink-0 rounded-full bg-black/20"></div>
            <div className="flex-1 min-w-0">
              <div className="h-2 w-4/5 bg-black/20 rounded mb-1"></div>
              <div className="h-1.5 w-2/3 bg-black/10 rounded"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-transparent">
        <div style={headerStyle} className="p-3 font-medium text-xs flex items-center gap-2 shrink-0 min-w-0">
          {previewMode !== 'desktop' && <div className="w-4 h-4 shrink-0 rounded bg-black/20" />}
          <div className="w-6 h-6 shrink-0 rounded-full bg-white/20"></div>
          <span className="truncate">Contact Name</span>
        </div>
        
        <div className="flex-1 p-4 space-y-4 overflow-hidden flex flex-col justify-end bg-transparent">
          <div className="flex justify-start">
            <div style={recvBubbleStyle} className="p-2.5 rounded-2xl rounded-bl-sm text-[10px] max-w-[80%] shadow-sm">
              Hello! This is a preview of your theme.
            </div>
          </div>
          <div className="flex justify-end">
            <div style={sentBubbleStyle} className="p-2.5 rounded-2xl rounded-br-sm text-[10px] max-w-[80%] shadow-sm break-words whitespace-normal leading-tight">
              Wow, it looks great! The colors match perfectly.
            </div>
          </div>
        </div>
        
        <div style={cardStyle} className="p-2 shrink-0 min-w-0">
          <div style={inputStyle} className="w-full h-8 rounded-full flex items-center px-2 gap-2 min-w-0">
            <div className="w-4 h-4 shrink-0 rounded-full bg-black/20"></div>
            <div className="h-2 w-1/2 bg-black/10 rounded"></div>
            <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: sendColor }}>
              <div className="w-2 h-2 rounded-sm bg-white/80"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [description, setDescription] = useState(initialTheme?.description ?? '');
  const [mode, setMode] = useState<'light' | 'dark' | 'unclassified'>(initialTheme?.mode ?? 'dark');
  const [isPublic, setIsPublic] = useState(initialTheme?.isPublic ?? false);
  const [msgColor, setMsgColor] = useState(initialTheme?.config?.messageBubbleColor ?? '#4a5c50');
  const [recvColor, setRecvColor] = useState(initialTheme?.config?.receivedBubbleColor ?? '#232a26');
  const [sendColor, setSendColor] = useState(initialTheme?.config?.sendButtonColor ?? '#6b8a75');
  const [bgColor, setBgColor] = useState(initialTheme?.config?.backgroundColor ?? '#1a1f1c');
  const [font, setFont] = useState(initialTheme?.config?.fontFamily ?? 'Inter');
  const [bgImage, setBgImage] = useState<string | undefined>(initialTheme?.config?.backgroundImageDataUrl);
  const [bgType, setBgType] = useState<'color' | 'image'>(initialTheme?.config?.backgroundType ?? 'color');
  
  const [headerColor, setHeaderColor] = useState(initialTheme?.config?.headerColor ?? '#1a1f1c');
  const [sidebarColor, setSidebarColor] = useState(initialTheme?.config?.sidebarColor ?? '#161a18');
  const [cardColor, setCardColor] = useState(initialTheme?.config?.cardColor ?? '#232a26');
  const [inputColor, setInputColor] = useState(initialTheme?.config?.inputBoxColor ?? '#2a332e');
  const [glassmorphism, setGlassmorphism] = useState(initialTheme?.config?.glassmorphism ?? false);
  const [glassmorphismUi, setGlassmorphismUi] = useState(initialTheme?.config?.glassmorphismUi ?? false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Auto-detect device for default preview mode
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(window.innerWidth < 768 ? 'mobile' : 'desktop');

  // Use a ref to keep track of the current theme ID to avoid regenerating random UUIDs on every render
  const themeIdRef = useRef(initialTheme?.id ?? `custom_${crypto.randomUUID()}`);
  const statusRef = useRef(initialTheme?.status ?? 'draft');

  useEffect(() => {
    const handleAutosave = async () => {
      const theme: CustomTheme = {
        id: themeIdRef.current,
        name: name.trim() || 'Untitled Draft',
        description: description.trim(),
        mode,
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
          inputBoxColor: inputColor,
          glassmorphism,
          glassmorphismUi
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
  }, [name, description, mode, isPublic, msgColor, recvColor, sendColor, bgColor, bgType, font, bgImage, headerColor, sidebarColor, cardColor, inputColor, glassmorphism, glassmorphismUi]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.postMessage({
      type: 'THEME_PREVIEW',
      theme: {
        id: 'preview',
        bgColor, msgColor, recvColor, sendColor, font, bgImage: bgType === 'image' ? bgImage : undefined, headerColor, sidebarColor, cardColor, inputColor, glassmorphism, glassmorphismUi, mode
      }
    }, '*');
  }, [bgColor, msgColor, recvColor, sendColor, font, bgImage, bgType, headerColor, sidebarColor, cardColor, inputColor, glassmorphism, glassmorphismUi, mode]);
  
  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        const compressed = await compressImage(result);
        if (compressed.length > 4500000) {
          alert("Image is too large even after compression. Please choose a smaller image.");
          return;
        }
        setBgImage(compressed);
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
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        const compressed = await compressImage(result);
        if (compressed.length > 4500000) {
          alert("Image is too large even after compression. Please choose a smaller image.");
          return;
        }
        setBgImage(compressed);
        setBgType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (asDraft: boolean) => {
    if (!asDraft && (!name.trim() || !description.trim())) {
      alert("Theme must have a name and description before saving or publishing.");
      return;
    }
    const finalStatus = asDraft || !name.trim() ? 'draft' : 'saved';
    statusRef.current = finalStatus;
    const theme: CustomTheme = {
      id: themeIdRef.current,
      name: name.trim() || 'Untitled Draft',
      description: description.trim(),
      mode,
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
        inputBoxColor: inputColor,
        glassmorphism,
        glassmorphismUi
      }
    };
    await saveCustomTheme(theme);
    
    // Also push to supabase if it is public
    if (isPublic && finalStatus === 'saved') {
      try {
        const { supabase } = await import('@/db/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          alert("You must be logged in to publish a public theme.");
          return;
        }

        const rawId = theme.id.replace('custom_', '').replace('public_', '');
        const isUuid = rawId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        let payloadId = isUuid ? rawId : undefined;
        
        if (payloadId) {
          const { error } = await supabase.from('public_themes').upsert({
            id: payloadId,
            author_id: session.user.id,
            name: theme.name,
            description: theme.description,
            mode: theme.mode,
            config: theme.config
          });
          
          if (error) {
            console.warn("Upsert failed (likely not the author). Forking as a new theme...", error);
            // Fallback: Insert as a new theme (fork)
            const { data: forkData, error: forkError } = await supabase.from('public_themes').insert({
              author_id: session.user.id,
              name: theme.name + " (Copy)",
              description: theme.description,
              mode: theme.mode,
              config: theme.config
            }).select('id').single();
            
            if (!forkError && forkData) {
              const oldId = theme.id;
              theme.id = `public_${forkData.id}`;
              theme.name = theme.name + " (Copy)";
              themeIdRef.current = theme.id;
              
              if (oldId !== theme.id) {
                const { deleteCustomTheme, saveCustomTheme } = await import('@/lib/customThemesStore');
                await deleteCustomTheme(oldId);
                await saveCustomTheme(theme);
              }
            } else if (forkError) {
              console.error("Fork insert error:", forkError);
              alert(`Failed to publish theme: ${forkError.message || 'Unknown error'}`);
              return;
            }
          }
        } else {
          const { data, error } = await supabase.from('public_themes').insert({
            author_id: session.user.id,
            name: theme.name,
            description: theme.description,
            mode: theme.mode,
            config: theme.config
          }).select('id').single();
          
          if (!error && data) {
            const oldId = theme.id;
            theme.id = `public_${data.id}`;
            themeIdRef.current = theme.id;
            
            if (oldId !== theme.id) {
              const { deleteCustomTheme, saveCustomTheme } = await import('@/lib/customThemesStore');
              await deleteCustomTheme(oldId);
              await saveCustomTheme(theme);
            }
          } else if (error) {
            console.error("Insert error:", error);
            alert(`Failed to publish theme: ${error.message || 'Unknown error'}`);
            return;
          }
        }
      } catch (e: any) {
        console.error("Failed to publish theme to public directory", e);
        alert(`Failed to publish theme: ${e.message || 'Network error'}`);
        return;
      }
    }
    
    onSave();
    onClose();
  };

  const handleCancel = async () => {
    if (window.confirm("Are you sure you want to discard your changes?")) {
      if (initialTheme) {
        // Revert to initialTheme
        await saveCustomTheme(initialTheme);
      } else {
        // Delete the newly created draft
        const { deleteCustomTheme } = await import('@/lib/customThemesStore');
        await deleteCustomTheme(themeIdRef.current);
      }
      onSave(); // Trigger a reload of themes
      onClose();
    }
  };

  useEffect(() => {
    return () => {
      window.postMessage({ type: 'THEME_PREVIEW', theme: null }, '*');
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        window.postMessage({ type: 'THEME_PREVIEW', theme: null }, '*');
        onClose();
      }
    }}>
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
            
            <div className="w-full flex justify-center bg-muted/20 rounded-xl p-4 border border-border">
              <MockPreview 
                previewMode={previewMode}
                msgColor={msgColor}
                recvColor={recvColor}
                sendColor={sendColor}
                bgColor={bgColor}
                bgType={bgType}
                font={font}
                bgImage={bgImage}
                headerColor={headerColor}
                sidebarColor={sidebarColor}
                cardColor={cardColor}
                inputColor={inputColor}
                glassmorphism={glassmorphism}
                glassmorphismUi={glassmorphismUi}
              />
            </div>
          </div>
          
          <div className="w-full md:w-7/12 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Theme Name <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Olive Dusk" />
              </div>
              <div className="space-y-2">
                <Label>Mode <span className="text-destructive">*</span></Label>
                <select className="w-full h-10 px-3 border border-border bg-card rounded-md shadow-sm" value={mode} onChange={e => setMode(e.target.value as 'light'|'dark'|'unclassified')}>
                  <option value="dark">Dark Mode</option>
                  <option value="light">Light Mode</option>
                  <option value="unclassified">Unclassified</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="A short description about your theme..." />
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
                <ColorPickerCircle value={inputColor} onChange={setInputColor} label="Input Box" />
              </div>
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label>Glassmorphism Bubbles</Label>
                <p className="text-[10px] text-muted-foreground">Applies a frosted glass effect to all message bubbles.</p>
              </div>
              <input 
                type="checkbox" 
                checked={glassmorphism} 
                onChange={e => setGlassmorphism(e.target.checked)} 
                className="w-5 h-5 accent-primary rounded cursor-pointer" 
              />
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label>Glassmorphism UI</Label>
                <p className="text-[10px] text-muted-foreground">Applies a frosted glass effect to Sidebar, Header, Cards, and other UI components.</p>
              </div>
              <input 
                type="checkbox" 
                checked={glassmorphismUi} 
                onChange={e => setGlassmorphismUi(e.target.checked)} 
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
          <Button variant="outline" onClick={handleCancel}>
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
