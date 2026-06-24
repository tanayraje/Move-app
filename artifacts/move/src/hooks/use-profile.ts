import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      return data;
    },
  });
}

export function useUpdateProfile(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      name,
    }: {
      username: string;
      name: string;
    }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          username,
          name,
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["profile", userId],
      });
    },
  });
}