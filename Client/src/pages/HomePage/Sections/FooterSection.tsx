import { useTranslation } from "react-i18next";

const FooterSection = () => {
  const { t } = useTranslation("landing");

  return (
    <footer className="relative bg-[#1A1510] pt-16 pb-8 px-6 overflow-hidden">
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF6B2C]/20 to-transparent" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Footer columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="glass-card-dark p-4 rounded-xl inline-block mb-4">
              <div className="flex items-center gap-2" dir="ltr">
                <img src="/clix-logo-full.png" alt="CLIX" className="h-8" />
              </div>
            </div>
            <p className="text-[#FDF8F2]/35 text-sm leading-relaxed">
              {t("footerDesc")}
            </p>
          </div>

          {/* Product column */}
          <div>
            <h4 className="text-[#FDF8F2] font-bold text-sm mb-4">{t("footerProduct")}</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-[#FDF8F2]/40 text-sm hover:text-[#FF6B2C] transition-colors duration-300 cursor-pointer">
                  {t("footerFeatures")}
                </span>
              </li>
              <li>
                <span className="text-[#FDF8F2]/40 text-sm hover:text-[#FF6B2C] transition-colors duration-300 cursor-pointer">
                  {t("footerFaq")}
                </span>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-[#FDF8F2] font-bold text-sm mb-4">{t("footerCompany")}</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-[#FDF8F2]/40 text-sm hover:text-[#FF6B2C] transition-colors duration-300 cursor-pointer">
                  {t("footerAbout")}
                </span>
              </li>
              <li>
                <span className="text-[#FDF8F2]/40 text-sm hover:text-[#FF6B2C] transition-colors duration-300 cursor-pointer">
                  {t("footerContact")}
                </span>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-[#FDF8F2] font-bold text-sm mb-4">{t("footerLegal")}</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-[#FDF8F2]/40 text-sm hover:text-[#FF6B2C] transition-colors duration-300 cursor-pointer">
                  {t("footerPrivacy")}
                </span>
              </li>
              <li>
                <span className="text-[#FDF8F2]/40 text-sm hover:text-[#FF6B2C] transition-colors duration-300 cursor-pointer">
                  {t("footerTerms")}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#FF6B2C]/10 to-transparent mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#FDF8F2]/25 text-sm">
            &copy; {new Date().getFullYear()} CLIX. {t("allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
