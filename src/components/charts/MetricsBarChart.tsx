'use client';

import './ChartSetup';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';

interface MetricsBarChartProps {
  labels: string[];
  data: number[];
  label: string;
  horizontal?: boolean;
}

export default function MetricsBarChart({ labels, data: values, label, horizontal }: MetricsBarChartProps) {
  const data = {
    labels,
    datasets: [{
      label,
      data: values,
      backgroundColor: '#FF6B2C',
      borderRadius: 4,
      maxBarThickness: 40,
    }],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { color: '#2a2a2a' }, beginAtZero: true },
      y: { grid: { color: '#2a2a2a' }, beginAtZero: true },
    },
  };

  return (
    <div className="h-64">
      <Bar data={data} options={options} />
    </div>
  );
}
