# TrueSOTA Usage Monitor PRO — OLED Apple Dark & React Bits Edition

Десктопный клиент для мониторинга квот, расхода и эффективности кэша TrueSOTA в Windows 11.
Собрано на **Tauri v2** + **React 19** + **TypeScript** + **Rust (`ureq`, `window-vibrancy`)**.

> **Публичная сборка без встроенных ключей**: при первом запуске открывается экран приветствия, где каждый пользователь вводит собственный API-ключ (`Authorization: Bearer`). Ключ сохраняется локально в `%APPDATA%\TrueSOTA_Monitor\truesota_config.json`.

---

## Ключевые возможности

1. **Экран приветствия и вход по ключу (`WelcomeAuth` + React Bits)**:
   - Интерактивная WebGL-сетка **`CursorGrid`** с реакцией на курсор и клики.
   - Типографика **`FoldText`** (GSAP) и **`DecryptedText`** (Motion).
   - Форма авторизации внутри **`GlassSurface`** с кнопкой **`SpecularButton`** (WebGL-блик по граням) и витриной **`MagicBento`**.
   - Поддержка любого формата API-ключа, кнопка вставки из буфера обмена, живая проверка на TrueSOTA API (и вход оффлайн при сбое сети), плюс кнопка **«Выйти»** в Настройках и `Ctrl+K`.

2. **Окно без системных рамок + Mica/Acrylic + `Ctrl+K`**:
   - Нативные эффекты стекла Windows 11 (**Mica / Acrylic / Tabbed / OLED Black**), рабочие кнопки управления окном в стиле macOS и глобальная командная палитра **`Ctrl+K`**.

3. **Тепловая карта активности (22 недели) и Prompt Cache Audit**:
   - GitHub-style Heatmap по дням (`Расход $` / `Токены` / `Запросы`), серии активности (Streak) и аудит экономии на кэшировании по каждой модели.

4. **Apple Share Card & Экспорт отчётов**:
   - Генератор PNG-карточки `1200×630` с быстрым копированием в буфер (для Telegram) и сохранением PNG, CSV и Markdown в папку `Downloads`.

5. **Dynamic Island и настройки на CometDial**:
   - Плавающий компактный виджет поверх всех окон и интерактивная шкала **`CometDial`** в настройках интервала автообновления.

6. **Live-каталог тарифов и встроенный «Монитор» каналов**:
   - Автоматическая загрузка публичного прайса и множителей групп TrueSOTA (`/api/v1/model-pricing`), сверка с доступными моделями текущего ключа (`/v1/models`) и копирование ID модели в один клик.
   - Встроенный в приложение live-WebView монитора `https://true-sota.com/monitor` (с сохранением вашей сессии после ручной авторизации) + авто-пинг API-шлюза (`/v1/models`) с графиком задержки.
   - Отключено стандартное браузерное контекстное меню ПКМ и случайные горячие клавиши (`F5`, `Ctrl+R`, `Ctrl+P`, `Ctrl+S`) для нативного ощущения приложения.

---

## Установка и безопасность

1. Скачайте и запустите любой из установщиков:
   - **`TrueSOTA_Installer.exe`** — быстрый установщик Windows (NSIS, рекомендуется).
   - **`TrueSOTA_Setup.msi`** — стандартный пакет Windows Installer (MSI).
   *(Также в папке `Release/` доступна портативная версия `TrueSOTA_Monitor_AppleUI.exe`, не требующая установки.)*
2. Если Windows SmartScreen покажет предупреждение о неподписанном приложении: нажмите **«Подробнее» → «Выполнить в любом случае»**.
3. При первом запуске введите **собственный API-ключ TrueSOTA** — в сборке нет чужих ключей и сторонней телеметрии.
   - Сетевые запросы отправляются только к `https://true-sota.com`.
   - Применены строгая политика безопасности **CSP**, изоляция прав WebView и защита экспорта файлов (`.png`, `.csv`, `.md`).
   - Ваш ключ хранится только локально в `%APPDATA%\TrueSOTA_Monitor\truesota_config.json` (не передаётся и не читается рядом с `.exe`).

---

## Архив установщиков и файлы в папке `Release/`

- [`TrueSOTA_Monitor_Installers.zip`](TrueSOTA_Monitor_Installers.zip) — единый архив для передачи: **`TrueSOTA_Installer.exe`**, **`TrueSOTA_Setup.msi`** и **`README.md`**.
- [`TrueSOTA_Installer.exe`](TrueSOTA_Installer.exe) — установщик Windows (NSIS).
- [`TrueSOTA_Setup.msi`](TrueSOTA_Setup.msi) — установщик Windows (MSI).
- [`TrueSOTA_Monitor_AppleUI.exe`](TrueSOTA_Monitor_AppleUI.exe) — портативная версия (Portable).
- [`TrueSOTA_Monitor_Tauri.exe`](TrueSOTA_Monitor_Tauri.exe) — копия портативной сборки.

---

by [@afk3drp](https://t.me/afk3drp)
