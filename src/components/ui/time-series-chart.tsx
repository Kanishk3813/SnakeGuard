'use client';

import { useEffect, useRef, useState } from 'react';
import { TimeSeriesData } from '@/types';

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  title: string;
  height?: string;
}

export default function TimeSeriesChart({ data, title, height = '300px' }: TimeSeriesChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!data?.length || !chartRef.current) return;

    const renderChart = async () => {
      try {
        const d3 = await import('d3');

        d3.select(chartRef.current).selectAll('*').remove();

        const margin = { top: 20, right: 30, bottom: 50, left: 50 };
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
          .domain([0, maxDetections * 1.2])
          .range([chartHeight, 0]);

        // Grid lines (subtle)
        svg.selectAll('.grid-line')
          .data(y.ticks(5))
          .enter()
          .append('line')
          .attr('class', 'grid-line')
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', d => y(d))
          .attr('y2', d => y(d))
          .attr('stroke', '#f3f4f6')
          .attr('stroke-width', 1);

        // X axis
        svg.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(x)
            .tickFormat(d => formatDate(d as string)))
          .selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '.15em')
          .style('font-size', '11px')
          .style('fill', '#9ca3af');

        svg.selectAll('.domain').attr('stroke', '#e5e7eb');
        svg.selectAll('.tick line').attr('stroke', '#e5e7eb');

        // Y axis
        svg.append('g')
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => d.toString()))
          .selectAll('text')
          .style('font-size', '11px')
          .style('fill', '#9ca3af');

        // Y label
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -margin.left + 15)
          .attr('x', -chartHeight / 2)
          .attr('text-anchor', 'middle')
          .text('Detections')
          .attr('fill', '#9ca3af')
          .style('font-size', '12px');

        // Area fill under the line
        const areaGradient = svg.append('defs')
          .append('linearGradient')
          .attr('id', 'area-gradient')
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 0)
          .attr('y2', chartHeight);

        areaGradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', '#10B981')
          .attr('stop-opacity', 0.2);

        areaGradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', '#10B981')
          .attr('stop-opacity', 0.02);

        // Area
        const area = d3.area<TimeSeriesData>()
          .x(d => (x(d.date) as number) + x.bandwidth() / 2)
          .y0(chartHeight)
          .y1(d => y(d.detections))
          .curve(d3.curveMonotoneX);

        svg.append('path')
          .datum(data)
          .attr('fill', 'url(#area-gradient)')
          .attr('d', area)
          .attr('opacity', 0)
          .transition()
          .duration(800)
          .delay(200)
          .attr('opacity', 1);

        // Line
        const line = d3.line<TimeSeriesData>()
          .x(d => (x(d.date) as number) + x.bandwidth() / 2)
          .y(d => y(d.detections))
          .curve(d3.curveMonotoneX);

        const linePath = svg.append('path')
          .datum(data)
          .attr('fill', 'none')
          .attr('stroke', '#10B981')
          .attr('stroke-width', 2.5)
          .attr('d', line);

        // Animate line drawing
        const totalLength = (linePath.node() as SVGPathElement)?.getTotalLength() || 0;
        linePath
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1200)
          .ease(d3.easeQuadOut)
          .attr('stroke-dashoffset', 0);

        // Dots
        svg.selectAll('.dot')
          .data(data)
          .enter()
          .append('circle')
          .attr('class', 'dot')
          .attr('cx', d => (x(d.date) as number) + x.bandwidth() / 2)
          .attr('cy', d => y(d.detections))
          .attr('r', 0)
          .attr('fill', '#fff')
          .attr('stroke', '#10B981')
          .attr('stroke-width', 2.5)
          .transition()
          .duration(400)
          .delay((_, i) => 1000 + i * 80)
          .attr('r', 4.5);

        // Hover dots (invisible larger hit area)
        svg.selectAll('.dot-hover')
          .data(data)
          .enter()
          .append('circle')
          .attr('class', 'dot-hover')
          .attr('cx', d => (x(d.date) as number) + x.bandwidth() / 2)
          .attr('cy', d => y(d.detections))
          .attr('r', 20)
          .attr('fill', 'transparent')
          .style('cursor', 'pointer')
          .on('mouseover', function (event, d) {
            const dot = svg.selectAll('.dot')
              .filter((datum) => (datum as TimeSeriesData).date === d.date);
            dot.transition().duration(150).attr('r', 7).attr('fill', '#10B981');

            tooltip
              .style('visibility', 'visible')
              .style('left', `${event.pageX}px`)
              .style('top', `${event.pageY - 50}px`)
              .html(`
                <div style="font-weight:600;color:#111827;margin-bottom:2px">${formatDate(d.date)}</div>
                <div style="color:#6b7280">${d.detections} detection${d.detections !== 1 ? 's' : ''}</div>
              `);
          })
          .on('mouseout', function (event, d) {
            const dot = svg.selectAll('.dot')
              .filter((datum) => (datum as TimeSeriesData).date === d.date);
            dot.transition().duration(150).attr('r', 4.5).attr('fill', '#fff');

            tooltip.style('visibility', 'hidden');
          });

        // Tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'chart-tooltip-redesign')
          .style('position', 'absolute')
          .style('padding', '10px 14px')
          .style('background', 'white')
          .style('color', '#111827')
          .style('border-radius', '10px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('visibility', 'hidden')
          .style('z-index', '100')
          .style('box-shadow', '0 4px 20px rgba(0,0,0,0.12)')
          .style('border', '1px solid #e5e7eb')
          .style('transform', 'translateX(-50%)');

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
      // Clean up tooltip
      d3TooltipCleanup();
    };
  }, [data, height]);

  const d3TooltipCleanup = () => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.chart-tooltip-redesign').forEach(el => el.remove());
    }
  };

  return (
    <div className={`p-5 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-emerald-500 rounded-full" />
            <span className="text-[11px] text-gray-400">Detections</span>
          </div>
        </div>
      </div>
      <div
        ref={chartRef}
        className="w-full"
        style={{ height }}
      >
        {(!data || data.length === 0) && (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl">
            <p className="text-gray-400 text-sm">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}