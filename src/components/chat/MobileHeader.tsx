import { useNavigate } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import logoUrl from '@/assets/logo.svg';

interface MobileHeaderProps {
  username: string;
  pendingCount?: number;
  unreadCount?: number;
  avatarUrl?: string | null;
  onLogout: () => void;
  onOpenSidebar?: () => void;
}

export function MobileHeader({ username, pendingCount = 0, avatarUrl, onOpenSidebar }: MobileHeaderProps) {
  const navigate = useNavigate();
  const isLegacySidebar = typeof window !== 'undefined' ? localStorage.getItem('sc_legacy_sidebar') === '1' : false;

  return (
    <header className="shrink-0 md:hidden bg-card border-b border-border flex items-center justify-between px-4 h-14">
      {isLegacySidebar && onOpenSidebar ? (
        <button
          onClick={onOpenSidebar}
          className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors relative"
        >
          <Menu className="w-5 h-5" />
          {(pendingCount > 0) && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border border-card" />
          )}
        </button>
      ) : (
        /* Spacer to replace hamburger when using modern side tab */
        <div className="w-9 h-9" />
      )}

      {/* Brand */}
      <div 
        className="flex items-center gap-2 cursor-pointer select-none" 
        onClick={() => navigate('/chat')}
      >
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
          <img src={logoUrl} alt="SylvaCrypt" className="w-5 h-5 object-contain" />
        </div>
        <span className="text-sm font-semibold text-foreground">SylvaCrypt</span>
      </div>

      {/* Username */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-[90px]">
          {pendingCount > 0 && <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
          <span className="truncate"><span className="text-primary/70">@</span>{username}</span>
        </div>
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="w-7 h-7 rounded-full object-cover shrink-0 border border-border bg-muted" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0 uppercase">
            {username.slice(0, 2)}
          </div>
        )}
      </div>
    </header>
  );
}
