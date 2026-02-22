import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Search,
  Plus,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Truck,
  Package,
  XCircle,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const statusConfig = {
  draft: { label: "Черновик", color: "bg-gray-100 text-gray-700", icon: Edit },
  confirmed: { label: "Подтвержден", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  in_production: { label: "В производстве", color: "bg-yellow-100 text-yellow-700", icon: Package },
  ready: { label: "Готов", color: "bg-green-100 text-green-700", icon: CheckCircle },
  delivered: { label: "Доставлен", color: "bg-emerald-100 text-emerald-700", icon: Truck },
  cancelled: { label: "Отменен", color: "bg-red-100 text-red-700", icon: XCircle }
};

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 100),
    initialData: [],
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id) => base44.entities.Order.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Order.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client_phone?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    draft: orders.filter(o => o.status === "draft").length,
    inProgress: orders.filter(o => ["confirmed", "in_production"].includes(o.status)).length,
    completed: orders.filter(o => ["ready", "delivered"].includes(o.status)).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Заказы
            </h1>
            <p className="text-gray-600 mt-1">Управление заказами и документами</p>
          </div>
          <Link to={createPageUrl("NewOrder")}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Новый заказ
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Всего заказов", value: stats.total, color: "blue" },
            { label: "Черновики", value: stats.draft, color: "gray" },
            { label: "В работе", value: stats.inProgress, color: "yellow" },
            { label: "Выполнено", value: stats.completed, color: "green" }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 text-${stat.color}-600`}>
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Поиск по имени, телефону или номеру заказа..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="all">Все</TabsTrigger>
                  <TabsTrigger value="draft">Черновик</TabsTrigger>
                  <TabsTrigger value="confirmed">Подтвержден</TabsTrigger>
                  <TabsTrigger value="in_production">В работе</TabsTrigger>
                  <TabsTrigger value="ready">Готов</TabsTrigger>
                  <TabsTrigger value="delivered">Доставлен</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Загрузка...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Заказы не найдены</p>
                <Link to={createPageUrl("NewOrder")}>
                  <Button className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать заказ
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>№ Заказа</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Позиции</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const StatusIcon = statusConfig[order.status]?.icon || Clock;
                      return (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {order.order_number || `#${order.id.slice(-6)}`}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.client_name}</p>
                              <p className="text-sm text-gray-500">{order.client_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.items?.length || 0} поз.
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {order.total?.toLocaleString()} сум
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig[order.status]?.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig[order.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {order.created_date && format(new Date(order.created_date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Просмотр
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Редактировать
                                </DropdownMenuItem>
                                {order.status === "draft" && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: "confirmed" })}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Подтвердить
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => deleteOrderMutation.mutate(order.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Удалить
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}