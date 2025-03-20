import React, { useContext, useEffect, useState } from 'react'
import { useLocation, useParams, Link } from 'react-router-dom'

import getRoutes from '../routes'

import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'
import translations from "../language/translations";
import { LanguageContext } from "../context/LanguageContext"

const AppBreadcrumb = () => {
  const location = useLocation();
  const params = useParams(); // Ambil parameter slug dari URL
  const { language } = useContext(LanguageContext); // Ambil bahasa
  const routes = getRoutes(language); // Panggil fungsi untuk mendapatkan array rute

  // State untuk menyimpan churchSlug
  const [churchSlug, setChurchSlug] = useState('');
  
  // Fungsi untuk memformat slug menjadi format yang lebih terbaca
  const formatSlug = (slug) => {
    if (!slug) return '';
    
    // Ganti tanda hubung dengan spasi dan format setiap kata dengan huruf kapital di awal
    return slug.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Effect untuk mengekstrak churchSlug dari URL
  useEffect(() => {
    // Coba dapatkan churchSlug dari params
    if (params && params.churchSlug) {
      setChurchSlug(params.churchSlug);
    } else {
      // Jika tidak ada di params, coba ekstrak dari pathname
      const match = location.pathname.match(/\/([^\/]+)\/list\/([^\/]+)/);
      if (match && match[2]) {
        setChurchSlug(match[2]);
      }
    }
  }, [location.pathname, params]);

  // Fungsi untuk mendapatkan nama rute
  const getRouteName = (pathname, routes) => {
    const currentRoute = routes.find((route) => {
      const routePattern = route.path.replace(/:churchSlug/g, '[^/]+');
      const routeRegex = new RegExp(`^${routePattern}$`);
      return routeRegex.test(pathname);
    });

    if (!currentRoute) return false;

    // Jika ada churchSlug, ubah nama rute
    if (currentRoute.path.includes(':churchSlug') && churchSlug) {
      // Ganti placeholder :churchSlug dengan nilai churchSlug yang sebenarnya
      let name = currentRoute.name;
      // Ganti secara manual placeholder dengan nilai churchSlug yang sudah diformat
      name = name.replace(':churchSlug', formatSlug(churchSlug));
      return name;
    }

    return currentRoute.name;
  };

  // Generate breadcrumbs berdasarkan lokasi
  const getBreadcrumbs = (location) => {
    const breadcrumbs = [];
    let fullPath = '';
    
    location.pathname.split('/').filter(Boolean).forEach((part, index, array) => {
      fullPath += `/${part}`;
      
      // Coba mendapatkan nama rute
      const routeName = getRouteName(fullPath, routes);
      
      if (routeName) {
        breadcrumbs.push({
          pathname: fullPath,
          name: routeName,
          active: false
        });
      }
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs(location);

  // Modifikasi breadcrumb untuk mengatasi masalah :churchSlug
  const modifiedBreadcrumbs = breadcrumbs.map(breadcrumb => {
    if (breadcrumb.name && breadcrumb.name.includes(':churchSlug') && churchSlug) {
      return {
        ...breadcrumb,
        name: breadcrumb.name.replace(':churchSlug', formatSlug(churchSlug))
      };
    }
    return breadcrumb;
  });

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem>
        <Link to="/dashboard" className='no-underline'>{translations[language].home}</Link>
      </CBreadcrumbItem>
      {modifiedBreadcrumbs.map((breadcrumb, index) => (
        <CBreadcrumbItem key={index} active={breadcrumb.active}>
          {breadcrumb.active ? breadcrumb.name : <Link className='no-underline' to={breadcrumb.pathname}>{breadcrumb.name}</Link>}
        </CBreadcrumbItem>
      ))}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)