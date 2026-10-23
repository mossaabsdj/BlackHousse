"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nContext";
import Link from "next/link";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";

const DEFAULT_SLIDES = [
  { src: "/images/menu/pizza.jpg", alt: "Burgers BlackHousse" },
  { src: "/images/menu/tacos.jpg", alt: "Tacos BlackHousse" },
  { src: "/images/menu/poutine.jpg", alt: "Pizzas BlackHousse" },
  { src: "/images/menu/pizza.jpg", alt: "Sandwichs BlackHousse" },
  { src: "/images/menu/crispy.jpg", alt: "Burgers BlackHousse" },
];

const AUTOPLAY_MS = 4500;
const pad = (v) => String(v).padStart(2, "0");

export default function BlackHousseMenuCarousel() {
  const { content, isRTL } = useI18n();
  const menuPage = content.MenuPage;
  const rawSlides = menuPage?.slides || [];
  const slides = useMemo(() => {
    return rawSlides.map((s, idx) => ({
      ...DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length],
      ...s,
    }));
  }, [rawSlides]);

  const { startLoading } = useNavigationLoading();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length || 1;
  const titleLines = (menuPage?.title || "").split("\n");

  const go = useCallback((i) => setIndex(((i % n) + n) % n), [n]);
  const next = useCallback(() => setIndex((i) => (i + 1) % n), [n]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + n) % n), [n]);



  // Autoplay (paused on hover, disabled with reduced motion)
  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion, next, index]);

  // Shortest circular distance from the active slide
  const offsetOf = (i) => {
    let o = i - index;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  };

  return (
    <main className="min-h-screen flex items-center justify-center overflow-x-hidden bg-gray-100 px-6 py-12">
      <div className="max-w-7xl w-full space-y-10">
        {/* Header */}
        <motion.div
          className="space-y-5 text-center"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: false, amount: 0.3 }}
        >
          
          <h1 className="  text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight">
            {titleLines.map((line, i) => (
              <Fragment key={i}>
                <span dangerouslySetInnerHTML={{ __html: line }} />
                {i < titleLines.length - 1 && <br />}
              </Fragment>
            ))}
           
          </h1>
          <p className="text-gray-600 max-w-xl text-lg mx-auto">
            {menuPage.description}
            
          </p>
          
          
        </motion.div>

        {/* Carousel stage */}
        <motion.div
          role="region"
          aria-roledescription="carousel"
          aria-label={menuPage.badge}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") next();
            if (e.key === "ArrowLeft") prev();
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative h-[340px] sm:h-[440px] lg:h-[520px] outline-none"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          viewport={{ once: false, amount: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) next();
              else if (info.offset.x > 60) prev();
            }}
          >
            {slides.map((s, i) => {
              const o = offsetOf(i);
              const abs = Math.abs(o);
              const visible = abs <= 2;
              return (
                <motion.div
                  key={s.src}
                  className="absolute inset-0 m-auto w-[68%] sm:w-[46%] lg:w-[34%] max-w-[420px] h-[300px] sm:h-[400px] lg:h-[480px] rounded-3xl bg-white border border-gray-200 p-3 shadow-xl shadow-gray-300/60 select-none"
                  initial={false}
                  animate={{
                    x: `${o * 60}%`,
                    scale: 1 - Math.min(abs, 2) * 0.12,
                    opacity: !visible ? 0 : abs === 0 ? 1 : abs === 1 ? 0.75 : 0.4,
                  }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 140, damping: 20 }
                  }
                  style={{ zIndex: 10 - abs, pointerEvents: visible ? "auto" : "none" }}
                  onClick={() => o !== 0 && go(i)}
                  aria-hidden={o !== 0}
                >
                  <div className="relative w-full h-full rounded-2xl overflow-hidden">
                    <Image
                      src={s.src}
                      alt={s.alt}
                      fill
                      sizes="(min-width: 1024px) 420px, 70vw"
                      className="object-cover"
                      draggable={false}
                      priority={i === 0}
                    />
                    <span className="absolute top-3 left-3 px-3 py-1 bg-white border border-gray-300 rounded-full text-xs text-gray-600">
                      {s.tag}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Caption */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="text-center space-y-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            aria-live="polite"
          >
            <span className="text-orange-600 font-bold tracking-widest text-sm">
              {pad(index + 1)} / {pad(n)}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {slides[index]?.title}
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              {slides[index]?.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={isRTL ? next : prev}
            aria-label="Previous"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition"
          >
            <ChevronLeft className={`w-5 h-5 ${isRTL ? "rtl-flip" : ""}`} />
          </button>

          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.src || i}
                onClick={() => go(i)}
                aria-label={s.title}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-orange-500" : "w-2.5 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          <button
            onClick={isRTL ? prev : next}
            aria-label="Next"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition"
          >
            <ChevronRight className={`w-5 h-5 ${isRTL ? "rtl-flip" : ""}`} />
          </button>
        </div>

        <div className="text-center">
          <Link
            href="/Commande"
            onClick={() => startLoading("/Commande")}
            className="inline-block px-8 py-3 text-white bg-orange-500 hover:bg-orange-600 rounded-full font-bold transition shadow-lg shadow-orange-500/30"
          >
            {menuPage?.button || "Commander maintenant"}
          </Link>
        </div>
      </div>
    </main>
  );
}