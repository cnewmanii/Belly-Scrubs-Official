import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ShoppingCart,
  Sparkles,
  CheckCircle,
  Loader2,
  Lock,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PREVIEW_MONTHS = 3; // First N months shown unlocked as preview

type CalendarMonth = {
  id: number;
  month: number;
  year: number;
  holidayName: string;
  imageUrl: string | null;
  generated: number;
};

type CalendarData = {
  id: number;
  petName: string;
  petType: string;
  status: "pending" | "generating" | "ready" | "purchased";
  generatedCount: number;
  totalMonths: number;
  months: CalendarMonth[];
};

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  const totalCells = 42;
  while (days.length < totalCells) {
    days.push(null);
  }
  return days;
}

function CalendarGrid({ month, year }: { month: number; year: number }) {
  const days = getMonthDays(year, month);

  return (
    <div className="grid grid-cols-7 gap-px">
      {DAY_HEADERS.map((d) => (
        <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
          {d}
        </div>
      ))}
      {days.map((day, i) => (
        <div
          key={i}
          className={`text-center text-[11px] py-0.5 ${
            day ? "text-foreground" : ""
          }`}
        >
          {day || ""}
        </div>
      ))}
    </div>
  );
}

function MonthCalendarCard({ month, petName, isUnlocked }: {
  month: CalendarMonth;
  petName: string;
  isUnlocked: boolean;
}) {
  const monthName = MONTH_NAMES[month.month - 1];

  return (
    <div
      data-testid={`card-month-${month.month}`}
      className="rounded-xl overflow-hidden border border-border bg-card shadow-sm"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {month.generated === 1 && month.imageUrl ? (
          <>
            <img
              src={month.imageUrl}
              alt={`${petName} in ${monthName}`}
              className={`w-full h-full object-cover ${!isUnlocked ? "filter blur-sm scale-105" : ""}`}
            />
            {!isUnlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="bg-black/50 rounded-md px-3 py-2 flex items-center gap-2 text-white text-sm">
                  <Lock className="w-4 h-4" />
                  <span className="font-medium">Purchase to unlock</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground">{monthName} {month.year}</h3>
          <span className="text-[10px] text-muted-foreground">{month.holidayName}</span>
        </div>
        <CalendarGrid month={month.month} year={month.year} />
      </div>
    </div>
  );
}

export default function PetCalendarView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  const { data: calendar, isLoading } = useQuery<CalendarData | null>({
    queryKey: ["/api/pet-calendars", id],
    queryFn: async () => {
      const r = await fetch(`/api/pet-calendars/${id}`);
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (data.status === "generating" || data.status === "pending") return 3000;
      return false;
    },
  });

  const handleCheckout = async () => {
    if (!email.trim()) {
      toast({ title: "Please enter your email for the receipt", variant: "destructive" });
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch(`/api/pet-calendars/${id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL");
      }
    } catch {
      toast({ title: "Failed to start checkout. Please try again.", variant: "destructive" });
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!calendar) {
    return (
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Calendar Not Found</h1>
          <p className="text-muted-foreground mb-6">This calendar doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation("/calendars")} data-testid="button-go-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calendars
          </Button>
        </div>
      </main>
    );
  }

  const isGenerating = calendar.status === "generating" || calendar.status === "pending";
  const isReady = calendar.status === "ready";
  const isPurchased = calendar.status === "purchased";
  const sortedMonths = calendar.months.length > 0
    ? [...calendar.months].sort((a, b) => a.year - b.year || a.month - b.month)
    : [];
  const progress = calendar.totalMonths > 0
    ? Math.round((calendar.generatedCount / calendar.totalMonths) * 100)
    : 0;

  // Build calendar title from the date range
  const firstMonth = sortedMonths[0];
  const lastMonth = sortedMonths[sortedMonths.length - 1];
  const titleRange = firstMonth && lastMonth
    ? `${MONTH_NAMES[firstMonth.month - 1]} ${firstMonth.year} — ${MONTH_NAMES[lastMonth.month - 1]} ${lastMonth.year}`
    : "Holiday Calendar";

  const monthsPerPage = 6;
  const totalPages = Math.ceil(sortedMonths.length / monthsPerPage);
  const visibleMonths = sortedMonths.slice(
    currentPage * monthsPerPage,
    (currentPage + 1) * monthsPerPage
  );

  // Page label from actual month data
  const pageFirst = visibleMonths[0];
  const pageLast = visibleMonths[visibleMonths.length - 1];
  const pageLabel = pageFirst && pageLast
    ? `${MONTH_NAMES[pageFirst.month - 1]} — ${MONTH_NAMES[pageLast.month - 1]}`
    : "";

  return (
    <main className="pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/calendars")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-calendar-title">
              {calendar.petName}'s {titleRange}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isPurchased
                ? "All images unlocked — right-click to save"
                : isReady
                ? `Preview the first ${PREVIEW_MONTHS} months free — purchase to unlock all 12`
                : `Generating images... ${calendar.generatedCount} of ${calendar.totalMonths}`}
            </p>
          </div>
          {isPurchased && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
              Purchased
            </Badge>
          )}
        </div>

        {isGenerating && (
          <div className="mb-4 mt-2">
            <Progress value={progress} className="h-2" data-testid="progress-view-generation" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {visibleMonths.map((month, idx) => {
            // Global index of this month in the full sorted list
            const globalIdx = currentPage * monthsPerPage + idx;
            // First N months are always unlocked as preview; all unlocked if purchased
            const isUnlocked = isPurchased || globalIdx < PREVIEW_MONTHS;
            return (
              <MonthCalendarCard
                key={month.id}
                month={month}
                petName={calendar.petName}
                isUnlocked={isUnlocked}
              />
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {pageLabel}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {isReady && (
          <div className="max-w-md mx-auto mt-10">
            <Card className="p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">Love your calendar?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Purchase to unlock all 12 high-resolution images.
                </p>
              </div>
              <div>
                <Label htmlFor="checkout-email" className="text-sm">Email for receipt</Label>
                <Input
                  id="checkout-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  data-testid="input-checkout-email"
                />
              </div>
              <Button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                size="lg"
                className="w-full"
                data-testid="button-purchase-calendar"
              >
                {checkoutLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><ShoppingCart className="w-4 h-4 mr-2" /> Purchase Calendar — $29.99</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Secure checkout powered by Stripe. Instant download after payment.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> 12 high-res images</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Print-ready files</span>
              </div>
            </Card>
          </div>
        )}

        {isPurchased && (
          <div className="max-w-md mx-auto mt-10">
            <Card className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Download className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">All images unlocked!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Right-click any image above to save it. Each image is 1024x1024px, ready for printing.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/pet-calendar/create")} data-testid="button-create-another">
                <Sparkles className="w-4 h-4 mr-2" />
                Create Another Calendar
              </Button>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
