import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Plus, Trash2, Save, ShoppingCart, Maximize2, Grid3X3, DoorOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WindowVisualizer from "@/components/calculator/WindowVisualizer";
import CalculationSummary from "@/components/calculator/CalculationSummary";

export default function CalculatorPage() {
  const [productType, setProductType] = useState("window");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 1400, height: 1600 });
  const [sections, setSections] = useState(2);
  const [openingType, setOpeningType] = useState("tilt-turn");
  const [hasMosquitoNet, setHasMosquitoNet] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [cartItems, setCartItems] = useState([]);

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', productType],
    queryFn: () => base44.entities.Profile.filter({ type: productType, is_active: true }),
    initialData: [],
  });

  const calculatePrice = () => {
    if (!selectedProfile) return 0;
    
    const widthM = dimensions.width / 1000;
    const heightM = dimensions.height / 1000;
    const perimeter = 2 * (widthM + heightM);
    const area = widthM * heightM;
    
    const profileCost = perimeter * (selectedProfile.price_per_meter || 5000);
    const glassCost = area * (selectedProfile.glass_price_per_sqm || 15000);
    const fittingCost = sections * (selectedProfile.fitting_price || 8000);
    const mosquitoNetCost = hasMosquitoNet ? area * 3000 : 0;
    
    return Math.round(profileCost + glassCost + fittingCost + mosquitoNetCost);
  };

  const unitPrice = calculatePrice();
  const totalPrice = unitPrice * quantity;

  const addToCart = () => {
    if (!selectedProfile) return;
    
    const item = {
      id: Date.now(),
      profile_id: selectedProfile.id,
      profile_name: selectedProfile.name,
      brand: selectedProfile.brand,
      type: productType,
      width: dimensions.width,
      height: dimensions.height,
      sections,
      opening_type: openingType,
      has_mosquito_net: hasMosquitoNet,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice
    };
    
    setCartItems([...cartItems, item]);
  };

  const removeFromCart = (id) => {
    setCartItems(cartItems.filter(item => item.id !== id));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600" />
            Калькулятор
          </h1>
          <p className="text-gray-600 mt-1">Расчет стоимости окон и дверей</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calculator Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Type Tabs */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Тип продукта</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={productType} onValueChange={setProductType}>
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="window" className="flex items-center gap-2">
                      <Maximize2 className="w-4 h-4" />
                      Окно
                    </TabsTrigger>
                    <TabsTrigger value="door" className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4" />
                      Дверь
                    </TabsTrigger>
                    <TabsTrigger value="balcony" className="flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4" />
                      Балкон
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Profile Selection */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Выбор профиля</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProfiles ? (
                  <div className="text-center py-8 text-gray-500">Загрузка профилей...</div>
                ) : profiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Нет доступных профилей. Добавьте их в разделе "Профили".
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {profiles.map((profile) => (
                      <motion.div
                        key={profile.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedProfile(profile)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedProfile?.id === profile.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        {profile.image_url && (
                          <img
                            src={profile.image_url}
                            alt={profile.name}
                            className="w-full h-20 object-contain mb-2"
                          />
                        )}
                        <p className="font-medium text-sm">{profile.name}</p>
                        <p className="text-xs text-gray-500">{profile.brand}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {profile.price_per_meter?.toLocaleString()} сум/м
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dimensions */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Размеры и параметры</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Ширина (мм)</Label>
                    <Input
                      type="number"
                      value={dimensions.width}
                      onChange={(e) => setDimensions({ ...dimensions, width: parseInt(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Высота (мм)</Label>
                    <Input
                      type="number"
                      value={dimensions.height}
                      onChange={(e) => setDimensions({ ...dimensions, height: parseInt(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Секции</Label>
                    <Select value={sections.toString()} onValueChange={(v) => setSections(parseInt(v))}>
                      <SelectTrigger className="mt-1">
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
                    <Label className="text-sm text-gray-600">Количество</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Тип открывания</Label>
                    <Select value={openingType} onValueChange={setOpeningType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Глухое</SelectItem>
                        <SelectItem value="tilt">Откидное</SelectItem>
                        <SelectItem value="turn">Поворотное</SelectItem>
                        <SelectItem value="tilt-turn">Поворотно-откидное</SelectItem>
                        <SelectItem value="sliding">Раздвижное</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <Label className="text-sm">Москитная сетка</Label>
                    <Switch
                      checked={hasMosquitoNet}
                      onCheckedChange={setHasMosquitoNet}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visualizer */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Визуализация</CardTitle>
              </CardHeader>
              <CardContent>
                <WindowVisualizer
                  width={dimensions.width}
                  height={dimensions.height}
                  sections={sections}
                  type={productType}
                  openingType={openingType}
                />
              </CardContent>
            </Card>
          </div>

          {/* Summary Panel */}
          <div className="space-y-6">
            <CalculationSummary
              selectedProfile={selectedProfile}
              dimensions={dimensions}
              sections={sections}
              openingType={openingType}
              hasMosquitoNet={hasMosquitoNet}
              quantity={quantity}
              unitPrice={unitPrice}
              totalPrice={totalPrice}
              onAddToCart={addToCart}
            />

            {/* Cart */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  Корзина
                  {cartItems.length > 0 && (
                    <Badge className="ml-2 bg-blue-100 text-blue-600">
                      {cartItems.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cartItems.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Корзина пуста
                  </p>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {cartItems.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          className="p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{item.profile_name}</p>
                              <p className="text-xs text-gray-500">
                                {item.width}×{item.height} мм · {item.quantity} шт
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-500"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-sm font-semibold text-blue-600 mt-1">
                            {item.total_price.toLocaleString()} сум
                          </p>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    <Separator />

                    <div className="flex justify-between items-center font-bold">
                      <span>Итого:</span>
                      <span className="text-xl text-blue-600">
                        {cartTotal.toLocaleString()} сум
                      </span>
                    </div>

                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      <Save className="w-4 h-4 mr-2" />
                      Оформить заказ
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}