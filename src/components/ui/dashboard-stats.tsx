'use client';

import { useEffect, useState, useRef } from 'react';
import { DashboardStats } from '@/types';

interface DashboardStatsProps {
  stats: DashboardStats;
}

function AnimatedNumber({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current && value === display) return;
    hasAnimated.current = true;

    const duration = 1200;
    const startTime = performance.now();
    const startValue = display;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (value - startValue) * eased;
      setDisplay(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span ref={ref}>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
      {suffix}
    </span>
  );
}

export default function DashboardStatsComponent({ stats }: DashboardStatsProps) {
  const statCards = [
    {
      title: 'Total Detections',
      value: stats.totalDetections,
      suffix: '',
      decimals: 0,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      accentColor: 'border-blue-100',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Recent Detections (24h)',
      value: stats.recentDetections,
      suffix: '',
      decimals: 0,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      accentColor: 'border-amber-100',
      trend: null,
      trendUp: false,
    },
    {
      title: 'High Confidence',
      value: stats.highConfidenceDetections,
      suffix: '',
      decimals: 0,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      accentColor: 'border-emerald-100',
      trend: null,
      trendUp: true,
    },
    {
      title: 'Avg. Confidence',
      value: stats.avgConfidence * 100,
      suffix: '%',
      decimals: 1,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-500',
      accentColor: 'border-violet-100',
      trend: null,
      trendUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, index) => (
        <div
          key={card.title}
          className={`
            stat-card-enter bg-white rounded-2xl p-5 border ${card.accentColor}
            hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300
            cursor-default relative overflow-hidden group
          `}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {/* Subtle gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className={`${card.iconBg} ${card.iconColor} p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110`}>
                {card.icon}
              </div>
              {card.trend && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${card.trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {card.trend}
                </span>
              )}
            </div>

            <div className="text-2xl font-bold text-gray-900 tracking-tight">
              <AnimatedNumber value={card.value} suffix={card.suffix} decimals={card.decimals} />
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">{card.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}