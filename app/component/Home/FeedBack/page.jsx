"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import content from "@/app/Texts/content.json";
import { useRealtimeFeedback } from "@/lib/Firebase";

const fb = content.FeedbackPage;
const PAGE_SIZE = 6;

const inputClass =
  "w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl text-gray-900 placeholder-gray-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20";

/* Static burger rating (read-only) */
function Burgers({ value, className = "" }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <span key={v} className={v <= Math.round(value) ? "" : "opacity-30 grayscale"}>
          {fb.ratingIcon}
        </span>
      ))}
    </span>
  );
}

/* Modal (portal, Esc + backdrop to close, locks page scroll) */
function Modal({ onClose, labelledBy, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-gray-200 shadow-2xl p-6 sm:p-8 outline-none"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={fb.close}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* The form (rendered inside the modal) */
function FeedbackForm({ onSubmit, onClose }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [topics, setTopics] = useState([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done
  const [progress, setProgress] = useState(0);
  const [serverMessage, setServerMessage] = useState("");
  const [error, setError] = useState("");
  const shown = hover || rating;

  const toggleTopic = (id) =>
    setTopics((p) => (p.includes(id) ? p.filter((t) => t !== id) : [...p, id]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return setError(fb.errors.rating);
    setError("");
    setStatus("sending");
    setProgress(15);

    // Smooth progression simulation during loading
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev;
        return prev + Math.floor(Math.random() * 14) + 8;
      });
    }, 150);

    try {
      const res = await onSubmit({ name: name.trim(), rating, topics, comment: comment.trim() });
      clearInterval(interval);
      setProgress(100);
      if (res?.message) {
        setServerMessage(res.message);
      }
      setTimeout(() => {
        setStatus("done");
      }, 300);
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      setError(err?.message || fb.errors.generic);
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="py-8 text-center space-y-4" role="status">
        <div className="text-7xl">{fb.success.icon}</div>
        <h2 id="fb-modal-title" className="text-3xl font-extrabold text-gray-900">
          {fb.success.title}
        </h2>
        <p className="text-gray-600 max-w-sm mx-auto">
          {serverMessage || fb.success.message}
        </p>
        <button
          onClick={onClose}
          className="inline-block px-8 py-3 text-white bg-orange-500 hover:bg-orange-600 rounded-full font-bold transition shadow-lg shadow-orange-500/30"
        >
          {fb.close}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="pr-10 space-y-1">
        <h2 id="fb-modal-title" className="text-2xl sm:text-3xl font-extrabold text-gray-900">
          {fb.modalTitle}
        </h2>
        <p className="text-sm text-gray-600">{fb.modalDescription}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="fb-name" className="text-sm font-semibold text-gray-900">
          {fb.nameLabel}
        </label>
        <input
          id="fb-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={fb.namePlaceholder}
          maxLength={60}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <span id="fb-rating-label" className="text-sm font-semibold text-gray-900">
          {fb.ratingLabel}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="fb-rating-label"
          className="flex items-center gap-2"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <motion.button
              key={v}
              type="button"
              role="radio"
              aria-checked={rating === v}
              aria-label={`${v} / 5 — ${fb.ratingHints[v - 1]}`}
              onMouseEnter={() => setHover(v)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(0)}
              onClick={() => {
                setRating(v);
                setError("");
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className={`text-4xl sm:text-5xl transition rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 ${
                v <= shown ? "opacity-100" : "opacity-30 grayscale"
              }`}
            >
              {fb.ratingIcon}
            </motion.button>
          ))}
        </div>
        <p className="h-5 text-sm font-semibold text-orange-600">
          {shown ? fb.ratingHints[shown - 1] : ""}
        </p>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-semibold text-gray-900">{fb.topicsLabel}</span>
        <div className="flex flex-wrap gap-2">
          {fb.topics.map((t) => {
            const on = topics.includes(t.id);
            return (
              <motion.button
                key={t.id}
                type="button"
                aria-pressed={on}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleTopic(t.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                  on
                    ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "bg-white border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600"
                }`}
              >
                {t.icon} {t.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="fb-comment" className="text-sm font-semibold text-gray-900">
          {fb.commentLabel}
        </label>
        <textarea
          id="fb-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={fb.commentPlaceholder}
          maxLength={400}
          className={`${inputClass} resize-none`}
        />
        <p className="text-xs text-gray-400 text-right">{comment.length} / 400</p>
      </div>

      {/* Loading progression bar */}
      {status === "sending" && (
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700">
            <span className="flex items-center gap-1.5 text-orange-600">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              Envoi de votre avis en cours...
            </span>
            <span>{Math.min(100, Math.round(progress))}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full px-8 py-3 text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-full font-bold transition shadow-lg shadow-orange-500/30"
      >
        {status === "sending" ? `Envoi (${Math.round(progress)}%)` : fb.submit}
      </button>
    </form>
  );
}

export default function BlackHousseFeedbackPage({ reviews, onSubmit }) {
  const reduceMotion = useReducedMotion();
  const titleLines = fb.title.split("\n");

  const [list, setList] = useState(reviews ?? fb.reviews);
  const [serverStats, setServerStats] = useState(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const fetchFeedback = async () => {
    try {
      const res = await fetch("/api/feedback", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.stats && data.stats.total > 0) {
          setServerStats(data.stats);
        }
        if (Array.isArray(data.items) && data.items.length > 0) {
          setList(data.items);
        } else if (!reviews) {
          setList(fb.reviews);
        }
      }
    } catch (err) {
      console.warn("Feedback fetch error:", err);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  // Real-time synchronization using Firebase
  useRealtimeFeedback({
    onNewFeedback: () => fetchFeedback(),
    onFeedbackStatusChange: () => fetchFeedback(),
  });

  // Calculate overall rating: use serverStats computed from all DB ratings (pending, approved, rejected)
  const stats = useMemo(() => {
    if (serverStats && serverStats.total > 0) {
      return serverStats;
    }
    const total = list.length;
    const avg = total ? list.reduce((s, r) => s + r.rating, 0) / total : 0;
    const dist = [5, 4, 3, 2, 1].map((s) => {
      const count = list.filter((r) => r.rating === s).length;
      return { stars: s, count, pct: total ? (count / total) * 100 : 0 };
    });
    return { total, avg, dist };
  }, [serverStats, list]);

  const handleSubmit = async (data) => {
    if (onSubmit) {
      return await onSubmit(data);
    }

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const jsonRes = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(jsonRes.error || fb.errors.generic);
    }

    // Refresh feedback and statistics
    await fetchFeedback();

    return jsonRes;
  };

  const topicOf = (id) => fb.topics.find((t) => t.id === id);

  return (
    <main className="min-h-screen overflow-x-hidden bg-gray-100 px-6 py-12">
      <div className="max-w-7xl mx-auto space-y-14">
        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: false, amount: 0.3 }}
          >
            <span className="uppercase tracking-widest text-3xl font-extrabold text-orange-600">
              {fb.badge}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight">
              {titleLines.map((line, i) => (
                <Fragment key={i}>
                  <span dangerouslySetInnerHTML={{ __html: line }} />
                  {i < titleLines.length - 1 && <br />}
                </Fragment>
              ))}
            </h1>
            <p className="text-gray-600 max-w-md text-lg">{fb.description}</p>

            <button
              onClick={() => setOpen(true)}
              className="inline-block px-8 py-3 text-white bg-orange-500 hover:bg-orange-600 rounded-full font-bold transition shadow-lg shadow-orange-500/30"
            >
              {fb.addButton}
            </button>

            <div className="flex flex-wrap gap-4 pt-2" aria-hidden="true">
              {fb.floatingIcons.map((icon, i) => (
                <motion.div
                  key={icon}
                  className="w-14 h-14 rounded-full bg-white border border-gray-200 shadow-lg shadow-gray-300/60 flex items-center justify-center text-3xl"
                  animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                >
                  {icon}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Summary */}
          <motion.div
            className="rounded-3xl shadow-xl shadow-gray-300/60 bg-white border border-gray-200 p-6 sm:p-8"
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: false, amount: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="text-center sm:pr-6 sm:border-r border-gray-200">
                <div className="text-6xl font-extrabold text-gray-900">
                  {stats.avg.toFixed(1).replace(".", ",")}
                </div>
                <Burgers value={stats.avg} className="text-2xl mt-2" />
                <p className="text-sm text-gray-600 mt-2">
                  {stats.total} {fb.reviewsCount}
                </p>
              </div>

              <div className="flex-1 space-y-2">
                {stats.dist.map((d) => (
                  <div key={d.stars} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-8 font-semibold">{d.stars}{fb.ratingIcon}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-orange-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${d.pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <span className="w-6 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Reviews */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              {fb.reviewsTitle}
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">{fb.reviewsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.slice(0, visible).map((r, i) => (
              <motion.article
                key={r.id}
                layout={!reduceMotion}
                className="rounded-3xl shadow-xl shadow-gray-300/60 bg-white border border-gray-200 p-6 flex flex-col gap-4"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                viewport={{ once: true, amount: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">
                    {(r.name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.date}</p>
                  </div>
                  <Burgers value={r.rating} className="ml-auto text-lg" />
                </div>

                {r.comment && <p className="text-sm text-gray-600 flex-1">{r.comment}</p>}

                {r.topics?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.topics.map((id) => {
                      const t = topicOf(id);
                      return t ? (
                        <span
                          key={id}
                          className="px-3 py-1 bg-white border border-gray-300 rounded-full text-xs text-gray-600"
                        >
                          {t.icon} {t.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </motion.article>
            ))}
          </div>

          {visible < list.length && (
            <div className="text-center">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="px-8 py-3 bg-white border border-gray-300 rounded-full font-bold text-gray-600 hover:border-orange-400 hover:text-orange-600 transition"
              >
                {fb.showMore}
              </button>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {open && (
          <Modal onClose={() => setOpen(false)} labelledBy="fb-modal-title">
            <FeedbackForm onSubmit={handleSubmit} onClose={() => setOpen(false)} />
          </Modal>
        )}
      </AnimatePresence>
    </main>
  );
}