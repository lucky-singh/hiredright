import { useBuilderStore } from '@/stores/builder-store'
import { useEffect, useState } from 'react'
import '../styles/profile-summary.css'

interface ProfileSummaryPageProps {
  onBack: () => void
}

export function ProfileSummaryPage({ onBack }: ProfileSummaryPageProps) {
  const store = useBuilderStore()
  const [claimedSkills, setClaimedSkills] = useState<Array<{
    code: string
    claimed: boolean
    proficiency: number | null
    yearsExperience: number | null
    lastUsedYear: number | null
    variants: string[]
  }>>([])

  useEffect(() => {
    // Get all claimed skills from store
    const claims = Object.entries(store.claims)
      .filter(([_, claim]) => claim.claimed)
      .map(([code, claim]) => ({
        code,
        claimed: claim.claimed,
        proficiency: claim.proficiency,
        yearsExperience: claim.yearsExperience,
        lastUsedYear: claim.lastUsedYear,
        variants: claim.variants,
      }))
    
    setClaimedSkills(claims)
  }, [store.claims])

  const getProficiencyLabel = (level: number | null): string => {
    switch (level) {
      case 1:
        return 'Beginner'
      case 2:
        return 'Intermediate'
      case 3:
        return 'Advanced'
      case 4:
        return 'Expert'
      default:
        return 'Not specified'
    }
  }

  return (
    <div className="profile-summary-page">
      <div className="profile-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to Builder
        </button>
        <h1>Your Profile</h1>
        <p className="subtitle">Claimed Skills & Experience</p>
      </div>

      {claimedSkills.length === 0 ? (
        <div className="empty-state">
          <p>No skills claimed yet.</p>
          <p className="hint">Go back to the builder and claim some activities to see your profile.</p>
        </div>
      ) : (
        <div className="skills-grid">
          {claimedSkills.map((skill) => (
            <div key={skill.code} className="skill-card">
              <div className="skill-header">
                <h3>{skill.code.replace(/-/g, ' ').toUpperCase()}</h3>
              </div>

              <div className="skill-details">
                {skill.proficiency && (
                  <div className="detail-row">
                    <span className="label">Proficiency:</span>
                    <span className="value">
                      {getProficiencyLabel(skill.proficiency)}
                    </span>
                  </div>
                )}

                {skill.yearsExperience && (
                  <div className="detail-row">
                    <span className="label">Years of Experience:</span>
                    <span className="value">{skill.yearsExperience} years</span>
                  </div>
                )}

                {skill.lastUsedYear && (
                  <div className="detail-row">
                    <span className="label">Last Used:</span>
                    <span className="value">{skill.lastUsedYear}</span>
                  </div>
                )}

                {skill.variants && skill.variants.length > 0 && (
                  <div className="detail-row variants">
                    <span className="label">Versions/Variants:</span>
                    <div className="variant-tags">
                      {skill.variants.map((variant) => (
                        <span key={variant} className="tag">
                          {variant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="profile-footer">
        <p className="info-text">
          Total Skills Claimed: <strong>{claimedSkills.length}</strong>
        </p>
        <button className="btn-export" onClick={() => {
          const data = JSON.stringify(claimedSkills, null, 2)
          const blob = new Blob([data], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `profile_${new Date().toISOString().split('T')[0]}.json`
          a.click()
          URL.revokeObjectURL(url)
        }}>
          📥 Export Profile as JSON
        </button>
      </div>
    </div>
  )
}
