import { useState, useEffect, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  calendarProvider,
  type TimeSlot,
} from "@/lib/providers/calendarProvider";
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
  Camera,
  Download,
  ArrowRight,
  CheckCircle2,
  Upload,
  X,
  AlertCircle,
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
  { id: 3, title: "Date & Time", icon: Calendar },
  { id: 4, title: "Your Info", icon: User },
  { id: 5, title: "Pet Photo", icon: Camera },
  { id: 6, title: "Confirm", icon: CreditCard },
];

function formatTimeDisplay(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

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
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoValidating, setPhotoValidating] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoValidated, setPhotoValidated] = useState(false);
  const [tempPhotoFile, setTempPhotoFile] = useState<string | null>(null);
  const [photoDate, setPhotoDate] = useState<string | null>(null);

  // Booking config (deposit on/off)
  const [bookingConfig, setBookingConfig] = useState<{ depositEnabled: boolean; depositAmount: number } | null>(null);

  useEffect(() => {
    fetch("/api/bookings/config")
      .then((r) => r.json())
      .then(setBookingConfig)
      .catch(() => setBookingConfig({ depositEnabled: false, depositAmount: 2500 }));
  }, []);

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

  // Minimum bookable date: at least 24 hours from now.
  // If the latest slot (15:00) is already within 24h, push to the next day.
  const minBookableDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  minBookableDate.setHours(0, 0, 0, 0);

  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const loadSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true);
    try {
      const result = await calendarProvider.listAvailability(date);
      setSlots(result);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const totalPrice = servicePrice + selectedAddOns.reduce((sum, a) => sum + a.price, 0);

  const canProceed = () => {
    switch (step) {
      case 1: return !!selectedService && (!hasSizeOptions || !!selectedSize);
      case 2: return true;
      case 3: return !!selectedSlot && !!selectedDate;
      case 4: return form.formState.isValid;
      case 5: return photoValidated && !!tempPhotoFile;
      case 6: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    setSubmitting(true);

    const values = form.getValues();
    const sizeInfo = selectedSize
      ? `${selectedSize.size} (${selectedSize.weight}), ${selectedHairType === "long" ? "Long" : "Short"} Hair`
      : null;
    const bookingData = {
      serviceId: selectedService.id,
      serviceName: selectedService.name + (sizeInfo ? ` - ${sizeInfo}` : ""),
      addOns: selectedAddOns.map((a) => a.name),
      date: selectedDate.toISOString().split("T")[0],
      time: selectedSlot.startTime,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerEmail: values.customerEmail,
      petName: values.petName,
      petBreed: values.petBreed || null,
      notes: values.notes || null,
      totalPrice,
    };

    try {
      const formData = new FormData();
      Object.entries(bookingData).forEach(([key, val]) => {
        if (val !== null && val !== undefined) {
          formData.append(key, Array.isArray(val) ? JSON.stringify(val) : String(val));
        }
      });
      if (tempPhotoFile) formData.append("tempPhotoFile", tempPhotoFile);
      if (photoDate) formData.append("photoDate", photoDate);

      const res = await fetch("/api/bookings", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Booking failed");
      setBookingId(result.id);

      // If Stripe checkout URL is returned, redirect to pay deposit
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      // No deposit — show confirmation directly
      setConfirmed(true);
      toast({ title: "Booking Submitted!", description: "We'll review your booking and confirm shortly." });
    } catch (err: any) {
      toast({ title: "Booking Error", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError(null);
    setPhotoValidated(false);
    setTempPhotoFile(null);
    setPhotoDate(null);
    setPhotoValidating(true);

    const fd = new FormData();
    fd.append("photo", file);

    try {
      const res = await fetch("/api/bookings/validate-photo", { method: "POST", body: fd });
      const data = await res.json();
      if (data.valid) {
        setPhotoValidated(true);
        setTempPhotoFile(data.tempFile);
        setPhotoDate(data.photoDate || null);
      } else {
        setPhotoError(data.reason || "Photo could not be validated. Please try another.");
      }
    } catch {
      setPhotoError("Failed to validate photo. Please try again.");
    } finally {
      setPhotoValidating(false);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoError(null);
    setPhotoValidated(false);
    setTempPhotoFile(null);
    setPhotoDate(null);
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
          <h1 className="text-3xl font-bold text-foreground mb-3" data-testid="text-confirmation-title">Booking Submitted!</h1>
          <p className="text-muted-foreground mb-8">
            Your booking has been submitted for review. Our staff will call to confirm your appointment. A quote has been sent to {form.getValues().customerEmail}.
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
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground" data-testid="text-confirm-date">
                  {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium text-foreground" data-testid="text-confirm-time">
                  {selectedSlot && formatTimeDisplay(selectedSlot.startTime)}
                </span>
              </div>
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
                if (selectedService && selectedDate && selectedSlot) {
                  generateICS({
                    serviceName: selectedService.name,
                    date: selectedDate.toISOString().split("T")[0],
                    time: selectedSlot.startTime,
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
                setSelectedSlot(null);
                clearPhoto();
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
                    <h2 className="font-semibold text-lg text-foreground mb-5">Choose Date & Time</h2>

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
                          const isTooSoon = day < minBookableDate;
                          const isSunday = day.getDay() === 0;
                          return (
                            <button
                              key={day.toISOString()}
                              disabled={isTooSoon || isSunday}
                              onClick={() => { setSelectedDate(new Date(day)); setSelectedSlot(null); }}
                              className={`w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground font-semibold"
                                  : isToday
                                  ? "bg-primary/10 text-primary font-medium"
                                  : isTooSoon || isSunday
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
                      <div>
                        <h3 className="font-medium text-sm text-foreground mb-3">
                          Available Times - {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        </h3>
                        {slotsLoading ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                          </div>
                        ) : slots.filter((s) => s.available).length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">No available slots for this date.</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {slots.filter((s) => s.available).map((slot) => (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlot(slot)}
                                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  selectedSlot?.id === slot.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background border border-border hover-elevate"
                                }`}
                                data-testid={`button-book-slot-${slot.id}`}
                              >
                                {formatTimeDisplay(slot.startTime)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
                  <Card className="p-6" data-testid="step-photo">
                    <h2 className="font-semibold text-lg text-foreground mb-2">Upload a Current Photo</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Please upload a recent photo of your pet (taken within the last 7 days). This helps our groomers prepare for your appointment.
                    </p>

                    {!photoFile ? (
                      <label className="block cursor-pointer">
                        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors">
                          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                          <p className="font-medium text-foreground mb-1">Tap to upload a photo</p>
                          <p className="text-xs text-muted-foreground">JPG, PNG, or HEIC — must be taken within the last 7 days</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePhotoUpload(f);
                          }}
                        />
                      </label>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative rounded-xl overflow-hidden border border-border">
                          <img
                            src={photoPreview!}
                            alt="Pet photo preview"
                            className="w-full max-h-72 object-cover"
                          />
                          <button
                            onClick={clearPhoto}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>

                        {photoValidating && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Checking photo date...
                          </div>
                        )}

                        {photoError && (
                          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">Photo Not Accepted</p>
                              <p className="text-xs mt-0.5">{photoError}</p>
                            </div>
                          </div>
                        )}

                        {photoValidated && (
                          <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">Photo Accepted</p>
                              {photoDate && <p className="text-xs mt-0.5">Taken: {new Date(photoDate).toLocaleDateString()}</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )}

                {step === 6 && (
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
                        <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Appointment</h3>
                        <p className="font-medium text-foreground">
                          {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedSlot && formatTimeDisplay(selectedSlot.startTime)}
                        </p>
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
                        {photoPreview && (
                          <img src={photoPreview} alt="Pet" className="w-16 h-16 rounded-lg object-cover mt-2" />
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-foreground">Service Total</span>
                          <span className="font-bold text-lg text-foreground">${totalPrice}</span>
                        </div>
                        {bookingConfig?.depositEnabled ? (
                          <>
                            <div className="flex justify-between gap-2 mt-2 pt-2 border-t border-primary/20">
                              <span className="font-semibold text-foreground">Due Now (Deposit)</span>
                              <span className="font-bold text-xl text-primary">${((bookingConfig.depositAmount || 2500) / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between gap-2 mt-1">
                              <span className="text-muted-foreground text-sm">Remaining Balance</span>
                              <span className="text-muted-foreground text-sm">${Math.max(0, totalPrice - (bookingConfig.depositAmount || 2500) / 100).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              A non-refundable deposit is required to confirm your booking. The remaining balance is due at the time of service.
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-2">
                            Full balance is due at the time of service. Our staff will review your booking and reach out to confirm.
                          </p>
                        )}
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

              {step < 6 ? (
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
                  {submitting ? "Processing..." : bookingConfig?.depositEnabled ? `Pay $${((bookingConfig.depositAmount || 2500) / 100).toFixed(2)} Deposit & Confirm` : "Submit Booking"}
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

                    {selectedSlot && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Time</span>
                        <span className="text-foreground">{formatTimeDisplay(selectedSlot.startTime)}</span>
                      </div>
                    )}

                    <div className="border-t border-border/50 pt-3 space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-foreground">Service Total</span>
                        <span className="font-bold text-lg text-foreground" data-testid="text-summary-total">${totalPrice}</span>
                      </div>
                      {bookingConfig?.depositEnabled && (
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-primary font-medium">Deposit Due Now</span>
                          <span className="text-xs text-primary font-medium">${((bookingConfig.depositAmount || 2500) / 100).toFixed(2)}</span>
                        </div>
                      )}
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
