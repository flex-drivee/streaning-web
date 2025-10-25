import React, { useEffect, useRef,useState } from "react";
import { motion, Variants } from "framer-motion";
import FocusLock from "react-focus-lock";
import { Icon } from "./Icon";
import VideoCarousel from "./VideoCarousel";
import type { Video } from "../types/index";
import styles from "./VideoDetailModal.module.css";

interface VideoDetailModalProps {
  video: Video 
  onClose: () => void;
  onPlay: (video: Video) => void;
}

/* --- Modal animation --- */
const modalFadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 40 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: 0.1,
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 60,
    transition: {
      duration: 0.55,
      ease: [0.4, 0, 0.2, 1],
    },
  },

};

const VideoDetailModal: React.FC<VideoDetailModalProps> = ({
  video,
  onClose,
  onPlay,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [canClose, setCanClose] = useState(false);

  // Delay backdrop close activation for animation stability
  useEffect(() => {
    const t = setTimeout(() => setCanClose(true), 400);
    return () => clearTimeout(t);
  }, []);



  /* --- ESC to close --- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Stop trailer playback on unmount
  useEffect(() => {
    const vid = modalRef.current?.querySelector("video");
    return () => {
      if (vid) {
        vid.pause();
      }
    };
  }, []);
  
  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0, ["--backdrop-blur" as any]: "0px" }}
      animate={{ opacity: 1, ["--backdrop-blur" as any]: "var(--blur-amount)" }}
      exit={{
        opacity: 0,
        ["--backdrop-blur" as any]: "0px",
        transition: { duration: 0.55, delay: 0.15, ease: [0.4, 0, 0.2, 1] },
      }}
      onClick={() => {
         if (!canClose) return; 
          onClose(); 
        }}
    >
      <FocusLock returnFocus>
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={styles.modalContainer}
          variants={modalFadeScale}
          initial="hidden"
          animate="visible"
          exit="exit"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>

          {/* Video Section */}
          <div className={styles.videoSection}>
            {video.trailerUrl ? (
              <video
                src={video.trailerUrl}
                muted
                loop
                playsInline
                autoPlay
                preload="none"
                aria-label={`Trailer for ${video.title || "video"}`}
                className={styles.videoPreview}
              />
            ) : (
              <img
                src={video.thumbnailUrl || "/fallback-thumbnail.jpg"}
                alt={video.title || "Video preview"}
                className={styles.videoPreview}
              />

            )}
            <div className={styles.videoGradient} />
          </div>

          {/* Content */}
          <div className={styles.modalContent}>
            <h2 id="modal-title" className={styles.modalTitle}>
              {video.title}
            </h2>

            <div className={styles.metaInfo}>
              {video.year && <span>{video.year}</span>}
              {video.duration && <span>{video.duration}</span>}
              {video.rating && (
                <span className={styles.rating}>{video.rating}</span>
              )}
              {video.genre && <span className={styles.genre}>{video.genre}</span>}
            </div>

            {video.description && (
              <p className={styles.description}>{video.description}</p>
            )}

            <div className={styles.buttonRow}>
              <button
                onClick={() => onPlay(video)}
                className={`${styles.actionButton} ${styles.playButton}`}
              >
                <Icon name="play" className="w-5 h-5" />
                Play
              </button>
              <button className={styles.iconButton}>
                <Icon name="plus" className="w-5 h-5" />
              </button>
              <button className={styles.iconButton}>
                <Icon name="like" className="w-5 h-5" />
              </button>
              <button className={styles.iconButton}>
                <Icon name="info" className="w-5 h-5" />
              </button>
            </div>

            {video.related && video.related.length > 0 && (
              <div className={styles.relatedSection}>
                <h3 className={styles.relatedTitle}>More Like This</h3>
                <VideoCarousel
                  category="Related"
                  videos={video.related}
                  onPlay={onPlay}
                />
              </div>
            )}
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  );
};

export default VideoDetailModal;
