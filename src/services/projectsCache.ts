/**
 * Shared in-memory Projects Cache for AI DevFlow Intelligence Suite.
 *
 * Solves the 5-8 second loading delay when switching between pages.
 * - Provides synchronous access to cached projects for instant initial rendering.
 * - Deduplicates concurrent in-flight requests.
 * - Implements Stale-While-Revalidate (SWR) so views render immediately while refreshing in the background.
 */
import type { Project } from "../types";

let cachedProjects: Project[] | null = null;
let lastFetchedTime = 0;
let inFlightPromise: Promise<Project[]> | null = null;

// Fresh TTL: 45 seconds (no background refresh needed if called within this time)
const FRESH_TTL_MS = 45_000;
// Max Stale TTL: 2 minutes (can serve stale while refreshing in background)
const STALE_TTL_MS = 120_000;

const listeners = new Set<(projects: Project[]) => void>();

/**
 * Returns currently cached projects synchronously.
 * Returns null if cache is empty.
 */
export function getCachedProjects(): Project[] | null {
  return cachedProjects;
}

/**
 * Subscribes to background cache updates.
 */
export function subscribeProjectsCache(callback: (projects: Project[]) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(projects: Project[]) {
  listeners.forEach((listener) => {
    try {
      listener(projects);
    } catch (e) {
      console.error("[ProjectsCache] listener error:", e);
    }
  });
}

/**
 * Fetches projects with smart deduplication and caching.
 * @param fetchFn The network fetcher function.
 * @param forceRefresh Force a network roundtrip ignoring fresh cache.
 */
export async function fetchProjectsWithCache(
  fetchFn: () => Promise<Project[]>,
  forceRefresh = false
): Promise<Project[]> {
  const now = Date.now();
  const isFresh = cachedProjects !== null && (now - lastFetchedTime) < FRESH_TTL_MS;
  const isStale = cachedProjects !== null && (now - lastFetchedTime) < STALE_TTL_MS;

  // 1. If fresh and not forcing refresh, return immediately
  if (!forceRefresh && isFresh && cachedProjects) {
    return cachedProjects;
  }

  // 2. If a request is already in-flight, return the existing promise
  if (inFlightPromise) {
    // If we have stale data and are not forcing refresh, return stale data immediately
    // while the in-flight promise resolves in the background
    if (!forceRefresh && cachedProjects && isStale) {
      return cachedProjects;
    }
    return inFlightPromise;
  }

  // 3. Initiate fetch with deduplication
  inFlightPromise = (async () => {
    try {
      const data = await fetchFn();
      cachedProjects = data;
      lastFetchedTime = Date.now();
      notifyListeners(data);
      return data;
    } finally {
      inFlightPromise = null;
    }
  })();

  // 4. Stale-While-Revalidate: Return existing stale cache immediately if available,
  // allowing the UI to render in 0ms while data refreshes in the background.
  if (!forceRefresh && cachedProjects && isStale) {
    return cachedProjects;
  }

  return inFlightPromise;
}

/**
 * Invalidate cache on mutations (create, update, delete).
 */
export function invalidateProjectsCache(): void {
  cachedProjects = null;
  lastFetchedTime = 0;
  inFlightPromise = null;
}

/**
 * Optimistically update or patch a single project in the cache.
 */
export function updateCachedProject(project: Partial<Project> & { id: string }): void {
  if (!cachedProjects) return;
  cachedProjects = cachedProjects.map((p) =>
    p.id === project.id ? ({ ...p, ...project } as Project) : p
  );
  notifyListeners(cachedProjects);
}
