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
      className="relative cursor-pointer rounded-md bg-gray-900 overflow-hidden"
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
              zIndex: 999,
              scale: 1.4,
              x: "-20%",
              y: -20,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
              },
            }
          : {
              zIndex: 1,
              scale: 1,
              x: "0%",
              y: 0,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
              },
              transitionEnd: {
                position: "relative",
              },
            }
      }
    >
      {/* --- Thumbnail or Trailer Preview --- */}
      <div className="relative w-full aspect-video">
        {!isPreviewing ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
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
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* --- Expanded Info Section (Netflix Style) --- */}
      {expanded && (
        <motion.div
          className="bg-gray-900 p-3 shadow-2xl"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="space-y-2">
            {/* Title */}
            <h4 className="text-sm md:text-base font-bold text-white line-clamp-1">
              {video.title}
            </h4>

            {/* Metadata Row */}
            <div className="flex items-center gap-2 text-xs text-gray-300">
              {video.year && <span className="text-green-400 font-semibold">{video.year}</span>}
              {video.duration && <span>{video.duration}</span>}
              {video.rating && (
                <span className="px-1 py-0.5 border border-gray-500 text-[10px]">
                  {video.rating}
                </span>
              )}
            </div>

            {/* Genre */}
            {video.genre && (
              <div className="text-xs text-gray-400">{video.genre}</div>
            )}

            {/* Description */}
            {video.description && (
              <p className="text-xs text-gray-300 line-clamp-2">
                {video.description}
              </p>
            )}

            {/* --- Action Buttons (Netflix Style) --- */}
            <div className="flex items-center gap-2 pt-1">
              {/* Play Button */}
              <button
                onClick={handlePlay}
                className="flex items-center justify-center gap-1 bg-white hover:bg-gray-200 text-black font-semibold text-xs px-4 py-1.5 rounded transition-colors"
                aria-label="Play video"
              >
                <Icon name="play" className="w-3 h-3" />
                <span>Play</span>
              </button>

              {/* Add to Watch Later */}
              <button
                onClick={handleToggleWatchLater}
                className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-colors ${
                  isInWatchLater(video.id)
                    ? "bg-gray-700 border-gray-600"
                    : "bg-gray-800/80 border-gray-600 hover:border-gray-400"
                }`}
                aria-pressed={isInWatchLater(video.id)}
                aria-label="Add to watch later"
              >
                <Icon
                  name={isInWatchLater(video.id) ? "check" : "plus"}
                  className="w-3.5 h-3.5 text-white"
                />
              </button>

              {/* Like Button */}
              <button
                onClick={handleToggleLiked}
                className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-colors ${
                  isLiked(video.id)
                    ? "bg-gray-700 border-gray-600"
                    : "bg-gray-800/80 border-gray-600 hover:border-gray-400"
                }`}
                aria-pressed={isLiked(video.id)}
                aria-label="Like video"
              >
                <Icon
                  name={isLiked(video.id) ? "heart" : "like"}
                  className="w-3.5 h-3.5 text-white"
                />
              </button>

              {/* More Info Button */}
              <button
                onClick={handleInfo}
                className="ml-auto flex items-center justify-center w-7 h-7 rounded-full border-2 bg-gray-800/80 border-gray-600 hover:border-gray-400 transition-colors"
                aria-label="More info"
              >
                <Icon name="info" className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Remove Button (if applicable) */}
              {onRemove && (
                <button
                  onClick={handleRemove}
                  className="flex items-center justify-center w-7 h-7 rounded-full border-2 bg-gray-800/80 border-gray-600 hover:border-red-600 hover:bg-red-600/20 transition-colors"
                  aria-label="Remove video"
                >
                  <Icon name="trash" className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}