import { useRef, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import {
  Eye,
  CreditCard,
  HelpCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import HeroSection from "./Sections/HeroSection";
import ProductPreviewSection from "./Sections/ProductPreviewSection";
import FeaturesSection from "./Sections/FeaturesSection";
import PricingSection from "./Sections/PricingSection";
import FaqSection from "./Sections/FaqSection";
import CtaSection from "./Sections/CtaSection";
import FooterSection from "./Sections/FooterSection";

/* ─── scroll-reveal wrapper ─── */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── navbar section mapping ─── */
const NAV_SECTIONS = [
  { id: "preview", icon: <Eye className="w-4 h-4" /> },
  { id: "features", icon: <Sparkles className="w-4 h-4" /> },
  { id: "pricing", icon: <CreditCard className="w-4 h-4" /> },
  { id: "faq", icon: <HelpCircle className="w-4 h-4" /> },
];

const HomePage = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const scrollingToRef = useRef("");

  /* ── scroll detection ── */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      if (scrollingToRef.current) return;

      const sections = NAV_SECTIONS.map((s) => s.id);
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveSection(sections[i]);
            return;
          }
        }
      }
      setActiveSection("");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── smooth scroll to section ── */
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    scrollingToRef.current = id;
    setActiveSection(id);
    el.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      scrollingToRef.current = "";
    }, 1000);
  };

  const navItems = NAV_SECTIONS.map((s) => ({
    name: t(`nav${s.id.charAt(0).toUpperCase() + s.id.slice(1)}`),
    id: s.id,
    icon: s.icon,
  }));

  const activeNavName =
    navItems.find((i) => i.id === activeSection)?.name ?? "";

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-black text-white font-secular-one"
    >
      {/* ── Fixed Navbar ── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-black/80 backdrop-blur-md border-b border-white/5"
            : ""
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 grid grid-cols-[auto_1fr_auto] items-center">
          {/* Logo + Brand */}
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex items-center gap-2 cursor-pointer group"
            aria-label="חזרה לתחילת העמוד"
          >
            <span className="text-white font-bold text-lg tracking-wide leading-none select-none transition-opacity duration-300 group-hover:opacity-80">
              CLIX
            </span>
            <img
              src="/clix-logo.svg"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,107,44,0.6)]"
            />
          </motion.button>

          {/* Center nav */}
          <div className="hidden md:flex justify-center overflow-visible">
            <AnimeNavBar
              items={navItems}
              activeItem={activeNavName}
              onItemClick={scrollToSection}
            />
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              {t("navLogin")}
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="bg-[#FF6B2C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#E85D04] transition-colors flex items-center gap-1.5"
            >
              {t("navStartFree")}
              {/* ArrowLeft is intentional: in RTL, pointing left = forward */}
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Spacer for fixed header ── */}
      <div className="h-16" />

      {/* ── Sections ── */}
      <HeroSection />

      <Reveal>
        <div id="preview">
          <ProductPreviewSection />
        </div>
      </Reveal>

      <Reveal>
        <FeaturesSection />
      </Reveal>

      <Reveal>
        <PricingSection />
      </Reveal>

      <Reveal>
        <FaqSection />
      </Reveal>

      <Reveal>
        <CtaSection />
      </Reveal>

      <FooterSection />
    </div>
  );
};

export default HomePage;
