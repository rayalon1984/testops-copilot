import { createContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';

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
        return await api.get<{ data: { user: User } }>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError) {
          localStorage.removeItem('accessToken');
        }
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
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post<{ data: { user: User; accessToken: string } }>('/auth/login', credentials),
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
    mutationFn: (data: { email: string; password: string; role?: string }) =>
      api.post<{ data: { user: User; accessToken: string } }>('/auth/register', data),
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
      return api.post<{ message: string }>('/auth/logout');
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
    login: async (email: string, password: string) => { await loginMutation.mutateAsync({ email, password }); },
    logout: async () => { await logoutMutation.mutateAsync(); },
    register: async (email: string, password: string, role?: string) => {
      await registerMutation.mutateAsync({ email, password, role });
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}