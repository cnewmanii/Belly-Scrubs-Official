import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { services, addOns, businessInfo } from "@/data/siteData";
import {
  Scissors,
  Droplets,
  Wind,
  Sparkles,
  Waves,
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Dog,
  FileText,
  CreditCard,
  Download,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Service, AddOn, SizeOption } from "@/data/siteData";

const iconMap: Record<string, any> = { Scissors, Droplets, Wind, Sparkles, Waves };

const customerSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerPhone: z.string().min(10, "Please enter a valid phone number"),
  customerEmail: z.string().email("Please enter a valid email"),
  petName: z.string().min(1, "Pet name is required"),
  petBreed: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

const STEPS = [
  { id: 1, title: "Service", icon: Scissors },
  { id: 2, title: "Add-ons", icon: Sparkles },
  { id: 3, title: "Date", icon: Calendar },
  { id: 4, title: "Your Info", icon: User },
  { id: 5, title: "Confirm", icon: CreditCard },
];


function generateICS(data: {
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  petName: string;
}) {
  const [year, month, day] = data.date.split("-").map(Number);
  const [hour, minute] = data.time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + data.duration * 60000);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatDT = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Belly scRubs//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTART:${formatDT(start)}`,
    `DTEND:${formatDT(end)}`,
    `SUMMARY:${data.serviceName} at Belly scRubs`,
    `DESCRIPTION:Pet: ${data.petName}`,
    `LOCATION:${businessInfo.address}, ${businessInfo.city}, ${businessInfo.state}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "belly-scrubs-booking.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Book() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizeOption | null>(null);
  const [selectedHairType, setSelectedHairType] = useState<"short" | "long">("short");
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const hasSizeOptions = selectedService && "sizeOptions" in selectedService && selectedService.sizeOptions;

  const servicePrice = (() => {
    if (hasSizeOptions && selectedSize) {
      return selectedHairType === "long" ? selectedSize.longHairPrice : selectedSize.shortHairPrice;
    }
    return selectedService?.price ?? 0;
  })();

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    mode: "onChange",
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      petName: "",
      petBreed: "",
      notes: "",
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));


  const totalPrice = servicePrice + selectedAddOns.reduce((sum, a) => sum + a.price, 0);

  const canProceed = () => {
    switch (step) {
      case 1: return !!selectedService && (!hasSizeOptions || !!selectedSize);
      case 2: return true;
      case 3: return true;
      case 4: return form.formState.isValid;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!selectedService) return;
    setSubmitting(true);

    const values = form.getValues();
    const sizeInfo = selectedSize
      ? `${selectedSize.size} (${selectedSize.weight}), ${selectedHairType === "long" ? "Long" : "Short"} Hair`
      : null;
    const bookingData = {
      serviceId: selectedService.id,
      serviceName: selectedService.name + (sizeInfo ? ` - ${sizeInfo}` : ""),
      addOns: selectedAddOns.map((a) => a.name),
      date: selectedDate ? selectedDate.toISOString().split("T")[0] : null,
      time: null,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerEmail: values.customerEmail,
      petName: values.petName,
      petBreed: values.petBreed || null,
      notes: values.notes || null,
      totalPrice,
    };

    try {
      const res = await apiRequest("POST", "/api/bookings", bookingData);
      const result = await res.json();
      setBookingId(result.id);
      setConfirmed(true);
      toast({ title: "Booking Confirmed!", description: `Your appointment has been booked.` });
    } catch {
      toast({ title: "Booking Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAddOn = (addon: AddOn) => {
    setSelectedAddOns((prev) =>
      prev.find((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d));

  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (confirmed) {
    return (
      <main className="pt-24 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg mx-auto text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3" data-testid="text-confirmation-title">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-8">
            We've reserved your spot. A confirmation email will be sent to {form.getValues().customerEmail}.
          </p>

          <Card className="p-6 text-left mb-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium text-foreground" data-testid="text-confirm-service">{selectedService?.name}</span>
              </div>
              {selectedAddOns.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Add-ons</span>
                  <span className="font-medium text-foreground text-right">{selectedAddOns.map((a) => a.name).join(", ")}</span>
                </div>
              )}
              {selectedDate && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Preferred Date</span>
                  <span className="font-medium text-foreground" data-testid="text-confirm-date">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Pet</span>
                <span className="font-medium text-foreground" data-testid="text-confirm-pet">{form.getValues().petName}</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between gap-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-foreground text-lg" data-testid="text-confirm-total">${totalPrice}</span>
              </div>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (selectedService) {
                  generateICS({
                    serviceName: selectedService.name,
                    date: selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                    time: "09:00",
                    duration: selectedService.duration,
                    petName: form.getValues().petName,
                  });
                }
              }}
              data-testid="button-add-calendar"
            >
              <Download className="w-4 h-4" />
              Add to Calendar
            </Button>
            <Button
              onClick={() => {
                setConfirmed(false);
                setStep(1);
                setSelectedService(null);
                setSelectedAddOns([]);
                setSelectedDate(null);
                form.reset();
              }}
              data-testid="button-new-booking"
            >
              Book Another Appointment
            </Button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 px-6" data-testid="page-book">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Badge variant="secondary" className="mb-3 text-xs">Book Now</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Book Your <span className="text-primary">Appointment</span>
          </h1>
        </motion.div>

        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => {
                  if (s.id < step) setStep(s.id);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  s.id === step
                    ? "bg-primary text-primary-foreground"
                    : s.id < step
                    ? "bg-primary/10 text-primary cursor-pointer"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`button-step-${s.id}`}
              >
                {s.id < step ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <s.icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{s.id}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px ${s.id < step ? "bg-primary/30" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step === 1 && (
                  <Card className="p-6" data-testid="step-service">
                    <h2 className="font-semibold text-lg text-foreground mb-5">Choose Your Service</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {services.map((service) => {
                        const Icon = iconMap[service.icon] || Sparkles;
                        const isSelected = selectedService?.id === service.id;
                        const priceLabel = "priceRange" in service && service.priceRange
                          ? service.priceRange
                          : "sizeOptions" in service && service.sizeOptions
                            ? `From $${service.price}`
                            : `$${service.price}`;
                        return (
                          <button
                            key={service.id}
                            onClick={() => {
                              setSelectedService(service);
                              setSelectedSize(null);
                              setSelectedHairType("short");
                            }}
                            className={`text-left p-5 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background hover-elevate"
                            }`}
                            data-testid={`button-select-service-${service.id}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-primary" />
                              </div>
                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                            <h3 className="font-semibold text-foreground mb-1">{service.name}</h3>
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{service.description}</p>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{priceLabel}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {service.duration} min
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {hasSizeOptions && (
                      <div className="mt-6 space-y-4">
                        <h3 className="font-semibold text-foreground">Select Pet Size & Hair Type</h3>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(selectedService as any).sizeOptions.map((opt: SizeOption) => {
                            const isActive = selectedSize?.size === opt.size;
                            return (
                              <button
                                key={opt.size}
                                onClick={() => setSelectedSize(opt)}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${
                                  isActive ? "border-primary bg-primary/5" : "border-border bg-background hover-elevate"
                                }`}
                                data-testid={`button-size-${opt.size.toLowerCase()}`}
                              >
                                <span className="font-semibold text-sm text-foreground block">{opt.size}</span>
                                <span className="text-xs text-muted-foreground">{opt.weight}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSelectedHairType("short")}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              selectedHairType === "short" ? "border-primary bg-primary/5" : "border-border bg-background hover-elevate"
                            }`}
                            data-testid="button-hair-short"
                          >
                            <span className="font-semibold text-sm text-foreground">Short Hair</span>
                            {selectedSize && (
                              <span className="block text-xs text-muted-foreground mt-0.5">${selectedSize.shortHairPrice}</span>
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedHairType("long")}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              selectedHairType === "long" ? "border-primary bg-primary/5" : "border-border bg-background hover-elevate"
                            }`}
                            data-testid="button-hair-long"
                          >
                            <span className="font-semibold text-sm text-foreground">Long Hair</span>
                            {selectedSize && (
                              <span className="block text-xs text-muted-foreground mt-0.5">${selectedSize.longHairPrice}</span>
                            )}
                          </button>
                        </div>

                        {!selectedSize && (
                          <p className="text-sm text-amber-600 dark:text-amber-400">Please select your pet's size to continue</p>
                        )}
                      </div>
                    )}
                  </Card>
                )}

                {step === 2 && (
                  <Card className="p-6" data-testid="step-addons">
                    <h2 className="font-semibold text-lg text-foreground mb-2">Add-on Services</h2>
                    <p className="text-sm text-muted-foreground mb-5">Optional extras to pamper your pup</p>
                    <div className="space-y-2">
                      {addOns.map((addon) => {
                        const isSelected = selectedAddOns.some((a) => a.id === addon.id);
                        return (
                          <button
                            key={addon.id}
                            onClick={() => toggleAddOn(addon)}
                            className={`w-full flex items-center justify-between gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background hover-elevate"
                            }`}
                            data-testid={`button-addon-${addon.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isSelected ? "bg-primary border-primary" : "border-border"
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <div>
                                <span className="font-medium text-foreground text-sm">{addon.name}</span>
                                <span className="block text-xs text-muted-foreground">{addon.description}</span>
                              </div>
                            </div>
                            <span className="font-semibold text-foreground text-sm flex-shrink-0">+${addon.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {step === 3 && (
                  <Card className="p-6" data-testid="step-datetime">
                    <h2 className="font-semibold text-lg text-foreground mb-5">Choose a Preferred Date</h2>

                    <div className="mb-6">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <Button variant="ghost" size="icon" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} aria-label="Previous month">
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="font-medium text-sm text-foreground">
                          {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} aria-label="Next month">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                          <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, i) => {
                          if (!day) return <div key={`e-${i}`} />;
                          const isToday = isSameDay(day, today);
                          const isSelected = selectedDate && isSameDay(day, selectedDate);
                          const isPast = day < today;
                          const isSunday = day.getDay() === 0;
                          return (
                            <button
                              key={day.toISOString()}
                              disabled={isPast || isSunday}
                              onClick={() => { setSelectedDate(new Date(day)); }}
                              className={`w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground font-semibold"
                                  : isToday
                                  ? "bg-primary/10 text-primary font-medium"
                                  : isPast || isSunday
                                  ? "text-muted-foreground/40 cursor-not-allowed"
                                  : "text-foreground hover-elevate cursor-pointer"
                              }`}
                              data-testid={`button-book-day-${day.getDate()}`}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedDate && (
                      <p className="text-sm text-muted-foreground mt-4">
                        We'll confirm your appointment time for{" "}
                        <span className="font-medium text-foreground">
                          {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </span>{" "}
                        when we reach out to you.
                      </p>
                    )}
                  </Card>
                )}

                {step === 4 && (
                  <Card className="p-6" data-testid="step-info">
                    <h2 className="font-semibold text-lg text-foreground mb-5">Your Information</h2>
                    <Form {...form}>
                      <form className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1.5 text-sm">
                                  <User className="w-3.5 h-3.5" /> Your Name
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="John Smith" {...field} data-testid="input-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="customerPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1.5 text-sm">
                                  <Phone className="w-3.5 h-3.5" /> Phone
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="customerEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5 text-sm">
                                <Mail className="w-3.5 h-3.5" /> Email
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="you@example.com" type="email" {...field} data-testid="input-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="petName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1.5 text-sm">
                                  <Dog className="w-3.5 h-3.5" /> Pet Name
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="Buddy" {...field} data-testid="input-pet-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="petBreed"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Breed (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Golden Retriever" {...field} data-testid="input-breed" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5 text-sm">
                                <FileText className="w-3.5 h-3.5" /> Notes (optional)
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Any special instructions or things we should know about your pet..."
                                  className="resize-none"
                                  rows={3}
                                  {...field}
                                  data-testid="input-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </form>
                    </Form>
                  </Card>
                )}

                {step === 5 && (
                  <Card className="p-6" data-testid="step-confirm">
                    <h2 className="font-semibold text-lg text-foreground mb-5">Review & Confirm</h2>

                    <div className="space-y-4 text-sm">
                      <div className="p-4 rounded-xl bg-muted/50">
                        <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Service</h3>
                        <p className="font-semibold text-foreground">{selectedService?.name}</p>
                        {selectedSize && (
                          <p className="text-muted-foreground">{selectedSize.size} Dog, {selectedHairType === "long" ? "Long" : "Short"} Hair</p>
                        )}
                        <p className="text-muted-foreground">{selectedService?.duration} minutes - ${servicePrice}</p>
                      </div>

                      {selectedAddOns.length > 0 && (
                        <div className="p-4 rounded-xl bg-muted/50">
                          <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Add-ons</h3>
                          {selectedAddOns.map((a) => (
                            <div key={a.id} className="flex justify-between gap-2">
                              <span className="text-foreground">{a.name}</span>
                              <span className="text-muted-foreground">+${a.price}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-muted/50">
                        <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Preferred Date</h3>
                        {selectedDate ? (
                          <>
                            <p className="font-medium text-foreground">
                              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Time to be confirmed</p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">No preference — we'll reach out to schedule</p>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-muted/50">
                        <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Contact</h3>
                        <p className="font-medium text-foreground">{form.getValues().customerName}</p>
                        <p className="text-muted-foreground">{form.getValues().customerEmail}</p>
                        <p className="text-muted-foreground">{form.getValues().customerPhone}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-muted/50">
                        <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Pet</h3>
                        <p className="font-medium text-foreground">{form.getValues().petName}</p>
                        {form.getValues().petBreed && (
                          <p className="text-muted-foreground">{form.getValues().petBreed}</p>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-foreground">Total</span>
                          <span className="font-bold text-xl text-foreground">${totalPrice}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Payment will be collected at the time of service.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-3 mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="gap-1.5"
                data-testid="button-back"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>

              {step < 5 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="gap-1.5"
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-1.5"
                  data-testid="button-confirm-booking"
                >
                  {submitting ? "Booking..." : "Confirm Booking"}
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-28">
              <Card className="p-5" data-testid="booking-summary">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Booking Summary
                </h3>

                {selectedService ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-foreground text-right" data-testid="text-summary-service">
                        {selectedService.name}
                        {selectedSize && ` (${selectedSize.size}, ${selectedHairType === "long" ? "Long" : "Short"} Hair)`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="text-foreground">{selectedService.duration} min</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Price</span>
                      <span className="text-foreground">${servicePrice}</span>
                    </div>

                    {selectedAddOns.length > 0 && (
                      <>
                        <div className="border-t border-border/50 pt-2">
                          <span className="text-xs text-muted-foreground font-medium">Add-ons</span>
                        </div>
                        {selectedAddOns.map((a) => (
                          <div key={a.id} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{a.name}</span>
                            <span className="text-foreground">+${a.price}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {selectedDate && (
                      <div className="border-t border-border/50 pt-2 flex justify-between gap-2">
                        <span className="text-muted-foreground">Date</span>
                        <span className="text-foreground text-right">
                          {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}


                    <div className="border-t border-border/50 pt-3 flex justify-between gap-2">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="font-bold text-lg text-foreground" data-testid="text-summary-total">${totalPrice}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a service to get started</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
