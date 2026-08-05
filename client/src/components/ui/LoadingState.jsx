import Card from './Card'
import useStore from '../../store/useStore'

export default function LoadingState({ title, subtitle, steps = [], hint }) {
  const { language } = useStore()
  const isHebrew = language === 'he'
  const activeIndex = Math.max(0, steps.findIndex(step => step.state !== 'done'))
  const statusCopy = isHebrew
    ? { done: 'הושלם', active: 'בתהליך', queued: 'ממתין' }
    : { done: 'Done', active: 'In progress', queued: 'Queued' }

  return (
    <Card className="loading-state rounded-2xl p-5 sm:p-6" aria-live="polite" aria-busy="true">
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-sm font-bold text-white">{title}</div>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>

        <div className="grid gap-3">
          {steps.map((step, index) => {
            const state = step.state
            const isActive = state === 'active' || (state !== 'done' && index === activeIndex)
            const dotClass = state === 'done'
              ? 'bg-primary'
              : isActive
                ? 'bg-amber-300 animate-pulse'
                : 'bg-slate-700'

            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                <div className="flex-1">
                  <div className={`text-sm ${state === 'done' ? 'text-white' : isActive ? 'text-slate-200' : 'text-slate-500'}`}>{step.label}</div>
                  {step.detail && <div className="text-xs text-slate-500">{step.detail}</div>}
                </div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-600">
                  {state === 'done' ? statusCopy.done : isActive ? statusCopy.active : statusCopy.queued}
                </span>
              </div>
            )
          })}
        </div>

        {hint && <div className="rounded-2xl border border-amber-300/10 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/80">{hint}</div>}
      </div>
    </Card>
  )
}
