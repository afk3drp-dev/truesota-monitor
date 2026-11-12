## Pure OLED 2.0 UI Overhaul

Полностью переработанный дизайн **TrueSOTA Usage Monitor** в стиле Linear / Vercel / Apple Pro Telemetry:

- **Obsidian-поверхности и живой статус:** глубокий `#000000` OLED-холст, верхний specular-блик, hairline-границы и пульсирующий emerald-индикатор `active`.
- **Hero-кокпит квоты:** радиальная аура состояния (`health-good` / `med` / `low`), градиентное кольцо, split-баланс в стиле Apple Card (`$214` + `.65`), сегментированная шкала расхода, бейдж прогноза дней и процентная дельта `к 7д` на карточке «Сегодня».
- **Единый Telemetry Dock:** 4 ключевые метрики (`Кэш-хит`, `Экономия`, `Ср. отклик`, `Прогноз`) в цельной стеклянной панели (`4 колонки` / `2×2` в портрете `620×900`).
- **Двухрежимный 14-дневный график (`Кривая | Бары`):** плавный SVG Smooth Area Chart с градиентной заливкой и интерактивным перекрестием + переключатель на столбцы.
- **Лидерборд моделей и Dynamic Island 2.0:** нумерация ранга (`#1` emerald), доля `%`, клик по любой строке для мгновенного копирования ID и 7-дневный мини-спарклайн внутри раскрытого островка.

---

## Скачать для Windows 10 / 11 (x64)

| Файл | Назначение | Размер | SHA-256 |
| :--- | :--- | :--- | :--- |
| `TrueSOTA_Monitor_Installers.zip` | Установщики `NSIS` + `MSI` + `README.md` (**рекомендуется**) | 5.04 MiB | `4AEE319DCD8607466E2FD14BC0304FCD1B3E78EBCC3097AE4EEA6D4D841E4E73` |
| `TrueSOTA_Monitor_Tauri.exe` | Переносной Portable `.exe` без установки | 6.32 MiB | `9763810B5560521A504CDB8CF5BB13DD8E16975018404982A61A6AEF78A504A3` |

<details>
<summary>Проверка целостности в PowerShell</summary>

```powershell
Get-FileHash .\TrueSOTA_Monitor_Installers.zip -Algorithm SHA256
Get-FileHash .\TrueSOTA_Monitor_Tauri.exe -Algorithm SHA256
```

</details>
