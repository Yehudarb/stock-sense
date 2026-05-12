import { useEffect, useRef } from 'react'

export default function ChartContainer({ title, children, height = 'h-48', onWheel }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    const element = bodyRef.current
    if (!element || !onWheel) return undefined

    const handleWheel = event => {
      onWheel(event)
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [onWheel])

  return (
    <div className="glass-panel rounded-xl p-4">
      {title && <div className="text-[11px] font-medium tracking-wide uppercase text-slate-400 mb-3">{title}</div>}
      <div ref={bodyRef} className={`${height} overscroll-contain`}>{children}</div>
    </div>
  )
}
