/**
 * Login page — allows existing users to sign in.
 */
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";

type UserRole = "ADMIN" | "DEVELOPER" | "MANAGER";

const ROLES: { value: UserRole; label: string; description: string; badgeClass: string; accent: string; border: string; glow: string }[] = [
  { value: "ADMIN", label: "Admin", description: "Manage workspace & users", badgeClass: "badge-admin", accent: "text-purple-300", border: "hover:border-purple-500/70", glow: "hover:shadow-[0_12px_30px_rgba(168,85,247,0.12)]" },
  { value: "DEVELOPER", label: "Developer", description: "Manage tasks & development", badgeClass: "badge-developer", accent: "text-primary-300", border: "hover:border-primary-500/70", glow: "hover:shadow-[0_12px_30px_rgba(59,130,246,0.12)]" },
  { value: "MANAGER", label: "Project Manager", description: "Manage projects & teams", badgeClass: "badge-manager", accent: "text-accent-300", border: "hover:border-accent-500/70", glow: "hover:shadow-[0_12px_30px_rgba(20,184,166,0.12)]" },
];

// Simple inline SVG icons to avoid extra dependencies
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuth } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!form.email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address";
    if (!form.password) return "Password is required";
    if (form.password.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    setError(null);

    try {
      await loginUser({ email: form.email.trim(), password: form.password });
      refreshAuth();
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(
        message.toLowerCase().includes("invalid login credentials")
          ? "Incorrect email or password. Please try again."
          : message
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-900 via-surface-900 to-surface-950 items-center justify-center p-16">
        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent-500/15 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-glow">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">AI DevFlow</p>
              <p className="text-surface-400 text-xs mt-0.5">Intelligence Suite</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Developer workflow<br />
            <span className="gradient-text">intelligence.</span>
          </h2>
          <p className="text-surface-300 text-lg leading-relaxed mb-10">
            Monitor project health, detect bottlenecks, and gain AI-powered insights into your development workflow.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {[
              { icon: "📊", text: "Real-time workflow analytics" },
              { icon: "🤖", text: "AI-powered bottleneck detection" },
              { icon: "👥", text: "Team performance insights" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 glass-card px-4 py-3">
                <span className="text-xl">{f.icon}</span>
                <span className="text-surface-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="gradient-text font-bold text-xl">AI DevFlow Intelligence Suite</span>
          </div>

          {!selectedRole ? (
            <>
              <h1 className="text-2xl font-bold text-surface-50 mb-1">Sign in to your workspace</h1>
              <p className="text-surface-400 text-sm mb-8">Choose your role to continue.</p>
              <div className="grid grid-cols-1 gap-3">
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setSelectedRole(role.value)}
                    className={`group w-full min-h-20 text-left flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-surface-700/80 bg-gradient-to-r from-surface-800/90 to-surface-800/50 text-surface-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 ${role.border} ${role.glow}`}
                  >
                    <span className="min-w-0">
                      <span className={`block font-semibold text-sm ${role.accent}`}>{role.label}</span>
                      <span className="mt-1 block text-xs font-normal text-surface-400">{role.description}</span>
                    </span>
                    <svg className="w-4 h-4 shrink-0 text-surface-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <span className={ROLES.find((role) => role.value === selectedRole)?.badgeClass}>
                  {ROLES.find((role) => role.value === selectedRole)?.label}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                >
                  Change role
                </button>
              </div>
              <h1 className="text-2xl font-bold text-surface-50 mb-1">Sign in to your workspace</h1>
              <p className="text-surface-400 text-sm mb-8">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  state={{ role: selectedRole }}
                  className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  Create an account
                </Link>
              </p>

              {error && (
                <div className="mb-6 flex items-start gap-3 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3 animate-fade-in">
                  <svg className="w-5 h-5 text-danger-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-danger-300 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="input-label">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                className="input-field"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="input-label">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className="input-field pr-12"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
              </form>
              <p className="text-center text-surface-600 text-xs mt-8">
                AI DevFlow Intelligence Suite · Milestone 1
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
