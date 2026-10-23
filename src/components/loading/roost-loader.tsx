"use client";

import { useId, type CSSProperties } from "react";
import styles from "./roost-loader.module.css";

type Props = {
  size?: "small" | "large" | number;
  label?: string;
  className?: string;
};

// Stable scatter avoids hydration mismatches and changes on React re-renders.
// Each fragment has its own flight time, phase and ballistic trajectory.
function scatter(index: number, salt: number) {
  let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

const fragments = Array.from({ length: 24 }, (_, i) => {
  // Six streaks, twelve small chips and six larger broken clods.
  const streak = i % 4 === 0;
  const clod = i % 4 === 1;
  const distance = (clod ? 76 : 106) + scatter(i, 1) * (clod ? 65 : 80);
  const lift = (clod ? 38 : 48) + scatter(i, 2) * (clod ? 70 : 100);
  const gravity = 18 + scatter(i, 3) * Math.min(46, lift * 0.5);
  const length = streak
    ? 17 + scatter(i, 4) * 17
    : clod
      ? 8 + scatter(i, 4) * 7
      : 2.5 + scatter(i, 4) * 4;
  const thickness = streak
    ? 0.7 + scatter(i, 5) * 1.5
    : length * (0.48 + scatter(i, 5) * 0.26);
  const shape = streak
    ? `M${-length} ${-thickness * 0.35} 0 0 ${-length * 0.3} ${thickness} ${-length * 0.75} ${thickness * 0.45}Z`
    : `M0 0 ${-length * 0.19} ${-thickness * 0.56} ${-length * 0.51} ${-thickness * 0.7} ${-length * 0.65} ${-thickness * 0.38} ${-length} ${-thickness * 0.21} ${-length * 0.91} ${thickness * 0.26} ${-length * 0.59} ${thickness * 0.57} ${-length * 0.36} ${thickness * 0.39} ${-length * 0.12} ${thickness * 0.43}Z`;
  const angle = (Math.atan2(lift, distance) * 180) / Math.PI;
  const variables: Record<string, string> = {};
  for (const [step, t] of [
    ["q", 0.25],
    ["m", 0.5],
    ["t", 0.75],
    ["d", 1],
  ] as const) {
    variables[`--${step}x`] = `${-distance * t}px`;
    variables[`--${step}y`] = `${-lift * t + gravity * t * t}px`;
  }
  return {
    origin: `translate(${216 + scatter(i, 6) * 5} ${175 + scatter(i, 7) * 3})`,
    shape,
    highlight: clod
      ? `M${-length * 0.2} ${-thickness * 0.33} ${-length * 0.5} ${-thickness * 0.49} ${-length * 0.69} ${-thickness * 0.16} ${-length * 0.43} ${-thickness * 0.2}Z`
      : undefined,
    fill: ["#78543D", "#61422f", "#9b7352", "#876047"][
      Math.floor(scatter(i, 8) * 4)
    ],
    style: {
      ...variables,
      "--angle": `${angle}deg`,
      "--end-angle": `${(Math.atan2(lift - 2 * gravity, distance) * 180) / Math.PI + (scatter(i, 9) - 0.5) * (streak ? 25 : 190)}deg`,
      "--duration": `${0.52 + scatter(i, 10) * 0.67}s`,
      "--delay": `${-scatter(i, 11) * 8}s`,
      "--scale": 0.65 + scatter(i, 12) * 0.65,
    } as CSSProperties,
  };
});

// The bike faces right: clockwise rotation sends the contact patch backwards.
// No timer or loading state is owned here. Mount only while work is pending.
export function RoostLoader({
  size = "large",
  label = "Loading",
  className = "",
}: Props) {
  const id = useId().replace(/:/g, "");
  const metal = `${id}-metal`;
  const rubber = `${id}-rubber`;
  const width = typeof size === "number" ? size : size === "small" ? 88 : 280;
  return (
    <span
      className={`${styles.loader} ${className}`}
      role="status"
      style={{ width }}
    >
      <span className={styles.srOnly}>{label}</span>
      <svg viewBox="0 32 292 157" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={metal} x1="0" y1="0" x2="0.3" y2="1">
            <stop stopColor="#FAF9F6" />
            <stop offset=".35" stopColor="#c5c1b7" />
            <stop offset=".52" stopColor="#faf9f6" />
            <stop offset="1" stopColor="#66665f" />
          </linearGradient>
          <radialGradient id={rubber}>
            <stop offset=".7" stopColor="#272725" />
            <stop offset=".87" stopColor="#454540" />
            <stop offset="1" stopColor="#191918" />
          </radialGradient>
        </defs>
        <g className={styles.roost}>
          {[0, 1].map((i) => (
            <g
              key={`trail-${i}`}
              transform={`rotate(${-14 + scatter(i, 20) * 42} 218 177)`}
            >
              <path
                className={styles.trail}
                style={
                  {
                    animationDelay: `${-scatter(i, 21) * 5}s`,
                    animationDuration: `${0.46 + scatter(i, 22) * 0.53}s`,
                    "--reach": 0.62 + scatter(i, 23) * 0.5,
                  } as CSSProperties
                }
                d="M219 178Q176 169 99 111Q145 144 185 160L170 143 201 169Z"
                fill={i % 2 ? "#9b7352" : "#78543D"}
              />
            </g>
          ))}
          {fragments.map((fragment, i) => (
            <g key={i} transform={fragment.origin}>
              <g className={styles.particle} style={fragment.style}>
                <path d={fragment.shape} fill={fragment.fill} />
                {fragment.highlight && (
                  <path d={fragment.highlight} fill="#b18b68" opacity=".65" />
                )}
              </g>
            </g>
          ))}
          <path
            className={styles.contact}
            d="m224 178-20-4-26-13 16 13-34-7 32 11-21 1 33 2Z"
            fill="#78543D"
          />
        </g>
        <g className={styles.wheel}>
          <circle
            cx="220"
            cy="112"
            r="54.5"
            stroke={`url(#${rubber})`}
            strokeWidth="15"
          />
          {Array.from({ length: 32 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 11.25} 220 112)`}>
              <path
                d="m215 46 9-1 3 8-11 1Z"
                fill="#272725"
                stroke="#141413"
                strokeWidth="1.3"
              />
              <path d="m216 47 7-1 1 2-8 1Z" fill="#74736a" />
              <path
                d="m225 51 5 1 1 6-6-1Z"
                fill="#454540"
                stroke="#191918"
                strokeWidth="1"
              />
              <path
                d="m210 52 4-1 1 7-5 1Z"
                fill="#55554d"
                stroke="#191918"
                strokeWidth="1"
              />
            </g>
          ))}
          <circle cx="220" cy="112" r="49" stroke="#161615" strokeWidth="5" />
          <circle
            cx="220"
            cy="112"
            r="46"
            stroke={`url(#${metal})`}
            strokeWidth="4"
          />
          <circle cx="220" cy="112" r="42.7" stroke="#73756e" strokeWidth="1" />
          {Array.from({ length: 18 }, (_, i) => (
            <g
              key={i}
              transform={`rotate(${i * 20} 220 112)`}
              strokeLinecap="round"
            >
              <path
                d="m216 104-10-33m19 35 10-31"
                stroke="#191918"
                strokeWidth="2.3"
              />
              <path
                d="m216 104-10-33m19 35 10-31"
                stroke="#cfcec4"
                strokeWidth="1"
              />
              <path d="m206 71 1 4m28 0-1 4" stroke="#faf9f6" strokeWidth="2" />
            </g>
          ))}
          <circle
            cx="220"
            cy="112"
            r="11"
            fill={`url(#${metal})`}
            stroke="#272725"
            strokeWidth="2"
          />
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 60} 220 112)`}>
              <circle cx="220" cy="104.5" r="1.2" fill="#272725" />
            </g>
          ))}
          <circle
            cx="220"
            cy="112"
            r="4.5"
            fill="#272725"
            stroke="#faf9f6"
            strokeWidth="1"
          />
          <circle cx="220" cy="112" r="1.6" fill="#a8a79e" />
        </g>
      </svg>
    </span>
  );
}
