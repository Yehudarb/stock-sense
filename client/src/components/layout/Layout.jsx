import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout({ children, isConnected }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 md:h-screen">
      <Header isConnected={isConnected} />
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row md:overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-3 md:min-h-0 md:p-3">{children}</main>
      </div>
    </div>
  )
}
