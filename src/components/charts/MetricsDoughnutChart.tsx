'use client';

import './ChartSetup';
import { Doughnut } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';

interface MetricsDoughnutChartProps {
  labels: string[];
  data: number[];
  colors?: string[];
}

const DEFAULT_COLORS = ['#FF6B2C', '#FF8C5A', '#E55A1F', '#6a6a6a', '#9a9a9a', '#404040', '#2a2a2a'];

export default function MetricsDoughnutChart({ labels, data: values, colors }: MetricsDoughnutChartProps) {
  const palette = colors || DEFAULT_COLORS;

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => palette[i % palette.length]),
      borderColor: '#000000',
      borderWidth: 2,
    }],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, padding: 12 },
      },
    },
    cutout: '60%',
  };

  return (
    <div className="h-64">
      <Doughnut data={data} options={options} />
    </div>
  );
}
