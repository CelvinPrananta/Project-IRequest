import React from 'react'
import { NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'

import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'

import { CBadge, CNavLink, CSidebarNav } from '@coreui/react'

export const AppSidebarNav = ({ items = [] }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const navLink = (name, icon, badge, indent = false) => (
    <>
      {icon
        ? icon
        : indent && (
            <span className="nav-icon">
              <span className="nav-icon-bullet"></span>
            </span>
          )}
      {name && name}
      {badge && (
        <CBadge color={badge.color} className="ms-auto" size="sm">
          {badge.text}
        </CBadge>
      )}
    </>
  )

  const navItem = (item, index, indent = false) => {
    const { component: Component, name, badge, icon, ...rest } = item
    return (
      <Component as="div" key={index}>
        {rest.to || rest.href ? (
          <CNavLink
            {...(rest.to && { as: NavLink })}
            {...(rest.href && { target: '_blank', rel: 'noopener noreferrer' })}
            {...rest}
          >
            {navLink(name, icon, badge, indent)}
          </CNavLink>
        ) : (
          navLink(name, icon, badge, indent)
        )}
      </Component>
    )
  }

  const navGroup = (item, index) => {
    const { component: Component, name, icon, items, ...rest } = item
    return (
      <Component compact as="div" key={index} toggler={navLink(name, icon)} {...rest}>
        {Array.isArray(items) &&
          items.map((subItem, subIndex) =>
            subItem.items ? navGroup(subItem, subIndex) : navItem(subItem, subIndex, true)
          )}
      </Component>
    )
  }

  return (
    <CSidebarNav as={SimpleBar}>
      {items.map((item, index) =>
        item.items ? navGroup(item, index) : navItem(item, index)
      )}
    </CSidebarNav>
  )
}

AppSidebarNav.propTypes = {
  items: PropTypes.array.isRequired,
}