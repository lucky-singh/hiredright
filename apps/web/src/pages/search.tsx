import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFunctions } from '../lib/api/builder';
import { getSkills, searchCandidates, type SearchResult } from '../lib/api/search';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Search, Loader2 } from 'lucide-react';

type SkillState = 'off' | 'required' | 'optional';

export function SearchPage() {
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [skillStates, setSkillStates] = useState<Record<string, SkillState>>({});

  const { data: functions } = useQuery({
    queryKey: ['functions'],
    queryFn: fetchFunctions,
  });

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['skills', selectedFunction, searchQuery],
    queryFn: () => getSkills(selectedFunction, searchQuery),
  });

  const requiredCodes = Object.entries(skillStates)
    .filter(([_, state]) => state === 'required')
    .map(([code]) => code);
    
  const optionalCodes = Object.entries(skillStates)
    .filter(([_, state]) => state === 'optional')
    .map(([code]) => code);

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search', requiredCodes, optionalCodes],
    queryFn: () => searchCandidates({
      required_activity_codes: requiredCodes,
      optional_activity_codes: optionalCodes,
      required_variants: {}, // simplified for now
      limit: 50,
      include_near_misses: true,
    }),
    enabled: requiredCodes.length > 0 || optionalCodes.length > 0,
  });

  const cycleSkillState = (code: string) => {
    setSkillStates(prev => {
      const currentState = prev[code] || 'off';
      let nextState: SkillState = 'off';
      
      if (currentState === 'off') nextState = 'required';
      else if (currentState === 'required') nextState = 'optional';
      else if (currentState === 'optional') nextState = 'off';
      
      return { ...prev, [code]: nextState };
    });
  };

  return (
    <div className="h-screen bg-zinc-50 dark:bg-zinc-950 flex justify-center py-8 px-4 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <div className="w-full max-w-7xl flex gap-8 h-full min-h-0">
        {/* Sidebar: Skills Selection */}
        <div className="w-1/3 flex flex-col gap-4 h-full min-w-0 min-h-0">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 shrink-0 mb-2">Recruiter Search</h1>
          
          <Card className="flex flex-col min-h-0 flex-1 border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <CardHeader className="shrink-0 border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
              <CardTitle>Skills & Requirements</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 overflow-y-auto min-h-0 pt-4 pb-6 custom-scrollbar px-6">
              <select 
                className="flex h-9 w-full shrink-0 truncate rounded-md border border-input bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedFunction} 
                onChange={e => setSelectedFunction(e.target.value)}
              >
                <option value="">All Functions</option>
                {functions?.map(f => (
                  <option key={f.code} value={f.code}>{f.label}</option>
                ))}
              </select>
              
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search skills..."
                  className="pl-8 bg-white dark:bg-zinc-900"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {skillsLoading ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading skills...
                  </div>
                ) : (
                  skillsData?.results?.map(skill => {
                    const state = skillStates[skill.code] || 'off';
                    
                    let stateClasses = '';
                    if (state === 'off') {
                      stateClasses = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400';
                    } else if (state === 'required') {
                      stateClasses = 'bg-blue-600 border-blue-600 text-white shadow-sm ring-2 ring-blue-600/20';
                    } else if (state === 'optional') {
                      stateClasses = 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 border-dashed';
                    }
                    
                    return (
                      <button
                        key={skill.code}
                        onClick={() => cycleSkillState(skill.code)}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-all focus:outline-none ${stateClasses}`}
                      >
                        {skill.label}
                        {state === 'required' && <span className="ml-1.5 text-xs opacity-80 font-bold tracking-wider uppercase">Req</span>}
                        {state === 'optional' && <span className="ml-1.5 text-xs opacity-80 font-bold tracking-wider uppercase">Opt</span>}
                      </button>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Results */}
        <div className="w-2/3 flex flex-col gap-4 h-full min-w-0 min-h-0">
          <div className="shrink-0 flex items-end justify-between mb-2">
            <h2 className="text-2xl font-bold tracking-tight">Candidate Matches</h2>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Found {searchResults?.count || 0} candidates
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 pl-2 pr-4 pt-2 space-y-4 pb-6 custom-scrollbar -ml-2">
            {requiredCodes.length === 0 && optionalCodes.length === 0 ? (
              <Card className="bg-white/50 dark:bg-zinc-900/50 border-dashed border-2 shadow-none">
                <CardContent className="p-16 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center">
                  <Search className="h-10 w-10 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No skills selected</p>
                  <p className="text-sm mt-1">Select skills from the left to begin searching candidates.</p>
                </CardContent>
              </Card>
            ) : searchLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              searchResults?.results?.map((result: SearchResult) => (
                <Card key={result.profile_id} className={`transition-all ${result.meets_requirements ? 'border-green-500/30 dark:border-green-500/20 shadow-sm' : 'border-zinc-200 dark:border-zinc-800 opacity-80'}`}>
                  <CardHeader className="pb-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Candidate Profile #{result.profile_id}</CardTitle>
                      <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${result.meets_requirements ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        {result.score_pct}% Match
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="text-sm space-y-3">
                      {result.matched_required.length > 0 && (
                        <div>
                          <span className="font-semibold text-green-700 dark:text-green-400 block mb-1">✓ Matched Required</span>
                          <div className="flex flex-wrap gap-1">
                            {result.matched_required.map(m => (
                              <span key={m} className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-700 dark:text-zinc-300">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.missing_required.length > 0 && (
                        <div>
                          <span className="font-semibold text-red-600 dark:text-red-400 block mb-1">✗ Missing Required</span>
                          <div className="flex flex-wrap gap-1">
                            {result.missing_required.map(m => (
                              <span key={m} className="bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.matched_optional.length > 0 && (
                        <div>
                          <span className="font-semibold text-blue-600 dark:text-blue-400 block mb-1">+ Matched Optional</span>
                          <div className="flex flex-wrap gap-1">
                            {result.matched_optional.map(m => (
                              <span key={m} className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
