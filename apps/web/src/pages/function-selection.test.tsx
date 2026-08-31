import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FunctionSelectionPage } from './function-selection';
import * as api from '@/lib/api/builder';

// Mock the API calls
vi.mock('@/lib/api/builder', () => ({
  fetchFunctions: vi.fn(),
}));

describe('FunctionSelectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    // Return a promise that never resolves to keep it in loading state
    vi.mocked(api.fetchFunctions).mockReturnValue(new Promise(() => {}));
    
    render(
      <MemoryRouter>
        <FunctionSelectionPage />
      </MemoryRouter>
    );
    
    // Check if the loading spinner SVG is in the document
    expect(document.querySelector('svg.animate-spin')).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(api.fetchFunctions).mockRejectedValue(new Error('Network Error'));
    
    render(
      <MemoryRouter>
        <FunctionSelectionPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load functions')).toBeInTheDocument();
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });

  it('renders list of functions successfully', async () => {
    const mockFunctions = [
      { code: 'f1', label: 'Function 1', description: 'Desc 1' },
      { code: 'f2', label: 'Function 2', description: 'Desc 2' },
    ];
    vi.mocked(api.fetchFunctions).mockResolvedValue(mockFunctions);
    
    render(
      <MemoryRouter>
        <FunctionSelectionPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Select Your Role')).toBeInTheDocument();
      expect(screen.getByText('Function 1')).toBeInTheDocument();
      expect(screen.getByText('Desc 1')).toBeInTheDocument();
      expect(screen.getByText('Function 2')).toBeInTheDocument();
      expect(screen.getByText('Desc 2')).toBeInTheDocument();
    });
  });

  it('navigates to the builder when a function is clicked', async () => {
    const mockFunctions = [
      { code: 'f1', label: 'Function 1', description: 'Desc 1' },
    ];
    vi.mocked(api.fetchFunctions).mockResolvedValue(mockFunctions);
    
    render(
      <MemoryRouter initialEntries={['/functions']}>
        <Routes>
          <Route path="/functions" element={<FunctionSelectionPage />} />
          <Route path="/builder/:code" element={<div data-testid="builder-mock" />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Function 1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Function 1'));
    
    await waitFor(() => {
      expect(screen.getByTestId('builder-mock')).toBeInTheDocument();
    });
  });
});
