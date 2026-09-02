import { useState, useEffect } from 'react';
import { Bot, CheckCircle2, FileText, Search, User, ArrowRight, Upload, Loader2, PlayCircle, Briefcase, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const MOCK_PROFILE = {
  email: 'luckysingh223@gmail.com',
  first_name: 'Lucky',
  last_name: 'Singh',
  phone_number: '+1 234 567 8900',
  is_recruiter: false,
  roles: [
    { code: 'statistical-programmer', label: 'Statistical Programmer' },
  ],
  claims: [
    {
      activity_code: 'sas-prog',
      activity_label: 'SAS Programming',
      proficiency: 4,
      category: 'Programming Languages',
      category_sort_order: 1,
      role_code: 'statistical-programmer',
      is_ai_inferred: true,
      years_experience: '5',
      last_used_year: 2024,
    },
    {
      activity_code: 'r-prog',
      activity_label: 'R',
      proficiency: 3,
      category: 'Programming Languages',
      category_sort_order: 1,
      role_code: 'statistical-programmer',
      is_ai_inferred: true,
      years_experience: '3',
      last_used_year: 2024,
    },
    {
      activity_code: 'cdisc-sdtm',
      activity_label: 'CDISC SDTM/ADaM',
      proficiency: 4,
      category: 'Data Standards',
      category_sort_order: 2,
      role_code: 'statistical-programmer',
      is_ai_inferred: true,
      years_experience: '4',
      last_used_year: 2024,
    },
    {
      activity_code: 'clin-data',
      activity_label: 'Clinical Trial Data Management',
      proficiency: 3,
      category: 'Data Management',
      category_sort_order: 3,
      role_code: 'statistical-programmer',
      is_ai_inferred: false,
      years_experience: '4',
      last_used_year: 2023,
    }
  ]
};

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Exposure',
  2: 'Working',
  3: 'Proficient',
  4: 'Expert',
};

type DemoStep = 'intro' | 'upload' | 'processing' | 'review' | 'profile' | 'search';

export function DemoPage() {
  const [currentStep, setCurrentStep] = useState<DemoStep>('intro');
  const [activeRoleCode, setActiveRoleCode] = useState<string>('statistical-programmer');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const profile = MOCK_PROFILE;

  useEffect(() => {
    if (currentStep === 'processing') {
      const timer = setTimeout(() => {
        setCurrentStep('review');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'search' && searchQuery) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, currentStep]);

  const renderTutorialSidebar = () => {
    let title = '';
    let description = '';

    switch (currentStep) {
      case 'intro':
        title = 'Welcome to HiredRight';
        description = 'This interactive demo will walk you through the entire journey of the platform, from candidate onboarding to recruiter search.';
        break;
      case 'upload':
        title = '1. Resume Upload';
        description = 'Candidates start by uploading their standard PDF resume. Instead of manual data entry, our platform prepares to parse their experience instantly.';
        break;
      case 'processing':
        title = '2. AI Extraction';
        description = 'Our specialized AI model analyzes the resume, categorizes skills, and infers proficiencies based on the candidate\'s context and experience history.';
        break;
      case 'review':
        title = '3. Skills Builder';
        description = 'Candidates review the AI\'s findings. They can adjust proficiencies, add missing skills manually, and verify the data. The AI highlights exactly what it found automatically.';
        break;
      case 'profile':
        title = '4. The Final Profile';
        description = 'The result is a clean, standardized, and highly structured profile. This verified summary replaces the chaotic format of a traditional resume.';
        break;
      case 'search':
        title = '5. Recruiter Search';
        description = 'Recruiters can now search for candidates based on actual verified skills and precise proficiencies, rather than relying on flawed keyword matching.';
        break;
    }

    const steps: { id: DemoStep; label: string }[] = [
      { id: 'upload', label: 'Upload' },
      { id: 'processing', label: 'AI Parse' },
      { id: 'review', label: 'Review' },
      { id: 'profile', label: 'Profile' },
      { id: 'search', label: 'Search' },
    ];

    return (
      <div className="w-full lg:w-1/3 bg-blue-900 text-white p-8 lg:p-12 flex flex-col justify-between shrink-0">
        <div>
          <div className="mb-12">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-8 h-8 text-blue-400" />
              HiredRight Demo
            </h1>
          </div>

          <div className="animate-in fade-in slide-in-from-left-4 duration-500" key={currentStep}>
            <h2 className="text-3xl font-bold mb-4">{title}</h2>
            <p className="text-blue-100 text-lg leading-relaxed opacity-90">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex flex-col gap-3">
            {steps.map((step, idx) => {
              const isPast = steps.findIndex(s => s.id === currentStep) > idx;
              const isCurrent = step.id === currentStep;
              
              return (
                <div key={step.id} className={`flex items-center gap-4 transition-all duration-300 ${isCurrent ? 'opacity-100 scale-105' : 'opacity-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isCurrent ? 'border-blue-400 bg-blue-800' : isPast ? 'border-green-400 bg-green-500 text-white' : 'border-blue-700 bg-transparent'}`}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{idx + 1}</span>}
                  </div>
                  <span className={`font-medium ${isCurrent ? 'text-white' : 'text-blue-200'}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
          
          {currentStep === 'search' && (
            <div className="mt-12 pt-8 border-t border-blue-800">
              <p className="text-sm text-blue-200 mb-4">You have completed the demo!</p>
              <Link to="/signup" className="block w-full py-3 px-4 bg-white text-blue-900 text-center font-bold rounded-lg hover:bg-blue-50 transition-colors">
                Sign up for real
              </Link>
              <button onClick={() => setCurrentStep('intro')} className="block w-full mt-3 py-3 px-4 bg-blue-800 text-white text-center font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Restart Demo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAppContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className="text-center animate-in fade-in zoom-in-95 duration-500">
            <Bot className="w-24 h-24 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Interactive Product Tour</h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-8 text-lg">
              Experience how HiredRight transforms unstructured resumes into standardized, searchable skills profiles.
            </p>
            <button
              onClick={() => setCurrentStep('upload')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all hover:scale-105"
            >
              Start the Journey
              <PlayCircle className="w-5 h-5" />
            </button>
          </div>
        );

      case 'upload':
        return (
          <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 text-center">Upload your resume</h3>
            <div 
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-12 text-center bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
              onClick={() => setCurrentStep('processing')}
            >
              <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
              <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">Click to simulate upload</p>
              <p className="text-zinc-500 dark:text-zinc-500 text-sm">PDF, DOCX up to 10MB</p>
              
              <div className="mt-8 py-2 px-4 bg-zinc-100 dark:bg-zinc-800 rounded-full inline-block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                lucky_singh_resume.pdf
              </div>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="w-full max-w-md mx-auto text-center animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Analyzing Resume...</h3>
              <p className="text-zinc-500 dark:text-zinc-400">Our AI is extracting skills and estimating your proficiency levels.</p>
              
              <div className="mt-8 space-y-3">
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full w-2/3 animate-pulse"></div>
                </div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider text-left">Extracting Data Standards...</p>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Review Skills</h3>
              <button 
                onClick={() => setCurrentStep('profile')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
              >
                Confirm Profile <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
                <Bot className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  We found these skills based on your resume. Please review the inferred proficiencies and adjust if necessary.
                </p>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {profile.claims.map((claim, idx) => (
                  <div key={idx} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{claim.activity_label}</span>
                        {claim.is_ai_inferred && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 text-[10px] uppercase tracking-wider py-0 h-5">
                            <Bot className="w-3 h-3 mr-1 inline" /> AI Found
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {claim.category} • {claim.years_experience} years
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(level => (
                        <div 
                          key={level} 
                          className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border ${claim.proficiency === level ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300' : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'}`}
                        >
                          {PROFICIENCY_LABELS[level]}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end mb-4">
               <button 
                onClick={() => setCurrentStep('search')}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 flex items-center gap-2 shadow-sm"
              >
                Switch to Recruiter View <Search className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 mb-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 border-4 border-white dark:border-zinc-800 flex items-center justify-center text-blue-700 dark:text-blue-300 text-2xl font-bold shadow-sm">
                  {profile.first_name[0]}{profile.last_name[0]}
                </div>
                
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {profile.first_name} {profile.last_name}
                  </h1>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{profile.email}</p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Statistical Programmer
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
              Verified Skills
            </h2>
            
            <div className="space-y-4">
              {Object.values(
                profile.claims.reduce((acc, claim) => {
                  const cat = claim.category || 'General';
                  if (!acc[cat]) {
                    acc[cat] = { category: cat, sort_order: claim.category_sort_order ?? 999, claims: [] };
                  }
                  acc[cat].claims.push(claim);
                  return acc;
                }, {} as Record<string, { category: string, sort_order: number, claims: typeof profile.claims }>)
              )
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(({ category, claims }) => (
                <div key={category} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{category}</h3>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {claims.map((claim, idx) => (
                      <li key={idx} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{claim.activity_label}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            {claim.years_experience} yrs
                          </span>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                            {PROFICIENCY_LABELS[claim.proficiency]}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );

      case 'search':
        const matchesSearch = profile.claims.some(c => 
          c.activity_label.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const showResult = searchQuery === '' || matchesSearch;

        return (
          <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="bg-zinc-900 text-white rounded-xl p-6 mb-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                Find Candidates
              </h3>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Try searching for 'SAS', 'CDISC', or 'R'..."
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
                <button className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </button>
              </div>
              <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar">
                {['SAS Programming', 'CDISC SDTM', 'Python'].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setSearchQuery(tag)}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-full border border-zinc-700 transition-colors whitespace-nowrap"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              {isSearching ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : showResult ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xl font-bold shrink-0">
                      {profile.first_name[0]}{profile.last_name[0]}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                        {profile.first_name} {profile.last_name[0]}.
                      </h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">Statistical Programmer</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                          98% Match
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Verified Top Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.claims.slice(0, 3).map((claim, idx) => {
                        const isMatch = searchQuery && claim.activity_label.toLowerCase().includes(searchQuery.toLowerCase());
                        return (
                          <span 
                            key={idx} 
                            className={`px-2 py-1 rounded text-xs font-medium border ${isMatch ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'}`}
                          >
                            {claim.activity_label} ({PROFICIENCY_LABELS[claim.proficiency]})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <User className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400">No candidates match this search.</p>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col lg:flex-row font-sans">
      {renderTutorialSidebar()}
      <div className="flex-1 overflow-y-auto h-screen p-4 sm:p-8 lg:p-12 flex items-center justify-center bg-zinc-100 dark:bg-zinc-950/50 relative">
        <div className="w-full max-w-4xl mx-auto absolute top-4 sm:top-8 right-4 sm:right-8 flex justify-end">
          <Link to="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Exit Demo
          </Link>
        </div>
        {renderAppContent()}
      </div>
    </div>
  );
}
