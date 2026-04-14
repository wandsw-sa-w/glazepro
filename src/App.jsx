import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Login from './pages/Login'
import './App.css'

function AppRoutes() {
  const { session } = useAuth()

  // Still loading initial session
  if (session === undefined) return null

  if (!session) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/leads" replace />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/leads/:id" element={<LeadDetail />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <AppRoutes />
      </div>
    </AuthProvider>
  )
}

export default App
