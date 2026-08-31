import re

with open('apps/web/src/pages/candidate-profile.tsx', 'r') as f:
    content = f.read()

# Update interface
content = content.replace(
"""  claims: {
    activity_code: string;
    activity_label: string;
    proficiency: number | null;
  }[];""", 
"""  claims: {
    activity_code: string;
    activity_label: string;
    proficiency: number | null;
    category?: string;
  }[];"""
)

# Update rendering logic
old_render = """          {profile.claims.length === 0 ? (
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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {profile.claims.map((claim, idx) => (
                  <li key={idx} className="p-4 sm:p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{claim.activity_label}</p>
                      </div>
                    </div>
                    {claim.proficiency && (
                      <Badge variant="secondary" className="ml-4 shrink-0">
                        {PROFICIENCY_LABELS[claim.proficiency]}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}"""

new_render = """          {profile.claims.length === 0 ? (
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
              {Object.entries(
                profile.claims.reduce((acc, claim) => {
                  const cat = claim.category || 'General';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(claim);
                  return acc;
                }, {} as Record<string, typeof profile.claims>)
              ).map(([category, claims]) => (
                <div key={category} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{category}</h3>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {claims.map((claim, idx) => (
                      <li key={idx} className="p-4 sm:p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{claim.activity_label}</p>
                          </div>
                        </div>
                        {claim.proficiency && (
                          <Badge variant="secondary" className="ml-4 shrink-0">
                            {PROFICIENCY_LABELS[claim.proficiency]}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}"""

content = content.replace(old_render, new_render)

with open('apps/web/src/pages/candidate-profile.tsx', 'w') as f:
    f.write(content)

