/**
 * Admin Settings Page — Profile, Application, and Notification settings.
 * Saves to local state for now. Replace with FastAPI PATCH /api/v1/settings when DB is ready.
 */
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface AppSettings {
  theme: "dark" | "light";
  language: string;
  timezone: string;
  aiSuggestionsEnabled: boolean;
  weeklyReportEnabled: boolean;
}

interface NotifSettings {
  emailAlerts: boolean;
  taskAssigned: boolean;
  projectUpdates: boolean;
  riskAlerts: boolean;
  weeklyDigest: boolean;
}

const TIMEZONES = [
  "UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6 space-y-5">
      <div className="border-b border-surface-700/50 pb-4">
        <h3 className="text-surface-50 font-semibold text-base">{title}</h3>
        <p className="text-surface-400 text-sm mt-0.5">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ id, label, description, checked, onChange }: {
  id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-surface-200 text-sm font-medium">{label}</p>
        {description && <p className="text-surface-500 text-xs mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/60 ${
          checked ? "bg-primary-600" : "bg-surface-600"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { profile } = useAuth();

  // Profile settings (local state — no persistence yet)
  const [profileForm, setProfileForm] = useState({
    full_name:  profile?.full_name ?? "",
    email:      profile?.email ?? "",
    avatar_url: profile?.avatar_url ?? "",
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // App settings
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme:                "dark",
    language:             "en",
    timezone:             "UTC",
    aiSuggestionsEnabled: true,
    weeklyReportEnabled:  true,
  });
  const [appSaved, setAppSaved] = useState(false);

  // Notification settings
  const [notifSettings, setNotifSettings] = useState<NotifSettings>({
    emailAlerts:    true,
    taskAssigned:   true,
    projectUpdates: true,
    riskAlerts:     true,
    weeklyDigest:   false,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const showSaved = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 2500);
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with FastAPI call → PATCH /api/v1/settings (profile section)
    showSaved(setProfileSaved);
  };

  const handleAppSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with FastAPI call → PATCH /api/v1/settings
    showSaved(setAppSaved);
  };

  const handleNotifSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with FastAPI call → PATCH /api/v1/settings
    showSaved(setNotifSaved);
  };

  const initials = profileForm.full_name
    ? profileForm.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Settings</h2>
          <p className="text-surface-400 text-sm mt-1">Manage your profile, app preferences, and notifications</p>
        </div>
        <span className="badge-admin">Admin Panel</span>
      </div>

      {/* Profile Settings */}
      <Section title="Profile Settings" description="Update your display name, email, and avatar.">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {initials}
            </div>
            <div className="flex-1">
              <p className="text-surface-200 text-sm font-medium">{profile?.role ?? "ADMIN"}</p>
              <p className="text-surface-500 text-xs mt-0.5">Your role is managed by the system administrator</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label" htmlFor="settings-name">Full Name</label>
              <input id="settings-name" className="input w-full" placeholder="Your full name"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
            </div>
            <div>
              <label className="input-label" htmlFor="settings-email">Email Address</label>
              <input id="settings-email" className="input w-full" type="email" placeholder="you@example.com"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="settings-avatar">Avatar URL (optional)</label>
            <input id="settings-avatar" className="input w-full" placeholder="https://…/avatar.png"
              value={profileForm.avatar_url ?? ""}
              onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="btn-primary text-sm py-2 px-5" id="profile-save-btn">
              Save Profile
            </button>
            {profileSaved && <span className="text-success-400 text-sm animate-fade-in">✓ Saved successfully</span>}
          </div>
        </form>
      </Section>

      {/* Application Settings */}
      <Section title="Application Settings" description="Customize your workspace preferences.">
        <form onSubmit={handleAppSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label" htmlFor="settings-theme">Theme</label>
              <select id="settings-theme" className="input w-full"
                value={appSettings.theme}
                onChange={(e) => setAppSettings({ ...appSettings, theme: e.target.value as "dark" | "light" })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="settings-lang">Language</label>
              <select id="settings-lang" className="input w-full"
                value={appSettings.language}
                onChange={(e) => setAppSettings({ ...appSettings, language: e.target.value })}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="settings-tz">Timezone</label>
              <select id="settings-tz" className="input w-full"
                value={appSettings.timezone}
                onChange={(e) => setAppSettings({ ...appSettings, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <Toggle
              id="toggle-ai"
              label="AI Suggestions"
              description="Show AI-powered workflow recommendations and insights"
              checked={appSettings.aiSuggestionsEnabled}
              onChange={(v) => setAppSettings({ ...appSettings, aiSuggestionsEnabled: v })}
            />
            <Toggle
              id="toggle-weekly"
              label="Weekly Report Generation"
              description="Automatically generate and send weekly platform reports"
              checked={appSettings.weeklyReportEnabled}
              onChange={(v) => setAppSettings({ ...appSettings, weeklyReportEnabled: v })}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="btn-primary text-sm py-2 px-5" id="app-settings-save-btn">
              Save Preferences
            </button>
            {appSaved && <span className="text-success-400 text-sm animate-fade-in">✓ Saved successfully</span>}
          </div>
        </form>
      </Section>

      {/* Notification Settings */}
      <Section title="Notification Settings" description="Control which notifications you receive.">
        <form onSubmit={handleNotifSave} className="space-y-3">
          <Toggle id="notif-email"   label="Email Alerts"     description="Receive important alerts via email"                     checked={notifSettings.emailAlerts}    onChange={(v) => setNotifSettings({ ...notifSettings, emailAlerts: v })} />
          <Toggle id="notif-task"    label="Task Assigned"    description="Get notified when a task is assigned to you"            checked={notifSettings.taskAssigned}   onChange={(v) => setNotifSettings({ ...notifSettings, taskAssigned: v })} />
          <Toggle id="notif-project" label="Project Updates"  description="Receive updates when projects are created or modified"  checked={notifSettings.projectUpdates} onChange={(v) => setNotifSettings({ ...notifSettings, projectUpdates: v })} />
          <Toggle id="notif-risk"    label="Risk Alerts"      description="Get immediate alerts for Critical and High risks"       checked={notifSettings.riskAlerts}     onChange={(v) => setNotifSettings({ ...notifSettings, riskAlerts: v })} />
          <Toggle id="notif-digest"  label="Weekly Digest"    description="Receive a weekly summary of platform activity"         checked={notifSettings.weeklyDigest}   onChange={(v) => setNotifSettings({ ...notifSettings, weeklyDigest: v })} />

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn-primary text-sm py-2 px-5" id="notif-save-btn">
              Save Notifications
            </button>
            {notifSaved && <span className="text-success-400 text-sm animate-fade-in">✓ Saved successfully</span>}
          </div>
        </form>
      </Section>

      {/* Danger Zone */}
      <div className="glass-card p-6 border-danger-500/20">
        <h3 className="text-danger-400 font-semibold text-base mb-1">Danger Zone</h3>
        <p className="text-surface-400 text-sm mb-4">These actions are irreversible. Proceed with caution.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="btn-danger text-sm py-2 px-4" id="reset-settings-btn">
            Reset All Settings to Default
          </button>
        </div>
        <p className="text-surface-600 text-xs mt-3">
          Note: Database-level actions will be enabled once the backend is connected.
        </p>
      </div>
    </div>
  );
}
