import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PricingCard } from "@/components/ui/dark-gradient-pricing";

interface BenefitItem {
  text: string;
  included: boolean;
}

const PricingSection = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();

  const tiers = [
    {
      tier: t("tierFree"),
      price: t("priceFree"),
      bestFor: t("bestForFree"),
      cta: t("ctaFree"),
      benefits: t("featuresFree", { returnObjects: true }) as BenefitItem[],
    },
    {
      tier: t("tierPro"),
      price: t("pricePro"),
      period: t("perMonth"),
      bestFor: t("bestForPro"),
      cta: t("ctaPro"),
      benefits: t("featuresPro", { returnObjects: true }) as BenefitItem[],
      popular: true,
    },
    {
      tier: t("tierEnterprise"),
      price: t("priceEnterprise"),
      bestFor: t("bestForEnterprise"),
      cta: t("ctaEnterprise"),
      benefits: t("featuresEnterprise", {
        returnObjects: true,
      }) as BenefitItem[],
    },
  ];

  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[#FF6B2C] text-sm font-bold tracking-wider uppercase mb-3 block">
            {t("pricing")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            {t("pricingTitle")}
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.tier}
              {...tier}
              onSelect={() => navigate("/auth")}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
