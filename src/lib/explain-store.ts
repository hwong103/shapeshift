"use client";

/**
 * Shared on/off state for the pipeline explainer.
 *
 * The toggle lives in SiteChrome's cluster (a server component) while the panel
 * lives in Shapeshift (a client component), so they can't meet through props.
 * A tiny external store keeps `?explain=1` as the source of truth: the URL still
 * wins on load and stays shareable, and the toggle just rewrites it.
 */

const KEY = "explain";
const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(KEY) === "1";
}

let snapshot = read();

function write(next: boolean) {
  const url = new URL(window.location.href);
  if (next) url.searchParams.set(KEY, "1");
  else url.searchParams.delete(KEY);
  window.history.replaceState(null, "", url);
  snapshot = next;
  for (const fn of listeners) fn();
}

export const explainStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => snapshot,
  toggle: () => write(!snapshot),
  /** Call once on mount so back/forward navigation is reflected. */
  sync() {
    const next = read();
    if (next === snapshot) return;
    snapshot = next;
    for (const fn of listeners) fn();
  },
};
