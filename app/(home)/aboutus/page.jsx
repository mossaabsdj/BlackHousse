"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function AboutUs() {
  const { content, isRTL } = useI18n();
  const a = content.AboutUs;
  const f = content.Footer;
  const { startLoading } = useNavigationLoading();

  const companyName = f?.companyName || "Black Housse";
  const logo = "/images/logo.png";
  const title = a?.title || "À propos de nous";
  const subtitle = a?.subtitle || "Qui sommes-nous ?";
  const description = a?.description || "BlackHousse est un restaurant et fast-food gourmet dédié à offrir une expérience culinaire d'exception.";
  const missionTitle = a?.missionTitle || "Notre Mission";
  const missionText = a?.missionText;
  const visionTitle = a?.visionTitle || "Notre Vision";
  const visionText = a?.visionText;
  const backHome = a?.backHome || "Retour à l'accueil";

  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-6 py-16">
      {/* Header Section */}
      <div className="flex flex-col items-center space-y-4 mb-12">
        <div className="relative w-20 h-20">
          <Image
            src={logo}
            alt={`${companyName} Logo`}
            fill
            className="object-contain rounded-full border border-gray-300 shadow-sm"
          />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase">
          {companyName}
        </h1>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl w-full space-y-10 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold">{title}</h2>
          <Separator className="bg-black w-16 mx-auto" />
          <p className="text-gray-600">{subtitle}</p>
        </div>

        {/* Description */}
        <Card className="border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition">
          <CardContent className="p-8">
            <p className="text-gray-800 leading-relaxed text-center sm:text-start">{description}</p>
          </CardContent>
        </Card>

        {/* Mission & Vision */}
        {(missionText || visionText) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
            {missionText && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-bold text-lg text-orange-600">{missionTitle}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{missionText}</p>
                </CardContent>
              </Card>
            )}
            {visionText && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm">
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-bold text-lg text-orange-600">{visionTitle}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{visionText}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="flex justify-center mt-10">
          <Button
            asChild
            variant="outline"
            className="border-2 border-black text-black hover:bg-black hover:text-white transition-all duration-300 px-6 py-2 rounded-full"
          >
            <Link href="/" onClick={() => startLoading("/")}>
              <span className={isRTL ? "rtl-flip inline-block mr-1" : "inline-block mr-1"}>←</span> {backHome}
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-16 text-sm text-gray-500">
        © {new Date().getFullYear()} {companyName}. {f?.rightsReserved || "Tous droits réservés."}
      </p>
    </div>
  );
}
