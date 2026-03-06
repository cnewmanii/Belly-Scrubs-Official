import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Book from "@/pages/Book";
import PetCalendarCreate from "@/pages/pet-calendar/Create";
import PetCalendarView from "@/pages/pet-calendar/View";
import PetCalendarSuccess from "@/pages/pet-calendar/Success";
import BookingSuccess from "@/pages/BookingSuccess";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/calendars" component={PetCalendarCreate} />
        <Route path="/book" component={Book} />
        <Route path="/book/success" component={BookingSuccess} />
        <Route path="/pet-calendar/create" component={PetCalendarCreate} />
        <Route path="/pet-calendar/success" component={PetCalendarSuccess} />
        <Route path="/pet-calendar/:id" component={PetCalendarView} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <div className="flex-1">
            <Router />
          </div>
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
