import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Loader2, Calendar, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CalendarData = {
  id: number;
  petName: string;
  petType: string;
  status: string;
  months: Array<{
    id: number;
    month: number;
    holidayName: string;
    imageUrl: string | null;
    generated: number;
  }>;
};

export default function PetCalendarSuccess() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");
  const calendarId = params.get("calendar_id");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);

  useEffect(() => {
    if (!sessionId || !calendarId) {
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/checkout/verify?session_id=${sessionId}&calendar_id=${calendarId}`);
        const data = await res.json();
        setSuccess(data.success);
        if (data.calendar) setCalendar(data.calendar);
      } catch {
        setSuccess(false);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [sessionId, calendarId]);

  if (loading) {
    return (
      <main className="pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-base font-medium text-foreground">Confirming your payment...</p>
          <p className="text-sm text-muted-foreground">Just a moment</p>
        </div>
      </main>
    );
  }

  if (!success) {
    return (
      <main className="pt-24 pb-16 flex items-center justify-center min-h-[60vh] px-6">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Calendar className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Payment not confirmed</h1>
          <p className="text-sm text-muted-foreground">
            We couldn't verify your payment. If you were charged, please contact support.
          </p>
          {calendarId && (
            <Button onClick={() => setLocation(`/pet-calendar/${calendarId}`)} className="w-full" data-testid="button-return-calendar">
              Return to Calendar
            </Button>
          )}
          <Button variant="ghost" onClick={() => setLocation("/calendars")} className="w-full" data-testid="button-go-home">
            Go to Calendars
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 flex items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-lg w-full space-y-6">
        <Card className="p-8 text-center space-y-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div className="absolute -top-1 -right-1 left-0 flex justify-center">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {calendar ? `${calendar.petName}'s calendar is ready!` : "Purchase confirmed!"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Your payment was successful. All 12 holiday images of your pet are now unlocked and ready to download.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 py-2">
            {[
              { label: "12 Images", sub: "High resolution" },
              { label: "1024x1024", sub: "Print quality" },
              { label: "Forever", sub: "Yours to keep" },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-muted rounded-md">
                <p className="font-semibold text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => setLocation(`/pet-calendar/${calendarId}`)}
            data-testid="button-view-calendar"
          >
            View Your Full Calendar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>

        <div className="text-center">
          <button
            onClick={() => setLocation("/pet-calendar/create")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-create-another"
          >
            Create a calendar for another pet {"\u2192"}
          </button>
        </div>
      </div>
    </main>
  );
}
