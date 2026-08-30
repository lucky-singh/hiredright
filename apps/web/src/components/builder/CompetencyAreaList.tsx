import { useState } from 'react'
import type { CompetencyArea } from '@/lib/api/types'
import '../../styles/competency-area-list.css'

interface CompetencyAreaListProps {
  competencyAreas: CompetencyArea[]
  selectedActivityCode: string | null
  onSelectActivity: (code: string) => void
}

export function CompetencyAreaList({
  competencyAreas,
  selectedActivityCode,
  onSelectActivity,
}: CompetencyAreaListProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())

  const toggleArea = (code: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(code)) {
      newExpanded.delete(code)
    } else {
      newExpanded.add(code)
    }
    setExpandedAreas(newExpanded)
  }

  return (
    <div className="competency-area-list">
      {competencyAreas.map((area) => (
        <div key={area.code} className="competency-area">
          <div
            className="area-header"
            onClick={() => toggleArea(area.code)}
          >
            <span className="expand-icon">
              {expandedAreas.has(area.code) ? '▼' : '▶'}
            </span>
            <div className="area-info">
              <h4>{area.label}</h4>
              <p>{area.description}</p>
            </div>
            <span className="activity-badge">
              {area.activities.length}
            </span>
          </div>

          {expandedAreas.has(area.code) && (
            <div className="activities-list">
              {area.activities.map((activity) => (
                <div
                  key={activity.code}
                  className={`activity-item ${
                    selectedActivityCode === activity.code ? 'active' : ''
                  }`}
                  onClick={() => onSelectActivity(activity.code)}
                >
                  <div className="activity-label">
                    <h5>{activity.label}</h5>
                    {activity.seniority_hint && (
                      <span className={`seniority-badge seniority-${activity.seniority_hint}`}>
                        {activity.seniority_hint}
                      </span>
                    )}
                  </div>
                  <p className="activity-help">{activity.help_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
