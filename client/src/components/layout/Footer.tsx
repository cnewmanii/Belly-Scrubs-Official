import { Link } from "wouter";
import { businessInfo } from "@/data/siteData";
import { SoapDivider } from "./SoapDivider";
import { Phone, Mail, MapPin, Clock, Instagram } from "lucide-react";
import { SiFacebook, SiTiktok } from "react-icons/si";

const footerNav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/calendars", label: "Calendars" },
  { href: "/book", label: "Book Now" },
];

export function Footer() {
  const todayIndex = new Date().getDay();
  const dayMap = [6, 0, 1, 2, 3, 4, 5];
  const todayHours = businessInfo.hours[dayMap[todayIndex]];

  return (
    <footer className="relative" data-testid="footer">
      <SoapDivider fillClass="text-[#45484A] dark:text-[#1a1d20]" />

      <div className="bg-[#45484A] dark:bg-[#1a1d20] text-[#F7F1E1] dark:text-[#e8e0cc]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#BAD9E5] flex items-center justify-center">
                  <span className="text-[#45484A] font-bold text-sm">BS</span>
                </div>
                <span className="font-bold text-lg">{businessInfo.name}</span>
              </div>
              <p className="text-sm text-[#F7F1E1]/80 dark:text-[#e8e0cc]/80 leading-relaxed">
                Premium dog grooming and self-service pet wash.
                Where every pup leaves happy, healthy, and fresh.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-[#BAD9E5]">
                Quick Links
              </h3>
              <ul className="space-y-2">
                {footerNav.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      <span className="text-sm text-[#F7F1E1]/70 dark:text-[#e8e0cc]/70 cursor-pointer transition-colors" data-testid={`link-footer-${link.label.toLowerCase().replace(/\s/g, "-")}`}>
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-[#BAD9E5]">
                Contact
              </h3>
              <ul className="space-y-3 text-sm text-[#F7F1E1]/70 dark:text-[#e8e0cc]/70">
                <li>
                  <a href={`tel:${businessInfo.phone}`} className="flex items-center gap-2" data-testid="link-footer-phone">
                    <Phone className="w-4 h-4 text-[#BAD9E5]" />
                    {businessInfo.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${businessInfo.email}`} className="flex items-center gap-2" data-testid="link-footer-email">
                    <Mail className="w-4 h-4 text-[#BAD9E5]" />
                    {businessInfo.email}
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#BAD9E5] mt-0.5 flex-shrink-0" />
                  <span>
                    {businessInfo.address}<br />
                    {businessInfo.city}, {businessInfo.state} {businessInfo.zip}
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-[#BAD9E5]">
                Hours
              </h3>
              <div className="space-y-1.5 text-sm text-[#F7F1E1]/70 dark:text-[#e8e0cc]/70">
                {businessInfo.hours.map((h) => (
                  <div key={h.day} className={`flex justify-between gap-2 ${h.day === todayHours?.day ? "text-[#BAD9E5] font-medium" : ""}`}>
                    <span>{h.day.slice(0, 3)}</span>
                    <span>{h.open === "Closed" ? "Closed" : `${h.open} - ${h.close}`}</span>
                  </div>
                ))}
                {todayHours && (
                  <div className="flex items-center gap-1.5 mt-3 text-[#BAD9E5] text-xs">
                    <Clock className="w-3 h-3" />
                    {todayHours.open === "Closed" ? "Closed today" : `Open today ${todayHours.open} - ${todayHours.close}`}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[#F7F1E1]/10 dark:border-[#e8e0cc]/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#F7F1E1]/50 dark:text-[#e8e0cc]/50">
              {new Date().getFullYear()} {businessInfo.name}. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={businessInfo.socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#F7F1E1]/10 flex items-center justify-center transition-colors"
                aria-label="Instagram"
                data-testid="link-instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={businessInfo.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#F7F1E1]/10 flex items-center justify-center transition-colors"
                aria-label="Facebook"
                data-testid="link-facebook"
              >
                <SiFacebook className="w-4 h-4" />
              </a>
              <a
                href={businessInfo.socialLinks.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#F7F1E1]/10 flex items-center justify-center transition-colors"
                aria-label="TikTok"
                data-testid="link-tiktok"
              >
                <SiTiktok className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
