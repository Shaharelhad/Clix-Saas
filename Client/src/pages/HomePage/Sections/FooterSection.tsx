import { useTranslation } from "react-i18next";

const FooterSection = () => {
  const { t } = useTranslation("landing");

  return (
    <footer className="border-t border-white/[0.08] pt-16 pb-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Footer columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-4" dir="ltr">
              <img src="/clix-logo.svg" alt="CLIX" className="h-8" />
              <span className="text-white font-bold text-lg">CLIX</span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed">
              {t("footerDesc")}
            </p>
          </div>

          {/* Product column */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{t("footerProduct")}</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerFeatures")}
                </span>
              </li>
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerPricing")}
                </span>
              </li>
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerFaq")}
                </span>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{t("footerCompany")}</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerAbout")}
                </span>
              </li>
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerContact")}
                </span>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{t("footerLegal")}</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerPrivacy")}
                </span>
              </li>
              <li>
                <span className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer">
                  {t("footerTerms")}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.08] mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            &copy; {new Date().getFullYear()} CLIX. {t("allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
