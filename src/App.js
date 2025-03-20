import React, { useState, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuthRedirect } from './views/check-auth/auth-apps'
import { CSpinner, useColorModes } from '@coreui/react'
import { LanguageProvider } from "./context/LanguageContext"
import { auth } from "./api/configuration";
import useUserActivity from "./views/check-activity/UserActivity";
import './scss/style.scss'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Other pages outside the Apps
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))
const LandingPage = React.lazy(() => import('./views/landing/Landing-page'))

// Email Sign-In Component
const CheckingWithEmail = React.lazy(() => import("./views/check-email/email-apps"));

const protectedPaths = [
  '/dashboard',
  '/role/management/access',
  /^\/event-schedule\/list\/.+$/,
  /^\/event-flyer\/list\/.+$/,
  /^\/looping-flyer\/list\/.+$/
];

const AppContent = () => {
  const location = useLocation()
  const [userId, setUserId] = useState(auth.currentUser ? auth.currentUser.uid : null);

  // Periksa autentikasi pengguna
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        // Tetapkan userId dari Firebase Authentication
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe(); // Cleanup listener saat unmount
  }, []);
  
  // Panggil hook hanya jika userId tersedia
  useUserActivity(userId)

  // Panggil pemeriksaan autentikasi dan logika pengalihan
  useAuthRedirect(protectedPaths)

  // Set judul halaman berdasarkan rute
  useEffect(() => {
    const pathname = location.pathname;
    const matchEventSchedule = pathname.match(/^\/event-schedule\/list\/(.+)$/);
    const matchEventFlyer = pathname.match(/^\/event-flyer\/list\/(.+)$/);
    const matchLoopingFlyer = pathname.match(/^\/looping-flyer\/list\/(.+)$/);

    let newTitle = `Today's Event | GMS Church `;

    if (matchEventSchedule) {
      const churchSlug = matchEventSchedule[1];
      const formattedChurchSlug = decodeURIComponent(churchSlug).replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
      newTitle = `Event Management - ${formattedChurchSlug} | Today's Event - GMS Church `;
    } else if (matchEventFlyer) {
      const churchSlug = matchEventFlyer[1];
      const formattedChurchSlug = decodeURIComponent(churchSlug).replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
      newTitle = `Flyer Management - ${formattedChurchSlug} | Today's Event - GMS Church `;
    } else if (matchLoopingFlyer) {
      const churchSlug = matchLoopingFlyer[1];
      const formattedChurchSlug = decodeURIComponent(churchSlug).replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
      newTitle = `Looping Management - ${formattedChurchSlug} | Today's Event - GMS Church `;
    } else {
      const routeTitleMap = {
        '/landing/:churchSlug': `Today's Event | GMS Church `,
        '/login': `Login | Today's Event - GMS Church `,
        '/register': `Register | Today's Event - GMS Church `,
        '/404': `Page Not Found | Today's Event - GMS Church `,
        '/500': `Server Error | Today's Event - GMS Church `,
        '/dashboard': `Dashboard | Today's Event - GMS Church `,
        '/role/management/access': `Access Management | Today's Event - GMS Church `
      }

      // Dapatkan title berdasarkan rute, default jika rute tidak terdaftar
      newTitle = routeTitleMap[pathname] || newTitle;
    }

    // Update judul di tab browser secara dinamis (scrolling)
    let titleInterval
    let tempTitle = newTitle
    let currentIndex = 0
    let repeatCount = 0
    const maxRepeats = 5

    // Fungsi untuk membuat judul bergerak
    const moveTitle = () => {
      document.title = tempTitle.slice(currentIndex) + tempTitle.slice(0, currentIndex)

      currentIndex++
      if (currentIndex === tempTitle.length) {
        currentIndex = 0
        repeatCount++
        if (repeatCount >= maxRepeats) {
          clearInterval(titleInterval)  // Stop animasi setelah sejumlah pengulangan
        }
      }
    }

    titleInterval = setInterval(moveTitle, 500) // Update judul setiap 500ms

    // Stop animasi jika ada perubahan rute
    return () => clearInterval(titleInterval)

  }, [location.pathname]) // Efek dijalankan setiap kali rute berubah
  
  useEffect(() => {
    const clearSession = () => {
      // Hapus tanda saat pengguna berpindah halaman
      sessionStorage.removeItem('loginWarningToastShown');
    };
  
    window.addEventListener('beforeunload', clearSession);
  
    // Pastikan untuk membersihkan listener saat komponen unmount
    return () => window.removeEventListener('beforeunload', clearSession);
  }, []);
  
  const isLandingPage = location.pathname.startsWith('/landing/');

  return (
    <LanguageProvider>
      <Suspense fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }>

        <Routes>
          <Route path="/landing/:churchSlug" element={<LandingPage />} />
          <Route exact path="/login" name="Login Page" element={<Login />} />
          <Route exact path="/register" name="Register Page" element={<Register />} />
          <Route exact path="/404" name="Page 404" element={<Page404 />} />
          <Route exact path="/500" name="Page 500" element={<Page500 />} />
          <Route exact path="/SignInWithEmail" element={<CheckingWithEmail />} />
          {!isLandingPage && <Route path="*" name="Home" element={<DefaultLayout />} />}
        </Routes>

      </Suspense>
    </LanguageProvider>
  )
}

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
    if (theme) {
      setColorMode(theme)
    }

    if (isColorModeSet()) {
      return
    }

    setColorMode(storedTheme)
  }, [])

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </BrowserRouter>
  )
}

export default App