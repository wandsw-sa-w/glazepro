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
import PricingPage            from './pages/PricingPage'
import PriceFileDetail        from './pages/PriceFileDetail'
import PriceRulesEditor       from './pages/pricing/PriceRulesEditor'
import InstallLabourEditor     from './pages/pricing/InstallLabourEditor'
import ManufactureLabourEditor from './pages/pricing/ManufactureLabourEditor'
import PartsEditor             from './pages/pricing/PartsEditor'
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
      <Route path="/pricing"                     element={<PricingPage />} />
      <Route path="/pricing/:fileId"             element={<PriceFileDetail />} />
      <Route path="/pricing/:fileId/price"       element={<PriceRulesEditor />} />
      <Route path="/pricing/:fileId/install"     element={<InstallLabourEditor />} />
      <Route path="/pricing/:fileId/manufacture" element={<ManufactureLabourEditor />} />
      <Route path="/pricing/:fileId/parts"       element={<PartsEditor />} />
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
