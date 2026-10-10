/**
 * Profile page — view and update your own profile.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateProfile } from "../../services/profileService";
import type { UserRole } from "../../types";

const ROLE_LABELS: Record<UserRole, { label: string; cls: string; description: string }> = {
  ADMIN: {
    label: "Administrator",
    cls: "badge-admin",
    description: "Full platform access, user management, system configuration.",
  },
  MANAGER: {
    label: "Project Manager",
    cls: "badge-manager",
    description: "Project oversight, team metrics, delivery tracking.",
  },
  DEVELOPER: {
    label: "Developer",
    cls: "badge-developer",
    description: "Personal workflow, assigned tasks, contribution tracking.",
  },
  TEAM_MEMBER: {
    label: "Team Member",
    cls: "badge-developer",
    description: "Personal workflow, assigned tasks, contribution tracking.",
  },
};

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [skills, setSkills] = useState<{name: string; level: string}[]>(profile?.skills || []);
  const [experienceYears, setExperienceYears] = useState(profile?.experience_years || 0);
  const [capacityHours, setCapacityHours] = useState(profile?.capacity_hours_per_week || 40);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isEditing && profile) {
      setFullName(profile.full_name || "");
      setSkills(profile.skills || []);
      setExperienceYears(profile.experience_years || 0);
      setCapacityHours(profile.capacity_hours_per_week || 40);
    }
  }, [profile, isEditing]);

  const role = (profile?.role || "DEVELOPER") as UserRole;
  const roleInfo = ROLE_LABELS[role];

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleSave = async () => {
    if (!user || !fullName.trim()) return;
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      await updateProfile(user.id, { 
        full_name: fullName.trim(),
        skills,
        experience_years: experienceYears,
        capacity_hours_per_week: capacityHours
      });
      await refreshProfile();
      setSaveStatus("success");
      setIsEditing(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      setSaveStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || "");
    setSkills(profile?.skills || []);
    setExperienceYears(profile?.experience_years || 0);
    setCapacityHours(profile?.capacity_hours_per_week || 40);
    setIsEditing(false);
    setSaveStatus("idle");
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-50">My Profile</h2>
        <p className="text-surface-400 text-sm mt-1">Manage your personal information and view your access level.</p>
      </div>

      {/* ── Profile card ── */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-5 mb-6">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-xl shadow-glow shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-surface-50 truncate">
              {profile?.full_name || "—"}
            </h3>
            <p className="text-surface-400 text-sm truncate">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={roleInfo.cls}>{role}</span>
              {profile?.is_active && (
                <span className="badge bg-success-500/15 text-success-400 border border-success-500/20">Active</span>
              )}
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="input-label">Full Name</label>
            {isEditing ? (
              <input
                id="profile-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                autoFocus
                maxLength={100}
              />
            ) : (
              <p className="text-surface-200 py-3 px-4 bg-surface-800/40 rounded-lg border border-surface-700/30">
                {profile?.full_name || "—"}
              </p>
            )}
          </div>

          <div>
            <label className="input-label">Email Address</label>
            <p className="text-surface-400 py-3 px-4 bg-surface-800/20 rounded-lg border border-surface-700/20 text-sm">
              {profile?.email || user?.email || "—"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="experience-years" className="input-label">Years of Experience</label>
              {isEditing ? (
                <input
                  id="experience-years"
                  type="number"
                  min="0"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              ) : (
                <p className="text-surface-200 py-3 px-4 bg-surface-800/40 rounded-lg border border-surface-700/30">
                  {profile?.experience_years || 0} years
                </p>
              )}
            </div>
            <div>
              <label htmlFor="capacity-hours" className="input-label">Capacity (Hours/Week)</label>
              {isEditing ? (
                <input
                  id="capacity-hours"
                  type="number"
                  min="0"
                  max="168"
                  value={capacityHours}
                  onChange={(e) => setCapacityHours(parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              ) : (
                <p className="text-surface-200 py-3 px-4 bg-surface-800/40 rounded-lg border border-surface-700/30">
                  {profile?.capacity_hours_per_week || 40} hours
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="input-label">Technical Skills</label>
            {isEditing ? (
              <div className="space-y-3">
                {skills.map((skill, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={skill.name}
                      onChange={(e) => {
                        const newSkills = [...skills];
                        newSkills[i] = { ...newSkills[i], name: e.target.value };
                        setSkills(newSkills);
                      }}
                      className="input-field flex-1"
                      placeholder="e.g. React, Python"
                    />
                    <select
                      value={skill.level}
                      onChange={(e) => {
                        const newSkills = [...skills];
                        newSkills[i] = { ...newSkills[i], level: e.target.value };
                        setSkills(newSkills);
                      }}
                      className="input-field w-32"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Expert">Expert</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setSkills(skills.filter((_, idx) => idx !== i));
                      }}
                      className="text-danger-400 hover:text-danger-300 p-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSkills([...skills, { name: "", level: "Beginner" }])}
                  className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Skill
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile?.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill, i) => (
                    <span key={i} className="px-3 py-1 bg-surface-700/50 rounded-full text-sm border border-surface-600/30 flex items-center gap-2">
                      <span className="text-surface-200 font-medium">{skill.name}</span>
                      <span className="text-surface-500 text-xs">{skill.level}</span>
                    </span>
                  ))
                ) : (
                  <p className="text-surface-500 text-sm">No skills added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {isEditing ? (
            <div className="flex items-center gap-3 pt-2">
              <button
                id="profile-save"
                onClick={handleSave}
                disabled={isSaving || !fullName.trim()}
                className="btn-primary"
              >
                {isSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Saving…
                  </>
                ) : "Save changes"}
              </button>
              <button onClick={handleCancel} className="btn-secondary">Cancel</button>
            </div>
          ) : (
            <button id="profile-edit" onClick={() => setIsEditing(true)} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit profile
            </button>
          )}

          {/* Save status */}
          {saveStatus === "success" && (
            <p className="text-success-400 text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Profile updated successfully
            </p>
          )}
          {saveStatus === "error" && (
            <p className="text-danger-400 text-sm animate-fade-in">{errorMsg}</p>
          )}
        </div>
      </div>

      {/* ── Access level ── */}
      <div className="glass-card p-6">
        <h4 className="font-semibold text-surface-200 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Access Level
        </h4>
        <div className="flex items-start gap-4">
          <span className={roleInfo.cls + " text-sm px-3 py-1.5"}>{roleInfo.label}</span>
          <p className="text-surface-400 text-sm leading-relaxed">{roleInfo.description}</p>
        </div>
        <p className="text-surface-600 text-xs mt-4">
          Role changes must be performed by a platform Administrator.
        </p>
      </div>

      {/* ── Account metadata ── */}
      <div className="glass-card p-6">
        <h4 className="font-semibold text-surface-200 mb-4">Account Details</h4>
        <div className="space-y-3 text-sm">
          {[
            { label: "User ID", value: profile?.id || user?.id || "—", mono: true },
            { label: "Member since", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—" },
            { label: "Last updated", value: profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-2 border-b border-surface-700/30 last:border-0">
              <span className="text-surface-500">{row.label}</span>
              <span className={`text-surface-300 ${row.mono ? "font-mono text-xs" : ""} truncate max-w-xs`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
