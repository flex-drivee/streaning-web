import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
} from "react";
import { useLocalization } from "../Contexts/LocalizationContext";
import VideoCard from "./VideoCard"; 
import { useVideoData } from "../Contexts/VideoDataContext";
import type { Video } from "../types";
import { Icon } from "./Icon";

interface VideoCarouselProps {
  title?: string;
  category?: string;
  categoryId?: string;
  videos?: Video[];
  onPlay: (video: Video) => void;
  onSeeAll?: (titleOrCategory: string) => void;
  onInfo?: (video: Video) => void;
  onExpand?: (video: Video) => void;
  onRemove?: (video: Video) => void; // Corrected signature
}

// Debounce helper
const debounce = <T extends (...args: any[]) => void>(fn: T, delay = 80) => {
    let t: number | undefined;
    return (...args: Parameters<T>) => {
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => fn(...args), delay);
    };
};

// Memoized Placeholder
const LazyCardPlaceholder: React.FC<{ className?: string }> = memo(({ className = "" }) => (
  <div className={`${className} bg-neutral-800 rounded-lg animate-pulse`} />
));
const MemoPlaceholder = React.memo(LazyCardPlaceholder);


const VideoCarousel: React.FC<VideoCarouselProps> = ({
  title,
  category,
  categoryId,
  videos: initialVideos,
  onPlay,
  onSeeAll,
  onExpand,
  onRemove,
  onInfo,
}) => {
  const { t } = useLocalization();
  const { getCategoryVideos, ensureCategoryLoaded } = useVideoData();

  const displayTitle = (title || category || "").trim();
  const titleKey = displayTitle
    ? displayTitle.toLowerCase().replace(/ & /g, "_").replace(/ /g, "_")
    : "";

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [videos, setVideos] = useState<Video[] | undefined>(initialVideos ?? (categoryId ? getCategoryVideos(categoryId) : undefined));
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0); // For keyboard navigation
  const loadingRef = useRef(false);

  // --- Initialize videos or prepare lazy-load ---
  useEffect(() => {
    // If videos are passed directly, use them.
    if (initialVideos) {
      setVideos(initialVideos);
    } 
    // Otherwise, if we have a category ID, try getting from cache first.
    else if (categoryId) {
      const cachedVideos = getCategoryVideos(categoryId);
      setVideos(cachedVideos); // Will be undefined if not in cache
    }
  }, [initialVideos, categoryId, getCategoryVideos]);

  // --- Lazy-load when visible ---
  useEffect(() => {
     if (!categoryId || videos) return; // Don't lazy-load if we have videos
     const el = carouselRef.current;
     if (!el) return;
     let cancelled = false;
     let obs: IntersectionObserver | null = null;
     const cb: IntersectionObserverCallback = (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !loadingRef.current && !videos) {
          loadingRef.current = true;
          ensureCategoryLoaded(categoryId)
            .then((fetched) => {
              if (!cancelled) setVideos(fetched || []);
            })
            .catch((err) => {
              console.error("Category lazy-load failed:", err);
              if (!cancelled) setVideos([]);
            })
            .finally(() => {
              loadingRef.current = false;
              if (obs) {
                obs.disconnect();
                obs = null;
              }
            });
        }
      };
     obs = new IntersectionObserver(cb, { rootMargin: "0px 0px 200px 0px", threshold: 0.01 });
     obs.observe(el);
     return () => {
       cancelled = true;
       if (obs) obs.disconnect();
     };
  }, [categoryId, videos, ensureCategoryLoaded]);


  // --- Scroll controls ---
  const checkScrollPosition = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
  }, []);

  const checkScrollPositionDebounced = useRef(debounce(checkScrollPosition, 80)).current;

  useEffect(() => {
     const el = carouselRef.current;
     if (!el) return;
     el.addEventListener("scroll", checkScrollPositionDebounced, { passive: true });
     window.addEventListener("resize", checkScrollPositionDebounced);
     const id = window.setTimeout(checkScrollPosition, 40); // Initial check after mount
     return () => {
       window.clearTimeout(id);
       el.removeEventListener("scroll", checkScrollPositionDebounced);
       window.removeEventListener("resize", checkScrollPositionDebounced);
     };
  }, [videos, checkScrollPositionDebounced, checkScrollPosition]);

  // --- Keyboard Navigation (prevent auto-focus on first load) ---
  const firstLoadRef = useRef(true);
  const hasUserInteractedRef = useRef(false);
  
  useEffect(() => {
    // If this is the very first render, skip it
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
  
    // If user hasn't interacted yet (e.g., just landed), skip auto focus/scroll
    if (!hasUserInteractedRef.current) return;
  
    const activeCard = carouselRef.current?.children[activeIndex] as HTMLElement | undefined;
    if (!activeCard) return;
  
    const focusableElement = activeCard.querySelector<HTMLElement>('[tabindex="0"]');
    if (focusableElement) {
      focusableElement.focus();
      focusableElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);
  
  // --- Detect when user actually starts using keyboard navigation ---
  useEffect(() => {
    const handleUserInteraction = () => {
      hasUserInteractedRef.current = true;
    };
    window.addEventListener("keydown", handleUserInteraction, { once: true });
    return () => window.removeEventListener("keydown", handleUserInteraction);
  }, []);
  

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!videos?.length) return;

    let nextIndex = activeIndex;
    switch (e.key) {
      case "ArrowRight":
        nextIndex = Math.min(videos.length - 1, activeIndex + 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(0, activeIndex - 1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = videos.length - 1;
        break;
      default:
        return; // Don't prevent default for other keys
    }

    if (nextIndex !== activeIndex) {
      e.preventDefault();
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, videos]);


  // --- Calculate dynamic scroll amount ---
  const scrollAmount = useCallback(() => {
     const el = carouselRef.current;
     if (!el) return 400;
     const first = el.querySelector(".video-card-placeholder") as HTMLElement | null;
     const cardWidth = first?.clientWidth ?? 200; // Fallback
     const gap = 5; // Match gap-[0.3rem] -> ~5px
     const visible = Math.max(1, Math.floor(el.clientWidth / (cardWidth + gap)));
     const count = visible > 1 ? visible - 1 : 1;
     return Math.round((cardWidth + gap) * count);
  }, []);

  // --- Loading skeleton ---
  if (categoryId && typeof videos === "undefined") {
    return (
      <div className="mb-8 md:mb-12 relative">
        <div className="px-4 md:px-10 lg:px-16 mb-3 md:mb-4">
          <h3 className="text-base md:text-xl font-semibold text-neutral-200">
            {titleKey ? t(titleKey) || displayTitle : displayTitle}
          </h3>
        </div>
        <div className="relative">
          <div className="flex gap-[0.3rem] overflow-x-hidden px-4 md:px-10 lg:px-16 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <MemoPlaceholder
                key={i}
                className="flex-shrink-0 w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6 aspect-video rounded-lg"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (!videos || videos.length === 0) return null;

  // --- Render Carousel ---
  return (
    <div className="mb-8 md:mb-12 relative group" role="region" aria-label={displayTitle}>
      <div className="flex justify-between items-center px-4 md:px-10 lg:px-16 mb-3 md:mb-4">
        <h3 className="text-base md:text-xl font-semibold text-neutral-100 hover:text-white transition-colors duration-200">
          {titleKey ? t(titleKey) || displayTitle : displayTitle}
        </h3>
        {onSeeAll && displayTitle && (
          <button
            onClick={() => onSeeAll(displayTitle)}
            className="text-xs md:text-sm text-neutral-400 hover:text-white transition-colors duration-200 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            {t("see_all") || "See All"}
            <span className="ml-1">&#8250;</span>
          </button>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => carouselRef.current?.scrollBy({ left: -scrollAmount(), behavior: "smooth" })}
          className={`absolute top-0 bottom-0 left-0 w-10 md:w-16 bg-gradient-to-r from-black/70 via-black/50 to-transparent z-30
                     flex items-center justify-center text-white transition-opacity duration-300
                     opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-default`}
          aria-label="Scroll Left"
          disabled={!canScrollLeft}
          tabIndex={-1}
        >
          <Icon name="chevron-left" className="w-6 h-6 md:w-8 md:h-8" />
        </button>

        <div
          ref={carouselRef}
          className="flex gap-[0.3rem] overflow-x-auto overflow-y-visible scrollbar-hide scroll-smooth touch-pan-x px-4 md:px-10 lg:px-16 py-2"
          onScroll={checkScrollPositionDebounced}
          style={{ scrollPadding: '0 5%' }}
          onKeyDown={handleKeyDown}
          role="list"
        >
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="flex-shrink-0 w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6 relative aspect-video video-card-placeholder"
              role="listitem"
            >
              <VideoCard
                video={video}
                onPlay={onPlay}
                onExpand={onExpand}
                onRemove={onRemove}
                onInfo={onInfo}
                isFirst={index === 0}
                isLast={index === videos.length - 1}
                tabbable={index === activeIndex}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => carouselRef.current?.scrollBy({ left: scrollAmount(), behavior: "smooth" })}
           className={`absolute top-0 bottom-0 right-0 w-10 md:w-16 bg-gradient-to-l from-black/70 via-black/50 to-transparent z-30
                      flex items-center justify-center text-white transition-opacity duration-300
                      opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-default`}
          aria-label="Scroll Right"
          disabled={!canScrollRight}
          tabIndex={-1}
        >
          <Icon name="chevron-right" className="w-6 h-6 md:w-8 md:h-8" />
        </button>
      </div>
    </div>
  );
};

export default memo(VideoCarousel);