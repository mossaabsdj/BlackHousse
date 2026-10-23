"use client";

import {
  Facebook,
  Instagram,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavigationLoading } from "@/app/component/NavigationLoading/NavigationLoadingContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import LanguageSwitcher from "@/app/component/LanguageSwitcher";

// === Color Variables (Tailwind utility class names) ===
const bgColor = "bg-black";
const textColor = "text-white";
const secondaryTextColor = "text-gray-400";
const sectionTitleColor = "text-white";
const borderColor = "border-gray-800";
const underlineBorderColor = "border-gray-700";
const linkHoverColor = "hover:text-white";
const iconColor = "text-gray-400";
const iconHoverColor = "hover:text-white";

export default function Footer() {
  const pathname = usePathname();
  const { startLoading } = useNavigationLoading();
  const { content, t, isRTL } = useI18n();
  const f = content.Footer;

  const companyName = f?.companyName || "Black Housse";
  const companyDescription = f?.companyDescription || "where Elegance Meets Taste....";
  const address = f?.address || "harrouch/skikda";
  const phoneNumber = f?.phoneNumber || "0658953461";
  const email = f?.email || "BlackHousse@gmail.com";

  const companyLinks = [
    { name: f?.links?.aboutUs || f?.aboutUs || "À propos", href: "/aboutus" }
  ];

  const supportLinks = [
    { name: f?.links?.helpCenter || f?.helpCenter || "Centre d'aide", href: "/HelpCenter" },
    { name: f?.links?.privacyPolicy || f?.privacyPolicy || "Politique de confidentialité", href: "/Privacy&Policy" },
    { name: f?.links?.termsConditions || f?.termsConditions || "Conditions générales", href: "/Terms&conditions" },
  ];

  const year = new Date().getFullYear();
  const footerNote = f?.copyright
    ? f.copyright.replace("{year}", year)
    : `© ${year} ${companyName}. ${f?.rightsReserved || "Tous droits réservés."}`;

  return (
    <footer
      id="Footer"
      className={`${bgColor} ${textColor} px-6 py-12 border-t ${borderColor}`}
    >
      <div className="max-w-7xl mx-auto overflow-x-hidden grid grid-cols-1 md:grid-cols-4 gap-10 text-sm">
        {/* Company Info */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{companyName}</h2>
          <p className={`${secondaryTextColor}`}>{companyDescription}</p>
          <div className={`space-y-2 ${secondaryTextColor}`}>
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 flex-none ${textColor}`} />
              <span>{address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className={`w-4 h-4 flex-none ${textColor}`} />
              <span dir="ltr">{phoneNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className={`w-4 h-4 flex-none ${textColor}`} />
              <span>{email}</span>
            </div>
          </div>
        </div>

        {/* Company Links */}
        <div className="space-y-3">
          <h3
            className={`text-lg font-medium ${sectionTitleColor} border-b ${underlineBorderColor} pb-1`}
          >
            {f?.companyTitle || "Entreprise"}
          </h3>
          <ul className={`space-y-2 ${secondaryTextColor}`}>
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => {
                    if (pathname !== link.href) startLoading(link.href);
                  }}
                  className={`${linkHoverColor} transition`}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support Links */}
        <div className="space-y-3">
          <h3
            className={`text-lg font-medium ${sectionTitleColor} border-b ${underlineBorderColor} pb-1`}
          >
            {f?.supportTitle || "Assistance"}
          </h3>
          <ul className={`space-y-2 ${secondaryTextColor}`}>
            {supportLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => {
                    if (pathname !== link.href) startLoading(link.href);
                  }}
                  className={`${linkHoverColor} transition`}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Social Media & Language Switcher */}
        <div className="space-y-4 text-center md:text-start">
          <h3
            className={`text-lg font-medium ${sectionTitleColor} border-b ${underlineBorderColor} pb-1`}
          >
            {f?.contactTitle || f?.followUs || "Suivez-nous"}
          </h3>
          <div className="flex justify-center md:justify-start space-x-4 rtl:space-x-reverse">
            <a
              href="https://www.facebook.com/share/18vufNN8ym/?mibextid=wwXIfr23:22"
              aria-label="Facebook"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook className={`w-5 h-5 ${iconColor} ${iconHoverColor}`} />
            </a>
            <a
              href="https://www.instagram.com/black_house_food21"
              aria-label="Instagram"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram className={`w-5 h-5 ${iconColor} ${iconHoverColor}`} />
            </a>
            <a
              href="https://wa.me/qr/OBSZF5MXZ3PB1"
              aria-label="WhatsApp"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={"/images/whatsapp.png"}
                alt="WhatsApp"
                width={24}
                height={24}
                className={`w-6 h-6 ${iconColor} ${iconHoverColor}`}
              />
            </a>
            <a
              href="https://t.me/BlackHousse"
              aria-label="Telegram"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={"/images/telegramme.png"}
                alt="Telegram"
                width={24}
                height={24}
                className={`w-6 h-6 mx-3 text-white ${iconColor} ${iconHoverColor}`}
              />
            </a>
          </div>

          <div className="pt-2">
            <LanguageSwitcher variant="footer" className="justify-center md:justify-start" />
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div
        className={`mt-10 border-t ${borderColor} pt-6 text-center text-xs text-gray-500`}
      >
        {footerNote}
      </div>
    </footer>
  );
}
