import type { RoleTree } from '@/lib/api/types'
import '../../styles/function-selector.css'

interface FunctionSelectorProps {
  functions: RoleTree[]
  selectedFunction: RoleTree | null
  onSelect: (func: RoleTree) => void
}

export function FunctionSelector({
  functions,
  selectedFunction,
  onSelect,
}: FunctionSelectorProps) {
  return (
    <div className="function-selector">
      <h3>Functions</h3>
      <ul className="function-list">
        {functions.map((func) => (
          <li
            key={func.code}
            className={`function-item ${
              selectedFunction?.code === func.code ? 'active' : ''
            }`}
            onClick={() => onSelect(func)}
          >
            <span className="function-label">{func.label}</span>
            <span className="function-badge">
              {func.competency_areas.length} areas
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
