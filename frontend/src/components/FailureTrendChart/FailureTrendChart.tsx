/**
 * Failure Trend Chart
 * Displays daily failure count trend with moving average
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Chip, Stack } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import Chart from 'chart.js/auto';

interface TimeSeriesPoint {
  date: string;
  count: number;
}

interface TrendData {
  direction: 'increasing' | 'decreasing' | 'stable';
  rateOfChange: number;
  movingAverage7d: number;
  movingAverage30d: number;
  percentChange7d: number;
  timeSeries: TimeSeriesPoint[];
}

const FailureTrendChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/v1/failure-archive/trends?days=30&groupBy=day', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setTrend(json.data);
      } catch {
        // Silently fail — chart just won't render
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  useEffect(() => {
    if (!trend || !canvasRef.current) return;

    // Destroy previous chart
    if (chartRef.current) chartRef.current.destroy();

    const labels = trend.timeSeries.map(p => p.date.slice(5)); // MM-DD
    const data = trend.timeSeries.map(p => p.count);

    // Compute 7-day moving average
    const ma7: (number | null)[] = data.map((_, i) => {
      if (i < 6) return null;
      const slice = data.slice(i - 6, i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Daily Failures',
            data,
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderRadius: 3,
            order: 2,
          },
          {
            label: '7-Day Avg',
            data: ma7,
            type: 'line',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#94a3b8', usePointStyle: true } },
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', stepSize: 1 },
            grid: { color: 'rgba(100,116,139,0.1)' },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [trend]);

  if (loading) {
    return (
      <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (!trend || trend.timeSeries.length === 0) return null;

  const TrendIcon = trend.direction === 'increasing' ? TrendingUp
    : trend.direction === 'decreasing' ? TrendingDown
    : TrendingFlat;

  const trendColor = trend.direction === 'increasing' ? 'error'
    : trend.direction === 'decreasing' ? 'success'
    : 'default';

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Failure Trends (30 Days)</Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            icon={<TrendIcon />}
            label={`${trend.direction} (${trend.percentChange7d > 0 ? '+' : ''}${trend.percentChange7d}% vs last week)`}
            color={trendColor}
            variant="outlined"
            size="small"
          />
          <Chip label={`7d avg: ${trend.movingAverage7d}`} size="small" variant="outlined" />
        </Stack>
      </Box>
      <Box sx={{ height: 280 }}>
        <canvas ref={canvasRef} />
      </Box>
    </Paper>
  );
};

export default FailureTrendChart;
