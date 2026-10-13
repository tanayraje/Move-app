import React, { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft, Pencil, Check, LogOut, Mail, Sun, Moon, Monitor } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useTrips } from "@/hooks/use-store";
import { getAvatarUrl } from "@/lib/avatar";
import { BottomSheet, Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setThemeMode, useThemeMode, type ThemeMode } from "@/lib/theme";

const AVATARS = Array.from({ length: 24 }, (_, i) => `avatar-${i + 1}`);

export default function Profile() {
  const { user, signOut } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);
  const updateProfile = useUpdateProfile(user?.id);
  const { data: trips = [] } = useTrips();
  const themeMode = useThemeMode();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("avatar-1");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || "");
    setName(profile.name || "");
    setAvatar(profile.avatar || "avatar-1");
  }, [profile]);

  const stats = useMemo(() => {
    const real = trips.filter((t: any) => t.status !== "wishlist");
    const countries = new Set(
      real.map((t: any) => String(t.destination || "").split(",").pop()?.trim()).filter(Boolean)
    );
    return {
      trips: real.length,
      countries: countries.size,
      wishlist: trips.filter((t: any) => t.status === "wishlist").length,
    };
  }, [trips]);

  const hasChanges =
    username !== (profile?.username || "") ||
    name !== (profile?.name || "") ||
    avatar !== (profile?.avatar || "avatar-1");

  const handleSave = async () => {
    setError("");
    setSaved(false);
    if (!username.trim()) {
      setError("Username cannot be empty.");
      return;
    }
    try {
      await updateProfile.mutateAsync({ username: username.trim(), name: name.trim(), avatar });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("duplicate") || err?.code === "23505") {
        setError("That username is already taken.");
      } else {
        setError("Could not update your profile. Try again.");
      }
    }
  };

  const stat = (label: string, value: number) => (
    <div className="flex-1 text-center">
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md px-4 pb-16 pt-[calc(16px+env(safe-area-inset-top))]">
      <Link href="/">
        <button
          aria-label="Back"
          className="glass-light flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </Link>

      <h1 className="mt-5 px-2 font-display text-[40px] font-bold leading-none tracking-tight">Profile</h1>

      {/* Identity */}
      <div className="mt-6 rounded-[28px] bg-card p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-none dark:ring-1 dark:ring-border">
        <div className="flex flex-col items-center text-center">
          <button type="button" onClick={() => setShowPicker(true)} className="relative" aria-label="Change avatar">
            <img
              src={getAvatarUrl(avatar)}
              alt=""
              className="h-24 w-24 rounded-full bg-muted object-cover"
            />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </span>
          </button>
          <p className="mt-4 text-xl font-semibold text-foreground">{name || username || "Traveller"}</p>
          {username && <p className="text-sm text-muted-foreground">@{username}</p>}
        </div>

        <div className="mt-6 flex border-t border-border pt-5">
          {stat("Trips", stats.trips)}
          <div className="w-px bg-border" />
          {stat("Countries", stats.countries)}
          <div className="w-px bg-border" />
          {stat("Wishlist", stats.wishlist)}
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 rounded-[28px] bg-card p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-none dark:ring-1 dark:ring-border">
        <div className="mb-4">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="mb-4">
          <Label>Username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            placeholder="username"
            autoCapitalize="none"
          />
        </div>
        <div>
          <Label>Email</Label>
          <div className="flex h-12 items-center gap-2 rounded-xl bg-muted px-4 text-base text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
        </div>

        {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}
        {saved && (
          <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Saved
          </p>
        )}
        {hasChanges && (
          <Button size="lg" className="mt-5 w-full" onClick={handleSave} isLoading={updateProfile.isPending}>
            Save changes
          </Button>
        )}
      </div>

      {/* Appearance */}
      <div className="mt-4 rounded-[28px] bg-card p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-none dark:ring-1 dark:ring-border">
        <p className="mb-1 font-display text-[17px] font-bold tracking-[-0.01em]">Appearance</p>
        <p className="mb-4 text-sm text-muted-foreground">
          {themeMode === "system" ? "Matches your phone's setting." : themeMode === "dark" ? "Dark is on." : "Light is on."}
        </p>
        <ThemeSwitch value={themeMode} onChange={setThemeMode} />
      </div>

      <button
        onClick={signOut}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-card text-[15px] font-semibold text-red-500 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-none dark:ring-1 dark:ring-border"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="mt-10 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Move</p>
        <p>Plan trips. Travel better.</p>
        <p className="mt-2 text-xs">Created by Tanay Raje</p>
      </div>

      <BottomSheet isOpen={showPicker} onClose={() => setShowPicker(false)} title="Choose your avatar">
        <div className="grid grid-cols-4 gap-3">
          {AVATARS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setAvatar(item)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-2xl bg-muted transition",
                avatar === item ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "hover:scale-105"
              )}
            >
              <img src={getAvatarUrl(item, 128)} alt="" className="h-full w-full" />
              {avatar === item && (
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={() => setShowPicker(false)}>Done</Button>
      </BottomSheet>
    </div>
  );
}

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/** Three-way switch. The pill slides with a transform transition, so it can be retargeted mid-move. */
function ThemeSwitch({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const index = Math.max(0, THEME_OPTIONS.findIndex((o) => o.id === value));
  return (
    <div role="radiogroup" aria-label="Theme" className="relative grid grid-cols-3 rounded-2xl bg-muted p-1">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-xl bg-card shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition-transform duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-[#2b3447] dark:shadow-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "relative z-10 flex h-11 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition-colors duration-200",
            value === id ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
