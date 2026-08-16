import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { Link } from "wouter";

const AVATARS = Array.from({ length: 24 }, (_, i) => `avatar-${i + 1}`);

const getAvatarUrl = (seed: string, size = 128) =>
  `https://api.dicebear.com/10.x/notionists-neutral/svg?backgroundColor=69d2e7&paperColor=&inkColor=083a54&eyebrowsVariant=variant01,variant02,variant03,variant04,variant05,variant07,variant08,variant09,variant10,variant11,variant12&mouthVariant=variant01,variant02,variant03,variant04,variant05,variant06,variant08,variant09,variant10,variant11,variant12,variant13,variant14,variant15,variant16,variant17,variant18,variant19,variant20,variant21,variant22,variant23,variant24,variant25,variant26,variant27,variant28,variant29,variant30&seed=${encodeURIComponent(seed)}&size=${size}`;

export default function Profile() {
  const { user } = useSupabaseAuth();

  const { data: profile } = useProfile(user?.id);
  const updateProfile = useUpdateProfile(user?.id);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("avatar-1");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (!profile) return;

    setUsername(profile.username || "");
    setName(profile.name || "");
    setAvatar(profile.avatar || "avatar-1");
  }, [profile]);

  const hasChanges =
    username !== (profile?.username || "") ||
    name !== (profile?.name || "") ||
    avatar !== (profile?.avatar || "avatar-1");

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        username: username.trim(),
        name: name.trim(),
        avatar,
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

        {/* Avatar */}
        <button
          type="button"
          onClick={() => setShowAvatarPicker(true)}
          className="w-24 h-24 rounded-full overflow-hidden bg-muted hover:opacity-90 transition-opacity"
        >
          <img
            src={getAvatarUrl(avatar)}
            alt="Profile avatar"
            className="w-full h-full"
          />
        </button>

        <button
          type="button"
          onClick={() => setShowAvatarPicker(true)}
          className="text-sm text-primary font-medium mt-3"
        >
          Change avatar
        </button>

        <h1 className="text-2xl font-bold mt-4">
          Profile
        </h1>

        <div className="w-full mt-8 max-w-md">

          <div className="mb-4 text-left">
            <label className="block text-sm font-medium mb-2">
              Username
            </label>

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-12 rounded-xl border px-4"
            />
          </div>

          <div className="mb-4 text-left">
            <label className="block text-sm font-medium mb-2">
              Name
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 rounded-xl border px-4"
            />
          </div>

          <div className="mb-4 text-left">
            <label className="block text-sm font-medium mb-2">
              Email
            </label>

            <input
              value={user?.email || ""}
              readOnly
              className="w-full h-12 rounded-xl border px-4 bg-muted"
            />
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium mt-6"
            >
              {updateProfile.isPending
                ? "Saving..."
                : "Save Changes"}
            </button>
          )}
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p className="font-semibold">Move</p>
          <p>Plan trips. Travel better.</p>
          <p className="mt-3">Created by Tanay Raje</p>
        </div>
      </div>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center px-5"
          onClick={() => setShowAvatarPicker(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                Choose your avatar
              </h2>

              <button
              type="button"
              onClick={() => setShowAvatarPicker(false)}
              className="text-sm text-primary font-medium"
            >
              Done
            </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {AVATARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAvatar(item)}
                  className={`aspect-square rounded-2xl overflow-hidden bg-muted transition-all ${
                    avatar === item
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                      : "hover:scale-105"
                  }`}
                >
                  <img
                    src={getAvatarUrl(item, 128)}
                    alt=""
                    className="w-full h-full"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}