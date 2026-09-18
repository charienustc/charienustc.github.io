// 一次性脚本:用原生 CDP 验证导航 tab 的滑动指示器与按动反馈。
// 不依赖 playwright,直接用 Node 内置 WebSocket。
//
// 覆盖的行为(与 src/components/Header.astro 的设计对应):
//   1. 指示器存在、定位到 active 页签
//   2. 指针经过不改变指示器归属(指示器只由 active 页签决定)
//   3. 按下时页签缩小(按动感)
//   4. 键盘左右键在页签间移动焦点,指示器跟随
//   5. 软导航(ClientRouter)后:指示器归位、事件委托仍存活、不重复插入
//   6. 硬导航后指示器归位
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ??
  'C:/Users/Charien/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 9333;
const URL_ = process.argv[2] ?? 'http://localhost:4321/';

const profile = mkdtempSync(join(tmpdir(), 'cdp-nav-'));
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1280,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let msgId = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(
      String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    );
  }
  return r.result.value;
}

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

// 把指针移开导航区(产生 pointerout),再移进目标点
async function movePointer(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 620, buttons: 0 });
  await sleep(70);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
}

// 读取「指示器 vs active 页签」的几何差(视口绝对坐标,避免基准漂移)
const READ_ALIGN = `(() => {
  const i = document.querySelector('.nav-indicator').getBoundingClientRect();
  const a = document.querySelector('.nav-tab[data-active="true"]').getBoundingClientRect();
  const t = document.querySelector('.nav-tab[data-active="true"]');
  return { dx: i.x - a.x, dy: i.y - a.y, dw: i.width - a.width,
           label: t.textContent.trim(),
           inline: document.querySelector('.nav-indicator').style.transform };
})()`;

const tabBox = (i) => `(() => {
  const t = document.querySelectorAll('.nav-tab')[${i}];
  const r = t.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: t.textContent.trim() };
})()`;

try {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        break;
      }
    } catch {}
    await sleep(250);
  }
  if (!ws) throw new Error('Chrome DevTools endpoint never came up');

  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);

  // --- 1. 指示器存在且定位到 active 页签 ---
  const geom = await evaluate(READ_ALIGN);
  check(
    '指示器尺寸非零且与 active 页签重合',
    Math.abs(geom.dx) < 1.5 && Math.abs(geom.dy) < 1.5 && Math.abs(geom.dw) < 1.5,
    `Δ=(${geom.dx.toFixed(1)},${geom.dy.toFixed(1)}) Δw=${geom.dw.toFixed(1)}`
  );
  check('首页 active 页签是「主页」', geom.label === '主页', `label=${geom.label}`);

  // --- 2. 指针经过不改变归属 ---
  for (let i = 0; i < 4; i++) {
    const b = await evaluate(tabBox(i));
    await movePointer(b.x, b.y);
    await sleep(200);
  }
  await sleep(600);
  const afterSweep = await evaluate(READ_ALIGN);
  check(
    '指针扫过所有页签后指示器仍停在 active 页签',
    Math.abs(afterSweep.dx) < 1.5 && Math.abs(afterSweep.dw) < 1.5,
    `Δx=${afterSweep.dx.toFixed(1)} Δw=${afterSweep.dw.toFixed(1)}`
  );

  // --- 3. 按下时页签缩小(按动感) ---
  const blog = await evaluate(tabBox(2));
  await movePointer(blog.x, blog.y);
  await sleep(150);
  const rest = await evaluate(
    `getComputedStyle(document.querySelectorAll('.nav-tab')[2]).transform`
  );
  // 静止态:回弹用较慢的弹簧曲线(按下要快、回弹要慢)
  const restStyle = await evaluate(`(() => {
    const s = getComputedStyle(document.querySelectorAll('.nav-tab')[2]);
    return { prop: s.transitionProperty, dur: s.transitionDuration };
  })()`);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: blog.x, y: blog.y, button: 'left', buttons: 1, clickCount: 1,
  });
  await sleep(150);
  const down = await evaluate(`(() => {
    const s = getComputedStyle(document.querySelectorAll('.nav-tab')[2]);
    return { transform: s.transform, dur: s.transitionDuration };
  })()`);
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: blog.x, y: blog.y, button: 'left', buttons: 0, clickCount: 1,
  });
  check(
    '按下时页签被缩小(按动反馈存在)',
    down.transform !== 'none' && down.transform !== rest,
    `rest=${rest} down=${down.transform}`
  );
  check(
    '静止态回弹较慢、按下瞬间更快(按动感)',
    restStyle.prop.includes('transform') &&
      parseFloat(restStyle.dur) > 0.15 &&
      parseFloat(down.dur) < parseFloat(restStyle.dur),
    `rest=${restStyle.dur} down=${down.dur}`
  );

  await sleep(1600);

  // --- 4. 键盘左右键移动焦点,指示器跟随 ---
  const kb = await evaluate(`(async () => {
    const read = () => {
      const i = document.querySelector('.nav-indicator').getBoundingClientRect();
      const f = document.activeElement.getBoundingClientRect();
      return { dx: i.x - f.x, dw: i.width - f.width,
               label: document.activeElement.textContent.trim() };
    };
    document.querySelectorAll('.nav-tab')[0].focus();
    const from = document.activeElement.textContent.trim();
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    await new Promise(r => setTimeout(r, 900));
    return { from, end: read() };
  })()`);
  check(
    'ArrowRight 移动焦点且指示器跟随',
    kb.end.label === '项目' && Math.abs(kb.end.dx) < 1.5 && Math.abs(kb.end.dw) < 1.5,
    `focus ${kb.from} -> ${kb.end.label}, Δx=${kb.end.dx.toFixed(1)}`
  );

  // --- 5. 软导航:归位 + 委托存活 + 不重复插入 ---
  const soft = await evaluate(`(async () => {
    const read = () => {
      const i = document.querySelector('.nav-indicator').getBoundingClientRect();
      const a = document.querySelector('.nav-tab[data-active="true"]').getBoundingClientRect();
      return { dx: i.x - a.x, dw: i.width - a.width };
    };
    const link = [].slice.call(document.querySelectorAll('.nav-tab'))
      .find(a => a.getAttribute('href').includes('portfolio'));
    link.click();
    await new Promise(r => setTimeout(r, 1600));
    return { url: location.pathname, align: read(),
             indCount: document.querySelectorAll('.nav-indicator').length,
             navCount: document.querySelectorAll('[data-nav-pill]').length };
  })()`);
  check(
    '软导航后指示器归位到「项目」且未重复插入',
    soft.url === '/portfolio' &&
      Math.abs(soft.align.dx) < 1.5 && Math.abs(soft.align.dw) < 1.5 &&
      soft.indCount === 1 && soft.navCount === 1,
    `url=${soft.url} Δx=${soft.align.dx.toFixed(1)} ind=${soft.indCount} nav=${soft.navCount}`
  );

  // 软导航会重建 header:委托若挂在旧节点上就会失效。用真实鼠标/键盘验证。
  const link3 = await evaluate(tabBox(3));
  await movePointer(link3.x, link3.y);
  await sleep(700);
  const kb2 = await evaluate(`(async () => {
    document.querySelectorAll('.nav-tab')[0].focus();
    const from = document.activeElement.textContent.trim();
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    await new Promise(r => setTimeout(r, 800));
    return { from, to: document.activeElement.textContent.trim() };
  })()`);
  check('软导航后键盘委托仍存活(事件挂在 document 上)',
    kb2.to === '项目', `${kb2.from} -> ${kb2.to}`);

  // --- 6. 硬导航后指示器归位 ---
  await send('Page.navigate', { url: new URL('/blog', URL_).href });
  await sleep(2500);
  const hard = await evaluate(READ_ALIGN);
  check(
    '硬导航到 /blog 后指示器归位到「博客」',
    hard.label === '博客' && Math.abs(hard.dx) < 1.5 && Math.abs(hard.dw) < 1.5,
    `label=${hard.label} Δx=${hard.dx.toFixed(1)}`
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error('HARNESS ERROR:', err.message);
  process.exitCode = 2;
} finally {
  ws?.close();
  chrome.kill();
}
