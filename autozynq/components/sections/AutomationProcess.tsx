"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Trigger",
    text: "Something happens.",
    detail: "Webhook received",
    icon: "↗",
  },
  {
    number: "02",
    title: "Process",
    text: "Information is transformed.",
    detail: "AI processes data",
    icon: "✦",
  },
  {
    number: "03",
    title: "Decide",
    text: "Your workflow determines what happens next.",
    detail: "Condition evaluated",
    icon: "◇",
  },
  {
    number: "04",
    title: "Act",
    text: "The right tools execute automatically.",
    detail: "Email + database updated",
    icon: "→",
  },
];

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return visible;
}

export default function AutomationProcess() {
  const sectionRef = useRef<HTMLElement>(null);
  const visible = useInView(sectionRef);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current >= steps.length - 1 ? 0 : current + 1));
    }, 1900);
    return () => window.clearInterval(timer);
  }, [visible]);

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden bg-[#020106] px-6 py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.055] blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:80px_80px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[45%] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.025] blur-[100px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className={`max-w-3xl transition-all duration-1000 ease-[cubic-bezier(.16,1,.3,1)] ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-violet-300">How automation works</p>
          <h2 className="text-4xl font-medium leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            From an event
            <br />
            to an <span className="text-white/35">outcome.</span>
          </h2>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/40 sm:text-lg">
            Your workflow takes care of the steps between the trigger and the result.
          </p>
        </div>
        <div className="relative mt-24">
          <div className="pointer-events-none absolute left-[8%] right-[8%] top-[44px] hidden h-px bg-white/[0.07] lg:block" />
          <div className="pointer-events-none absolute left-[8%] top-[44px] hidden h-px overflow-hidden bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 transition-[width] duration-700 ease-out lg:block" style={{ width: `${(active / 3) * 84}%` }} />
          <div className="pointer-events-none absolute left-[8%] top-[40px] hidden h-[9px] w-[9px] rounded-full bg-violet-200 shadow-[0_0_20px_rgba(167,139,250,.9)] transition-[left] duration-700 ease-out lg:block" style={{ left: `calc(8% + ${(active / 3) * 84}%)` }} />
          <div className="flex gap-5 overflow-x-auto overflow-y-visible pb-6 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:pb-0 lg:snap-none">
            {steps.map((step, index) => {
              const isActive = index === active;
              const completed = index < active;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`group relative min-w-[280px] shrink-0 snap-start text-left transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] lg:min-w-0 lg:shrink lg:snap-none ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  <div className={`relative z-10 mb-7 flex h-[88px] w-[88px] items-center justify-center rounded-[26px] border backdrop-blur-xl transition-all duration-500 ease-out ${isActive ? "scale-105 border-violet-300/40 bg-violet-500/10 shadow-[0_0_50px_rgba(139,92,246,.18)]" : completed ? "border-violet-400/20 bg-violet-500/[0.05]" : "border-white/[0.08] bg-white/[0.025]"}`}>
                    <div className={`pointer-events-none absolute inset-2 rounded-[20px] bg-violet-400/10 blur-xl transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-0"}`} />
                    <span className={`relative z-10 text-2xl transition-all duration-500 ${isActive ? "scale-110 text-violet-200" : completed ? "text-violet-300/50" : "text-white/35"}`}>{step.icon}</span>
                    {isActive && (
                      <>
                        <span className="pointer-events-none absolute inset-[-7px] rounded-[31px] border border-violet-300/20 animate-pulse" />
                        <span className="pointer-events-none absolute inset-[-13px] rounded-[37px] border border-violet-400/[0.06]" />
                      </>
                    )}
                  </div>
                  <div className="pr-5">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="font-mono text-[10px] tracking-[0.2em] text-violet-400/60">{step.number}</span>
                      <span className={`h-px w-7 transition-all duration-500 ${isActive ? "w-10 bg-violet-400" : "bg-white/10"}`} />
                    </div>
                    <h3 className={`text-xl font-medium transition-colors duration-500 ${isActive ? "text-white" : "text-white/60"}`}>{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/35">{step.text}</p>
                    <div className={`mt-6 inline-flex rounded-full border px-3 py-1.5 text-[10px] tracking-[0.08em] transition-all duration-500 ${isActive ? "border-violet-300/20 bg-violet-400/10 text-violet-200" : "border-white/[0.06] bg-white/[0.02] text-white/25"}`}>{step.detail}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className={`relative mt-24 overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.018] p-6 backdrop-blur-xl transition-all duration-1000 ease-[cubic-bezier(.16,1,.3,1)] sm:p-8 ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-[220px] w-[220px] rounded-full bg-violet-500/[0.07] blur-[80px]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-violet-400/40 to-transparent opacity-70" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/25">Workflow execution</p>
              <p className="mt-2 text-sm text-white/55">All steps execute automatically.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">Running</span>
            </div>
          </div>
          <div className="relative mt-7 flex gap-1.5">
            {steps.map((step, index) => (
              <div key={step.number} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-violet-400 transition-all duration-700" style={{ width: index <= active ? "100%" : "0%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
