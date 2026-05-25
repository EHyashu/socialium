/* ===== Reusable Chart Components for Analytics ===== */

/* Sparkline Chart */
export function SparkLine({ data, color = "#6366f1", height = 60 }: { data: any[]; color?: string; height?: number }) {
  if (!data || data.length === 0) return null;
  
  const width = 300;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / (max - min)) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#gradient-${color.replace('#', '')})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Bar Chart */
export function BarChart({ data, height = 200 }: { data: any[]; height?: number }) {
  if (!data || data.length === 0) return null;
  
  const width = 600;
  const max = Math.max(...data.map(d => d.value || d.engagement_rate || d.posts || 0), 1);
  const barWidth = (width / data.length) * 0.7;
  const gap = (width / data.length) * 0.3;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const value = d.value || d.engagement_rate || d.posts || 0;
        const barHeight = (value / max) * (height - 40);
        const x = i * (barWidth + gap) + gap / 2;
        const y = height - barHeight - 30;
        
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill="#6366f1"
              opacity="0.8"
            />
            <text
              x={x + barWidth / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="12"
              style={{ fill: 'var(--text-secondary)' }}
            >
              {d.platform || d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Donut Chart */
export function DonutChart({ data, size = 200 }: { data: any[]; size?: number }) {
  if (!data || data.length === 0) return null;
  
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const total = data.reduce((sum, d) => sum + (d.value || d.posts || d.likes || 0), 0);
  const radius = size / 2 - 20;
  const center = size / 2;
  
  let currentAngle = -Math.PI / 2;
  
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: size }}>
      {data.map((d, i) => {
        const value = d.value || d.posts || d.likes || 0;
        const angle = (value / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;
        
        const x1 = center + radius * Math.cos(startAngle);
        const y1 = center + radius * Math.sin(startAngle);
        const x2 = center + radius * Math.cos(endAngle);
        const y2 = center + radius * Math.sin(endAngle);
        
        const largeArc = angle > Math.PI ? 1 : 0;
        
        const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        
        return (
          <path
            key={i}
            d={path}
            fill={colors[i % colors.length]}
            stroke="var(--bg-primary)"
            strokeWidth="2"
          />
        );
      })}
      <circle cx={center} cy={center} r={radius * 0.6} fill="var(--bg-card)" />
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="24"
        fontWeight="bold"
        style={{ fill: 'var(--text-primary)' }}
      >
        {total}
      </text>
    </svg>
  );
}
