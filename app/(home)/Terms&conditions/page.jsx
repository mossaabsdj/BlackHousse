"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export default function TermsConditions({
  companyName = "Black Housse",
  logo = "/images/logo.png",
  title = "Conditions Générales d'Utilisation",
  subtitle = "À lire attentivement",
  description = "En utilisant la plateforme de commande BlackHousse, vous acceptez de respecter les conditions générales énoncées ci-dessous régissant nos services de restauration et livraison.",

  sections = [
    {
      title: "1. Acceptation des conditions",
      text: "L'accès et l'utilisation de nos services en ligne impliquent l'acceptation pleine et entière des présentes conditions générales.",
    },
    {
      title: "2. Commandes et Disponibilité",
      text: "Toute commande est transmise directement à notre cuisine. Les plats sont proposés dans la limite des stocks et ingrédients frais disponibles.",
    },
    {
      title: "3. Livraison et Délais",
      text: "Nous mettons tout en œuvre pour livrer vos repas chauds et dans les délais estimés. Les délais de livraison peuvent varier selon les conditions de circulation et les horaires de pointe.",
    },
    {
      title: "4. Paiement",
      text: "Le paiement des commandes s'effectue en espèces lors de la livraison à domicile ou lors du retrait sur place au comptoir.",
    },
    {
      title: "5. Annulation et Réclamation",
      text: "En cas de problème sur une commande livrée ou pour toute réclamation, veuillez contacter immédiatement notre service client au 0658953461.",
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

      {/* Main Content */}
      <div className="max-w-3xl w-full space-y-10 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold">{title}</h2>
          <Separator className="bg-black w-16 mx-auto" />
          <p className="text-gray-600">{subtitle}</p>
        </div>

        <Card className="border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition">
          <CardContent className="p-8 space-y-6 text-left">
            <p className="text-gray-800 leading-relaxed">{description}</p>
            {sections.map((section, index) => (
              <div key={index}>
                <h4 className="font-semibold text-lg mb-1">{section.title}</h4>
                <p className="text-gray-700">{section.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Back Button */}
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

      {/* Footer */}
      <p className="mt-16 text-sm text-gray-500">
        © {new Date().getFullYear()} {companyName}. All rights reserved.
      </p>
    </div>
  );
}
