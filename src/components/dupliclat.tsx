// src/components/VideoPlayerModal.tsx
import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./VideoPlayerModal.module.css";
import { Icon } from "./Icon";
import type { Video, AudioTrack, SubtitleTrack, QualityOpt } from "../types/index";

/**
 * VideoPlayerModal (Complete Fixed Version)
 *
 * Props:
 *   - video: Video
 *   - onClose: () => void
 *
 * Notes:
 *   - Optional fields on Video:
 *       subtitleTracks?: SubtitleTrack[]
 *       audioTracks?: AudioTrack[]
 *       thumbnailsVtt?: string
 *       qualities?: QualityOpt[]
 *
 *   - Uses localStorage key: streamflex-player-settings-<video.id>
 */

interface Props {
  video: Video;
  onClose: () => void;
}

const DOUBLE_CLICK_SEEK = 10; // seconds
const CONTROLS_HIDE_MS = 2200;

function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}

function formatTime(s: number | null) {
  if (!s || !isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" + sec : sec}`;
}

/* Parse VTT timestamps (supports fractions) */
function parseTimestamp(ts: string) {
  ts = ts.replace(",", ".").trim();
  const parts = ts.split(":").map((p) => Number(p));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(parts[0]) || 0;
}

function parseVtt(raw: string) {
  const lines = raw.split(/\r?\n/);
  const cues: { start: number; end: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("-->")) {
      const [start, end] = lines[i].split("-->").map((s) => s.trim());
      const text = (lines[i + 1] || "").trim();
      cues.push({ start: parseTimestamp(start), end: parseTimestamp(end), text });
    }
  }
  return cues;
}

export default function VideoPlayerModal({ video, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const controlsTimeout = useRef<number | null>(null);
  const cursorTimeout = useRef<number | null>(null);
  const flashTimeout = useRef<number | null>(null);
  const volOverlayTimeout = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [flashType, setFlashType] = useState<"play" | "pause" | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const [bufferPercent, setBufferPercent] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const [showControls, setShowControls] = useState<boolean>(true);
  const [controlsVisibleDueToMove, setControlsVisibleDueToMove] = useState(false);

  // transient cursor overlay shown only on click/dbl/keyboard toggle
  const [showCursorPlay, setShowCursorPlay] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>(video.subtitleTracks ?? []);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);

  const [episodes, setEpisodes] = useState<{ id: string; title?: string; src?: string }[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState<number>(0);

  const [thumbnailsVtt, setThumbnailsVtt] = useState<string | null>((video as any).thumbnailsVtt ?? null);
  const [thumbPreview, setThumbPreview] = useState<{ url: string; x: number } | null>(null);

  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);

  const [vttCues, setVttCues] = useState<{ start: number; end: number; text: string }[]>([]);

  const [qualityList, setQualityList] = useState<QualityOpt[]>(video.qualities ?? []);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState<number | null>(null);

  // Menus
  type Menu = null | "subs" | "quality" | "settings";
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const [settingsTab, setSettingsTab] = useState<"speed" | "audio">("speed");

  const [activeAudio, setActiveAudio] = useState<string | null>("default");

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const [showResumeOverlay, setShowResumeOverlay] = useState(false);
  const [showUpNextOverlay, setShowUpNextOverlay] = useState(false);

  // volume overlay
  const [showVolumeOverlay, setShowVolumeOverlay] = useState(false);
  const [volumeOverlayValue, setVolumeOverlayValue] = useState<number>(Math.round(volume * 100));

  // load persisted settings for this video
  const settingsKey = (vid: Video) => `streamflex-player-settings-${vid.id}`;

  // Utility: show controls briefly (with fade + always visible when paused)
  const showControlsTemporarily = (timeout = CONTROLS_HIDE_MS) => {
    setShowControls(true);
    setControlsVisibleDueToMove(true);

    if (controlsTimeout.current) {
      window.clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }

    controlsTimeout.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;

      // If paused, keep controls visible
      if (v.paused) {
        setShowControls(true);
        setControlsVisibleDueToMove(false);
        return;
      }

      // Otherwise, fade them out
      setShowControls(false);
      setControlsVisibleDueToMove(false);
      controlsTimeout.current = null;
    }, timeout) as unknown as number;
  };

  // Trigger flash overlay (1s) and clear previous
  const triggerFlash = (type: "play" | "pause") => {
    setFlashType(type);
    if (flashTimeout.current) {
      window.clearTimeout(flashTimeout.current);
      flashTimeout.current = null;
    }
    flashTimeout.current = window.setTimeout(() => {
      setFlashType(null);
      flashTimeout.current = null;
    }, 1000) as unknown as number;
  };

  // show volume overlay helper
  const showVolOverlay = (val: number) => {
    setVolumeOverlayValue(Math.round(val * 100));
    setShowVolumeOverlay(true);
    if (volOverlayTimeout.current) {
      window.clearTimeout(volOverlayTimeout.current);
      volOverlayTimeout.current = null;
    }
    volOverlayTimeout.current = window.setTimeout(() => {
      setShowVolumeOverlay(false);
      volOverlayTimeout.current = null;
    }, 1000) as unknown as number;
  };

  // transient cursor overlay
  const showCursorTransient = (clientX: number, clientY: number, duration = 800) => {
    setCursorPos({ x: clientX, y: clientY });
    setShowCursorPlay(true);
    if (cursorTimeout.current) {
      window.clearTimeout(cursorTimeout.current);
      cursorTimeout.current = null;
    }
    cursorTimeout.current = window.setTimeout(() => {
      setShowCursorPlay(false);
      cursorTimeout.current = null;
    }, duration) as unknown as number;
  };

  /* ---------------- Load video + HLS + VTT + persisted settings ---------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    
    setLoading(true);
    setError(null);

    // Clean up previous HLS instance
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    // HLS support
    if (Hls.isSupported() && video.videoUrl && video.videoUrl.endsWith(".m3u8")) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      
      hlsRef.current = hls;
      hls.loadSource(video.videoUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        try {
          const levels = (data && data.levels) || [];
          const qlist = levels.map((lvl: any, idx: number) => {
            const label = lvl?.height ? `${lvl.height}p` : lvl?.bitrate ? `${Math.round(lvl.bitrate / 1000)}kbps` : `Level ${idx + 1}`;
            return { label, url: lvl?.url || `${video.videoUrl}#level=${idx}` };
          });
          setQualityList(qlist);
        } catch {
          setQualityList(video.qualities ?? []);
        }
        setLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data?.fatal) {
          setError("Playback error (HLS).");
          setLoading(false);
        }
      });

      return () => {
        try {
          hls.destroy();
        } catch {}
      };
    } else {
      // native playback
      if (video.videoUrl) {
        v.src = video.videoUrl;
      }
      setQualityList(video.qualities ?? []);
      setLoading(false);
    }

    // load persisted settings
    try {
      const raw = localStorage.getItem(settingsKey(video));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1) {
          setVolume(parsed.volume);
        }
        if (typeof parsed.playbackRate === "number" && parsed.playbackRate > 0) {
          setPlaybackRate(parsed.playbackRate);
        }
        if (typeof parsed.activeSubtitle === "string" || parsed.activeSubtitle === null) {
          setActiveSubtitle(parsed.activeSubtitle);
        }
      }
    } catch (err) {
      console.warn("Failed to load persisted player settings:", err);
    }

    const onLoaded = () => {
      if (v.duration && isFinite(v.duration)) {
        setDuration(v.duration);
      }
      setLoading(false);
      v.volume = volume;
      v.playbackRate = playbackRate;
      v.muted = isMuted;
    };

    const onLoadStart = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      setError("Failed to load video.");
      setLoading(false);
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("loadstart", onLoadStart);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("loadstart", onLoadStart);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
    };
  }, [video.videoUrl, video.id]);

  /* ---------------- Playback/time listeners ---------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      setCurrentTime(v.currentTime);
      if (v.duration && v.duration > 0 && isFinite(v.duration)) {
        setProgressPercent((v.currentTime / v.duration) * 100);
      }
    };
    const onProgress = () => {
      if (v.buffered && v.buffered.length > 0 && v.duration && v.duration > 0 && isFinite(v.duration)) {
        const end = v.buffered.end(v.buffered.length - 1);
        setBufferPercent((end / v.duration) * 100);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setShowResumeOverlay(true);
      if (autoPlayNext) {
        setShowUpNextOverlay(true);
      }
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onSeeked = () => setLoading(false);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("progress", onProgress);
    v.addEventListener("ended", onEnded);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("seeked", onSeeked);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("seeked", onSeeked);
    };
  }, [autoPlayNext, episodes, activeEpisodeIndex]);

  /* ---------------- VTT thumbnails load ---------------- */
  useEffect(() => {
    if (!thumbnailsVtt) {
      setVttCues([]);
      return;
    }
    
    fetch(thumbnailsVtt)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => setVttCues(parseVtt(text)))
      .catch((err) => {
        console.warn("Failed to load VTT thumbnails:", err);
        setVttCues([]);
      });
  }, [thumbnailsVtt]);

  /* ---------------- Keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      
      const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay(window.innerWidth / 2, window.innerHeight / 2);
          break;

        case "KeyF":
          e.preventDefault();
          try {
            const el = containerRef.current;
            if (!el) return;
            if (!document.fullscreenElement) {
              el.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          } catch {}
          break;
          
        case "KeyM":
          e.preventDefault();
          const newMuted = !v.muted;
          v.muted = newMuted;
          setIsMuted(newMuted);
          showVolOverlay(newMuted ? 0 : v.volume);
          break;
          
        case "ArrowRight":
          e.preventDefault();
          if (v.duration && isFinite(v.duration)) {
            v.currentTime = Math.min(v.duration, v.currentTime + 5);
          }
          break;
          
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 5);
          break;
          
        case "ArrowUp":
          e.preventDefault();
          const newVolumeUp = clamp(v.volume + 0.05, 0, 1);
          v.volume = newVolumeUp;
          v.muted = false;
          setVolume(newVolumeUp);
          setIsMuted(false);
          showVolOverlay(newVolumeUp);
          break;
          
        case "ArrowDown":
          e.preventDefault();
          const newVolumeDown = clamp(v.volume - 0.05, 0, 1);
          v.volume = newVolumeDown;
          setVolume(newVolumeDown);
          if (newVolumeDown === 0) {
            v.muted = true;
            setIsMuted(true);
          }
          showVolOverlay(newVolumeDown);
          break;
          
        case "KeyP":
          e.preventDefault();
          try {
            if ("requestPictureInPicture" in v) {
              (v as any).requestPictureInPicture().catch(() => {});
            }
          } catch {}
          break;
          
        case "KeyC":
          e.preventDefault();
          if (!subtitleTracks || subtitleTracks.length === 0) return;
          if (activeSubtitle === null && subtitleTracks.length > 0) {
            handleSubtitleChange(subtitleTracks[0].lang);
          } else {
            handleSubtitleChange(null);
          }
          break;
          
        case "KeyD":
          e.preventDefault();
          if (video.audioTracks && video.audioTracks.length > 0) {
            const idx = video.audioTracks.findIndex((a) => a.lang === activeAudio);
            const nextIdx = (idx + 1) % video.audioTracks.length;
            const next = video.audioTracks[nextIdx];
            if (next) {
              handleAudioChange(next.lang, next.url);
            }
          }
          break;
          
        case "Escape":
          e.preventDefault();
          onClose();
          break;
          
        default:
          // 0-9 quick jump to percentage
          if (e.code.startsWith("Digit")) {
            const digit = Number(e.code.replace("Digit", ""));
            if (!isNaN(digit) && v.duration && isFinite(v.duration)) {
              v.currentTime = (v.duration * digit) / 10;
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSubtitle, activeAudio, subtitleTracks, video.audioTracks]);

  /* ---------------- UI handlers ---------------- */
  // ✅ Fix stop() to accept all React events safely
  const stop = (e?: Event | React.SyntheticEvent) => {
    if (e && "stopPropagation" in e && typeof (e as any).stopPropagation === "function") {
      (e as any).stopPropagation();
    }
  };

  // Updated togglePlay: unified toggling + flash overlays + show controls + cursor transient
  const togglePlay = (clientX?: number, clientY?: number) => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch((err) => {
        console.warn("Play failed:", err);
        setError("Failed to play video.");
      });
      triggerFlash("play");
    } else {
      v.pause();
      triggerFlash("pause");
    }

    showControlsTemporarily();

    if (typeof clientX === "number" && typeof clientY === "number") {
      showCursorTransient(clientX, clientY);
    }
  };

  // ✅ Fix handleVideoClick to support both Mouse & Touch events
  const handleVideoClick = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX: number;
    let clientY: number;
  
    if ("touches" in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
  
    togglePlay(clientX, clientY);
  };


  const handleDoubleClick = (e: React.MouseEvent) => {
    stop(e);
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const isRight = e.clientX > rect.left + rect.width / 2;
    const seekAmount = isRight ? DOUBLE_CLICK_SEEK : -DOUBLE_CLICK_SEEK;
    v.currentTime = clamp(v.currentTime + seekAmount, 0, v.duration);
    showCursorTransient(e.clientX, e.clientY);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    stop(e);
    const el = progressRef.current;
    const v = videoRef.current;
    if (!el || !v || !duration || !isFinite(duration)) return;
    
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = clamp(x / rect.width, 0, 1);
    v.currentTime = pct * duration;
    setProgressPercent(pct * 100);
    showControlsTemporarily();
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    stop(e);
    const el = progressRef.current;
    const v = videoRef.current;
    if (!el || !v || !duration || !isFinite(duration)) return;
    
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = clamp(x / rect.width, 0, 1);
    const time = pct * duration;
    setHoverTime(time);
    setHoverX(e.clientX);

    if (vttCues && vttCues.length > 0) {
      const cue = vttCues.find((c) => time >= c.start && time <= c.end);
      if (cue && cue.text) {
        setThumbPreview({ url: cue.text, x: e.clientX });
        return;
      }
    }
    setThumbPreview(null);
  };

  const handleProgressLeave = () => {
    setHoverTime(null);
    setHoverX(null);
    setThumbPreview(null);
  };

  const beginDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startDrag = (ev: MouseEvent) => {
      const el = progressRef.current;
      const v = videoRef.current;
      if (!el || !v || !duration || !isFinite(duration)) return;
      
      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = clamp(x / rect.width, 0, 1);
      setProgressPercent(pct * 100);
      v.currentTime = pct * duration;
    };
    
    const endDrag = () => {
      document.removeEventListener("mousemove", startDrag);
      document.removeEventListener("mouseup", endDrag);
    };
    
    document.addEventListener("mousemove", startDrag);
    document.addEventListener("mouseup", endDrag);
  };

  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    const clampedVal = clamp(val, 0, 1);
    
    setVolume(clampedVal);
    setIsMuted(clampedVal === 0);
    
    if (v) {
      v.volume = clampedVal;
      v.muted = clampedVal === 0;
    }
    
    try {
      const key = settingsKey(video);
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.volume = clampedVal;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (err) {
      console.warn("Failed to save volume setting:", err);
    }
    
    showVolOverlay(clampedVal);
  };

  const getVolumeIconName = () => {
    if (isMuted || volume === 0) return "volume-off";
    if (volume <= 0.33) return "volume-low";
    if (volume <= 0.66) return "volume-medium";
    return "volume-high";
  };

  const handlePlaybackRateChange = (r: number) => {
    if (r <= 0) return;
    
    setPlaybackRate(r);
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    
    try {
      const key = settingsKey(video);
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.playbackRate = r;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (err) {
      console.warn("Failed to save playback rate:", err);
    }
    
    setOpenMenu(null);
  };

  const handleSubtitleChange = (lang: string | null) => {
    setActiveSubtitle(lang);
    const v = videoRef.current;
    if (!v) return;
    
    Array.from(v.textTracks || []).forEach((track) => {
      const trackLang = (track as any).language || (track as any).label || "";
      (track as any).mode = trackLang === (lang || "") ? "showing" : "hidden";
    });
    
    try {
      const key = settingsKey(video);
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.activeSubtitle = lang;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (err) {
      console.warn("Failed to save subtitle setting:", err);
    }
    
    setOpenMenu(null);
  };

  const handleAudioChange = (lang: string | null, url?: string) => {
    setActiveAudio(lang);
    const v = videoRef.current;
    if (!v) return;
    
    const currentTime = v.currentTime || 0;
    const wasPlaying = !v.paused;
    
    if (url && url !== video.videoUrl) {
      v.src = url;
    } else if (video.videoUrl) {
      v.src = video.videoUrl;
    }
    
    const restorePlayback = () => {
      v.currentTime = currentTime;
      if (wasPlaying) {
        v.play().catch((err) => console.warn("Failed to resume playback:", err));
      }
    };
    
    if (v.readyState >= 1) {
      restorePlayback();
    } else {
      const onLoadedMetadata = () => {
        restorePlayback();
        v.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
      v.addEventListener("loadedmetadata", onLoadedMetadata);
    }
    
    setOpenMenu(null);
  };

  // menu toggles
  const toggleMenu = (m: Menu) => {
    setOpenMenu((prev) => (prev === m ? null : m));
    if (m === "settings") setSettingsTab("speed");
  };

  // Close menus if clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Cleanup timeouts and HLS on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout.current) window.clearTimeout(controlsTimeout.current);
      if (cursorTimeout.current) window.clearTimeout(cursorTimeout.current);
      if (flashTimeout.current) window.clearTimeout(flashTimeout.current);
      if (volOverlayTimeout.current) window.clearTimeout(volOverlayTimeout.current);
      
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
    };
  }, []);

  // Slider background style (blue fill)
  const sliderBg = (val: number) => {
    const pct = Math.round(clamp(val, 0, 1) * 100);
    return { 
      background: `linear-gradient(90deg, #3b82f6 ${pct}%, rgba(255,255,255,0.12) ${pct}%)` 
    } as React.CSSProperties;
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.overlay} fixed inset-0 z-50 flex items-center justify-center`}
      onMouseMove={() => {
        setShowControls(true);
        showControlsTemporarily();
      }}
      role="dialog"
      aria-label={`Video player: ${video.title}`}
    >
      {/* backdrop close */}
      <div 
        className="absolute inset-0 bg-black/90" 
        onClick={() => onClose()}
        aria-label="Close player" 
      />

      <div
        onDoubleClick={handleDoubleClick}
        onMouseMove={() => showControlsTemporarily()}
        className={styles.videoContainer}
        style={{ maxHeight: "100vh", maxWidth: "100vw", position: "relative" }}
      >
        {/* Close button - positioned absolutely at top-right */}
        <button
          type="button"
          className={styles.closeTopRight}
          data-tooltip="Close (Esc)"
          onClick={(e) => {
            stop(e);
            onClose();
          }}
          aria-label="Close player"
        >
          <Icon name="close" className="w-4 h-4" />
        </button>

        {/* video element */}
        <video
          ref={videoRef}
          className={styles.videoElement}
          playsInline
          preload="metadata"
          onClick={handleVideoClick}
          onTouchStart={(e) => {
            handleVideoClick(e as any);
          }}
        >
          <source src={video.videoUrl ?? ""} />
          {subtitleTracks?.map((track: SubtitleTrack, idx: number) => (
            <track 
              key={`${track.lang}-${idx}`}
              src={track.url} 
              kind="subtitles" 
              srcLang={track.lang} 
              label={track.label} 
              default={idx === 0} 
            />
          ))}
        </video>

        {/* Central video area click/tap */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          onClick={(e) => {
            stop(e);
            handleVideoClick(e);
          }}
          onTouchStart={(e) => {
            stop(e);
            handleVideoClick(e);
          }}
        ></div>

        {/* Volume overlay - positioned outside video element */}
        {showVolumeOverlay && (
          <div className={styles.volumeOverlay} aria-hidden>
            <div className={styles.volumePercentOverlay}>{volumeOverlayValue}%</div>
            <div className={styles.volumeBar}>
              <div
                className={styles.volumeBarFill}
                style={{ height: `${volumeOverlayValue}%` }}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="bg-red-600/90 text-white px-6 py-4 rounded-lg max-w-md text-center">
              <h3 className="font-semibold mb-2">Playback Error</h3>
              <p className="text-sm">{error}</p>
              <button
                className="mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 rounded transition-colors"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Big central play button (permanent when paused) */}
        {!isPlaying && !showResumeOverlay && !loading && (
          <div
            className={styles.bigPlayButton}
            style={{ pointerEvents: "none" }}
            aria-hidden
          >
            <div
              className={styles.bigPlayInner}
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onClick={(e) => {
                stop(e);
                togglePlay(e.clientX, e.clientY);
              }}
            >
              <Icon name="play" className="w-12 h-12" />
            </div>
          </div>
        )}

        {/* Flash overlay (appears for 1s with fade+scale like YouTube) */}
        {flashType && (
          <div
            className={styles.bigPlayButton}
            style={{
              pointerEvents: "none",
              zIndex: 180,
              transition: "opacity 240ms ease",
              opacity: flashType ? 1 : 0,
            }}
            aria-hidden
          >
            <div
              className={styles.bigPlayInner}
              style={{
                background: "rgba(0,0,0,0.7)",
                transform: "scale(1)",
                transition: "transform 200ms ease, opacity 200ms ease",
              }}
            >
              <Icon name={flashType === "play" ? "play" : "pause"} className="w-12 h-12" />
            </div>
          </div>
        )}

        {/* Transient cursor overlay */}
        {showCursorPlay && cursorPos && (
          <div
            className={styles.cursorPlayOverlay}
            style={{ 
              left: `${cursorPos.x}px`, 
              top: `${cursorPos.y}px`, 
              pointerEvents: "none" 
            }}
            aria-hidden
          >
            <div className={styles.cursorPlayInner}>
              <Icon name={isPlaying ? "pause" : "play"} className="w-8 h-8" />
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div 
            className={styles.spinnerOverlay} 
            role="status" 
            aria-live="polite" 
            style={{ pointerEvents: "none" }}
          >
            <Icon name="spinner" className="w-12 h-12 animate-spin text-white opacity-90" />
          </div>
        )}

        {/* Resume overlay */}
        {showResumeOverlay && (
          <div className={styles.resumeOverlay}>
            <div className={styles.resumeBox}>
              <div>Playback ended</div>
              <div style={{ marginTop: 8, display: "flex", gap: "8px", justifyContent: "center" }}>
                <button
                  className={styles.resumePrimary}
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    v.currentTime = 0;
                    v.play().catch(() => {});
                    setShowResumeOverlay(false);
                  }}
                >
                  Restart
                </button>
                <button 
                  className={styles.resumeSecondary} 
                  onClick={() => setShowResumeOverlay(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Up Next overlay */}
        {showUpNextOverlay && episodes.length > 0 && activeEpisodeIndex < episodes.length - 1 && (
          <div className={styles.upNext}>
            <div className={styles.upNextBox}>
              <div>Up Next: {episodes[activeEpisodeIndex + 1]?.title || "Next Episode"}</div>
              <div style={{ marginTop: 6, display: "flex", gap: "6px" }}>
                <button
                  className={styles.playNextBtn}
                  onClick={() => {
                    const nextEp = episodes[activeEpisodeIndex + 1];
                    if (nextEp && nextEp.src) {
                      setActiveEpisodeIndex(activeEpisodeIndex + 1);
                      // Update video source logic would go here
                      setShowUpNextOverlay(false);
                    }
                  }}
                >
                  Play
                </button>
                <button 
                  className={styles.cancelBtn}
                  onClick={() => setShowUpNextOverlay(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className={`${styles.controlsWrap} ${showControls ? styles.controlsVisible : styles.controlsHidden}`}>
          {/* Background gradient */}
          <div className={styles.controlsGradient} />
          
          <div className={styles.controlsInner}>
            {/* Progress/Timeline bar */}
            <div
              ref={progressRef}
              className={styles.timeline}
              onClick={handleSeek}
              onMouseMove={handleProgressHover}
              onMouseLeave={handleProgressLeave}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent)}
              aria-label="Seek video position"
            >
              <div 
                className={styles.bufferBar} 
                style={{ width: `${Math.max(0, Math.min(100, bufferPercent))}%` }} 
              />
              <div 
                className={styles.playedBar} 
                style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} 
              />
              <div 
                className={styles.knob} 
                style={{ left: `${Math.max(0, Math.min(100, progressPercent))}%` }} 
                onMouseDown={beginDrag}
                tabIndex={0}
                role="button"
                aria-label="Drag to seek"
              />
              
              {/* Hover time tooltip */}
              {hoverTime !== null && hoverX !== null && progressRef.current && (
                <div 
                  className={styles.hoverTooltip} 
                  style={{ 
                    left: Math.max(0, Math.min(
                      progressRef.current.offsetWidth - 60,
                      hoverX - progressRef.current.getBoundingClientRect().left
                    ))
                  }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Control buttons row */}
            <div className={styles.controlRow}>
              {/* Left side controls */}
              <div className={styles.groupLeft}>
                {/* Play/Pause button */}
                <button
                  className={styles.iconButton}
                  data-tooltip={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  onClick={(e) => { 
                    stop(e); 
                    togglePlay(e.clientX, e.clientY); 
                  }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  <Icon name={isPlaying ? "pause" : "play"} className="w-6 h-6" />
                </button>

                {/* Time display */}
                <span className={styles.timeDisplay}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* Volume controls */}
                <div className={styles.volumeGroup}>
                  <button
                    className={styles.iconButton}
                    data-tooltip={isMuted || volume === 0 ? "Unmute (M)" : "Mute (M)"}
                    onClick={(e) => {
                      stop(e);
                      const v = videoRef.current;
                      if (!v) return;
                      const newMuted = !v.muted;
                      v.muted = newMuted;
                      setIsMuted(newMuted);
                      if (newMuted) {
                        showVolOverlay(0);
                      } else {
                        const vol = v.volume || 1;
                        setVolume(vol);
                        showVolOverlay(vol);
                      }
                    }}
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                  >
                    <Icon name={getVolumeIconName()} className="w-5 h-5" />
                  </button>

                  <input
                    className={styles.volumeSlider}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      stop(e);
                      const val = parseFloat(e.currentTarget.value);
                      handleVolumeChange(val);
                    }}
                    style={sliderBg(isMuted ? 0 : volume)}
                    aria-label="Volume"
                  />

                  <div className={styles.volumePercent}>
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </div>
                </div>
              </div>

              {/* Right side controls */}
              <div className={styles.groupRight}>
                {/* Subtitles/CC */}
                <div className={styles.dropdownWrap}>
                  <button
                    className={styles.iconButton}
                    data-tooltip="Subtitles (C)"
                    onClick={(e) => {
                      stop(e);
                      toggleMenu("subs");
                    }}
                    aria-label="Subtitle options"
                  >
                    <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>
                      [CC]
                    </span>
                  </button>

                  {openMenu === "subs" && (
                    <div className={styles.menuPanel} onClick={stop}>
                      <button 
                        className={`${styles.menuItem} ${activeSubtitle === null ? styles.menuItemActive : ""}`} 
                        onClick={() => handleSubtitleChange(null)}
                      >
                        Off
                      </button>
                      {subtitleTracks?.map((track, i) => (
                        <button 
                          key={`${track.lang}-${i}`}
                          className={`${styles.menuItem} ${activeSubtitle === track.lang ? styles.menuItemActive : ""}`} 
                          onClick={() => handleSubtitleChange(track.lang)}
                        >
                          {track.label ?? track.lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quality selector */}
                <div className={styles.dropdownWrap}>
                  <button
                    className={styles.iconButton}
                    data-tooltip="Quality"
                    onClick={(e) => {
                      stop(e);
                      toggleMenu("quality");
                    }}
                    aria-label="Quality options"
                  >
                    <span style={{ fontSize: 16 }}>📺</span>
                  </button>

                  {openMenu === "quality" && (
                    <div className={styles.menuPanel} onClick={stop}>
                      {qualityList.length > 0 ? (
                        qualityList.map((quality, idx) => (
                          <button
                            key={`${quality.label}-${idx}`}
                            className={`${styles.menuItem} ${selectedQualityIndex === idx ? styles.menuItemActive : ""}`}
                            onClick={() => {
                              const v = videoRef.current;
                              if (!v) return;
                              const currentTime = v.currentTime || 0;
                              const wasPlaying = !v.paused;
                              
                              // Switch quality
                              if (quality.url !== v.src) {
                                v.src = quality.url;
                                v.currentTime = currentTime;
                                if (wasPlaying) {
                                  v.play().catch(() => {});
                                }
                              }
                              
                              setSelectedQualityIndex(idx);
                              setOpenMenu(null);
                            }}
                          >
                            {quality.label}
                          </button>
                        ))
                      ) : (
                        <div className={styles.menuItem} style={{ opacity: 0.7 }}>
                          Auto
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Settings menu */}
                <div className={styles.dropdownWrap}>
                  <button
                    className={styles.iconButton}
                    data-tooltip="Settings"
                    onClick={(e) => {
                      stop(e);
                      toggleMenu("settings");
                      setSettingsTab("speed");
                    }}
                    aria-label="Settings"
                  >
                    <Icon name="settings" className="w-5 h-5" />
                  </button>

                  {openMenu === "settings" && (
                    <div className={styles.menuPanel} onClick={stop}>
                      {/* Settings tabs */}
                      <div className={styles.settingsTabs}>
                        <button 
                          className={`${styles.settingsTab} ${settingsTab === "speed" ? styles.settingsTabActive : ""}`} 
                          onClick={() => setSettingsTab("speed")}
                        >
                          Speed
                        </button>
                        <button 
                          className={`${styles.settingsTab} ${settingsTab === "audio" ? styles.settingsTabActive : ""}`} 
                          onClick={() => setSettingsTab("audio")}
                        >
                          Audio
                        </button>
                      </div>

                      {/* Settings content */}
                      <div className={styles.settingsContent}>
                        {settingsTab === "speed" && (
                          <>
                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                              <button
                                key={rate}
                                className={`${styles.menuItem} ${Math.abs(playbackRate - rate) < 0.001 ? styles.menuItemActive : ""}`}
                                onClick={() => handlePlaybackRateChange(rate)}
                              >
                                {rate}x
                              </button>
                            ))}
                          </>
                        )}

                        {settingsTab === "audio" && (
                          <>
                            <button 
                              className={`${styles.menuItem} ${activeAudio === "default" ? styles.menuItemActive : ""}`} 
                              onClick={() => handleAudioChange("default", video.videoUrl)}
                            >
                              Default
                            </button>

                            {video.audioTracks && video.audioTracks.length > 0 ? (
                              video.audioTracks.map((audioTrack: AudioTrack, i: number) => (
                                <button 
                                  key={`${audioTrack.lang}-${i}`}
                                  className={`${styles.menuItem} ${activeAudio === audioTrack.lang ? styles.menuItemActive : ""}`} 
                                  onClick={() => handleAudioChange(audioTrack.lang, audioTrack.url)}
                                >
                                  {audioTrack.label ?? audioTrack.lang}
                                </button>
                              ))
                            ) : (
                              <div className={styles.menuItem} style={{ opacity: 0.7 }}>
                                No alternate audio
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fullscreen button */}
                <button
                  className={styles.iconButton}
                  data-tooltip="Fullscreen (F)"
                  onClick={(e) => {
                    stop(e);
                    try {
                      const el = containerRef.current;
                      if (!el) return;
                      if (!document.fullscreenElement) {
                        el.requestFullscreen().catch(() => {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                      }
                    } catch (err) {
                      console.warn("Fullscreen failed:", err);
                    }
                  }}
                  aria-label="Toggle fullscreen"
                >
                  <Icon name="fullscreen" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail preview on hover */}
        {thumbPreview && (
          <div 
            style={{ 
              position: "fixed", 
              left: Math.max(10, Math.min(window.innerWidth - 170, thumbPreview.x + 12)), 
              bottom: "22%", 
              zIndex: 120,
              pointerEvents: "none"
            }}
          >
            <div style={{ 
              background: "rgba(0,0,0,0.85)", 
              padding: 6, 
              borderRadius: 6 
            }}>
              <img 
                src={thumbPreview.url} 
                alt="Video preview" 
                style={{ 
                  width: 160, 
                  height: "auto", 
                  display: "block",
                  borderRadius: 4
                }} 
                onError={(e) => {
                  // Hide preview if image fails to load
                  setThumbPreview(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}