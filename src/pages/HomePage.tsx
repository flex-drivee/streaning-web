import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import Hero from "../components/Hero";
import VideoCarousel from "../components/VideoCarousel";
import VideoPlayerModal from "../components/VideoPlayerModal";
import VideoDetailModal from "../components/VideoDetailModal";
import { useVideoData } from "../Contexts/VideoDataContext";
import type { Video } from "../types";
import { AnimatePresence } from "framer-motion";
import Spinner from "../components/Spinner";

interface OutletContext {
  setActiveVideo: (video: Video | null) => void;
  handlePlay: (video: Video) => void;
}

const HomePage: React.FC = () => {
  const { setActiveVideo, handlePlay } = useOutletContext<OutletContext>();
  const { categories, loading, error } = useVideoData();

  const [detailVideo, setDetailVideo] = useState<Video | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [activeId, setActiveId] = useState<number | string | null>(null);

  // Disable body scroll when modals are open
  useEffect(() => {
    document.body.style.overflow = playingVideo || detailVideo ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [playingVideo, detailVideo]);

  // --- Memoized Callbacks to Prevent Unnecessary Re-renders ---
  const handlePlayVideo = useCallback((video: Video) => {
    setPlayingVideo(video);
  }, []);

  const handleShowDetail = useCallback((video: Video) => {
    setDetailVideo(video);
  }, []);

  // --- Loading State ---
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <Spinner />
      </div>
    );

  const featuredVideo = categories[0]?.videos?.[0];

  return (
    <div className="bg-neutral-900 text-white min-h-screen font-sans relative">
      {/* ⚠️ Inline Warning Message */}
      {error && (
        <div className="bg-yellow-600 text-white text-center py-3 text-sm font-medium">
          {error}
        </div>
      )}

      {/* HERO SECTION */}
      {featuredVideo && (
        <section className="relative h-screen w-full overflow-hidden">
          <Hero
            video={featuredVideo}
            onPlay={handlePlayVideo}
            onInfo={handleShowDetail}
            isBillboard
          />
        </section>
      )}

      {/* MAIN CONTENT */}
      <main className="relative z-10 mt-12 md:mt-20 space-y-12">
        {categories.length > 0 ? (
          categories.map((category) => (
            <VideoCarousel
              key={category.id}
              title={category.title || category.name}
              videos={category.videos}
              onPlay={handlePlayVideo}
              onInfo={handleShowDetail}
              activeId={activeId}
              setActiveId={setActiveId}
              onExpand={handleShowDetail}
            />
          ))
        ) : (
          <div className="text-center text-gray-400 py-12">
            No videos available.
          </div>
        )}
      </main>

      {/* MODALS */}
      <AnimatePresence>
        {detailVideo && (
          <VideoDetailModal
            key={detailVideo.id}
            video={detailVideo}
            onClose={() => setDetailVideo(null)}
            onPlay={(v) => {
              setDetailVideo(null);
              setPlayingVideo(v);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playingVideo && (
          <VideoPlayerModal
            key={playingVideo.id}
            video={playingVideo}
            onClose={() => setPlayingVideo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomePage;
