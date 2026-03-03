import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const CtaSection = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();

  return (
    <section className="relative py-24 px-6">
      <div className="cta-glow" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          {t("ctaTitle")}
        </h2>
        <p className="text-white/50 text-lg mb-8">{t("ctaSubtitle")}</p>
        <button
          onClick={() => navigate("/auth")}
          className="glass-btn text-lg px-10 py-4 rounded-xl"
        >
          {t("ctaBtn")}
        </button>
      </div>
    </section>
  );
};

export default CtaSection;
