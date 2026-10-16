"use client";

import { useEffect, useRef, useState } from "react";

export function createLiveList<T>() {
  let rows: T[] = [];
  let ready = false;
  const listeners = new Set<() => void>();

  function publish(next: T[]) {
    rows = next;
    ready = true;
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function useLiveList(initial: T[], available: boolean) {
    const initialRef = useRef(initial);
    const [current, setCurrent] = useState(initial);
    useEffect(() => {
      if (!ready && available) publish(initialRef.current);
      const sync = () => setCurrent(rows);
      const unsubscribe = subscribe(sync);
      if (ready) sync();
      return unsubscribe;
    }, [available]);
    return [current, publish] as const;
  }

  return {
    publish,
    subscribe,
    useLiveList,
    isReady: () => ready,
    snapshot: () => rows,
  };
}
