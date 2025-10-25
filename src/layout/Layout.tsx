import React, { useState, useEffect } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import VideoDetailModal from "../components/VideoDetailModal";
import VideoPlayerModal from "../components/VideoPlayerModal";
import type { Video } from "../types";

// Context shape shared with routed pages
export type VideoContextType = {
  setActiveVideo: (video: Video | null) => void;
  handlePlay: (video: Video) => void;
};

// ✅ Typed hook for children (HomePage, etc.)
export function useVideoContext() {
  return useOutletContext<VideoContextType>();
}

const Layout: React.FC = () => {
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);

  // --- Play handler ---
  const handlePlay = (video: Video) => {
    setActiveVideo(null); // Close detail modal before playing
    setPlayingVideo(video);
  };

  // --- Disable body scroll when modal is open ---
  useEffect(() => {
    const hasModal = Boolean(activeVideo || playingVideo);
    document.body.style.overflow = hasModal ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [activeVideo, playingVideo]);

  return (
    <div className="relative min-h-screen text-white bg-neutral-900">
      {/* 🔹 Global Header */}
      <Header onPlay={handlePlay} />

      {/* 🔹 Routed content */}
      <main className="relative z-0">
        <Outlet context={{ setActiveVideo, handlePlay }} />
      </main>
      <AnimatePresence>
        {/* 🔹 Detail Modal */}
        {activeVideo && (
          <VideoDetailModal
            video={activeVideo}
            key="detail-modal"
            onClose={() => setActiveVideo(null)}
            onPlay={handlePlay}
          />
        )}

        {/* 🔹 Player Modal */}
        {playingVideo && (
          <VideoPlayerModal
            video={playingVideo}
            key="player-modal"
            onClose={() => setPlayingVideo(null)}
          />
        )}
        </AnimatePresence>
    </div>
  );
};

export default Layout;
