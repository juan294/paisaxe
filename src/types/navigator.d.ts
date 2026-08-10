/**
 * Ambient augmentation for the non-standard iOS Safari `Navigator.standalone`
 * property (#531). iOS exposes this boolean to indicate the page is running as
 * an installed home-screen web app. It is not part of the standard lib.dom.d.ts,
 * so we declare it here to avoid `(navigator as any).standalone` casts.
 */
interface Navigator {
  /** iOS Safari only: true when the page runs as a standalone home-screen app. */
  readonly standalone?: boolean;
}
