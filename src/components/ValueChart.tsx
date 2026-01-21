'use client';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type ValueChartProps = {
  goldPrices: Array<{ date: string; price: number }>;
  silverPrices: Array<{ date: string; price: number }>;
  goldWeight: number;
  silverWeight: number;
  currency: string;
  range: 'week' | 'month' | 'year' | 'all';
  firstPurchaseDate: string | null;
  totalBasis: number;
};

export default function ValueChart({
  goldPrices,
  silverPrices,
  goldWeight,
  silverWeight,
  currency,
  range,
  firstPurchaseDate,
  totalBasis,
}: ValueChartProps) {
  const hasData =
    (goldPrices.length > 0 && goldWeight > 0) || (silverPrices.length > 0 && silverWeight > 0);

  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 text-sm text-muted-foreground">
        No historical data available
      </div>
    );
  }

  // Calculate cutoff date string based on range
  const now = new Date();
  let cutoffDateStr: string | null = null;

  if (range === 'week') {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    cutoffDateStr = date.toISOString().split('T')[0];
  } else if (range === 'month') {
    const date = new Date(now);
    date.setMonth(date.getMonth() - 1);
    cutoffDateStr = date.toISOString().split('T')[0];
  } else if (range === 'year') {
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - 1);
    cutoffDateStr = date.toISOString().split('T')[0];
  } else if (range === 'all' && firstPurchaseDate) {
    cutoffDateStr = firstPurchaseDate;
  }

  // Create a map of dates to prices for both metals
  const goldMap = new Map(goldPrices.map((p) => [p.date, p.price]));
  const silverMap = new Map(silverPrices.map((p) => [p.date, p.price]));

  // Get all unique dates and sort them
  let allDates = Array.from(new Set([...goldPrices.map((p) => p.date), ...silverPrices.map((p) => p.date)])).sort();

  // Filter dates based on range
  if (cutoffDateStr) {
    allDates = allDates.filter((date) => date >= cutoffDateStr);
  }

  // Check if we have data after filtering
  if (allDates.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 text-sm text-muted-foreground">
        No data available for this time range
      </div>
    );
  }

  // Combine data for both metals
  const data = allDates.map((date) => {
    const goldPrice = goldMap.get(date) || 0;
    const silverPrice = silverMap.get(date) || 0;
    const totalValue = goldPrice * goldWeight + silverPrice * silverWeight;

    return {
      date,
      value: totalValue,
    };
  });

  const firstValue = data[0]?.value || 0;
  const lastValue = data[data.length - 1]?.value || 0;
  const change = lastValue - firstValue;
  const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0;
  const isPositive = change >= 0;
  const profitPercent = totalBasis > 0 ? ((lastValue - totalBasis) / totalBasis) * 100 : 0;
  const profitPositive = profitPercent >= 0;

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

  const getRangeLabel = () => {
    if (range === 'week') return '7 Day History';
    if (range === 'month') return '30 Day History';
    if (range === 'year') return '1 Year History';
    if (range === 'all' && firstPurchaseDate) {
      return `Since ${new Date(firstPurchaseDate).toLocaleDateString()}`;
    }
    return `${data.length} Day History`;
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (range === 'week' || range === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    }
    if (range === 'year') {
      return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-xs uppercase text-muted-foreground">{getRangeLabel()}</div>
        <div className="text-right text-xs text-muted-foreground">
          <div className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}
            {changePercent.toFixed(2)}% <span className="text-[10px] uppercase">Price</span>
          </div>
          <div className={`text-sm font-semibold ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitPositive ? '+' : ''}
            {profitPercent.toFixed(2)}% <span className="text-[10px] uppercase">Profit</span>
          </div>
        </div>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={192}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 10, fill: 'rgb(148, 163, 184)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={12}
            />
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
