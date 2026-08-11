"use client";

import { useEffect, useState } from "react";

const words = ["BUILD", "CONNECT", "AUTOMATE"];

type LetterConfig = {
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  delay: number;
  duration: number;
};

function createLetterConfig(wordIndex: number, letterIndex: number): LetterConfig {
  const seed = wordIndex * 100 + letterIndex * 17;
  const random = (offset: number) => {
    const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  return {
    x: (random(1) - 0.5) * 900,
    y: (random(2) - 0.5) * 650,
    z: (random(3) - 0.5) * 500,
    rotateX: (random(4) - 0.5) * 90,
    rotateY: (random(5) - 0.5) * 100,
    rotateZ: (random(6) - 0.5) * 70,
    delay: 280 + wordIndex * 220 + letterIndex * 55,
    duration: 1350 + random(7) * 250,
  };
}

export default function HeroIntro() {
  const [started, setStarted] = useState(false);
  const [settled, setSettled] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      setStarted(true);
    }, 100);

    const settleTimer = window.setTimeout(() => {
      setSettled(true);
    }, 2700);

    const ctaTimer = window.setTimeout(() => {
      setCtaVisible(true);
    }, 3200);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(ctaTimer);
    };
  }, []);

  const animationStarted = started;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden px-6">
      <div
        className={`absolute left-1/2 top-1/2 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.055] blur-[120px] transition-all duration-[2600ms] ease-out ${
          animationStarted ? "scale-100 opacity-100" : "scale-[0.35] opacity-0"
        }`}
      />

      <div
        className={`absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.07] blur-[80px] transition-all duration-[1800ms] ${
          animationStarted ? "scale-150 opacity-100" : "scale-0 opacity-0"
        }`}
      />

      <div className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: 22 }).map((_, index) => {
          const angle = (index / 22) * Math.PI * 2;
          const radius = 150 + (index % 5) * 55;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <span
              key={index}
              className={`absolute left-1/2 top-1/2 h-[2px] w-[2px] rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.9)] transition-all ease-out ${
                animationStarted ? "opacity-50" : "opacity-0"
              }`}
              style={{
                transform: animationStarted ? `translate(${x}px, ${y}px)` : "translate(0px, 0px)",
                transitionDuration: `${1200 + index * 35}ms`,
                transitionDelay: `${index * 25}ms`,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center [perspective:1200px]">
        <div
          className={`mb-8 flex items-center gap-3 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            settled ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <span className="h-[5px] w-[5px] rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,1)]" />
          <span className="text-[9px] font-medium uppercase tracking-[0.48em] text-white/35">Intelligent automation</span>
        </div>

        <div className="relative flex flex-col items-center [transform-style:preserve-3d]">
          {words.map((word, wordIndex) => (
            <div key={word} className="flex justify-center whitespace-nowrap [transform-style:preserve-3d]">
              {word.split("").map((letter, letterIndex) => {
                const config = createLetterConfig(wordIndex, letterIndex);

                return (
                  <span
                    key={`${word}-${letterIndex}`}
                    className={`relative inline-block select-none text-[clamp(3.5rem,9vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.075em] text-white [transform-style:preserve-3d] will-change-transform transition-all ${
                      animationStarted ? "translate-x-0 translate-y-0 translate-z-0 scale-x-100 scale-y-100 rotate-x-0 rotate-y-0 rotate-z-0 opacity-100 blur-0" : ""
                    }`}
                    style={{
                      transform: animationStarted
                        ? undefined
                        : `translate3d(${config.x}px, ${config.y}px, ${config.z}px) rotateX(${config.rotateX}deg) rotateY(${config.rotateY}deg) rotateZ(${config.rotateZ}deg) scale(1.35)`,
                      opacity: animationStarted ? 1 : 0,
                      filter: animationStarted ? "blur(0px)" : "blur(10px)",
                      transitionProperty: "transform, opacity, filter",
                      transitionDuration: `${config.duration}ms`,
                      transitionDelay: `${config.delay}ms`,
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    {letter}
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 text-violet-400/20 blur-[18px]">{letter}</span>
                  </span>
                );
              })}
            </div>
          ))}

          <div
            className={`pointer-events-none absolute left-[-30%] right-[-30%] top-1/2 h-[1px] -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-300/70 to-transparent blur-[3px] transition-all duration-[900ms] ease-in-out ${
              settled ? "translate-x-[130%] opacity-0" : "translate-x-[-130%] opacity-0"
            }`}
          />
        </div>

        <div
          className={`pointer-events-none absolute left-1/2 top-[45%] h-[20px] w-[320px] -translate-x-1/2 rounded-full bg-violet-400/20 blur-[25px] transition-all duration-[650ms] ${
            settled ? "scale-x-[1.35] scale-y-[0.35] opacity-0" : "scale-x-[0.2] scale-y-100 opacity-0"
          }`}
        />

        <div className={`mt-9 max-w-xl transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${settled ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-[0.96] opacity-0"}`}>
          <p className="text-sm leading-7 text-white/35 sm:text-base">
            Connect your tools.
            <span className="mx-2 text-white/15">/</span>
            Let intelligent workflows handle the rest.
          </p>
        </div>

        <div className={`mt-10 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${ctaVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
          <div className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-black/20 px-5 py-2.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,1)]" />
            <span className="text-[9px] font-medium uppercase tracking-[0.35em] text-white/40">Scroll to execute</span>
            <span className="text-xs text-white/25">↓</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(2,1,6,0.7)_100%)]" />
    </div>
  );
}
