import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserMenu } from '@/components/user-menu';
import { Loader2, FileText, CheckCircle2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProfileData {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  is_recruiter: boolean;
  resume?: string;
  roles?: { code: string; label: string; resume?: string }[];
  claims: {
    activity_code: string;
    activity_label: string;
    proficiency: number | null;
    category?: string;
    category_sort_order?: number;
    role_code?: string;
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

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone_number: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);


  const [activeRoleCode, setActiveRoleCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          navigate('/login');
          return;
        }
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/v1/profile/', {
          headers: { 'bypass-tunnel-reminder': 'true', 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setProfile(data);
        if (data.roles && data.roles.length > 0) {
          setActiveRoleCode(data.roles[0].code);
        }
        setEditForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone_number: data.phone_number || '',
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);


  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSaveError(null);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/v1/auth/user/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true', 'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, ...data } : null);
      setIsEditing(false);
      
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        localStorage.setItem('user', JSON.stringify({ ...user, ...data }));
      }
    } catch (err: any) {
      setSaveError(err.message || 'Unable to save your profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

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
            
            <div className="flex-1 w-full sm:w-auto">
              {isEditing ? (
                <div className="space-y-3 mt-2 w-full max-w-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      className="px-3 py-2 border rounded-md text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white w-full"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                    />
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      className="px-3 py-2 border rounded-md text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white w-full"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Phone Number" 
                    className="w-full px-3 py-2 border rounded-md text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({...editForm, phone_number: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={savingProfile} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
                      {savingProfile ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={savingProfile} className="px-3 py-1.5 bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700">
                      Cancel
                    </button>
                  </div>
                  {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {profile.first_name ? `${profile.first_name} ${profile.last_name}` : 'Your Profile'}
                    </h1>
                    <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded font-medium">
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{profile.email}</p>
                  {profile.phone_number && <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm font-medium">📞 {profile.phone_number}</p>}
                </>
              )}
              {!isEditing && profile.is_recruiter && (

                <Badge className="mt-3 bg-blue-100 text-blue-700 hover:bg-blue-100">Recruiter Account</Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-3 w-full sm:w-auto">
            {activeRoleCode ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={() => navigate(`/functions?role=${activeRoleCode}`)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Upload Resume (AI)
                </button>
                <button
                  onClick={() => navigate(`/builder/${activeRoleCode}?reset=true`)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                  Edit Skills
                </button>
                <button
                  onClick={() => navigate('/functions')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                  + Add Role
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/functions')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Add Skills
              </button>
            )}
            
            {(() => {
              const activeRole = profile.roles?.find(r => r.code === activeRoleCode);
              const currentResumeUrl = activeRole?.resume || profile.resume;
              const currentResume = currentResumeUrl 
                ? (currentResumeUrl.startsWith('http') ? currentResumeUrl : `${import.meta.env.VITE_API_URL || ''}${currentResumeUrl}`) 
                : undefined;
              
              if (!currentResume) return null;
              
              return (
                <button 
                  onClick={async () => {
                    try {
                      // Fetch as blob to pass auth token and bypass headers to the proxy view
                      const token = localStorage.getItem('access_token');
                      const response = await fetch(currentResume, { 
                        method: 'GET',
                        headers: {
                          'bypass-tunnel-reminder': 'true',
                          ...(token && token !== 'null' && token !== 'undefined' ? { Authorization: `Bearer ${token}` } : {})
                        }
                      });
                      if (!response.ok) throw new Error("Failed to download");
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = "resume.pdf";
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (err) {
                      alert("Failed to download resume.");
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-zinc-400" />
                  Download Resume
                </button>
              );
            })()}
          </div>
        </div>

        {/* Global Claims */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Verified Skills Summary
            </h2>
            {profile.roles && profile.roles.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                {profile.roles.map(role => (
                  <button
                    key={role.code}
                    onClick={() => setActiveRoleCode(role.code)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeRoleCode === role.code ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {profile.claims.filter(claim => !activeRoleCode || claim.role_code === activeRoleCode).length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <p className="text-zinc-500 dark:text-zinc-400">You haven't added any skills yet for this role.</p>
              <button
                onClick={() => navigate(activeRoleCode ? `/builder/${activeRoleCode}?reset=true` : '/functions')}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Go to Builder &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.values(
                profile.claims
                  .filter(claim => !activeRoleCode || claim.role_code === activeRoleCode)
                  .reduce((acc, claim) => {
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
