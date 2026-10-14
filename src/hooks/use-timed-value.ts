"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A replaceable notice and its lifetime; async callers can validate ownership. */
export function useTimedValue<T>(durationMs: number, scope?: unknown) {
  const [state, setState] = useState<{ value: T; scope: unknown } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);
  const currentScope = useRef(scope);
  currentScope.current = scope;

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    revision.current++;
    cancelTimer();
    if (mounted.current) setState(null);
  }, [cancelTimer]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clear();
    };
  }, [clear]);

  useEffect(() => { clear(); }, [scope, clear]);

  const show = useCallback((value: T) => {
    if (!mounted.current) return;
    cancelTimer();
    const version = ++revision.current;
    const owner = currentScope.current;
    setState({ value, scope: owner });
    timer.current = setTimeout(() => {
      if (!mounted.current || revision.current !== version || !Object.is(currentScope.current, owner)) return;
      timer.current = null;
      revision.current++;
      setState(null);
    }, durationMs);
  }, [durationMs, cancelTimer]);

  const startIntent = useCallback(() => {
    clear();
    const version = revision.current;
    const owner = currentScope.current;
    return () => mounted.current && revision.current === version && Object.is(currentScope.current, owner);
  }, [clear]);

  // Scope changes suppress the old value during render, before effect cleanup.
  const value = state && Object.is(state.scope, scope) ? state.value : null;
  return { value, show, clear, startIntent };
}
