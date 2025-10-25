import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import type { Video } from "../types";
import { useVideoData } from "../Contexts/VideoDataContext";

// Memoize Icon for slight performance improvement
const MemoIcon = React.memo(Icon);

interface VideoCardProps {
  video: Video;
  onPlay: (video: Video) => void;
  onExpand?: (video: Video) => void;
  onRemove?: (video: Video) => void; // Updated signature
  onInfo?: (video: Video) => void;
  isFirst?: boolean;
  isLast?: boolean;
  tabbable?: boolean;
}

export default function VideoCard({
  video,
  onPlay,
  onExpand,
  onRemove,
  onInfo,
  isFirst,
  isLast,
  tabbable,
}: VideoCardProps) {
  const {
    isInWatchLater,
    isLiked,
    toggleWatchLater,
    toggleLiked,
    saveToHistory,
  } = useVideoData();

  const [isHovered, setIsHovered] = useState(false);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const placeholderRef = useRef<HTMLDivElement>(null);
  const innerPortalRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

// --- HIDE PORTAL ON SCROLL (stable + no rebinds) ---
const handleScroll = useCallback(() => {
  if (!isHovered) return; // Only close if hovered
  if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
  if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  setIsHovered(false);
}, [isHovered]);

useEffect(() => {
  document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
  return () => document.removeEventListener("scroll", handleScroll, { capture: true });
}, [handleScroll]);

// --- CLOSE PORTAL WITH ESCAPE KEY ---
useEffect(() => {
  if (!isHovered) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsHovered(false);
      placeholderRef.current?.focus(); // return focus to card
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [isHovered]);


// --- POSITION PORTAL LOGIC (no flicker + stable identity) ---
const positionPortal = useCallback(() => {
  if (!placeholderRef.current || !innerPortalRef.current) return;

  const placeholderRect = placeholderRef.current.getBoundingClientRect();
  const popupHeight = innerPortalRef.current.offsetHeight;
  let finalTop = placeholderRect.top;

  const vh = window.innerHeight;
  const estimatedTranslateYPercent = -0.20;
  const estimatedTranslateY = popupHeight * estimatedTranslateYPercent;
  const finalVisualTop = placeholderRect.top + estimatedTranslateY;
  const finalVisualBottom = finalVisualTop + popupHeight;

  // Flip upward if popup overflows viewport bottom
  if (finalVisualBottom > vh && placeholderRect.top > vh - placeholderRect.bottom) {
    finalTop = placeholderRect.bottom - popupHeight;
  }

  setPortalStyle({
    position: "fixed",
    top: finalTop,
    left: placeholderRect.left,
    width: placeholderRect.width,
     zIndex: "var(--z-hover-card)" as unknown as number, // ✅ new
  });
}, []); // ✅ no dependencies → stable function identity

   // Determine transform origin based on position
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const updateTransformOrigin = useCallback(() => {
    const rect = placeholderRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { left, right, width } = rect;
    const vw = window.innerWidth;
    let originX = "center";
    // Close to left edge → anchor left
    if (left < vw * 0.1) originX = "left";
    // Close to right edge → anchor right
    else if (right > vw * 0.9) originX = "right";
    setTransformOrigin(`${originX} top`);
  }, []);
 
  useLayoutEffect(() => {
    if (!isHovered) return;
    updateTransformOrigin();

    let frameId: number | null = null;
    let resizeTimeout: number | null = null;

    const updatePosition = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        updateTransformOrigin?.();
        positionPortal();
      });
    };
    // Initial position after a short delay (lets layout settle)
    resizeTimeout = window.setTimeout(updatePosition, 40);
    // Debounced resize handler
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(updatePosition, 100);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, [isHovered, positionPortal, updateTransformOrigin]);

  // --- Handlers for hover/focus state and portal trigger ---
  const showHover = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  
    if (!showTimeoutRef.current) {
      showTimeoutRef.current = window.setTimeout(() => {
        setIsHovered(true);
        showTimeoutRef.current = null;
      }, 350); // delay before popup shows
    }
  }, []);
  
  const hideHover = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  
    if (!hideTimeoutRef.current) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsHovered(false);
        hideTimeoutRef.current = null;
      }, 150); // small fade-out delay
    }
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    showHover();
  }, [showHover]);
  
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && innerPortalRef.current?.contains(relatedTarget)) return;
    hideHover();
  }, [hideHover]);
  

const handleBlur = useCallback(() => hideHover(), [hideHover]);

  
  // --- CLICK/EXPAND HANDLER ---
  const handleExpandAndClose = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setIsHovered(false);
    onExpand?.(video);
  }, [onExpand, video]);


  // Handlers for buttons inside the portal
  const handlePortalAction = useCallback((e: React.MouseEvent, action: () => void) => {
      e.stopPropagation();
      action();
    },[]);

  const handlePlay = useCallback((e: React.MouseEvent) => handlePortalAction(e, () => {
    onPlay(video);
    saveToHistory(video);
  }), [handlePortalAction, onPlay, video, saveToHistory]);

  const handleToggleWatchLater = useCallback((e: React.MouseEvent) => handlePortalAction(e, () => {
    toggleWatchLater(video);
  }), [handlePortalAction, toggleWatchLater, video]);

  const handleToggleLiked = useCallback((e: React.MouseEvent) => handlePortalAction(e, () => {
    toggleLiked(video);
  }), [handlePortalAction, toggleLiked, video]);

  const handleInfo = useCallback((e: React.MouseEvent) => handlePortalAction(e, () => {
    onInfo ? onInfo(video) : handleExpandAndClose();
  }), [handlePortalAction, onInfo, handleExpandAndClose]);

  const handleRemove = useCallback((e: React.MouseEvent) => handlePortalAction(e, () => {
    onRemove?.(video);
  }), [handlePortalAction, onRemove, video]);

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleExpandAndClose();
    }
  }, [handleExpandAndClose]);

  // --- CLEANUP TIMEOUTS ON UNMOUNT ---
useEffect(() => {
  return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);
  
  
  return (
    <>
      <div
        ref={placeholderRef}
        className="flex-shrink-0 w-full aspect-video relative cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleBlur}
        onClick={handleExpandAndClose}
        onKeyDown={handleCardKeyDown}
        tabIndex={tabbable ? 0 : -1}
        role="button"
        aria-expanded={isHovered}
        aria-label={video.title}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-neutral-800 rounded-lg flex items-center justify-center pointer-events-none">
            <Icon name="play" className="w-10 h-10 text-neutral-600" />
          </div>
        )}
      </div>
      {createPortal(
        <div
          style={portalStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleExpandAndClose}
        >
          <AnimatePresence mode="wait">
            {isHovered && (
              <motion.div
                ref={innerPortalRef}
                key="video-popup"
                className={`
                  bg-neutral-900 rounded-lg flex flex-col cursor-pointer
                  shadow-[0_10px_25px_rgba(0,0,0,0.75)]
                  ${transformOrigin} pointer-events-auto z-[60]
                `}
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{
                  opacity: 1,
                  scale: 1.48,
                  y: 0,
                  transition: {
                    type: "spring",
                    stiffness: 230,
                    damping: 25,
                    ease: [0.25, 0.1, 0.25, 1], // smooth cubic-bezier ease-in-out
                    delay: 0.18, // Slight delay for Netflix-like hover response
                    duration: 0.42,
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.9,
                  y: 6,
                  transition: {
                    delay: 0.06, // prevents flicker if user re-enters quickly
                    duration: 0.25,
                    ease: [0.45, 0, 0.2, 1],
                  },
                }}
              style={{ transformOrigin: transformOrigin === 'origin-left' ? 'left center' :
                                    transformOrigin === 'origin-right' ? 'right center' :
                                    'center center' }}
              >
                {/* === THUMBNAIL SECTION === */}
                <div className="relative w-full aspect-video">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover rounded-t-lg"
                      onLoad={() => setTimeout(positionPortal, 0)}
                      onError={() => setTimeout(positionPortal, 0)}
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 rounded-t-lg flex items-center justify-center">
                      <Icon name="play" className="w-8 h-8 text-neutral-600" />
                    </div>
                  )}
                </div>
                
                {/* === DETAILS SECTION === */}
                <div className="p-2 md:p-3 space-y-1 md:space-y-2 text-xs relative">
                  {/* --- Top control buttons --- */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 md:space-x-2">
                      <button
                        onClick={handlePlay}
                        className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-white rounded-full text-black hover:bg-neutral-300 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                        aria-label={`Play ${video.title}`}
                      >
                        <MemoIcon name="play" className="w-4 h-4 md:w-5 md:h-5 ml-0.5" />
                      </button>
                
                      <button
                        onClick={handleToggleWatchLater}
                        className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 border-2 border-neutral-500 rounded-full text-white hover:border-white transition-colors bg-black/30 focus-visible:ring-2 focus-visible:ring-white"
                        aria-pressed={isInWatchLater(video.id)}
                        aria-label={isInWatchLater(video.id) ? "Remove from list" : "Add to list"}
                      >
                        <MemoIcon
                          name={isInWatchLater(video.id) ? "check" : "plus"}
                          className="w-4 h-4 md:w-5 md:h-5"
                        />
                      </button>
                
                      <button
                        onClick={handleToggleLiked}
                        className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 border-2 border-neutral-500 rounded-full text-white hover:border-white transition-colors bg-black/30 focus-visible:ring-2 focus-visible:ring-white"
                        aria-pressed={isLiked(video.id)}
                        aria-label={isLiked(video.id) ? "Unlike video" : "Like video"}
                      >
                        <MemoIcon
                          name={isLiked(video.id) ? "heart" : "like"}
                          className={`w-4 h-4 md:w-5 md:h-5 ${
                            isLiked(video.id) ? "text-pink-500" : ""
                          }`}
                        />
                      </button>
                    </div>
                        
                    <button
                      onClick={handleInfo}
                      className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 border-2 border-neutral-500 rounded-full text-white hover:border-white transition-colors bg-black/30 focus-visible:ring-2 focus-visible:ring-white"
                      aria-label={`More info for ${video.title}`}
                    >
                      <MemoIcon name="chevron-down" className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                        
                  {/* --- Meta info (match %, duration, etc.) --- */}
                  <div className="flex items-center space-x-2 text-neutral-300 text-xs pt-1">
                    {video.match && <span className="font-bold text-green-400">{video.match}% Match</span>}
                    {video.maturityRating && (
                      <span className="border border-neutral-400 px-1 text-neutral-400 text-[10px] leading-tight">
                        {video.maturityRating}
                      </span>
                    )}
                    {video.duration && <span>{video.duration}</span>}
                    {video.seasons && <span>{video.seasons}</span>}
                    {video.isHD && (
                      <span className="border border-neutral-400 px-1 text-neutral-400 text-[10px] leading-tight">
                        HD
                      </span>
                    )}
                  </div>
                  
                  {/* --- Genre list --- */}
                  {video.genre && (
                    <div className="flex flex-wrap items-center text-xs text-neutral-200">
                      {Array.isArray(video.genre)
                        ? video.genre.map((g, index) => (
                            <React.Fragment key={g}>
                              <span className="whitespace-nowrap">{g}</span>
                              {index < (video.genre?.length ?? 0) - 1 && (
                                <span className="mx-1.5 text-[8px]">&#9679;</span>
                              )}
                            </React.Fragment>
                          ))
                        : <span>{video.genre}</span>}
                    </div>
                  )}

                  {/* --- Remove button (if applicable) --- */}
                  {onRemove && (
                    <button
                      onClick={handleRemove}
                      className="absolute top-1 right-1 flex items-center justify-center w-6 h-6 rounded-full border border-neutral-500 hover:border-red-500 hover:bg-red-900/50 transition-colors bg-black/50 focus-visible:ring-2 focus-visible:ring-white"
                      aria-label={`Remove ${video.title}`}
                    >
                      <MemoIcon name="trash" className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </>
  );
}