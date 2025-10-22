import React, { useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import Header from "../components/Header";
import VideoDetailModal from "../components/VideoDetailModal";
import VideoPlayerModal from "../components/VideoPlayerModal";
import type { Video } from "../types";

type VideoContextType = {
  setActiveVideo: (video: Video | null) => void;
  handlePlay: (video: Video) => void;
  activeId: string | number | null;
  setActiveId: (id: string | number | null) => void;
};

// ✅ Typed context hook for child routes
export function useVideoContext() {
  return useOutletContext<VideoContextType>();
}

const Layout: React.FC = () => {
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [activeId, setActiveId] = useState<string | number | null>(null);

  const handlePlay = (video: Video) => {
    setPlayingVideo(video);
  };

  return (
    <div className="relative min-h-screen text-white bg-neutral-800/70">
      <Header onPlay={handlePlay} />

      {/* ✅ GPU hint for smoother transitions */}
      <main className="relative z-0">
        <Outlet
          context={{
            setActiveVideo,
            handlePlay,
            activeId,
            setActiveId,
          }}
        />
      </main>

      {activeVideo && (
        <VideoDetailModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
          onPlay={handlePlay}
        />
      )}

      {playingVideo && (
        <VideoPlayerModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}
    </div>
  );
};

export default Layout;
