import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useState, type ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { auth, firebaseConfigured } from "../services/firebase";
import { useAuth } from "../components/AuthProvider";

export const Login = (): ReactElement => {
  const { user } = useAuth();
  const activeAuth = auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | undefined>();

  const signUpWithEmail = (): void => {
    if (!activeAuth) {
      setMessage("Firebase login is not configured.");
      return;
    }
    setMessage(undefined);
    createUserWithEmailAndPassword(activeAuth, email, password).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Could not sign up.");
    });
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  if (!firebaseConfigured || !activeAuth) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-3xl font-semibold">ForgeSEO</h1>
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Firebase Web credentials are not configured. Login is disabled until the Vite Firebase environment variables are set.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-4">
      <h1 className="text-3xl font-semibold text-ink">Sign in to ForgeSEO</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(undefined);
          signInWithEmailAndPassword(activeAuth, email, password).catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : "Could not sign in.");
          });
        }}
      >
        <input className="w-full rounded border border-slate-300 px-3 py-2" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="w-full rounded border border-slate-300 px-3 py-2" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="rounded bg-ocean px-4 py-2 font-semibold text-white" type="submit">Sign in</button>
          <button className="rounded border border-ocean px-4 py-2 font-semibold text-ocean" type="button" onClick={signUpWithEmail}>Sign up</button>
        </div>
      </form>
      <button className="mt-3 rounded border border-slate-300 px-4 py-2" onClick={() => signInWithPopup(activeAuth, new GoogleAuthProvider()).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Google login failed."))}>
        Continue with Google
      </button>
      <button className="mt-3 text-sm text-ocean" onClick={() => email && sendPasswordResetEmail(activeAuth, email).then(() => setMessage("Password reset email sent.")).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Password reset failed."))}>
        Reset password
      </button>
      {message ? <p className="mt-4 rounded border border-slate-200 bg-white p-3 text-sm">{message}</p> : null}
    </main>
  );
};
