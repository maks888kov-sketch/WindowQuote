import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings,
  User,
  Users,
  Shield,
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building2,
  Save
} from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
    enabled: currentUser?.role === 'admin'
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleInviteUser = async () => {
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteEmail("");
      setInviteRole("user");
      setIsInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      console.error("Error inviting user:", error);
    }
  };

  const roleColors = {
    admin: "bg-red-100 text-red-700",
    master: "bg-blue-100 text-blue-700",
    user: "bg-gray-100 text-gray-700"
  };

  const roleLabels = {
    admin: "Администратор",
    master: "Мастер",
    user: "Пользователь"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            Настройки
          </h1>
          <p className="text-gray-600 mt-1">Управление аккаунтом и пользователями</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Профиль
            </TabsTrigger>
            {currentUser?.role === 'admin' && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Пользователи
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Ваш профиль</CardTitle>
                <CardDescription>Информация о вашем аккаунте</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-10 h-10 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{currentUser.full_name}</h3>
                        <p className="text-gray-500">{currentUser.email}</p>
                        <Badge className={roleColors[currentUser.role] || roleColors.user}>
                          <Shield className="w-3 h-3 mr-1" />
                          {roleLabels[currentUser.role] || 'Пользователь'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      <div>
                        <Label className="text-gray-600">Email</Label>
                        <div className="flex items-center gap-2 mt-1 p-3 bg-gray-50 rounded-lg">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{currentUser.email}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-600">Телефон</Label>
                        <div className="flex items-center gap-2 mt-1 p-3 bg-gray-50 rounded-lg">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{currentUser.phone || 'Не указан'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">Загрузка...</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <TabsContent value="users">
              <Card className="border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Пользователи</CardTitle>
                    <CardDescription>Управление пользователями системы</CardDescription>
                  </div>
                  <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Пригласить
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Пригласить пользователя</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="user@example.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Роль</Label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Пользователь</SelectItem>
                              <SelectItem value="master">Мастер</SelectItem>
                              <SelectItem value="admin">Администратор</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                            Отмена
                          </Button>
                          <Button onClick={handleInviteUser} className="bg-blue-600 hover:bg-blue-700">
                            Отправить приглашение
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {loadingUsers ? (
                    <div className="text-center py-8 text-gray-500">Загрузка...</div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Пользователи не найдены
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Пользователь</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Роль</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="font-medium">{user.full_name || 'Не указано'}</span>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge className={roleColors[user.role] || roleColors.user}>
                                {roleLabels[user.role] || 'Пользователь'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                {user.is_active !== false ? 'Активен' : 'Неактивен'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Select
                                value={user.role || 'user'}
                                onValueChange={(role) => updateUserMutation.mutate({ id: user.id, data: { role } })}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">Пользователь</SelectItem>
                                  <SelectItem value="master">Мастер</SelectItem>
                                  <SelectItem value="admin">Администратор</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}