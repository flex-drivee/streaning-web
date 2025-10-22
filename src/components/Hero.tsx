import React, { useEffect, useState } from "react";
import type { Video } from "../types";
import { Icon } from "./Icon";
import { useLocalization } from "../Contexts/LocalizationContext";

interface HeroProps {
  video: Video;
  onPlay: (video: Video) => void;
  onInfo?: (v: Video) => void;
  isBillboard?: boolean;
}

const SCROLL_DIVISOR = 400; // how fast parallax reacts to scroll
const TRANSLATE_FACTOR = 30; // max Y translation in px
const SCALE_FACTOR = 0.02; // slight scale increase when scrolling
const ZOOM_INTERVAL = 8000; // how often zoom toggles (ms)

const Hero: React.FC<HeroProps> = ({ video, onPlay, onInfo, isBillboard = false }) => {
  const { t } = useLocalization();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [zoom, setZoom] = useState(Math.random() > 0.5); // random start zoom state

  // --- Scroll-based parallax + fade ---
  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(window.scrollY / SCROLL_DIVISOR, 1);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // --- Subtle auto zoom in/out ---
  useEffect(() => {
    if (!isBillboard) return;
    const interval = setInterval(() => setZoom((z) => !z), ZOOM_INTERVAL);
    return () => clearInterval(interval);
  }, [isBillboard]);

  const heroHeight = isBillboard ? "h-[90vh]" : "h-[70vh]";
  const zoomClass = zoom ? "scale-[1.05]" : "scale-[1.0]";

  return (
    <section
      aria-label={`Featured video: ${video.title}`}
      className="relative w-full overflow-hidden mb-8 md:mb-16" // ✅ margin fixes overlap
    >
      {/* --- Background + Parallax Motion --- */}
      <div
        className={`relative ${heroHeight} w-full overflow-hidden transition-transform duration-[6000ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${zoomClass}`}
        style={{
          transform: `translateY(${scrollProgress * TRANSLATE_FACTOR}px) scale(${
            1 + scrollProgress * SCALE_FACTOR
          })`,
          opacity: 1 - scrollProgress * 0.25,
        }}
      >
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover object-top select-none"
          loading="eager"
          fetchPriority="high"
        />
        {/* ✅ Bottom fade gradient for depth */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-neutral-900 to-transparent" />
      </div>

      {/* --- Title, Description, Buttons --- */}
      <div
        className="absolute bottom-16 left-6 md:left-14 max-w-xl z-20 transition-transform duration-500"
        style={{
          transform: `translateY(${scrollProgress * -10}px)`,
          opacity: 1 - scrollProgress * 0.4,
        }}
      >
        <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white drop-shadow-[2px_2px_8px_rgba(0,0,0,1)]">
          {video.title}
        </h1>

        {video.description && (
          <p className="hidden md:block text-sm md:text-base text-white mb-6 line-clamp-3 drop-shadow-[1px_1px_6px_rgba(0,0,0,1)]">
            {video.description}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => onPlay(video)}
            aria-label={`Play ${video.title}`}
            className="flex items-center bg-white hover:bg-slate-400 text-black px-5 py-2 rounded-md font-semibold transition-colors duration-200"
          >
            <Icon name="play" className="w-10 h-8 mr-2" />
            {t("play")}
          </button>

          {onInfo && (
            <button
              onClick={() => onInfo(video)}
              aria-label={`More info about ${video.title}`}
              className="flex items-center bg-gray-800/60 hover:bg-gray-700 px-4 py-2 rounded-md text-white transition"
            >
              <Icon name="info" className="w-10 h-8 mr-2" />
              {t("more Info")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
