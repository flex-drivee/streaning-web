import React, { useEffect, useMemo } from "react";
import { useVideoContext } from "../layout/Layout";
import Hero from "../components/Hero";
import VideoCarousel from "../components/VideoCarousel";
import Spinner from "../components/Spinner";
import { useVideoData } from "../Contexts/VideoDataContext";

const HomePage: React.FC = () => {
  const { setActiveVideo, handlePlay } = useVideoContext();
  const { categories, loading, error } = useVideoData();

  // --- Scroll to top after categories load ---
  useEffect(() => {
    if (!loading) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [loading]);

  // --- Featured video (first of first category) ---
  const featuredVideo = useMemo(
    () => categories?.[0]?.videos?.[0] || null,
    [categories]
  );

  // --- Loading state ---
  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-neutral-900 text-white">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 text-white min-h-screen font-sans relative overflow-x-hidden">
      {/* ⚠️ Error Banner */}
      {error && (
        <div className="bg-yellow-600 text-white text-center py-3 text-sm font-medium sticky top-0 z-50">
          {error}
        </div>
      )}

      {/* 🎥 HERO SECTION */}
      {featuredVideo && (
        <section className="relative h-screen w-full overflow-hidden">
          <Hero
            video={featuredVideo}
            onPlay={handlePlay}
            onInfo={setActiveVideo}
            isBillboard
          />

          {/* smooth dark fade into carousels */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-neutral-900 to-transparent pointer-events-none" />
        </section>
      )}

      {/* 📺 CAROUSELS */}
      <main className="relative z-10 mt-20 md:mt-24 space-y-10 md:space-y-14 pb-20">
        {categories.length > 0 ? (
          categories.map((category) => (
            <VideoCarousel
              key={category.id}
              title={category.title || category.name}
              videos={category.videos}
              onPlay={handlePlay}
              onInfo={setActiveVideo}
              onExpand={setActiveVideo}
            />
          ))
        ) : !loading && !error ? (
          <div className="text-center text-neutral-400 py-12 px-4">
            No videos available at the moment.
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default HomePage;
