import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, MapPin, Calendar } from "lucide-react";
import { businessInfo } from "@/data/siteData";
import logoImg from "@assets/Belly_Scrubs_logo-02_1772081283831.jpg";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/calendars", label: "Pet Calendars" },
  { href: "/book", label: "Book" },
];

export function Navbar() {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 30 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "py-2 px-4 md:px-6 lg:px-8"
          : "py-3 md:py-4 px-4 md:px-6 lg:px-8"
      }`}
    >
      <nav
        className={`mx-auto max-w-7xl w-full flex items-center justify-between gap-3 md:gap-4 lg:gap-6 transition-all duration-300 rounded-2xl px-4 md:px-6 lg:px-8 py-3 md:py-4 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg"
            : "bg-transparent"
        }`}
        data-testid="navbar"
      >
        <Link href="/" data-testid="link-home-logo">
          <div className="flex items-center gap-2 cursor-pointer shrink-0 min-w-0">
            <img src={logoImg} alt={businessInfo.name} className="w-10 h-10 md:w-11 md:h-11 rounded-xl object-cover flex-shrink-0" />
            <span className="font-serif font-bold tracking-tight text-foreground hidden sm:block text-xl md:text-2xl truncate">
              {businessInfo.name}
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1 lg:gap-2 xl:gap-3 flex-shrink-0" role="navigation" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 lg:px-4 xl:px-5 py-2 rounded-full text-base md:text-lg font-medium transition-colors duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                location === link.href
                  ? "text-primary bg-primary/10"
                  : "text-foreground/70 hover:text-foreground hover:bg-foreground/10"
              }`}
              aria-current={location === link.href ? "page" : undefined}
              data-testid={`link-nav-${link.label.toLowerCase()}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
          <a
            href={`tel:${businessInfo.phone}`}
            className="hidden xl:flex rounded-full transition-colors duration-200 hover:bg-foreground/10"
            data-testid="link-phone"
          >
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Call us">
              <Phone className="w-4 h-4" />
            </Button>
          </a>

          <a
            href="https://www.google.com/maps/place/Belly+Scrubs/@38.4492417,-81.9412796,20.79z/data=!4m6!3m5!1s0x8848b41aa0fdfedb:0xf16244a8ad67948d!8m2!3d38.4494!4d-81.94132!16s%2Fg%2F1tftxn7r?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:flex rounded-full transition-colors duration-200 hover:bg-foreground/10"
            data-testid="link-directions"
          >
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Get directions">
              <MapPin className="w-4 h-4" />
            </Button>
          </a>

          <Link href="/book">
            <Button className="hidden md:flex gap-2 px-5 py-2.5 text-base" data-testid="button-book-now-nav">
              <Calendar className="w-4 h-4" />
              <span className="hidden lg:inline">Book Now</span>
              <span className="lg:hidden">Book</span>
            </Button>
          </Link>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu" aria-label="Menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <div className="flex flex-col gap-1 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      location === link.href
                        ? "text-primary bg-primary/10"
                        : "text-foreground/70 hover:text-foreground hover:bg-foreground/10"
                    }`}
                    aria-current={location === link.href ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    data-testid={`link-mobile-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="border-t border-border/50 my-4" />
                <Link href="/book">
                  <Button className="w-full" onClick={() => setMobileOpen(false)} data-testid="button-book-now-mobile">
                    <Calendar className="w-4 h-4 mr-2" />
                    Book Appointment
                  </Button>
                </Link>
                <div className="mt-4 px-4 space-y-2 text-sm text-muted-foreground">
                  <a href={`tel:${businessInfo.phone}`} className="flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {businessInfo.phone}
                  </a>
                  <a
                    href="https://www.google.com/maps/place/Belly+Scrubs/@38.4492417,-81.9412796,20.79z/data=!4m6!3m5!1s0x8848b41aa0fdfedb:0xf16244a8ad67948d!8m2!3d38.4494!4d-81.94132!16s%2Fg%2F1tftxn7r?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4" /> {businessInfo.city}, {businessInfo.state}
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
}
