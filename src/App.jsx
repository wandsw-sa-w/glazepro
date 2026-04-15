// Force rebuild - v2
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Calendar from './pages/Calendar'
import Tasks from './pages/Tasks'
import UnmatchedEmails from './pages/UnmatchedEmails'
import Settings from './pages/Settings'
import Ironmongery from './pages/Ironmongery'
import Import from './pages/Import'
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
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/unmatched-emails" element={<UnmatchedEmails />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/ironmongery" element={<Ironmongery />} />
      <Route path="/import" element={<Import />} />
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
