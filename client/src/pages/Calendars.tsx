import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SoapDivider } from "@/components/layout/SoapDivider";
import { services } from "@/data/siteData";
import {
  calendarProvider,
  type TimeSlot,
} from "@/lib/providers/calendarProvider";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Zap,
  ArrowRight,
  Sparkles,
  Dog,
  Cat,
  ImageIcon,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDayShort(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatTimeDisplay(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Calendars() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [mockMode, setMockMode] = useState(true);
  const [selectedService, setSelectedService] = useState(services[0]);

  const loadSlots = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const result = await calendarProvider.listAvailability(date);
      setSlots(result);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const calendarDays: (Date | null)[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
  }

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const availableSlots = slots.filter((s) => s.available);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <main className="pt-24 pb-16">
      <section className="px-6 mb-10" data-testid="section-calendars-header">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <Badge variant="secondary" className="mb-3 text-xs">Calendar</Badge>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                Check <span className="text-primary">Availability</span>
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Browse available time slots and find the perfect appointment.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${mockMode ? "text-amber-500" : "text-primary"}`} />
                <Label htmlFor="mode-toggle" className="text-sm font-medium cursor-pointer">
                  {mockMode ? "Mock Mode" : "Live Mode"}
                </Label>
              </div>
              <Switch
                id="mode-toggle"
                checked={!mockMode}
                onCheckedChange={(v) => setMockMode(!v)}
                data-testid="switch-mode-toggle"
              />
            </div>
          </div>
        </motion.div>
      </section>

      <section className="px-6" data-testid="section-calendar-view">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-1"
            >
              <Card className="p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month" aria-label="Previous month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="font-semibold text-sm text-foreground" data-testid="text-current-month">{formatMonth(currentMonth)}</h3>
                  <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month" aria-label="Next month">
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
                    if (!day) return <div key={`empty-${i}`} />;
                    const isToday = isSameDay(day, today);
                    const isSelected = isSameDay(day, selectedDate);
                    const isPast = day < today;
                    const isSunday = day.getDay() === 0;

                    return (
                      <button
                        key={day.toISOString()}
                        disabled={isPast || isSunday}
                        onClick={() => setSelectedDate(new Date(day))}
                        className={`w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : isToday
                            ? "bg-primary/10 text-primary font-medium"
                            : isPast || isSunday
                            ? "text-muted-foreground/40 cursor-not-allowed"
                            : "text-foreground hover-elevate cursor-pointer"
                        }`}
                        data-testid={`button-day-${day.getDate()}`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 pt-4 border-t border-border/50">
                  <Label className="text-xs text-muted-foreground mb-2 block">Service Duration</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedService(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedService.id === s.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover-elevate"
                        }`}
                        data-testid={`button-service-filter-${s.id}`}
                      >
                        {s.name} ({s.duration}m)
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <Card className="p-5 min-h-[400px]">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid="text-selected-date">
                      {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timezone} - {availableSlots.length} slots available
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {selectedService.duration} min sessions
                  </Badge>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 rounded-lg" />
                    ))}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Calendar className="w-10 h-10 text-muted-foreground/40 mb-4" />
                    <p className="text-muted-foreground font-medium">No available slots</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      {selectedDate.getDay() === 0 ? "We're closed on Sundays" : "Try selecting a different date"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <Link key={slot.id} href="/book">
                        <div
                          className="px-3 py-3 rounded-lg border border-border bg-background text-center cursor-pointer hover-elevate transition-all"
                          data-testid={`button-slot-${slot.id}`}
                        >
                          <span className="text-sm font-medium text-foreground">
                            {formatTimeDisplay(slot.startTime)}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {!loading && availableSlots.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border/50 flex justify-end">
                    <Link href="/book">
                      <Button className="gap-1.5" data-testid="button-book-from-calendar">
                        Book This Slot <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="px-6 mt-12" data-testid="section-pet-calendar-promo">
        <div className="max-w-6xl mx-auto">
          <SoapDivider fillClass="text-[#BAD9E5]/15 dark:text-[#BAD9E5]/5" />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-hidden border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-6 sm:p-8 flex flex-col justify-center">
                  <Badge variant="secondary" className="w-fit mb-3 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI-Powered
                  </Badge>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Pet Holiday Calendar
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                    Upload a photo of your pet and our AI creates 12 unique holiday-themed images — one for
                    each month. Perfect as a gift or keepsake for any pet lover!
                  </p>
                  <div className="flex flex-wrap gap-3 mb-6">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Dog className="w-4 h-4 text-primary" /> Dogs
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Cat className="w-4 h-4 text-primary" /> Cats
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ImageIcon className="w-4 h-4 text-primary" /> 12 HD Images
                    </div>
                  </div>
                  <Link href="/pet-calendar/create">
                    <Button className="gap-1.5" data-testid="button-create-pet-calendar">
                      <Sparkles className="w-4 h-4" />
                      Create Your Calendar — $29.99
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="bg-gradient-to-br from-primary/10 via-[#BAD9E5]/20 to-primary/5 p-6 sm:p-8 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-3 max-w-xs">
                    {[
                      { icon: "\u{1F386}", month: "Jan", holiday: "New Year's" },
                      { icon: "\u{1F49D}", month: "Feb", holiday: "Valentine's" },
                      { icon: "\u{1F340}", month: "Mar", holiday: "St. Patrick's" },
                      { icon: "\u{1F423}", month: "Apr", holiday: "Easter" },
                      { icon: "\u{2600}\u{FE0F}", month: "Jun", holiday: "Summer" },
                      { icon: "\u{1F383}", month: "Oct", holiday: "Halloween" },
                      { icon: "\u{1F983}", month: "Nov", holiday: "Thanksgiving" },
                      { icon: "\u{1F384}", month: "Dec", holiday: "Christmas" },
                      { icon: "\u{1F43E}", month: "Aug", holiday: "Pet Day" },
                    ].map((m) => (
                      <div key={m.month} className="bg-card/80 backdrop-blur-sm rounded-lg p-2.5 text-center border border-border/50">
                        <span className="text-xl block mb-0.5">{m.icon}</span>
                        <p className="text-[10px] font-medium text-foreground">{m.month}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
