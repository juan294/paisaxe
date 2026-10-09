import { buildSync } from 'esbuild';

export interface PresentationAuthClient {
  login(email: string, password: string): Promise<{ userId: string | null; error: string | null }>;
}

declare global {
  interface Window {
    __presentationAuthClient: PresentationAuthClient;
    __presentationRegion?: Element | null;
  }
}

/** Installed SDK, bundled in memory. This is a local password-login transport
 * probe, not a product password form or an external Google OAuth journey. */
export function presentationAuthClientSource(url: string, anonKey: string): string {
  const result = buildSync({
    stdin: {
      contents: `import { createBrowserClient } from '@supabase/ssr';
        const client = createBrowserClient(${JSON.stringify(url)}, ${JSON.stringify(anonKey)}, {
          isSingleton: false, auth: { autoRefreshToken: false, detectSessionInUrl: false }
        });
        window.__presentationAuthClient = {
          async login(email, password) {
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            return { userId: data.user?.id ?? null, error: error?.code ?? (error ? 'login_failed' : null) };
          }
        };`,
      resolveDir: process.cwd(),
      sourcefile: 'local-presentation-auth-client.js',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}
