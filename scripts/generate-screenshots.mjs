import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'docs', 'assets', 'screenshots');

// Load font data URIs
const fonts = JSON.parse(readFileSync('/tmp/font-data-uris.json', 'utf8'));

function fontFaces() {
  return `
@font-face {
  font-family: 'Material Icons';
  font-style: normal;
  font-weight: 400;
  src: url('${fonts['material-icons']}') format('woff2');
}
@font-face { font-family: 'Roboto'; font-weight: 400; src: url('${fonts['roboto-400']}') format('woff2'); }
@font-face { font-family: 'Roboto'; font-weight: 500; src: url('${fonts['roboto-500']}') format('woff2'); }
@font-face { font-family: 'Roboto'; font-weight: 600; src: url('${fonts['roboto-600']}') format('woff2'); }
@font-face { font-family: 'Roboto'; font-weight: 700; src: url('${fonts['roboto-700']}') format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url('${fonts['jetbrains-400']}') format('woff2'); }

.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}`;
}

function darkDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${fontFaces()}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0a0a14;
  color: #e0e0e0;
  width: 1200px;
  height: 960px;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
.app { display: flex; height: 960px; position: relative; }

/* === SIDEBAR === */
.side { width: 190px; background: #0e0e1a; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 16px 0; flex-shrink: 0; }
.s-logo { display: flex; align-items: center; gap: 10px; padding: 4px 16px 24px; }
.s-logo-icon { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #5c6bc0, #42a5f5); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 12px; }
.s-logo-name { font-weight: 600; font-size: 15px; color: #fff; line-height: 1.2; }
.s-logo-sub { font-size: 11px; color: rgba(255,255,255,0.35); }
.s-section { padding: 0 10px; margin-top: 6px; }
.s-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 1.1px; text-transform: uppercase; padding: 10px 10px 4px; }
.s-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 1px; }
.s-item .material-icons { font-size: 19px; }
.s-item.active { background: rgba(99,102,241,0.12); color: #818cf8; position: relative; }
.s-item.active::after { content: ''; position: absolute; right: 0; top: 25%; height: 50%; width: 3px; background: #818cf8; border-radius: 2px; }
.s-footer { margin-top: auto; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
.s-version { font-size: 10px; color: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 4px; }
.s-theme { color: rgba(255,255,255,0.25); }
.s-theme .material-icons { font-size: 17px; }

/* === MAIN === */
.main { flex: 1; padding: 18px 22px; overflow-y: auto; }

/* Header */
.hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.hdr-title { font-size: 15px; color: rgba(255,255,255,0.45); font-weight: 400; }
.copilot-btn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(129,140,248,0.35); background: linear-gradient(135deg, rgba(129,140,248,0.12), rgba(124,58,237,0.1)); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(129,140,248,0.2); }
.copilot-btn .material-icons { font-size: 17px; color: #a78bfa; }

/* Hero */
.hero { background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(59,130,246,0.06) 100%); border: 1px solid rgba(99,102,241,0.12); border-radius: 14px; padding: 22px 26px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
.hero-t { font-size: 25px; font-weight: 700; color: #fff; }
.hero-sub { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 5px; }
.hero-badges { display: flex; gap: 10px; }
.badge { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 4px 11px; font-size: 11px; color: rgba(255,255,255,0.5); }
.dot-green { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
.badge .material-icons { font-size: 13px; color: rgba(255,255,255,0.3); }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 14px; }
.stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 14px 16px; }
.stat-top { display: flex; justify-content: space-between; }
.stat-lbl { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.7px; text-transform: uppercase; }
.stat-ic { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.stat-ic .material-icons { font-size: 15px; }
.stat-val { font-size: 26px; font-weight: 700; color: #fff; margin: 4px 0 3px; }
.stat-ch { font-size: 10px; display: flex; align-items: center; gap: 3px; }
.stat-ch .material-icons { font-size: 13px; }
.ch-green { color: #4ade80; }
.ch-muted { color: rgba(255,255,255,0.25); }

/* Cards */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 18px; }
.card-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.card-t { font-size: 15px; font-weight: 600; color: #fff; }
.card-sub { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 2px; }
.card-badge { font-size: 10px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.35); padding: 2px 8px; border-radius: 8px; }
.card-link { font-size: 11px; color: #818cf8; text-decoration: none; white-space: nowrap; }

/* Categories */
.cat { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cat:last-child { margin-bottom: 0; }
.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cat-name { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 500; min-width: 82px; }
.cat-bar { flex: 1; height: 5px; background: rgba(255,255,255,0.04); border-radius: 3px; overflow: hidden; }
.cat-fill { height: 100%; border-radius: 3px; }
.cat-cnt { font-size: 11px; color: rgba(255,255,255,0.35); min-width: 65px; text-align: right; }

/* Failures */
.fail { border-left: 3px solid #ef4444; background: rgba(239,68,68,0.04); border-radius: 0 10px 10px 0; padding: 11px 13px; margin-bottom: 9px; }
.fail:last-child { margin-bottom: 0; }
.fail-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.fail-title { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.8); line-height: 1.3; }
.fail-badge { font-size: 9px; background: rgba(239,68,68,0.12); color: #f87171; padding: 2px 7px; border-radius: 8px; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.fail-desc { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 3px; }
.fail-meta { font-size: 9px; color: rgba(255,255,255,0.2); margin-top: 5px; }

/* AI Perf */
.ai-circles { display: flex; gap: 28px; justify-content: center; margin-bottom: 14px; }
.ai-circ { text-align: center; }
.circ-wrap { width: 68px; height: 68px; position: relative; margin: 0 auto 5px; }
.circ-wrap svg { width: 68px; height: 68px; transform: rotate(-90deg); }
.circ-bg { fill: none; stroke: rgba(255,255,255,0.05); stroke-width: 5; }
.circ-fg { fill: none; stroke-width: 5; stroke-linecap: round; }
.circ-val { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 13px; font-weight: 700; color: #fff; }
.circ-lbl { font-size: 10px; color: rgba(255,255,255,0.3); }
.ai-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 11px; }
.ai-row:last-child { border-bottom: none; }
.ai-row-l { color: rgba(255,255,255,0.35); display: flex; align-items: center; gap: 5px; }
.ai-row-l .material-icons { font-size: 13px; }
.ai-row-v { color: rgba(255,255,255,0.7); font-weight: 600; }

/* Providers */
.prov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.prov { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 9px; padding: 11px; }
.prov.active { border-color: rgba(129,140,248,0.25); }
.prov-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }
.prov-name { font-size: 12px; font-weight: 600; color: #fff; }
.prov-active { font-size: 8px; background: rgba(74,222,128,0.12); color: #4ade80; padding: 2px 7px; border-radius: 6px; font-weight: 600; }
.prov-stats { display: flex; gap: 14px; }
.prov-s-lbl { font-size: 8px; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.4px; }
.prov-s-val { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6); margin-top: 1px; }
.prov-s-val.cost { color: #4ade80; }
.prov-s-val.speed { color: #fbbf24; }

/* === CHAT DRAWER (overlay) === */
.chat-overlay {
  position: absolute;
  top: 0;
  right: 0;
  width: 390px;
  height: 960px;
  background: rgba(14,14,26,0.97);
  backdrop-filter: blur(20px) saturate(180%);
  border-left: 1px solid rgba(129,140,248,0.12);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -8px 0 32px rgba(0,0,0,0.4);
}
.ch-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(129,140,248,0.06), rgba(52,211,153,0.03));
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ch-hdr-l { display: flex; align-items: center; gap: 9px; }
.ch-hdr-l .material-icons { font-size: 20px; color: #a78bfa; }
.ch-hdr-name { font-size: 14px; font-weight: 600; color: #fff; }
.ch-hdr-sub { font-size: 10px; color: rgba(255,255,255,0.35); }
.ch-hdr-r { display: flex; gap: 2px; }
.ch-hdr-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ch-hdr-btn .material-icons { font-size: 16px; }

.ch-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.m { max-width: 90%; }
.m.u { align-self: flex-end; }
.m.a { align-self: flex-start; }
.m-bub { padding: 9px 13px; font-size: 12px; line-height: 1.55; }
.m.u .m-bub { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border-radius: 14px 14px 4px 14px; }
.m.a .m-bub { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); border-radius: 4px 14px 14px 14px; }
.m.a .m-bub strong { color: #fff; }
.m.a .m-bub code { font-family: 'JetBrains Mono', monospace; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px; font-size: 11px; }

.m-tool { display: flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 7px; font-size: 11px; font-weight: 500; align-self: flex-start; }
.m-tool.search { background: rgba(129,140,248,0.08); color: #c4b5fd; }
.m-tool.result { background: rgba(52,211,153,0.07); color: #6ee7b7; }
.m-tool .material-icons { font-size: 13px; }

.ch-input {
  padding: 10px 14px 8px;
  background: rgba(0,0,0,0.15);
  border-top: 1px solid rgba(255,255,255,0.05);
}
.ch-input-row {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 8px 11px;
}
.ch-input-field { flex: 1; border: none; outline: none; background: transparent; color: rgba(255,255,255,0.8); font-size: 12px; font-family: 'Roboto', sans-serif; }
.ch-send { border: none; background: none; color: rgba(255,255,255,0.12); display: flex; align-items: center; }
.ch-send .material-icons { font-size: 16px; }
.ch-disc { text-align: center; font-size: 9px; color: rgba(255,255,255,0.15); margin-top: 6px; }
</style>
</head>
<body>
<div class="app">

<nav class="side">
  <div class="s-logo">
    <div class="s-logo-icon">TC</div>
    <div><div class="s-logo-name">TestOps</div><div class="s-logo-sub">Companion</div></div>
  </div>
  <div class="s-section">
    <div class="s-label">Overview</div>
    <div class="s-item active"><span class="material-icons">dashboard</span> Dashboard</div>
  </div>
  <div class="s-section">
    <div class="s-label">Testing</div>
    <div class="s-item"><span class="material-icons">play_arrow</span> Pipelines</div>
    <div class="s-item"><span class="material-icons">description</span> Test Runs</div>
    <div class="s-item"><span class="material-icons">psychology</span> Failure Knowledge Base</div>
  </div>
  <div class="s-section">
    <div class="s-label">System</div>
    <div class="s-item"><span class="material-icons">attach_money</span> Cost Tracker</div>
    <div class="s-item"><span class="material-icons">notifications</span> Notifications</div>
    <div class="s-item"><span class="material-icons">settings</span> Settings</div>
  </div>
  <div class="s-footer">
    <span class="s-version">v2.9.0</span>
    <span class="s-theme"><span class="material-icons">brightness_6</span></span>
  </div>
</nav>

<div class="main">
  <div class="hdr">
    <span class="hdr-title">Dashboard</span>
    <div class="copilot-btn"><span class="material-icons">auto_awesome</span></div>
  </div>

  <div class="hero">
    <div>
      <div class="hero-t">Failure Analysis</div>
      <div class="hero-sub">Last 30 days · 15,940 tests processed · Last sync 04:59 PM</div>
    </div>
    <div class="hero-badges">
      <div class="badge"><span class="dot-green"></span> All Systems Operational</div>
      <div class="badge"><span class="material-icons">cached</span> Cache 0%</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">Tests Analyzed</span><div class="stat-ic" style="background:rgba(96,165,250,0.1);color:#60a5fa;"><span class="material-icons">bar_chart</span></div></div>
      <div class="stat-val">15,940</div>
      <div class="stat-ch ch-green"><span class="material-icons">trending_up</span> +12% from yesterday</div>
    </div>
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">Failures Categorized</span><div class="stat-ic" style="background:rgba(251,191,36,0.1);color:#fbbf24;"><span class="material-icons">category</span></div></div>
      <div class="stat-val">797</div>
      <div class="stat-ch ch-green"><span class="material-icons">check_circle</span> 100% categorization rate</div>
    </div>
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">Hours Saved</span><div class="stat-ic" style="background:rgba(52,211,153,0.1);color:#34d399;"><span class="material-icons">schedule</span></div></div>
      <div class="stat-val">199.3h</div>
      <div class="stat-ch ch-muted"><span class="material-icons">swap_horiz</span> vs manual analysis</div>
    </div>
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">AI Spend</span><div class="stat-ic" style="background:rgba(74,222,128,0.1);color:#4ade80;"><span class="material-icons">attach_money</span></div></div>
      <div class="stat-val">$2.34</div>
      <div class="stat-ch ch-muted"><span class="material-icons">cached</span> 0% saved via cache</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-hdr">
        <div><div class="card-t">Failure Categories</div><div class="card-sub">AI-powered classification with confidence scoring</div></div>
        <span class="card-badge">6 types</span>
      </div>
      <div class="cat"><span class="cat-dot" style="background:#fbbf24;"></span><span class="cat-name">Minor Bug</span><div class="cat-bar"><div class="cat-fill" style="width:60%;background:#fbbf24;"></div></div><span class="cat-cnt">210 (26%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#818cf8;"></span><span class="cat-name">Flaky Test</span><div class="cat-bar"><div class="cat-fill" style="width:46%;background:#818cf8;"></div></div><span class="cat-cnt">158 (20%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#f87171;"></span><span class="cat-name">Critical Bug</span><div class="cat-bar"><div class="cat-fill" style="width:38%;background:#f87171;"></div></div><span class="cat-cnt">130 (16%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#60a5fa;"></span><span class="cat-name">Configuration</span><div class="cat-bar"><div class="cat-fill" style="width:35%;background:#60a5fa;"></div></div><span class="cat-cnt">123 (15%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#34d399;"></span><span class="cat-name">Environment</span><div class="cat-bar"><div class="cat-fill" style="width:30%;background:#34d399;"></div></div><span class="cat-cnt">102 (13%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#fb923c;"></span><span class="cat-name">Unknown</span><div class="cat-bar"><div class="cat-fill" style="width:22%;background:#fb923c;"></div></div><span class="cat-cnt">74 (9%)</span></div>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div><div class="card-t">Recent Failures</div><div class="card-sub">Intelligent log summarization with root cause detection</div></div>
        <a class="card-link" href="#">View all →</a>
      </div>
      <div class="fail">
        <div class="fail-top"><span class="fail-title">Division by zero in tax calculation for international orders</span><span class="fail-badge">Critical Bug</span></div>
        <div class="fail-desc">Missing tax rate configuration for newly added country code</div>
        <div class="fail-meta">85% confidence · 0 similar · ShoppingCart.calculateTax_bug_critical_144</div>
      </div>
      <div class="fail">
        <div class="fail-top"><span class="fail-title">WebSocket connection dropped after 30 seconds</span><span class="fail-badge">Critical Bug</span></div>
        <div class="fail-desc">Load balancer timeout shorter than application keepalive interval</div>
        <div class="fail-meta">85% confidence · 0 similar · WebSocket.handleConnection_bug_critical_169</div>
      </div>
      <div class="fail">
        <div class="fail-top"><span class="fail-title">Division by zero in tax calculation for international orders</span><span class="fail-badge">Critical Bug</span></div>
        <div class="fail-desc">Missing tax rate configuration for newly added country code</div>
        <div class="fail-meta">85% confidence · 0 similar · ShoppingCart.calculateTax_bug_critical_171</div>
      </div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-hdr">
        <div class="card-t" style="display:flex;align-items:center;gap:7px;"><span class="material-icons" style="color:#34d399;font-size:17px;">emoji_objects</span> AI Performance</div>
      </div>
      <div class="ai-circles">
        <div class="ai-circ">
          <div class="circ-wrap"><svg viewBox="0 0 68 68"><circle class="circ-bg" cx="34" cy="34" r="28"/><circle class="circ-fg" cx="34" cy="34" r="28" stroke="#34d399" stroke-dasharray="170" stroke-dashoffset="5"/></svg><span class="circ-val">96.8%</span></div>
          <span class="circ-lbl">Accuracy</span>
        </div>
        <div class="ai-circ">
          <div class="circ-wrap"><svg viewBox="0 0 68 68"><circle class="circ-bg" cx="34" cy="34" r="28"/><circle class="circ-fg" cx="34" cy="34" r="28" stroke="#34d399" stroke-dasharray="0" stroke-dashoffset="0"/></svg><span class="circ-val">0%</span></div>
          <span class="circ-lbl">Cache Hit</span>
        </div>
        <div class="ai-circ">
          <div class="circ-wrap"><svg viewBox="0 0 68 68"><circle class="circ-bg" cx="34" cy="34" r="28"/><circle class="circ-fg" cx="34" cy="34" r="28" stroke="#fbbf24" stroke-dasharray="83" stroke-dashoffset="0"/></svg><span class="circ-val">47.2%</span></div>
          <span class="circ-lbl">Budget Used</span>
        </div>
      </div>
      <div class="ai-row"><span class="ai-row-l"><span class="material-icons">schedule</span> Avg Analysis Time</span><span class="ai-row-v">2.3s</span></div>
      <div class="ai-row"><span class="ai-row-l"><span class="material-icons">content_copy</span> Similar Failures Matched</span><span class="ai-row-v">89</span></div>
      <div class="ai-row"><span class="ai-row-l"><span class="material-icons">attach_money</span> Monthly Budget</span><span class="ai-row-v">$47.20 / $100</span></div>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div class="card-t">Providers</div>
        <span style="font-size:10px;color:rgba(255,255,255,0.25);">Multi-provider · Cost-optimized</span>
      </div>
      <div class="prov-grid">
        <div class="prov active">
          <div class="prov-top"><span class="prov-name">Claude Sonnet 4.5</span><span class="prov-active">Active</span></div>
          <div class="prov-stats">
            <div><div class="prov-s-lbl">Cost/1M</div><div class="prov-s-val cost">$9.00</div></div>
            <div><div class="prov-s-lbl">Context</div><div class="prov-s-val">200K</div></div>
            <div><div class="prov-s-lbl">Speed</div><div class="prov-s-val speed">⚡⚡⚡⚡</div></div>
          </div>
        </div>
        <div class="prov">
          <div class="prov-top"><span class="prov-name">GPT-4 Turbo</span></div>
          <div class="prov-stats">
            <div><div class="prov-s-lbl">Cost/1M</div><div class="prov-s-val cost">$20.00</div></div>
            <div><div class="prov-s-lbl">Context</div><div class="prov-s-val">128K</div></div>
            <div><div class="prov-s-lbl">Speed</div><div class="prov-s-val speed">⚡⚡</div></div>
          </div>
        </div>
        <div class="prov" style="grid-column: span 2;">
          <div class="prov-top"><span class="prov-name">Gemini 1.5 Flash</span></div>
          <div class="prov-stats">
            <div><div class="prov-s-lbl">Cost/1M</div><div class="prov-s-val cost">$0.38</div></div>
            <div><div class="prov-s-lbl">Context</div><div class="prov-s-val">1M</div></div>
            <div><div class="prov-s-lbl">Speed</div><div class="prov-s-val speed">⚡⚡⚡⚡</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Chat Drawer Overlay -->
<div class="chat-overlay">
  <div class="ch-hdr">
    <div class="ch-hdr-l">
      <span class="material-icons">auto_awesome</span>
      <div><div class="ch-hdr-name">TestOps Copilot</div><div class="ch-hdr-sub">AI-powered assistant</div></div>
    </div>
    <div class="ch-hdr-r">
      <button class="ch-hdr-btn"><span class="material-icons">delete_outline</span></button>
      <button class="ch-hdr-btn"><span class="material-icons">close</span></button>
    </div>
  </div>

  <div class="ch-msgs">
    <div class="m u"><div class="m-bub">Which tests failed in the last 24 hours?</div></div>
    <div class="m-tool search"><span class="material-icons">search</span> Searching test runs from the last 24 hours...</div>
    <div class="m-tool result"><span class="material-icons">check_circle_outline</span> Found 12 failed tests across 3 pipelines</div>
    <div class="m a"><div class="m-bub">Here's a summary of the <strong>12 failed tests</strong> in the last 24 hours:<br><br><strong>Pipeline: payment-service</strong> (5 failures)<br>• <code>tax_calculation_test</code> — Division by zero for intl orders<br>• <code>currency_conversion_test</code> — Stale exchange rate cache<br>• 3 more flaky retries<br><br><strong>Pipeline: auth-service</strong> (4 failures)<br>• <code>oauth_token_refresh</code> — Timeout after 30s<br>• <code>session_validation</code> — Redis connection reset<br>• 2 environment issues<br><br><strong>Pipeline: web-frontend</strong> (3 failures)<br>• <code>checkout_e2e</code> — Element not found<br>• 2 flaky tests<br><br>The most critical is the <strong>tax calculation bug</strong> — it has recurred 3 times this week. Want me to search Jira for related issues?</div></div>
    <div class="m u"><div class="m-bub">Yes, check Jira for the tax calculation issue</div></div>
    <div class="m-tool search"><span class="material-icons">search</span> Searching Jira for tax calculation issues...</div>
    <div class="m-tool result"><span class="material-icons">check_circle_outline</span> Found 2 matching Jira issues</div>
    <div class="m a"><div class="m-bub">Found <strong>2 related Jira issues</strong>:<br><br><strong>PROJ-1247</strong> — <em>Tax calculation fails for new EU country codes</em><br>Status: In Progress · Assignee: Sarah K. · Priority: High<br><br><strong>PROJ-1190</strong> — <em>Zero division in tax module when config missing</em><br>Status: Resolved · Fixed in v2.8.3<br><br>PROJ-1247 looks like the active fix. Want me to check the GitHub PR?</div></div>
  </div>

  <div class="ch-input">
    <div class="ch-input-row">
      <input class="ch-input-field" type="text" placeholder="Ask me anything about your test infrastructure...">
      <button class="ch-send"><span class="material-icons">send</span></button>
    </div>
    <div class="ch-disc">AI responses may be inaccurate. Always verify critical data.</div>
  </div>
</div>

</div>
</body>
</html>`;
}

function lightDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${fontFaces()}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f4f4f9;
  color: #1e1e2e;
  width: 1200px;
  height: 960px;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
.app { display: flex; height: 960px; position: relative; }

/* === SIDEBAR === */
.side { width: 190px; background: #fff; border-right: 1px solid rgba(0,0,0,0.07); display: flex; flex-direction: column; padding: 16px 0; flex-shrink: 0; }
.s-logo { display: flex; align-items: center; gap: 10px; padding: 4px 16px 24px; }
.s-logo-icon { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #5c6bc0, #42a5f5); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 12px; }
.s-logo-name { font-weight: 600; font-size: 15px; color: #1e1e2e; line-height: 1.2; }
.s-logo-sub { font-size: 11px; color: rgba(0,0,0,0.35); }
.s-section { padding: 0 10px; margin-top: 6px; }
.s-label { font-size: 10px; font-weight: 600; color: rgba(0,0,0,0.3); letter-spacing: 1.1px; text-transform: uppercase; padding: 10px 10px 4px; }
.s-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 13px; color: rgba(0,0,0,0.45); margin-bottom: 1px; }
.s-item .material-icons { font-size: 19px; }
.s-item.active { background: rgba(99,102,241,0.08); color: #6366f1; position: relative; }
.s-item.active::after { content: ''; position: absolute; right: 0; top: 25%; height: 50%; width: 3px; background: #6366f1; border-radius: 2px; }
.s-footer { margin-top: auto; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
.s-version { font-size: 10px; color: rgba(0,0,0,0.3); border: 1px solid rgba(0,0,0,0.08); padding: 2px 7px; border-radius: 4px; }
.s-theme { color: rgba(0,0,0,0.25); }
.s-theme .material-icons { font-size: 17px; }

/* === MAIN === */
.main { flex: 1; padding: 18px 22px; overflow-y: auto; }

/* Header */
.hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.hdr-title { font-size: 15px; color: rgba(0,0,0,0.4); font-weight: 400; }
.copilot-btn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(99,102,241,0.3); background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.06)); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(99,102,241,0.15); }
.copilot-btn .material-icons { font-size: 17px; color: #7c3aed; }

/* Hero */
.hero { background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(59,130,246,0.04)); border: 1px solid rgba(99,102,241,0.1); border-radius: 14px; padding: 22px 26px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
.hero-t { font-size: 25px; font-weight: 700; color: #1e1e2e; }
.hero-sub { font-size: 12px; color: rgba(0,0,0,0.35); margin-top: 5px; }
.hero-badges { display: flex; gap: 10px; }
.badge { display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 4px 11px; font-size: 11px; color: rgba(0,0,0,0.45); }
.dot-green { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
.badge .material-icons { font-size: 13px; color: rgba(0,0,0,0.3); }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 14px; }
.stat { background: #fff; border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
.stat-top { display: flex; justify-content: space-between; }
.stat-lbl { font-size: 9px; font-weight: 600; color: rgba(0,0,0,0.35); letter-spacing: 0.7px; text-transform: uppercase; }
.stat-ic { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.stat-ic .material-icons { font-size: 15px; }
.stat-val { font-size: 26px; font-weight: 700; color: #1e1e2e; margin: 4px 0 3px; }
.stat-ch { font-size: 10px; display: flex; align-items: center; gap: 3px; }
.stat-ch .material-icons { font-size: 13px; }
.ch-green { color: #16a34a; }
.ch-muted { color: rgba(0,0,0,0.3); }

/* Cards */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.card { background: #fff; border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
.card-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.card-t { font-size: 15px; font-weight: 600; color: #1e1e2e; }
.card-sub { font-size: 11px; color: rgba(0,0,0,0.3); margin-top: 2px; }
.card-badge { font-size: 10px; background: rgba(0,0,0,0.04); color: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 8px; }
.card-link { font-size: 11px; color: #6366f1; text-decoration: none; white-space: nowrap; }

/* Categories */
.cat { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cat:last-child { margin-bottom: 0; }
.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cat-name { font-size: 12px; color: rgba(0,0,0,0.65); font-weight: 500; min-width: 82px; }
.cat-bar { flex: 1; height: 5px; background: rgba(0,0,0,0.04); border-radius: 3px; overflow: hidden; }
.cat-fill { height: 100%; border-radius: 3px; }
.cat-cnt { font-size: 11px; color: rgba(0,0,0,0.35); min-width: 65px; text-align: right; }

/* Failures */
.fail { border-left: 3px solid #ef4444; background: rgba(239,68,68,0.03); border-radius: 0 10px 10px 0; padding: 11px 13px; margin-bottom: 9px; }
.fail:last-child { margin-bottom: 0; }
.fail-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.fail-title { font-size: 12px; font-weight: 500; color: rgba(0,0,0,0.75); line-height: 1.3; }
.fail-badge { font-size: 9px; background: rgba(239,68,68,0.08); color: #dc2626; padding: 2px 7px; border-radius: 8px; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.fail-desc { font-size: 10px; color: rgba(0,0,0,0.35); margin-top: 3px; }
.fail-meta { font-size: 9px; color: rgba(0,0,0,0.25); margin-top: 5px; }

/* AI Perf */
.ai-circles { display: flex; gap: 28px; justify-content: center; margin-bottom: 14px; }
.ai-circ { text-align: center; }
.circ-wrap { width: 68px; height: 68px; position: relative; margin: 0 auto 5px; }
.circ-wrap svg { width: 68px; height: 68px; transform: rotate(-90deg); }
.circ-bg { fill: none; stroke: rgba(0,0,0,0.05); stroke-width: 5; }
.circ-fg { fill: none; stroke-width: 5; stroke-linecap: round; }
.circ-val { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 13px; font-weight: 700; color: #1e1e2e; }
.circ-lbl { font-size: 10px; color: rgba(0,0,0,0.35); }
.ai-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(0,0,0,0.04); font-size: 11px; }
.ai-row:last-child { border-bottom: none; }
.ai-row-l { color: rgba(0,0,0,0.4); display: flex; align-items: center; gap: 5px; }
.ai-row-l .material-icons { font-size: 13px; }
.ai-row-v { color: rgba(0,0,0,0.65); font-weight: 600; }

/* Providers */
.prov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.prov { background: rgba(0,0,0,0.015); border: 1px solid rgba(0,0,0,0.05); border-radius: 9px; padding: 11px; }
.prov.active { border-color: rgba(99,102,241,0.25); background: rgba(99,102,241,0.03); }
.prov-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }
.prov-name { font-size: 12px; font-weight: 600; color: #1e1e2e; }
.prov-active { font-size: 8px; background: rgba(22,163,74,0.1); color: #16a34a; padding: 2px 7px; border-radius: 6px; font-weight: 600; }
.prov-stats { display: flex; gap: 14px; }
.prov-s-lbl { font-size: 8px; color: rgba(0,0,0,0.3); text-transform: uppercase; letter-spacing: 0.4px; }
.prov-s-val { font-size: 11px; font-weight: 600; color: rgba(0,0,0,0.55); margin-top: 1px; }
.prov-s-val.cost { color: #16a34a; }
.prov-s-val.speed { color: #d97706; }

/* === CHAT DRAWER (overlay - LIGHT THEME) === */
.chat-overlay {
  position: absolute;
  top: 0;
  right: 0;
  width: 390px;
  height: 960px;
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(20px) saturate(180%);
  border-left: 1px solid rgba(99,102,241,0.12);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -8px 0 32px rgba(0,0,0,0.08);
}
.ch-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(52,211,153,0.03));
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.ch-hdr-l { display: flex; align-items: center; gap: 9px; }
.ch-hdr-l .material-icons { font-size: 20px; color: #7c3aed; }
.ch-hdr-name { font-size: 14px; font-weight: 600; color: #1e1e2e; }
.ch-hdr-sub { font-size: 10px; color: rgba(0,0,0,0.4); }
.ch-hdr-r { display: flex; gap: 2px; }
.ch-hdr-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ch-hdr-btn .material-icons { font-size: 16px; }

.ch-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #f8f8fc;
}

.m { max-width: 90%; }
.m.u { align-self: flex-end; }
.m.a { align-self: flex-start; }
.m-bub { padding: 9px 13px; font-size: 12px; line-height: 1.55; }
.m.u .m-bub { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border-radius: 14px 14px 4px 14px; }
.m.a .m-bub { background: #fff; color: rgba(0,0,0,0.8); border-radius: 4px 14px 14px 14px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.m.a .m-bub strong { color: #1e1e2e; }
.m.a .m-bub em { color: rgba(0,0,0,0.6); }
.m.a .m-bub code { font-family: 'JetBrains Mono', monospace; background: rgba(99,102,241,0.08); color: #6366f1; padding: 1px 4px; border-radius: 3px; font-size: 11px; }

.m-tool { display: flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 7px; font-size: 11px; font-weight: 500; align-self: flex-start; }
.m-tool.search { background: rgba(99,102,241,0.06); color: #7c3aed; }
.m-tool.result { background: rgba(22,163,74,0.06); color: #16a34a; }
.m-tool .material-icons { font-size: 13px; }

.ch-input {
  padding: 10px 14px 8px;
  background: #fff;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.ch-input-row {
  display: flex; align-items: center; gap: 8px;
  background: #f4f4f9;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 10px;
  padding: 8px 11px;
}
.ch-input-field { flex: 1; border: none; outline: none; background: transparent; color: rgba(0,0,0,0.7); font-size: 12px; font-family: 'Roboto', sans-serif; }
.ch-send { border: none; background: none; color: rgba(0,0,0,0.15); display: flex; align-items: center; }
.ch-send .material-icons { font-size: 16px; }
.ch-disc { text-align: center; font-size: 9px; color: rgba(0,0,0,0.2); margin-top: 6px; }
</style>
</head>
<body>
<div class="app">

<nav class="side">
  <div class="s-logo">
    <div class="s-logo-icon">TC</div>
    <div><div class="s-logo-name">TestOps</div><div class="s-logo-sub">Companion</div></div>
  </div>
  <div class="s-section">
    <div class="s-label">Overview</div>
    <div class="s-item active"><span class="material-icons">dashboard</span> Dashboard</div>
  </div>
  <div class="s-section">
    <div class="s-label">Testing</div>
    <div class="s-item"><span class="material-icons">play_arrow</span> Pipelines</div>
    <div class="s-item"><span class="material-icons">description</span> Test Runs</div>
    <div class="s-item"><span class="material-icons">psychology</span> Failure Knowledge Base</div>
  </div>
  <div class="s-section">
    <div class="s-label">System</div>
    <div class="s-item"><span class="material-icons">attach_money</span> Cost Tracker</div>
    <div class="s-item"><span class="material-icons">notifications</span> Notifications</div>
    <div class="s-item"><span class="material-icons">settings</span> Settings</div>
  </div>
  <div class="s-footer">
    <span class="s-version">v2.9.0</span>
    <span class="s-theme"><span class="material-icons">dark_mode</span></span>
  </div>
</nav>

<div class="main">
  <div class="hdr">
    <span class="hdr-title">Dashboard</span>
    <div class="copilot-btn"><span class="material-icons">auto_awesome</span></div>
  </div>

  <div class="hero">
    <div>
      <div class="hero-t">Failure Analysis</div>
      <div class="hero-sub">Last 30 days · 15,940 tests processed · Last sync 04:59 PM</div>
    </div>
    <div class="hero-badges">
      <div class="badge"><span class="dot-green"></span> All Systems Operational</div>
      <div class="badge"><span class="material-icons">cached</span> Cache 0%</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">Tests Analyzed</span><div class="stat-ic" style="background:rgba(96,165,250,0.08);color:#3b82f6;"><span class="material-icons">bar_chart</span></div></div>
      <div class="stat-val">15,940</div>
      <div class="stat-ch ch-green"><span class="material-icons">trending_up</span> +12% from yesterday</div>
    </div>
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">Failures Categorized</span><div class="stat-ic" style="background:rgba(245,158,11,0.08);color:#f59e0b;"><span class="material-icons">category</span></div></div>
      <div class="stat-val">797</div>
      <div class="stat-ch ch-green"><span class="material-icons">check_circle</span> 100% categorization rate</div>
    </div>
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">Hours Saved</span><div class="stat-ic" style="background:rgba(16,185,129,0.08);color:#10b981;"><span class="material-icons">schedule</span></div></div>
      <div class="stat-val">199.3h</div>
      <div class="stat-ch ch-muted"><span class="material-icons">swap_horiz</span> vs manual analysis</div>
    </div>
    <div class="stat">
      <div class="stat-top"><span class="stat-lbl">AI Spend</span><div class="stat-ic" style="background:rgba(22,163,74,0.08);color:#16a34a;"><span class="material-icons">attach_money</span></div></div>
      <div class="stat-val">$2.34</div>
      <div class="stat-ch ch-muted"><span class="material-icons">cached</span> 0% saved via cache</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-hdr">
        <div><div class="card-t">Failure Categories</div><div class="card-sub">AI-powered classification with confidence scoring</div></div>
        <span class="card-badge">6 types</span>
      </div>
      <div class="cat"><span class="cat-dot" style="background:#f59e0b;"></span><span class="cat-name">Minor Bug</span><div class="cat-bar"><div class="cat-fill" style="width:60%;background:#f59e0b;"></div></div><span class="cat-cnt">210 (26%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#6366f1;"></span><span class="cat-name">Flaky Test</span><div class="cat-bar"><div class="cat-fill" style="width:46%;background:#6366f1;"></div></div><span class="cat-cnt">158 (20%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#ef4444;"></span><span class="cat-name">Critical Bug</span><div class="cat-bar"><div class="cat-fill" style="width:38%;background:#ef4444;"></div></div><span class="cat-cnt">130 (16%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#3b82f6;"></span><span class="cat-name">Configuration</span><div class="cat-bar"><div class="cat-fill" style="width:35%;background:#3b82f6;"></div></div><span class="cat-cnt">123 (15%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#10b981;"></span><span class="cat-name">Environment</span><div class="cat-bar"><div class="cat-fill" style="width:30%;background:#10b981;"></div></div><span class="cat-cnt">102 (13%)</span></div>
      <div class="cat"><span class="cat-dot" style="background:#f97316;"></span><span class="cat-name">Unknown</span><div class="cat-bar"><div class="cat-fill" style="width:22%;background:#f97316;"></div></div><span class="cat-cnt">74 (9%)</span></div>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div><div class="card-t">Recent Failures</div><div class="card-sub">Intelligent log summarization with root cause detection</div></div>
        <a class="card-link" href="#">View all →</a>
      </div>
      <div class="fail">
        <div class="fail-top"><span class="fail-title">Division by zero in tax calculation for international orders</span><span class="fail-badge">Critical Bug</span></div>
        <div class="fail-desc">Missing tax rate configuration for newly added country code</div>
        <div class="fail-meta">85% confidence · 0 similar · ShoppingCart.calculateTax_bug_critical_144</div>
      </div>
      <div class="fail">
        <div class="fail-top"><span class="fail-title">WebSocket connection dropped after 30 seconds</span><span class="fail-badge">Critical Bug</span></div>
        <div class="fail-desc">Load balancer timeout shorter than application keepalive interval</div>
        <div class="fail-meta">85% confidence · 0 similar · WebSocket.handleConnection_bug_critical_169</div>
      </div>
      <div class="fail">
        <div class="fail-top"><span class="fail-title">Division by zero in tax calculation for international orders</span><span class="fail-badge">Critical Bug</span></div>
        <div class="fail-desc">Missing tax rate configuration for newly added country code</div>
        <div class="fail-meta">85% confidence · 0 similar · ShoppingCart.calculateTax_bug_critical_171</div>
      </div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-hdr">
        <div class="card-t" style="display:flex;align-items:center;gap:7px;"><span class="material-icons" style="color:#10b981;font-size:17px;">emoji_objects</span> AI Performance</div>
      </div>
      <div class="ai-circles">
        <div class="ai-circ">
          <div class="circ-wrap"><svg viewBox="0 0 68 68"><circle class="circ-bg" cx="34" cy="34" r="28"/><circle class="circ-fg" cx="34" cy="34" r="28" stroke="#10b981" stroke-dasharray="170" stroke-dashoffset="5"/></svg><span class="circ-val">96.8%</span></div>
          <span class="circ-lbl">Accuracy</span>
        </div>
        <div class="ai-circ">
          <div class="circ-wrap"><svg viewBox="0 0 68 68"><circle class="circ-bg" cx="34" cy="34" r="28"/><circle class="circ-fg" cx="34" cy="34" r="28" stroke="#10b981" stroke-dasharray="0" stroke-dashoffset="0"/></svg><span class="circ-val">0%</span></div>
          <span class="circ-lbl">Cache Hit</span>
        </div>
        <div class="ai-circ">
          <div class="circ-wrap"><svg viewBox="0 0 68 68"><circle class="circ-bg" cx="34" cy="34" r="28"/><circle class="circ-fg" cx="34" cy="34" r="28" stroke="#f59e0b" stroke-dasharray="83" stroke-dashoffset="0"/></svg><span class="circ-val">47.2%</span></div>
          <span class="circ-lbl">Budget Used</span>
        </div>
      </div>
      <div class="ai-row"><span class="ai-row-l"><span class="material-icons">schedule</span> Avg Analysis Time</span><span class="ai-row-v">2.3s</span></div>
      <div class="ai-row"><span class="ai-row-l"><span class="material-icons">content_copy</span> Similar Failures Matched</span><span class="ai-row-v">89</span></div>
      <div class="ai-row"><span class="ai-row-l"><span class="material-icons">attach_money</span> Monthly Budget</span><span class="ai-row-v">$47.20 / $100</span></div>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div class="card-t">Providers</div>
        <span style="font-size:10px;color:rgba(0,0,0,0.3);">Multi-provider · Cost-optimized</span>
      </div>
      <div class="prov-grid">
        <div class="prov active">
          <div class="prov-top"><span class="prov-name">Claude Sonnet 4.5</span><span class="prov-active">Active</span></div>
          <div class="prov-stats">
            <div><div class="prov-s-lbl">Cost/1M</div><div class="prov-s-val cost">$9.00</div></div>
            <div><div class="prov-s-lbl">Context</div><div class="prov-s-val">200K</div></div>
            <div><div class="prov-s-lbl">Speed</div><div class="prov-s-val speed">⚡⚡⚡⚡</div></div>
          </div>
        </div>
        <div class="prov">
          <div class="prov-top"><span class="prov-name">GPT-4 Turbo</span></div>
          <div class="prov-stats">
            <div><div class="prov-s-lbl">Cost/1M</div><div class="prov-s-val cost">$20.00</div></div>
            <div><div class="prov-s-lbl">Context</div><div class="prov-s-val">128K</div></div>
            <div><div class="prov-s-lbl">Speed</div><div class="prov-s-val speed">⚡⚡</div></div>
          </div>
        </div>
        <div class="prov" style="grid-column: span 2;">
          <div class="prov-top"><span class="prov-name">Gemini 1.5 Flash</span></div>
          <div class="prov-stats">
            <div><div class="prov-s-lbl">Cost/1M</div><div class="prov-s-val cost">$0.38</div></div>
            <div><div class="prov-s-lbl">Context</div><div class="prov-s-val">1M</div></div>
            <div><div class="prov-s-lbl">Speed</div><div class="prov-s-val speed">⚡⚡⚡⚡</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Chat Drawer Overlay - LIGHT -->
<div class="chat-overlay">
  <div class="ch-hdr">
    <div class="ch-hdr-l">
      <span class="material-icons">auto_awesome</span>
      <div><div class="ch-hdr-name">TestOps Copilot</div><div class="ch-hdr-sub">AI-powered assistant</div></div>
    </div>
    <div class="ch-hdr-r">
      <button class="ch-hdr-btn"><span class="material-icons">delete_outline</span></button>
      <button class="ch-hdr-btn"><span class="material-icons">close</span></button>
    </div>
  </div>

  <div class="ch-msgs">
    <div class="m u"><div class="m-bub">Show me the dashboard health summary</div></div>
    <div class="m-tool search"><span class="material-icons">search</span> Fetching dashboard metrics and system health...</div>
    <div class="m-tool result"><span class="material-icons">check_circle_outline</span> Retrieved dashboard summary with 4 data sources</div>
    <div class="m a"><div class="m-bub">Here's your <strong>dashboard health summary</strong>:<br><br><strong>System Status:</strong> All Systems Operational<br><strong>Tests Analyzed:</strong> 15,940 (+12% from yesterday)<br><strong>Categorization Rate:</strong> 100% (797 failures classified)<br><strong>AI Spend:</strong> $2.34 of $100 monthly budget<br><br><strong>Top Concerns:</strong><br>• <strong>Critical bugs</strong> make up 16% of failures (130 total)<br>• Tax calculation failures recurring across <code>payment-service</code><br>• Cache hit rate is at 0% — consider enabling Redis caching<br><br>Overall the system is healthy. Want me to dig into any specific area?</div></div>
    <div class="m u"><div class="m-bub">Search Confluence for RCA documentation on the tax issue</div></div>
    <div class="m-tool search"><span class="material-icons">search</span> Searching Confluence for tax calculation RCA docs...</div>
    <div class="m-tool result"><span class="material-icons">check_circle_outline</span> Found 3 relevant Confluence pages</div>
    <div class="m a"><div class="m-bub">Found <strong>3 relevant Confluence pages</strong>:<br><br><strong>1. RCA: Tax Calculation Module Failures</strong><br>Space: Engineering · Updated: Feb 12, 2026<br>Root cause: Missing country code mappings in <code>tax-config.json</code><br><br><strong>2. Runbook: International Payment Processing</strong><br>Space: Operations · Updated: Jan 28, 2026<br>Contains step-by-step resolution for tax config issues<br><br><strong>3. Architecture: Payment Service Tax Module</strong><br>Space: Engineering · Updated: Dec 15, 2025<br>Design doc covering the tax calculation pipeline<br><br>The RCA doc suggests adding the missing EU country codes. Should I create a Jira ticket?</div></div>
  </div>

  <div class="ch-input">
    <div class="ch-input-row">
      <input class="ch-input-field" type="text" placeholder="Ask me anything about your test infrastructure...">
      <button class="ch-send"><span class="material-icons">send</span></button>
    </div>
    <div class="ch-disc">AI responses may be inaccurate. Always verify critical data.</div>
  </div>
</div>

</div>
</body>
</html>`;
}

async function generateScreenshot(page, html, outputFile) {
  await page.setContent(html, { waitUntil: 'load' });

  // Wait for embedded fonts to render
  await page.waitForFunction(() => {
    return document.fonts.ready.then(() => document.fonts.check('18px Material Icons'));
  }, { timeout: 10000 });

  await page.waitForTimeout(500);

  await page.screenshot({
    path: join(outputDir, outputFile),
    fullPage: false,
    type: 'png',
  });

  console.log('Generated:', outputFile);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1200, height: 960 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  await generateScreenshot(page, darkDashboardHTML(), 'dashboard-modern-dark.png');
  await generateScreenshot(page, lightDashboardHTML(), 'dashboard-modern-light.png');

  await browser.close();
  console.log('All screenshots generated!');
}

main().catch(console.error);
