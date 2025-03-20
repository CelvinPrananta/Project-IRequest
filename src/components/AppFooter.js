import React, { useContext } from 'react'
import { CFooter } from '@coreui/react'
import { Link } from 'react-router-dom'
import translations from "../language/translations"
import { LanguageContext } from "../context/LanguageContext"

const AppFooter = () => {
  const { language } = useContext(LanguageContext);

  return (
    <CFooter className="px-4">
      <div className='container-copyright'>
        <strong className='text-copyright2'>&copy;2024 - {new Date().getFullYear()} <Link to="https://gms.church/id" className='link-copyright2 no-underline' target="_blank">GMS.</Link></strong>
        <p className='text-reserved2'>{translations[language].all_rights_reserved}</p>
      </div>
      <div className='powered'>
        <strong className="text-powered2">{translations[language].powered_by} <Link to="https://gms.church/id" className='link-powered2 no-underline' target="_blank">{translations[language].ict_team}</Link></strong>
      </div>
    </CFooter>
  )
}

export default React.memo(AppFooter)