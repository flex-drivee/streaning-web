// src/pages/MyListPage.tsx
import React, { useEffect, useState } from "react";
import VideoCarousel from "../components/VideoCarousel";
import type { Video } from "../types/index";
import VideoDetailModal from "../components/VideoDetailModal";
import VideoPlayerModal from "../components/VideoPlayerModal";

const MyListPage: React.FC = () => {
  const [watchHistory, setWatchHistory] = useState<Video[]>([]);
  const [watchLater, setWatchLater] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [activeId, setActiveId] = useState<number | string | null>(null);

  useEffect(() => {
    const history = localStorage.getItem("watchHistory");
    const later = localStorage.getItem("watchLater");
    if (history) setWatchHistory(JSON.parse(history));
    if (later) setWatchLater(JSON.parse(later));
  }, []);

  const saveList = (key: string, list: Video[]) => {
    localStorage.setItem(key, JSON.stringify(list));
  };

  const handleRemove = (key: "watchHistory" | "watchLater", videoId: string | number) => {
    if (key === "watchHistory") {
      const updated = watchHistory.filter((v) => v.id !== videoId);
      setWatchHistory(updated);
      saveList("watchHistory", updated);
    } else {
      const updated = watchLater.filter((v) => v.id !== videoId);
      setWatchLater(updated);
      saveList("watchLater", updated);
    }
  };

  const handlePlay = (video: Video) => {
    const updated = [video, ...watchHistory.filter((v) => v.id !== video.id)];
    setWatchHistory(updated);
    saveList("watchHistory", updated);
    setPlayingVideo(video);
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <h1 className="text-3xl md:text-5xl font-bold mb-8">My List</h1>

      {watchHistory.length > 0 && (
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Watch History</h2>
            <button
              onClick={() => {
                setWatchHistory([]);
                saveList("watchHistory", []);
              }}
              className="text-sm text-red-500 hover:text-red-400"
            >
              Clear History
            </button>
          </div>
          <VideoCarousel
            title="History"
            videos={watchHistory}
            onPlay={handlePlay}
            onRemove={(id) => handleRemove("watchHistory", id)}
            activeId={activeId}
            setActiveId={setActiveId}
            onExpand={(v) => setActiveVideo(v)}
          />
        </div>
      )}

      {watchLater.length > 0 && (
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Watch Later</h2>
            <button
              onClick={() => {
                setWatchLater([]);
                saveList("watchLater", []);
              }}
              className="text-sm text-red-500 hover:text-red-400"
            >
              Clear Watch Later
            </button>
          </div>
          <VideoCarousel
            title="Watch Later"
            videos={watchLater}
            onPlay={handlePlay}
            onRemove={(id) => handleRemove("watchLater", id)}
            activeId={activeId}
            setActiveId={setActiveId}
            onExpand={(v) => setActiveVideo(v)}
          />
        </div>
      )}

      {watchHistory.length === 0 && watchLater.length === 0 && (
        <p className="text-gray-400">No videos in your list yet.</p>
      )}

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

      {playingVideo && (
        <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </div>
  );
};

export default MyListPage;
