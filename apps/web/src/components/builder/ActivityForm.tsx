import { useBuilderStore } from '@/stores/builder-store'
import type { Activity } from '@/lib/api/types'
import { SeniorityBadge } from '../builder/seniority-badge'
import '../../styles/activity-form.css'

interface ActivityFormProps {
  activity: Activity
  onActivityChange: () => void
}

export function ActivityForm({
  activity,
  onActivityChange,
}: ActivityFormProps) {
  const store = useBuilderStore()
  const claim = store.claims[activity.code]

  const handleToggleClaim = () => {
    store.toggleClaim(activity.code)
    onActivityChange()
  }

  const handleProficiencyChange = (level: number | null) => {
    store.setProficiency(activity.code, level)
    onActivityChange()
  }

  const handleVariantToggle = (variant: string) => {
    const current = claim?.variants || []
    const newVariants = current.includes(variant)
      ? current.filter(v => v !== variant)
      : [...current, variant]
    store.setVariants(activity.code, newVariants)
    onActivityChange()
  }

  const handleLastUsedYearChange = (year: number | null) => {
    store.setLastUsedYear(activity.code, year)
    onActivityChange()
  }

  if (!claim) {
    return (
      <div className="activity-form">
        <div className="form-header">
          <h3>{activity.label}</h3>
          <SeniorityBadge level={activity.seniority_hint} />
        </div>
        <p className="form-description">{activity.help_text}</p>
        <button className="btn-outline" onClick={handleToggleClaim}>
          + Add Claim
        </button>
      </div>
    )
  }

  return (
    <div className="activity-form">
      <div className="form-header">
        <h3>{activity.label}</h3>
        <SeniorityBadge level={activity.seniority_hint} />
      </div>
      <p className="form-description">{activity.help_text}</p>

      <form className="claim-form">
        {/* Claim checkbox */}
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={claim.claimed}
              onChange={handleToggleClaim}
            />
            I have experience with {activity.label}
          </label>
        </div>

        {claim.claimed && (
          <>
            {/* Proficiency level */}
            <div className="form-group">
              <label>Proficiency Level</label>
              <div className="proficiency-buttons">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`proficiency-btn ${
                      claim.proficiency === level ? 'active' : ''
                    }`}
                    onClick={() => handleProficiencyChange(level)}
                  >
                    {level === 1 && 'Beginner'}
                    {level === 2 && 'Intermediate'}
                    {level === 3 && 'Advanced'}
                    {level === 4 && 'Expert'}
                  </button>
                ))}
              </div>
            </div>

            {/* Years of experience */}
            <div className="form-group">
              <label htmlFor={`years-${activity.code}`}>
                Years of Experience
              </label>
              <input
                id={`years-${activity.code}`}
                type="number"
                min="0"
                max="60"
                step="0.5"
                value={claim.yearsExperience || ''}
                onChange={(e) => {
                  const val = e.target.value
                  handleProficiencyChange(claim.proficiency)
                  // Years handled separately if needed
                }}
                placeholder="e.g., 5.5"
              />
            </div>

            {/* Last used year */}
            <div className="form-group">
              <label htmlFor={`year-${activity.code}`}>
                Last Used In Year
              </label>
              <input
                id={`year-${activity.code}`}
                type="number"
                min="1980"
                max={new Date().getFullYear()}
                value={claim.lastUsedYear || ''}
                onChange={(e) => {
                  const year = e.target.value ? parseInt(e.target.value) : null
                  handleLastUsedYearChange(year)
                }}
                placeholder={new Date().getFullYear().toString()}
              />
            </div>

            {/* Variants */}
            {activity.variants && activity.variants.length > 0 && (
              <div className="form-group">
                <label>Specific Versions/Variants</label>
                <div className="variants-checkboxes">
                  {activity.variants.map((variant) => (
                    <label key={variant} className="variant-checkbox">
                      <input
                        type="checkbox"
                        checked={claim.variants.includes(variant)}
                        onChange={() => handleVariantToggle(variant)}
                      />
                      {variant}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Remove button */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-danger"
                onClick={handleToggleClaim}
              >
                Remove Claim
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
