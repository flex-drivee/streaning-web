// src/components/SearchInput.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import type { Video } from "../types/index";
import { Icon } from "./Icon";
import VideoDetailModal from "./VideoDetailModal";
import VideoPlayerModal from "./VideoPlayerModal";
import { videoData } from "../data/videos";
import VideoCard from "./VideoCard";

interface SearchInputProps {
  onPlay: (video: Video) => void;
  headerOffset?: number; // optional header offset in px (defaults to 64)
}

const SearchInput: React.FC<SearchInputProps> = ({ onPlay, headerOffset = 64 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [results, setResults] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- LOAD VIDEOS ---------------- */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("allVideos") || "null");
      if (Array.isArray(stored) && stored.length > 0) {
        setAllVideos(stored);
        return;
      }
    } catch {
      // ignore
    }
    const flattened = (videoData || []).flatMap((c: any) => c.videos || []);
    setAllVideos(flattened);
  }, []);

  /* ---------------- FUSE.JS ---------------- */
  const fuse = useMemo(() => {
    if (!allVideos.length) return null;
    try {
      return new Fuse(allVideos, {
        keys: ["title", "genre", "description"],
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
      });
    } catch {
      return null;
    }
  }, [allVideos]);

  /* ---------------- DEBOUNCE ---------------- */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------------- SEARCH ---------------- */
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setHighlightIndex(0);
      return;
    }

    const fuseResults = fuse ? fuse.search(debouncedQuery).map((r) => r.item) : [];
    if (fuseResults.length > 0) {
      setResults(fuseResults);
      setHighlightIndex(0);
      return;
    }

    const lower = debouncedQuery.toLowerCase();
    const fallback = allVideos.filter(
      (v) =>
        (v.title || "").toLowerCase().includes(lower) ||
        (v.genre || "").toLowerCase().includes(lower) ||
        (v.description || "").toLowerCase().includes(lower)
    );

    setResults(fallback);
    setHighlightIndex(0);
  }, [debouncedQuery, fuse, allVideos]);

  /* ---------------- TRENDING ---------------- */
  const trending = useMemo(() => allVideos.slice(0, 12), [allVideos]);

  /* ---------------- OUTSIDE CLICK ---------------- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
        setActiveId(null);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  /* ---------------- HELPERS ---------------- */
  const saveToHistory = (video: Video) => {
    try {
      const list: Video[] = JSON.parse(localStorage.getItem("watchHistory") || "[]");
      const updated = [video, ...list.filter((v) => v.id !== video.id)];
      localStorage.setItem("watchHistory", JSON.stringify(updated));
    } catch {
      localStorage.setItem("watchHistory", JSON.stringify([video]));
    }
  };

  const toggleWatchLater = (video: Video) => {
    try {
      const list: Video[] = JSON.parse(localStorage.getItem("watchLater") || "[]");
      const updated = list.some((v) => v.id === video.id)
        ? list.filter((v) => v.id !== video.id)
        : [video, ...list];
      localStorage.setItem("watchLater", JSON.stringify(updated));
    } catch {
      localStorage.setItem("watchLater", JSON.stringify([video]));
    }
  };

  const handlePlay = (video: Video) => {
    saveToHistory(video);
    setPlayingVideo(video);
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setActiveId(null);
    onPlay(video);
  };

  /* ---------------- KEYBOARD NAV ---------------- */
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = results.length ? results : trending;
    if (!list.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((p) => (p + 1) % list.length);
      setActiveId(list[(highlightIndex + 1) % list.length]?.id ?? null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((p) => (p === 0 ? list.length - 1 : p - 1));
      setActiveId(list[(highlightIndex - 1 + list.length) % list.length]?.id ?? null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = list[highlightIndex];
      if (chosen) handlePlay(chosen);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      setActiveId(null);
    }
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* collapsed search icon */}
      {!isOpen ? (
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          aria-label="Open search"
          className="text-gray-300 hover:text-white transition-colors"
        >
          {/* use search-symbol for outlined magnifier */}
          <Icon name="search-symbol" className="w-6 h-6" />
        </button>
      ) : (
        <>
          {/* inline search bar (animated) */}
          <div
            className={`transform transition-all duration-300 ease-out origin-left ml-2`}
            style={{ minWidth: 0 }}
          >
            <div className="flex items-center bg-black/70 backdrop-blur-md rounded-full px-3 py-1 shadow-lg">
              <Icon name="search" className="w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search titles, genres..."
                className="bg-transparent outline-none px-2 py-1 text-sm flex-1 text-white placeholder-gray-400"
                aria-label="Search titles and genres"
              />
              <button
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                  setResults([]);
                  setActiveId(null);
                }}
                aria-label="Close search"
                className="text-gray-400 hover:text-white"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* fullscreen overlay results - pinned under header */}
          {(debouncedQuery || trending.length > 0) && (
            <div
              className="fixed inset-0 overflow-y-auto z-40"
              style={{ top: headerOffset }}
              role="dialog"
              aria-modal="true"
            >
              <div className="min-h-[calc(100vh-64px)] bg-black/95 p-6">
                {debouncedQuery ? (
                  results.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {results.map((video, idx) => (
                        <div
                          key={video.id}
                          className="relative overflow-visible" /* allow the animated card to overflow */
                          onMouseEnter={() => {
                            setActiveId(video.id);
                          }}
                          onMouseLeave={() => {
                            setActiveId((curr) => (String(curr) === String(video.id) ? null : curr));
                          }}
                        >
                          <VideoCard
                            video={video}
                            onPlay={(v) => handlePlay(v)}
                            onInfo={(v) => setActiveVideo(v)}
                            onAdd={(v) => toggleWatchLater(v)}
                            onExpand={(v) => setActiveVideo(v)}
                            isActive={activeId != null && String(activeId) === String(video.id)}
                            onRequestActivate={(id) => setActiveId(id)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-400">No results found</div>
                  )
                ) : (
                  <>
                    <div className="px-3 py-2 text-xs uppercase text-gray-500">Trending</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {trending.map((video) => (
                        <div
                          key={video.id}
                          className="relative overflow-visible"
                          onMouseEnter={() => setActiveId(video.id)}
                          onMouseLeave={() => setActiveId((curr) => (String(curr) === String(video.id) ? null : curr))}
                        >
                          <VideoCard
                            video={video}
                            onPlay={(v) => handlePlay(v)}
                            onInfo={(v) => setActiveVideo(v)}
                            onAdd={(v) => toggleWatchLater(v)}
                            onExpand={(v) => setActiveVideo(v)}
                            isActive={activeId != null && String(activeId) === String(video.id)}
                            onRequestActivate={(id) => setActiveId(id)}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {activeVideo && (
        <VideoDetailModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
          onPlay={(v) => {
            setActiveVideo(null);
            handlePlay(v);
          }}
        />
      )}

      {/* Player Modal */}
      {playingVideo && (
        <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </div>
  );
};

export default SearchInput;
