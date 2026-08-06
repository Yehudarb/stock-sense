import { useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import useStore from '../../store/useStore'
import LegalFooter from '../legal/LegalFooter'

export default function Layout({ children, isConnected, activeTab, onTabChange }) {
  const { language, theme, viewMode } = useStore()
  const isHebrew = language === 'he'

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.classList.toggle('theme-light', theme === 'light')
    body.classList.toggle('theme-light', theme === 'light')
    root.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div
      className={`app-shell flex min-h-screen min-w-0 flex-col bg-surface ${viewMode === 'mobile' ? 'app-shell--mobile-preview' : ''}`}
      dir={isHebrew ? 'rtl' : 'ltr'}
      data-theme={theme}
      data-view-mode={viewMode}
    >
      <Header isConnected={isConnected} />
      <div className="app-shell__body flex min-w-0 flex-1 flex-col md:flex-row">
        <Sidebar
          isConnected={isConnected}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
        <main className="app-main min-w-0 flex-1 p-3 sm:p-4 md:p-5 xl:p-7">
          <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6">
            {children}
          </div>
        </main>
      </div>
      <LegalFooter />
    </div>
  )
}
