import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Info, Check } from "lucide-react";

export default function CalculationSummary({
  selectedProfile,
  dimensions,
  sections,
  openingType,
  hasMosquitoNet,
  quantity,
  unitPrice,
  totalPrice,
  onAddToCart
}) {
  const openingTypes = {
    fixed: "Глухое",
    tilt: "Откидное",
    turn: "Поворотное",
    "tilt-turn": "Поворотно-откидное",
    sliding: "Раздвижное"
  };

  return (
    <Card className="shadow-lg border-0 sticky top-24">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
        <CardTitle className="text-lg">Расчет стоимости</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {!selectedProfile ? (
          <div className="text-center py-8">
            <Info className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              Выберите профиль для расчета стоимости
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile Info */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-sm text-gray-900">{selectedProfile.name}</p>
              <p className="text-xs text-gray-500">{selectedProfile.brand}</p>
            </div>

            {/* Parameters */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Размеры:</span>
                <span className="font-medium">{dimensions.width} × {dimensions.height} мм</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Площадь:</span>
                <span className="font-medium">
                  {((dimensions.width * dimensions.height) / 1000000).toFixed(2)} м²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Секции:</span>
                <span className="font-medium">{sections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Открывание:</span>
                <span className="font-medium">{openingTypes[openingType]}</span>
              </div>
              {hasMosquitoNet && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Москитная сетка:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="w-3 h-3 mr-1" />
                    Да
                  </Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Количество:</span>
                <span className="font-medium">{quantity} шт</span>
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Цена за единицу:</span>
                <span className="font-medium">{unitPrice.toLocaleString()} сум</span>
              </div>
              {quantity > 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">× {quantity} шт:</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">Итого:</span>
              <span className="text-2xl font-bold text-blue-600">
                {totalPrice.toLocaleString()} сум
              </span>
            </div>

            <Button
              onClick={onAddToCart}
              className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Добавить в корзину
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}