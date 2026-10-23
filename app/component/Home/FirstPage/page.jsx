"use client";
import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export default function BlackHousseLandingPage() {
  const { content } = useI18n();
  const firstPage = content.FirstPage;
  const { startLoading } = useNavigationLoading();
  const titleLines = (firstPage?.title || "").split("\n");

  return (
    <main className="min-h-screen flex items-center overflow-x-hidden justify-center bg-gray-100 px-6 py-12">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Text Section */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: -60 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: false, amount: 0.3 }}
        >
          <span className="uppercase tracking-widest text-3xl font-extrabold text-orange-600">
            {firstPage?.badge}
          </span>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight">
            {titleLines.map((line, i) => (
              <Fragment key={i}>
                <span dangerouslySetInnerHTML={{ __html: line }} />
                {i < titleLines.length - 1 && <br />}
              </Fragment>
            ))}
          </h1>

          <p className="text-gray-600 max-w-md text-lg">
            {firstPage?.description}
          </p>

          <Link
            href="/Commande"
            onClick={() => startLoading("/Commande")}
            className="inline-block px-8 py-3 text-white bg-orange-500 hover:bg-orange-600 rounded-full font-bold transition shadow-lg shadow-orange-500/30"
          >
            {firstPage?.button}
          </Link>

          <div className="flex flex-wrap gap-3 mt-4">
            {(firstPage?.tags || []).map((label, idx) => (
              <span
                key={idx}
                className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm text-gray-600"
              >
                {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Image Section */}
        <motion.div
          className="rounded-3xl overflow-hidden shadow-xl shadow-gray-300/60 bg-white border border-gray-200 p-6"
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          viewport={{ once: false, amount: 0.3 }}
        >
          <Image
            src={firstPage?.image?.src || "/images/logo.png"}
            alt={firstPage?.image?.alt || "BlackHousse"}
            width={firstPage?.image?.width || 800}
            height={firstPage?.image?.height || 800}
            className="rounded-3xl object-cover w-full h-auto"
            priority
          />
        </motion.div>
      </div>
    </main>
  );
}