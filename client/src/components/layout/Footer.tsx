import { Link } from "wouter";
import { businessInfo } from "@/data/siteData";
import { SoapDivider } from "./SoapDivider";
import { Phone, Mail, MapPin, Clock, Instagram } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import logoImg from "@assets/Belly_Scrubs_logo-02_1772081283831.jpg";

const footerNav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/calendars", label: "Pet Calendars" },
  { href: "/book", label: "Book Now" },
];

export function Footer() {
  const todayIndex = new Date().getDay();
  const dayMap = [6, 0, 1, 2, 3, 4, 5];
  const todayHours = businessInfo.hours[dayMap[todayIndex]];

  return (
    <footer className="relative" data-testid="footer">
      <SoapDivider fillClass="text-[#1a2a33] dark:text-[#0d1519]" />

      <div className="bg-[#1a2a33] dark:bg-[#0d1519] text-[#d9eaf0] dark:text-[#c8dde5]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <img src={logoImg} alt={businessInfo.name} className="w-10 h-10 rounded-xl object-cover" />
                <span className="font-serif font-bold text-lg">{businessInfo.name}</span>
              </div>
              <p className="text-sm text-[#d9eaf0]/80 dark:text-[#c8dde5]/80 leading-relaxed">
                Pet grooming and self-service dog wash.
                Where every pup leaves happy, healthy, and fresh.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-[#7ab8d0]">
                Quick Links
              </h3>
              <ul className="space-y-2">
                {footerNav.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      <span className="text-sm text-[#d9eaf0]/70 dark:text-[#c8dde5]/70 cursor-pointer transition-colors" data-testid={`link-footer-${link.label.toLowerCase().replace(/\s/g, "-")}`}>
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-[#7ab8d0]">
                Contact
              </h3>
              <ul className="space-y-3 text-sm text-[#d9eaf0]/70 dark:text-[#c8dde5]/70">
                <li>
                  <a href={`tel:${businessInfo.phone}`} className="flex items-center gap-2" data-testid="link-footer-phone">
                    <Phone className="w-4 h-4 text-[#7ab8d0]" />
                    {businessInfo.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${businessInfo.email}`} className="flex items-center gap-2" data-testid="link-footer-email">
                    <Mail className="w-4 h-4 text-[#7ab8d0]" />
                    {businessInfo.email}
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.google.com/maps/place/Belly+Scrubs/@38.4492417,-81.9412796,20.79z/data=!4m6!3m5!1s0x8848b41aa0fdfedb:0xf16244a8ad67948d!8m2!3d38.4494!4d-81.94132!16s%2Fg%2F1tftxn7r?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2"
                    data-testid="link-footer-address"
                  >
                    <MapPin className="w-4 h-4 text-[#7ab8d0] mt-0.5 flex-shrink-0" />
                    <span>
                      {businessInfo.address}<br />
                      {businessInfo.city}, {businessInfo.state} {businessInfo.zip}
                    </span>
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-[#7ab8d0]">
                Hours
              </h3>
              <div className="space-y-1.5 text-sm text-[#d9eaf0]/70 dark:text-[#c8dde5]/70">
                {businessInfo.hours.map((h) => (
                  <div key={h.day} className={`flex justify-between gap-2 ${h.day === todayHours?.day ? "text-[#7ab8d0] font-medium" : ""}`}>
                    <span>{h.day.slice(0, 3)}</span>
                    <span>{h.open === "Closed" ? "Closed" : `${h.open} - ${h.close}`}</span>
                  </div>
                ))}
                {todayHours && (
                  <div className="flex items-center gap-1.5 mt-3 text-[#7ab8d0] text-xs">
                    <Clock className="w-3 h-3" />
                    {todayHours.open === "Closed" ? "Closed today" : `Open today ${todayHours.open} - ${todayHours.close}`}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-3 text-[#7ab8d0] text-xs">
                  <Clock className="w-3 h-3" />
                  Self-Service Wash: {businessInfo.selfWashHours}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#d9eaf0]/10 dark:border-[#c8dde5]/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#d9eaf0]/50 dark:text-[#c8dde5]/50">
              {new Date().getFullYear()} {businessInfo.name}. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={businessInfo.socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#d9eaf0]/10 flex items-center justify-center transition-colors"
                aria-label="Instagram"
                data-testid="link-instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={businessInfo.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#d9eaf0]/10 flex items-center justify-center transition-colors"
                aria-label="Facebook"
                data-testid="link-facebook"
              >
                <SiFacebook className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
