'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface DataPoint {
  mes: string
  cantidad: number
}

interface OTsChartProps {
  data: DataPoint[]
}

export function OTsChart({ data }: OTsChartProps) {
  const maxVal = Math.max(...data.map((d) => d.cantidad), 1)

  return (
    <ResponsiveContainer width="100%" height={172}>
      <BarChart data={data} barSize={42} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f4" vertical={false} />
        <XAxis
          dataKey="mes"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9aa1ab', fontWeight: 600 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9aa1ab' }}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(232,101,10,0.06)' }}
          contentStyle={{
            background: '#fff',
            border: '1px solid #edeef1',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
          }}
          formatter={(value) => [String(value), 'OTs']}
        />
        <Bar dataKey="cantidad" radius={[5, 5, 2, 2]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.cantidad === maxVal ? '#E8650A' : '#FDD1B0'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
