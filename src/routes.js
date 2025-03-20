import React, { useContext } from 'react'
import translations from "./../src/language/translations"
import { LanguageContext } from "./../src/context/LanguageContext"

// Landing Page
const LandingPage = React.lazy(() => import('./views/landing/Landing-page'))

// Dashboard
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))

// Access Management
const AccessManagement = React.lazy(() => import('./views/role/access-system'))

// Schedule Event
const EventScheduleList = React.lazy(() => import('./views/event-schedule/events-list'))

// Upload Flyer
const EventFlyerList = React.lazy(() => import('./views/event-flyer/flyer'))

// Looping Flyer
const LoopingFlyerList = React.lazy(() => import('./views/event-flyer/looping'))

const getRoutes = (language) => [
  { path: '/landing/:churchSlug', name: 'Landing Page', element: LandingPage },
  { path: '/dashboard', name: translations[language].dashboard_user, element: Dashboard },
  { path: '/role/management/access', name: translations[language].access_management, element: AccessManagement, exact: true },
  { path: '/event-schedule/list/:churchSlug', name: translations[language].event_churchSlug, element: EventScheduleList, exact: true },
  { path: '/event-flyer/list/:churchSlug', name: translations[language].flyer_churchSlug, element: EventFlyerList, exact: true },
  { path: '/looping-flyer/list/:churchSlug', name: translations[language].looping_churchSlug, element: LoopingFlyerList, exact: true },
];

// Routes Web
const routes = () => {
  // Ambil language dari context
  const { language } = useContext(LanguageContext);

  // Kembalikan daftar routes sesuai bahasa
  return getRoutes(language); 
};

export default routes