import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import VideoCarousel from "../components/VideoCarousel";
import VideoDetailModal from "../components/VideoDetailModal";
import VideoPlayerModal from "../components/VideoPlayerModal";
import { useVideoData } from "../Contexts/VideoDataContext";
import Spinner from "../components/Spinner";
import type { Video } from "../types";

interface OutletContext {
  setActiveVideo: (video: Video | null) => void;
  handlePlay: (video: Video) => void;
}

const MoviesPage: React.FC = () => {
  const { setActiveVideo, handlePlay } = useOutletContext<OutletContext>();
  const { categories, loading, error } = useVideoData();
  const [activeId, setActiveId] = useState<number | string | null>(null);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <Spinner />
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen text-red-500 bg-neutral-900">
        {error}
      </div>
    );

  const movieCategories = categories.filter((c) => c.categoryType === "movie");

  return (
    <div className="space-y-12 px-6 py-12 bg-neutral-900 text-white min-h-screen">
      <h1 className="text-3xl md:text-5xl font-bold mb-8">Movies</h1>

      {movieCategories.map((category) => (
        <VideoCarousel
          key={category.id}
          title={category.name}
          videos={category.videos}
          onPlay={handlePlay}
          onInfo={(v) => setActiveVideo(v)}
          onExpand={(v) => setActiveVideo(v)}
        />
      ))}
    </div>
  );
};

export default MoviesPage;
