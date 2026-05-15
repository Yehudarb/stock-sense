import useStore from '../../store/useStore'

export default function LegalFooter() {
  const { language } = useStore()
  const isHebrew = language === 'he'

  return (
    <footer className="border-t border-white/6 bg-slate-950/85 px-4 py-5 text-xs text-slate-400">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="font-semibold text-slate-200">© 2026 StockSense Demo</div>
          <div>
            {isHebrew
              ? 'זהו כלי מידע בלבד, ולא ייעוץ השקעות. כל שימוש או מסחר נעשים באחריות המשתמש.'
              : 'This is an informational tool, not investment advice. All use and trading decisions remain at the user’s own risk.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="#terms" className="transition-colors hover:text-slate-200">{isHebrew ? 'תנאי שימוש' : 'Terms of Service'}</a>
          <a href="#privacy" className="transition-colors hover:text-slate-200">{isHebrew ? 'פרטיות' : 'Privacy Policy'}</a>
          <a href="#disclaimers" className="transition-colors hover:text-slate-200">{isHebrew ? 'הבהרות' : 'Disclaimers'}</a>
        </div>
      </div>
    </footer>
  )
}
