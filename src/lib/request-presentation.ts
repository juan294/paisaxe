import 'server-only';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';
import { mapSupabaseUser } from '@/types/auth';
import type { InitialPresentation } from '@/types/presentation';
import { LOCALE_COOKIE, resolveRequestLocale } from './i18n/preference';
import { loadDictionary } from './i18n/dictionaries';
import { es } from './i18n/es';

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Presentation timeout')); }, 1500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Called only by the server shell beneath root Suspense; never publicly cached. */
export async function getInitialPresentation(): Promise<InitialPresentation> {
  // Request access precedes deadline timers, so build-time postponement remains
  // owned by Next rather than being mistaken for a failed live request.
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const choice = resolveRequestLocale(cookieStore.get(LOCALE_COOKIE)?.value, requestHeaders.get('accept-language'));
  const resource = bounded(() => loadDictionary(choice.locale)).then(dictionary => ({ dictionary, dictionaryLocale: choice.locale, languageError: false }))
    .catch(() => ({ dictionary: es, dictionaryLocale: 'es' as const, languageError: true }));
  const identity = (async () => {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    if (!url || !key?.startsWith('eyJ')) return { user: null, authError: false };
    try {
      const prefix = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
      if (!cookieStore.getAll().some(c => c.name === prefix || c.name.startsWith(prefix + '.'))) return { user: null, authError: false };
      const user = await bounded(async signal => {
        const client = createServerClient(url, key, {
          cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
          global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal }) },
        });
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        return mapSupabaseUser(data.user);
      });
      return { user, authError: false };
    } catch {
      return { user: null, authError: true };
    }
  })();
  return { locale: choice.locale, localeSource: choice.source, ...await resource, ...await identity };
}
