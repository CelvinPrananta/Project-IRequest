import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { CCloseButton, CSidebar, CSidebarBrand, CSidebarFooter, CSidebarHeader, CSidebarToggler } from '@coreui/react'
import { AppSidebarNav } from './AppSidebarNav'
import logoApp from "./../assets/brand/logo-app.png"

// sidebar nav config
import Navigation from '../_nav'

const AppSidebar = () => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const theme = useSelector((state) => state.theme)
  
  // Panggil fungsi untuk mendapatkan data
  const navigationItems = Navigation();

  return (
    <CSidebar
      className="border-end"
      colorScheme={theme}
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand className='no-underline' to="/dashboard">
          <div className='sidebar-brand'>
            <img className='img' src={logoApp} alt="Logo App" />
          </div>
        </CSidebarBrand>
        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() => dispatch({ type: 'set', sidebarShow: false })}
        />
      </CSidebarHeader>

      {/* Pastikan items diberikan */}
      <AppSidebarNav items={navigationItems} />
      
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
        />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)