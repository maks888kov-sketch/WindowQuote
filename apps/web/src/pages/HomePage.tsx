import { Link } from "react-router-dom";

const moduleCards = [
  {
    title: "Расчёт окон и дверей",
    desc: "Точный калькулятор с учётом всех параметров",
    to: "/calculator",
    icon: "🧮",
    iconBg: "#3b82f6",
  },
  {
    title: "Заказы",
    desc: "Управление заказами и коммерческими предложениями",
    to: "/orders",
    icon: "📋",
    iconBg: "#10b981",
  },
  {
    title: "Клиенты",
    desc: "База клиентов с полной историей",
    to: "/customers",
    icon: "👥",
    iconBg: "#8b5cf6",
  },
  {
    title: "Профили",
    desc: "Каталог профилей ведущих производителей",
    to: "/profiles",
    icon: "📦",
    iconBg: "#f59e0b",
  },
  {
    title: "Аналитика",
    desc: "Статистика продаж и отчёты",
    to: "/dashboard",
    icon: "📊",
    iconBg: "#0ea5e9",
  },
  {
    title: "Настройки",
    desc: "Управление пользователями и параметрами",
    to: "/admin",
    icon: "⚙",
    iconBg: "#64748b",
  },
];

const HomePage = () => {
  return (
    <section className="home-page">
      <div className="hero-section">
        <h1 className="hero-title">WindowQuote</h1>
        <p className="hero-subtitle">Профессиональная система для расчёта окон и дверей</p>
        <Link className="btn btn-hero" to="/calculator">
          Начать расчёт →
        </Link>
      </div>

      <div className="feature-cards">
        <div className="feature-card">
          <span className="feature-icon">⚡</span>
          <span className="feature-value">&lt; 30 сек</span>
          <span className="feature-label">Быстрый расчёт</span>
        </div>
        <div className="feature-card">
          <span className="feature-icon">🛡</span>
          <span className="feature-value">99.9%</span>
          <span className="feature-label">Точность</span>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📈</span>
          <span className="feature-value">+45%</span>
          <span className="feature-label">Рост продаж</span>
        </div>
      </div>

      <div className="modules-section">
        <h2 className="modules-title">Все для вашего бизнеса</h2>
        <p className="modules-subtitle">Комплексное решение для работы с окнами и дверями</p>
        <div className="modules-grid">
          {moduleCards.map((m) => (
            <Link key={m.to} to={m.to} className="module-card">
              <div className="module-icon" style={{ background: m.iconBg }}>{m.icon}</div>
              <h3 className="module-card-title">{m.title}</h3>
              <p className="module-card-desc">{m.desc}</p>
              <span className="module-card-link">Перейти →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomePage;
