/** Graphique en barres pur SVG (sans dépendance) */
export function BarChart({
  data,
  color = '#f59e0b',
  height = 120,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = Math.max(280, data.length * 40);
  const barW = Math.min(28, (w - 20) / data.length - 6);
  const chartH = height - 28;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img">
      {data.map((d, i) => {
        const h = (d.value / max) * chartH;
        const x = 10 + i * ((w - 20) / data.length);
        const y = chartH - h + 4;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx={4} fill={color} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-stone-500"
              style={{ fontSize: 9 }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Sparkline({
  values,
  color = '#f59e0b',
  width = 120,
  height = 36,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <div className="h-9 w-28 bg-stone-800/50 rounded" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} strokeLinecap="round" />
    </svg>
  );
}
