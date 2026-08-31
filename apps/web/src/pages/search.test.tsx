import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchPage } from './search';
import * as builderApi from '../lib/api/builder';
import * as searchApi from '../lib/api/search';

vi.mock('../lib/api/builder', () => ({
  fetchFunctions: vi.fn(),
}));

vi.mock('../lib/api/search', () => ({
  getSkills: vi.fn(),
  searchCandidates: vi.fn(),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search dashboard successfully', async () => {
    vi.mocked(builderApi.fetchFunctions).mockResolvedValue([
      { code: 'f1', label: 'Function 1', description: 'Desc 1' }
    ]);
    
    vi.mocked(searchApi.getSkills).mockResolvedValue({
      count: 0,
      results: []
    });
    
    vi.mocked(searchApi.searchCandidates).mockResolvedValue({
      count: 0,
      results: []
    });

    const client = createTestQueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SearchPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Recruiter Search')).toBeInTheDocument();
      expect(screen.getByText('Candidate Matches')).toBeInTheDocument();
      expect(screen.getByText('No skills selected')).toBeInTheDocument();
    });
  });
});
