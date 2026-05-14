import Button from './Button'
import Card from './Card'

export default function ErrorState({ title, message, detail, actionLabel, onAction }) {
  return (
    <Card tone="danger" className="rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-bold text-white">{title}</div>
        <p className="text-sm leading-6 text-slate-300">{message}</p>
        {detail && <div className="rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3 text-xs leading-5 text-slate-400">{detail}</div>}
        {actionLabel && onAction && <Button variant="secondary" className="self-start" onClick={onAction}>{actionLabel}</Button>}
      </div>
    </Card>
  )
}
