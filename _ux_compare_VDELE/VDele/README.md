# В Деле — Android APK Build

## Структура проекта

```
VDele/
  app/                          # Android Studio module
    build.gradle.kts            # 2 product flavors: customer, specialist
    src/
      main/
        java/.../MainActivity.kt  # WebView shell
        res/                       # Layout, themes, icons
        assets/www/                # <- Vite build output (после build_web.sh)
        AndroidManifest.xml
      customer/res/                # Customer-specific resources (icon override)
      specialist/res/              # Specialist-specific resources (icon override)
  web_patches/
    routes.android.tsx           # HashRouter (вместо BrowserRouter)
    vite.config.android.ts       # base: "./" для относительных путей
  escrow_proj/                   # <- СЮДА КОПИРОВАТЬ ВЕБ-ПРОЕКТ
  build_web.sh                   # Скрипт сборки web -> assets
  build.gradle.kts               # Root gradle
  settings.gradle.kts
  gradle/wrapper/
```

## Сборка — пошагово

### 1. Подготовка

```bash
# Распаковать архив
unzip VDELE_Android.zip
cd VDele/

# Скопировать веб-проект (из VDELE_v2_visual.zip) в escrow_proj/
cp -r /path/to/escrow_proj ./escrow_proj
```

### 2. Собрать web-assets

```bash
# Требуется: Node.js 18+, pnpm
chmod +x build_web.sh
./build_web.sh
```

Скрипт делает:
- Подменяет `routes.tsx` на HashRouter версию (для `file:///` в WebView)
- Подменяет `vite.config.ts` с `base: "./"` (относительные пути к assets)
- `pnpm install && pnpm build`
- Копирует `dist/*` в `app/src/main/assets/www/`

### 3. Открыть в Android Studio

- File → Open → выбрать папку `VDele/`
- **Важно:** Android Studio автоматически скачает `gradle-wrapper.jar` при первом sync.
  Если Gradle sync не запустился: File → Sync Project with Gradle Files.
- В Build Variants (левая панель) выбрать:
  - **customerDebug** или **customerRelease** — приложение "В Деле"
  - **specialistDebug** или **specialistRelease** — приложение "В Деле Мастер"

### 4. Собрать APK

```
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Или через Gradle:
```bash
# Customer APK
./gradlew assembleCustomerRelease

# Specialist APK  
./gradlew assembleSpecialistRelease

# Оба сразу
./gradlew assembleRelease
```

APK будут в:
```
app/build/outputs/apk/customer/release/app-customer-release.apk
app/build/outputs/apk/specialist/release/app-specialist-release.apk
```

## Что получается

| | Customer APK | Specialist APK |
|---|---|---|
| Package ID | `com.vdele.customer` | `com.vdele.specialist` |
| Название | В Деле | В Деле Мастер |
| Иконка | Teal (здание) | Dark green (ключ) |
| Entry route | `#/customer` | `#/specialist` |
| Version | 2.0.0-customer | 2.0.0-specialist |

## Архитектура

**WebView shell** — нативное Android-приложение загружает собранный Vite bundle из `assets/www/index.html`. Маршрутизация через `HashRouter` (`#/customer`, `#/specialist`).

**Product flavors** — один исходный код, два APK. Каждый flavor задаёт:
- `applicationId` — разные пакеты в Google Play
- `ENTRY_PATH` — стартовый маршрут
- `SPLASH_TITLE` / `SPLASH_SUB` — текст splash screen
- `appLabel` — название в лаунчере
- Иконку через flavor-specific `res/drawable/ic_fg.xml`

**Нативные фичи:**
- Splash screen (Android 12+ API)
- Pull-to-refresh
- Hardware back → WebView history
- Progress bar при загрузке
- JS Bridge: `window.VDeleBridge.version()`, `.flavor()`, `.hapticFeedback()`
- Обработка ошибок загрузки с retry

## Gradle Wrapper

Архив не содержит `gradle-wrapper.jar` (11 MB binary). При открытии в Android Studio он будет сгенерирован автоматически.

Если нужно собрать из командной строки без AS:
```bash
# Вариант 1: Android Studio сгенерирует wrapper при первом sync
# Вариант 2: Использовать системный Gradle 8.11+
gradle assembleCustomerRelease
gradle assembleSpecialistRelease
```

## Требования

- Android Studio Ladybug (2024.2+)
- Gradle 8.11+
- JDK 17
- Android SDK 35
- Node.js 18+ и pnpm (для web build)
- Min SDK: Android 8.0 (API 26)

## v2.0 — Финальный билд (изменения)

### Логика
- **Turnkey flow end-to-end**: ServiceConfigurator определяет категорию renovation, показывает milestone preview, передаёт `isTurnkey` + `milestoneTemplates` по цепочке Quote → SpecialistPicker → Review → Payment
- **Payment.tsx**: строит milestones из templates, передаёт `city`, `isTurnkey`, `milestones` в `createOrder()` (убран `as any`)
- **Review.tsx**: показывает карточку «Поэтапная оплата» для turnkey заказов
- **Customer Orders**: progress bar с количеством завершённых этапов для turnkey
- **Specialist Dashboard**: аналогичный progress bar для активных turnkey заказов

### Дизайн
- Milestone preview в ServiceConfigurator (нумерованные этапы с процентами)
- Gradient progress bars для milestone completion
- Violet accent карточка «Поэтапная оплата» в Review
- Premium секция «Ремонт под ключ» на Home с glow-эффектом

### Android
- Исправлен `settings.gradle.kts` (dependencyResolutionManagement)
- UTF-8 строки в `build.gradle.kts` (читаемые русские названия)
- `build_web.sh` с backup/restore оригинальных файлов
- `.gitignore` с правильными исключениями
- Отдельные иконки для customer/specialist flavors

## TODO для production

1. Заменить debug signing на release keystore
2. Добавить push notifications (Firebase Cloud Messaging)
3. Добавить deep links (`vdele://order/ORD-xxx`)
4. Camera integration для фото-отчётов milestone
5. Offline mode (Service Worker)
6. App Bundle вместо APK для Google Play
