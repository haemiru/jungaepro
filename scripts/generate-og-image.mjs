// OG 이미지(1200×630) 생성기 — 링크 공유 시 미리보기 썸네일
// 실행: node scripts/generate-og-image.mjs  →  public/og-image.png
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import puppeteer from 'puppeteer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logoPath = join(root, 'public', 'logo.png')
const outPath = join(root, 'public', 'og-image.png')

const logoDataUri = existsSync(logoPath)
  ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`
  : ''

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;
    background:linear-gradient(135deg,#1e40af 0%,#2563eb 55%,#3b82f6 100%);
    color:#fff; overflow:hidden; position:relative; }
  .circle { position:absolute; border-radius:9999px; background:rgba(255,255,255,.08); }
  .c1 { width:420px; height:420px; top:-140px; left:-120px; }
  .c2 { width:520px; height:520px; bottom:-220px; right:-160px; }
  .wrap { position:relative; height:100%; display:flex; flex-direction:column;
    justify-content:center; padding:0 90px; }
  .brand { display:flex; align-items:center; gap:20px; margin-bottom:34px; }
  .brand img { width:84px; height:84px; border-radius:20px; background:#fff; object-fit:contain; padding:6px; }
  .brand span { font-size:52px; font-weight:800; letter-spacing:-1px; }
  h1 { font-size:72px; font-weight:800; line-height:1.15; letter-spacing:-2px; margin-bottom:26px; }
  .kw { font-size:30px; font-weight:500; color:#dbeafe; letter-spacing:0.5px; }
  .url { position:absolute; bottom:54px; left:90px; font-size:28px; font-weight:700; color:#bfdbfe; }
</style></head><body>
  <div class="circle c1"></div>
  <div class="circle c2"></div>
  <div class="wrap">
    <div class="brand">${logoDataUri ? `<img src="${logoDataUri}"/>` : ''}<span>중개프로</span></div>
    <h1>공인중개사를 위한<br/>올인원 업무 플랫폼</h1>
    <div class="kw">매물 · 계약 · 고객관리 · AI 도구 · 국토부 실거래가 · 임장점검</div>
    <div class="url">jungaepro.com</div>
  </div>
</body></html>`

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.screenshot({ path: outPath, type: 'png' })
await browser.close()
console.log('OG image written to', outPath)
