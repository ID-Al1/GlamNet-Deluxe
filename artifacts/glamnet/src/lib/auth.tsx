import { createContext, useContext, useState, ReactNode } from "react";
import { setAuthToken, useLogin, useSignup, useLogout } from "@workspace/api-client-react";
import type { User, LoginInput, SignupInput } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>["mutateAsync"];
  signup: ReturnType<typeof useSignup>["mutateAsync"];
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredAuth(): { user: User; token: string } | null {
  try {
    const stored = localStorage.getItem("glamnet_auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed?.token && parsed?.user) return parsed as { user: User; token: string };
  } catch {}
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = readStoredAuth();
    if (stored) {
      setAuthToken(stored.token);
      return stored.user;
    }
    return null;
  });

  const [token, setTokenState] = useState<string | null>(() => {
    return readStoredAuth()?.token ?? null;
  });

  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const logoutMutation = useLogout();

  const login = async (data: { data: LoginInput }) => {
    const res = await loginMutation.mutateAsync(data);
    if (res.token && res.user) {
      setTokenState(res.token);
      setUser(res.user);
      setAuthToken(res.token);
      localStorage.setItem("glamnet_auth", JSON.stringify(res));
    }
    return res;
  };

  const signup = async (data: { data: SignupInput }) => {
    const res = await signupMutation.mutateAsync(data);
    if (res.token && res.user) {
      setTokenState(res.token);
      setUser(res.user);
      setAuthToken(res.token);
      localStorage.setItem("glamnet_auth", JSON.stringify(res));
    }
    return res;
  };

  const logout = () => {
    logoutMutation.mutate();
    setTokenState(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem("glamnet_auth");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading: false, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
