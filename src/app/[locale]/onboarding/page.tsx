"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams as useNextSearchParams } from "next/navigation";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Globe,
  Target,
  Users,
  Package,
  MapPin,
  Link2,
  Scan,
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Loader2,
  Check,
} from "lucide-react";

const TOTAL_STEPS = 10;

const stepIcons = [
  Building2,
  Building2,
  Globe,
  Target,
  Users,
  Package,
  MapPin,
  Link2,
  Scan,
  ClipboardCheck,
];

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useNextSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [orgName, setOrgName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessIndustry, setBusinessIndustry] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [audiences, setAudiences] = useState("");
  const [products, setProducts] = useState("");
  const [services, setServices] = useState("");
  const [regions, setRegions] = useState("");

  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.project) {
            const p = data.project;
            if (p.onboardingStep) setCurrentStep(Math.min(p.onboardingStep + 1, TOTAL_STEPS));
            if (p.name) setOrgName(p.name);
            if (p.websiteUrl) setWebsiteUrl(p.websiteUrl);
            if (p.description) setBusinessDescription(p.description);
            if (data.brandProfile) {
              const bp = data.brandProfile;
              if (bp.brandName) setBusinessName(bp.brandName);
              if (bp.audiences) setAudiences(bp.audiences);
              if (bp.products) setProducts(bp.products);
              if (bp.services) setServices(bp.services);
              if (bp.regions) setRegions(bp.regions);
            }
          }
        })
        .catch(() => {
          // silently fail
        });
    }
  }, [projectId]);

  const goalOptions = [
    { id: "moreTraffic", labelKey: "goalMoreTraffic" },
    { id: "betterRankings", labelKey: "goalBetterRankings" },
    { id: "moreConversions", labelKey: "goalMoreConversions" },
    { id: "localVisibility", labelKey: "goalLocalVisibility" },
    { id: "contentQuality", labelKey: "goalContentQuality" },
    { id: "techHealth", labelKey: "goalTechHealth" },
  ];

  const toggleGoal = (goalId: string) => {
    setGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((g) => g !== goalId)
        : [...prev, goalId]
    );
  };

  const saveProgress = async (step: number) => {
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingStep: step,
          name: orgName || undefined,
          websiteUrl: websiteUrl || undefined,
          description: businessDescription || undefined,
          brandProfile: {
            brandName: businessName || undefined,
            audiences: audiences || undefined,
            products: products || undefined,
            services: services || undefined,
            regions: regions || undefined,
          },
        }),
      });
    } catch {
      // silently fail
    }
  };

  const handleNext = async () => {
    setIsSaving(true);
    try {
      await saveProgress(currentStep);
    } finally {
      setIsSaving(false);
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = async () => {
    setIsSaving(true);
    try {
      await saveProgress(currentStep);
    } finally {
      setIsSaving(false);
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await saveProgress(TOTAL_STEPS);
      if (projectId) {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingCompleted: true }),
        });
      }
      router.push("/dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  const progress = (currentStep / TOTAL_STEPS) * 100;
  const StepIcon = stepIcons[currentStep - 1] || Building2;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">{t("orgName")}</Label>
              <Input
                id="orgName"
                placeholder={t("orgNamePlaceholder")}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">{t("businessName")}</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessIndustry">{t("businessIndustry")}</Label>
              <Input
                id="businessIndustry"
                placeholder={t("businessIndustryPlaceholder")}
                value={businessIndustry}
                onChange={(e) => setBusinessIndustry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessDescription">{t("businessDescription")}</Label>
              <Textarea
                id="businessDescription"
                placeholder={t("businessDescriptionPlaceholder")}
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">{t("websiteUrl")}</Label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder={t("websiteUrlPlaceholder")}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <Label>{t("goals")}</Label>
            <div className="grid gap-3">
              {goalOptions.map((goal) => (
                <div key={goal.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={goal.id}
                    checked={goals.includes(goal.id)}
                    onCheckedChange={() => toggleGoal(goal.id)}
                  />
                  <label
                    htmlFor={goal.id}
                    className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t(goal.labelKey as Parameters<typeof t>[0])}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audiences">{t("audiences")}</Label>
              <Textarea
                id="audiences"
                placeholder={t("audiencesPlaceholder")}
                value={audiences}
                onChange={(e) => setAudiences(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{t("audiencesHelp")}</p>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="products">{t("products")}</Label>
              <Textarea
                id="products"
                placeholder={t("productsPlaceholder")}
                value={products}
                onChange={(e) => setProducts(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t("productsHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="services">{t("services")}</Label>
              <Textarea
                id="services"
                placeholder={t("servicesPlaceholder")}
                value={services}
                onChange={(e) => setServices(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t("servicesHelp")}</p>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regions">{t("regions")}</Label>
              <Textarea
                id="regions"
                placeholder={t("regionsPlaceholder")}
                value={regions}
                onChange={(e) => setRegions(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t("regionsHelp")}</p>
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Link2 className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground max-w-sm">
                {t("integrationsOptional")}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/integrations")}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {t("goToIntegrations")}
              </Button>
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Scan className="h-16 w-16 text-primary/40 mb-4" />
              <p className="text-sm text-muted-foreground max-w-sm">
                {t("prepareScanDesc")}
              </p>
              {websiteUrl && (
                <Badge variant="secondary" className="mt-3">
                  <Globe className="mr-1 h-3 w-3" />
                  {websiteUrl}
                </Badge>
              )}
            </div>
          </div>
        );
      case 10:
        return (
          <div className="space-y-4">
            <div className="grid gap-3">
              <SummaryRow label={t("summaryOrg")} value={orgName} />
              <SummaryRow label={t("summaryBusiness")} value={businessName || businessIndustry} />
              <SummaryRow label={t("summaryWebsite")} value={websiteUrl} />
              <SummaryRow
                label={t("summaryGoals")}
                value={
                  goals.length > 0
                    ? goals
                        .map((g) => {
                          const goal = goalOptions.find((o) => o.id === g);
                          return goal ? t(goal.labelKey as Parameters<typeof t>[0]) : g;
                        })
                        .join(", ")
                    : undefined
                }
              />
              <SummaryRow label={t("summaryAudiences")} value={audiences} />
              <SummaryRow
                label={t("summaryProducts")}
                value={[products, services].filter(Boolean).join(", ") || undefined}
              />
              <SummaryRow label={t("summaryRegions")} value={regions} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  type StepKey = "step1" | "step2" | "step3" | "step4" | "step5" | "step6" | "step7" | "step8" | "step9" | "step10";
  type StepDescKey = "step1Desc" | "step2Desc" | "step3Desc" | "step4Desc" | "step5Desc" | "step6Desc" | "step7Desc" | "step8Desc" | "step9Desc" | "step10Desc";

  const stepTitleKey = `step${currentStep}` as StepKey;
  const stepDescKey = `step${currentStep}Desc` as StepDescKey;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t("step", { current: currentStep, total: TOTAL_STEPS })}
            </span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-1 mb-6">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <button
              key={i}
              onClick={() => i + 1 < currentStep && setCurrentStep(i + 1)}
              className={`h-2 rounded-full transition-all ${
                i + 1 === currentStep
                  ? "w-6 bg-primary"
                  : i + 1 < currentStep
                    ? "w-2 bg-primary/60 cursor-pointer"
                    : "w-2 bg-muted"
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <div className="bg-primary/10 text-primary rounded-full p-3">
                <StepIcon className="h-6 w-6" />
              </div>
            </div>
            <CardTitle>{t(stepTitleKey)}</CardTitle>
            <CardDescription>{t(stepDescKey)}</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t">
              <div>
                {currentStep > 1 && (
                  <Button variant="ghost" onClick={handleBack} disabled={isSaving}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {tCommon("back")}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep < TOTAL_STEPS && (
                  <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
                    <SkipForward className="mr-2 h-4 w-4" />
                    {t("skip")}
                  </Button>
                )}
                {currentStep < TOTAL_STEPS ? (
                  <Button onClick={handleNext} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tCommon("next")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleComplete} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Check className="mr-2 h-4 w-4" />
                    {t("complete")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">
        {value || <span className="text-muted-foreground italic">{t("notSet")}</span>}
      </span>
    </div>
  );
}
