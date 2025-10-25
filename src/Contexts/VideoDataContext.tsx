import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import type { Category, Video } from "../types";
import { videoData as localVideoData } from "../data/videos";

type VideoCache = Record<string, Video[]>;

export interface VideoDataContextType {
  categories: Category[];
  loading: boolean;
  error: string | null;
  ensureCategoryLoaded: (categoryId: string) => Promise<Video[]>;
  getCategoryVideos: (categoryId: string) => Video[] | undefined;
  getVideoById: (id: string) => Video | undefined;
  getVideoMetadata: (id: string) => Partial<Video> | undefined;
  watchLater: Record<string, Video>;
  liked: Record<string, Video>;
  watchHistory: Video[];
  toggleWatchLater: (video: Video) => void;
  toggleLiked: (video: Video) => void;
  saveToHistory: (video: Video) => void;
  isInWatchLater: (id: string) => boolean;
  isLiked: (id: string) => boolean;
}

const API_URL = "http://localhost:4000/categories"; // This will fail gracefully
const DEV = import.meta.env.MODE === 'development';
const CACHE_TTL = 10 * 60 * 1000;

const VideoDataContext = createContext<VideoDataContextType | undefined>(undefined);

export const VideoDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<VideoCache>({});
  const cacheTimeRef = useRef<Record<string, number>>({});
  const indexRef = useRef<Record<string, Video>>({});
  const inflightRef = useRef<Record<string, Promise<Video[]> | undefined>>({});
  const metaCacheRef = useRef<Record<string, Partial<Video>>>({});

  const [watchLater, setWatchLater] = useState<Record<string, Video>>({});
  const [liked, setLiked] = useState<Record<string, Video>>({});
  const [watchHistory, setWatchHistory] = useState<Video[]>([]);

  // ---------- Hydrate from localStorage ----------
  useEffect(() => {
    const hydrate = <T,>(key: string, fallback: T): T => {
      try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      } catch {
        return fallback;
      }
    };
    setWatchLater(hydrate("watchLater", {}));
    setLiked(hydrate("liked", {}));
    setWatchHistory(hydrate("watchHistory", []));
  }, []);

  const persist = useCallback((key: string, data: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      if (DEV) console.warn(`[VideoDataContext] Failed to persist ${key}`);
    }
  }, []);

  // ---------- Initial category load ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(res.statusText);
        const data: Category[] = await res.json();
        if (cancelled) return;

        const normalized = data.map((c) => ({
          ...c,
          videos: Array.isArray(c.videos) ? c.videos : [],
        }));

        normalized.forEach((cat) => {
          cacheRef.current[cat.id] = cat.videos;
          cacheTimeRef.current[cat.id] = Date.now();
          cat.videos.forEach((v) => {
            indexRef.current[v.id] = v;
            const { description, ...meta } = v;
            metaCacheRef.current[v.id] = meta;
          });
        });

        setCategories(normalized);
      } catch (err) {
        if (DEV) console.warn("[VideoDataContext] API failed, using fallback:", err);
        localVideoData.forEach((cat) => {
          cacheRef.current[cat.id] = cat.videos || [];
          cacheTimeRef.current[cat.id] = Date.now();
          cat.videos?.forEach((v) => {
            indexRef.current[v.id] = v;
            const { description, ...meta } = v;
            metaCacheRef.current[v.id] = meta;
          });
        });
        setCategories(localVideoData);
        setError("API unavailable — using local fallback data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Lazy-load categories ----------
  const ensureCategoryLoaded = useCallback(async (categoryId: string): Promise<Video[]> => {
    const cached = cacheRef.current[categoryId];
    const cachedTime = cacheTimeRef.current[categoryId];

    if (cached && cachedTime && Date.now() - cachedTime < CACHE_TTL)
      return cached;

    if (inflightRef.current[categoryId]) return inflightRef.current[categoryId]!;

    const fetchPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/${categoryId}`);
        if (!res.ok) throw new Error("Failed category fetch");
        const cat: Category = await res.json();
        const vids = Array.isArray(cat.videos) ? cat.videos : [];

        cacheRef.current[categoryId] = vids;
        cacheTimeRef.current[categoryId] = Date.now();
        vids.forEach((v) => {
          indexRef.current[v.id] = v;
          const { description, ...meta } = v;
          metaCacheRef.current[v.id] = meta;
        });
        return vids;
      } catch {
        const fallback = localVideoData.find((c) => String(c.id) === String(categoryId));
        const vids = fallback?.videos || [];
        cacheRef.current[categoryId] = vids;
        cacheTimeRef.current[categoryId] = Date.now();
        vids.forEach((v) => {
          indexRef.current[v.id] = v;
          const { description, ...meta } = v;
          metaCacheRef.current[v.id] = meta;
        });
        return vids;
      } finally {
        delete inflightRef.current[categoryId];
      }
    })();

    inflightRef.current[categoryId] = fetchPromise;
    return fetchPromise;
  }, []);

  // ---------- Stable getters ----------
  const getCategoryVideos = useCallback(
    (categoryId: string) => cacheRef.current[categoryId],
    []
  );

  const getVideoById = useCallback((id: string) => indexRef.current[id], []);

  const getVideoMetadata = useCallback(
    (id: string) => metaCacheRef.current[id],
    []
  );

  // ---------- Mutators ----------
  const toggleWatchLater = useCallback(
    (video: Video) => {
      setWatchLater((prev) => {
        const updated = { ...prev };
        updated[video.id] ? delete updated[video.id] : (updated[video.id] = video);
        persist("watchLater", updated);
        return updated;
      });
    },
    [persist]
  );

  const toggleLiked = useCallback(
    (video: Video) => {
      setLiked((prev) => {
        const updated = { ...prev };
        updated[video.id] ? delete updated[video.id] : (updated[video.id] = video);
        persist("liked", updated);
        return updated;
      });
    },
    [persist]
  );

  const saveToHistory = useCallback(
    (video: Video) => {
      setWatchHistory((prev) => {
        const updated = [video, ...prev.filter((v) => v.id !== video.id)];
        const sliced = updated.slice(0, 50);
        persist("watchHistory", sliced);
        return sliced;
      });
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      categories,
      loading,
      error,
      ensureCategoryLoaded,
      getCategoryVideos,
      getVideoById,
      getVideoMetadata,
      watchLater,
      liked,
      watchHistory,
      toggleWatchLater,
      toggleLiked,
      saveToHistory,
      isInWatchLater: (id: string) => !!watchLater[id],
      isLiked: (id: string) => !!liked[id],
    }),
    [
      categories,
      loading,
      error,
      watchLater,
      liked,
      watchHistory,
      ensureCategoryLoaded,
      getCategoryVideos,
      getVideoById,
      getVideoMetadata,
      toggleWatchLater,
      toggleLiked,
      saveToHistory,
    ]
  );

  return <VideoDataContext.Provider value={value}>{children}</VideoDataContext.Provider>;
};

export const useVideoData = () => {
  const ctx = useContext(VideoDataContext);
  if (!ctx) throw new Error("useVideoData must be used within VideoDataProvider");
  return ctx;
};