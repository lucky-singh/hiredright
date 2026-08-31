import React from "react";
import type { SearchResult, Skill } from '@/lib/api/search';
import { X } from 'lucide-react';

interface CompareModalProps {
  candidates: SearchResult[];
  onClose: () => void;
}

export function CompareModal({ candidates, onClose }: CompareModalProps) {
  // Collect union of all skills
  const allSkillsByCode = new Map<string, Skill>();
  
  candidates.forEach(c => {
    [...c.matched_required, ...c.missing_required, ...c.matched_optional, ...(c.other_skills || [])].forEach(s => {
      // Only store the base skill info once
      if (!allSkillsByCode.has(s.code)) {
        allSkillsByCode.set(s.code, s);
      }
    });
  });

  // Group by category
  const groupedSkills = new Map<string, { label: string, sort_order: number, skills: Skill[] }>();
  
  Array.from(allSkillsByCode.values()).forEach(s => {
    const area = s.areas?.[0] || { label: 'General', sort_order: 999 };
    const groupKey = area.label;
    
    if (!groupedSkills.has(groupKey)) {
      groupedSkills.set(groupKey, { label: area.label, sort_order: area.sort_order, skills: [] });
    }
    groupedSkills.get(groupKey)!.skills.push(s);
  });

  // Sort groups
  const sortedGroups = Array.from(groupedSkills.values()).sort((a, b) => a.sort_order - b.sort_order);

  // Helper to find a specific skill for a candidate
  const getCandidateSkill = (candidate: SearchResult, code: string) => {
    const all = [...candidate.matched_required, ...candidate.matched_optional, ...(candidate.other_skills || [])];
    return all.find(s => s.code === code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Compare Candidates</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto p-0 flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-zinc-700 uppercase bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-semibold border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 w-1/4">Skill</th>
                {candidates.map((c) => (
                  <th key={c.profile_id} className="px-6 py-4 font-semibold border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-center">
                    Profile #{c.profile_id}
                    <div className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400 mt-1">Match Score: {c.score_pct}%</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(group => (
                <React.Fragment key={group.label}>
                  <tr className="bg-zinc-100 dark:bg-zinc-800/50">
                    <td colSpan={candidates.length + 1} className="px-6 py-2 font-bold text-zinc-900 dark:text-zinc-100 uppercase text-xs tracking-wider">
                      {group.label}
                    </td>
                  </tr>
                  {group.skills.sort((a,b) => a.label.localeCompare(b.label)).map(skill => (
                    <tr key={skill.code} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/25">
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-200">
                        {skill.label}
                      </td>
                      {candidates.map(c => {
                        const cSkill = getCandidateSkill(c, skill.code);
                        return (
                          <td key={c.profile_id} className="px-6 py-4 text-center align-top border-l border-zinc-100 dark:border-zinc-800/50">
                            {cSkill ? (
                              <div className="flex flex-col items-center gap-1.5">
                                {cSkill.proficiency && (
                                  <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded">
                                    Proficiency: {cSkill.proficiency}/4
                                  </span>
                                )}
                                {cSkill.years_experience !== null && cSkill.years_experience !== undefined && (
                                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                    {cSkill.years_experience} yrs exp
                                  </span>
                                )}
                                {cSkill.last_used_year !== null && cSkill.last_used_year !== undefined && (
                                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                                    Last used: {cSkill.last_used_year}
                                  </span>
                                )}
                                {(!cSkill.proficiency && cSkill.years_experience === null && cSkill.last_used_year === null) && (
                                  <span className="text-xs text-zinc-500">Claimed</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-300 dark:text-zinc-700">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
