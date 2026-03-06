import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SoapDivider } from "@/components/layout/SoapDivider";
import {
  services,
  testimonials,
  faqs,
  businessInfo,
} from "@/data/siteData";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import {
  Scissors,
  Droplets,
  Wind,
  Sparkles,
  Waves,
  Star,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Before/After grooming photos
import before1 from "@assets/Before_Poodle.jpeg";
import after1 from "@assets/After_Poodle.jpeg";
import before2 from "@assets/Before_Moodle.JPEG";
import after2 from "@assets/After_Moodle.JPEG";
import before3 from "@assets/Before_Retriever.jpeg";
import after3 from "@assets/After_Retriever.JPEG";
import before4 from "@assets/Before_Yorki.jpeg";
import after4 from "@assets/After_Yorki.jpeg";

const groomingPairs = [
  { before: before1, after: after1, name: "Poodle" },
  { before: before2, after: after2, name: "Moodle" },
  { before: before3, after: after3, name: "Golden Retriever" },
  { before: before4, after: after4, name: "Yorkie" },
];
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

const iconMap: Record<string, any> = { Scissors, Droplets, Wind, Sparkles, Waves };

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

interface HeroPhoto {
  id: number;
  imageData: string;
  caption: string | null;
}

function HeroSection() {
  const { data: photos } = useQuery<HeroPhoto[]>({ queryKey: ["/api/hero-photos"] });
  const hasPhotos = photos && photos.length > 0;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [preloaded, setPreloaded] = useState<Set<number>>(new Set());

  // Preload next image
  const preloadImage = useCallback(
    (idx: number) => {
      if (!hasPhotos || preloaded.has(idx)) return;
      const img = new Image();
      img.src = photos[idx].imageData;
      setPreloaded((prev) => new Set(prev).add(idx));
    },
    [photos, hasPhotos, preloaded],
  );

  // Rotate every 5 seconds
  useEffect(() => {
    if (!hasPhotos || photos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((c) => (c + 1) % photos.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasPhotos, photos?.length]);

  // Preload the next image whenever currentIdx changes
  useEffect(() => {
    if (!hasPhotos) return;
    const nextIdx = (currentIdx + 1) % photos.length;
    preloadImage(nextIdx);
  }, [currentIdx, hasPhotos, photos?.length, preloadImage]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-6 pt-24 pb-16" data-testid="section-hero">
      {/* Background layer */}
      <div className="absolute inset-0 overflow-hidden">
        {hasPhotos ? (
          <>
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
                style={{ opacity: i === currentIdx ? 1 : 0 }}
              >
                <img
                  src={photo.imageData}
                  alt={photo.caption || "Hero background"}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/50" />
          </>
        ) : (
          <>
            <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-[#7ab8d0]/20 dark:bg-[#7ab8d0]/5 blur-3xl" />
            <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-[#7ab8d0]/15 dark:bg-[#7ab8d0]/5 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          </>
        )}
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative max-w-3xl mx-auto text-center"
      >
        <motion.div variants={fadeUp} transition={{ duration: 0.6 }}>
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium tracking-wide">
            Professional Dog Grooming
          </Badge>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6 ${
            hasPhotos ? "text-white" : "text-foreground"
          }`}
        >
          Where Every Pup{" "}
          <span className={hasPhotos ? "text-[#7ab8d0]" : "text-primary"}>Leaves Happy</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed ${
            hasPhotos ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          Award-winning grooming, gentle handling, and 24/7 self-service wash stations.
          Proudly serving Hurricane, WV and the Putnam County area since 2010.
        </motion.p>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link href="/book">
            <Button size="lg" className="gap-2 text-base px-8" data-testid="button-hero-book">
              <Calendar className="w-4 h-4" />
              Book an Appointment
            </Button>
          </Link>
          <Link href="/about">
            <Button variant="outline" size="lg" className={`gap-2 text-base px-8 ${
              hasPhotos ? "border-white/30 text-white hover:bg-white/10" : ""
            }`} data-testid="button-hero-services">
              View Services
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.4 }}
          className={`mt-12 flex items-center justify-center gap-6 text-sm ${
            hasPhotos ? "text-white/70" : "text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className={`font-medium ${hasPhotos ? "text-white" : "text-foreground"}`}>5.0</span>
          </div>
          <div className={`w-px h-4 ${hasPhotos ? "bg-white/30" : "bg-border"}`} />
          <span>500+ happy pups</span>
        </motion.div>
      </motion.div>
    </section>
  );
}

function AvailabilityTeaser() {
  const slots = ["9:00 AM", "10:30 AM", "1:00 PM", "3:30 PM"];

  return (
    <section className="px-6 pb-16" data-testid="section-availability">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={fadeUp}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <Card className="p-6 sm:p-8 bg-[#7ab8d0]/20 dark:bg-[#7ab8d0]/5 border-[#7ab8d0]/30 dark:border-[#7ab8d0]/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-foreground" data-testid="text-availability-title">
                  Today's Availability
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Open slots for quick booking</p>
            </div>
            <Link href="/book">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-view-calendar">
                <Clock className="w-3.5 h-3.5" />
                Book Now
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((time) => (
              <Link key={time} href="/book">
                <span
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-background border border-border text-sm font-medium cursor-pointer hover-elevate transition-all"
                  data-testid={`button-slot-${time.replace(/\s/g, "-")}`}
                >
                  {time}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section className="relative" data-testid="section-services">
      <SoapDivider fillClass="text-[#7ab8d0]/20 dark:text-[#7ab8d0]/5" />
      <div className="bg-[#7ab8d0]/20 dark:bg-[#7ab8d0]/5 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} transition={{ duration: 0.5 }} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Our Services
            </motion.h2>
            <motion.p variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="text-muted-foreground max-w-lg mx-auto">
              From award-winning grooming to our 24/7 self-service Evolution Dog Wash, we have everything your pet needs.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {services.map((service) => {
              const Icon = iconMap[service.icon] || Sparkles;
              return (
                <motion.div key={service.id} variants={fadeUp} transition={{ duration: 0.4 }}>
                  <Card className="relative p-6 h-full hover-elevate transition-all" data-testid={`card-service-${service.id}`}>
                    {service.popular && (
                      <Badge variant="default" className="absolute top-4 right-4 text-xs">
                        Popular
                      </Badge>
                    )}
                    <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">{service.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{service.description}</p>
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-foreground">
                          {"priceRange" in service && service.priceRange ? service.priceRange : `$${service.price}`}
                        </span>
                        {"sizeOptions" in service && service.sizeOptions && (
                          <span className="text-xs text-muted-foreground">& up</span>
                        )}
                        <span className="text-xs text-muted-foreground">{service.duration} min</span>
                      </div>
                      <Link href="/book">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid={`button-book-${service.id}`}>
                          Book <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
      <SoapDivider flip fillClass="text-[#7ab8d0]/20 dark:text-[#7ab8d0]/5" />
    </section>
  );
}

function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="px-6 py-20" data-testid="section-testimonials">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
          className="text-center mb-12"
        >
          <motion.h2 variants={fadeUp} transition={{ duration: 0.5 }} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            What Pet Parents Say
          </motion.h2>
          <motion.div variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-2 text-sm text-muted-foreground">5.0 average rating</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <Card className="p-8 sm:p-10 text-center min-h-[200px] flex flex-col items-center justify-center">
            <div key={current} className="animate-in fade-in duration-500">
              <p className="text-lg sm:text-xl leading-relaxed text-foreground mb-6 italic max-w-2xl mx-auto">
                "{testimonials[current].text}"
              </p>
              <div>
                <p className="font-semibold text-foreground" data-testid="text-testimonial-name">
                  {testimonials[current].name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Pet parent of {testimonials[current].petName}
                </p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)}
              data-testid="button-testimonial-prev"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex gap-1.5">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === current ? "bg-primary w-6" : "bg-border"
                  }`}
                  aria-label={`Go to testimonial ${i + 1}`}
                  data-testid={`button-testimonial-dot-${i}`}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrent((c) => (c + 1) % testimonials.length)}
              data-testid="button-testimonial-next"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function BeforeAfterSection() {
  return (
    <section className="px-6 py-16" data-testid="section-gallery">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
          className="text-center mb-12"
        >
          <motion.h2 variants={fadeUp} transition={{ duration: 0.5 }} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            The Belly scRubs Difference
          </motion.h2>
          <motion.p variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="text-muted-foreground max-w-lg mx-auto">
            Drag the slider to see the transformation. Every pup leaves looking and feeling their best.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          {groomingPairs.map((pair, i) => (
            <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }}>
              <Card className="p-3 hover-elevate transition-all">
                <BeforeAfterSlider
                  beforeSrc={pair.before}
                  afterSrc={pair.after}
                  beforeAlt={`${pair.name} before grooming`}
                  afterAlt={`${pair.name} after grooming`}
                />
                <p className="text-sm font-medium text-foreground text-center mt-3">{pair.name}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function LocationSection() {
  return (
    <section className="relative" data-testid="section-location">
      <SoapDivider fillClass="text-[#7ab8d0]/15 dark:text-[#7ab8d0]/5" />
      <div className="bg-[#7ab8d0]/15 dark:bg-[#7ab8d0]/5 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} transition={{ duration: 0.5 }} className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">
              Find Us
            </motion.h2>
            <motion.div variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 text-center hover-elevate" data-testid="card-location">
                  <MapPin className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Location</h3>
                  <p className="text-sm text-muted-foreground">{businessInfo.address}</p>
                  <p className="text-sm text-muted-foreground">{businessInfo.city}, {businessInfo.state} {businessInfo.zip}</p>
                </Card>

                <Card className="p-6 text-center hover-elevate" data-testid="card-hours">
                  <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Grooming Hours</h3>
                  <p className="text-sm text-muted-foreground">Mon - Fri: 9AM - 5PM</p>
                  <p className="text-sm text-muted-foreground">Saturday: 10AM - 6PM</p>
                  <p className="text-sm text-muted-foreground">Sunday: Closed</p>
                  <p className="text-sm text-primary font-medium mt-1">Self-Service Wash: 24/7</p>
                </Card>

                <Card className="p-6 text-center hover-elevate" data-testid="card-contact">
                  <Phone className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Contact</h3>
                  <p className="text-sm text-muted-foreground">{businessInfo.phone}</p>
                  <p className="text-sm text-muted-foreground">{businessInfo.email}</p>
                </Card>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
      <SoapDivider flip fillClass="text-[#7ab8d0]/15 dark:text-[#7ab8d0]/5" />
    </section>
  );
}

function FAQSection() {
  return (
    <section className="px-6 py-20" data-testid="section-faq">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} transition={{ duration: 0.5 }} className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Common Questions
          </motion.h2>
          <motion.p variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="text-muted-foreground text-center mb-10">
            Everything you need to know before your visit
          </motion.p>

          <motion.div variants={fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.slice(0, 4).map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-5 data-[state=open]:bg-card">
                  <AccordionTrigger className="text-sm font-medium text-foreground py-4" data-testid={`button-faq-${i}`}>
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4" data-testid={`text-faq-answer-${i}`}>
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.5, delay: 0.3 }} className="text-center mt-8">
            <Link href="/about">
              <Button variant="outline" className="gap-1.5" data-testid="button-view-all-faq">
                View All FAQs <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function CTABanner() {
  return (
    <section className="px-6 pb-20" data-testid="section-cta">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <Card className="p-8 sm:p-12 text-center bg-primary text-primary-foreground border-none">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready for a Fresh Start?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
            Book your pup's next grooming session today. New clients get 10% off their first visit!
          </p>
          <Link href="/book">
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 text-base"
              data-testid="button-cta-book"
            >
              <Calendar className="w-4 h-4" />
              Book Your Appointment
            </Button>
          </Link>
        </Card>
      </motion.div>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <HeroSection />
      <AvailabilityTeaser />
      <ServicesSection />
      <TestimonialsSection />
      <BeforeAfterSection />
      <LocationSection />
      <FAQSection />
      <CTABanner />
    </main>
  );
}
