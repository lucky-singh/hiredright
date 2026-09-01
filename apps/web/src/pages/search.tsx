import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFunctions } from '../lib/api/builder';
import { getSkills, searchCandidates, type SearchResult } from '../lib/api/search';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { UserMenu } from '../components/user-menu';
import { CompareModal } from '../components/compare-modal';

type SkillState = 'off' | 'required' | 'optional';

export function SearchPage() {
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [skillStates, setSkillStates] = useState<Record<string, SkillState>>({});
  
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<number>>(new Set());
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  
  const toggleProfileSelection = (id: number) => {
    const next = new Set(selectedProfileIds);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 3) {
      next.add(id);
    }
    setSelectedProfileIds(next);
  };
  
  const compareTop3 = () => {
    if (!searchResults) return;
    const top3 = searchResults.results.slice(0, 3).map(r => r.profile_id);
    setSelectedProfileIds(new Set(top3));
    setIsCompareModalOpen(true);
  };
  

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

  const { data: searchResults, isFetching: searchLoading, error: searchError } = useQuery({
    queryKey: ['search', requiredCodes, optionalCodes],
    queryFn: () => searchCandidates({
      required_activity_codes: requiredCodes,
      optional_activity_codes: optionalCodes,
      required_variants: {}, // simplified for now
      limit: 100,
      include_near_misses: true,
    }),
    enabled: requiredCodes.length > 0 || optionalCodes.length > 0,
    retry: false, // Don't retry on 403s
  });

  const groupedSkills = useMemo(() => {
    if (!skillsData?.results) return {};
    const groups: Record<string, typeof skillsData.results> = {};
    const groupSortOrders: Record<string, number> = {};
    
    skillsData.results.forEach(skill => {
      let groupName = 'Other Skills';
      let sortOrder = 9999;
      
      if (skill.areas && skill.areas.length > 0) {
        const relevantArea = selectedFunction 
          ? skill.areas.find(a => a.function_code === selectedFunction) || skill.areas[0]
          : skill.areas[0];
        groupName = selectedFunction 
          ? relevantArea.label 
          : `${relevantArea.function_label}: ${relevantArea.label}`;
        sortOrder = relevantArea.sort_order;
      }
      
      if (!groups[groupName]) {
        groups[groupName] = [];
        groupSortOrders[groupName] = sortOrder;
      }
      groups[groupName].push(skill);
    });
    
    // Sort groups by their API sort_order (same as candidate builder)
    return Object.keys(groups)
      .sort((a, b) => groupSortOrders[a] - groupSortOrders[b])
      .reduce((acc, key) => {
        acc[key] = groups[key];
        return acc;
      }, {} as typeof groups);
  }, [skillsData, selectedFunction]);

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
    <div className="h-screen bg-zinc-50 dark:bg-zinc-950 flex justify-center py-8 px-4 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100 overflow-hidden relative">
      <UserMenu />
      <div className="w-full max-w-7xl flex gap-8 h-full min-h-0">
        {/* Sidebar: Skills Selection */}
        <div className="w-1/3 flex flex-col gap-4 h-full min-w-0 min-h-0">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 shrink-0 mb-2">Candidate Search</h1>
          
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
                <option value="">All Roles</option>
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

              <div className="flex flex-col gap-6 mt-2">
                {skillsLoading ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading skills...
                  </div>
                ) : Object.keys(groupedSkills).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No skills found.</div>
                ) : (
                  Object.entries(groupedSkills).map(([groupName, groupSkills]) => (
                    <div key={groupName} className="space-y-3">
                      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-1 mb-2">{groupName}</h3>
                      <div className="flex flex-wrap gap-2">
                        {groupSkills.map(skill => {
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
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Results */}
        <div className="w-2/3 flex flex-col gap-4 h-full min-w-0 min-h-0">
          <div className="shrink-0 flex flex-col gap-2 mb-2">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Candidate Matches</h2>
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Found {searchResults?.count || 0} candidates
              </div>
            </div>
            {searchResults && searchResults.results.length > 0 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsCompareModalOpen(true)}
                  disabled={selectedProfileIds.size < 2}
                  className="px-3 py-1.5 text-sm rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5 shadow-sm"
                >
                  Compare Selected ({selectedProfileIds.size}/3)
                </button>
                <button 
                  onClick={compareTop3}
                  className="px-3 py-1.5 text-sm rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium shadow-sm"
                >
                  Compare Top 3
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 pl-2 pr-4 pt-2 space-y-4 pb-6 custom-scrollbar -ml-2">
            {searchError ? (
              <Card className="bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 shadow-none">
                <CardContent className="p-8 text-center text-red-600 dark:text-red-400 flex flex-col items-center justify-center">
                  <div className="mb-3 text-red-500/50">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Search Access Denied</h3>
                  <p className="max-w-md">You do not have permission to search the candidate pool. The active user account must have the <code className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded mx-1">is_recruiter=True</code> permission.</p>
                </CardContent>
              </Card>
            ) : requiredCodes.length === 0 && optionalCodes.length === 0 ? (
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
                      <div className="flex items-center gap-3">
                        <label className="flex items-center cursor-pointer" title="Compare this candidate">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedProfileIds.has(result.profile_id)}
                            onChange={() => toggleProfileSelection(result.profile_id)}
                            disabled={!selectedProfileIds.has(result.profile_id) && selectedProfileIds.size >= 3}
                          />
                        </label>
                        <CardTitle className="text-lg">Candidate Profile #{result.profile_id}</CardTitle>
                      </div>
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
                              <span key={m.code} className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-700 dark:text-zinc-300">{m.label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.missing_required.length > 0 && (
                        <div>
                          <span className="font-semibold text-red-600 dark:text-red-400 block mb-1">✗ Missing Required</span>
                          <div className="flex flex-wrap gap-1">
                            {result.missing_required.map(m => (
                              <span key={m.code} className="bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50">{m.label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.matched_optional.length > 0 && (
                        <div>
                          <span className="font-semibold text-blue-600 dark:text-blue-400 block mb-1">+ Matched Optional</span>
                          <div className="flex flex-wrap gap-1">
                            {result.matched_optional.map(m => (
                              <span key={m.code} className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">{m.label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.other_skills && result.other_skills.length > 0 && (
                        <details className="mt-2 group">
                          <summary className="text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 list-none inline-flex items-center gap-1 transition-colors">
                            <span className="group-open:hidden opacity-70">▶</span>
                            <span className="hidden group-open:inline opacity-70">▼</span>
                            View {result.other_skills.length} other skills
                          </summary>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.other_skills.map(m => (
                              <span key={m.code} className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">{m.label}</span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      
      {isCompareModalOpen && searchResults && (
        <CompareModal
          candidates={searchResults.results.filter(r => selectedProfileIds.has(r.profile_id))}
          onClose={() => setIsCompareModalOpen(false)}
        />
      )}
    </div>
  );
}
