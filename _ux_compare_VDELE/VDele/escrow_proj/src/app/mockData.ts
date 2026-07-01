// ═══════════════════════════════════════════════════════════════════
// Mock Data — v3 (Demo-Ready: полный каталог услуг для Якутска)
// ═══════════════════════════════════════════════════════════════════

import type {
  Order, Service, ServiceCategory, Provider, Milestone,
  Dispute, WalletBalance, Transaction, PayoutRequest,
  AuditEvent, OrderPolicy, MilestoneTemplate,
} from "./types";

const nowIso = () => new Date().toISOString();
const addH = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
const subD = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const defaultPolicy: OrderPolicy = {
  cancelWindowMinutes: 30,
  disputeWindowHours: 24,
  autoReleaseHours: 72,
  disputeSlaHours: 48,
};

// ─── Categories ───────────────────────────────────────────────────

export const mockCategories: ServiceCategory[] = [
  { id: "renovation", name: "Ремонт под ключ", icon: "🏠", requiresMilestones: true,
    milestoneTemplates: [
      { name: "Демонтаж", description: "Снос перегородок, демонтаж старых покрытий", percentSuggested: 0.15,
        checklistTemplate: ["Демонтаж стен завершён", "Мусор вывезен", "Основания подготовлены"] },
      { name: "Черновая отделка", description: "Штукатурка, стяжка, электропроводка, сантехника", percentSuggested: 0.35,
        checklistTemplate: ["Стяжка пола", "Штукатурка стен", "Электроразводка", "Водоснабжение", "Канализация"] },
      { name: "Чистовая отделка", description: "Покраска, обои, плитка, напольное покрытие", percentSuggested: 0.30,
        checklistTemplate: ["Плитка в санузле", "Покраска/обои стен", "Напольное покрытие", "Потолки"] },
      { name: "Финальный этап", description: "Установка дверей, сантехники, мебели, уборка", percentSuggested: 0.20,
        checklistTemplate: ["Двери установлены", "Сантехника подключена", "Розетки/выключатели", "Финальная уборка"] },
    ],
  },
  { id: "plumbing", name: "Сантехника", icon: "🚿", requiresMilestones: false },
  { id: "electric", name: "Электрика", icon: "⚡", requiresMilestones: false },
  { id: "repair", name: "Техника", icon: "🔧", requiresMilestones: false },
  { id: "cleaning", name: "Уборка", icon: "🧹", requiresMilestones: false },
  { id: "handyman", name: "Мастер", icon: "🛠", requiresMilestones: false },
  { id: "transport", name: "Перевозки", icon: "🚚", requiresMilestones: false },
  { id: "climate", name: "Климат", icon: "❄️", requiresMilestones: false },
];

// ─── Services ─────────────────────────────────────────────────────

export const mockServices: Service[] = [
  // ═══ РЕМОНТ ПОД КЛЮЧ ═══
  {
    id: "s-reno-1", categoryId: "renovation",
    name: "Ремонт квартиры под ключ",
    description: "Полный ремонт от демонтажа до чистовой отделки. Цена зависит от площади и типа ремонта.",
    basePrice: 450000, feePercent: 0.06,
    policy: { ...defaultPolicy, disputeWindowHours: 72, autoReleaseHours: 72, milestoneAutoReleaseHours: 72, maxCompletionDays: 120 },
    parameters: [
      { id: "p1", name: "Площадь", type: "number", required: true },
      { id: "p2", name: "Тип ремонта", type: "select", required: true,
        options: [
          { label: "Косметический", value: "cosmetic", priceModifier: 0 },
          { label: "Евроремонт", value: "euro", priceModifier: 200000 },
          { label: "Дизайнерский", value: "designer", priceModifier: 500000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск", "Владивосток", "Новосибирск"],
    supportsMilestones: true, minMilestones: 3, maxMilestones: 10,
  },
  {
    id: "s-reno-2", categoryId: "renovation",
    name: "Ремонт санузла",
    description: "Полный ремонт ванной комнаты и туалета: демонтаж плитки, гидроизоляция, укладка новой плитки, установка сантехники.",
    basePrice: 120000, feePercent: 0.08,
    policy: { ...defaultPolicy, disputeWindowHours: 48, milestoneAutoReleaseHours: 48, maxCompletionDays: 45 },
    parameters: [
      { id: "p1", name: "Тип санузла", type: "select", required: true,
        options: [
          { label: "Совмещённый", value: "combined", priceModifier: 0 },
          { label: "Раздельный", value: "separate", priceModifier: 40000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"],
    supportsMilestones: true, minMilestones: 2, maxMilestones: 5,
  },
  {
    id: "s-reno-3", categoryId: "renovation",
    name: "Ремонт кухни",
    description: "Замена фартука, укладка плитки, установка розеток, подключение техники, замена столешницы.",
    basePrice: 85000, feePercent: 0.08,
    policy: { ...defaultPolicy, disputeWindowHours: 48, maxCompletionDays: 30 },
    parameters: [],
    published: true, version: 1, updatedAt: addH(-1),
    cities: ["Якутск"],
    supportsMilestones: true, minMilestones: 2, maxMilestones: 4,
  },

  // ═══ САНТЕХНИКА ═══
  {
    id: "s-plumb-1", categoryId: "plumbing",
    name: "Замена смесителя",
    description: "Демонтаж старого и установка нового смесителя. Подключение к горячей и холодной воде.",
    basePrice: 2500, feePercent: 0.08,
    policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Тип смесителя", type: "select", required: true,
        options: [
          { label: "Однорычажный", value: "single", priceModifier: 0 },
          { label: "Двухвентильный", value: "double", priceModifier: 500 },
          { label: "Термостатический", value: "thermo", priceModifier: 1500 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-5),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-plumb-2", categoryId: "plumbing",
    name: "Устранение засора",
    description: "Механическая или гидродинамическая прочистка труб. Кухня, ванная, канализация.",
    basePrice: 2000, feePercent: 0.08,
    policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Тип засора", type: "select", required: true,
        options: [
          { label: "Раковина / ванна", value: "sink", priceModifier: 0 },
          { label: "Унитаз", value: "toilet", priceModifier: 500 },
          { label: "Канализация (стояк)", value: "main", priceModifier: 2000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-4),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-plumb-3", categoryId: "plumbing",
    name: "Установка унитаза",
    description: "Демонтаж старого, установка нового унитаза, подключение к канализации и водопроводу.",
    basePrice: 4000, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-plumb-4", categoryId: "plumbing",
    name: "Замена радиатора отопления",
    description: "Демонтаж старого и установка нового радиатора. Опрессовка, проверка на течь.",
    basePrice: 5500, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },

  // ═══ ЭЛЕКТРИКА ═══
  {
    id: "s-elec-1", categoryId: "electric",
    name: "Установка люстры",
    description: "Сборка и монтаж потолочного светильника, подключение к проводке.",
    basePrice: 1800, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-4),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-elec-2", categoryId: "electric",
    name: "Замена розеток и выключателей",
    description: "Демонтаж старых и установка новых розеток/выключателей. До 10 точек.",
    basePrice: 3000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Количество точек", type: "select", required: true,
        options: [
          { label: "1-3 точки", value: "few", priceModifier: 0 },
          { label: "4-7 точек", value: "medium", priceModifier: 1500 },
          { label: "8-10 точек", value: "many", priceModifier: 3000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-elec-3", categoryId: "electric",
    name: "Замена электрощитка",
    description: "Установка нового щитка, автоматов, УЗО. Разводка по группам.",
    basePrice: 8000, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-elec-4", categoryId: "electric",
    name: "Тёплый пол (электрический)",
    description: "Укладка нагревательного кабеля или мата, подключение терморегулятора.",
    basePrice: 12000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Площадь", type: "select", required: true,
        options: [
          { label: "До 5 м²", value: "small", priceModifier: 0 },
          { label: "5-10 м²", value: "medium", priceModifier: 5000 },
          { label: "10-20 м²", value: "large", priceModifier: 12000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-1),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },

  // ═══ РЕМОНТ ТЕХНИКИ ═══
  {
    id: "s-rep-1", categoryId: "repair",
    name: "Ремонт стиральной машины",
    description: "Диагностика и ремонт: не сливает, не отжимает, протечка, не включается.",
    basePrice: 3500, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Неисправность", type: "select", required: true,
        options: [
          { label: "Не сливает воду", value: "drain", priceModifier: 0 },
          { label: "Не отжимает", value: "spin", priceModifier: 1000 },
          { label: "Протечка", value: "leak", priceModifier: 500 },
          { label: "Не включается", value: "power", priceModifier: 1500 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-rep-2", categoryId: "repair",
    name: "Ремонт холодильника",
    description: "Заправка фреоном, замена компрессора, ремонт термостата, устранение утечки.",
    basePrice: 4000, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-rep-3", categoryId: "repair",
    name: "Ремонт посудомоечной машины",
    description: "Диагностика, замена помпы, ремонт платы управления, устранение протечки.",
    basePrice: 4500, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-1),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },

  // ═══ УБОРКА ═══
  {
    id: "s-clean-1", categoryId: "cleaning",
    name: "Генеральная уборка",
    description: "Полная уборка квартиры: мытьё окон, полов, санузлов, кухни, пыль, пылесос.",
    basePrice: 5000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Количество комнат", type: "select", required: true,
        options: [
          { label: "Студия / 1 комната", value: "1", priceModifier: 0 },
          { label: "2 комнаты", value: "2", priceModifier: 2000 },
          { label: "3+ комнат", value: "3", priceModifier: 4000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-4),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-clean-2", categoryId: "cleaning",
    name: "Уборка после ремонта",
    description: "Вывоз строительного мусора, мойка всех поверхностей от строительной пыли.",
    basePrice: 8000, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-clean-3", categoryId: "cleaning",
    name: "Химчистка мебели",
    description: "Глубокая чистка диванов, кресел, матрасов. Удаление пятен, запахов.",
    basePrice: 3500, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Что чистим", type: "select", required: true,
        options: [
          { label: "Диван (2-3 места)", value: "sofa", priceModifier: 0 },
          { label: "Угловой диван", value: "corner", priceModifier: 1500 },
          { label: "Матрас", value: "mattress", priceModifier: 500 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },

  // ═══ МАСТЕР НА ЧАС ═══
  {
    id: "s-handy-1", categoryId: "handyman",
    name: "Сборка мебели",
    description: "Сборка шкафов, кроватей, столов, стеллажей. IKEA, Hoff и другие.",
    basePrice: 3000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Сложность", type: "select", required: true,
        options: [
          { label: "Простая (стол, тумба)", value: "simple", priceModifier: 0 },
          { label: "Средняя (шкаф, кровать)", value: "medium", priceModifier: 2000 },
          { label: "Сложная (кухня, гардеробная)", value: "complex", priceModifier: 5000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-handy-2", categoryId: "handyman",
    name: "Навеска полок и карнизов",
    description: "Установка полок, карнизов, зеркал, телевизоров на стену. Сверление.",
    basePrice: 1500, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-handy-3", categoryId: "handyman",
    name: "Установка двери",
    description: "Установка межкомнатной или входной двери с фурнитурой и наличниками.",
    basePrice: 5000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Тип двери", type: "select", required: true,
        options: [
          { label: "Межкомнатная", value: "interior", priceModifier: 0 },
          { label: "Входная", value: "entrance", priceModifier: 3000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-1),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },

  // ═══ ПЕРЕВОЗКИ ═══
  {
    id: "s-trans-1", categoryId: "transport",
    name: "Квартирный переезд",
    description: "Упаковка, погрузка, перевозка, разгрузка мебели и вещей. Грузчики + транспорт.",
    basePrice: 7000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Объём", type: "select", required: true,
        options: [
          { label: "Студия (до 1.5 т)", value: "small", priceModifier: 0 },
          { label: "2-комнатная (до 3 т)", value: "medium", priceModifier: 5000 },
          { label: "3+ комнат (от 3 т)", value: "large", priceModifier: 10000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-trans-2", categoryId: "transport",
    name: "Доставка стройматериалов",
    description: "Доставка из строймагазинов: плитка, ламинат, сухие смеси, гипсокартон.",
    basePrice: 3000, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },

  // ═══ КОНДИЦИОНЕРЫ ═══
  {
    id: "s-clim-1", categoryId: "climate",
    name: "Установка кондиционера",
    description: "Монтаж сплит-системы: внутренний и наружный блок, прокладка трассы, вакуумирование.",
    basePrice: 8000, feePercent: 0.08, policy: defaultPolicy,
    parameters: [
      { id: "p1", name: "Мощность", type: "select", required: true,
        options: [
          { label: "до 2.5 кВт (до 25 м²)", value: "7", priceModifier: 0 },
          { label: "2.5-3.5 кВт (до 35 м²)", value: "12", priceModifier: 2000 },
          { label: "от 3.5 кВт (от 35 м²)", value: "18", priceModifier: 4000 },
        ],
      },
    ],
    published: true, version: 1, updatedAt: addH(-3),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
  {
    id: "s-clim-2", categoryId: "climate",
    name: "Чистка кондиционера",
    description: "Разборка, промывка фильтров, чистка испарителя, дезинфекция, проверка фреона.",
    basePrice: 3000, feePercent: 0.08, policy: defaultPolicy, parameters: [],
    published: true, version: 1, updatedAt: addH(-2),
    cities: ["Якутск"], supportsMilestones: false, minMilestones: 1, maxMilestones: 1,
  },
];

// ─── Providers (мастера) ──────────────────────────────────────────

export const mockProviders: Provider[] = [
  {
    id: "prov1",
    name: "Александр М.",
    rating: 4.9,
    reviewCount: 47,
    completedOrders: 83,
    memberSince: "2024-06-15",
    avatar: "",
    skillCategoryIds: ["plumbing", "renovation", "handyman"],
    skillServiceIds: ["s-plumb-1", "s-plumb-2", "s-plumb-3", "s-plumb-4", "s-reno-1", "s-reno-2", "s-handy-1"],
    location: { lat: 62.035, lng: 129.675, city: "Якутск" },
    kycStatus: "VERIFIED",
    taxStatus: "SELF_EMPLOYED",
    verified: true, acceptingOrders: true, penaltyStatus: "NONE" as const,
    city: "Якутск", baseDistanceKm: 8, activeOrderCount: 2, disputeRate: 0.02, availabilitySlots: ["2026-03-06T09:00","2026-03-07T10:00","2026-03-08T09:00"],
    bio: "Сантехник с 12-летним опытом. Работаю аккуратно и быстро. Гарантия на все работы.",
    availability: [
      { day: "2026-03-06", slots: ["09:00-12:00", "14:00-18:00"] },
      { day: "2026-03-07", slots: ["10:00-17:00"] },
      { day: "2026-03-08", slots: ["09:00-15:00"] },
    ],
    portfolio: [
      { id: "pf1", title: "Замена смесителя Grohe", imageUrl: "" },
      { id: "pf2", title: "Разводка труб", imageUrl: "" },
    ],
  },
  {
    id: "prov2",
    name: "Ирина К.",
    rating: 5.0,
    reviewCount: 31,
    completedOrders: 54,
    memberSince: "2024-09-01",
    avatar: "",
    skillCategoryIds: ["cleaning"],
    skillServiceIds: ["s-clean-1", "s-clean-2", "s-clean-3"],
    location: { lat: 62.028, lng: 129.732, city: "Якутск" },
    kycStatus: "VERIFIED",
    taxStatus: "SELF_EMPLOYED",
    verified: true, acceptingOrders: true, penaltyStatus: "NONE" as const,
    city: "Якутск", baseDistanceKm: 5, activeOrderCount: 1, disputeRate: 0, availabilitySlots: ["2026-03-06T08:00","2026-03-07T08:00"],
    bio: "Профессиональная уборка квартир и офисов. Работаю с экологичной химией. Пунктуальность 100%.",
    availability: [
      { day: "2026-03-06", slots: ["08:00-14:00"] },
      { day: "2026-03-07", slots: ["08:00-18:00"] },
    ],
    portfolio: [
      { id: "pf1", title: "Генеральная уборка 3-комн.", imageUrl: "" },
    ],
  },
  {
    id: "prov3",
    name: "Роман С.",
    rating: 4.8,
    reviewCount: 22,
    completedOrders: 39,
    memberSince: "2025-01-10",
    avatar: "",
    skillCategoryIds: ["electric", "climate"],
    skillServiceIds: ["s-elec-1", "s-elec-2", "s-elec-3", "s-elec-4", "s-clim-1", "s-clim-2"],
    location: { lat: 62.042, lng: 129.710, city: "Якутск" },
    kycStatus: "VERIFIED",
    taxStatus: "INDIVIDUAL_ENTREPRENEUR",
    verified: true, acceptingOrders: true, penaltyStatus: "NONE" as const,
    city: "Якутск", baseDistanceKm: 6, activeOrderCount: 3, disputeRate: 0.03, availabilitySlots: ["2026-03-06T10:00","2026-03-07T09:00","2026-03-08T10:00"],
    bio: "Электрик 3 группа допуска. Установка и обслуживание кондиционеров. Работаю по ГОСТу.",
    availability: [
      { day: "2026-03-06", slots: ["10:00-18:00"] },
      { day: "2026-03-07", slots: ["09:00-16:00"] },
      { day: "2026-03-08", slots: ["10:00-14:00"] },
    ],
    portfolio: [
      { id: "pf1", title: "Щиток/автоматы", imageUrl: "" },
      { id: "pf2", title: "Монтаж кондиционера", imageUrl: "" },
    ],
  },
  {
    id: "prov4",
    name: "Бригада «ТехноРемонт»",
    rating: 4.7,
    reviewCount: 68,
    completedOrders: 127,
    memberSince: "2023-11-20",
    avatar: "",
    skillCategoryIds: ["renovation", "handyman", "plumbing", "electric"],
    skillServiceIds: ["s-reno-1", "s-reno-2", "s-reno-3", "s-handy-1", "s-handy-2", "s-handy-3"],
    location: { lat: 62.019, lng: 129.690, city: "Якутск" },
    kycStatus: "VERIFIED",
    taxStatus: "LLC",
    verified: true, acceptingOrders: true, penaltyStatus: "NONE" as const,
    city: "Якутск", baseDistanceKm: 4, activeOrderCount: 4, disputeRate: 0.01, availabilitySlots: ["2026-03-06T08:00","2026-03-07T08:00","2026-03-08T08:00"],
    bio: "Бригада из 5 мастеров. Капитальный и евроремонт квартир. Собственный инструмент и транспорт.",
    availability: [
      { day: "2026-03-06", slots: ["08:00-18:00"] },
      { day: "2026-03-07", slots: ["08:00-18:00"] },
      { day: "2026-03-08", slots: ["08:00-18:00"] },
    ],
    portfolio: [
      { id: "pf1", title: "Евроремонт 60м² под ключ", imageUrl: "" },
      { id: "pf2", title: "Ремонт санузла «под мрамор»", imageUrl: "" },
      { id: "pf3", title: "Кухня — плитка + электрика", imageUrl: "" },
    ],
  },
  {
    id: "prov5",
    name: "Дмитрий Л.",
    rating: 4.9,
    reviewCount: 15,
    completedOrders: 28,
    memberSince: "2025-06-01",
    avatar: "",
    skillCategoryIds: ["repair", "handyman"],
    skillServiceIds: ["s-rep-1", "s-rep-2", "s-rep-3", "s-handy-1", "s-handy-2"],
    location: { lat: 62.033, lng: 129.720, city: "Якутск" },
    kycStatus: "VERIFIED",
    taxStatus: "SELF_EMPLOYED",
    verified: true, acceptingOrders: true, penaltyStatus: "NONE" as const,
    city: "Якутск", baseDistanceKm: 7, activeOrderCount: 0, disputeRate: 0, availabilitySlots: ["2026-03-06T09:00","2026-03-07T09:00"],
    bio: "Ремонт бытовой техники: стиральные, посудомоечные машины, холодильники. Выезд в день обращения.",
    availability: [
      { day: "2026-03-06", slots: ["09:00-20:00"] },
      { day: "2026-03-07", slots: ["09:00-20:00"] },
    ],
    portfolio: [],
  },
];

// ─── Demo Orders ──────────────────────────────────────────────────

const DEMO_CHECKLISTS: Record<string, string[]> = {
  "Демонтаж": ["Демонтаж стен завершён", "Старая плитка снята", "Мусор вывезен", "Основания подготовлены", "Коммуникации маркированы"],
  "Черновая отделка": ["Стяжка пола залита", "Штукатурка стен", "Электроразводка по проекту", "Водоснабжение / канализация", "Гидроизоляция санузла", "Вентиляция проверена"],
  "Чистовая отделка": ["Плитка в санузле уложена", "Покраска / обои стен", "Напольное покрытие", "Потолки (натяжные / ГКЛ)", "Фартук кухни", "Затирка швов"],
  "Финальный этап": ["Двери установлены", "Сантехника подключена", "Розетки / выключатели", "Мебель (если в договоре)", "Финальная уборка", "Акт приёма-передачи"],
};

const DEMO_PHOTOS: Record<string, { caption: string; color: string }[]> = {
  "Демонтаж": [
    { caption: "До начала работ", color: "#94A3B8" },
    { caption: "Демонтаж перегородки", color: "#78716C" },
    { caption: "Вывоз мусора", color: "#A1A1AA" },
    { caption: "Подготовленное основание", color: "#6B7280" },
  ],
  "Черновая отделка": [
    { caption: "Стяжка пола — заливка", color: "#64748B" },
    { caption: "Штукатурка — маяки", color: "#78716C" },
    { caption: "Электропроводка", color: "#F59E0B" },
    { caption: "Разводка труб", color: "#3B82F6" },
    { caption: "Гидроизоляция ванной", color: "#06B6D4" },
  ],
  "Чистовая отделка": [
    { caption: "Плитка — укладка", color: "#14B8A6" },
    { caption: "Покраска стен", color: "#F0FDFA" },
    { caption: "Ламинат — укладка", color: "#A16207" },
    { caption: "Натяжной потолок", color: "#E2E8F0" },
  ],
  "Финальный этап": [],
};

const demoMilestone = (orderId: string, seq: number, name: string, desc: string, pct: number, amt: number, status: string): Milestone => {
  const isCompleted = ["SUBMITTED", "APPROVED", "RELEASED"].includes(status);
  const isStarted = ["IN_PROGRESS", "SUBMITTED", "APPROVED", "RELEASED"].includes(status);
  const checklist = (DEMO_CHECKLISTS[name] ?? ["Работа выполнена"]).map((label, i) => ({
    id: `${orderId}-ms-${seq}-cl-${i}`,
    label,
    checked: isCompleted ? true : (isStarted && i < 2),
  }));
  const photos = (isStarted && DEMO_PHOTOS[name])
    ? DEMO_PHOTOS[name].map((p, i) => ({
        id: `${orderId}-ms-${seq}-ph-${i}`,
        milestoneId: `${orderId}-ms-${seq}`,
        url: "",
        type: "during" as const,
        caption: p.caption,
        placeholderColor: p.color,
        uploadedAt: subD(7 - i),
        uploadedBy: "specialist" as const,
      }))
    : [];

  return {
    id: `${orderId}-ms-${seq}`, orderId, seq, name, description: desc,
    percent: pct, amount: amt, status: status as any,
    dependsOnPrevious: seq > 1, createdAt: subD(10),
    fundedAt: ["FUNDED","IN_PROGRESS","SUBMITTED","APPROVED","RELEASED"].includes(status) ? subD(9) : undefined,
    startedAt: isStarted ? subD(7) : undefined,
    submittedAt: isCompleted ? subD(3) : undefined,
    approvedAt: ["APPROVED","RELEASED"].includes(status) ? subD(2) : undefined,
    releasedAt: status === "RELEASED" ? subD(1) : undefined,
    photos,
    checklist,
  };
};

const singleMs = (orderId: string, amt: number, status: string): Milestone[] => [
  demoMilestone(orderId, 1, "Основная работа", "", 1, amt, status),
];

export const mockOrders: Order[] = [
  // Completed simple order
  {
    id: "ORD-2026-001", customerId: "c1", providerId: "prov1",
    serviceId: "s-plumb-1", serviceName: "Замена смесителя",
    status: "COMPLETED", escrowStatus: "RELEASED",
    totalAmount: 3250, breakdown: { basePrice: 2500, options: [{ name: "Двухвентильный", amount: 500 }], platformFee: 250 },
    address: "ул. Ленина, 15, кв. 42", city: "Якутск",
    scheduledDate: subD(5), createdAt: subD(7), completedAt: subD(5),
    policy: defaultPolicy, provider: mockProviders[0],
    milestones: singleMs("ORD-2026-001", 3000, "RELEASED"),
    changeOrders: [], isTurnkey: false, contactsRevealed: true, maskedPhone: "+7-800-***-**-67",
  },
  // In-progress simple order
  {
    id: "ORD-2026-002", customerId: "c1", providerId: "prov2",
    serviceId: "s-clean-1", serviceName: "Генеральная уборка",
    status: "IN_PROGRESS", escrowStatus: "HELD",
    totalAmount: 5500, breakdown: { basePrice: 5000, options: [], platformFee: 500 },
    address: "пр. Ленина, 3, кв. 88", city: "Якутск",
    scheduledDate: addH(24), createdAt: subD(1),
    policy: defaultPolicy, provider: mockProviders[1],
    milestones: singleMs("ORD-2026-002", 5000, "IN_PROGRESS"),
    changeOrders: [], isTurnkey: false, contactsRevealed: false, maskedPhone: "+7-914-***-**-23",
  },
  // Turnkey renovation — in progress (2 of 4 milestones done)
  {
    id: "ORD-2026-003", customerId: "c1", providerId: "prov4",
    serviceId: "s-reno-1", serviceName: "Ремонт квартиры под ключ",
    status: "IN_PROGRESS", escrowStatus: "PARTIALLY_RELEASED",
    totalAmount: 689000,
    breakdown: { basePrice: 650000, options: [{ name: "Евроремонт", amount: 0 }], platformFee: 39000 },
    address: "ул. Петровского, 7, кв. 15", city: "Якутск",
    scheduledDate: subD(30), createdAt: subD(35),
    policy: { ...defaultPolicy, disputeWindowHours: 72, autoReleaseHours: 72, milestoneAutoReleaseHours: 72, maxCompletionDays: 120 },
    provider: mockProviders[3],
    milestones: [
      demoMilestone("ORD-2026-003", 1, "Демонтаж", "Снос перегородок, демонтаж покрытий", 0.15, 97500, "RELEASED"),
      demoMilestone("ORD-2026-003", 2, "Черновая отделка", "Штукатурка, стяжка, электрика", 0.35, 227500, "RELEASED"),
      demoMilestone("ORD-2026-003", 3, "Чистовая отделка", "Покраска, обои, плитка", 0.30, 195000, "IN_PROGRESS"),
      demoMilestone("ORD-2026-003", 4, "Финальный этап", "Двери, сантехника, уборка", 0.20, 130000, "NOT_FUNDED"),
    ],
    changeOrders: [], isTurnkey: true, contactsRevealed: true, maskedPhone: "+7-924-***-**-11",
  },
  // Funded, waiting for specialist
  {
    id: "ORD-2026-004", customerId: "c1", providerId: undefined,
    serviceId: "s-elec-3", serviceName: "Замена электрощитка",
    status: "FUNDED", escrowStatus: "HELD",
    totalAmount: 8640, breakdown: { basePrice: 8000, options: [], platformFee: 640 },
    address: "ул. Кирова, 22, кв. 5", city: "Якутск",
    scheduledDate: addH(72), createdAt: subD(1),
    policy: defaultPolicy, provider: undefined,
    milestones: singleMs("ORD-2026-004", 8000, "FUNDED"),
    changeOrders: [], isTurnkey: false, contactsRevealed: false,
  },
];

// ─── Wallet & Transactions ────────────────────────────────────────

export const DEFAULT_WALLET: WalletBalance = {
  available: 45_200,
  pending: 97_500,
  held: 195_000,
  totalEarned: 487_300,
  totalPaidOut: 344_600,
};

export const mockTransactions: Transaction[] = [
  { id: "tx-001", type: "escrow_hold", amount: 689000, status: "completed", date: subD(35), description: "Escrow — ORD-2026-003 (Ремонт под ключ)", orderId: "ORD-2026-003" },
  { id: "tx-002", type: "release", amount: 97500, status: "completed", date: subD(25), description: "Выплата — Демонтаж (этап 1)", orderId: "ORD-2026-003" },
  { id: "tx-003", type: "release", amount: 227500, status: "completed", date: subD(12), description: "Выплата — Черновая отделка (этап 2)", orderId: "ORD-2026-003" },
  { id: "tx-004", type: "escrow_hold", amount: 3250, status: "completed", date: subD(7), description: "Escrow — ORD-2026-001 (Замена смесителя)", orderId: "ORD-2026-001" },
  { id: "tx-005", type: "release", amount: 3000, status: "completed", date: subD(5), description: "Выплата — Замена смесителя", orderId: "ORD-2026-001" },
  { id: "tx-006", type: "escrow_hold", amount: 5500, status: "completed", date: subD(1), description: "Escrow — ORD-2026-002 (Генеральная уборка)", orderId: "ORD-2026-002" },
  { id: "tx-007", type: "payout", amount: -45200, status: "completed", date: subD(3), description: "Вывод на карту •••• 4242" },
];

export const mockPayouts: PayoutRequest[] = [];
export const mockDisputes: Dispute[] = [];
export const mockAuditLog: AuditEvent[] = [];
