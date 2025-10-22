// src/utils/motionConfig.ts
import type { Transition } from "framer-motion";

export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const modalTransition: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 25,
};
