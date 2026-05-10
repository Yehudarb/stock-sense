import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout({ children, isConnected }) {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <Header isConnected={isConnected} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-3">{children}</main>
      </div>
    </div>
  )
}
