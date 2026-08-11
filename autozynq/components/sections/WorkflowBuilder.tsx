"use client";

import { useEffect, useRef, useState } from "react";

const nodes = [
  {
    title: "Webhook",
    subtitle: "Trigger",
    x: "8%",
    y: "38%",
    icon: "↗",
  },
  {
    title: "AI Processor",
    subtitle: "Transform",
    x: "31%",
    y: "22%",
    icon: "✦",
  },
  {
    title: "Condition",
    subtitle: "Decision",
    x: "55%",
    y: "38%",
    icon: "◇",
  },
  {
    title: "Gmail",
    subtitle: "Action",
    x: "78%",
    y: "18%",
    icon: "G",
  },
  {
    title: "Google Sheets",
    subtitle: "Action",
    x: "78%",
    y: "62%",
    icon: "S",
  },
];

export default function WorkflowBuilder() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(1);

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

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden bg-[#020106] px-6 py-32">
      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div className={`transition-all duration-1000 ${visible ? "translate-x-0 opacity-100" : "-translate-x-10 opacity-0"}`}>
            <p className="mb-5 text-xs uppercase tracking-[0.35em] text-violet-300">Visual workflow builder</p>
            <h2 className="text-4xl font-medium leading-[1.03] tracking-[-0.045em] sm:text-6xl">
              Build logic.
              <br />
              <span className="text-white/30">Visually.</span>
            </h2>
            <p className="mt-7 max-w-lg text-base leading-7 text-white/40">
              Connect triggers, AI processors, decisions, and actions into a workflow that runs itself.
            </p>
            <div className="mt-10 space-y-3">
              {["Drag and connect", "Configure every step", "Run automatically"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 text-sm text-white/40">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-300/20 text-[9px] text-violet-300">{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className={`min-w-0 transition-all duration-1000 ${visible ? "translate-x-0 scale-100 opacity-100" : "translate-x-10 scale-[.97] opacity-0"}`}>
            <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-3 touch-pan-x lg:overflow-visible lg:pb-0">
              <div className="min-w-[720px] lg:min-w-0">
                <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#07060b] shadow-[0_40px_120px_rgba(0,0,0,.5)]">
                  <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-400/60" />
                      <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
                      <span className="h-2 w-2 rounded-full bg-green-400/60" />
                    </div>
                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/20">Workflow / Lead processing</span>
                    <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1 text-[8px] text-emerald-300/70">ACTIVE</span>
                  </div>
                  <div className="relative h-[470px] overflow-hidden [background-image:radial-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:24px_24px]">
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M17 47 C24 47 25 30 37 30" fill="none" stroke="rgba(167,139,250,.35)" strokeWidth=".35" vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
                      <path d="M42 30 C49 30 49 47 60 47" fill="none" stroke="rgba(167,139,250,.35)" strokeWidth=".35" vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
                      <path d="M66 47 C73 47 72 27 82 27" fill="none" stroke="rgba(167,139,250,.35)" strokeWidth=".35" vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
                      <path d="M66 49 C73 49 72 69 82 69" fill="none" stroke="rgba(167,139,250,.25)" strokeWidth=".35" vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
                      <circle cx="25" cy="47" r=".7" fill="#c4b5fd">
                        <animate attributeName="cx" from="17" to="37" dur="1.7s" repeatCount="indefinite" />
                      </circle>
                    </svg>
                    {nodes.map((node, index) => {
                      const active = selected === index;
                      return (
                        <button
                          key={node.title}
                          type="button"
                          onClick={() => setSelected(index)}
                          className="absolute -translate-x-1/2 -translate-y-1/2 text-left"
                          style={{ left: node.x, top: node.y }}
                        >
                          <div className={`w-[145px] rounded-2xl border p-3 backdrop-blur-xl transition-all duration-300 ${active ? "border-violet-300/35 bg-violet-500/[0.09] shadow-[0_0_40px_rgba(139,92,246,.16)]" : "border-white/[0.08] bg-white/[0.025] hover:border-white/20"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs ${active ? "border-violet-300/25 bg-violet-500/10 text-violet-200" : "border-white/[0.08] bg-white/[0.025] text-white/40"}`}>{node.icon}</div>
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-medium text-white/70">{node.title}</p>
                                <p className="mt-1 text-[8px] uppercase tracking-[0.15em] text-white/25">{node.subtitle}</p>
                              </div>
                            </div>
                            <span className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-violet-300/40 bg-[#0b0910]" />
                            {index !== 0 && <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-violet-300/40 bg-[#0b0910]" />}
                          </div>
                        </button>
                      );
                    })}
                    <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0a080e]/90 p-1.5 backdrop-blur-xl">
                      {["+", "−", "⌘", "↗"].map((item) => (
                        <button key={item} type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-xs text-white/30 transition hover:bg-white/[0.06] hover:text-white/70">
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
