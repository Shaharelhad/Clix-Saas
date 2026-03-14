import { useRef, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import HeroSection from "./Sections/HeroSection";
import ProductPreviewSection from "./Sections/ProductPreviewSection";
import FeaturesSection from "./Sections/FeaturesSection";
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
  { id: "preview" },
  { id: "features" },
  { id: "faq" },
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
  }));

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#FDF8F2] text-[#1A1A1A] font-secular-one"
    >
      {/* ── Fixed Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div
          className={`max-w-6xl mx-auto px-6 py-3 flex items-center justify-between transition-all duration-500 ${
            scrolled
              ? "mt-2 mx-4 lg:mx-auto rounded-2xl bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
              : "mt-0"
          }`}
        >
          {/* Logo + Nav grouped together */}
          <div className="flex items-center gap-8">
            <motion.button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center gap-2 cursor-pointer group"
              aria-label="חזרה לתחילת העמוד"
            >
              <span className="font-bold text-lg tracking-wide leading-none select-none text-[#0A0A0A] transition-colors duration-300 group-hover:opacity-80">
                CLIX
              </span>
              <img
                src="/clix-logo.svg"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,107,44,0.6)]"
              />
            </motion.button>

            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors duration-300 cursor-pointer ${
                    activeSection === item.id
                      ? "text-[#0A0A0A]"
                      : "text-[#3D3630]/70 hover:text-[#0A0A0A]"
                  }`}
                >
                  {item.name}
                  {activeSection === item.id && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF6B2C] rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-[#3D3630]/70 hover:text-[#0A0A0A] transition-colors duration-300"
            >
              {t("navLogin")}
            </button>
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="bg-[#FF6B2C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#E85D04] transition-colors flex items-center gap-1.5"
            >
              {t("navStartFree")}
              {/* ArrowLeft is intentional: in RTL, pointing left = forward */}
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Sections ── */}
      <HeroSection />

      <div id="preview">
        <ProductPreviewSection />
      </div>

      <Reveal>
        <FeaturesSection />
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
