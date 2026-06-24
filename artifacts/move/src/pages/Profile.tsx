import { useSupabaseAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

export default function Profile() {
  const { user } = useSupabaseAuth();

  return (
    <div className="min-h-screen px-6 py-8">
      <Link href="/">
        <button className="text-sm text-muted-foreground mb-6">
          ← Back
        </button>
      </Link>

      <div className="flex flex-col items-center text-center">

        <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold">
          {user?.email?.[0]?.toUpperCase() || "?"}
        </div>

        <h1 className="text-2xl font-bold mt-4">
          Profile
        </h1>

        <div className="w-full mt-8 max-w-md">

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

        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p className="font-semibold">Move</p>
          <p>Plan trips. Travel better.</p>
          <p className="mt-3">Created by Tanay</p>
        </div>

      </div>
    </div>
  );
}