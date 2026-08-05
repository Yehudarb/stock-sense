const VARIANTS = {
  primary: 'border border-primary bg-primary text-surface hover:brightness-105',
  secondary: 'border border-white/12 bg-surface-muted/45 text-white hover:border-white/20 hover:bg-surface-bright/55',
  ghost: 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white',
  positive: 'border border-emerald-400/20 bg-emerald-400/8 text-emerald-200 hover:bg-emerald-400/12',
}

const SIZES = {
  sm: 'min-h-9 px-3 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-5 py-3 text-sm sm:text-base',
}

export default function Button({
  children,
  className = '',
  disabled = false,
  type = 'button',
  variant = 'primary',
  size = 'md',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
