import { useState, useEffect } from 'react'
import './App.css'
import { BuilderPage } from './pages/BuilderPage'
import { LoginPage } from './pages/LoginPage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    setIsLoggedIn(!!token)
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return <div className="loading">Loading...</div>
  }

  return isLoggedIn ? (
    <BuilderPage onLogout={() => {
      localStorage.removeItem('access_token')
      setIsLoggedIn(false)
    }} />
  ) : (
    <LoginPage onLogin={() => {
      setIsLoggedIn(true)
    }} />
  )
}

export default App
