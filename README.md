# Gensokyo Radio Card

Lovelace dashboard card for [Gensokyo Radio](https://gensokyoradio.net/) — the Touhou music internet radio station.

> **Requires the [Gensokyo Radio integration](https://github.com/pdostal/gensokyo-ha) to be installed first.**

---

## What it shows

- Album art (16:9 hero layout)
- Track title, artist, album, and doujin circle
- Star rating and community rating score
- Current listener count
- Animated progress bar with elapsed / total time

---

## Installation

### Via HACS (recommended)

1. Open **HACS → Frontend** → ⋮ → **Custom repositories**
2. Add `https://github.com/pdostal/gensokyo-ha-card` with category **Dashboard**
3. Install **Gensokyo Radio Card** — no restart needed
4. The card appears in **Edit dashboard → Add card** under *Gensokyo Radio*

### Manual (no HACS)

1. Copy `gensokyo-radio-card.js` to your HA `config/www/` directory
2. Go to **Settings → Dashboards → Resources** → Add resource:
   - URL: `/local/gensokyo-radio-card.js`
   - Resource type: **JavaScript module**
3. Reload the browser

---

## Usage

Add from the card picker, or in YAML:

```yaml
type: custom:gensokyo-radio-card
entity: media_player.gensokyo_radio
```

---

## License

MIT
