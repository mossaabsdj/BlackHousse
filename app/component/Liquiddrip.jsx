"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Liquid drop that forms on the curved bottom edge of the navbar,
 * stretches, detaches and falls. Place it as the LAST child of the <header>
 * (right after the wave <svg>). It is absolutely positioned and ignores clicks.
 *
 * ANCHORS = where drops may form, in the wave's own coordinates:
 *   x = % of the navbar width, y = depth of the wave edge (0 = top, 1 = bottom
 *   of the wave box). They match the path "M0 0H1440V10C1200 30 960 30 720 18S240 6 0 22Z"
 *   (lowest point of the wave = x 75). Update them if you change the wave.
 */
const ANCHORS = [
  { x: 75, y: 0.93 },
];
const DRIP_SECONDS = 3.6; // one full drop: form -> stretch -> detach -> fall
const PAUSE_MIN_MS = 50; // pause between drops = MIN + random(0..RANGE)
const PAUSE_RANGE_MS = 500;

// Shared timeline (progress 0..1 of DRIP_SECONDS)
const T = [0, 0.45, 0.68, 0.74, 1]; // bead: form, stretch, pinch, fall
const T_SHORT = [0, 0.45, 0.68, 0.74, 0.8, 1]; // neck + meniscus: same, then retract
const GRAVITY = [0.5, 0, 1, 0.6];
const EASE_BEAD = ["easeInOut", "easeIn", "linear", GRAVITY];
const EASE_SHORT = ["easeInOut", "easeIn", "linear", "easeOut", "linear"];

export default function LiquidDrip() {
  const reduceMotion = useReducedMotion();
  const [drip, setDrip] = useState(null);

  useEffect(() => {
    if (reduceMotion) return;
    let timer;
    let last = -1;

    const launch = () => {
      let i;
      do {
        i = Math.floor(Math.random() * ANCHORS.length);
      } while (ANCHORS.length > 1 && i === last);
      last = i;
      const { x, y } = ANCHORS[i];
      setDrip({ id: Date.now(), x: x + (Math.random() - 0.5) * 5, y });
      timer = setTimeout(
        launch,
        DRIP_SECONDS * 1000 + PAUSE_MIN_MS + Math.random() * PAUSE_RANGE_MS
      );
    };

    timer = setTimeout(launch, 1200);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  if (reduceMotion || !drip) return null;

  const beadTransition = {
    duration: DRIP_SECONDS,
    times: T,
    ease: EASE_BEAD,
    opacity: { duration: DRIP_SECONDS, times: [0, 0.88, 1], ease: "easeIn" },
  };
  const shortTransition = {
    duration: DRIP_SECONDS,
    times: T_SHORT,
    ease: EASE_SHORT,
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-full -mt-px h-4 sm:h-5"
    >
      <svg
        key={drip.id}
        width="36"
        height="252"
        viewBox="0 -12 36 252"
        className="absolute overflow-visible"
        style={{
          left: `${drip.x}%`,
          top: `${drip.y * 100}%`,
          marginLeft: -18,
          marginTop: -13,
        }}
      >
        <defs>
          {/* "gooey" filter: blur + threshold merges the shapes into one liquid */}
          <filter
            id="navbar-goo"
            filterUnits="userSpaceOnUse"
            x="0"
            y="-12"
            width="36"
            height="252"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -5"
            />
          </filter>
        </defs>

        {/* fill-white = navbar background color */}
        <g className="fill-white" filter="url(#navbar-goo)">
          {/* meniscus on the edge */}
          <motion.ellipse
            cx={18}
            cy={0}
            initial={{ rx: 3, ry: 0 }}
            animate={{ rx: [3, 9, 10, 8, 3, 3], ry: [0, 3.2, 4, 2, 0, 0] }}
            transition={shortTransition}
          />
          {/* neck that stretches, thins and snaps back */}
          <motion.ellipse
            cx={18}
            initial={{ cy: 0, rx: 0, ry: 0 }}
            animate={{
              cy: [0, 7, 12.5, 15.5, 0, 0],
              ry: [0, 7, 12.5, 15.5, 0, 0],
              rx: [0, 3.8, 2.4, 0.9, 0, 0],
            }}
            transition={shortTransition}
          />
          {/* the drop: grows, hangs, detaches, falls with gravity, fades out */}
          <motion.ellipse
            cx={18}
            initial={{ cy: 0, rx: 0.5, ry: 0.5, opacity: 1 }}
            animate={{
              cy: [0, 14, 25, 31, 238],
              rx: [0.5, 5.5, 6, 6, 4.6],
              ry: [0.5, 6, 7.5, 8, 11.5],
              opacity: [1, 1, 0],
            }}
            transition={beadTransition}
          />
        </g>
      </svg>
    </div>
  );
}