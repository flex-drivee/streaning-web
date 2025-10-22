// src/components/VideoCard.tsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import type { Video } from "../types";
import { useVideoData } from "../Contexts/VideoDataContext";

/* -------------------------------------------------------------------------- */
/*                                  INTERFACES                                */
/* -------------------------------------------------------------------------- */

interface VideoCardProps {
  video: Video & {
    year?: number;
    trailerUrl?: string;
    description?: string;
    duration?: string;
    rating?: string;
    genre?: string;
  };
  onPlay: (video: Video) => void;
  onExpand?: (video: Video) => void;
  onRemove?: (id: number | string) => void;
  onInfo?: (video: Video) => void;
  onAdd?: (video: Video) => void;
  hoverPreview?: boolean;
  isActive?: boolean;
  onRequestActivate?: (id: number | string | null) => void;
}

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

/* -------------------------------------------------------------------------- */
/*                               EXPANDED STATE                               */
/* -------------------------------------------------------------------------- */

function useExpandedState(
  touch: boolean,
  hoverPreview: boolean | undefined,
  isActive?: boolean,
  onRequestActivate?: (id: number | string | null) => void,
  videoId?: number | string
) {
  const [hover, setHover] = useState(false);
  const [touchExpanded, setTouchExpanded] = useState(false);

  const expanded =
    typeof isActive === "boolean"
      ? isActive
      : touch
      ? touchExpanded
      : hover;

  const hoverTimeout = useRef<number | null>(null);

  const handleEnter = useCallback(() => {
    if (touch) return;
    hoverTimeout.current = window.setTimeout(() => {
      onRequestActivate ? onRequestActivate(videoId ?? null) : setHover(true);
    }, 400);
  }, [touch, onRequestActivate, videoId]);

  const handleLeave = useCallback(() => {
    if (touch) return;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    onRequestActivate ? onRequestActivate(null) : setHover(false);
    setTouchExpanded(false);
  }, [touch, onRequestActivate]);

  const handleClick = useCallback(
    (e: React.MouseEvent, onExpand?: (v: Video) => void, video?: Video) => {
      e.stopPropagation();
      if (touch) {
        if (!touchExpanded) {
          onRequestActivate?.(videoId ?? null);
          setTouchExpanded(true);
        } else if (onExpand && video) onExpand(video);
      } else if (onExpand && video) onExpand(video);
    },
    [touch, touchExpanded, onRequestActivate, videoId]
  );

  return { expanded, handleEnter, handleLeave, handleClick };
}

/* -------------------------------------------------------------------------- */
/*                                PREVIEW STATE                               */
/* -------------------------------------------------------------------------- */

function usePreviewState(
  expanded: boolean,
  trailerUrl?: string,
  hoverPreview?: boolean
) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canPreview = !isTouchDevice() && hoverPreview && !!trailerUrl;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (expanded && canPreview) {
      timer.current = window.setTimeout(() => setIsPreviewing(true), 800);
    } else {
      if (timer.current) clearTimeout(timer.current);
      setIsPreviewing(false);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [expanded, canPreview]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPreviewing && el.paused) el.play().catch(() => {});
    else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isPreviewing]);

  return { isPreviewing, videoRef };
}

/* -------------------------------------------------------------------------- */
/*                               VIDEO CARD MAIN                              */
/* -------------------------------------------------------------------------- */

export default function VideoCard({
  video,
  onPlay,
  onExpand,
  onRemove,
  onInfo,
  onAdd,
  hoverPreview = true,
  isActive,
  onRequestActivate,
}: VideoCardProps) {
  const touch = isTouchDevice();
  const {
    isInWatchLater,
    isLiked,
    toggleWatchLater,
    toggleLiked,
    getVideoMetadata,
    saveToHistory,
  } = useVideoData();

  const { expanded, handleEnter, handleLeave, handleClick } = useExpandedState(
    touch,
    hoverPreview,
    isActive,
    onRequestActivate,
    video.id
  );

  const { isPreviewing, videoRef } = usePreviewState(
    expanded,
    video.trailerUrl,
    hoverPreview
  );

  const metadata = useMemo(() => getVideoMetadata(video.id), [video.id]);

  /* ------------------------------ EVENT HANDLERS ------------------------------ */
  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPlay(video);
      saveToHistory(video);
    },
    [onPlay, video, saveToHistory]
  );

  const handleToggleWatchLater = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleWatchLater(video);
    },
    [toggleWatchLater, video]
  );

  const handleToggleLiked = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleLiked(video);
    },
    [toggleLiked, video]
  );

  const handleInfo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onInfo ? onInfo(video) : onExpand?.(video);
    },
    [onInfo, onExpand, video]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.(video.id);
    },
    [onRemove, video.id]
  );

  /* ------------------------------ RENDER SECTION ------------------------------ */
  return (
    <motion.div
      className="relative flex-shrink-0 cursor-pointer rounded-xl bg-gray-900 video-card"
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onClick={(e) => handleClick(e, onExpand, video)}
      tabIndex={0}
      style={{
        transformOrigin: "center center",
        position: "relative",
      }}
      animate={
        expanded
          ? {
              position: "absolute",
              zIndex: 50,
              scale: 1.5,
              x: "-25%",
              y: -40,
              boxShadow: "0 12px 40px rgba(0,0,0,0.9)",
            }
          : {
              zIndex: 10,
              scale: 1,
              x: "0%",
              y: 0,
              boxShadow: "none",
              transitionEnd: {
                position: "relative",
              },
            }
      }
      transition={{ type: "spring", stiffness: 260, damping: 26, mass: 1 }}
    >
      {/* --- Thumbnail or Trailer Preview --- */}
      {!isPreviewing ? (
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-24 sm:h-32 md:h-40 object-cover bg-black rounded-t-xl"
          loading="lazy"
        />
      ) : (
        <video
          ref={videoRef}
          src={video.trailerUrl}
          poster={video.thumbnailUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-32 sm:h-40 md:h-48 object-cover bg-black rounded-t-xl"
        />
      )}

      {/* --- Expanded Info Section --- */}
      {expanded && (
        <motion.div
          className="bg-gray-900 p-3 rounded-b-xl shadow-2xl"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          <div className="relative">
            <h4 className="text-sm md:text-lg font-bold text-white truncate">
              {video.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
              {video.year && <span>{video.year}</span>}
              {video.duration && <span>{video.duration}</span>}
              {video.rating && (
                <span className="px-1.5 py-0.5 bg-gray-700 rounded text-white text-[10px]">
                  {video.rating}
                </span>
              )}
            </div>
            {video.genre && (
              <div className="text-xs text-gray-400 mt-1">{video.genre}</div>
            )}
            {video.description && (
              <p className="hidden sm:block text-xs text-gray-300 line-clamp-3 mt-2">
                {video.description}
              </p>
            )}

            {/* --- Action Buttons --- */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handlePlay}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                aria-label="Play video"
              >
                <Icon name="play" className="w-4 h-4" /> Play
              </button>

              <button
                onClick={handleToggleWatchLater}
                className={`p-1.5 rounded-full transition-colors ${
                  isInWatchLater(video.id)
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-800/70 hover:bg-gray-700"
                } text-white`}
                aria-pressed={isInWatchLater(video.id)}
                aria-label="Add to watch later"
              >
                <Icon
                  name={isInWatchLater(video.id) ? "check" : "plus"}
                  className="w-4 h-4"
                />
              </button>

              <button
                onClick={handleToggleLiked}
                className={`p-1.5 rounded-full transition-colors ${
                  isLiked(video.id)
                    ? "bg-pink-600 hover:bg-pink-700"
                    : "bg-gray-800/70 hover:bg-gray-700"
                } text-white`}
                aria-pressed={isLiked(video.id)}
                aria-label="Like video"
              >
                <Icon
                  name={isLiked(video.id) ? "heart" : "like"}
                  className="w-4 h-4"
                />
              </button>

              <button
                onClick={handleInfo}
                className="bg-gray-800/70 hover:bg-gray-700 text-white p-1.5 rounded-full transition-colors"
                aria-label="More info"
              >
                <Icon name="info" className="w-4 h-4" />
              </button>

              {onRemove && (
                <button
                  onClick={handleRemove}
                  className="bg-gray-800/70 hover:bg-red-600 text-white p-1.5 rounded-full transition-colors"
                  aria-label="Remove video"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}