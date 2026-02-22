import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calculator,
  ShoppingCart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [clientData, setClientData] = useState({
    client_name: "",
    client_phone: "",
    client_address: ""
  });
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    profile_id: "",
    width: 1400,
    height: 1600,
    sections: 2,
    opening_type: "tilt-turn",
    has_mosquito_net: false,
    quantity: 1
  });
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.filter({ is_active: true }),
    initialData: [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 100),
    initialData: [],
  });

  const createOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => {
      navigate(createPageUrl("Orders"));
    },
  });

  const calculateItemPrice = (item, profile) => {
    if (!profile) return 0;
    const widthM = item.width / 1000;
    const heightM = item.height / 1000;
    const perimeter = 2 * (widthM + heightM);
    const area = widthM * heightM;
    
    const profileCost = perimeter * (profile.price_per_meter || 5000);
    const glassCost = area * (profile.glass_price_per_sqm || 15000);
    const fittingCost = item.sections * (profile.fitting_price || 8000);
    const mosquitoNetCost = item.has_mosquito_net ? area * 3000 : 0;
    
    return Math.round((profileCost + glassCost + fittingCost + mosquitoNetCost) * item.quantity);
  };

  const addItem = () => {
    const profile = profiles.find(p => p.id === newItem.profile_id);
    if (!profile) return;

    const totalPrice = calculateItemPrice(newItem, profile);
    
    setItems([...items, {
      ...newItem,
      id: Date.now(),
      profile_name: profile.name,
      type: profile.type,
      unit_price: totalPrice / newItem.quantity,
      total_price: totalPrice
    }]);

    setNewItem({
      profile_id: "",
      width: 1400,
      height: 1600,
      sections: 2,
      opening_type: "tilt-turn",
      has_mosquito_net: false,
      quantity: 1
    });
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  const handleSubmit = () => {
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
    
    createOrderMutation.mutate({
      order_number: orderNumber,
      ...clientData,
      items: items.map(({ id, ...rest }) => rest),
      subtotal,
      discount_percent: discount,
      discount_amount: discountAmount,
      total,
      status: "draft",
      notes
    });
  };

  const selectClient = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setClientData({
        client_id: client.id,
        client_name: client.full_name,
        client_phone: client.phone,
        client_address: client.address || ""
      });
    }
  };

  const openingTypes = {
    fixed: "Глухое",
    tilt: "Откидное",
    turn: "Поворотное",
    "tilt-turn": "Поворотно-откидное",
    sliding: "Раздвижное"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate(createPageUrl("Orders"))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Новый заказ
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client Info */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Информация о клиенте
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Выбрать существующего клиента</Label>
                  <Select onValueChange={selectClient}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Выберите клиента" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.full_name} - {client.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>ФИО *</Label>
                    <Input
                      value={clientData.client_name}
                      onChange={(e) => setClientData({ ...clientData, client_name: e.target.value })}
                      placeholder="Иванов Иван"
                    />
                  </div>
                  <div>
                    <Label>Телефон *</Label>
                    <Input
                      value={clientData.client_phone}
                      onChange={(e) => setClientData({ ...clientData, client_phone: e.target.value })}
                      placeholder="+998 90 123 45 67"
                    />
                  </div>
                </div>
                <div>
                  <Label>Адрес</Label>
                  <Input
                    value={clientData.client_address}
                    onChange={(e) => setClientData({ ...clientData, client_address: e.target.value })}
                    placeholder="г. Ташкент, ул. Навои, 15"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Item */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  Добавить позицию
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Профиль *</Label>
                  <Select
                    value={newItem.profile_id}
                    onValueChange={(v) => setNewItem({ ...newItem, profile_id: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Выберите профиль" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.brand}) - {profile.price_per_meter?.toLocaleString()} сум/м
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Ширина (мм)</Label>
                    <Input
                      type="number"
                      value={newItem.width}
                      onChange={(e) => setNewItem({ ...newItem, width: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Высота (мм)</Label>
                    <Input
                      type="number"
                      value={newItem.height}
                      onChange={(e) => setNewItem({ ...newItem, height: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Секции</Label>
                    <Select
                      value={newItem.sections.toString()}
                      onValueChange={(v) => setNewItem({ ...newItem, sections: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Тип открывания</Label>
                  <Select
                    value={newItem.opening_type}
                    onValueChange={(v) => setNewItem({ ...newItem, opening_type: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(openingTypes).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addItem} disabled={!newItem.profile_id} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить позицию
                </Button>
              </CardContent>
            </Card>

            {/* Items List */}
            {items.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    Позиции заказа
                    <Badge className="ml-2">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          className="p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{item.profile_name}</p>
                              <p className="text-sm text-gray-500">
                                {item.width}×{item.height} мм · {item.sections} секц. · {openingTypes[item.opening_type]} · {item.quantity} шт
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-blue-600">
                                {item.total_price.toLocaleString()} сум
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Примечания</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Дополнительная информация к заказу..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div>
            <Card className="border-0 shadow-lg sticky top-24">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
                <CardTitle className="text-lg">Итого по заказу</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Позиций:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Сумма:</span>
                  <span className="font-medium">{subtotal.toLocaleString()} сум</span>
                </div>
                <div>
                  <Label>Скидка (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Скидка:</span>
                    <span>-{discountAmount.toLocaleString()} сум</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">Итого:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {total.toLocaleString()} сум
                  </span>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={items.length === 0 || !clientData.client_name || !clientData.client_phone}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  Создать заказ
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}