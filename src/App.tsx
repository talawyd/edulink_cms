import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { PageSpinner } from '@/components/ui/Spinner'
import { AppShell } from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import MfaPromptPage from '@/pages/MfaPromptPage'
import NotOnTeamPage from '@/pages/NotOnTeamPage'
import SecurityPage from '@/pages/SecurityPage'
import SchoolsPage from '@/pages/SchoolsPage'
import RenewalsPage from '@/pages/RenewalsPage'
import TeamPage from '@/pages/TeamPage'
import SettingsPage from '@/pages/SettingsPage'
import ActivityPage from '@/pages/ActivityPage'
import SchoolDetailPage from '@/pages/school/SchoolDetailPage'

function Gate({ children }: { children: ReactNode }) {
  const { loading, session, mfaRequired, staff, notOnTeam } = useAuth()

  if (loading) return <PageSpinner />
  if (!session) return <LoginPage />
  if (mfaRequired) return <MfaPromptPage />
  if (notOnTeam || !staff) return <NotOnTeamPage />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Gate>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/schools" replace />} />
                <Route path="/schools" element={<SchoolsPage />} />
                <Route path="/schools/:id" element={<SchoolDetailPage />} />
                <Route path="/renewals" element={<RenewalsPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/security" element={<SecurityPage />} />
                <Route path="*" element={<Navigate to="/schools" replace />} />
              </Route>
            </Routes>
          </Gate>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
