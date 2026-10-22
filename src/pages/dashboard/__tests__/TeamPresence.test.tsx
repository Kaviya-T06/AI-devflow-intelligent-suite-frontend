import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import StatusDot from "../../../components/presence/StatusDot";
import StatusBadge from "../../../components/presence/StatusBadge";
import StatusSelector from "../../../components/presence/StatusSelector";
import TeamPresencePage from "../TeamPresencePage";
import * as presenceService from "../../../services/presenceService";
import * as AuthContextModule from "../../../context/AuthContext";
import type { PresenceData, TeamPresenceResponse } from "../../../types";

const mockPresence: PresenceData = {
  user_id: "user-1",
  user_name: "Alex Dev",
  user_email: "alex@example.com",
  user_role: "developer",
  availability_status: "available",
  status_message: "Coding presence feature",
  status_expires_at: null,
  last_seen_at: new Date().toISOString(),
  is_online: true,
  effective_status: "available",
  updated_at: new Date().toISOString(),
};

const mockTeamResponse: TeamPresenceResponse = {
  users: [
    mockPresence,
    {
      user_id: "user-2",
      user_name: "Sarah PM",
      user_email: "sarah@example.com",
      user_role: "project_manager",
      availability_status: "busy",
      status_message: "In client meeting",
      status_expires_at: null,
      last_seen_at: new Date().toISOString(),
      is_online: true,
      effective_status: "busy",
      updated_at: new Date().toISOString(),
    },
    {
      user_id: "user-3",
      user_name: "Charlie DND",
      user_email: "charlie@example.com",
      user_role: "developer",
      availability_status: "do_not_disturb",
      status_message: "Sprint crunch",
      status_expires_at: null,
      last_seen_at: new Date().toISOString(),
      is_online: true,
      effective_status: "do_not_disturb",
      updated_at: new Date().toISOString(),
    },
    {
      user_id: "user-4",
      user_name: "Dana Offline",
      user_email: "dana@example.com",
      user_role: "developer",
      availability_status: "available",
      status_message: null,
      status_expires_at: null,
      last_seen_at: new Date(Date.now() - 3600000).toISOString(),
      is_online: false,
      effective_status: "offline",
      updated_at: new Date().toISOString(),
    },
  ],
  total: 4,
  online_count: 3,
  available_count: 1,
  busy_count: 2,
};

describe("User Presence & Availability Components", () => {
  describe("StatusDot", () => {
    it("renders green dot for available", () => {
      const { container } = render(<StatusDot status="available" />);
      const dot = container.querySelector("span");
      expect(dot).toHaveClass("bg-green-500");
    });

    it("renders yellow dot for busy", () => {
      const { container } = render(<StatusDot status="busy" />);
      const dot = container.querySelector("span");
      expect(dot).toHaveClass("bg-yellow-500");
    });

    it("renders purple dot for do_not_disturb", () => {
      const { container } = render(<StatusDot status="do_not_disturb" />);
      const dot = container.querySelector("span");
      expect(dot).toHaveClass("bg-purple-500");
    });

    it("renders gray dot for away", () => {
      const { container } = render(<StatusDot status="away" />);
      const dot = container.querySelector("span");
      expect(dot).toHaveClass("bg-slate-400");
    });

    it("renders dark gray dot for offline", () => {
      const { container } = render(<StatusDot status="offline" />);
      const dot = container.querySelector("span");
      expect(dot).toHaveClass("bg-slate-600");
    });
  });

  describe("StatusBadge", () => {
    it("renders label and dot for available", () => {
      render(<StatusBadge status="available" />);
      expect(screen.getByText("Available")).toBeInTheDocument();
    });

    it("renders label for busy", () => {
      render(<StatusBadge status="busy" />);
      expect(screen.getByText("Busy")).toBeInTheDocument();
    });

    it("renders label for do_not_disturb", () => {
      render(<StatusBadge status="do_not_disturb" />);
      expect(screen.getByText("Do Not Disturb")).toBeInTheDocument();
    });
  });

  describe("StatusSelector", () => {
    it("opens dropdown and allows changing status", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const onClear = vi.fn().mockResolvedValue(undefined);

      render(
        <StatusSelector
          myPresence={mockPresence}
          onUpdate={onUpdate}
          onClear={onClear}
        />
      );

      // Initially shows trigger
      const trigger = screen.getByRole("button", { name: /change your status/i });
      expect(trigger).toBeInTheDocument();

      // Open dropdown
      fireEvent.click(trigger);
      expect(screen.getByText("Set Status")).toBeInTheDocument();

      // Click "Busy"
      const busyBtn = screen.getByRole("button", { name: /^busy$/i });
      fireEvent.click(busyBtn);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          availability_status: "busy",
        })
      );
    });

    it("allows adding custom status message and expiry", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const onClear = vi.fn().mockResolvedValue(undefined);

      render(
        <StatusSelector
          myPresence={mockPresence}
          onUpdate={onUpdate}
          onClear={onClear}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /change your status/i }));

      // Click customize message
      fireEvent.click(screen.getByText("+ Add message & expiry…"));
      expect(screen.getByPlaceholderText("What are you up to?")).toBeInTheDocument();

      // Type custom message
      const input = screen.getByPlaceholderText("What are you up to?");
      fireEvent.change(input, { target: { value: "Reviewing architecture" } });

      // Save
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            status_message: "Reviewing architecture",
          })
        );
      });
    });
  });

  describe("TeamPresencePage", () => {
    beforeEach(() => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: { id: "user-1", email: "alex@example.com", name: "Alex Dev", role: "developer" },
        profile: {
          id: "user-1",
          full_name: "Alex Dev",
          email: "alex@example.com",
          role: "ADMIN",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        token: "fake-jwt",
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
        refreshAuth: vi.fn(),
        refreshProfile: vi.fn().mockResolvedValue(undefined),
      });

      vi.spyOn(presenceService, "fetchTeamPresence").mockResolvedValue(mockTeamResponse);
    });

    it("renders team presence metrics and members", async () => {
      render(
        <MemoryRouter>
          <TeamPresencePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Team Presence")).toBeInTheDocument();
        expect(screen.getByText("Alex Dev")).toBeInTheDocument();
        expect(screen.getByText("Sarah PM")).toBeInTheDocument();
        expect(screen.getByText("Charlie DND")).toBeInTheDocument();
        expect(screen.getByText("Dana Offline")).toBeInTheDocument();
      });

      // Verify stats cards
      expect(screen.getByText("4")).toBeInTheDocument(); // Total Members
      expect(screen.getByText("3")).toBeInTheDocument(); // Online Now
    });

    it("filters members by search query", async () => {
      render(
        <MemoryRouter>
          <TeamPresencePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Sarah PM")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search name or email…");
      fireEvent.change(searchInput, { target: { value: "Sarah" } });

      await waitFor(() => {
        expect(presenceService.fetchTeamPresence).toHaveBeenCalledWith(
          expect.objectContaining({
            search: "Sarah",
          })
        );
      });
    });
  });
});
