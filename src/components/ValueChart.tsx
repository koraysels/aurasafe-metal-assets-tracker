'use client';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

type ValueChartProps = {
  historicalPrices: Array<{ date: string; price: number }>;
  totalWeight: number;
  currency: string;
};

export default function ValueChart({ historicalPrices, totalWeight, currency }: ValueChartProps) {
  if (!historicalPrices || historicalPrices.length === 0 || totalWeight === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 text-sm text-muted-foreground">
        No historical data available
      </div>
    );
  }

  const data = historicalPrices.map((p) => ({
    date: p.date,
    value: p.price * totalWeight,
  }));

  const firstValue = data[0]?.value || 0;
  const lastValue = data[data.length - 1]?.value || 0;
  const change = lastValue - firstValue;
  const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0;
  const isPositive = change >= 0;

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur-sm">
        <div className="text-xs text-muted-foreground">{new Date(data.date).toLocaleDateString()}</div>
        <div className="text-sm font-semibold">{formatValue(data.value)}</div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-xs uppercase text-muted-foreground">{historicalPrices.length} Day History</div>
        <div className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}
          {changePercent.toFixed(2)}%
        </div>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <YAxis domain={['dataMin - 100', 'dataMax + 100']} hide />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
