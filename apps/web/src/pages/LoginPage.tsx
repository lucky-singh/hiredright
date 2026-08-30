import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import '../styles/login.css'

interface LoginPageProps {
  onLogin: () => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Use the correct auth endpoint
      const response = await apiFetch<{ access: string }>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (!response.access) {
        throw new Error('No token in response')
      }
      
      localStorage.setItem('access_token', response.access)
      localStorage.setItem('user_email', email)
      onLogin()
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.body?.detail || 'Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>HireRight</h1>
        <p className="subtitle">Clinical Talent Intelligence</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="demo-info">
          Demo: Use any email/password combination to log in. Enter your details to get started.
        </p>
      </div>
    </div>
  )
}
