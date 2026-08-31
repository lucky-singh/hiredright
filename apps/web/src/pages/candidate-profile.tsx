import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserMenu } from '@/components/user-menu';
import { Loader2, FileText, CheckCircle2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProfileData {
  email: string;
  first_name: string;
  last_name: string;
  is_recruiter: boolean;
  resume?: string;
  claims: {
    activity_code: string;
    activity_label: string;
    proficiency: number | null;
    category?: string;
    category_sort_order?: number;
    is_ai_inferred?: boolean;
    years_experience?: string | null;
    last_used_year?: number | null;
  }[];
}

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Exposure',
  2: 'Working',
  3: 'Proficient',
  4: 'Expert',
};

export function CandidateProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          navigate('/login');
          return;
        }
        const res = await fetch('/api/v1/profile/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center text-red-600 p-4 bg-red-50 dark:bg-red-950/20 rounded-md">
          <p className="font-semibold">Failed to load profile</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 relative">
      <UserMenu />
      
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 border-4 border-white dark:border-zinc-800 flex items-center justify-center text-blue-700 dark:text-blue-300 text-2xl font-bold shadow-sm">
              {profile.first_name 
                ? `${profile.first_name[0]}${profile.last_name ? profile.last_name[0] : ''}` 
                : profile.email.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {profile.first_name ? `${profile.first_name} ${profile.last_name}` : 'Your Profile'}
              </h1>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{profile.email}</p>
              {profile.is_recruiter && (
                <Badge className="mt-3 bg-blue-100 text-blue-700 hover:bg-blue-100">Recruiter Account</Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/functions')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              Edit Skills / Upload Resume
            </button>
            {profile.resume && (
              <a 
                href={profile.resume} 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Resume
              </a>
            )}
          </div>
        </div>

        {/* Global Claims */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-6">
            Verified Skills Summary
          </h2>
          
          {profile.claims.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <p className="text-zinc-500 dark:text-zinc-400">You haven't added any skills yet.</p>
              <button
                onClick={() => navigate('/functions')}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Go to Builder &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.values(
                profile.claims.reduce((acc, claim) => {
                  const cat = claim.category || 'General';
                  if (!acc[cat]) {
                    acc[cat] = {
                      category: cat,
                      sort_order: claim.category_sort_order ?? 999,
                      claims: []
                    };
                  }
                  acc[cat].claims.push(claim);
                  return acc;
                }, {} as Record<string, { category: string, sort_order: number, claims: typeof profile.claims }>)
              )
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(({ category, claims }) => (
                <div key={category} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{category}</h3>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {claims.map((claim, idx) => (
                      <li key={idx} className="p-4 sm:p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{claim.activity_label}</p>
                            {claim.is_ai_inferred && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 text-[10px] uppercase tracking-wider py-0 h-5">
                                <Bot className="w-3 h-3 mr-1 inline" /> AI Found
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {claim.years_experience && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {claim.years_experience} yrs
                            </span>
                          )}
                          {claim.last_used_year && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                              (Last: {claim.last_used_year})
                            </span>
                          )}
                          {claim.proficiency && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                              {PROFICIENCY_LABELS[claim.proficiency]}
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
