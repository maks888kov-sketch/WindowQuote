import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  Package,
  Calendar
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
    initialData: [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
    initialData: [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list(),
    initialData: [],
  });

  // Calculate statistics
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const completedOrders = orders.filter(o => ['ready', 'delivered'].includes(o.status));
  const completedRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  // Orders by status
  const statusData = [
    { name: 'Черновик', value: orders.filter(o => o.status === 'draft').length, color: '#94a3b8' },
    { name: 'Подтвержден', value: orders.filter(o => o.status === 'confirmed').length, color: '#3b82f6' },
    { name: 'В производстве', value: orders.filter(o => o.status === 'in_production').length, color: '#f59e0b' },
    { name: 'Готов', value: orders.filter(o => o.status === 'ready').length, color: '#10b981' },
    { name: 'Доставлен', value: orders.filter(o => o.status === 'delivered').length, color: '#22c55e' },
    { name: 'Отменен', value: orders.filter(o => o.status === 'cancelled').length, color: '#ef4444' }
  ].filter(s => s.value > 0);

  // Revenue by day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayOrders = orders.filter(o => {
      if (!o.created_date) return false;
      const orderDate = new Date(o.created_date);
      return format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    });
    return {
      date: format(date, 'dd.MM'),
      revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      orders: dayOrders.length
    };
  });

  // Top profiles by revenue
  const profileRevenue = {};
  orders.forEach(order => {
    order.items?.forEach(item => {
      const key = item.profile_name || 'Неизвестно';
      profileRevenue[key] = (profileRevenue[key] || 0) + (item.total_price || 0);
    });
  });
  const topProfiles = Object.entries(profileRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Monthly comparison
  const thisMonth = orders.filter(o => {
    if (!o.created_date) return false;
    const date = new Date(o.created_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const lastMonth = orders.filter(o => {
    if (!o.created_date) return false;
    const date = new Date(o.created_date);
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
  });

  const thisMonthRevenue = thisMonth.reduce((sum, o) => sum + (o.total || 0), 0);
  const lastMonthRevenue = lastMonth.reduce((sum, o) => sum + (o.total || 0), 0);
  const revenueChange = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;

  const stats = [
    {
      label: "Общая выручка",
      value: totalRevenue.toLocaleString() + " сум",
      icon: DollarSign,
      color: "blue",
      change: revenueChange > 0 ? `+${revenueChange.toFixed(1)}%` : `${revenueChange.toFixed(1)}%`,
      positive: revenueChange >= 0
    },
    {
      label: "Всего заказов",
      value: orders.length,
      icon: FileText,
      color: "green"
    },
    {
      label: "Клиентов",
      value: clients.length,
      icon: Users,
      color: "purple"
    },
    {
      label: "Средний чек",
      value: avgOrderValue.toLocaleString() + " сум",
      icon: TrendingUp,
      color: "orange"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Аналитика
          </h1>
          <p className="text-gray-600 mt-1">Статистика продаж и отчеты</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className={`text-2xl font-bold mt-1 text-${stat.color}-600`}>
                        {stat.value}
                      </p>
                      {stat.change && (
                        <div className={`flex items-center gap-1 mt-1 text-sm ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {stat.change}
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-xl bg-${stat.color}-100`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Выручка за 7 дней</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7Days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip
                      formatter={(value) => [`${value.toLocaleString()} сум`, 'Выручка']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders by Status */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Заказы по статусу</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Заказов']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Profiles */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Топ профили по выручке
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProfiles.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Нет данных</p>
              ) : (
                <div className="space-y-4">
                  {topProfiles.map((profile, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-medium`}
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{profile.name}</p>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${(profile.value / topProfiles[0].value) * 100}%`,
                              backgroundColor: COLORS[idx % COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                      <p className="font-semibold text-gray-700">
                        {profile.value.toLocaleString()} сум
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Последние заказы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.slice(0, 5).length === 0 ? (
                <p className="text-center text-gray-500 py-8">Нет заказов</p>
              ) : (
                <div className="space-y-4">
                  {orders.slice(0, 5).map((order, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{order.client_name}</p>
                        <p className="text-sm text-gray-500">
                          {order.created_date && format(new Date(order.created_date), "dd.MM.yyyy HH:mm")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">
                          {order.total?.toLocaleString()} сум
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {order.items?.length || 0} поз.
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}