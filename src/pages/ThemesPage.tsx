import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Plus, Edit, Trash2, Search, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/contexts/ThemeContext';
import { CustomThemeEditor, MockPreview } from '@/components/themes/CustomThemeEditor';
import { getCustomThemes, deleteCustomTheme, type CustomTheme } from '@/lib/customThemesStore';
import { supabase } from '@/db/supabase';

export default function ThemesPage() {
  const navigate = useNavigate();
  const { theme: currentTheme, setTheme, autoSchedule, setAutoSchedule } = useTheme();

  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | undefined>(undefined);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [publicThemes, setPublicThemes] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'light' | 'dark' | 'unclassified'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'za' | 'downloads' | 'rating'>('downloads');

  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [themeComments, setThemeComments] = useState<Record<string, any[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const loadCustomThemes = async () => {
    const themes = await getCustomThemes();
    setCustomThemes(themes);
  };

  const fetchPublicThemes = async (query: string = '', mode: string, sort: string) => {
    setIsSearching(true);
    try {
      let req = supabase.from('public_themes').select('*');
      
      if (query.trim()) {
        req = req.ilike('name', `%${query.trim()}%`);
      }
      if (mode !== 'all') {
        req = req.eq('mode', mode);
      }
      
      switch (sort) {
        case 'newest': req = req.order('created_at', { ascending: false }); break;
        case 'oldest': req = req.order('created_at', { ascending: true }); break;
        case 'az': req = req.order('name', { ascending: true }); break;
        case 'za': req = req.order('name', { ascending: false }); break;
        case 'downloads': req = req.order('downloads', { ascending: false }).order('created_at', { ascending: false }); break;
        case 'rating': req = req.order('rating_sum', { ascending: false }).order('created_at', { ascending: false }); break;
      }
      
      req = req.limit(30);

      const { data, error } = await req;
      if (!error && data) {
        setPublicThemes(data.map(d => ({
          id: `public_${d.id}`,
          name: d.name,
          description: d.description,
          mode: d.mode,
          isPublic: true,
          status: 'saved',
          config: d.config,
          downloads: d.downloads,
          rating_sum: d.rating_sum,
          rating_count: d.rating_count
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    loadCustomThemes();
    fetchPublicThemes('', filterMode, sortBy);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPublicThemes(searchQuery, filterMode, sortBy);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, filterMode, sortBy]);

  const handleRateTheme = async (id: string, rating: number) => {
    const realId = id.replace('public_', '');
    const { error } = await supabase.rpc('rate_theme', { p_theme_id: realId, p_rating: rating });
    if (!error) {
      alert('Thanks for rating!');
      fetchPublicThemes(searchQuery, filterMode, sortBy);
    } else {
      alert('Please log in to rate themes.');
    }
  };

  const fetchComments = async (themeId: string) => {
    const realId = themeId.replace('public_', '');
    const { data, error } = await supabase.from('theme_comments').select('*').eq('theme_id', realId).order('created_at', { ascending: true });
    if (!error && data) {
      setThemeComments(prev => ({ ...prev, [themeId]: data }));
    }
  };

  const toggleComments = (themeId: string) => {
    setExpandedComments(prev => {
      const isExpanded = !prev[themeId];
      if (isExpanded) {
        fetchComments(themeId);
      }
      return { ...prev, [themeId]: isExpanded };
    });
  };

  const handlePostComment = async (themeId: string) => {
    const content = commentInputs[themeId]?.trim();
    if (!content) return;
    
    const realId = themeId.replace('public_', '');
    const { error } = await supabase.from('theme_comments').insert({ theme_id: realId, content });
    if (!error) {
      setCommentInputs(prev => ({ ...prev, [themeId]: '' }));
      fetchComments(themeId);
    } else {
      alert('Failed to post comment.');
    }
  };

  const handleSelectTheme = (theme: string) => {
    setTheme(theme as any);
    if (theme.startsWith('public_')) {
      supabase.rpc('increment_theme_downloads', { theme_id: theme.replace('public_', '') }).then(() => {});
    }
  };

  const handleEditCustomTheme = (t: CustomTheme) => {
    setEditingTheme(t);
    setEditorOpen(true);
  };

  const handleDeleteCustomTheme = async (id: string) => {
    if (confirm("Are you sure you want to delete this theme?")) {
      await deleteCustomTheme(id);
      if (currentTheme === id) {
        setTheme('light');
      }
      loadCustomThemes();
    }
  };

  const filteredPublicThemes = publicThemes; // Show all

  const themes = [
    { id: 'light', name: 'Light (Default)', previewBg: 'bg-white', previewBorder: 'border-gray-200' },
    { id: 'dark', name: 'Dark (Default)', previewBg: 'bg-zinc-900', previewBorder: 'border-zinc-800' },
    { id: 'mint', name: 'Mint', previewBg: 'bg-slate-50', previewBorder: 'border-teal-200' },
    { id: 'mint-dark', name: 'Olive Dusk', previewBg: 'bg-slate-900', previewBorder: 'border-teal-800' },
    { id: 'ember', name: 'Ember', previewBg: 'bg-[#141211]', previewBorder: 'border-[#352b27]' },
    { id: 'neon-noir', name: 'Neon Noir', previewBg: 'bg-[#0d0d0d]', previewBorder: 'border-[#00e5ff]' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold">Themes</h1>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">
        <p className="text-sm text-muted-foreground">
          Select a theme to customize the appearance of the application.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectTheme(t.id)}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                currentTheme === t.id ? 'border-primary bg-primary/5' : 'border-transparent bg-card hover:bg-muted/50'
              }`}
            >
              <div className={`w-full aspect-video rounded-md border ${t.previewBg} ${t.previewBorder} flex items-center justify-center relative overflow-hidden shadow-sm`}>
                <div className="absolute top-2 left-2 w-1/2 h-3 rounded-full bg-muted/50" />
                <div className="absolute top-6 right-2 w-1/2 h-3 rounded-full bg-primary/50" />
                {currentTheme === t.id && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                )}
              </div>
              <span className="text-sm font-medium">{t.name}</span>
            </button>
          ))}
        </div>

        {/* ── Theme auto-scheduling ───────────────────────────────────── */}
        <section className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Auto-Scheduling</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically switch between a light theme during the day and a dark theme at night.
          </p>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="auto-schedule" className="text-sm font-medium">Enable auto-scheduling</Label>
            <input
              id="auto-schedule"
              type="checkbox"
              checked={autoSchedule.enabled}
              onChange={e => setAutoSchedule({ ...autoSchedule, enabled: e.target.checked })}
              className="w-5 h-5 accent-primary rounded border-border bg-muted"
            />
          </div>

          {autoSchedule.enabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="light-start" className="text-xs text-muted-foreground">Light theme starts</Label>
                  <input
                    id="light-start"
                    type="time"
                    value={autoSchedule.lightStart}
                    onChange={e => setAutoSchedule({ ...autoSchedule, lightStart: e.target.value })}
                    className="w-full px-2 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dark-start" className="text-xs text-muted-foreground">Dark theme starts</Label>
                  <input
                    id="dark-start"
                    type="time"
                    value={autoSchedule.darkStart}
                    onChange={e => setAutoSchedule({ ...autoSchedule, darkStart: e.target.value })}
                    className="w-full px-2 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Day theme</Label>
                  <select
                    value={autoSchedule.lightTheme}
                    onChange={e => setAutoSchedule({ ...autoSchedule, lightTheme: e.target.value as any })}
                    className="w-full px-2 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {themes.filter(t => !['dark', 'mint-dark', 'ember', 'neon-noir'].includes(t.id)).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Night theme</Label>
                  <select
                    value={autoSchedule.darkTheme}
                    onChange={e => setAutoSchedule({ ...autoSchedule, darkTheme: e.target.value as any })}
                    className="w-full px-2 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {themes.filter(t => ['dark', 'mint-dark', 'ember', 'neon-noir'].includes(t.id)).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="pt-6 border-t border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Custom Themes
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Beta</span>
              </h2>
              <p className="text-xs text-muted-foreground">Create and share your own themes.</p>
            </div>
            <Button onClick={() => { setEditingTheme(undefined); setEditorOpen(true); }} size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>

          {customThemes.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
              No custom themes yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {customThemes.map(ct => (
                <div key={ct.id} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${currentTheme === ct.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer" onClick={() => { if (ct.status === 'saved') handleSelectTheme(ct.id); }}>
                    <div className="w-10 h-10 rounded-full border shadow-sm shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: ct.config?.backgroundColor }}>
                      {currentTheme === ct.id && <Check className="w-5 h-5 text-primary drop-shadow-md" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-2">
                        {ct.name}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ct.status === 'draft' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                          {ct.status === 'draft' ? 'Draft' : ct.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Font: {ct.config?.fontFamily}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditCustomTheme(ct); }}>
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteCustomTheme(ct.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Public Themes ───────────────────────────────────── */}
        <div className="pt-6 border-t border-border space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5" /> Public Themes
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Beta</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Discover themes created by the community.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Input 
              placeholder="Search themes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card flex-1"
            />
            <select 
              className="h-10 px-3 border border-border bg-card rounded-md text-sm"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
            >
              <option value="all">All Modes</option>
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
              <option value="unclassified">Unclassified</option>
            </select>
            <select 
              className="h-10 px-3 border border-border bg-card rounded-md text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="newest">Recently added</option>
              <option value="oldest">Oldest</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
              <option value="downloads">Most used</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-4">
            {isSearching ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Searching...
              </div>
            ) : filteredPublicThemes.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No public themes found.
              </div>
            ) : (
              filteredPublicThemes.map(pt => (
                <div key={pt.id} className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-[100px] aspect-video shrink-0 overflow-hidden rounded-md border shadow-sm relative pointer-events-none bg-muted">
                        <div className="absolute top-0 left-0 w-[260px] origin-top-left" style={{ transform: 'scale(0.3846)' }}>
                          <MockPreview
                            previewMode="desktop"
                            msgColor={pt.config?.messageBubbleColor}
                            recvColor={pt.config?.receivedBubbleColor}
                            sendColor={pt.config?.sendButtonColor}
                            bgColor={pt.config?.backgroundColor}
                            bgType={pt.config?.backgroundType}
                            font={pt.config?.fontFamily}
                            bgImage={pt.config?.backgroundImageDataUrl}
                            headerColor={pt.config?.headerColor}
                            sidebarColor={pt.config?.sidebarColor}
                            cardColor={pt.config?.cardColor}
                            inputColor={pt.config?.inputBoxColor}
                            glassmorphism={pt.config?.glassmorphism}
                            glassmorphismUi={pt.config?.glassmorphismUi}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span className="truncate">{pt.name}</span>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded capitalize">{pt.mode}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-1">
                          {pt.description || 'No description'}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{pt.downloads || 0} downloads</span>
                          <span className="flex items-center gap-0.5">
                            ⭐ {(pt.rating_count ? (pt.rating_sum / pt.rating_count).toFixed(1) : 'New')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div className="flex gap-0.5 mr-1">
                        {[1,2,3,4,5].map(star => (
                          <button key={star} onClick={() => handleRateTheme(pt.id, star)} className="text-muted-foreground hover:text-yellow-500 text-xs transition-colors">
                            ★
                          </button>
                        ))}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleComments(pt.id)}
                        className={`h-8 w-8 transition-colors ${expandedComments[pt.id] ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant={currentTheme === pt.id ? "default" : "secondary"} 
                        size="sm" 
                        onClick={() => handleSelectTheme(pt.id)}
                        className="gap-1 text-xs h-8"
                      >
                        <Check className="w-3.5 h-3.5" /> {currentTheme === pt.id ? 'Applied' : 'Apply'}
                      </Button>
                    </div>
                  </div>

                  {expandedComments[pt.id] && (
                    <div className="border-t border-border bg-muted/20 p-3 space-y-3">
                      <div className="text-xs font-medium text-muted-foreground px-1">Comments</div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto px-1">
                        {themeComments[pt.id] === undefined ? (
                          <div className="text-xs text-center py-2 text-muted-foreground">Loading...</div>
                        ) : themeComments[pt.id].length === 0 ? (
                          <div className="text-xs text-center py-2 text-muted-foreground">No comments yet. Be the first!</div>
                        ) : (
                          themeComments[pt.id].map(comment => (
                            <div key={comment.id} className="bg-background rounded-lg p-2.5 text-sm shadow-sm border border-border/50">
                              <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                              <div className="text-[9px] text-muted-foreground mt-1 text-right">
                                {new Date(comment.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Input 
                          placeholder="Add a comment (anonymous)..." 
                          value={commentInputs[pt.id] || ''}
                          onChange={e => setCommentInputs(prev => ({ ...prev, [pt.id]: e.target.value }))}
                          className="h-8 text-sm"
                          onKeyDown={e => {
                            if (e.key === 'Enter') handlePostComment(pt.id);
                          }}
                        />
                        <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handlePostComment(pt.id)}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {editorOpen && (
        <CustomThemeEditor
          open={editorOpen}
          onClose={() => { 
            setEditorOpen(false); 
            loadCustomThemes(); 
          }}
          initialTheme={editingTheme}
          onSave={() => {
            loadCustomThemes();
            fetchPublicThemes(searchQuery, filterMode, sortBy);
          }}
        />
      )}
    </div>
  );
}
