import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Upload, Dog, Cat, Sparkles, ChevronRight, Loader2, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  { month: "Jan", holiday: "New Year's", icon: "\u{1F386}" },
  { month: "Feb", holiday: "Valentine's", icon: "\u{1F49D}" },
  { month: "Mar", holiday: "St. Patrick's", icon: "\u{1F340}" },
  { month: "Apr", holiday: "Easter", icon: "\u{1F423}" },
  { month: "May", holiday: "Mother's Day", icon: "\u{1F338}" },
  { month: "Jun", holiday: "Summer", icon: "\u{2600}\u{FE0F}" },
  { month: "Jul", holiday: "4th of July", icon: "\u{1F387}" },
  { month: "Aug", holiday: "Pet Day", icon: "\u{1F43E}" },
  { month: "Sep", holiday: "Back to School", icon: "\u{1F4DA}" },
  { month: "Oct", holiday: "Halloween", icon: "\u{1F383}" },
  { month: "Nov", holiday: "Thanksgiving", icon: "\u{1F983}" },
  { month: "Dec", holiday: "Christmas", icon: "\u{1F384}" },
];

const GENERATING_MESSAGES = [
  "Warming up the AI brushes...",
  "Studying your pet's adorable features...",
  "Painting holiday scenes...",
  "Adding festive details...",
  "Perfecting each month's theme...",
  "Almost there, making it purrfect...",
];

export default function PetCalendarCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState<"dog" | "cat" | null>(null);
  const [petGender, setPetGender] = useState<"male" | "female" | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [genError, setGenError] = useState(false);
  const pollFailCount = useRef(0);

  useEffect(() => {
    if (!generating || !calendarId) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/pet-calendars/${calendarId}`);
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();
        pollFailCount.current = 0;
        setGeneratedCount(data.generatedCount || 0);

        if (data.status === "ready" || data.status === "purchased") {
          clearInterval(poll);
          setLocation(`/pet-calendar/${calendarId}`);
        }
      } catch {
        pollFailCount.current += 1;
        if (pollFailCount.current >= 5) {
          clearInterval(poll);
          setGenError(true);
        }
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [generating, calendarId, setLocation]);

  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % GENERATING_MESSAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [generating]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!petName.trim()) {
      toast({ title: "Please enter your pet's name", variant: "destructive" });
      return;
    }
    if (!petType) {
      toast({ title: "Please select dog or cat", variant: "destructive" });
      return;
    }
    if (!petGender) {
      toast({ title: "Please select male or female", variant: "destructive" });
      return;
    }
    if (!photo) {
      toast({ title: "Please upload a photo of your pet", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("petName", petName);
      formData.append("petType", petType);
      formData.append("petGender", petGender);
      formData.append("photo", photo);

      const res = await fetch("/api/pet-calendars", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to create calendar");
      const data = await res.json();
      setCalendarId(data.id);
      setGenerating(true);
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  if (generating) {
    const progress = Math.round((generatedCount / 12) * 100);
    return (
      <main className="pt-24 pb-16">
        <section className="px-6">
          <div className="max-w-lg mx-auto text-center">
            <div className="mb-8">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 relative">
                <PawPrint className="w-12 h-12 text-primary animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-generating-title">
                Creating {petName}'s Calendar
              </h1>
              <p className="text-muted-foreground text-sm mb-6" data-testid="text-generating-message">
                {GENERATING_MESSAGES[messageIndex]}
              </p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {generatedCount} of 12 images generated
                </span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" data-testid="progress-generation" />

              <div className="grid grid-cols-6 gap-2 pt-2">
                {MONTHS.map((m, i) => (
                  <div
                    key={m.month}
                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                      i < generatedCount
                        ? "bg-primary/10 text-primary"
                        : i === generatedCount
                        ? "bg-muted animate-pulse"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                    data-testid={`status-month-${i + 1}`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="text-[10px] font-medium mt-1">{m.month}</span>
                  </div>
                ))}
              </div>
            </Card>

            {genError ? (
              <Card className="p-5 mt-6 space-y-3 border-destructive/30">
                <p className="text-sm text-destructive font-medium">
                  We lost connection while generating your calendar.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setGenError(false);
                    pollFailCount.current = 0;
                    setGenerating(false);
                    setTimeout(() => setGenerating(true), 100);
                  }}
                  data-testid="button-retry-generation"
                >
                  Retry
                </Button>
                {calendarId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setLocation(`/pet-calendar/${calendarId}`)}
                    data-testid="button-view-partial"
                  >
                    View calendar anyway
                  </Button>
                )}
              </Card>
            ) : (
              <p className="text-xs text-muted-foreground mt-6">
                This usually takes 2-4 minutes. Please don't close this page.
              </p>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16">
      <section className="px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-3 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Create Your Pet's <span className="text-primary">Holiday Calendar</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Upload a photo and our AI will generate 12 unique holiday-themed images
              of your pet — one for each month of the year.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-6 space-y-5">
              <div>
                <Label htmlFor="pet-name" className="text-sm font-medium">Pet's Name</Label>
                <Input
                  id="pet-name"
                  placeholder="e.g. Buddy, Luna, Max..."
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  className="mt-1.5"
                  data-testid="input-pet-name"
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Pet Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPetType("dog")}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      petType === "dog"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                    data-testid="button-pet-type-dog"
                  >
                    <Dog className="w-6 h-6" />
                    <span className="font-medium">Dog</span>
                  </button>
                  <button
                    onClick={() => setPetType("cat")}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      petType === "cat"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                    data-testid="button-pet-type-cat"
                  >
                    <Cat className="w-6 h-6" />
                    <span className="font-medium">Cat</span>
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Gender</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPetGender("male")}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      petGender === "male"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                    data-testid="button-pet-gender-male"
                  >
                    <span className="text-lg">&#9794;</span>
                    <span className="font-medium">Male</span>
                  </button>
                  <button
                    onClick={() => setPetGender("female")}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      petGender === "female"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                    data-testid="button-pet-gender-female"
                  >
                    <span className="text-lg">&#9792;</span>
                    <span className="font-medium">Female</span>
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Upload Photo</Label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : photoPreview
                      ? "border-primary/40"
                      : "border-border hover:border-primary/40"
                  }`}
                  data-testid="dropzone-photo"
                >
                  {photoPreview ? (
                    <div className="space-y-3">
                      <img src={photoPreview} alt="Pet preview" className="w-32 h-32 object-cover rounded-xl mx-auto" />
                      <p className="text-sm text-muted-foreground">Click or drop to change</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Drop a photo here or click to browse</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    data-testid="input-photo-file"
                  />
                </div>
              </div>

              <Button
                data-testid="button-create-calendar"
                onClick={handleSubmit}
                disabled={loading}
                size="lg"
                className="w-full text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Starting your calendar...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create My Calendar — $29.99
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Preview is free. Payment only after you approve the generated images.
              </p>
            </Card>

            <div className="space-y-6">
              <Card className="p-5">
                <h3 className="font-semibold text-foreground mb-4 text-sm">12 Monthly Holidays</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTHS.map((m) => (
                    <div key={m.month} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <span className="text-lg">{m.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-foreground">{m.month}</p>
                        <p className="text-[10px] text-muted-foreground">{m.holiday}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold text-foreground mb-4 text-sm">How It Works</h3>
                <div className="space-y-4">
                  {[
                    { step: "1", title: "Upload Your Photo", desc: "Share a clear photo of your dog or cat." },
                    { step: "2", title: "AI Creates Images", desc: "Our AI generates 12 unique holiday images of your pet." },
                    { step: "3", title: "Purchase & Download", desc: "Love it? Purchase for $29.99 and download print-ready files." },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground text-sm">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
