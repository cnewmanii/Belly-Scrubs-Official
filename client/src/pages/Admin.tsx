import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, ImagePlus } from "lucide-react";

interface HeroPhotoMeta {
  id: number;
  caption: string | null;
  createdAt: string;
}

interface HeroPhotoFull extends HeroPhotoMeta {
  imageData: string;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const { data: photos = [], isLoading } = useQuery<HeroPhotoMeta[]>({
    queryKey: ["/api/admin/hero-photos"],
  });

  // Fetch full photo data for thumbnails
  const { data: fullPhotos = [] } = useQuery<HeroPhotoFull[]>({
    queryKey: ["/api/hero-photos"],
  });

  // Build a map of id -> imageData for quick lookup
  const thumbnailMap = new Map(fullPhotos.map((p) => [p.id, p.imageData]));

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("photo", file);
      if (caption.trim()) form.append("caption", caption.trim());
      const res = await fetch("/api/admin/hero-photos", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-photos"] });
      setCaption("");
      toast({ title: "Photo uploaded" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/hero-photos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-photos"] });
      toast({ title: "Photo deleted" });
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Please select an image file", variant: "destructive" });
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation, toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <h1 className="text-3xl font-bold text-foreground mb-2">Hero Photo Manager</h1>
      <p className="text-muted-foreground mb-8">Upload photos for the homepage rotating background.</p>

      {/* Upload area */}
      <Card
        className={`p-8 mb-10 border-2 border-dashed transition-colors text-center cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <ImagePlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">
          Drag & drop an image here, or click to select
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex items-center justify-center gap-3">
          <input
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-2 rounded-md border border-border bg-background text-sm w-64"
          />
          <Button
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
          >
            <Upload className="w-4 h-4 mr-1" />
            {uploadMutation.isPending ? "Uploading..." : "Choose File"}
          </Button>
        </div>
      </Card>

      {/* Photo list */}
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Current Photos ({photos.length})
      </h2>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : photos.length === 0 ? (
        <p className="text-muted-foreground">No hero photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="p-4">
              <div className="aspect-video rounded-lg bg-muted flex items-center justify-center mb-3 overflow-hidden">
                {thumbnailMap.has(photo.id) ? (
                  <img
                    src={thumbnailMap.get(photo.id)}
                    alt={photo.caption || `Hero photo #${photo.id}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Photo #{photo.id}</span>
                )}
              </div>
              {photo.caption && (
                <p className="text-sm text-foreground mb-2 truncate">{photo.caption}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(photo.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(photo.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
