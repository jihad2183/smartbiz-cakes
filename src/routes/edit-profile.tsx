import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { supabase } from "@/integrations/supabase/client";
import { generateUuid } from "@/lib/uuid";
import { isValidPhoneNumber } from "@/lib/phone";

const CROP_SIZE = 256;

type CropSource = {
  image: HTMLImageElement;
  url: string;
};

type CropOffset = { x: number; y: number };

export const Route = createFileRoute("/edit-profile")({
  head: () => ({
    meta: [{ title: "Edit profile | Smart Cake Shop" }, { name: "robots", content: "noindex" }],
  }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; offset: CropOffset } | null>(null);
  const cropScale = cropSource
    ? Math.max(
        CROP_SIZE / cropSource.image.naturalWidth,
        CROP_SIZE / cropSource.image.naturalHeight,
      ) * cropZoom
    : 1;
  const cropImageWidth = cropSource ? cropSource.image.naturalWidth * cropScale : CROP_SIZE;
  const cropImageHeight = cropSource ? cropSource.image.naturalHeight * cropScale : CROP_SIZE;
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("full_name,email,phone,address,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => {
    setForm({
      name: profile?.full_name ?? "",
      email: user?.email ?? profile?.email ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
    });
  }, [profile, user?.email]);

  useEffect(() => {
    let active = true;
    if (!profile?.avatar_url) {
      setAvatarUrl(null);
      return;
    }
    void supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.avatar_url, 60 * 60)
      .then(({ data, error: signedError }) => {
        if (signedError) throw signedError;
        if (active) setAvatarUrl(data.signedUrl);
      })
      .catch((signedError: unknown) => {
        console.error("Could not load the profile photo.", signedError);
        toast.error("Your profile photo could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  useEffect(
    () => () => {
      if (cropSource) URL.revokeObjectURL(cropSource.url);
    },
    [cropSource],
  );

  useEffect(() => {
    if (
      isLoading ||
      error ||
      !user ||
      sessionStorage.getItem("smartcake-checkout-return") !== "1"
    ) {
      return;
    }
    const phoneInput = document.getElementById("phone-section");
    phoneInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    phoneInput?.focus();
  }, [error, isLoading, user]);

  const cancelCrop = () => {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
    dragStart.current = null;
  };

  const chooseImage = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error("Choose a JPG, PNG, or WebP image smaller than 2 MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setCropSource({ image, url });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("The selected image could not be opened.");
    };
    image.src = url;
  };

  const saveCrop = async () => {
    if (!cropSource) return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Your browser could not prepare the cropped image.");
      return;
    }
    const sourceSize = CROP_SIZE / cropScale;
    const sourceX = cropSource.image.naturalWidth / 2 - (CROP_SIZE / 2 + cropOffset.x) / cropScale;
    const sourceY = cropSource.image.naturalHeight / 2 - (CROP_SIZE / 2 + cropOffset.y) / cropScale;

    setUploading(true);
    try {
      context.drawImage(
        cropSource.image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const croppedImage = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("The cropped image could not be created."));
          },
          "image/jpeg",
          0.92,
        );
      });
      await uploadAvatar(croppedImage);
      cancelCrop();
    } catch (cropError) {
      toast.error(cropError instanceof Error ? cropError.message : "The photo could not be saved.");
    } finally {
      setUploading(false);
    }
  };

  const uploadAvatar = async (file: Blob) => {
    if (!user) return;

    const objectPath = `${user.id}/${generateUuid()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(objectPath, file, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: objectPath })
      .eq("id", user.id);
    if (profileError) {
      const { error: cleanupError } = await supabase.storage
        .from("profile-photos")
        .remove([objectPath]);
      if (cleanupError) {
        console.error("Could not remove an unlinked profile photo.", cleanupError);
      }
      throw profileError;
    }

    await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["header-avatar", user.id] });
    const { data, error: signedError } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(objectPath, 60 * 60);
    if (signedError) throw signedError;
    setAvatarUrl(data.signedUrl);
    toast.success("Profile photo updated.");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const returnToCheckout = sessionStorage.getItem("smartcake-checkout-return") === "1";
    if (form.phone && !isValidPhoneNumber(form.phone)) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (returnToCheckout && !isValidPhoneNumber(form.phone)) {
      toast.error("A valid phone number is required before you can return to checkout.");
      return;
    }

    setSaving(true);
    try {
      const nextEmail = form.email.trim();
      if (nextEmail !== (user.email ?? "")) {
        const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
        if (emailError) throw emailError;
      }
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          ...(nextEmail === (user.email ?? "") ? { email: nextEmail } : {}),
        })
        .eq("id", user.id);
      if (profileError) throw profileError;
      await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["checkout-profile", user.id] });
      if (returnToCheckout) {
        sessionStorage.removeItem("smartcake-checkout-return");
        toast.success("Phone number saved. You can now finish your order.");
        await navigate({ to: "/checkout" });
      } else {
        toast.success(
          nextEmail !== (user.email ?? "")
            ? "Profile saved. Confirm the email-change link sent to your inbox."
            : "Your profile has been updated.",
        );
      }
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-10">{t("loadingAccount")}</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-4xl">{t("editProfile")}</h1>
        <p className="mt-3 text-muted-foreground">{t("signInToContinue")}</p>
        <Button asChild className="mt-5">
          <Link to="/auth">{t("signIn")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <Button asChild variant="outline">
        <Link to="/account">← {t("myAccount")}</Link>
      </Button>
      <h1 className="mt-5 font-display text-4xl">{t("editProfile")}</h1>
      {isLoading ? (
        <p className="mt-6" role="status">
          {t("loadingAccount")}
        </p>
      ) : error ? (
        <p className="mt-6 text-destructive" role="alert">
          Profile could not be loaded. Please try again.
        </p>
      ) : (
        <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl bg-card p-5 shadow-soft sm:p-7">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Your profile"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary text-2xl">
                {form.name.trim().slice(0, 1).toUpperCase() || "?"}
              </div>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Profile photo
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) chooseImage(file);
                  event.target.value = "";
                }}
              />
              <span className="font-normal text-muted-foreground">
                JPG, PNG, or WebP. Maximum file size: 2 MB.
              </span>
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("fullName")}
            <Input
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("emailAddress")}
            <Input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <span className="font-normal text-muted-foreground">
              Email changes take effect after confirmation.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("phoneNumber")}
            <Input
              id="phone-section"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("defaultDeliveryAddress")}
            <Input
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <Button type="submit" disabled={saving || uploading || isLoading}>
            {saving ? t("loading") : t("saveProfile")}
          </Button>
        </form>
      )}
      <Dialog
        open={Boolean(cropSource)}
        onOpenChange={(open) => {
          if (!open) cancelCrop();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust profile photo</DialogTitle>
            <DialogDescription>
              Drag the image to position it, then use the zoom control to frame your photo.
            </DialogDescription>
          </DialogHeader>
          {cropSource && (
            <div className="grid justify-items-center gap-4">
              <div
                role="img"
                aria-label="Profile photo crop preview. Drag to reposition."
                className="relative overflow-hidden rounded-full border bg-muted"
                style={{ width: CROP_SIZE, height: CROP_SIZE, touchAction: "none" }}
                onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragStart.current = {
                    x: event.clientX,
                    y: event.clientY,
                    offset: cropOffset,
                  };
                }}
                onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
                  const start = dragStart.current;
                  if (!start) return;
                  const maxX = Math.max(0, (cropImageWidth - CROP_SIZE) / 2);
                  const maxY = Math.max(0, (cropImageHeight - CROP_SIZE) / 2);
                  setCropOffset({
                    x: Math.max(-maxX, Math.min(maxX, start.offset.x + event.clientX - start.x)),
                    y: Math.max(-maxY, Math.min(maxY, start.offset.y + event.clientY - start.y)),
                  });
                }}
                onPointerUp={() => {
                  dragStart.current = null;
                }}
                onPointerCancel={() => {
                  dragStart.current = null;
                }}
              >
                <img
                  src={cropSource.url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    width: cropImageWidth,
                    height: cropImageHeight,
                    left: `calc(50% + ${cropOffset.x}px)`,
                    top: `calc(50% + ${cropOffset.y}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
              <label className="grid w-full max-w-sm gap-2 text-sm font-medium">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={cropZoom}
                  onChange={(event) => {
                    const zoom = Number(event.target.value);
                    const nextScale = cropSource
                      ? Math.max(
                          CROP_SIZE / cropSource.image.naturalWidth,
                          CROP_SIZE / cropSource.image.naturalHeight,
                        ) * zoom
                      : 1;
                    const maxX = Math.max(
                      0,
                      (cropSource.image.naturalWidth * nextScale - CROP_SIZE) / 2,
                    );
                    const maxY = Math.max(
                      0,
                      (cropSource.image.naturalHeight * nextScale - CROP_SIZE) / 2,
                    );
                    setCropZoom(zoom);
                    setCropOffset((offset) => ({
                      x: Math.max(-maxX, Math.min(maxX, offset.x)),
                      y: Math.max(-maxY, Math.min(maxY, offset.y)),
                    }));
                  }}
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={uploading} onClick={cancelCrop}>
              Cancel
            </Button>
            <Button type="button" disabled={uploading} onClick={() => void saveCrop()}>
              {uploading ? "Saving…" : "Save photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
