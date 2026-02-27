import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  Download,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { businessInfo } from "@/data/siteData";
import { useLocation } from "wouter";

interface BookingData {
  id: string;
  serviceName: string;
  addOns: string[] | null;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  petName: string;
  petBreed: string | null;
  totalPrice: number;
  status: string | null;
  depositAmount: number | null;
  depositStatus: string | null;
  squareAppointmentId: string | null;
}

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
  petName: string;
}) {
  const [year, month, day] = data.date.split("-").map(Number);
  const [hour, minute] = data.time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + 120 * 60000); // 2 hour block

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

export default function BookingSuccess() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const bookingId = params.get("booking_id");

    if (!bookingId) {
      setError("Missing booking details. Please contact us if you believe this is an error.");
      setLoading(false);
      return;
    }

    async function verifyBooking() {
      try {
        // If there's a session_id, verify the Stripe payment; otherwise just fetch booking
        const url = sessionId
          ? `/api/bookings/${bookingId}/verify?session_id=${sessionId}`
          : `/api/bookings/${bookingId}`;
        const res = await fetch(url);
        const data = await res.json();

        if (sessionId) {
          // Stripe verify endpoint
          if (data.success && data.booking) {
            setBooking(data.booking);
          } else {
            setError(data.reason || "Payment verification failed. Please contact us.");
          }
        } else {
          // Direct booking fetch
          if (data.id) {
            setBooking(data);
          } else {
            setError("Booking not found. Please contact us.");
          }
        }
      } catch {
        setError("Unable to verify your booking. Please contact us.");
      } finally {
        setLoading(false);
      }
    }

    verifyBooking();
  }, []);

  if (loading) {
    return (
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Confirming Your Booking...
          </h1>
          <p className="text-muted-foreground">
            Verifying your booking details.
          </p>
        </div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Something Went Wrong
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || "We couldn't verify your booking."}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Please contact us at{" "}
            <a href={`tel:${businessInfo.phone}`} className="text-primary font-medium">
              {businessInfo.phone}
            </a>{" "}
            and we'll get your appointment sorted out.
          </p>
          <Button onClick={() => navigate("/book")}>Try Again</Button>
        </div>
      </main>
    );
  }

  const depositPaid = booking.depositStatus === "paid" ? (booking.depositAmount || 2500) / 100 : 0;
  const remainingBalance = Math.max(0, booking.totalPrice - depositPaid);
  const isPendingReview = booking.status === "pending_review" || booking.status === "pending";
  const isConfirmed = booking.status === "confirmed";

  const formattedDate = new Date(
    booking.date + "T12:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="pt-24 pb-16 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg mx-auto text-center"
      >
        {isPendingReview ? (
          <>
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Booking Under Review
            </h1>
            <p className="text-muted-foreground mb-8">
              {depositPaid > 0
                ? `Your $${depositPaid.toFixed(2)} deposit has been received. `
                : ""}
              Our staff will review your booking and call you to confirm your appointment.
              {booking.customerEmail && ` A quote has been sent to ${booking.customerEmail}.`}
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Booking Confirmed!
            </h1>
            <p className="text-muted-foreground mb-8">
              Your appointment has been confirmed.
              {booking.customerEmail && ` A confirmation has been sent to ${booking.customerEmail}.`}
            </p>
          </>
        )}

        <Card className="p-6 text-left mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium text-foreground text-right">
                {booking.serviceName}
              </span>
            </div>
            {booking.addOns && booking.addOns.length > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Add-ons</span>
                <span className="font-medium text-foreground text-right">
                  {booking.addOns.join(", ")}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium text-foreground">
                {formattedDate}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium text-foreground">
                {formatTimeDisplay(booking.time)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Pet</span>
              <span className="font-medium text-foreground">
                {booking.petName}
                {booking.petBreed ? ` (${booking.petBreed})` : ""}
              </span>
            </div>

            <div className="border-t border-border/50 pt-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-foreground">Service Total</span>
                <span className="text-foreground">${booking.totalPrice}</span>
              </div>
              {depositPaid > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Deposit Paid
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    -${depositPaid.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2 pt-1 border-t border-border/50">
                <span className="font-semibold text-foreground">
                  Balance Due at Service
                </span>
                <span className="font-bold text-lg text-foreground">
                  ${remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>

            {isPendingReview && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
                Your appointment will be finalized once our staff completes their review. We'll reach out by phone shortly.
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              generateICS({
                serviceName: booking.serviceName,
                date: booking.date,
                time: booking.time,
                petName: booking.petName,
              })
            }
          >
            <Download className="w-4 h-4" />
            Add to Calendar
          </Button>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </motion.div>
    </main>
  );
}
