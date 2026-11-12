# Как помочь проекту (Contributing Guide)

Спасибо за интерес к **TrueSOTA Usage Monitor**! Любые улучшения интерфейса, исправления багов на Rust/React и идеи приветствуются.

## Локальный запуск и проверка

Требования для Windows 10/11:
- **Node.js 20+**
- **Rust (stable MSVC)** + **WebView2 Runtime**

```powershell
git clone https://github.com/afk3drp-dev/truesota-monitor.git
cd truesota-monitor
npm install

# Режим разработки (Vite + Tauri)
npm run tauri dev
```

Перед отправкой Pull Request обязательно проверьте сборку и тесты (они же запускаются в `.github/workflows/ci.yml`):

```powershell
# Проверка TypeScript и сборка фронтенда
npm run build

# Юнит-тесты Rust-бэкенда (DPAPI, валидация обновлений и безопасности)
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## Правила для Pull Request

1. Ответвляйтесь от ветки `main`.
2. Сохраняйте минималистичную **Pure OLED** эстетику (`#000000`, высокий контраст, без лишнего визуального шума).
3. Никогда не коммитьте реальные API-ключи, токены или файлы из `%APPDATA%\TrueSOTA_Monitor`.
4. Кратко опишите изменения и приложите скриншот, если меняли UI.

Вопросы и идеи можно обсудить во вкладке [Discussions](https://github.com/afk3drp-dev/truesota-monitor/discussions) или написать [@afk3drp](https://t.me/afk3drp).
