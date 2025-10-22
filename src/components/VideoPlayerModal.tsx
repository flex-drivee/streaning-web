// src/components/VideoPlayerModal.tsx
import { motion } from 'framer-motion';
import React, { useEffect, useCallback, useRef, useState } from "react";

import Hls from "hls.js";
import styles from "./VideoPlayerModal.module.css";
import { Icon } from "./Icon";
import { getSeriesInfo } from '../utils/normalizeVideo';
import { useClickOutside } from "../hooks/useClickOutside";
import type { Video, AudioTrack, SubtitleTrack, QualityOpt } from "../types/index";
import { backdropVariants, modalVariants, modalTransition, } from "../utils/motionConfig"; // 👈 shared animation config
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


/* ---------------------- Types ---------------------- */
type QualityItem = { label: string; url: string };

type AudioTrackId = number | "default";

type AudioTrackItem = {
  id: AudioTrackId;
  name: string;
  lang?: string;
  url?: string;
};



interface VideoMeta {
  id: string;
  title: string;
  description?: string;
  videoUrl: string; // .m3u8 or mp4
  poster?: string;
  qualities?: QualityItem[]; // fallback manual quality list
  // optional static audioTracks for non-HLS sources (not commonly used)
  audioTracks?: { lang: string; label?: string; url?: string }[];
}

interface VideoPlayerModalProps {
  video: VideoMeta;
  thumbnailsVtt?: string | null;
  onClose: () => void;
  autoPlay?: boolean;
}



interface Props {
  video: Video;
  onClose: () => void;
}

const DOUBLE_CLICK_SEEK = 10; // seconds
const CONTROLS_HIDE_MS = 2200;

function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}

function formatTime(s: number | null | undefined): string {
  if (s == null || !isFinite(s) || s < 0) return "0:00"; // ✅ handles null, NaN, negative
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ------------------- Helpers: VTT parse ------------------- */
function parseTimestamp(ts: string): number {
  if (!ts) return 0;
  ts = ts.replace(",", ".").trim();
  const parts = ts.split(":").map((p) => p.trim());
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  const num = parseFloat(parts[0]);
  return isNaN(num) ? 0 : num;
}

function parseVtt(raw: string) {
  if (!raw || raw.trim().length === 0) {
    return [{ start: 0, end: 0, text: "No preview available" }];
  }
  const lines = raw.split(/\r?\n/);
  const cues: { start: number; end: number; text: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || /^WEBVTT/i.test(line) || /^\d+$/.test(line)) {
      i++;
      continue;
    }
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map((s) => s.trim());
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i++;
      }
      cues.push({
        start: parseTimestamp(startStr),
        end: parseTimestamp(endStr),
        text: textLines.join("\n") || "No preview available",
      });
    } else {
      i++;
    }
  }
  if (cues.length === 0) return [{ start: 0, end: 0, text: "No preview available" }];
  return cues;
}




export default function VideoPlayerModal({ video, onClose }: Props) {
                // --- Core Refs ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
   
    // menu refs for click outside

  const menuPanelRef = useRef<HTMLDivElement>(null);
  const subsMenuPanelRef = useRef<HTMLDivElement>(null);

  const OVERLAY_DURATION = 1600;
              // --- Timeouts for overlays/controls ---
  const controlsTimeout = useRef<number | null>(null);
  const cursorTimeout = useRef<number | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volOverlayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedInfoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [showPausedInfo, setShowPausedInfo] = useState(false);
  const mouseMoveTimer = useRef<number | null>(null);
  const [dimVideo, setDimVideo] = useState(false);
  

              // --- Playback states ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

            // --- Timeline ---    
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [bufferPercent, setBufferPercent] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

           // --- Volume / rate ---
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

           // --- Controls visibility ---
  const [showControls, setShowControls] = useState<boolean>(true);
  const [controlsVisibleDueToMove, setControlsVisibleDueToMove] = useState(false);

  // transient cursor overlay shown only on click/dbl/keyboard toggle
  const [showCursorPlay, setShowCursorPlay] = useState<boolean>(false)
  const [flashType, setFlashType] = useState<"play" | "pause" | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Ripple feedback
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  // 🌀 Ripple state and cleanup
  const rippleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRipple = (clientX: number, clientY: number) => {
    if (rippleTimeout.current) clearTimeout(rippleTimeout.current);

    setRipple({ x: clientX, y: clientY, id: Date.now() });

    rippleTimeout.current = setTimeout(() => {
      setRipple(null);
    }, 450); // match CSS animation length
  };

  useEffect(() => {
    return () => {
      if (rippleTimeout.current) clearTimeout(rippleTimeout.current);
    };
  }, []);



         // --- Subtitles ---
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>(video.subtitleTracks ?? []);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);

           // --- Episodes ---
  const [episodes, setEpisodes] = useState<{ id: string; title?: string; src?: string }[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState<number>(0);

           // --- Thumbnails & previews ---
  const [thumbnailsVtt, setThumbnailsVtt] = useState<string | null>((video as any).thumbnailsVtt ?? null);
  const [thumbPreview, setThumbPreview] = useState<{ url: string; x: number } | null>(null);
  const [vttCues, setVttCues] = useState<{ start: number; end: number; text: string }[]>([]);
       
          // --- Auto play next episode ---
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);

            // --- Quality / Audio Tracks ---
  const [qualityList, setQualityList] = useState<QualityOpt[]>(video.qualities ?? []);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState<number>(-1);

  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | "default">("default");
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* 🗣 Live Language Overlay */
const [langOverlay, setLangOverlay] = useState<{
  type: "audio" | "subtitle";
  label: string;
} | null>(null);

function showLanguageOverlay(type: "audio" | "subtitle", label: string) {
  setLangOverlay({ type, label });
  setTimeout(() => setLangOverlay(null), OVERLAY_DURATION);
}

  function logAnalytics(event: string, data: Record<string, any> = {}) {
  const payload = {
    event,
    videoId: video.id,
    title: video.title,
    ...data,
    ts: Date.now(),
  };

  console.log("📊 Analytics:", payload);

  if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    (window as any).gtag("event", event, payload);
  }
}



  // --- Quality Switch Handler ---
const handleQualitySwitch = (idx: number) => {
  const v = videoRef.current;
  if (!v) return;

  const currentTime = v.currentTime || 0;
  const wasPlaying = !v.paused;

  if (hlsRef.current && Hls.isSupported()) {
    // ✅ Use Hls API for adaptive streams
    hlsRef.current.currentLevel = idx; // -1 = Auto
  } else {
    // ✅ Fallback for native video / MP4
    const quality = qualityList[idx];
    if (quality && quality.url !== v.src) {
      v.src = quality.url;
      v.currentTime = currentTime;
      if (wasPlaying) {
        v.play().catch(() => {});
      }
    }
  }

  setSelectedQualityIndex(idx);
  closeMenu();



  logAnalytics("quality_change", {
    label: idx === -1 ? "Auto" : qualityList[idx]?.label,
    index: idx,
  });
};

// --- Audio Switch Handler ---
const handleAudioSwitch = (trackId: number | "default") => {
  if (!hlsRef.current) {
    // fallback for native video (rare)
    setSelectedAudioTrack("default");
    return;
  }

  try {
    if (trackId === "default") {
      hlsRef.current.audioTrack = 0; // first/default
    } else {
      hlsRef.current.audioTrack = trackId;
    }

    setSelectedAudioTrack(trackId);

    logAnalytics("audio_change", {
      trackId,
      trackName:
        trackId === "default"
          ? "Default"
          : audioTracks.find((t) => t.id === trackId)?.name,
    });

    closeMenu();


  } catch (err) {
    console.error("Failed to switch audio track", err);
  }
};


// When mouse moves
// When mouse moves
const handleMouseMove = () => {
  const v = videoRef.current;
  if (!v) return;

  // 1. Show controls temporarily (Existing logic)
  setShowControls(true);
  showControlsTemporarily();

  // 2. Hide paused info + dim temporarily if it's currently showing
  if (showPausedInfo) {
    setShowPausedInfo(false);
    setDimVideo(false);
  }

  // 3. Clear any existing re-show timer
  if (mouseMoveTimer.current) {
    window.clearTimeout(mouseMoveTimer.current);
    mouseMoveTimer.current = null;
  }

  // 4. ONLY start a re-show timer IF the video is paused
  if (v.paused) {
    mouseMoveTimer.current = window.setTimeout(() => {
      // Re-show the paused info and dim effect
      setShowPausedInfo(true);
      setDimVideo(true);
      mouseMoveTimer.current = null;
    }, 2000) as unknown as number; // 2 seconds delay to re-show
  }
};
  // inside VideoPlayerModal.tsx
useEffect(() => {
  const handleFullscreenChange = () => {
    const fsElement =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement;

    setIsFullscreen(!!fsElement);
  };

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("msfullscreenchange", handleFullscreenChange);

  return () => {
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.removeEventListener("msfullscreenchange", handleFullscreenChange);
  };
}, []);


  // Menus
  type Menu = null | "subs" | "quality" | "settings";
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const [isMenuFading, setIsMenuFading] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"speed" | "audio" | "quality">("speed");
  const [isSpinning, setIsSpinning] = useState(false);


useClickOutside(
  menuPanelRef,
  () => {
    closeMenu();
  },
  !!openMenu
);




  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const [showResumeOverlay, setShowResumeOverlay] = useState(false);
  const [showUpNextOverlay, setShowUpNextOverlay] = useState(false);

  // volume overlay
  const [showVolumeOverlay, setShowVolumeOverlay] = useState(false);
  const [volumeOverlayValue, setVolumeOverlayValue] = useState<number>(Math.round(volume * 100));
  const [showVolumePanel, setShowVolumePanel] = useState(false);

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
    }, OVERLAY_DURATION);
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
    }, OVERLAY_DURATION);
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

useEffect(() => {
  if (openMenu) {
    setIsMenuFading(false); // reset fade state when opening
  }
}, [openMenu]);


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
            const label = lvl?.height
              ? `${lvl.height}p`
              : lvl?.bitrate
              ? `${Math.round(lvl.bitrate / 1000)}kbps`
              : `Level ${idx + 1}`;
            return { label, url: lvl?.url || `${video.videoUrl}#level=${idx}` };
          });

          setQualityList(qlist);
          setSelectedQualityIndex(-1); // -1 = Auto
        
          // audio tracks (include a "Default" top option in the state array for easy cycling)
                // 1️⃣ Create a readable language name map
          const languageMap: Record<string, string> = {
            en: "English",
            es: "Spanish",
            fr: "French",
            de: "German",
            it: "Italian",
            pt: "Portuguese",
            ru: "Russian",
            pl: "Polish",
            nl: "Dutch",
            sv: "Swedish",
            ja: "Japanese",
            ko: "Korean",
            zh: "Chinese (Mandarin)",
            hi: "Hindi",
            ar: "Arabic",
            bn: "Bengali",
            ur: "Urdu",
            ta: "Tamil",
            tr: "Turkish",
          };

          // 2️⃣ Pull tracks from HLS, or fallback to your static ones
          const hlsTracks = (hls as any).audioTracks || [];
          let mergedTracks: AudioTrackItem[] = [];

          if (hlsTracks.length > 1) {
            // Real multiple audio tracks exist
            mergedTracks = hlsTracks.map((t: any, idx: number) => {
              let displayName = t.name?.trim();
            
              // Use language code mapping if needed
              if (!displayName && t.lang) {
                const langCode = t.lang.toLowerCase();
                displayName = languageMap[langCode] || t.lang;
              }
            
              return {
                id: idx,
                name: displayName || `Track ${idx + 1}`,
                lang: t.lang,
              };
            });
          } else if (video.audioTracks?.length) {
            // Fallback to metadata-defined tracks
            mergedTracks = video.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.label || languageMap[t.lang?.toLowerCase() || ""] || t.lang || `Track ${idx + 1}`,
              lang: t.lang,
            }));
          }

          // 3️⃣ Add Auto/Default as top item
          setAudioTracks([{ id: "default", name: "Auto / Default" }, ...mergedTracks]);
          setSelectedAudioTrack("default");

          // === 🎛 Auto-Sync Audio Track (HLS ↔ UI) ===
          try {
            const onAudioTrackSwitched = () => {
              const currentIdx = (hls as any).audioTrack;
              const found = (mergedTracks || []).find((t) => t.id === currentIdx);
            
              if (found) {
                setSelectedAudioTrack(currentIdx);
              } else {
                setSelectedAudioTrack("default");
              }
            
              console.log("[hls] audio switched →", currentIdx);
            };
          
            const onAudioTracksUpdated = () => {
              const cur = (hls as any).audioTrack;
              const found = (mergedTracks || []).find((t) => t.id === cur);
              setSelectedAudioTrack(found ? cur : "default");
            };
          
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
          } catch (err) {
            console.warn("Failed to wire audio-switch events:", err);
          }



        } catch (err) {
          console.warn("Failed to parse manifest levels/audio:", err);
          setQualityList(video.qualities ?? []);
          setSelectedQualityIndex(-1);
          setAudioTracks([]);
          setSelectedAudioTrack("default");
        }
        setLoading(false);
        setErrorMessage(null);
      });
      

      // Friendly HLS error handling with retry messages
      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data) return;
      
        // Default: clear any previous non-fatal messages
        // We only set a persistent error on fatal / unrecoverable problems
        if (!data.fatal) {
          // Non-fatal events: show a soft notice then clear after a short delay
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setErrorMessage("Network issue — attempting to reconnect...");
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setErrorMessage("Playback hiccup — trying to recover...");
          } else {
            setErrorMessage("Encountered a recoverable error...");
          }
        
          // Clear soft message after a short timeout unless it's replaced by another
          window.setTimeout(() => {
            setErrorMessage((cur) =>
              cur && cur.includes("attempting") ? null : cur
            );
          }, 4000);
        
          return;
        }
      
        // Fatal errors: try to handle common cases first, otherwise show persistent error
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // try restarting load — Hls will attempt to fetch segments again
            setErrorMessage("Network error — retrying...");
            console.warn("HLS network error, attempting startLoad()");
            try {
              hls.startLoad();
            } catch (err) {
              console.error("startLoad failed", err);
            }
            break;
          
          case Hls.ErrorTypes.MEDIA_ERROR:
            // try media recovery first
            setErrorMessage("Playback error — attempting media recovery...");
            console.warn("HLS media error, attempting recoverMediaError()");
            try {
              hls.recoverMediaError();
            } catch (err) {
              console.error("recoverMediaError failed", err);
            }
            break;
          
          default:
            // Unrecoverable: destroy & surface a persistent error with a CTA
            console.error("Fatal HLS error:", data);
            setErrorMessage("Playback error. Please reload or try a different title.");
            setLoading(false);
            try {
              hls.destroy();
            } catch {}
            break;
        }
      });


      return () => {
        if (hlsRef.current) {
          try {
            hlsRef.current.destroy();
          } catch {}
          hlsRef.current = null;   // ✅ clear the ref too
        }
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
    
      // 🎬 Apply persisted subtitle track after metadata is available
      if (activeSubtitle !== undefined) {
        handleSubtitleChange(activeSubtitle);
      }
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

  logAnalytics("session_start", {
    videoId: video.id,
    title: video.title,
  });

  const onLoadedMetadata = () => {
  if (v.duration && isFinite(v.duration)) {
    setDuration(v.duration);
  }
  };


const onPlay = () => {
    setIsPlaying(true);
    setShowPausedInfo(false); 
    setDimVideo(false); // <--- ADD THIS LINE HERE (or ensure it's already there)

    // Clear ALL pending "show info" timeouts/refs
    if (pausedInfoTimeout.current) {
        clearTimeout(pausedInfoTimeout.current);
        pausedInfoTimeout.current = null;
    }
    if (mouseMoveTimer.current) {
        clearTimeout(mouseMoveTimer.current);
        mouseMoveTimer.current = null;
    }

    logAnalytics("video_play", { currentTime: v.currentTime });
};


  const onPause = () => {
      setIsPlaying(false);
      logAnalytics("video_pause", { currentTime: v.currentTime });

      // 1. Clear any immediate re-show timer just in case
      if (mouseMoveTimer.current) {
          clearTimeout(mouseMoveTimer.current);
          mouseMoveTimer.current = null;
      }

      // 2. Start the 10-second timer to show overlay + dim
      if (!pausedInfoTimeout.current) {
        pausedInfoTimeout.current = window.setTimeout(() => {
          setShowPausedInfo(true);
          setDimVideo(true);
          pausedInfoTimeout.current = null;
        }, 10000);
      }

  };

  const onTime = () => {
    setCurrentTime(v.currentTime);
    if (v.duration && v.duration > 0 && isFinite(v.duration)) {
      setProgressPercent((v.currentTime / v.duration) * 100);
    }

    // Heartbeat every 15 seconds
    const now = Date.now();
    if (now - lastHeartbeat > 15000) {
      logAnalytics("video_heartbeat", {
        currentTime: v.currentTime,
        duration: v.duration,
      });
      lastHeartbeat = now;
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
    logAnalytics("video_end", { duration: v.duration });
  };

  const onSeeked = () => {
    setLoading(false);
    logAnalytics("video_seek", { newTime: v.currentTime });
  };

  const onVolumeChange = () => {
    logAnalytics("video_volume", { volume: v.volume, muted: v.muted });
  };

  const onError = () => {
    setErrorMessage("Playback error occurred");
    logAnalytics("video_error", { error: "Playback error" });
  };

  const onWaiting = () => {
    setLoading(true);
    logAnalytics("video_buffering_start", { currentTime: v.currentTime });
  };

  const onPlaying = () => {
    setLoading(false);
    logAnalytics("video_buffering_end", { currentTime: v.currentTime });
  };

  let lastHeartbeat = 0;

  v.addEventListener("play", onPlay);
  v.addEventListener("pause", onPause);
  v.addEventListener("timeupdate", onTime);
  v.addEventListener("progress", onProgress);
  v.addEventListener("ended", onEnded);
  v.addEventListener("seeked", onSeeked);
  v.addEventListener("volumechange", onVolumeChange);
  v.addEventListener("error", onError);
  v.addEventListener("waiting", onWaiting);
  v.addEventListener("playing", onPlaying);
  v.addEventListener("loadedmetadata", onLoadedMetadata);

  return () => {
      if (pausedInfoTimeout.current) {
        clearTimeout(pausedInfoTimeout.current);
        pausedInfoTimeout.current = null;
      }
      // 🧹 NEW: Clear the mouse re-show timer on component unmount
      if (mouseMoveTimer.current) {
          clearTimeout(mouseMoveTimer.current);
          mouseMoveTimer.current = null;
      }
    logAnalytics("session_end", {
      videoId: video.id,
      title: video.title,
      lastTime: v.currentTime,
    });

    v.removeEventListener("play", onPlay);
    v.removeEventListener("pause", onPause);
    v.removeEventListener("timeupdate", onTime);
    v.removeEventListener("progress", onProgress);
    v.removeEventListener("ended", onEnded);
    v.removeEventListener("seeked", onSeeked);
    v.removeEventListener("volumechange", onVolumeChange);
    v.removeEventListener("error", onError);
    v.removeEventListener("waiting", onWaiting);
    v.removeEventListener("playing", onPlaying);
    v.removeEventListener("loadedmetadata", onLoadedMetadata);
  };
}, [autoPlayNext, episodes, activeEpisodeIndex, video.id]);

 /* ---------------- VTT thumbnails load ---------------- */
  useEffect(() => {
    if (!thumbnailsVtt) {
      setVttCues([]);
      return;
    }
  
    const ac = new AbortController();
  
    fetch(thumbnailsVtt, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => setVttCues(parseVtt(text)))
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("Failed to load VTT thumbnails:", err);
          setVttCues([]);
        }
      });
    
    return () => ac.abort(); // ✅ cleanup to avoid leaks
  }, [thumbnailsVtt]);
  

  // Updated togglePlay: unified toggling + flash overlays + show controls + cursor transient
const togglePlay = (clientX?: number, clientY?: number) => {
  console.log("[player] togglePlay called, paused:", videoRef.current?.paused, "loading:", loading, "error:", errorMessage);
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

const handleSubtitleChange = (lang: string | null) => {
  setActiveSubtitle(lang);
  const v = videoRef.current;
  if (!v) return;

  // 🎞️ Update video text tracks visibility
  Array.from(v.textTracks || []).forEach((track) => {
    const trackLang = (track as any).language || (track as any).label || "";
    (track as any).mode = trackLang === (lang || "") ? "showing" : "hidden";
  });

  // 💾 Save user preference
  try {
    const key = settingsKey(video);
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.activeSubtitle = lang;
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch (err) {
    console.warn("Failed to save subtitle setting:", err);
  }

  // 📊 Analytics
  logAnalytics("subtitle_toggle", { lang, enabled: lang !== null });

  // 🗣️ Show overlay feedback
  const selected = subtitleTracks.find((s) => s.lang === lang);
  const label = selected ? (selected.label || selected.lang) : "Off";
  showLanguageOverlay("subtitle", label);

  // 🔒 Close menu
  closeMenu();
};

  // menu toggles
  const toggleMenu = (m: Menu) => {
    setOpenMenu((prev) => (prev === m ? null : m));
    if (m === "settings") setSettingsTab("speed");
  };

  // 🔵 Control fullscreen entry/exit (used by F key or button)
const requestFullscreen = (el: HTMLElement) => {
  const anyEl = el as any;
  if (anyEl.requestFullscreen) return anyEl.requestFullscreen();
  if (anyEl.webkitRequestFullscreen) return anyEl.webkitRequestFullscreen();
  if (anyEl.msRequestFullscreen) return anyEl.msRequestFullscreen();
};

const exitFullscreen = () => {
  const doc: any = document;
  if (doc.exitFullscreen) return doc.exitFullscreen();
  if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen();
  if (doc.msExitFullscreen) return doc.msExitFullscreen();
};

// 🎛 Unified menu-closing helper
const closeMenu = (delay = 200) => {
  setIsMenuFading(true);
  setTimeout(() => {
    setOpenMenu(null);
    setIsMenuFading(false);
  }, delay);
};

// Toggle helper (for F key and button)
const toggleFullscreen = () => {
  const el = containerRef.current;
  if (!el) return;

  const fsElement =
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement;

  if (!fsElement) requestFullscreen(el);
  else exitFullscreen();
};


/* ---------------- Keyboard Shortcuts ---------------- */

const onKey = useCallback(
  (e: KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;

    // Ignore inputs / textareas / editable elements
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (
      tag === "input" ||
      tag === "textarea" ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return;
    }

    // --- Helper functions ---
    const requestFullscreen = (el: HTMLElement) => {
      const anyEl = el as any;
      if (anyEl.requestFullscreen) return anyEl.requestFullscreen();
      if (anyEl.webkitRequestFullscreen) return anyEl.webkitRequestFullscreen();
      if (anyEl.msRequestFullscreen) return anyEl.msRequestFullscreen();
    };

    const exitFullscreen = () => {
      const doc: any = document;
      if (doc.exitFullscreen) return doc.exitFullscreen();
      if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen();
      if (doc.msExitFullscreen) return doc.msExitFullscreen();
    };

    switch (e.code) {
      /* ▶️ Play / Pause */
      case "Space":
        e.preventDefault();
        togglePlay(window.innerWidth / 2, window.innerHeight / 2);
        break;

      /* ⛶ Fullscreen */
      case "KeyF":
        e.preventDefault();
        toggleFullscreen();
        break;


      /* 🔇 Mute / Unmute */
      case "KeyM":
        e.preventDefault();
        const newMuted = !v.muted;
        v.muted = newMuted;
        setIsMuted(newMuted);
        showVolOverlay(newMuted ? 0 : v.volume);
        break;

      /* ⏩ / ⏪ Skip */
      case "ArrowRight":
        e.preventDefault();
        if (v.duration && isFinite(v.duration)) {
          v.currentTime = Math.min(v.duration, v.currentTime + 5);
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (v.duration && isFinite(v.duration)) {
          v.currentTime = Math.max(0, v.currentTime - 5);
        }
        break;

      /* 🔊 Volume */
      case "ArrowUp":
        e.preventDefault();
        const volUp = clamp(v.volume + 0.05, 0, 1);
        v.volume = volUp;
        v.muted = false;
        setVolume(volUp);
        setIsMuted(false);
        showVolOverlay(volUp);
        break;

      case "ArrowDown":
        e.preventDefault();
        const volDown = clamp(v.volume - 0.05, 0, 1);
        v.volume = volDown;
        setVolume(volDown);
        if (volDown === 0) {
          v.muted = true;
          setIsMuted(true);
        }
        showVolOverlay(volDown);
        break;

      /* 🖼 Picture-in-Picture */
      case "KeyP":
        e.preventDefault();
        try {
          if ("requestPictureInPicture" in v) {
            (v as any).requestPictureInPicture().catch(() => {});
          }
        } catch {}
        break;

      /* 💬 Toggle Subtitles */
      case "KeyC":
        e.preventDefault();
        if (!subtitleTracks?.length) return;
        if (activeSubtitle === null) {
          handleSubtitleChange(subtitleTracks[0].lang);
        } else {
          handleSubtitleChange(null);
        }
        break;

      /* 🎧 Cycle Audio Tracks */
      case "KeyD":
        e.preventDefault();
        if (!audioTracks?.length) return;
        const idx = audioTracks.findIndex(
          (a) => a.id === selectedAudioTrack
        );
        const next = audioTracks[(idx + 1) % audioTracks.length];
        if (next) handleAudioSwitch(next.id);
        break;

      /* ❌ Close / Exit */
      case "Escape":
        e.preventDefault();
        onClose();
        break;

      /* ⏩ Jump to percentage (0–9) */
      default:
        if (e.code.startsWith("Digit")) {
          const digit = Number(e.code.replace("Digit", ""));
          if (!isNaN(digit) && v.duration && isFinite(v.duration)) {
            v.currentTime = (v.duration * digit) / 10;
          }
        }
        break;
    }
  },
  [
    togglePlay,
    setIsMuted,
    showVolOverlay,
    setVolume,
    handleSubtitleChange,
    handleAudioSwitch,
    activeSubtitle,
    subtitleTracks,
    audioTracks,
    selectedAudioTrack,
    onClose,
  ]
);

// ✅ Attach listener only once per stable `onKey`
useEffect(() => {
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [onKey]);

  /* ---------------- UI handlers ---------------- */
  // ✅ Fix stop() to accept all React events safely
  const stop = (e?: Event | React.SyntheticEvent) => {
    if (e && "stopPropagation" in e && typeof (e as any).stopPropagation === "function") {
      (e as any).stopPropagation();
    }
  };


// 🎧 Handle Audio Track Selection
function handleAudioChange(trackId: number | "default") {
  // 🔹 Switch the actual audio stream (HLS or native)
  handleAudioSwitch(trackId);

  // 🔹 Update local state
  setSelectedAudioTrack(trackId);

  // 🔹 Show audio language overlay
  const selected = audioTracks.find((a) => a.id === trackId);
  if (selected) {
    showLanguageOverlay("audio", selected.name);
  }

  // 🔹 Close the menu with fade animation
  closeMenu();
}

  // ✅ Fix handleVideoClick to support both Mouse & Touch events
  let lastTapTime = 0; // 🔹 Store last tap timestamp
  const TAP_THRESHOLD = 300; // ms — ignore taps that occur too close together

  const handleVideoClick = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapTime < TAP_THRESHOLD) {
      console.log("[player] Ignored quick double-tap");
      return; // 🚫 Skip rapid consecutive taps
    }
    lastTapTime = now;

    const target = e.target as HTMLElement;

    // 🧠 Ignore clicks inside UI controls or overlays
    if (
      target.closest("button") ||
      target.closest("input[type='range']") ||
      target.closest("[role='menu']") ||
      target.closest("[data-tooltip]") ||
      target.closest("[data-ignore-toggle]") ||
      target.closest(`.${styles.controlsWrap}`) ||
      target.closest(`.${styles.resumeBox}`) ||
      target.closest(`.${styles.upNextBox}`)
    ) {
      return; // ⛔ Do nothing if click is inside interactive UI
    }

    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // 🌀 Trigger ripple instantly for feedback
    triggerRipple(clientX, clientY);

    // ▶️ Then toggle playback
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

  // --- helper to constrain between 0–1
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  
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
  
  // ✅ NEW: Cleanup any leftover listeners if component unmounts
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", () => {});
      document.removeEventListener("mouseup", () => {});
    };
  }, []);
  

  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    const normalized = clamp(val, 0, 1);
    
    setVolume(normalized);
    setIsMuted(normalized === 0);
    
    if (v) {
      v.volume = normalized;
      v.muted = normalized === 0;
    }
    
    try {
      const key = settingsKey(video);
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.volume = normalized;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (err) {
      console.warn("Failed to save volume setting:", err);
    }
    
    showVolOverlay(normalized);
  };

  const getVolumeIconName = () => {
    if (isMuted || volume === 0) return "volume-off";
    if (volume <= 0.35) return "volume-low";
    if (volume <= 0.70) return "volume-medium";
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
    


  };

  // Close menus if clicking outside
useClickOutside(
  menuPanelRef,
  () => {
    closeMenu();
  },
  openMenu === "settings"
);


useClickOutside(
  subsMenuPanelRef,
  () => {
  closeMenu();
  },
  openMenu === "subs" // Only active when Subtitles is open
);


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

  const closeVisible = showControls || !isPlaying || openMenu !== null;

  return (
    <motion.div
     variants={backdropVariants}
     initial="hidden" 
     animate="visible" 
     exit="exit"
      ref={containerRef}
      className={`${styles.overlay} fixed inset-0 z-50 flex items-center justify-center`}
      role="dialog"
      aria-label={`Video player: ${video.title}`}
       onMouseMove={handleMouseMove}
    >
      {/* backdrop close */}
      <div 
        className="absolute inset-0 bg-black/90" 
        onClick={() => onClose()}
        aria-label="Close player" 
      />

      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={modalTransition}
        
        
        onMouseMove= {() => showControlsTemporarily()}
        onPointerDown={handleVideoClick}
        className={styles.videoContainer}
        style={{ maxHeight: "100vh", maxWidth: "100vw", position: "relative" }}
        
      >
        {/* Close button - positioned absolutely at top-right */}
        <div
          className={`${styles.closeButtonWrapper} ${closeVisible ? styles.closeVisible : styles.closeHidden}`}
          aria-hidden={!closeVisible}
        >
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
            <Icon name="close" className={`${styles.iconBase} ${styles.iconXLarge}`} />
          </button>
        </div>

        {/* video element */}
        <video
          ref={videoRef}
          className={styles.videoElement}
          playsInline
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
        {/* --- Dim overlay --- */}
        <div className={`${styles.dimOverlay} ${dimVideo ? "" : styles.hide}`} />

        {/* --- Paused Info Overlay --- */}
        {video && (
          <div
            className={`${styles.pausedInfoOverlay} ${
              showPausedInfo ? "" : styles.hide
            }`}
          >
            <div className={styles.pausedInfoText}>
              <div className={styles.pausedLabel}>You're watching</div>
              <div className={styles.pausedTitle}>
                {video.title} {video.year ? `(${video.year})` : ""}
              </div>
              {getSeriesInfo(video) && (
                <div className={styles.pausedEpisode}>{getSeriesInfo(video)}</div>
              )}
              {video.description && (
                <div className={styles.pausedDescription}>{video.description}</div>
              )}
            </div>
          </div>
        )}



  
        {ripple && (
          <span
            key={ripple.id}
            className={styles.rippleEffect}
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
            }}
          />
        )}


                {/* 🗣 Live Language Overlay */}
        {langOverlay && (
          <div className={styles.langOverlay}>
            <div
              className={`${styles.langOverlayBox} ${
                langOverlay.type === "audio" ? styles.langAudio : styles.langSubtitle
              }`}
            >
              <span className={styles.langIcon}>
                <Icon
                  name={langOverlay.type === "audio" ? "audio-track" : "subtitles"}
                  className={styles.langIconSvg}
                />
              </span>
              <span>{langOverlay.label}</span>                         
            </div>
          </div>
        )}



        {/* Central video area click/tap */}


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

        {/* Loading spinner */}
        {loading && (
          <div 
            className={styles.spinnerOverlay} 
            role="status" 
            aria-live="polite" 
            style={{ pointerEvents: "none" }}
          >
            <Icon name="spinner" className={`${styles.iconBase} ${styles.iconXLarge} ${styles.iconRed} animate-spin`} />
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
        <div
          className={`${styles.controlsWrap} ${
            showControls || !isPlaying ? styles.controlsVisible : styles.controlsHidden
          }`}
        >

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
                {/* Play / Pause button */}
                <button
                  className={styles.iconButton}
                  data-tooltip={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  onClick={(e) => { 
                    stop(e); 
                    togglePlay(e.clientX, e.clientY); 
                  }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  <Icon
                    name={isPlaying ? "pause" : "play"}
                    className={`${styles.iconMLarge}`}
                  />
                </button>
                
                {/* ⏪ Backward 10s */}
                <button
                    className={styles.iconButton}
                    data-tooltip="Rewind 10s (←)"
                    onClick={(e) => {
                        stop(e);
                        const v = videoRef.current;
                        if (v) v.currentTime = Math.max(0, v.currentTime - 10);
                    }}
                >
                    <Icon name="backward-10" className={`${styles.iconSkip}`} />
                </button>
                  
                {/* ⏩ Forward 10s */}
                <button
                    className={styles.iconButton}
                    data-tooltip="Forward 10s (→)"
                    onClick={(e) => {
                        stop(e);
                        const v = videoRef.current;
                        if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10);
                    }}
                >
                    <Icon name="forward-10" className={`${styles.iconSkip} ${styles.iconWhite}`} />
                </button>

                {/* 🔊 Volume controls */}
                <div
                  className={styles.volumeGroup}
                  onMouseEnter={() => setShowVolumePanel(true)}
                  onMouseLeave={() => setShowVolumePanel(false)}
                >
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
                    <Icon
                      name={isMuted ? "volume-off" : getVolumeIconName()}
                      className={`${styles.iconBase} ${styles.iconMLarge}`}
                    />
                  </button>
                  
                  {showVolumePanel && (
                    <input
                      className={styles.volumeSlider}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={isMuted ? 0 : Math.round(volume * 100)}
                      onChange={(e) => {
                        stop(e);
                        const val = parseFloat(e.currentTarget.value);
                        handleVolumeChange(val / 100);
                      }}
                      style={{
                        '--vol-percent': `${isMuted ? 0 : volume * 100}%`,
                      } as React.CSSProperties}
                      aria-label="Volume"
                    />
                  )}
                </div>
                
                {/* 🕒 Time Display */}
                <span className={styles.timeDisplay}>
                  {formatTime(currentTime)} / {formatTime(duration || 0)}
                </span>
              </div>

              {/* Middle side controls */}
              <div className={styles.groupMiddle}>
                {/* 🎬 Centered Now Playing Title */}
                {video && (
                  <div className={styles.centerNowPlayingTitle}>
                    {video.type === "series" ? (
                      <span className={styles.episodeTag}>S1.E1</span>
                    ) : (
                      <span className={styles.movieTag}>Movie</span>
                    )}

                    <span className={styles.titleText}>
                      {video.title.length > 22
                        ? `${video.title.substring(0, 22)}...`
                        : video.title}
                    </span>
                  </div>
                )}
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
                    <Icon name="subtitles" className={`${styles.iconBase} ${styles.iconMLarge}`} />
                  </button>
                  
                  {openMenu === "subs" && (
                    <div ref={subsMenuPanelRef} className={`${styles.menuPanel} ${isMenuFading ? styles.fadeOut : styles.show}`} onClick={stop}>
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
                
                {/* Settings menu */}
                <div className={styles.dropdownWrap}>
                  <button
                    className={styles.iconButton}
                    data-tooltip="Settings"
                    onClick={(e) => {
                      stop(e);
                      setIsSpinning(true);
                      setTimeout(() => setIsSpinning(false), 700);
                      toggleMenu("settings");
                      setSettingsTab("speed");
                    }}
                    aria-label="Settings"
                  >
                    <Icon
                      name="settings"
                      className={`${styles.iconSettings} ${styles.iconMLarge} ${isSpinning ? styles.iconSettingsSpin : ""}`}
                    />
                  </button>
                  
                  {openMenu === "settings" && (
                    <div ref={menuPanelRef} className={`${styles.menuPanel} ${isMenuFading ? styles.fadeOut : styles.show}`} onClick={stop}>
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
                        <button
                          className={`${styles.settingsTab} ${settingsTab === "quality" ? styles.settingsTabActive : ""}`}
                          onClick={() => setSettingsTab("quality")}
                        >
                          Quality
                        </button>
                      </div>

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
                              className={`${styles.menuItem} ${selectedAudioTrack === "default" ? styles.menuItemActive : ""}`}
                              onClick={() => handleAudioChange("default")}
                            >
                              Default
                            </button>
                        
                            {audioTracks.length > 0 ? (
                              audioTracks.map((track) => (
                                <button
                                  key={track.id}
                                  className={`${styles.menuItem} ${selectedAudioTrack === track.id ? styles.menuItemActive : ""}`}
                                  onClick={() => handleAudioChange(track.id)}
                                >
                                  {track.name}
                                </button>
                              ))
                            ) : (
                              <div className={styles.menuItem} style={{ opacity: 0.7 }}>
                                No alternate audio
                              </div>
                            )}
                          </>
                        )}

                        {settingsTab === "quality" && (
                          <>
                            <button
                              className={`${styles.menuItem} ${selectedQualityIndex === -1 ? styles.menuItemActive : ""}`}
                              onClick={() => handleQualitySwitch(-1)}
                            >
                              Auto
                            </button>

                            {qualityList.length > 0 ? (
                              qualityList.map((quality, idx) => (
                                <button
                                  key={`${quality.label}-${idx}`}
                                  className={`${styles.menuItem} ${selectedQualityIndex === idx ? styles.menuItemActive : ""}`}
                                  onClick={() => handleQualitySwitch(idx)}
                                >
                                  {quality.label}
                                </button>
                              ))
                            ) : (
                              <div className={styles.menuItem} style={{ opacity: 0.7 }}>
                                No quality options
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
                  data-tooltip={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                  onClick={(e) => {
                    stop(e);
                    try {
                      const el = containerRef.current;
                      if (!el) return;
                      if (!document.fullscreenElement) {
                        el.requestFullscreen().catch(() => {});
                        logAnalytics("fullscreen_enter", {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                        logAnalytics("fullscreen_exit", {});
                      }
                    } catch (err) {
                      console.warn("Fullscreen failed:", err);
                    }
                  }}
                  aria-label="Toggle fullscreen"
                >
                  <Icon 
                    name={isFullscreen ? "fullscreen-exit" : "fullscreen"} 
                    className={`${styles.iconBase} ${styles.iconMLarge }`} 
                  />
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
      </motion.div>
    </motion.div>
  );
}