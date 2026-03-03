import { useTranslation } from "react-i18next";

const FooterSection = () => {
  const { t } = useTranslation("landing");

  return (
    <footer className="border-t border-white/10 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div dir="ltr">
          <img src="/clix-logo.svg" alt="CLIX" className="h-8" />
        </div>
        <p className="text-white/30 text-sm">
          &copy; {new Date().getFullYear()} CLIX. {t("allRightsReserved")}
        </p>
      </div>
    </footer>
  );
};

export default FooterSection;
