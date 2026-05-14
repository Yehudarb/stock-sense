const VARIANTS = {
  primary: 'bg-primary text-surface hover:brightness-110 shadow-[0_10px_30px_rgba(34,211,238,0.18)]',
  secondary: 'border border-white/10 bg-surface-muted/45 text-white hover:bg-surface-bright/60',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white',
  positive: 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15',
}

const SIZES = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm sm:text-base',
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
