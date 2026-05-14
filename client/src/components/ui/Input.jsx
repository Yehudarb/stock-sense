export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-2xl border border-white/10 bg-surface-muted/45 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-primary/50 focus:bg-surface-muted/65 ${className}`}
      {...props}
    />
  )
}
