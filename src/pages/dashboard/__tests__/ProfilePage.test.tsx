import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "../ProfilePage";
import { useAuth } from "../../../context/AuthContext";
import { updateProfile } from "../../../services/profileService";

// Mock the modules
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../../../services/profileService", () => ({
  updateProfile: vi.fn(),
}));

describe("ProfilePage", () => {
  const mockUser = { id: "user-123" };
  const mockProfile = {
    id: "profile-123",
    full_name: "Test User",
    email: "test@example.com",
    role: "DEVELOPER",
    skills: [{ name: "React", level: "Expert" }],
    experience_years: 5,
    capacity_hours_per_week: 35,
    is_active: true,
  };
  const mockRefreshProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      refreshProfile: mockRefreshProfile,
    });
  });

  it("renders profile data correctly", () => {
    render(<ProfilePage />);
    // "Test User" appears in both the heading and the read-only field; check at least one instance
    expect(screen.getAllByText("Test User").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("test@example.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
    expect(screen.getByText(/5 years/)).toBeInTheDocument();
    expect(screen.getByText(/35 hours/)).toBeInTheDocument();
  });

  it("allows editing and saving profile data", async () => {
    (updateProfile as any).mockResolvedValue({});
    
    render(<ProfilePage />);
    
    // Click edit
    fireEvent.click(screen.getByText("Edit profile"));
    
    // Check if inputs are rendered
    const nameInput = screen.getByDisplayValue("Test User");
    const expInput = screen.getByDisplayValue("5");
    const capInput = screen.getByDisplayValue("35");
    
    // Change values
    fireEvent.change(nameInput, { target: { value: "Updated User" } });
    fireEvent.change(expInput, { target: { value: "6" } });
    fireEvent.change(capInput, { target: { value: "40" } });
    
    // Add skill
    fireEvent.click(screen.getByText("Add Skill"));
    
    // Save
    fireEvent.click(screen.getByText("Save changes"));
    
    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith("user-123", expect.objectContaining({
        full_name: "Updated User",
        experience_years: 6,
        capacity_hours_per_week: 40,
        skills: expect.any(Array),
      }));
      expect(mockRefreshProfile).toHaveBeenCalled();
      expect(screen.getByText("Profile updated successfully")).toBeInTheDocument();
    });
  });

  it("validates empty name input", () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByText("Edit profile"));
    
    const nameInput = screen.getByDisplayValue("Test User");
    fireEvent.change(nameInput, { target: { value: "   " } });
    
    expect(screen.getByText("Save changes")).toBeDisabled();
  });
});
