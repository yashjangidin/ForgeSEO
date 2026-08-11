import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut, WandSparkles } from "lucide-react";
import { signOut } from "firebase/auth";
import type { ReactElement } from "react";
import { auth } from "../services/firebase";

export const AppShell = (): ReactElement => (
  <div className="min-h-screen bg-paper">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-ink">
          <WandSparkles className="h-5 w-5 text-ocean" />
          ForgeSEO
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className={({ isActive }) => (isActive ? "font-semibold text-ocean" : "text-slate-600")}>
            Dashboard
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? "font-semibold text-ocean" : "text-slate-600")}>
            Analytics
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "font-semibold text-ocean" : "text-slate-600")}>
            Settings
          </NavLink>
        </nav>
        <button
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600"
          title="Sign out"
          onClick={() => {
            if (auth) {
              void signOut(auth);
            }
          }}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
    <Outlet />
  </div>
);
