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
    return 4;
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
    const rating = attrs.rating || "";
    const timesRated = attrs.times_rated || 0;
    const listeners = attrs.listeners || 0;
    const albumArt = attrs.entity_picture || "";
    const streamUrl = attrs.stream_url || "https://stream.gensokyoradio.net/1/";

    const isTargetPlaying = targetState === "playing";
    const showControls = !!targetEntityId;

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

        .art-wrapper {
          position: relative;
          width: 100%;
          padding-top: 56.25%;
          background: #0d0d1a;
          overflow: hidden;
        }

        .art-wrapper img {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          transition: opacity 0.4s ease;
        }

        .art-placeholder {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 64px;
          opacity: 0.3;
        }

        .badge {
          position: absolute;
          top: 10px; right: 10px;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(4px);
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 12px;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .badge::before { content: "👥"; font-size: 11px; }

        .info {
          padding: 14px 16px 6px;
        }

        .title {
          font-size: 16px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
        }

        .artist {
          font-size: 13px;
          color: var(--accent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }

        .album-line {
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px 4px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .rating { display: flex; align-items: center; gap: 4px; }
        .stars { color: #f0c040; letter-spacing: 1px; }

        .controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 8px 16px 4px;
        }

        .ctrl-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 18px;
          border-radius: 20px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: opacity 0.15s, transform 0.1s;
          outline: none;
        }

        .ctrl-btn:active { transform: scale(0.95); }

        .btn-play {
          background: var(--accent);
          color: var(--card-bg, #1c1c2e);
        }

        .btn-play.active {
          opacity: 0.6;
          cursor: default;
        }

        .btn-stop {
          background: rgba(255,255,255,0.08);
          color: var(--text-secondary);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .btn-stop:hover { background: rgba(255,80,80,0.18); color: #ff6060; }

        .progress-container {
          padding: 4px 16px 14px;
        }

        .progress-bar {
          height: 4px;
          background: var(--progress-bg);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--progress-fill);
          border-radius: 2px;
          transition: width 1s linear;
          width: 0%;
        }

        .time-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
      </style>

      <ha-card class="card">
        <div class="art-wrapper">
          ${albumArt
            ? `<img src="${this._escapeHtml(albumArt)}" alt="Album art" onerror="this.style.display='none'">`
            : `<div class="art-placeholder">🎵</div>`
          }
          <div class="badge">${listeners}</div>
        </div>

        <div class="info">
          <div class="title" title="${this._escapeHtml(title)}">${this._escapeHtml(title)}</div>
          <div class="artist">${this._escapeHtml(artist)}</div>
          <div class="album-line">${this._escapeHtml(album)}${circle && circle !== artist ? ` · ${this._escapeHtml(circle)}` : ""}${year ? ` (${this._escapeHtml(year)})` : ""}</div>
        </div>

        <div class="meta-row">
          <div class="rating">
            <span class="stars">${this._ratingToStars(rating)}</span>
            <span>${rating}${timesRated ? ` (${timesRated})` : ""}</span>
          </div>
          <div>Gensokyo Radio</div>
        </div>

        ${showControls ? `
        <div class="controls">
          ${isTargetPlaying
            ? `<button class="ctrl-btn btn-stop" id="btn-stop" title="Stop linked speaker">⏹ Stop</button>`
            : `<button class="ctrl-btn btn-play" id="btn-play" title="Play on linked speaker">▶ Play</button>`
          }
        </div>
        ` : ""}

        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" id="gensokyo-progress"></div>
          </div>
          <div class="time-row">
            <span id="gensokyo-elapsed">0:00</span>
            <span id="gensokyo-duration">0:00</span>
          </div>
        </div>
      </ha-card>
    `;

    if (showControls) {
      this.shadowRoot.getElementById("btn-play")?.addEventListener("click", () => {
        this._hass.callService("media_player", "play_media", {
          entity_id: targetEntityId,
          media_content_id: streamUrl,
          media_content_type: "music",
        });
      });

      this.shadowRoot.getElementById("btn-stop")?.addEventListener("click", () => {
        this._hass.callService("media_player", "media_stop", {
          entity_id: targetEntityId,
        });
      });
    }

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
    const durationEl = this.shadowRoot.getElementById("gensokyo-duration");

    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
    if (elapsedEl) elapsedEl.textContent = this._formatTime(clamped);
    if (durationEl) durationEl.textContent = this._formatTime(this._duration);
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
