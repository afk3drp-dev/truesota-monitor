# TrueSOTA Usage Monitor PRO — OLED Apple Dark & React Bits Edition

Десктопный клиент для мониторинга квот, расхода, тарифов и стабильности каналов **TrueSOTA** в Windows 11.  
Собрано на **Tauri v2** + **React 19** + **TypeScript** + **Rust (`ureq`, `window-vibrancy`)**.

> **Безопасная публичная версия без встроенных ключей**: каждый пользователь вводит собственный API-ключ при первом входе. Ключ хранится только локально на устройстве пользователя в `%APPDATA%\TrueSOTA_Monitor\truesota_config.json`.

---

## Основные возможности

1. **Экран приветствия (`WelcomeAuth` + React Bits)**
   - WebGL-фон **`CursorGrid`**, типографика **`FoldText`** и **`DecryptedText`**, форма входа внутри **`GlassSurface`**, кнопка **`SpecularButton`** и карточки **`MagicBento`**.
   - Поддержка любого API-ключа TrueSOTA (`Authorization: Bearer`), вставка из буфера и живая проверка квоты.

2. **Безрамочное окно Windows 11 + Mica / Acrylic + `Ctrl+K`**
   - Материалы окна (**Mica / Acrylic / Tabbed / OLED Black**), управление окном в стиле macOS и глобальная палитра команд **`Ctrl+K`**.
   - Плавающий виджет **Dynamic Island** поверх окон и интерактивная шкала **`CometDial`** в настройках.

3. **Тепловая карта (22 недели) и аудит кэша**
   - Heatmap активности по дням (`Расход $` / `Токены` / `Запросы`), серии активности и статистика экономии на Prompt Cache по каждой модели.

4. **Live-каталог тарифов и встроенный «Монитор»**
   - Вкладка **«Тарифы»**: актуальные цены моделей и множители групп с [`true-sota.com/model-pricing`](https://true-sota.com/model-pricing), фильтрация по группам, учёт `×Rate`, проверка доступности моделей по вашему ключу (`/v1/models`) и копирование ID модели в один клик.
   - Вкладка **«Монитор»**: встроенный live WebView [`true-sota.com/monitor`](https://true-sota.com/monitor) (после ручной авторизации сессия сохраняется локально в WebView2) + авто-пинг API-шлюза (`/v1/models`) с графиком задержки.

5. **Apple Share Card & экспорт отчётов**
   - Генератор PNG-карточки `1200×630` с быстрым копированием в буфер (для Telegram) и экспортом в **PNG / CSV / Markdown** в папку `Downloads`.

---

## Установка (готовая сборка)

Скачайте архив **`TrueSOTA_Monitor_Installers.zip`** со страницы [**Releases**](../../releases):
- **`TrueSOTA_Installer.exe`** — быстрый установщик Windows (NSIS, рекомендуется).
- **`TrueSOTA_Setup.msi`** — пакет Windows Installer (MSI).
- **`TrueSOTA_Monitor_AppleUI.exe`** — портативная версия (Portable, можно приложить отдельно в релизах).

> Если Windows SmartScreen покажет предупреждение о неизвестном издателе (приложение не подписано платным EV-сертификатом), нажмите **«Подробнее» → «Выполнить в любом случае»**.

---

## Безопасность и приватность

- Сетевые запросы отправляются **только на `https://true-sota.com`** (и переходы по явным ссылкам `https://true-sota.com/**` / `https://t.me/afk3drp`).
- Включена строгая политика безопасности **CSP** (`script-src 'self'`, `object-src 'none'`).
- Права Tauri (`capabilities`) ограничены только главным локальным WebView (`main`) и не доступны внешним страницам.
- Экспорт файлов ограничен белым списком расширений (`.png`, `.csv`, `.md`, `.txt`, `.json`) в каталоге `Downloads` + защита CSV/Markdown от формул и инъекций.

---

## Сборка из исходников

Требования: **Node.js 20+**, **Rust (MSVC toolchain)**, **WebView2**.

```powershell
npm install
npm run build
npm run tauri build
```

Для чистой публичной релизной сборки без путей локальной машины используйте:
```powershell
$homeDir = $env:USERPROFILE
$root = (Get-Location).Path
$env:RUSTFLAGS = "--remap-path-prefix=$homeDir\.cargo\registry\src=/cargo --remap-path-prefix=$root=/app --remap-path-prefix=$homeDir=/home"
npm run tauri build
```

---

by [@afk3drp](https://t.me/afk3drp)
