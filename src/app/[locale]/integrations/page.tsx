"use client";

import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Link2, Plug } from "lucide-react";

export default function IntegrationsPage() {
  const t = useTranslations("nav");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 space-y-6"
    >
      <h1 className="text-2xl font-bold tracking-tight">{t("integrations")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            {t("integrations")}
          </CardTitle>
          <CardDescription>
            Koppel je bestaande tools en services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Link2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Nog geen koppelingen</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">
              Koppel je tools zoals Google Search Console, Google Analytics,
              en meer om automatisering te starten.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
