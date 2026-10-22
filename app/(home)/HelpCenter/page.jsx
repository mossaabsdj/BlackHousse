"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export default function HelpCenter({
  companyName = "Black Housse",
  logo = "/images/logo.png",
  title = "Centre d'aide & FAQ",
  subtitle = "Questions fréquemment posées",
  description = "Trouvez des réponses rapides aux questions courantes concernant vos commandes en ligne, la livraison, le suivi en direct et nos services.",
  faq = [
    {
      q: "Comment passer une commande sur BlackHousse ?",
      a: "Rendez-vous dans la rubrique 'Notre Menu' ou cliquez sur 'Commander', sélectionnez vos plats préférés, personnalisez vos options et validez votre panier en indiquant votre adresse et numéro de téléphone.",
    },
    {
      q: "Quels sont les modes de récupération disponibles ?",
      a: "Vous pouvez choisir entre la livraison à domicile dans votre municipalité ou le retrait sur place (à emporter) dans notre restaurant.",
    },
    {
      q: "Comment suivre ma commande en temps réel ?",
      a: "Dès que vous confirmez votre commande, un numéro de référence unique vous est attribué. Vous pouvez suivre l'état d'avancement de votre commande en direct depuis le bouton 'Suivre' dans le menu.",
    },
    {
      q: "Puis-je recevoir des notifications sur l'état de ma commande ?",
      a: "Oui, vous pouvez activer les notifications push sur votre téléphone ou ordinateur pour être averti dès que votre commande est confirmée, en préparation ou en cours de livraison.",
    },
    {
      q: "Quels sont les moyens de paiement acceptés ?",
      a: "Le paiement s'effectue en espèces lors de la livraison ou au comptoir lors du retrait de votre commande.",
    },
    {
      q: "Comment contacter le service client en cas de problème ?",
      a: "Vous pouvez nous joindre par téléphone au 0658953461, par email à BlackHousse@gmail.com, ou directement via WhatsApp et Telegram indiqués dans le pied de page.",
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
            {faq.map((item, index) => (
              <div key={index}>
                <h4 className="font-semibold text-lg">{item.q}</h4>
                <p className="text-gray-700">{item.a}</p>
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
