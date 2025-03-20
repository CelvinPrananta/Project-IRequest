import React, { useRef, useEffect, useContext } from "react"
import { NavLink } from "react-router-dom"
import { useSelector, useDispatch } from "react-redux"
import { CContainer, CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle, CHeader, CHeaderNav, CHeaderToggler, CNavLink, CNavItem, useColorModes } from "@coreui/react"
import CIcon from "@coreui/icons-react"
import { cilContrast, cilMenu, cilMoon, cilSun } from "@coreui/icons"
import { AppBreadcrumb } from "./index"
import { AppHeaderDropdown } from "./header/index"
import TranslateIndonesia from "../assets/translate/id-logo.png"
import TranslateEnglish from "../assets/translate/eng-logo.png"
import translations from "../language/translations"
import { LanguageContext } from "../context/LanguageContext"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDesktop } from "@fortawesome/free-solid-svg-icons";

const AppHeader = () => {
  const headerRef = useRef()
  const { colorMode, setColorMode } = useColorModes("coreui-free-react-admin-template-theme")

  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  // Simpan bahasa di state
  const { language, changeLanguage } = useContext(LanguageContext);

  useEffect(() => {
    document.addEventListener('scroll', () => {
      headerRef.current &&
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    })
  }, [])

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        {/* Toggle Sidebar */}
        <CHeaderToggler
          onClick={() => dispatch({ type: "set", sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: "-14px" }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        {/* Navigasi */}
        <CHeaderNav className="d-none d-md-flex">
          <CNavItem>
            <CNavLink to="/dashboard" as={NavLink}>
              {translations[language].dashboard}
            </CNavLink>
          </CNavItem>
        </CHeaderNav>

        {/* Theme Switcher */}
        <CHeaderNav className="ms-auto">
          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false} className="icon-mode">
              {colorMode === "dark" ? (
                <CIcon className="icon-moon" icon={cilMoon} size="lg" />
              ) : colorMode === "auto" ? (
                // <CIcon className="icon-contrast" icon={cilContrast} size="lg" />
                <FontAwesomeIcon className="icon-contrast" icon={faDesktop} size="lg" />
              ) : (
                <CIcon className="icon-sun" icon={cilSun} size="lg" />
              )}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem
                active={colorMode === "light"}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode("light")}
              >
                <CIcon className={colorMode !== "light" ? "me-2 icon-default" : "me-2 icon-sun"} icon={cilSun} size="lg" />
                <span className={colorMode !== "light" ? "text-default" : "text-light"}>
                  {translations[language].light}
                </span>
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === "dark"}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode("dark")}
              >
                <CIcon className={colorMode !== "dark" ? "me-2 icon-default" : "me-2 icon-moon"} icon={cilMoon} size="lg" />
                <span className={colorMode !== "dark" ? "text-default" : "text-dark"}>
                  {translations[language].dark}
                </span>
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === "auto"}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode("auto")}
              >
                {/* <CIcon className={colorMode !== "auto" ? "me-2 icon-default" : "me-2 icon-contrast"} icon={cilContrast} size="lg" /> */}
                <FontAwesomeIcon className={colorMode !== "auto" ? "me-2 icon-default" : "me-2 icon-contrast"} icon={faDesktop} size="lg" />
                <span className={colorMode !== "auto" ? "text-default" : "text-system"}>
                  {translations[language].system}
                </span>
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>
        </CHeaderNav>
        
        {/* Dropdown Pilihan Bahasa */}
        <CHeaderNav>
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          
          <CDropdown variant="nav-item">
            <CDropdownToggle caret={false}>
              <img className="language-logo" src={language === "en" ? TranslateEnglish : TranslateIndonesia} alt="language-logo" />
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem onClick={() => changeLanguage("en")}>
                <img className="eng-translate" src={TranslateEnglish} alt="eng-logo" /> EN
              </CDropdownItem>
              <CDropdownItem onClick={() => changeLanguage("id")}>
                <img className="id-translate" src={TranslateIndonesia} alt="id-logo" /> ID
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>

          {/* Garis Pemisah */}
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>

          {/* Profile Dropdown */}
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>

      {/* Breadcrumb */}
      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  )
}

export default AppHeader