# В ДЕЛЕ v2 — Architecture Changelog

## Что изменилось (7 файлов, ~2 700 строк)

### 1. `types.ts` (409 строк, было ~120)

**Новые типы:**
- `MilestoneStatus` — 9 состояний (было 7), добавлены `FUNDED`, `IN_PROGRESS`, `CANCELLED`
- `MilestonePhoto` — фото до/во время/после для каждого этапа
- `ChecklistItem` — чек-лист приёмки по этапу
- `ChangeOrder` — механизм изменения объёма/цены после старта работ
- `DisputeCategory` — 7 категорий споров (QUALITY, NO_SHOW, INCOMPLETE, DAMAGE, etc.)
- `DisputeEvidence` — прикрепление доказательств к спорам
- `ContactPair` + `BypassFlag` — anti-bypass система
- `KYCStatus`, `TaxStatus` — верификация исполнителей
- `AuditEvent` — журнал всех операций (27 типов событий)
- `CityConfig` — региональная конфигурация по городам
- `MilestoneTemplate` — шаблоны этапов для категорий

**Расширенные типы:**
- `Order` — добавлены `city`, `changeOrders`, `isTurnkey`, `contactsRevealed`, `maskedPhone`
- `Provider` — добавлены `kycStatus`, `taxStatus`, `activeOrderCount`, `disputeRate`, `completedOrders`, `acceptingOrders`, `uniqueCustomers`, `penaltyStatus`
- `ServiceCategory` — добавлены `requiresMilestones`, `milestoneTemplates`
- `Service` — добавлены `cities`, `supportsMilestones`, `minMilestones`, `maxMilestones`
- `EscrowStatus` — добавлены `PARTIALLY_HELD`, `PARTIALLY_RELEASED`
- `WalletBalance` — добавлено `totalEarned`
- `Transaction` — типы уточнены (`escrow_hold`, `milestone_release`, `penalty`, etc.)

---

### 2. `stateMachine.ts` (654 строк, было ~200)

**Milestone State Machine:**
- `MILESTONE_TRANSITIONS` — таблица допустимых переходов
- `canTransitionMilestone()` — валидация перехода
- `canMilestoneStart()` — проверка зависимости от предыдущего этапа
- `isMilestoneTerminal()`, `isMilestoneActive()` — хелперы

**Derive Logic (Order ← Milestones):**
- `deriveOrderEscrowStatus()` — вычисление escrow-статуса заказа из статусов этапов
- `deriveOrderStatus()` — вычисление статуса заказа из статусов этапов

**Milestone-Level Actions:**
- `getMilestoneActionsForCustomer()` — FUND_MILESTONE, APPROVE_MILESTONE, DISPUTE_MILESTONE
- `getMilestoneActionsForSpecialist()` — START_MILESTONE, SUBMIT_MILESTONE, UPLOAD_PHOTO

**Anti-Bypass Engine:**
- `assessBypassRisk()` — оценка риска обхода для пары заказчик-исполнитель
- `detectContactInMessage()` — детекция телефонов/email/telegram в сообщениях
- `generateMaskedPhone()` — генерация маскированного номера

**Milestone Builders:**
- `buildMilestonesFromTemplate()` — создание этапов из шаблона категории
- `buildSingleMilestone()` — один этап для простых заказов
- `validateMilestonePercents()` — валидация что сумма = 100%

---

### 3. `pricing.ts` (136 строк, было ~30)

- **Градуированный minFee**: 800₽ (<15k), 1500₽ (<50k), 2500₽ (<150k), 3000₽ (>150k)
- **Региональные цены**: `getCityConfig()`, `takeRateOverride`, `minFeeOverride`
- **Acquiring cost**: 1.9% от суммы (для внутреннего учёта)
- **Dispute reserve**: 2% от суммы (резерв на споры)
- **`computeFullBreakdown()`** — полный расчёт: subtotal, fee, acquiring, reserve, net revenue
- **5 city configs**: Якутск (1.0), Владивосток (1.1), Иркутск (0.95), Новосибирск (1.15), Екатеринбург (1.2)

---

### 4. `matching.ts` (171 строк, было ~100)

**Новые веса скоринга (v2):**
- Rating: 35 pts (было 55)
- Distance: 15 pts (было 25)
- Availability: 15 pts (было 20)
- **Load: 15 pts (NEW)** — меньше активных заказов = выше балл
- **Reliability: 15 pts (NEW)** — ниже disputeRate = выше балл
- Verified: 5 pts bonus

**Штрафы:**
- Bypass risk HIGH: −20 pts
- Penalty status WARNING: −10 pts
- SUSPENDED/BANNED: исключение из выдачи
- `acceptingOrders: false`: исключение

**Новые поля:**
- `warnings[]` — предупреждения для админа (загрузка, споры, bypass)

---

### 5. `mockData.ts` (530 строк, было ~256)

- **Turnkey order** — ORD-2026-002001: ремонт квартиры, 486k₽, 4 этапа (демонтаж RELEASED, черновая IN_PROGRESS, чистовая NOT_FUNDED, финал NOT_FUNDED)
- **Milestone photos** — фото до/после/в процессе
- **Checklists** — чек-листы для каждого этапа
- **Extended providers** — с `kycStatus`, `disputeRate`, `activeOrderCount`, etc.
- **Renovation category** — с `milestoneTemplates` (4 шаблона этапов)
- **New services** — s3 (ремонт под ключ, 450k), s4 (ремонт санузла, 120k)
- **ContactPairs** — mock данные для anti-bypass
- **AuditEvents** — mock записи аудит-лога
- **Dispute evidence** — фото и текст

---

### 6. `config.ts` (45 строк, было ~15)

- **Feature flags**: milestones, changeOrders, antiBypass, photoReports, etc.
- **Thresholds**: mandatoryMilestoneAmount (150k), highTicketAmount (300k)

---

### 7. `store/AppStore.tsx` (767 строк, было ~700)

**Новые actions (15 новых):**
- `FUND_MILESTONE`, `START_MILESTONE`, `SUBMIT_MILESTONE`, `APPROVE_MILESTONE`, `DISPUTE_MILESTONE`
- `PROPOSE_CHANGE`, `APPROVE_CHANGE`, `REJECT_CHANGE`
- `UPLOAD_PHOTO`, `TOGGLE_CHECKLIST`
- `ESCALATE_DISPUTE`
- `REVIEW_BYPASS_FLAG`

**Архитектурные изменения:**
- Milestone-level операции с `canTransitionMilestone()` guard
- Order status derivation из milestones через `syncFromMs()`
- Provider stats обновляются при завершении (activeOrderCount, completedOrders, disputeRate)
- ContactPair обновляется при каждом завершении заказа
- Audit trail: каждое действие записывается в `auditLog`
- TICK: авто-release и для простых заказов, и для отдельных milestones в turnkey
- State version bump: `v2` → `v3` (auto-reset при загрузке старого формата)

---

## Что НЕ изменилось (и почему)

- **UI компоненты** (`customer/`, `specialist/`, `admin/`) — не тронуты. Потребуется отдельная работа по адаптации UI к новым типам. Компоненты продолжат работать с simple orders без изменений, но для turnkey orders нужны новые экраны.
- **`copy.ts`** — не изменён, ACTION_LABELS достаточны.
- **`routes.tsx`** — не изменён, маршрутизация не зависит от бизнес-логики.

## Как применить

1. Заменить 7 файлов в проекте
2. Сбросить localStorage: вызвать `resetDemo()` или очистить ключ `vdele_demo_state_v3`
3. UI компоненты потребуют адаптации для отображения milestone timeline, photo reports, checklist, change orders
