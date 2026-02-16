'use client'

import { useQuery } from '@tanstack/react-query'
import { getTrends, getPriorityDistribution } from '@/lib/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

const COLORS = {
  P1: '#dc2626',
  P2: '#ef4444',
  P3: '#f59e0b',
  P4: '#3b82f6',
  P5: '#64748b'
}

export default function AnalyticsPage() {
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends'],
    queryFn: getTrends,
  })

  const { data: priorityDist, isLoading: priorityLoading } = useQuery({
    queryKey: ['priority-distribution'],
    queryFn: getPriorityDistribution,
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Analytics</h1>
        <p className="text-cortex-muted">Performance insights and trends</p>
      </div>

      {/* Trends Chart */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-cortex-accent" />
          <h2 className="text-xl font-display font-bold">30-Day Ticket Trends</h2>
        </div>
        
        {trendsLoading ? (
          <div className="h-80 bg-cortex-bg animate-pulse rounded-lg"></div>
        ) : trends && trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={[...trends].reverse()}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
              />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#121827', 
                  border: '1px solid #1e293b',
                  borderRadius: '8px'
                }}
                labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
              />
              <Area 
                type="monotone" 
                dataKey="total_tickets" 
                stroke="#3b82f6" 
                fillOpacity={1}
                fill="url(#colorTotal)"
                name="Total Tickets"
              />
              <Area 
                type="monotone" 
                dataKey="high_priority" 
                stroke="#ef4444" 
                fillOpacity={1}
                fill="url(#colorHigh)"
                name="High Priority"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-12 text-cortex-muted">No trend data available</p>
        )}
      </div>

      {/* Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-display font-bold mb-6">Priority Distribution</h2>
          
          {priorityLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-lg"></div>
          ) : priorityDist && priorityDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityDist}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ priority, count }) => `${priority}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="priority"
                >
                  {priorityDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.priority] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#121827', 
                    border: '1px solid #1e293b',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-cortex-muted">No distribution data available</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-display font-bold mb-6">SLA by Priority</h2>
          
          {priorityLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-lg"></div>
          ) : priorityDist && priorityDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="priority" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#121827', 
                    border: '1px solid #1e293b',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="avg_sla_consumption" 
                  fill="#3b82f6"
                  name="Avg SLA %"
                >
                  {priorityDist.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.priority] || '#64748b'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-cortex-muted">No SLA data available</p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {priorityDist && priorityDist.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-display font-bold mb-6">Priority Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {priorityDist.map((item) => (
              <div key={item.priority} className="p-4 bg-cortex-bg rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[item.priority] }}
                  ></div>
                  <span className="font-semibold">{item.priority}</span>
                </div>
                <p className="text-3xl font-display font-bold mb-1">{item.count}</p>
                <p className="text-sm text-cortex-muted">
                  Avg SLA: {item.avg_sla_consumption || 0}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
