import { getInitialPresentation } from '@/lib/request-presentation';
import { Providers } from './providers';

export async function RequestPresentationProviderShell({ children }: { children: React.ReactNode }) {
  const initialPresentation = await getInitialPresentation();
  return <Providers initialPresentation={initialPresentation}>{children}</Providers>;
}
