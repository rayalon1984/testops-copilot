import { createContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, role?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if user is authenticated
  const { data: userData, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return null;
      }

      try {
        const response = await fetch('/api/v1/auth/me', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (!response.ok) {
          localStorage.removeItem('accessToken');
          throw new Error('Not authenticated');
        }
        return response.json();
      } catch (error) {
        localStorage.removeItem('accessToken');
        setUser(null);
        return null;
      }
    },
  });

  // Update user state when auth check completes
  useEffect(() => {
    if (!isCheckingAuth) {
      setUser(userData?.data?.user || null);
      setIsLoading(false);
    }
  }, [userData, isCheckingAuth]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      if (!response.ok) throw new Error('Login failed');
      return response.json();
    },
    onSuccess: (data) => {
      // Store access token
      localStorage.setItem('accessToken', data.data.accessToken);
      setUser(data.data.user);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/dashboard');
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; role?: string }) => {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Registration failed');
      return response.json();
    },
    onSuccess: (data) => {
      // Store access token if present
      if (data.data.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
      }
      setUser(data.data.user);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/dashboard');
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Logout failed');
      return response.json();
    },
    onSuccess: () => {
      // Clear access token
      localStorage.removeItem('accessToken');
      setUser(null);
      queryClient.clear();
      navigate('/login');
    },
  });

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
    register: (email: string, password: string, role?: string) =>
      registerMutation.mutateAsync({ email, password, role }),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}