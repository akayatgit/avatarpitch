'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

interface User {
  id: string;
  email: string;
  credits: number;
  role: 'user' | 'admin' | 'superuser';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  refreshCredits: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      setIsLoading(true);
      return;
    }

    if (session?.user) {
      setUser({
        id: session.user.id as string,
        email: session.user.email as string,
        credits: (session.user.credits as number) || 0,
        role: (session.user.role as 'user' | 'admin' | 'superuser') || 'user',
      });
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [session, status]);

  const logout = async () => {
    await signOut({ callbackUrl: '/' });
    setUser(null);
  };

  const refreshCredits = async () => {
    if (session?.user?.email) {
      try {
        const response = await fetch('/api/user/credits');
        if (response.ok) {
          const data = await response.json();
          setUser((prev) => (prev ? { ...prev, credits: data.credits } : null));
        }
      } catch (error) {
        console.error('Error refreshing credits:', error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        refreshCredits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

