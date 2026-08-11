"use client";

import { useEffect, useRef, useState } from "react";

const apps = [
  ["G", "Gmail", "text-red-400"],
  ["S", "Slack", "text-cyan-300"],
  ["N", "Notion", "text-white"],
  ["D", "Drive", "text-yellow-300"],
  ["D", "Discord", "text-indigo-400"],
  ["DB", "Database", "text-blue-300"],
  ["W", "Webhook", "text-violet-300"],
  ["S", "Sheets", "text-green-400"],
];

export default function Integrations() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => {
      setPulse((value) => (value + 1) % 8);
    }, 900);
    return () => window.clearInterval(timer);
  }, [visible]);

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden bg-[#020106] px-6 py-32">
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.06] blur-[150px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className={`max-w-3xl transition-all duration-1000 ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <p className="mb-5 text-xs uppercase tracking-[0.35em] text-violet-300">Integrations</p>
          <h2 className="text-4xl font-medium leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Everything connected.
            <br />
            <span className="text-white/30">Nothing repeated.</span>
          </h2>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/40 sm:text-lg">
            Bring your tools into one automated system and let information move between them without manual work.
          </p>
        </div>
        <div className="relative mx-auto mt-20 h-[560px] max-w-6xl">
          <div className="absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
          <div className="absolute left-1/2 top-1/2 h-[270px] w-[270px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/[0.08]" />
          <div className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.08] blur-[60px]" />
          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-violet-300/25 bg-[#08050e]/95 shadow-[0_0_90px_rgba(139,92,246,.2)]">
              <div className="absolute inset-3 rounded-full border border-violet-300/10" />
              <div className="text-center">
                <div className="text-2xl text-violet-200">✦</div>
                <div className="mt-2 text-[9px] tracking-[0.3em] text-white/70">ENGINE</div>
                <div className="mt-1 text-[8px] tracking-[0.2em] text-violet-300/40">ONLINE</div>
              </div>
            </div>
          </div>
          {apps.map((app, index) => {
            const positions = [
              "left-[3%] top-[17%]",
              "left-[22%] top-[1%]",
              "left-[3%] bottom-[15%]",
              "left-[25%] bottom-[2%]",
              "right-[4%] top-[18%]",
              "right-[20%] top-[2%]",
              "right-[4%] bottom-[16%]",
              "right-[23%] bottom-[2%]",
            ];
            return (
              <div
                key={app[1]}
                className={`absolute ${positions[index]} z-10 transition-all duration-700 ${visible ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className={`relative rounded-2xl border px-4 py-3 backdrop-blur-xl transition-all duration-500 ${pulse === index ? "border-violet-300/40 bg-violet-500/10 shadow-[0_0_35px_rgba(139,92,246,.18)]" : "border-white/[0.08] bg-white/[0.025]"}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-black/40">
                      <span className={`text-sm font-semibold ${app[2]}`}>{app[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/60">{app[1]}</p>
                      <p className="mt-1 text-[9px] text-white/20">Connected</p>
                    </div>
                  </div>
                  {pulse === index && <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_15px_rgba(196,181,253,.9)]" />}
                </div>
              </div>
            );
          })}
          {visible &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-violet-200 shadow-[0_0_14px_rgba(196,181,253,.9)]"
                style={{
                  animation: `integrationOrbit ${3 + i * 0.25}s linear infinite`,
                  animationDelay: `${i * -0.7}s`,
                }}
              />
            ))}
        </div>
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm leading-7 text-white/30">
            One automation layer connecting the tools your business already depends on.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes integrationOrbit {
          0% {
            transform: rotate(0deg) translateX(80px) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) translateX(80px) rotate(-360deg);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}
