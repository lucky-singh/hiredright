import { useState, useEffect, useRef } from 'react'
import { useBuilderStore } from '@/stores/builder-store'
import { apiFetch } from '@/lib/api/client'
import type { FunctionTree } from '@/lib/api/types'
import { FunctionSelector } from '@/components/builder/FunctionSelector'
import { CompetencyAreaList } from '@/components/builder/CompetencyAreaList'
import { ActivityForm } from '@/components/builder/ActivityForm'
import { ProfileSummaryPage } from './ProfileSummaryPage'
import '../styles/builder.css'

interface BuilderPageProps {
  onLogout: () => void
}

type ViewMode = 'builder' | 'profile'

export function BuilderPage({ onLogout }: BuilderPageProps) {
  const [functions, setFunctions] = useState<FunctionTree[]>([])
  const [selectedFunction, setSelectedFunction] = useState<FunctionTree | null>(null)
  const [selectedActivityCode, setSelectedActivityCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [viewMode, setViewMode] = useState<ViewMode>('builder')
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  const store = useBuilderStore()

  // Load functions on mount
  useEffect(() => {
    loadFunctions()
  }, [])

  // Load builder data when function is selected
  useEffect(() => {
    if (selectedFunction) {
      loadBuilderData(selectedFunction.code)
    }
  }, [selectedFunction])

  // Auto-save dirty changes with debounce
  useEffect(() => {
    if (store.hasDirty()) {
      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Set save status to indicate unsaved changes
      setSaveStatus('saving')

      // Debounce save for 1 second after last change
      saveTimeoutRef.current = setTimeout(() => {
        handleSave()
      }, 1000)
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [store.hasDirty()])

  const loadFunctions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      // Fetch from API - for now, use hardcoded sample data
      const mockFunctions: FunctionTree[] = [
        {
          code: 'statistical-programming',
          label: 'Statistical Programming',
          description: 'Clinical data analysis and statistical programming',
          competency_areas: [
            {
              code: 'sas-programming',
              label: 'SAS Programming',
              description: 'SAS language and ecosystem',
              activities: [
                {
                  code: 'sas-base',
                  label: 'SAS Base',
                  help_text: 'Core SAS language and data step',
                  claim_type: 'proficiency',
                  seniority_hint: 'junior',
                  variants: ['SAS 9.4', 'Viya 4.0'],
                },
                {
                  code: 'sas-stat',
                  label: 'SAS/STAT',
                  help_text: 'Statistical procedures',
                  claim_type: 'proficiency',
                  seniority_hint: 'mid',
                  variants: ['PROC GLM', 'PROC MIXED'],
                },
                {
                  code: 'sas-graph',
                  label: 'SAS/GRAPH',
                  help_text: 'Graphics procedures',
                  claim_type: 'proficiency',
                  seniority_hint: 'mid',
                  variants: ['PROC GPLOT', 'ODS Graphics'],
                },
              ],
            },
            {
              code: 'data-management',
              label: 'Data Management',
              description: 'Data cleaning, transformation, and QA',
              activities: [
                {
                  code: 'data-validation',
                  label: 'Data Validation',
                  help_text: 'Data quality checks and validation rules',
                  claim_type: 'proficiency',
                  seniority_hint: 'junior',
                  variants: ['Range checks', 'Format checks'],
                },
                {
                  code: 'sdtm-mapping',
                  label: 'SDTM Mapping',
                  help_text: 'CDISC SDTM data standards',
                  claim_type: 'proficiency',
                  seniority_hint: 'senior',
                  variants: ['SDTM IG 3.2', 'SDTM IG 3.3'],
                },
              ],
            },
          ],
        },
      ]
      setFunctions(mockFunctions)
      if (mockFunctions.length > 0) {
        setSelectedFunction(mockFunctions[0])
      }
    } catch (err) {
      console.error('Failed to load functions:', err)
      setError('Failed to load taxonomy')
    } finally {
      setIsLoading(false)
    }
  }

  const loadBuilderData = async (functionCode: string) => {
    try {
      const data = await apiFetch(`/builder/${functionCode}/`)
      console.log('Builder data loaded:', data)
      // Initialize store with loaded data
      store.initFromPayload(data.existing_claims || [], data.current_step || 0, data.completed_areas || [])
    } catch (err) {
      console.error('Failed to load builder data:', err)
      // Initialize empty if API fails
      store.initFromPayload([], 0, [])
    }
  }

  const handleSave = async () => {
    const dirty = store.getDirtyDeltas()
    if (dirty.length === 0) {
      setSaveStatus('idle')
      return
    }

    setIsSaving(true)
    setSaveStatus('saving')
    
    try {
      // Save to backend database
      console.log('Saving claims to database:', dirty)
      await apiFetch('/builder/claims/', {
        method: 'POST',
        body: JSON.stringify({ claims: dirty }),
      })
      
      store.clearDirty(dirty.map(d => d.activity_code))
      setError(null)
      setSaveStatus('saved')
      console.log('✅ Claims saved to PostgreSQL database')
      
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err: any) {
      console.error('Failed to save to database:', err)
      setError('Unable to save changes. Please verify you are logged in.')
      setSaveStatus('idle')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedActivity = selectedFunction
    ? selectedFunction.competency_areas
      .flatMap(ca => ca.activities)
      .find(a => a.code === selectedActivityCode)
    : null

  if (isLoading) {
    return <div className="loading">Loading taxonomy...</div>
  }

  if (viewMode === 'profile') {
    return <ProfileSummaryPage onBack={() => setViewMode('builder')} />
  }

  return (
    <div className="builder-container">
      <header className="builder-header">
        <div className="header-left">
          <h1>HireRight Profile Builder</h1>
        </div>
        <div className="header-right">
          <button
            className={`tab-button ${viewMode === 'builder' ? 'active' : ''}`}
            onClick={() => setViewMode('builder')}
          >
            ✎ Builder
          </button>
          <button
            className={`tab-button ${viewMode === 'profile' ? 'active' : ''}`}
            onClick={() => setViewMode('profile')}
          >
            👤 Profile ({store.hasDirty() ? '●' : store.claims && Object.values(store.claims).filter(c => c.claimed).length})
          </button>
          <button className="btn-secondary" onClick={onLogout}>Log out</button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="builder-layout">
        <aside className="builder-sidebar">
          <FunctionSelector
            functions={functions}
            selectedFunction={selectedFunction}
            onSelect={setSelectedFunction}
          />
        </aside>

        <main className="builder-content">
          {selectedFunction && (
            <>
              <div className="builder-breadcrumb">
                <h2>{selectedFunction.label}</h2>
                <p>{selectedFunction.description}</p>
              </div>

              <CompetencyAreaList
                competencyAreas={selectedFunction.competency_areas}
                selectedActivityCode={selectedActivityCode}
                onSelectActivity={setSelectedActivityCode}
              />

              {selectedActivity && (
                <ActivityForm
                  activity={selectedActivity}
                  onActivityChange={() => {
                    // Auto-save is handled by the useEffect above
                    // No need to call handleSave here
                  }}
                />
              )}

              {/* Show save status indicator */}
              <div className={`save-indicator save-status-${saveStatus}`}>
                <span className="save-status-icon">
                  {saveStatus === 'saving' && '⟳ Saving...'}
                  {saveStatus === 'saved' && '✓ Saved'}
                  {saveStatus === 'idle' && !store.hasDirty() && ''}
                </span>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
