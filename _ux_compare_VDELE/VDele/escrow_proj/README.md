# В ДЕЛЕ - Escrow Marketplace Platform

Комплексная платформа для ремонтных и бытовых услуг с защитой средств через Escrow.

## 🎨 Структура проекта

### 3 интерфейса:

1. **Mobile Customer App** - Мобильное приложение для клиентов (iOS style, 393px)
2. **Mobile Specialist App** - Мобильное приложение для специалистов
3. **Web Admin Panel** - Десктопная панель администратора (1440px+)

## 🎯 Основные функции

### Customer Flow
- Поиск и выбор услуг по категориям
- Конфигуратор услуг с расчётом стоимости
- Создание заказа с защитой через Escrow
- Отслеживание статуса заказа
- Подтверждение выполнения / Открытие спора
- История заказов

### Specialist Flow
- Dashboard с доступными/активными/завершёнными заказами
- Принятие заказов
- Управление процессом выполнения
- Кошелёк с балансами (available/pending/locked)
- Вывод средств
- История транзакций

### Admin Panel
- Обзор платформы (KPI, метрики)
- Управление заказами
- Система разрешения споров (Disputes)
- Управление выплатами
- Управление каталогом услуг
- Управление специалистами

## 🎨 Дизайн-система

### Цвета
- Primary 600: `#0F766E`
- Primary 500: `#14B8A6` (основной)
- Primary 400: `#2DD4BF`
- Dark: `#0B1220`, `#111827`, `#1F2937`
- Success: `#10B981`
- Warning: `#F59E0B`
- Danger: `#EF4444`

### Компоненты
- **Button**: 3 варианта (primary/secondary/danger), 2 размера, состояния (loading/disabled)
- **Badge**: Статусы заказов и Escrow
- **Card**: 5 вариантов (dark/light/pricing/wallet/timeline)
- **Timeline**: Отображение истории заказа
- **Input/Textarea**: С поддержкой ошибок и успешных состояний
- **MobileLayout**: Обёртка для мобильных экранов

## 📱 Навигация

### Customer Routes

## 🧰 Установка и запуск (pnpm)

Требования: Node.js 18+ (рекомендуется 20+) и **pnpm**.

### Вариант A — через Corepack (рекомендуется)

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm dev
```

### Вариант B — если pnpm уже установлен

```bash
pnpm install
pnpm dev
```

После запуска Vite откроет приложение по адресу, который выведет в консоль (обычно `http://localhost:5173`).
- `/customer` - Главная
- `/customer/category/:categoryId` - Услуги категории
- `/customer/service/:serviceId` - Конфигуратор услуги
- `/customer/quote` - Расчёт стоимости
- `/customer/orders/:orderId` - Детали заказа

### Specialist Routes
- `/specialist` - Dashboard
- `/specialist/wallet` - Кошелёк
- `/specialist/orders/:orderId` - Детали заказа

### Admin Routes
- `/admin` - Обзор
- `/admin/orders` - Управление заказами
- `/admin/disputes` - Споры
- `/admin/catalog` - Каталог (Coming Soon)
- `/admin/payouts` - Выплаты (Coming Soon)
- `/admin/specialists` - Специалисты (Coming Soon)

## 🔐 Escrow Logic

### Order Status Flow
```
PLACED → FUNDED → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
                                    ↓
                                DISPUTED
```

### Escrow Status
- `NOT_FUNDED` - Не оплачен
- `HELD` - Средства защищены (удержаны)
- `FROZEN` - Средства заморожены (спор)
- `RELEASED` - Выплачено специалисту
- `REFUNDED` - Возврат клиенту

### Dispute Resolution
Админ может:
1. Выплатить специалисту (100%)
2. Вернуть клиенту (100%)
3. Разделить сумму (split с слайдером)

## 🚀 Запуск

Проект готов к запуску. Все зависимости установлены.

## 📦 Используемые библиотеки

- React 18.3.1
- React Router 7.13.0
- Tailwind CSS 4.1.12
- Lucide React (иконки)
- TypeScript

## 💡 Особенности реализации

- **Fintech стиль**: Dark-first headers, градиенты, teal glow эффекты
- **Mobile-first**: Мобильные экраны 393px (iPhone 15)
- **8pt Grid System**: Консистентные отступы
- **Строгая типизация**: TypeScript types для всех сущностей
- **Mock данные**: Полностью рабочие потоки с моковыми данными

---

**Статус**: Demo версия • Frontend-only
**Дата**: 27 февраля 2026
