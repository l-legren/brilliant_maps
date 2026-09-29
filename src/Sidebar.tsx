import { useState } from 'react'

const NAV_ITEMS = ['GDP', 'Population', 'Life Expectancy']

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`flex h-full flex-col border-r border-(--border) bg-(--bg) transition-[width] duration-200 ${
        collapsed ? 'w-(--sidebar-collapsed-width)' : 'w-(--sidebar-width)'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className="flex h-10 w-10 items-center justify-center self-end text-(--text-h) hover:bg-(--accent-bg)"
      >
        {collapsed ? '»' : '«'}
      </button>

      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            title={item}
            className="truncate rounded px-2 py-1.5 text-left text-sm text-(--text-h) hover:bg-(--accent-bg)"
          >
            {collapsed ? item[0] : item}
          </button>
        ))}
      </nav>
    </aside>
  )
}
