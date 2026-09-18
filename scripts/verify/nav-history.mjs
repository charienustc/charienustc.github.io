// 验证:快速前进/后退(不经过 click 处理器)后,指示器是否停错页签
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME=process.env.CHROME_PATH ??
  'C:/Users/Charien/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT=9444;
const profile=mkdtempSync(join(tmpdir(),'cdp-rapid-'));
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'--headless=new','--no-first-run','--disable-gpu','--window-size=1280,900','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map();
const send=(m,p={})=>{const i=++id;ws.send(JSON.stringify({id:i,method:m,params:p}));return new Promise((res,rej)=>pending.set(i,{res,rej}))};
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(String(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value};
for(let i=0;i<40;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p){ws=new WebSocket(p.webSocketDebuggerUrl);break}}catch{}await sleep(250)}
await new Promise(r=>ws.addEventListener('open',r));
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const{res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)}});
await send('Page.enable');await send('Runtime.enable');
await send('Page.navigate',{url:'http://localhost:4321/'});
await sleep(2500);

const READ=`(()=>{const i=document.querySelector('.nav-indicator').getBoundingClientRect();
 const a=document.querySelector('.nav-tab[data-active="true"]').getBoundingClientRect();
 return {dx:+(i.x-a.x).toFixed(1),dw:+(i.width-a.width).toFixed(1),
   label:document.querySelector('.nav-tab[data-active="true"]').textContent.trim(),
   path:location.pathname, inline:document.querySelector('.nav-indicator').style.transform}})()`;

// 先软导航 项目 -> 博客,建立历史
await ev(`[].slice.call(document.querySelectorAll('.nav-tab')).find(a=>a.getAttribute('href').includes('portfolio')).click()`);
await sleep(1800);
await ev(`[].slice.call(document.querySelectorAll('.nav-tab')).find(a=>a.getAttribute('href').includes('blog')).click()`);
await sleep(1800);
console.log('before back:', JSON.stringify(await ev(READ)));

// 用原生 CDP 的历史导航,几乎无间隔地连打 —— 让两次 page-load 的 settle 回调交错
async function burst(dir, n) {
  for (let i = 0; i < n; i++) {
    await ev(`history.${dir}()`);
    await sleep(5);
  }
  await sleep(2600);
}

// 先软导航建立历史:主页 -> 项目 -> 博客 -> 链接
for (const h of ['portfolio', 'blog', 'links']) {
  await ev(`[].slice.call(document.querySelectorAll('.nav-tab')).find(a=>a.getAttribute('href').includes('${h}')).click()`);
  await sleep(1700);
}
console.log('start:', JSON.stringify(await ev(READ)));

let fails = 0;
for (let round = 1; round <= 6; round++) {
  for (let i = 0; i < 3; i++) { await ev('history.back()'); await sleep(8); }
  await sleep(2400);
  const back = await ev(READ);
  const okBack = Math.abs(back.dx) < 1.5 && Math.abs(back.dw) < 1.5;
  if (!okBack) fails++;
  console.log(`round ${round} back x3 ->`, JSON.stringify(back), okBack ? 'OK' : 'MISALIGNED');

  for (let i = 0; i < 3; i++) { await ev('history.forward()'); await sleep(8); }
  await sleep(2400);
  const fwd = await ev(READ);
  const okFwd = Math.abs(fwd.dx) < 1.5 && Math.abs(fwd.dw) < 1.5;
  if (!okFwd) fails++;
  console.log(`round ${round} fwd  x3 ->`, JSON.stringify(fwd), okFwd ? 'OK' : 'MISALIGNED');
}
console.log(fails === 0 ? 'NO MISALIGNMENT' : fails + ' MISALIGNED');
ws.close();chrome.kill();
