import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren, type ReactElement } from "react";
import { auth, firebaseConfigured } from "../services/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: firebaseConfigured
});

export const AuthProvider = ({ children }: PropsWithChildren): ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    const activeAuth = auth;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) {
        return;
      }
      setUser(activeAuth.currentUser);
      setLoading(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(activeAuth, (nextUser) => {
      if (!active) {
        return;
      }
      window.clearTimeout(timeoutId);
      setUser(nextUser);
      setLoading(false);
    }, () => {
      if (!active) {
        return;
      }
      window.clearTimeout(timeoutId);
      setUser(null);
      setLoading(false);
    });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading, configured: firebaseConfigured }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);
