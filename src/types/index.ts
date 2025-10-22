// -------------------
// src/types/index.ts
// -------------------

export interface SubtitleTrack {
  lang: string;   // e.g. "en", "es"
  url: string;    // subtitle VTT URL
  label: string;  // display label
}

export interface AudioTrack {
  lang: string;   // e.g. "en", "es"
  url: string;    // audio stream URL
  label?: string; // display label
}

export interface QualityOpt {
  label: string;  // e.g. "1080p", "720p"
  url: string;    // video URL for that quality
}

export interface Video {
  id: string;
  type: "movie" | "series";
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
  rating?: string;
  trailerUrl?: string;
  genre?: string;

  subtitleTracks: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  qualities?: QualityOpt[];
  thumbnailsVtt?: string;
  categoryName?: string;

  related?: Video[];

  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  year?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
}

export interface Category {
  id: string | number;
  name: string;
  title: string;
  category: string;
  categoryType: "movie" | "series" | "mixed";
  videos: Video[];
}

export enum Language {
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  ZH = "zh",
}

// ✅ Centralized user type used by AuthContext + AuthService
export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
  token: string;
  expiresAt: number;
  name?: string;
  avatarUrl?: string;
}
