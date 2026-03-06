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
          ? "py-2 px-3 md:px-6"
          : "py-3 px-3 md:px-6"
      }`}
    >
      <nav
        className={`mx-auto max-w-6xl w-full flex items-center justify-between gap-2 transition-all duration-300 rounded-2xl px-4 md:px-6 py-3 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg"
            : "bg-transparent"
        }`}
        data-testid="navbar"
      >
        <Link href="/" data-testid="link-home-logo">
          <div className="flex items-center gap-2 cursor-pointer shrink-0">
            <img src={logoImg} alt={businessInfo.name} className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-serif font-bold text-lg tracking-tight text-foreground hidden sm:block lg:text-lg md:text-base">
              {businessInfo.name}
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-0.5 lg:gap-1" role="navigation" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                location === link.href
                  ? "text-primary bg-primary/10"
                  : "text-foreground/70"
              }`}
              aria-current={location === link.href ? "page" : undefined}
              data-testid={`link-nav-${link.label.toLowerCase()}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 lg:gap-2 shrink-0">
          <a
            href={`tel:${businessInfo.phone}`}
            className="hidden lg:flex"
            data-testid="link-phone"
          >
            <Button variant="ghost" size="icon" aria-label="Call us">
              <Phone className="w-4 h-4" />
            </Button>
          </a>

          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(businessInfo.address + ", " + businessInfo.city)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex"
            data-testid="link-directions"
          >
            <Button variant="ghost" size="icon" aria-label="Get directions">
              <MapPin className="w-4 h-4" />
            </Button>
          </a>

          <Link href="/book">
            <Button size="sm" className="hidden md:flex gap-1.5" data-testid="button-book-now-nav">
              <Calendar className="w-3.5 h-3.5" />
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
                    className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      location === link.href
                        ? "text-primary bg-primary/10"
                        : "text-foreground/70"
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
                    href={`https://maps.google.com/?q=${encodeURIComponent(businessInfo.address)}`}
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
