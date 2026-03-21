import { useRef, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, Sparkles, HelpCircle, LogIn, Menu, X } from "lucide-react";
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
  { id: "preview", icon: Eye },
  { id: "features", icon: Sparkles },
  { id: "faq", icon: HelpCircle },
];

const HomePage = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  /* ── smooth scroll to section ── */
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
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

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#FDF8F2] text-[#1A1A1A] font-secular-one"
    >
      {/* ── Fixed Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div
          className={`max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between transition-all duration-500 ${
            scrolled
              ? "mt-2 mx-4 lg:mx-auto rounded-2xl bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
              : "mt-0"
          }`}
        >
          {/* Logo + Nav grouped together */}
          <div className="flex items-center gap-8">
            <motion.button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center gap-2 cursor-pointer group"
              aria-label="חזרה לתחילת העמוד"
            >
              <img
                src="/clix-logo-full.png"
                alt="CLIX"
                className="h-6 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,107,44,0.6)]"
              />
            </motion.button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`relative flex items-center gap-1.5 py-2 text-sm font-medium transition-colors duration-300 cursor-pointer ${
                      activeSection === item.id
                        ? "text-[#0A0A0A]"
                        : "text-[#3D3630]/70 hover:text-[#0A0A0A]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
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
                );
              })}
            </nav>
          </div>

          {/* Desktop auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="flex items-center gap-1.5 text-sm text-[#3D3630]/70 hover:text-[#0A0A0A] transition-colors duration-300"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t("navLogin")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth?mode=signup")}
              className="bg-[#FF6B2C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#E85D04] transition-colors flex items-center gap-1.5"
            >
              {t("navStartFree")}
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-[#3D3630] hover:bg-[#EDE6DD]/40 transition-colors"
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mx-4 mt-1 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[#EDE6DD]/50 overflow-hidden"
            >
              <div className="p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        activeSection === item.id
                          ? "bg-[#FF6B2C]/10 text-[#FF6B2C]"
                          : "text-[#3D3630] hover:bg-[#FAF7F3]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </button>
                  );
                })}

                <div className="border-t border-[#EDE6DD]/50 my-2" />

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/auth");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[#3D3630] hover:bg-[#FAF7F3] transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  {t("navLogin")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/auth?mode=signup");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#FF6B2C] text-white hover:bg-[#E85D04] transition-colors"
                >
                  {t("navStartFree")}
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
