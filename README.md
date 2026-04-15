# Gensokyo Radio Card

Lovelace dashboard card for [Gensokyo Radio](https://gensokyoradio.net/) — the Touhou music internet radio station.

Displays the currently playing track with album art, animated progress bar, star rating, listener count, and elapsed/duration times. Optionally shows Play/Stop controls for a linked speaker.

> **Requires the [Gensokyo Radio integration](https://github.com/pdostal/gensokyo-ha) to be installed first.**

---

## Installation

### Via HACS (recommended)

1. Open **HACS → Frontend** → ⋮ → **Custom repositories**
2. Add `https://github.com/pdostal/gensokyo-ha-card` with category **Dashboard**
3. Install **Gensokyo Radio Card** — no restart needed

### Manual

1. Copy `gensokyo-radio-card.js` to your HA `config/www/` directory
2. Go to **Settings → Dashboards → Resources** and add:
   - URL: `/local/gensokyo-radio-card.js`
   - Type: **JavaScript module**

---

## Usage

After installing, add the card from **Edit dashboard → Add card** (search for *Gensokyo Radio*), or add it manually in YAML:

```yaml
type: custom:gensokyo-radio-card
entity: media_player.gensokyo_radio
```

---

## License

MIT
