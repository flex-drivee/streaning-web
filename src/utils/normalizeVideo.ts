// src/utils/normalizeVideo.ts
import type { Video as VideoType } from '../types/index';

export function normalizeVideo(raw: any): VideoType {
  // Prefer common id shapes, fall back to a stable string derived from URL
  const rawId = raw?.id ?? raw?.videoId ?? raw?.uuid ?? raw?._id ?? raw?.id_str ?? raw?.idNumber ?? '';
  const fallback = raw?.videoUrl ? btoa(String(raw.videoUrl)).slice(0, 12) : `vid_${Date.now()}`;

  const id = String(rawId ?? fallback);

  return {
    ...raw,
    id,
    title: raw?.title ?? raw?.name ?? 'Untitled',
    videoUrl: raw?.videoUrl ?? raw?.url ?? '',
    thumbnailUrl: raw?.thumbnail ?? raw?.thumb ?? raw?.poster ?? '',
    subtitleTracks: raw?.subtitleTracks ?? raw?.subtitles ?? [],
    qualities: raw?.qualities ?? [],
    skipIntro: raw?.skipIntro,
    thumbnailsVtt: raw?.thumbnailVttUrl ?? raw?.thumbnail_vtt,
    seasonNumber: raw?.seasonNumber,
    episodeNumber: raw?.episodeNumber,
    episodeTitle: raw?.episodeTitle,
    description: raw?.description ?? '',
    year: raw?.year,
    episodes: raw?.episodes ?? [],
  } as VideoType;
}

/**
 * Helper function to format series info
 */
export const getSeriesInfo = (video: VideoType): string | null => {
  if (video.type !== "series") return null;
  if (!video.seasonNumber || !video.episodeNumber) return null;
  return `Season ${video.seasonNumber}, Episode ${video.episodeNumber}${video.episodeTitle ? ` - ${video.episodeTitle}` : ""}`;
};
