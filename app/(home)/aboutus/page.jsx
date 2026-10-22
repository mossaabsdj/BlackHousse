"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";

export default function AboutUs({
  companyName = "Ski agrotour luxe",
  logo = "/images/logo.png", // 🖼️ put your logo in /public/logo.png
  title = "About Us",
  subtitle = "Who We Are",
  description = "Our project aims to create an innovative digital platform that brings together various Algerian farms — both agricultural and livestock — within a unified space. Each farm has a professional profile that allows it to showcase its products and promote its agritourism activities. The platform serves as a bridge between agriculture and tourism, offering visitors an authentic and healthy rural experience.",
  missionTitle = "Our Mission",
  missionText = "To create modern web, mobile, and desktop experiences personalized to each client’s needs.",
  visionTitle = "Our Vision",
  visionText = "To shape the future of technology through seamless design and user-focused innovation.",
}) {
  const { startLoading } = useNavigationLoading();

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
            <p className="text-gray-800 leading-relaxed">{description}</p>
          </CardContent>
        </Card>

        {/* Mission & Vision */}

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
