# BMS Dashboard — Design System

## Theme
- Default: **Dark navy** (`--bg: #0F2A45` family)
- Toggle: Light theme persisted as `bms_theme`
- Font: `Vazirmatn` from jsDelivr (preconnect + css2)

## Color Tokens (CSS vars in `src/style.css`)
| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#0D2137` | `#f2f5f8` |
| `--panel` | `#0F2A45` | `#ffffff` |
| `--panel2` | `#14325a` | `#e0e5e9` |
| `--border` | `#1d3d63` | `#c8d0d8` |
| `--text` | `#E8EDF2` | `#1a2a3a` |
| `--text-dim` | `#A8BDD6` | `#4a5a6a` |
| `--teal` | `#4fd1a5` | `#0d8a5f` |
| `--gold` | `#E8B641` | `#B8860B` |
| `--red` | `#E8566A` | `#C62828` |

## Layout
- Sticky top nav (`.topnav`, `position:sticky; top:0; z-index:80`)
- Max-width `1920px`, auto padding on wide screens
- Grid: `.kpi-grid` (auto-fit minmax 200px) → `.grid3` → `.grid2` → single col
- Map altitude `360px`, chart heights `220px / 250px / 320px`

## Chart Palette (10-item cycling)
`#4fd1a5  #4ECBFF  #E8B641  #a78bfa  #f472b6  #facc15  #38bdf8  #fb923c  #a3e635  #f87171`

## Responsive Breakpoints
- `> 1400px`: max-width 1920px
- `980–1400px`: tighter padding
- `540–980px`: `.board` 2-col, `.fpanel` 2-col
- `< 540px`: single column, smaller KPI fonts, chart heights 250px

## Icons / Emojis
- KPI glyphs: 🚢 📦 ⚓ 📊 📅 🏗️
- Buttons: 💾 خروجی اکسل, 🔄 بازنشانی, 📅 تقویم, ⏻ خروج
