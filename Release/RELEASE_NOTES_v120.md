## TrueSOTA Usage Monitor v1.2.0 — Pure OLED Windows Edition

Нативный OLED-клиент для Windows 11 (`Tauri v2 + Rust`): баланс квоты, аудит Prompt Cache, тепловая карта за 22 недели, каталог тарифов, командная палитра `Ctrl+K`, мини-виджет **Dynamic Island (`Alt+I`)**, системный трей и локальное шифрование ключа через **Windows DPAPI**.

🌐 **[Попробовать интерактивный симулятор прямо в браузере](https://afk3drp-dev.github.io/truesota-monitor/)**

### Что скачать (Windows 10 / 11 x64)

| Файл | Назначение | Размер | SHA-256 |
| :--- | :--- | :--- | :--- |
| `TrueSOTA_Monitor_Installers.zip` | Установщики `NSIS` (`TrueSOTA_Installer.exe`) + `MSI` (`TrueSOTA_Setup.msi`) + `README.md` (**рекомендуется**) | 5.03 MiB | `E2BFB91CB5DA6F9D4DBC129EC5661A8F5006326C75F70DA31B7B44D9988FBA8D` |
| `TrueSOTA_Monitor_Tauri.exe` | Переносной Portable `.exe` без установки | 6.32 MiB | `30EA9442215A87E080FE3A2A6B09F7B75E92F91A7A57F99E994B9DF3D8C9AF74` |

### Что нового в v1.2.0
- Переработан интерфейс в чистом **Pure OLED** стиле (`#000000`) без стороннего blur-слоя с плавными переходами `SmoothTab`.
- Компактный портретный формат по умолчанию `620×900` с мгновенным переключением в `1920×1080` / `880×880` / `1600×940` / **Dynamic Island**.
- Убраны лишние визуальные эффекты; улучшена читаемость графиков, карточек экономии кэша и меню профиля.

<details>
<summary>Проверка целостности SHA-256 и Windows SmartScreen</summary>

```powershell
Get-FileHash .\TrueSOTA_Monitor_Installers.zip -Algorithm SHA256
Get-FileHash .\TrueSOTA_Monitor_Tauri.exe -Algorithm SHA256
```

Если Windows SmartScreen покажет предупреждение при первом запуске неподписанного open-source `.exe`, нажмите **«Подробнее» → «Выполнить в любом случае»**.

</details>
