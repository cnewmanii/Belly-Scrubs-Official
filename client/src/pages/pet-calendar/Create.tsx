import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Upload, Dog, Cat, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function PetCalendarCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState<"dog" | "cat" | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!photo) {
      toast({ title: "Please upload a photo of your pet", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("petName", petName);
      formData.append("petType", petType);
      formData.append("photo", photo);

      const res = await fetch("/api/pet-calendars", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to create calendar");
      const data = await res.json();
      setLocation(`/pet-calendar/${data.id}`);
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

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
                    <span className="animate-spin mr-2">{"\u27F3"}</span>
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
