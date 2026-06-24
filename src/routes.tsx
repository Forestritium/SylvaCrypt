export interface RouteConfig {
  name: string;
  path: string;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Auth',           path: '/auth',     public: true  },
  { name: 'Chat',           path: '/chat',     public: false },
  { name: 'Settings',       path: '/settings', public: false },
  { name: 'Privacy Policy', path: '/privacy',  public: true  },
];
