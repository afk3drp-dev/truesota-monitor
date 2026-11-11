# Политика безопасности (Security Policy)

## Приватность и работа с API-ключом

**TrueSOTA Usage Monitor** спроектирован с приоритетом локальной безопасности:

- **Отсутствие встроенных ключей и телеметрии:** в бинарном файле и исходном коде нет зашитых API-токенов и сторонней аналитики.
- **Шифрование Windows DPAPI:** при первом входе ваш личный API-ключ шифруется на Rust-бэкенде с помощью системного API Windows (`CryptProtectData`) с привязкой к текущей учётной записи Windows и сохраняется только локально в `%APPDATA%\TrueSOTA_Monitor\truesota_config.json`.
- **Прямые HTTPS-соединения:** приложение общается напрямую с:
  - `https://true-sota.com` — баланс, квоты, прайсинг моделей и статус API-шлюза;
  - `https://api.github.com/repos/afk3drp-dev/truesota-monitor/releases/latest` — проверка наличия новой версии.
- **Защита WebView и экспорта:** включена строгая политика `CSP` Tauri, изоляция прав (capabilities), а при экспорте CSV-таблиц применяется защита от formula injection.

## Проверка подлинности сборок (SHA-256)

Все релизные сборки публикуются в [GitHub Releases](https://github.com/afk3drp-dev/truesota-monitor/releases) через автоматический workflow `.github/workflows/release.yml`.  
Для версии `v1.2.0` контрольные суммы SHA-256:

| Файл | SHA-256 |
| :--- | :--- |
| `TrueSOTA_Monitor_Installers.zip` | `E2BFB91CB5DA6F9D4DBC129EC5661A8F5006326C75F70DA31B7B44D9988FBA8D` |
| `TrueSOTA_Monitor_Tauri.exe` | `30EA9442215A87E080FE3A2A6B09F7B75E92F91A7A57F99E994B9DF3D8C9AF74` |

Проверить файл в PowerShell:

```powershell
Get-FileHash .\TrueSOTA_Monitor_Installers.zip -Algorithm SHA256
```

## Сообщить об уязвимости

Если вы обнаружили проблему безопасности, пожалуйста, **не публикуйте эксплойт в публичных Issues**, а свяжитесь напрямую:
- Telegram: [@afk3drp](https://t.me/afk3drp)
- Либо через приватный канал **GitHub Security Advisories** во вкладке **Security** этого репозитория.
