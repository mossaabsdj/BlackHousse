"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export default function PrivacyPolicy({
  companyName = "Black Housse",
  logo = "/images/logo.png",
  title = "Politique de confidentialité",
  subtitle = "Vos données personnelles sont protégées",
  description = "Chez BlackHousse, nous accordons une importance primordiale à la confidentialité et à la sécurité de vos données personnelles.",
  sections = [
    {
      title: "Collecte des données",
      text: "Nous collectons uniquement les informations nécessaires au traitement de vos commandes (nom, numéro de téléphone, adresse de livraison et préférences de notification push).",
    },
    {
      title: "Utilisation des données",
      text: "Vos données sont utilisées exclusivement pour préparer vos repas, assurer la livraison dans les meilleures conditions et vous transmettre le suivi en temps réel.",
    },
    {
      title: "Sécurité & Confidentialité",
      text: "Nous appliquons des standards stricts de chiffrement et de sécurité. Vos informations personnelles ne sont jamais vendues, partagées ou transmises à des tiers sans votre accord.",
    },
  ],
}) {
  const { startLoading } = useNavigationLoading();

  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-6 py-16">
      {/* Header */}
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

      {/* Content */}
      <div className="max-w-3xl w-full space-y-10 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold">{title}</h2>
          <Separator className="bg-black w-16 mx-auto" />
          <p className="text-gray-600">{subtitle}</p>
        </div>

        <Card className="border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition">
          <CardContent className="p-8 space-y-6 text-left">
            <p className="text-gray-800">{description}</p>
            {sections.map((section, index) => (
              <div key={index}>
                <h4 className="font-semibold text-lg">{section.title}</h4>
                <p className="text-gray-700">{section.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-center mt-10">
          <Button
            asChild
            variant="outline"
            className="border-2 border-black text-black hover:bg-black hover:text-white transition-all duration-300 px-6 py-2 rounded-full"
          >
            <Link href="/" onClick={() => startLoading("/")}>
              ← Back to Home
            </Link>
          </Button>
        </div>
      </div>

      <p className="mt-16 text-sm text-gray-500">
        © {new Date().getFullYear()} {companyName}. All rights reserved.
      </p>
    </div>
  );
}
