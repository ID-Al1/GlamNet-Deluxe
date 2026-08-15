// @refresh reset
/**
 * Stable context module — deliberately has no RUNTIME imports from
 * @workspace/api-client-react. All api-client-react imports here are
 * `import type`, which TypeScript/Vite erases at build time and excludes
 * from the HMR dependency graph.
 *
 * Why this matters: when codegen regenerates api-client-react files, Vite
 * HMR-invalidates every module that (transitively) imports them at runtime.
 * If AuthContext were defined in auth.tsx, that invalidation would create a
 * new AuthContext object while the existing AuthProvider in the React tree
 * still holds the old reference — breaking useAuth() with "must be used
 * within an AuthProvider".
 *
 * Keeping AuthContext here means it is NEVER re-created during codegen HMR.
 * The AuthProvider and useAuth() in auth.tsx always share the same object.
 */
import { createContext } from "react";
import type { User, LoginInput, SignupInput } from "@workspace/api-client-react";

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: { data: LoginInput }) => Promise<{ user: User; token: string }>;
  signup: (data: { data: SignupInput }) => Promise<{ user: User; token: string }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
