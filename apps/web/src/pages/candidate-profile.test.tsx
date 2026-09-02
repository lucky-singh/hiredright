import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CandidateProfilePage } from './candidate-profile';

// Mock matchMedia to prevent Jest/Vitest errors with some components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('CandidateProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('access_token', 'fake-token');
  });

  it('hides role tabs when user has only 1 role', async () => {
    // Mock fetch to return a profile with exactly 1 role
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        is_recruiter: false,
        roles: [{ code: 'r1', label: 'Role 1' }],
        claims: []
      })
    });

    render(
      <MemoryRouter>
        <CandidateProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // The profile should render
      expect(screen.getByText('Verified Skills Summary')).toBeInTheDocument();
      // But the role tab for "Role 1" should NOT be rendered since it's the only one
      // The horizontal scroll container maps over roles and renders buttons with the role label.
      // But wait, the title might say "You haven't added any skills yet for this role."
    });

    // The tab button specifically should not be there (we check by seeing if multiple tabs exist)
    const role1Buttons = screen.queryAllByRole('button', { name: 'Role 1' });
    expect(role1Buttons.length).toBe(0);
  });

  it('shows role tabs when user has multiple roles', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        is_recruiter: false,
        roles: [
          { code: 'r1', label: 'Role 1' },
          { code: 'r2', label: 'Role 2' }
        ],
        claims: []
      })
    });

    render(
      <MemoryRouter>
        <CandidateProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Verified Skills Summary')).toBeInTheDocument();
    });

    // Both tabs should be visible
    expect(screen.getByRole('button', { name: 'Role 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Role 2' })).toBeInTheDocument();
  });
});
