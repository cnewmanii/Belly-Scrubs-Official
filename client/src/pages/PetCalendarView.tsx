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
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type CalendarData = {
  id: number;
  petName: string;
  petType: string;
  status: "pending" | "generating" | "ready" | "purchased";
  generatedCount: number;
  totalMonths: number;
  months: Array<{
    id: number;
    month: number;
    holidayName: string;
    imageUrl: string | null;
    generated: number;
  }>;
};

function MonthCard({ month, petName, isUnlocked }: {
  month: CalendarData["months"][0];
  petName: string;
  isUnlocked: boolean;
}) {
  const monthName = MONTH_NAMES[month.month - 1];

  return (
    <div
      data-testid={`card-month-${month.month}`}
      className="group rounded-xl overflow-hidden border border-border bg-card"
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        {month.generated === 1 && month.imageUrl ? (
          <>
            <img
              src={month.imageUrl}
              alt={`${petName} in ${monthName}`}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!isUnlocked ? "filter blur-sm scale-105" : ""}`}
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
            <div className="w-10 h-10 rounded-full bg-muted-foreground/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
            <p className="text-xs text-center text-muted-foreground">Generating...</p>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-foreground">{monthName}</p>
            <p className="text-xs text-muted-foreground">{month.holidayName}</p>
          </div>
          {month.generated === 1 && (
            <Badge variant="secondary" className="text-[10px]">
              <CheckCircle className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          )}
        </div>
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

  const { data: calendar, isLoading } = useQuery<CalendarData>({
    queryKey: ["/api/pet-calendars", id],
    queryFn: () => fetch(`/api/pet-calendars/${id}`).then((r) => r.json()),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
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
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
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
  const progress = Math.round((calendar.generatedCount / calendar.totalMonths) * 100);

  return (
    <main className="pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/calendars")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-calendar-title">
              {calendar.petName}'s Holiday Calendar
            </h1>
            <p className="text-sm text-muted-foreground">
              {isPurchased ? "All images unlocked" : isReady ? "Ready to purchase" : `Generating images...`}
            </p>
          </div>
        </div>

        {isGenerating && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating {calendar.generatedCount} of {calendar.totalMonths} images
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {calendar.months.length > 0
            ? calendar.months.map((month) => (
                <MonthCard
                  key={month.id}
                  month={month}
                  petName={calendar.petName}
                  isUnlocked={isPurchased}
                />
              ))
            : Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border bg-card">
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                  <div className="p-3">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
          }
        </div>

        {isReady && (
          <div className="max-w-md mx-auto mt-8">
            <Card className="p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">All images ready!</h3>
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

        {isGenerating && (
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Hang tight! We're using AI to create each unique image. The page updates automatically.
            </p>
          </div>
        )}

        {isPurchased && (
          <div className="max-w-md mx-auto mt-8">
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
