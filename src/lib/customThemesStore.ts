import { openDB } from 'idb';

const DB_NAME = 'sc_custom_themes_db';
const DB_VERSION = 1;
const STORE_NAME = 'themes';

export type CustomTheme = {
  id: string;
  name: string;
  description?: string;
  mode?: 'light' | 'dark' | 'unclassified';
  isPublic: boolean;
  status: 'draft' | 'saved';
  config: {
    messageBubbleColor: string;
    receivedBubbleColor?: string;
    sendButtonColor: string;
    backgroundColor: string;
    fontFamily: string;
    backgroundImageDataUrl?: string;
    backgroundType?: 'color' | 'image';
    headerColor?: string;
    sidebarColor?: string;
    cardColor?: string;
    inputBoxColor?: string;
    glassmorphism?: boolean;
    glassmorphismUi?: boolean;
  };
};

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveCustomTheme(theme: CustomTheme) {
  const db = await getDB();
  await db.put(STORE_NAME, theme);
}

export async function getCustomThemes(): Promise<CustomTheme[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function getCustomTheme(id: string): Promise<CustomTheme | undefined> {
  const db = await getDB();
  let theme = await db.get(STORE_NAME, id);
  if (!theme && id.startsWith('public_')) {
    try {
      const { supabase } = await import('@/db/supabase');
      const realId = id.replace('public_', '');
      const { data } = await supabase.from('public_themes').select('*').eq('id', realId).single();
      if (data) {
        theme = {
          id: `public_${data.id}`,
          name: data.name,
          description: data.description,
          mode: data.mode,
          isPublic: true,
          status: 'saved',
          config: data.config
        };
        await db.put(STORE_NAME, theme);
      }
    } catch (e) {
      console.error('Failed to fetch public theme:', e);
    }
  }
  return theme;
}

export async function deleteCustomTheme(id: string) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
