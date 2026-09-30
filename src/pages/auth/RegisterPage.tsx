/**
 * Register page — allows new users to create an account.
 * Step 1: Pick a role (Admin / Developer / Project Manager).
 * Step 2: Fill in the signup form with the chosen role pre-selected.
 */
import { useState, type ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { registerUser } from "../../services/authService";

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

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

const PasswordStrengthBar = ({ password }: { password: string }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };
  const score = getStrength();
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = ["", "bg-danger-500", "bg-warning-500", "bg-warning-400", "bg-success-500", "bg-success-400"];

  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : "bg-surface-700"}`} />
        ))}
      </div>
      <p className="text-xs text-surface-500">{labels[score]}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Role metadata
// ---------------------------------------------------------------------------

type UserRole = "ADMIN" | "DEVELOPER" | "MANAGER";

const ROLES: {
  value: UserRole;
  label: string;
  description: string;
  badgeClass: string;
  accentColor: string;
  borderSelected: string;
  bgSelected: string;
  icon: ReactElement;
}[] = [
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full system access and user management",
    badgeClass: "badge-admin",
    accentColor: "text-purple-300",
    borderSelected: "border-purple-500",
    bgSelected: "bg-purple-500/10",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    value: "DEVELOPER",
    label: "Developer",
    description: "Code, build, and ship features",
    badgeClass: "badge-developer",
    accentColor: "text-primary-300",
    borderSelected: "border-primary-500",
    bgSelected: "bg-primary-500/10",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    value: "MANAGER",
    label: "Project Manager",
    description: "Plan, track, and lead projects",
    badgeClass: "badge-manager",
    accentColor: "text-accent-300",
    borderSelected: "border-accent-500",
    bgSelected: "bg-accent-500/10",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Shared left decorative panel
// ---------------------------------------------------------------------------

const LeftPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-900 via-surface-900 to-surface-950 items-center justify-center p-16">
    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-600/20 rounded-full blur-3xl" />
    <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent-500/15 rounded-full blur-3xl" />

    <div className="relative z-10 max-w-md">
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
        Join your team's<br />
        <span className="gradient-text">intelligence hub.</span>
      </h2>
      <p className="text-surface-300 text-lg leading-relaxed mb-10">
        Get started with AI-powered workflow intelligence. Choose your role to begin.
      </p>

      <div className="glass-card px-6 py-5">
        <p className="text-surface-300 text-sm font-semibold mb-3">Account roles</p>
        <div className="space-y-2.5 text-sm text-surface-400">
          <div className="flex items-center gap-2">
            <span className="badge-developer">DEVELOPER</span>
            <span>Code, build, and ship features</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge-manager">MANAGER</span>
            <span>Plan, track, and lead projects</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge-admin">ADMIN</span>
            <span>Full system access</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step 1 — Role picker
// ---------------------------------------------------------------------------

function RolePickerStep({ onSelect }: { onSelect: (role: UserRole) => void }) {
  const [hovered, setHovered] = useState<UserRole | null>(null);

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="gradient-text font-bold text-xl">AI DevFlow</span>
          </div>

          <h1 className="text-2xl font-bold text-surface-50 mb-1">Create your account</h1>
          <p className="text-surface-400 text-sm mb-8">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>

          {/* Step label */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">1</div>
            <p className="text-surface-300 text-sm font-medium">Choose your role to get started</p>
          </div>

          {/* Role cards */}
          <div className="flex flex-col gap-3">
            {ROLES.map((role) => {
              const isHovered = hovered === role.value;
              return (
                <button
                  key={role.value}
                  id={`role-card-${role.value.toLowerCase()}`}
                  type="button"
                  onClick={() => onSelect(role.value)}
                  onMouseEnter={() => setHovered(role.value)}
                  onMouseLeave={() => setHovered(null)}
                  className={`w-full text-left flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200
                    ${isHovered
                      ? `${role.borderSelected} ${role.bgSelected} shadow-glow`
                      : "border-surface-700 bg-surface-800/60 hover:border-surface-600"
                    }`}
                >
                  {/* Icon */}
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200
                    ${isHovered ? `${role.bgSelected} ${role.accentColor}` : "bg-surface-700/60 text-surface-400"}`}>
                    {role.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`font-semibold text-sm transition-colors duration-200 ${isHovered ? role.accentColor : "text-surface-100"}`}>
                        {role.label}
                      </span>
                      <span className={role.badgeClass}>{role.value}</span>
                    </div>
                    <p className="text-surface-500 text-xs">{role.description}</p>
                  </div>

                  {/* Arrow */}
                  <svg
                    className={`w-4 h-4 shrink-0 transition-all duration-200 ${isHovered ? `${role.accentColor} translate-x-0.5` : "text-surface-600"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>

          <p className="text-center text-surface-600 text-xs mt-8">
            AI DevFlow Intelligence Suite · Milestone 1
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Signup form (existing, unchanged logic)
// ---------------------------------------------------------------------------

function SignupFormStep({
  initialRole,
  onBack,
}: {
  initialRole: UserRole;
  onBack: () => void;
}) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: initialRole,
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!form.fullName.trim()) return "Full name is required";
    if (form.fullName.trim().length < 2) return "Full name must be at least 2 characters";
    if (!form.email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address";
    if (!form.password) return "Password is required";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(form.password)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(form.password)) return "Password must contain at least one number";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    setError(null);

    try {
      await registerUser({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(
        message.toLowerCase().includes("already registered") ||
        message.toLowerCase().includes("user already exists")
          ? "An account with this email already exists. Please sign in instead."
          : message
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full glass-card p-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-success-500/20 border border-success-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-surface-50 mb-2">Account Created!</h2>
          <p className="text-surface-400 mb-2">
            Your account for <span className="text-primary-300 font-medium">{form.email}</span> has been created successfully.
          </p>
          <p className="text-surface-500 text-sm mb-8">
            You can now sign in to access your developer workspace.
          </p>
          <button onClick={() => navigate("/login")} className="btn-primary w-full">
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  const selectedRoleMeta = ROLES.find((r) => r.value === form.role)!;

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="gradient-text font-bold text-xl">AI DevFlow</span>
          </div>

          {/* Step indicator + back */}
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="w-8 h-8 rounded-lg border border-surface-700 bg-surface-800/60 flex items-center justify-center text-surface-400 hover:text-surface-100 hover:border-surface-600 transition-all duration-200 shrink-0 disabled:opacity-40"
              aria-label="Back to role selection"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">2</div>
              <p className="text-surface-300 text-sm font-medium">Complete your account details</p>
            </div>
          </div>

          {/* Selected role chip */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${selectedRoleMeta.borderSelected} ${selectedRoleMeta.bgSelected}`}>
            <div className={`${selectedRoleMeta.accentColor}`}>{selectedRoleMeta.icon}</div>
            <div>
              <p className={`text-sm font-semibold ${selectedRoleMeta.accentColor}`}>{selectedRoleMeta.label}</p>
              <p className="text-surface-500 text-xs">{selectedRoleMeta.description}</p>
            </div>
            <span className={`ml-auto ${selectedRoleMeta.badgeClass}`}>{form.role}</span>
          </div>

          <h1 className="text-2xl font-bold text-surface-50 mb-1">Create your account</h1>
          <p className="text-surface-400 text-sm mb-8">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3 animate-fade-in">
              <svg className="w-5 h-5 text-danger-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-danger-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Full name */}
            <div>
              <label htmlFor="reg-name" className="input-label">Full name</label>
              <input
                id="reg-name"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={form.fullName}
                onChange={handleChange}
                className="input-field"
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="input-label">Email address</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={handleChange}
                className="input-field"
                disabled={isLoading}
              />
            </div>

            {/* Role (radio group — pre-selected, user can still change) */}
            <div>
              <p id="reg-role-label" className="input-label">Role</p>
              <div role="radiogroup" aria-labelledby="reg-role-label" className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "ADMIN", label: "Admin" },
                    { value: "DEVELOPER", label: "Developer" },
                    { value: "MANAGER", label: "Project Manager" },
                  ] as const
                ).map(({ value, label }) => (
                  <label
                    key={value}
                    htmlFor={`reg-role-${value}`}
                    className={`flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center text-sm transition-colors ${
                      form.role === value
                        ? "border-primary-500 bg-primary-500/10 text-primary-300"
                        : "border-surface-700 bg-surface-800/60 text-surface-400 hover:border-surface-600"
                    }`}
                  >
                    <input
                      id={`reg-role-${value}`}
                      type="radio"
                      name="role"
                      value={value}
                      checked={form.role === value}
                      onChange={() => setForm((prev) => ({ ...prev, role: value }))}
                      className="h-4 w-4 accent-primary-500"
                      disabled={isLoading}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="input-label">Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
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
              <PasswordStrengthBar password={form.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="reg-confirm" className="input-label">Confirm password</label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="input-field pr-12"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-danger-400 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Role note */}
            <div className="flex items-center gap-2 bg-surface-800/60 border border-surface-700/50 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-surface-400 text-xs">
                Selected role: <span className={form.role === "ADMIN" ? "badge-admin" : form.role === "MANAGER" ? "badge-manager" : "badge-developer"}>{form.role}</span>
              </p>
            </div>

            <button
              id="register-submit"
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
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="text-center text-surface-600 text-xs mt-8">
            AI DevFlow Intelligence Suite · Milestone 1
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — orchestrates the two steps
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const location = useLocation();
  const requestedRole = (location.state as { role?: UserRole } | null)?.role;
  const initialRole = ROLES.some((role) => role.value === requestedRole) ? requestedRole! : "DEVELOPER";
  const [step, setStep] = useState<"pick" | "form">(requestedRole && initialRole === requestedRole ? "form" : "pick");
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep("form");
  };

  if (step === "pick") {
    return <RolePickerStep onSelect={handleRoleSelect} />;
  }

  return (
    <SignupFormStep
      initialRole={selectedRole}
      onBack={() => setStep("pick")}
    />
  );
}
