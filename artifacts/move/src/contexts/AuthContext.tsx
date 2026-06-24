import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
  data: { subscription },
} = supabase.auth.onAuthStateChange(
  async (_event, session) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!existingProfile) {
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            username:
              session.user.email?.split('@')[0] ||
              `user_${session.user.id.slice(0, 8)}`,
          })
          .select();

        console.log('PROFILE INSERT DATA', data);
        console.log('PROFILE INSERT ERROR', error);
      }
    }

    setLoading(false);
  }
);

return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
};

const signOut = async () => {
  await supabase.auth.signOut();
};

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useSupabaseAuth must be used inside AuthProvider");
  }

  return context;
}