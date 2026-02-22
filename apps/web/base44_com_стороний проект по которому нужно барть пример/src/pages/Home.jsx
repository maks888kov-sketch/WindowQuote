import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calculator, Users, FileText, Package, BarChart3, Settings, ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Home() {
  const features = [
    {
      icon: Calculator,
      title: "Расчет окон и дверей",
      description: "Точный калькулятор с учетом всех параметров",
      link: "/Calculator",
      color: "bg-blue-500"
    },
    {
      icon: FileText,
      title: "Заказы",
      description: "Управление заказами и коммерческими предложениями",
      link: "/Orders",
      color: "bg-green-500"
    },
    {
      icon: Users,
      title: "Клиенты",
      description: "База клиентов с полной историей",
      link: "/Clients",
      color: "bg-purple-500"
    },
    {
      icon: Package,
      title: "Профили",
      description: "Каталог профилей ведущих производителей",
      link: "/Profiles",
      color: "bg-orange-500"
    },
    {
      icon: BarChart3,
      title: "Аналитика",
      description: "Статистика продаж и отчеты",
      link: "/Analytics",
      color: "bg-cyan-500"
    },
    {
      icon: Settings,
      title: "Настройки",
      description: "Управление пользователями и параметрами",
      link: "/Settings",
      color: "bg-gray-500"
    }
  ];

  const stats = [
    { label: "Быстрый расчет", value: "< 30 сек", icon: Zap },
    { label: "Точность", value: "99.9%", icon: Shield },
    { label: "Рост продаж", value: "+45%", icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]" />
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Rom<span className="text-blue-200">chi</span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              Профессиональная система для расчета окон и дверей
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to={createPageUrl("Calculator")}>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all">
                  <Calculator className="w-5 h-5 mr-2" />
                  Начать расчет
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to={createPageUrl("Orders")}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 backdrop-blur-sm">
                  <FileText className="w-5 h-5 mr-2" />
                  Заказы
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-6 -mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx, duration: 0.5 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all">
                <CardContent className="p-6 text-center">
                  <stat.icon className="w-8 h-8 mx-auto mb-3 text-blue-600" />
                  <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Все для вашего бизнеса</h2>
          <p className="text-lg text-gray-600">Комплексное решение для работы с окнами и дверями</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + idx * 0.1 }}
            >
              <Link to={createPageUrl(feature.link.substring(1))}>
                <Card className="group h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white">
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                    <div className="mt-4 flex items-center text-blue-600 font-medium group-hover:gap-2 transition-all">
                      Перейти
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Готовы начать работу?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Создайте свой первый расчет прямо сейчас
          </p>
          <Link to={createPageUrl("Calculator")}>
            <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-xl">
              <Calculator className="w-5 h-5 mr-2" />
              Открыть калькулятор
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}