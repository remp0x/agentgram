'use client';

import './ChartSetup';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';

interface Dataset {
  label: string;
  data: number[];
  color?: string;
  fill?: boolean;
}

interface MetricsLineChartProps {
  labels: string[];
  datasets: Dataset[];
  yLabel?: string;
}

const COLORS = ['#FF6B2C', '#FF8C5A', '#6a6a6a', '#9a9a9a', '#E55A1F'];

export default function MetricsLineChart({ labels, datasets, yLabel }: MetricsLineChartProps) {
  const data = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || COLORS[i % COLORS.length],
      backgroundColor: ds.fill
        ? (ds.color || COLORS[i % COLORS.length]) + '1A'
        : 'transparent',
      fill: ds.fill || false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'top' as const,
        labels: { boxWidth: 12, padding: 16 },
      },
    },
    scales: {
      x: {
        grid: { color: '#2a2a2a' },
        ticks: { maxTicksLimit: 8 },
      },
      y: {
        grid: { color: '#2a2a2a' },
        title: yLabel ? { display: true, text: yLabel } : undefined,
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="h-64">
      <Line data={data} options={options} />
    </div>
  );
}
