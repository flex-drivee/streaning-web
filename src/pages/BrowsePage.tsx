import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import Hero from "../components/Hero";
import VideoCarousel from "../components/VideoCarousel";
import { videoData } from "../data/videos";
import type { Video } from "../types";

interface OutletContext {
  setActiveVideo: (video: Video | null) => void;
  handlePlay: (video: Video) => void;
}

const BrowsePage: React.FC = () => {
  const { setActiveVideo, handlePlay } = useOutletContext<OutletContext>();
  const [activeId, setActiveId] = useState<number | string | null>(null);

  return (
    <div className="space-y-12">
      {/* HERO */}
      {videoData.length > 0 && videoData[0].videos.length > 0 && (
        <Hero
          video={videoData[0].videos[0]}
          onPlay={handlePlay}
          onInfo={(v) => setActiveVideo(v)}
        />
      )}

      {/* CAROUSELS */}
      {videoData.map((category, i) => (
        <VideoCarousel
          key={category.id || i}
          title={category.name}
          videos={category.videos}
          onPlay={handlePlay}
          onInfo={(v) => setActiveVideo(v)}
          activeId={activeId}
          setActiveId={setActiveId}
          onExpand={(v) => setActiveVideo(v)}
        />
      ))}
    </div>
  );
};

export default BrowsePage;
