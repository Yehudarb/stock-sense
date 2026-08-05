export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`min-h-12 w-full rounded-xl border border-white/12 bg-surface-muted/35 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-primary/60 focus:bg-surface-muted/55 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  )
}
