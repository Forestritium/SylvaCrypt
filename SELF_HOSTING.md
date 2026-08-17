# Self-Hosting SylvaCrypt

SylvaCrypt is designed to be fully self-hostable with a Supabase backend and a Vite+React frontend.

## Prerequisites

- Node.js (v18+)
- pnpm or npm
- A Supabase project (cloud or self-hosted)

## Setting up Supabase

1. Create a new project in Supabase.
2. Go to the SQL Editor and execute all the migration files in the `supabase/migrations` folder in sequential order:
   - `00000...`
   - `...`
3. Enable Email/Password authentication in Authentication > Providers.
4. (Optional) Set up Google OAuth if you want to support SSO.
5. Create a Storage Bucket named `chat-images` and make sure it's public.

## Environment Variables

Create a `.env` file in the root of the project with your Supabase keys:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Running the Application

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Build for production:
   ```bash
   pnpm build
   ```

## Key Management and Security

SylvaCrypt uses standard Web Crypto API for end-to-end encryption.
- The **vault key** encrypts local IndexedDB and contact metadata in Supabase. It is derived from the user's password using **Argon2id** (KDF v1+, memory-hard). The legacy v0 path used PBKDF2-SHA256 and is retained solely for backward-compatible vault migration; all new accounts use Argon2id.
- The **Double Ratchet** protocol is used for secure messaging and typing indicators.
- Private keys NEVER leave the device.

When self-hosting, ensure you serve the app over HTTPS, as the Web Crypto API requires a secure context to function.