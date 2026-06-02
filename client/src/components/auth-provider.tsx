import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data: authData, isLoading: isAuthLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => authApi.me(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login({ username, password }),
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(["/api/auth/me"], data);
      queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
    },
  });

  useEffect(() => {
    if (authData?.user) {
      setUser(authData.user);
    } else if (authData === null || authData === undefined) {
      // If query settled with no user data, mark as logged out
      // (handles cases where the query returned an error or null)
    }
  }, [authData]);

  // Periodically re-check session to detect server-side expiry
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) {
          setUser(null);
        }
      } catch {}
    }, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoading: isAuthLoading || loginMutation.isPending || logoutMutation.isPending,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      login: async () => {},
      logout: async () => {},
      isLoading: true,
      isAuthenticated: false,
    } as AuthContextType;
  }
  return context;
}
