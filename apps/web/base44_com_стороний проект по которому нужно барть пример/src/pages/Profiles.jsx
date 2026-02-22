import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Maximize2,
  DoorOpen,
  Grid3X3,
  Check,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    type: "window",
    chambers: 5,
    width_mm: 70,
    price_per_meter: 5000,
    glass_price_per_sqm: 15000,
    fitting_price: 8000,
    image_url: "",
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list('-created_date', 100),
    initialData: [],
  });

  const createProfileMutation = useMutation({
    mutationFn: (data) => base44.entities.Profile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      resetForm();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Profile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      resetForm();
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (id) => base44.entities.Profile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      brand: "",
      type: "window",
      chambers: 5,
      width_mm: 70,
      price_per_meter: 5000,
      glass_price_per_sqm: 15000,
      fitting_price: 8000,
      image_url: "",
      is_active: true
    });
    setEditingProfile(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProfile) {
      updateProfileMutation.mutate({ id: editingProfile.id, data: formData });
    } else {
      createProfileMutation.mutate(formData);
    }
  };

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name || "",
      brand: profile.brand || "",
      type: profile.type || "window",
      chambers: profile.chambers || 5,
      width_mm: profile.width_mm || 70,
      price_per_meter: profile.price_per_meter || 5000,
      glass_price_per_sqm: profile.glass_price_per_sqm || 15000,
      fitting_price: profile.fitting_price || 8000,
      image_url: profile.image_url || "",
      is_active: profile.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const typeIcons = {
    window: Maximize2,
    door: DoorOpen,
    balcony: Grid3X3
  };

  const typeLabels = {
    window: "Окно",
    door: "Дверь",
    balcony: "Балкон"
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch =
      profile.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || profile.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              Профили
            </h1>
            <p className="text-gray-600 mt-1">Каталог профилей и комплектующих</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => resetForm()}>
                <Plus className="w-5 h-5 mr-2" />
                Добавить профиль
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingProfile ? "Редактировать профиль" : "Новый профиль"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Название *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="AKFA Premium 70"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="brand">Бренд *</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="AKFA"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="type">Тип</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="window">Окно</SelectItem>
                        <SelectItem value="door">Дверь</SelectItem>
                        <SelectItem value="balcony">Балкон</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="chambers">Камеры</Label>
                    <Input
                      id="chambers"
                      type="number"
                      value={formData.chambers}
                      onChange={(e) => setFormData({ ...formData, chambers: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="width_mm">Ширина (мм)</Label>
                    <Input
                      id="width_mm"
                      type="number"
                      value={formData.width_mm}
                      onChange={(e) => setFormData({ ...formData, width_mm: parseInt(e.target.value) || 70 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price_per_meter">Цена за м. (сум)</Label>
                    <Input
                      id="price_per_meter"
                      type="number"
                      value={formData.price_per_meter}
                      onChange={(e) => setFormData({ ...formData, price_per_meter: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="glass_price">Стекло за м² (сум)</Label>
                    <Input
                      id="glass_price"
                      type="number"
                      value={formData.glass_price_per_sqm}
                      onChange={(e) => setFormData({ ...formData, glass_price_per_sqm: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fitting_price">Фурнитура (сум)</Label>
                    <Input
                      id="fitting_price"
                      type="number"
                      value={formData.fitting_price}
                      onChange={(e) => setFormData({ ...formData, fitting_price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="image_url">URL изображения</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <Label htmlFor="is_active">Активен</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Отмена
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingProfile ? "Сохранить" : "Добавить"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Поиск по названию или бренду..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                <TabsList>
                  <TabsTrigger value="all">Все</TabsTrigger>
                  <TabsTrigger value="window">Окна</TabsTrigger>
                  <TabsTrigger value="door">Двери</TabsTrigger>
                  <TabsTrigger value="balcony">Балконы</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Profiles Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : filteredProfiles.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Профили не найдены</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredProfiles.map((profile) => {
                const TypeIcon = typeIcons[profile.type] || Maximize2;
                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    layout
                  >
                    <Card className={`border-0 shadow-lg overflow-hidden ${!profile.is_active ? 'opacity-60' : ''}`}>
                      {profile.image_url && (
                        <div className="h-40 bg-gray-100">
                          <img
                            src={profile.image_url}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{profile.name}</h3>
                            <p className="text-sm text-gray-500">{profile.brand}</p>
                          </div>
                          <Badge className={profile.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {profile.is_active ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                            {profile.is_active ? 'Активен' : 'Неактивен'}
                          </Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{typeLabels[profile.type]}</span>
                            <Badge variant="outline" className="ml-auto">
                              {profile.chambers} камер
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Ширина: {profile.width_mm} мм
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-lg mb-4">
                          <div className="text-sm font-medium text-blue-600">
                            {profile.price_per_meter?.toLocaleString()} сум/м
                          </div>
                          <div className="text-xs text-gray-500">
                            Стекло: {profile.glass_price_per_sqm?.toLocaleString()} сум/м²
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEdit(profile)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Изменить
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => deleteProfileMutation.mutate(profile.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}