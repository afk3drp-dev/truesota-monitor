import { useEffect, useCallback } from "react";
import { motion, useAnimation, type Variants } from "motion/react";

export interface AnimatedIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  animateOnHover?: boolean;
  /** Controlled trigger or continuous active state */
  active?: boolean;
  /** Parent-driven hover signal */
  hovered?: boolean;
}

const bellGroupVariants: Variants = {
  initial: { rotate: 0 },
  animate: {
    rotate: [0, 20, -10, 10, -5, 3, 0],
    transformOrigin: "12px 3px",
    transition: { duration: 0.85, ease: "easeInOut" },
  },
};

const bellClapperVariants: Variants = {
  initial: { x: 0 },
  animate: {
    x: [0, -6, 5, -5, 4, -3, 2, 0],
    transition: { duration: 1.0, ease: "easeInOut" },
  },
};

export function AnimatedBell({
  size = 15,
  strokeWidth = 2,
  className = "",
  animateOnHover = true,
  active = false,
  hovered = false,
}: AnimatedIconProps) {
  const controls = useAnimation();

  const trigger = useCallback(() => {
    void controls.start("animate").then(() => controls.set("initial"));
  }, [controls]);

  useEffect(() => {
    if (active || hovered) {
      trigger();
    }
  }, [active, hovered, trigger]);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      variants={bellGroupVariants}
      initial="initial"
      animate={controls}
      onMouseEnter={animateOnHover ? trigger : undefined}
      style={{ display: "block", flexShrink: 0 }}
    >
      <motion.path
        d="M10.268 21a2 2 0 0 0 3.464 0"
        variants={bellClapperVariants}
        initial="initial"
        animate={controls}
      />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </motion.svg>
  );
}

export interface AnimatedRefreshCwProps extends AnimatedIconProps {
  spinning?: boolean;
}

export function AnimatedRefreshCw({
  size = 14,
  strokeWidth = 2,
  className = "",
  animateOnHover = true,
  spinning = false,
  hovered = false,
}: AnimatedRefreshCwProps) {
  const controls = useAnimation();

  const trigger = useCallback(() => {
    if (spinning) return;
    controls.set({ rotate: 0 });
    void controls.start({
      rotate: 360,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    });
  }, [controls, spinning]);

  useEffect(() => {
    if (spinning) {
      void controls.start({
        rotate: 360,
        transition: { duration: 0.85, ease: "linear", repeat: Infinity },
      });
    } else {
      controls.stop();
      controls.set({ rotate: 0 });
    }
  }, [spinning, controls]);

  useEffect(() => {
    if (hovered && !spinning) {
      trigger();
    }
  }, [hovered, spinning, trigger]);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={controls}
      onMouseEnter={animateOnHover ? trigger : undefined}
      style={{ display: "block", flexShrink: 0, originX: "50%", originY: "50%" }}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </motion.svg>
  );
}

export interface AnimatedChevronDownProps extends AnimatedIconProps {
  rotated?: boolean;
}

export function AnimatedChevronDown({
  size = 15,
  strokeWidth = 2,
  className = "",
  rotated = false,
  hovered = false,
}: AnimatedChevronDownProps) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={{
        rotate: rotated ? 180 : 0,
        y: hovered && !rotated ? 1.5 : 0,
      }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="m6 9 6 6 6-6" />
    </motion.svg>
  );
}

export function AnimatedSparkles({
  size = 14,
  strokeWidth = 2,
  className = "",
  animateOnHover = true,
  active = false,
  hovered = false,
}: AnimatedIconProps) {
  const starControls = useAnimation();
  const twinkleControls = useAnimation();

  const trigger = useCallback(() => {
    void starControls.start({
      scale: [1, 1.16, 0.96, 1],
      rotate: [0, 10, -6, 0],
      transition: { duration: 0.65, ease: "easeInOut" },
    });
    void twinkleControls.start({
      scale: [1, 0.45, 1.25, 1],
      opacity: [1, 0.4, 1, 1],
      transition: { duration: 0.65, ease: "easeInOut" },
    });
  }, [starControls, twinkleControls]);

  useEffect(() => {
    if (active || hovered) {
      trigger();
    }
  }, [active, hovered, trigger]);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      onMouseEnter={animateOnHover ? trigger : undefined}
      style={{ display: "block", flexShrink: 0 }}
    >
      <motion.path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        animate={starControls}
        style={{ originX: "12px", originY: "12px" }}
      />
      <motion.g animate={twinkleControls}>
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
        <path d="M4 17v2" />
        <path d="M5 18H3" />
      </motion.g>
    </motion.svg>
  );
}

export function AnimatedDownload({
  size = 14,
  strokeWidth = 2,
  className = "",
  animateOnHover = true,
  active = false,
  hovered = false,
}: AnimatedIconProps) {
  const arrowControls = useAnimation();

  const trigger = useCallback(() => {
    void arrowControls.start({
      y: [0, 3, -1, 0],
      transition: { duration: 0.52, ease: "easeInOut" },
    });
  }, [arrowControls]);

  useEffect(() => {
    if (active || hovered) {
      trigger();
    }
  }, [active, hovered, trigger]);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      onMouseEnter={animateOnHover ? trigger : undefined}
      style={{ display: "block", flexShrink: 0 }}
    >
      <motion.g animate={arrowControls}>
        <path d="M12 15V3" />
        <path d="m7 10 5 5 5-5" />
      </motion.g>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </motion.svg>
  );
}
