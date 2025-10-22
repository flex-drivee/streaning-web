// src/data/videos.ts
import type { Category } from "../types/index";

export const videoData: Category[] = [
  {
    id: "c1",
    name: "Trending Now",
    title: "Trending Now",
    category: "trending",
    categoryType: "mixed",
    videos: [
      // 💡 NEW: Dedicated HLS Multi-Track Test Video
      {
        id: "0-hls-test",
        title: "The Glory",
        description:
          "A robust test stream for HLS functionality, including multiple qualities (ABR), audio tracks, and subtitles.",
        thumbnailUrl:
          "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217",
        videoUrl:
          "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", // ⬅️ The HLS Master Manifest URL
        duration: "00:09:56",
        type: "movie", 
        subtitleTracks: [
          // These test VTT file loading alongside HLS-discovered tracks
          { lang: "en", label: "English", url: "/subtitles/bbb-en.vtt" },
          { lang: "es", label: "Español", url: "/subtitles/bbb-es.vtt" },
        ],
        audioTracks: [
          // Placeholders for HLS-discovered tracks (HLS.js populates the list)
          { lang: "en", label: "Original English", url: "" },
          { lang: "es", label: "Spanish Dub", url: "" },
        ],
        // Qualities are automatically handled by HLS.js, but this ensures your UI renders the options.
        qualities: [ 
            { label: "Auto", url: "auto" }, 
            { label: "High", url: "" },
            { label: "Medium", url: "" }
         ],
        thumbnailsVtt: "/thumbnails/bbb-thumbs.vtt",
      },
      // --- Original Videos Follow ---
      {
        id: "1",
        title: "Big Buck Bunny",
        description:
          "A large and lovable rabbit deals with three mischievous rodents. A classic open-source film by the Blender Foundation.",
        thumbnailUrl:
          "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        duration: "00:09:56",
        type: "movie", // ✅ movie
        subtitleTracks: [
          { lang: "en", label: "English", url: "/subtitles/bbb-en.vtt" },
          { lang: "es", label: "Español", url: "/subtitles/bbb-es.vtt" },
        ],
        audioTracks: [
          {
            lang: "en",
            label: "Original English",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          },
        ],
        thumbnailsVtt: "/thumbnails/bbb-thumbs.vtt",
      },
      {
        id: "2",
        title: "Elephants Dream",
        description:
          "The first open-source animated short film, showcasing the power of Blender and community collaboration.",
        thumbnailUrl:
          "https://orange.blender.org/wp-content/themes/orange/images/media/gallery_001_13.jpg",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        duration: "00:10:53",
        type: "movie", // ✅ movie
        subtitleTracks: [{ lang: "en", label: "English", url: "/subtitles/elephants-en.vtt" }],
        audioTracks: [],
        thumbnailsVtt: "/thumbnails/elephants-thumbs.vtt",
      },
      {
        id: "3",
        title: "Stranger Things",
        description:
          "A love letter to the '80s classics that captivated a generation. Kids uncover a supernatural mystery in their town.",
        thumbnailUrl: "https://i.imgur.com/EQl1Pjb.jpg",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        duration: "00:48:00",
        type: "series", // ✅ series
        subtitleTracks: [],
        audioTracks: [],
      },
    ],
  },
  {
    id: "c2",
    name: "Action & Adventure",
    title: "Action & Adventure",
    category: "action",
    categoryType: "movie",
    videos: [
      {
        id: "4",
        title: "Tears of Steel",
        description:
          "In a futuristic Amsterdam, a group of warriors and scientists fight to save the world from destructive robots.",
        thumbnailUrl:
          "https://mango.blender.org/wp-content/uploads/2012/05/16_thom_celia.jpg",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        duration: "00:12:14",
        type: "movie", // ✅ movie
        subtitleTracks: [],
        audioTracks: [],
        thumbnailsVtt: "/thumbnails/tears-thumbs.vtt",
      },
      {
        id: "5",
        title: "The Boys",
        description:
          "A group of vigilantes set out to take down corrupt superheroes who abuse their powers.",
        thumbnailUrl: "https://i.imgur.com/pz1Z0kW.jpg",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        duration: "00:55:00",
        type: "series", // ✅ series
        subtitleTracks: [],
        audioTracks: [],
      },
    ],
  },
  {
    id: "c3",
    name: "Comedy",
    title: "Comedy",
    category: "comedy",
    categoryType: "series",
    videos: [
      {
        id: "6",
        title: "Brooklyn Nine-Nine",
        description:
          "A fun cop comedy following Jake Peralta and his quirky colleagues at the 99th precinct.",
        thumbnailUrl: "https://i.imgur.com/YpL2f3d.jpg",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        duration: "00:22:00",
        type: "series", // ✅ series
        subtitleTracks: [],
        audioTracks: [],
      },
      {
        id: "7",
        title: "Kung Fury",
        description:
          "A martial artist cop travels back in time to defeat Adolf Hitler, aka Kung Führer.",
        thumbnailUrl: "https://i.imgur.com/jks0sNL.jpg",
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        duration: "00:30:00",
        type: "movie", // ✅ movie
        subtitleTracks: [],
        audioTracks: [],
      },
    ],
  },
];