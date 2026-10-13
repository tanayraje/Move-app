import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmHost } from "@/components/ConfirmHost";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import TripDashboard from "@/pages/TripDashboard";
import Profile from "@/pages/Profile";
import JoinInvite from "@/pages/JoinInvite";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/join/:inviteCode" component={JoinInvite} />
      <Route path="/trip/:id" component={TripDashboard} />
      <Route path="/trip/:id/:tab" component={TripDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    if (import.meta.env.DEV && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
      return;
    }

    /*
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    */
  }, []);

  return (
  <MotionConfig reducedMotion="user">
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
        <ConfirmHost />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </MotionConfig>
);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    signInWithGoogle,
  } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  // After Google sign-in the browser lands on "/"; send an invitee back to the link they opened.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem("move-return-to");
      if (!raw) return;
      localStorage.removeItem("move-return-to");
      const { path, at } = JSON.parse(raw);
      if (path && Date.now() - at < 60 * 60 * 1000) setLocation(path);
    } catch {}
  }, [user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-5xl font-display font-extrabold text-foreground tracking-tight mb-3">
            Move.
          </h1>

          <p className="text-muted-foreground text-lg mb-10">
            Plan trips together. Track expenses. Never miss a detail.
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full bg-primary text-primary-foreground rounded-2xl px-6 py-4 text-lg font-semibold shadow-xl"
          >
            <LogIn className="w-5 h-5 inline mr-2" />
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default App;
