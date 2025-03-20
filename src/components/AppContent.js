import React, { Suspense, useContext } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

// routes config
import getRoutes from '../routes'
import { LanguageContext } from '../context/LanguageContext'
import { useAuthRedirect } from '../views/check-auth/auth-apps'

const protectedPaths = [
  '/dashboard',
  '/role/management/access',
  /^\/event-schedule\/list\/.+$/,
  /^\/event-flyer\/list\/.+$/,
  /^\/looping-flyer\/list\/.+$/
];

const AppContent = () => {
  const location = useLocation()
  const { language } = useContext(LanguageContext); // Dapatkan bahasa
  const routes = getRoutes(language); // Panggil fungsi untuk mendapatkan array routes
  
  // Panggil pemeriksaan autentikasi dan logika pengalihan
  if (location.pathname !== '/' && location.pathname !== '/register') {
    useAuthRedirect(protectedPaths)
  }

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => (
            route.element && (
              <Route
                key={idx}
                path={route.path}
                exact={route.exact}
                name={route.name}
                element={<route.element />}
              />
            )
          ))}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)