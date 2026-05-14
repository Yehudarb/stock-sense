export default function SectionTitle({ eyebrow, title, subtitle, align = 'left' }) {
  const alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start'

  return (
    <div className={`flex flex-col gap-2 ${alignClass}`}>
      {eyebrow && <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">{eyebrow}</span>}
      {title && <h2 className="max-w-3xl text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>}
      {subtitle && <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{subtitle}</p>}
    </div>
  )
}
