// 把 data/ttmi-maps.json（天堂透視鏡地點資料）轉成 afk-maps-data.js（給 afk-maps.js 讀）。可重跑；日誌 logs/build-ttmi-maps.log
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
const raw = readFileSync('data/ttmi-maps.json', 'utf8').replace(/^﻿/, '');
const data = JSON.parse(raw);
const out = '/* 自動產生：node scripts/build-ttmi-maps.mjs（來源 data/ttmi-maps.json，天堂透視鏡地點怪物清單）。請改 json 再重跑，不要手改這個檔 */\nwindow.__AFK_TTMI_MAPS = ' + JSON.stringify(data) + ';\n';
writeFileSync('afk-maps-data.js', out);
mkdirSync('logs', { recursive: true });
const n = Object.keys(data).filter(k => k[0] !== '_').length;
appendFileSync('logs/build-ttmi-maps.log', `${new Date().toISOString()} 產生 afk-maps-data.js：${n} 張地圖\n`);
console.log(`afk-maps-data.js：${n} 張地圖`);
