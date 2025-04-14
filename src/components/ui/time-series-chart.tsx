import { useEffect, useRef } from 'react';
import { TimeSeriesData } from '@/types';

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  title: string;
  height?: string;
}

export default function TimeSeriesChart({ data, title, height = '300px' }: TimeSeriesChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data?.length || !chartRef.current) return;

    const renderChart = async () => {
      try {
        const d3 = await import('d3');
        
        d3.select(chartRef.current).selectAll('*').remove();
        
        const margin = { top: 30, right: 30, bottom: 50, left: 50 };
        const width = (chartRef.current?.clientWidth || 0) - margin.left - margin.right;
        const chartHeight = parseInt(height) - margin.top - margin.bottom;
        
        const svg = d3.select(chartRef.current)
          .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', chartHeight + margin.top + margin.bottom)
          .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        
        const x = d3.scaleBand()
          .domain(data.map(d => d.date))
          .range([0, width])
          .padding(0.2);
        
        const maxDetections = Math.max(...data.map(d => d.detections), 1);
        const y = d3.scaleLinear()
          .domain([0, maxDetections * 1.1]) 
          .range([chartHeight, 0]);
   
        svg.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(x)
            .tickFormat(d => formatDate(d as string)))
          .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em');
        
        svg.append('g')
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => d.toString()));
        
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -margin.left + 15)
          .attr('x', -chartHeight / 2)
          .attr('text-anchor', 'middle')
          .text('Detections')
          .attr('fill', '#4B5563');
        
        const gradient = svg.append('defs')
          .append('linearGradient')
          .attr('id', 'bar-gradient')
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', chartHeight)
          .attr('x2', 0)
          .attr('y2', 0);
          
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', '#10B981');
          
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', '#047857');
        
        svg.selectAll('.bar')
          .data(data)
          .enter()
          .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.date) as number)
            .attr('width', x.bandwidth())
            .attr('y', d => y(d.detections))
            .attr('height', d => chartHeight - y(d.detections))
            .attr('fill', 'url(#bar-gradient)')
            .attr('rx', 4)
            .on('mouseover', function(event, d) {
              d3.select(this).attr('opacity', 0.8);
              
              tooltip
                .style('visibility', 'visible')
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 20}px`)
                .html(`<strong>${formatDate(d.date)}</strong><br>${d.detections} detection${d.detections !== 1 ? 's' : ''}`);
            })
            .on('mouseout', function() {
              d3.select(this).attr('opacity', 1);
              tooltip.style('visibility', 'hidden');
            });
        
        const line = d3.line<TimeSeriesData>()
          .x(d => (x(d.date) as number) + x.bandwidth() / 2)
          .y(d => y(d.detections))
          .curve(d3.curveMonotoneX);
        
        svg.append('path')
          .datum(data)
          .attr('fill', 'none')
          .attr('stroke', '#059669')
          .attr('stroke-width', 3)
          .attr('d', line);
        
        svg.selectAll('.dot')
          .data(data)
          .enter()
          .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => (x(d.date) as number) + x.bandwidth() / 2)
            .attr('cy', d => y(d.detections))
            .attr('r', 5)
            .attr('fill', '#059669')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('padding', '8px')
          .style('background', 'rgba(0, 0, 0, 0.7)')
          .style('color', 'white')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('visibility', 'hidden')
          .style('z-index', '100');
          
      } catch (error) {
        console.error('Error rendering chart:', error);
      }
    };

    renderChart();

    const handleResize = () => {
      if (chartRef.current) {
        renderChart();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, height]);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div 
        ref={chartRef} 
        className="w-full"
        style={{ height }}
      >
        {(!data || data.length === 0) && (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}