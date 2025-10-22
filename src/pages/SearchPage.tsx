// src/pages/SearchPage.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Video } from "../types/index";
import VideoPlayerModal from "../components/VideoPlayerModal";
import VideoCard from "../components/VideoCard";
import { Icon } from "../components/Icon";

// 🔥 Fetch videos (fallback from localStorage collections)
const fetchAllVideos = async (): Promise<Video[]> => {
  const all = JSON.parse(localStorage.getItem("allVideos") || "[]");

  if (all.length > 0) return all;

  // fallback if allVideos is empty
  const later = JSON.parse(localStorage.getItem("watchLater") || "[]");
  const liked = JSON.parse(localStorage.getItem("likedVideos") || "[]");
  const history = JSON.parse(localStorage.getItem("watchHistory") || "[]");

  // merge unique
  const merged = [...later, ...liked, ...history].reduce(
    (acc: Video[], v: Video) => {
      if (!acc.find((x) => x.id === v.id)) acc.push(v);
      return acc;
    },
    []
  );
  return merged;
};

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [filtered, setFiltered] = useState<Video[]>([]);

  // 🎬 Modals
  const [activeVideo, setActiveVideo] = useState<Video | null>(null); // for player
  const [expandedVideo, setExpandedVideo] = useState<Video | null>(null); // for details

  // Load videos
  useEffect(() => {
    fetchAllVideos().then(setAllVideos);
  }, []);

  // Sync URL -> state (but only when user navigates)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);
  }, [searchParams]);

  // Filter results
  useEffect(() => {
    if (!query.trim()) {
      setFiltered([]);
      return;
    }
    const lower = query.toLowerCase();
    const results = allVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(lower) ||
        (v.genre && v.genre.toLowerCase().includes(lower))
    );
    setFiltered(results);
  }, [query, allVideos]);

  // Handle typing (replace → prevents back button spam)
  const handleChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setSearchParams({ q: value.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const clearSearch = () => {
    setQuery("");
    setFiltered([]);
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-gray-900 text-white px-6 py-24">
      {/* Search bar */}
      <div className="max-w-3xl mx-auto mb-10 relative">
        <input
          type="text"
          placeholder="Search for movies, TV shows, genres..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-4 py-3 text-lg rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 pr-10"
          autoFocus
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            aria-label="Clear search"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results */}
      {query && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">
            Search Results for: <span className="text-red-500">"{query}"</span>
          </h2>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {filtered.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onPlay={(v) => setActiveVideo(v)}
                  onExpand={(v) => setExpandedVideo(v)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No results found.</p>
          )}
        </div>
      )}

      {!query && (
        <p className="text-gray-400 text-center">
          Start typing to search your favorite titles.
        </p>
      )}

      {/* 🎬 Video Player Modal */}
      {activeVideo && (
        <VideoPlayerModal

          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}

      {/* ℹ️ Expanded Detail Modal */}
      {expandedVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setExpandedVideo(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <Icon name="close" className="w-6 h-6" />
            </button>
            <VideoCard
              video={expandedVideo}
              onPlay={(v) => setActiveVideo(v)}
              onExpand={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
