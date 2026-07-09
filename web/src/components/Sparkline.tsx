interface Props {
  values: number[]   // 0–100
  width?: number
  height?: number
  color?: string
}

/** Tiny SVG sparkline — no deps. Fills its container width; `width` is only the
 *  coordinate space for the path. */
export default function Sparkline({ values, width = 160, height = 36, color = '#aa3bff' }: Props) {
  if (values.length < 2) {
    return <svg width="100%" height={height} style={{ display: 'block' }} />
  }
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - (v / max) * height
    return `${x},${y}`
  })
  const path = `M ${pts.join(' L ')}`
  const area = `M ${pts[0]} L ${pts.join(' L ')} L ${width},${height} L 0,${height} Z`

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
