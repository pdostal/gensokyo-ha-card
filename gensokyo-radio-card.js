/**
 * Gensokyo Radio Lovelace Card
 *
 * Displays the currently playing track on Gensokyo Radio with album art,
 * animated progress bar, rating, and listener count.
 *
 * When the integration is configured with a target media player, the card
 * also shows Play / Stop buttons that control that player.
 *
 * Usage:
 *   type: custom:gensokyo-radio-card
 *   entity: media_player.gensokyo_radio
 */

class GensokyoRadioCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._progressTimer = null;
    this._positionBase = null;
    this._positionBaseTime = null;
    this._duration = null;
    this._lastSongId = null;
    this._lastTargetState = undefined;
  }

  // ------------------------------------------------------------------ //
  // Lovelace card API
  // ------------------------------------------------------------------ //

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity (e.g. media_player.gensokyo_radio)");
    }
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const entityId = this._config.entity;
    const state = hass.states[entityId];

    if (!state) {
      this._renderUnavailable();
      return;
    }

    const attrs = state.attributes;
    const songId = attrs.song_id;
    const targetEntityId = attrs.target_player;
    const targetState = targetEntityId
      ? (hass.states[targetEntityId]?.state ?? "idle")
      : null;

    // Re-render when song changes OR target player play/stop state flips
    if (songId !== this._lastSongId || targetState !== this._lastTargetState) {
      this._lastSongId = songId;
      this._lastTargetState = targetState;
      this._render(state, targetEntityId, targetState);
    }

    this._syncPosition(attrs);
  }

  getCardSize() {
    return 1;
  }

  static getStubConfig(hass) {
    const entity =
      Object.keys(hass?.states ?? {}).find(
        (id) => id.startsWith("media_player.") && id.includes("gensokyo")
      ) ?? "media_player.gensokyo_radio";
    return { entity };
  }

  disconnectedCallback() {
    this._stopProgressTimer();
  }

  // ------------------------------------------------------------------ //
  // Rendering
  // ------------------------------------------------------------------ //

  _render(state, targetEntityId, targetState) {
    const attrs = state.attributes;
    const title = attrs.media_title || "Unknown Track";
    const artist = attrs.media_artist || "";
    const album = attrs.media_album_name || "";
    const circle = attrs.media_album_artist || "";
    const year = attrs.year || "";
    const albumId = attrs.album_id || "";
    const albumArt = attrs.entity_picture || "";

    const albumUrl = albumId
      ? `https://gensokyoradio.net/music/album/${encodeURIComponent(albumId)}/`
      : "https://gensokyoradio.net/";

    const albumLine = [
      album,
      circle && circle !== artist ? circle : "",
      year ? `(${year})` : "",
    ].filter(Boolean).join(" · ");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --card-bg: var(--ha-card-background, #1c1c2e);
          --accent: var(--primary-color, #b39ddb);
          --text-primary: var(--primary-text-color, #e8e8f0);
          --text-secondary: var(--secondary-text-color, #9a9ab0);
          --progress-bg: rgba(255,255,255,0.1);
          --progress-fill: var(--accent);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        .card {
          background: var(--card-bg);
          border-radius: var(--ha-card-border-radius, 12px);
          overflow: hidden;
          box-shadow: var(--ha-card-box-shadow, 0 2px 12px rgba(0,0,0,0.4));
          color: var(--text-primary);
        }

        a.card-link {
          display: block;
          text-decoration: none;
          color: inherit;
        }

        .main-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 6px;
          position: relative;
        }

        .art-thumb {
          flex: 0 0 40px;
          width: 40px;
          height: 40px;
          border-radius: 6px;
          overflow: hidden;
          background: #0d0d1a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .art-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .info {
          flex: 1;
          min-width: 0;
        }

        .title {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .album-line {
          font-size: 11px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .time-col {
          position: absolute;
          top: 6px;
          right: 12px;
          font-size: 11px;
          color: var(--text-secondary);
          text-align: right;
          white-space: nowrap;
          pointer-events: none;
        }

        .progress-bar {
          height: 3px;
          background: var(--progress-bg);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--progress-fill);
          transition: width 1s linear;
          width: 0%;
        }
      </style>

      <ha-card class="card">
        <a class="card-link" href="${this._escapeHtml(albumUrl)}" target="_blank" rel="noopener noreferrer">
          <div class="main-row">
            <div class="art-thumb">
              ${albumArt
                ? `<img src="${this._escapeHtml(albumArt)}" alt="Album art" onerror="this.style.display='none'">`
                : `🎵`
              }
            </div>
            <div class="info">
              <div class="title" title="${this._escapeHtml(title)}">${this._escapeHtml(title)}</div>
              <div class="album-line">${this._escapeHtml(albumLine)}</div>
            </div>
            <div class="time-col">
              <span id="gensokyo-elapsed">0:00</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="gensokyo-progress"></div>
          </div>
        </a>
      </ha-card>
    `;

    this._syncPosition(state.attributes);
    this._startProgressTimer();
  }

  _renderUnavailable() {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding:16px;text-align:center;color:var(--secondary-text-color,#9a9ab0);">
          Gensokyo Radio unavailable
        </div>
      </ha-card>
    `;
  }

  // ------------------------------------------------------------------ //
  // Progress bar animation
  // ------------------------------------------------------------------ //

  _syncPosition(attrs) {
    const position = attrs.media_position;
    const updatedAt = attrs.media_position_updated_at;
    const duration = attrs.media_duration;

    if (position == null || duration == null) return;

    this._positionBase = parseFloat(position);
    this._positionBaseTime = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    this._duration = parseFloat(duration);

    this._updateProgressDOM();
  }

  _startProgressTimer() {
    this._stopProgressTimer();
    this._progressTimer = setInterval(() => this._updateProgressDOM(), 1000);
  }

  _stopProgressTimer() {
    if (this._progressTimer !== null) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  _updateProgressDOM() {
    if (this._positionBase == null || this._duration == null) return;

    const elapsed = this._positionBase + (Date.now() - this._positionBaseTime) / 1000;
    const clamped = Math.min(Math.max(elapsed, 0), this._duration);
    const pct = (clamped / this._duration) * 100;

    const fill = this.shadowRoot.getElementById("gensokyo-progress");
    const elapsedEl = this.shadowRoot.getElementById("gensokyo-elapsed");

    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
    if (elapsedEl) elapsedEl.textContent = this._formatTime(clamped);
  }

  // ------------------------------------------------------------------ //
  // Utilities
  // ------------------------------------------------------------------ //

  _formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
  }

  _ratingToStars(ratingStr) {
    if (!ratingStr) return "";
    const num = parseFloat(ratingStr);
    if (isNaN(num)) return "";
    const full = Math.round(num);
    return "★".repeat(full) + "☆".repeat(Math.max(0, 5 - full));
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

customElements.define("gensokyo-radio-card", GensokyoRadioCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "custom:gensokyo-radio-card",
  name: "Gensokyo Radio Card",
  description: "Displays the currently playing track on Gensokyo Radio with album art, animated progress, and optional speaker control.",
  preview: true,
  documentationURL: "https://github.com/pdostal/gensokyo-ha",
});
