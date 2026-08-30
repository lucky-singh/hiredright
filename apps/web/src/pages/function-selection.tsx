import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFunctions } from '@/lib/api/builder';
import type { JobFunction } from '@/lib/api/types';
import { Loader2 } from 'lucide-react';

export function FunctionSelectionPage() {
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFunctions()
      .then((data) => {
        setFunctions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center text-red-600 p-4 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200">
          <p className="font-semibold">Failed to load functions</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Select Your Role
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Choose the function you want to build your profile for.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {functions.map((func) => (
            <button
              key={func.code}
              onClick={() => navigate(`/builder/${func.code}`)}
              className="relative rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-blue-500 hover:ring-1 hover:ring-blue-500 focus:outline-none transition-all text-left"
            >
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  {func.label}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                  {func.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
