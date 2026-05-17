import { useEffect, useRef } from 'react'

export default function ChartContainer({
  title,
  subtitle,
  headerRight,
  children,
  height = 'h-48',
  className = '',
  bodyClassName = '',
  style,
  bodyStyle,
  onWheel,
}) {
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
    <section
      className={`relative overflow-hidden rounded-[28px] border border-white/8 bg-slate-950/80 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur ${className}`}
      style={style}
    >
      {(title || subtitle || headerRight) && (
        <div className="flex flex-col gap-3 border-b border-white/6 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            {title && <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</div>}
            {subtitle && <div className="mt-1 text-sm text-slate-300">{subtitle}</div>}
          </div>
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      )}
      <div ref={bodyRef} className={`${height} overscroll-contain px-2 py-2 sm:px-3 sm:py-3 ${bodyClassName}`} style={bodyStyle}>{children}</div>
    </section>
  )
}
