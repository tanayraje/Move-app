import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { Link } from "wouter";

export default function Profile() {
  const { user } = useSupabaseAuth();

const { data: profile } = useProfile(user?.id);
const updateProfile = useUpdateProfile(user?.id);

const [username, setUsername] = useState("");
const [name, setName] = useState("");

useEffect(() => {
  if (!profile) return;

  setUsername(profile.username || "");
  setName(profile.name || "");
}, [profile]);

const handleSave = async () => {
  try {
    await updateProfile.mutateAsync({
      username: username.trim(),
      name: name.trim(),
    });

    alert("Profile updated");
  } catch (err: any) {
    console.error(err);

    if (
      err.message?.includes("duplicate") ||
      err.code === "23505"
    ) {
      alert("Username already taken");
      return;
    }

    alert("Failed to update profile");
  }
};

  return (
    <div className="min-h-screen px-6 py-8">
      <Link href="/">
        <button className="text-sm text-muted-foreground mb-6">
          ← Back
        </button>
      </Link>

      <div className="flex flex-col items-center text-center">

        <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold">
          {username?.[0]?.toUpperCase() || "?"}
        </div>

        <h1 className="text-2xl font-bold mt-4">
          Profile
        </h1>

        <div className="w-full mt-8 max-w-md">

          <>
  <div className="mb-4">
    <label className="block text-sm font-medium mb-2">
      Username
    </label>

    <input
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      className="w-full h-12 rounded-xl border px-4"
    />
  </div>

  <button
  onClick={handleSave}
  disabled={updateProfile.isPending}
  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium mt-4"
>
  {updateProfile.isPending
    ? "Saving..."
    : "Save Changes"}
</button>

  <div className="mb-4">
    <label className="block text-sm font-medium mb-2">
      Name
    </label>

    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      className="w-full h-12 rounded-xl border px-4"
    />
  </div>

  <div className="mb-4">
    <label className="block text-sm font-medium mb-2">
      Email
    </label>

    <input
      value={user?.email || ""}
      readOnly
      className="w-full h-12 rounded-xl border px-4 bg-muted"
    />
  </div>
</>

        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p className="font-semibold">Move</p>
          <p>Plan trips. Travel better.</p>
          <p className="mt-3">Created by Tanay Raje</p>
        </div>

      </div>
    </div>
  );
}

