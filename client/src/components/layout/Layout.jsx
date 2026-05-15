import { useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import useStore from '../../store/useStore'
import LegalFooter from '../legal/LegalFooter'

export default function Layout({ children, isConnected }) {
  const { language, theme } = useStore()
  const isHebrew = language === 'he'

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.classList.toggle('theme-light', theme === 'light')
    body.classList.toggle('theme-light', theme === 'light')
    root.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="flex min-h-screen flex-col bg-surface md:h-screen" dir={isHebrew ? 'rtl' : 'ltr'} data-theme={theme}>
      <Header isConnected={isConnected} />
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row md:overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:min-h-0 md:p-6 lg:p-8">{children}</main>
      </div>
      <LegalFooter />
    </div>
  )
}
