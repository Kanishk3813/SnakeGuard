import { DashboardStats } from '@/types';

interface DashboardStatsProps {
  stats: DashboardStats;
}

export default function DashboardStatsComponent({ stats }: DashboardStatsProps) {
  const statCards = [
    {
      title: 'Total Detections',
      value: stats.totalDetections,
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      color: 'bg-blue-100 text-blue-800',
      iconColor: 'text-blue-500',
    },
    {
      title: 'Recent Detections (24h)',
      value: stats.recentDetections,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-yellow-100 text-yellow-800',
      iconColor: 'text-yellow-500',
    },
    {
      title: 'High Confidence',
      value: stats.highConfidenceDetections,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-100 text-green-800',
      iconColor: 'text-green-500',
    },
    {
      title: 'Avg. Confidence',
      value: `${(stats.avgConfidence * 100).toFixed(1)}%`,
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      color: 'bg-purple-100 text-purple-800',
      iconColor: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card) => (
        <div
          key={card.title}
          className={`p-6 rounded-lg shadow-sm ${card.color} flex items-center`}
        >
          <div className={`p-3 rounded-full ${card.iconColor} bg-white bg-opacity-30`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={card.icon}
              />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium">{card.title}</h3>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}