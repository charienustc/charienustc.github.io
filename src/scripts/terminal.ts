/**
 * web-sh — 一个运行在浏览器里的微型 shell。
 * 虚拟文件系统: ~/about.txt ~/contact.txt ~/links.txt ~/blog/*.md ~/projects/*.md
 * 数据由首页通过 window.__TERM_DATA__ 注入(构建时从 content collections 生成)。
 */

type Seg = { t: string; c?: string };
/** 一行输出:纯文本,或若干 segment(可带颜色类名) */
type Line = string | Array<string | Seg>;

interface PostMeta {
  id: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  excerpt: string;
}
interface ProjectMeta {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url: string | null;
  repo: string | null;
}
interface TermData {
  author: string;
  description: string;
  base: string;
  posts: PostMeta[];
  projects: ProjectMeta[];
  socials: { name: string; url: string; handle: string }[];
}

const DATA = (window as any).__TERM_DATA__ as TermData;
const bootTime = Date.now();

/* ================= 虚拟文件系统 ================= */

interface FileNode {
  kind: 'file';
  read: () => Line[];
  page?: string; // open 时跳转的站内路径(相对 base)
}
interface DirNode {
  kind: 'dir';
  children: Map<string, Node>;
}
type Node = FileNode | DirNode;

function dir(children: Record<string, Node>): DirNode {
  return { kind: 'dir', children: new Map(Object.entries(children)) };
}
function file(read: () => Line[], page?: string): FileNode {
  return { kind: 'file', read, page };
}

/** 纯文本行 */
const TXT = (t: string): Line => t;
/** 单 segment 着色行 */
const S = (t: string, c: string): Line => [{ t, c }];

function buildFS(): DirNode {
  const blogFiles: Record<string, Node> = {};
  for (const p of DATA.posts) {
    blogFiles[`${p.id}.md`] = file(() => [
      S(`# ${p.title}`, 't-green t-bold'),
      TXT(`${p.date}  ·  ${p.tags.map((t) => '#' + t).join('  ') || '无标签'}`),
      TXT(''),
      TXT(p.description),
      TXT(''),
      ...p.excerpt.split('\n').map((l) => TXT(l)),
      TXT(''),
      S(`... (已截断) 输入 open blog/${p.id} 阅读全文`, 't-dim'),
    ], `blog/${p.id}`);
  }

  const projectFiles: Record<string, Node> = {};
  for (const p of DATA.projects) {
    projectFiles[`${p.id}.md`] = file(() => [
      S(`# ${p.title}`, 't-green t-bold'),
      TXT(''),
      TXT(p.description),
      TXT(''),
      TXT(`tags: ${p.tags.map((t) => '#' + t).join('  ') || '-'}`),
      ...(p.repo ? [S(`repo: ${p.repo}`, 't-cyan')] : []),
      ...(p.url ? [S(`url:  ${p.url}`, 't-cyan')] : []),
      TXT(''),
      S('... 输入 open projects 查看作品页', 't-dim'),
    ]);
  }

  return dir({
    'about.txt': file(() => [
      S(DATA.author, 't-green t-bold'),
      TXT(''),
      TXT(DATA.description),
      TXT(''),
      TXT('目录导览:'),
      [{ t: '  blog/      ', c: 't-cyan' }, '  博客文章(Markdown)'],
      [{ t: '  projects/  ', c: 't-cyan' }, '  项目与作品'],
      [{ t: '  links.txt  ', c: 't-cyan' }, '  各平台链接聚合'],
      TXT(''),
      S('输入 help 查看全部命令。', 't-dim'),
    ]),
    'contact.txt': file(() => [
      TXT('联系方式:'),
      ...DATA.socials.map((s): Line => [{ t: `  ${s.name.padEnd(10)} ${s.url}${s.handle ? '  (' + s.handle + ')' : ''}`, c: 't-cyan' }]),
      TXT(''),
      S('也可访问链接页:输入 open links.txt', 't-dim'),
    ], 'links'),
    'links.txt': file(() => [
      S('# 各平台链接', 't-green t-bold'),
      TXT(''),
      ...DATA.socials.map((s): Line => [{ t: `${s.name.padEnd(12)} →  ${s.url}`, c: 't-cyan' }]),
      TXT(''),
      S('输入 open links.txt 在浏览器中打开链接页', 't-dim'),
    ], 'links'),
    'README.md': file(() => [
      S('# Welcome', 't-green t-bold'),
      TXT(''),
      TXT('这是一个伪装成 Linux 终端的个人主页。'),
      TXT('所有内容都藏在文件里,用命令去探索吧:'),
      TXT(''),
      TXT('  ls            看看这里有什么'),
      TXT('  cat about.txt 了解站长'),
      TXT('  cd blog       进入博客目录'),
      TXT('  neofetch      系统信息(彩蛋)'),
    ]),
    blog: dir(blogFiles),
    projects: dir(projectFiles),
  });
}

const ROOT = buildFS();
let cwd: string[] = []; // [] 表示 ~

/* 解析路径:支持 ~ / .. . 相对与绝对 */
function resolvePath(input: string, base: string[]): string[] | null {
  let parts: string[];
  if (input === '' || input === '.') return [...base];
  if (input.startsWith('~')) {
    parts = [];
    input = input.slice(1);
  } else if (input.startsWith('/')) {
    parts = [];
  } else {
    parts = [...base];
  }
  for (const seg of input.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null; // 不能越过根
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts;
}

function getNode(parts: string[]): Node | null {
  let node: Node = ROOT;
  for (const p of parts) {
    if (node.kind !== 'dir') return null;
    const next = node.children.get(p);
    if (!next) return null;
    node = next;
  }
  return node;
}

function fmtCwd(): string {
  return cwd.length === 0 ? '~' : '~/' + cwd.join('/');
}

/* ================= DOM 与渲染 ================= */

const screen = document.getElementById('term-screen')!;
const outEl = document.getElementById('term-out')!;
const rowEl = document.getElementById('term-row')!;
const promptEl = document.getElementById('term-prompt')!;
const inputEl = document.getElementById('term-input') as HTMLInputElement;

function scrollDown() {
  screen.scrollTop = screen.scrollHeight;
}

function printLine(line: Line | Seg, extraCls = '') {
  const div = document.createElement('div');
  div.className = `whitespace-pre-wrap break-words ${extraCls}`;
  if (typeof line === 'string') {
    div.textContent = line === '' ? ' ' : line;
  } else {
    const segs: Array<string | Seg> = Array.isArray(line) ? line : [line];
    if (segs.length === 0) {
      div.textContent = ' ';
    } else {
      for (const seg of segs) {
        const span = document.createElement('span');
        if (typeof seg === 'string') {
          span.textContent = seg;
        } else {
          if (seg.c) span.className = seg.c;
          span.textContent = seg.t;
        }
        div.appendChild(span);
      }
    }
  }
  outEl.appendChild(div);
}

function printLines(lines: Line[]) {
  for (const l of lines) printLine(l);
  scrollDown();
}

/* 提示符 HTML */
function promptHTML(): string {
  return `<span class="t-green t-bold glow-green">visitor@${DATA.author}</span><span class="t-dim">:</span><span class="t-blue t-bold">${fmtCwd()}</span><span class="t-dim">$</span> `;
}

function setPrompt() {
  promptEl.innerHTML = promptHTML();
}

/* 回显一条已执行的命令 */
function echoCommand(cmd: string) {
  const div = document.createElement('div');
  div.className = 'whitespace-pre-wrap break-words';
  div.innerHTML = promptHTML();
  const span = document.createElement('span');
  span.textContent = cmd;
  div.appendChild(span);
  outEl.appendChild(div);
}

/* 可点击命令(chips) */
function printChips(cmds: string[]) {
  const div = document.createElement('div');
  div.className = 'flex flex-wrap gap-2 my-1';
  for (const cmd of cmds) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.cmd = cmd;
    btn.className =
      'px-2 py-0.5 rounded border border-line text-xs t-dim hover:text-[var(--green)] hover:border-[var(--green)] transition-colors cursor-pointer';
    btn.textContent = `$ ${cmd}`;
    div.appendChild(btn);
  }
  outEl.appendChild(div);
}

/* ================= 命令历史 ================= */

const history: string[] = [];
let hIdx = -1;
let hStash = '';

/* ================= 命令实现 ================= */

type CmdFn = (args: string[], raw: string) => void;

const CMDS: Record<string, { desc: string; run: CmdFn }> = {
  help: {
    desc: '显示可用命令',
    run: () => {
      printLines([
        S('web-sh 1.0 — 可用命令:', 't-bold'),
        TXT(''),
        ...Object.entries(CMDS)
          .filter(([name]) => !['sudo', 'rm', 'vim', 'nano', 'emacs', 'man'].includes(name))
          .map(([name, c]): Line => [{ t: `  ${name.padEnd(10)} ${c.desc}`, c: 't-cyan' }]),
        TXT(''),
        S('提示: ↑/↓ 翻阅历史,Tab 补全命令与路径,Ctrl+L 清屏。', 't-dim'),
        S('懒得敲命令?直接点击下面的快捷按钮也行。', 't-dim'),
      ]);
      printChips(['ls', 'cat about.txt', 'cd blog', 'neofetch']);
    },
  },
  ls: {
    desc: '列出目录内容 [路径] [-l]',
    run: (args) => {
      const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
      const pathArg = args.find((a) => !a.startsWith('-')) ?? '';
      const parts = resolvePath(pathArg, cwd);
      if (!parts) return printLine(S(`ls: ${pathArg}: 没有那个文件或目录`, 't-red'));
      const node = getNode(parts);
      if (!node) return printLine(S(`ls: ${pathArg || fmtCwd()}: 没有那个文件或目录`, 't-red'));
      if (node.kind === 'file') return printLine(parts[parts.length - 1] ?? pathArg);

      const names = [...node.children.keys()].sort((a, b) => {
        const na = node.children.get(a)!;
        const nb = node.children.get(b)!;
        if (na.kind !== nb.kind) return na.kind === 'dir' ? -1 : 1;
        return a.localeCompare(b);
      });
      if (names.length === 0) return printLine(S('(空目录)', 't-dim'));

      if (long) {
        printLine(`total ${names.length}`);
        for (const name of names) {
          const child = node.children.get(name)!;
          const isDir = child.kind === 'dir';
          printLine([
            { t: isDir ? 'drwxr-xr-x  ' : '-rw-r--r--  ', c: 't-dim' },
            { t: isDir ? name + '/' : name, c: isDir ? 't-cyan t-bold' : '' },
          ]);
        }
      } else {
        printLine(
          names.flatMap((name, i): Array<string | Seg> => {
            const child = node.children.get(name)!;
            const isDir = child.kind === 'dir';
            const segs: Array<string | Seg> = [{ t: isDir ? name + '/' : name, c: isDir ? 't-cyan t-bold' : '' }];
            if (i < names.length - 1) segs.push('   ');
            return segs;
          })
        );
      }
      scrollDown();
    },
  },
  cd: {
    desc: '切换目录 (cd blog, cd .., cd ~)',
    run: (args) => {
      const target = args[0] ?? '~';
      const parts = resolvePath(target, cwd);
      if (!parts) return printLine(S(`cd: ${target}: 没有那个文件或目录`, 't-red'));
      const node = getNode(parts);
      if (!node) return printLine(S(`cd: ${target}: 没有那个文件或目录`, 't-red'));
      if (node.kind !== 'dir') return printLine(S(`cd: ${target}: 不是目录`, 't-red'));
      cwd = parts;
      setPrompt();
    },
  },
  cat: {
    desc: '查看文件内容 (cat about.txt)',
    run: (args) => {
      if (args.length === 0) return printLine(S('cat: 缺少文件参数', 't-red'));
      for (const arg of args) {
        const parts = resolvePath(arg, cwd);
        const node = parts ? getNode(parts) : null;
        if (!node) {
          printLine(S(`cat: ${arg}: 没有那个文件或目录`, 't-red'));
          continue;
        }
        if (node.kind === 'dir') {
          printLine(S(`cat: ${arg}: 是一个目录`, 't-red'));
          continue;
        }
        printLines(node.read());
      }
    },
  },
  pwd: {
    desc: '显示当前路径',
    run: () => printLine(`/home/visitor${cwd.length ? '/' + cwd.join('/') : ''}`),
  },
  open: {
    desc: '在浏览器中打开对应页面 (open blog)',
    run: (args) => {
      const target = args[0];
      if (!target) return printLine(S('open: 缺少参数,试试 open blog', 't-red'));
      const parts = resolvePath(target, cwd);
      const node = parts ? getNode(parts) : null;
      if (!node) return printLine(S(`open: ${target}: 没有那个文件或目录`, 't-red'));

      let page: string | undefined;
      if (node.kind === 'file') page = node.page;
      else {
        const key = parts.join('/');
        if (key === 'blog') page = 'blog';
        else if (key === 'projects') page = 'portfolio';
        else if (key === '') page = '';
      }
      if (page === undefined) return printLine(S(`open: ${target}: 没有关联的页面`, 't-red'));
      const url = DATA.base + page;
      printLine(S(`正在打开 ${url || DATA.base} ...`, 't-dim'));
      scrollDown();
      setTimeout(() => {
        window.location.href = url || DATA.base;
      }, 350);
    },
  },
  whoami: {
    desc: '你是谁',
    run: () => {
      printLines([
        S('visitor', 't-green t-bold'),
        TXT(`你是本站的访问者。站长是 ${DATA.author},想了解他就 cat about.txt。`),
      ]);
    },
  },
  neofetch: {
    desc: '系统信息(彩蛋)',
    run: () => {
      const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      const art = [
        ' ██████╗██╗  ██╗',
        '██╔════╝██║  ██║',
        '██║     ███████║',
        '██║     ██╔══██║',
        '╚██████╗██║  ██║',
        ' ╚═════╝╚═╝  ╚═╝',
      ];
      const info: Line[] = [
        [{ t: 'visitor', c: 't-green t-bold' }, { t: '@', c: 't-dim' }, { t: DATA.author, c: 't-green t-bold' }],
        S('─'.repeat(20), 't-dim'),
        [{ t: 'OS:       ', c: 't-yellow' }, `${DATA.author} OS x86_64`],
        [{ t: 'Host:     ', c: 't-yellow' }, 'GitHub Pages'],
        [{ t: 'Kernel:   ', c: 't-yellow' }, 'astro-7.1.1-tailwind'],
        [{ t: 'Shell:    ', c: 't-yellow' }, 'web-sh 1.0'],
        [{ t: 'Theme:    ', c: 't-yellow' }, theme],
        [{ t: 'Terminal: ', c: 't-yellow' }, 'browser'],
        [{ t: 'Uptime:   ', c: 't-yellow' }, `${Math.round((Date.now() - bootTime) / 1000)}s`],
      ];
      const rows = Math.max(art.length, info.length);
      for (let i = 0; i < rows; i++) {
        const segs: Array<string | Seg> = [];
        if (art[i]) segs.push({ t: art[i].padEnd(19), c: 't-green' });
        else segs.push(' '.repeat(19));
        const inf = info[i];
        if (inf !== undefined) {
          if (typeof inf === 'string') segs.push(inf);
          else segs.push(...inf);
        }
        printLine(segs);
      }
      scrollDown();
    },
  },
  echo: {
    desc: '回显文本 (echo hello)',
    run: (_args, raw) => printLine(raw.replace(/^echo\s?/, '')),
  },
  clear: {
    desc: '清屏',
    run: () => {
      outEl.innerHTML = '';
    },
  },
  history: {
    desc: '命令历史',
    run: () => {
      if (history.length === 0) return printLine(S('(暂无历史)', 't-dim'));
      printLines(history.map((h, i): Line => [{ t: `  ${String(i + 1).padStart(3)}  ${h}`, c: 't-dim' }]));
    },
  },
  date: {
    desc: '当前日期时间',
    run: () => printLine(new Date().toLocaleString('zh-CN', { hour12: false })),
  },
  theme: {
    desc: '切换主题 [dark|light]',
    run: (args) => {
      const el = document.documentElement;
      let next: string;
      if (args[0] === 'dark' || args[0] === 'light') {
        el.classList.toggle('dark', args[0] === 'dark');
        next = args[0];
      } else {
        next = el.classList.toggle('dark') ? 'dark' : 'light';
      }
      localStorage.setItem('theme', next);
      printLine(S(`主题已切换为 ${next}`, 't-green'));
      scrollDown();
    },
  },
  exit: {
    desc: '离开终端(并不能)',
    run: () => {
      printLines([
        S('logout 失败:你被永远困在了这个主页里。', 't-red'),
        S('(开玩笑的 —— 直接关闭标签页即可。)', 't-dim'),
      ]);
    },
  },
  /* ---- 彩蛋命令 ---- */
  sudo: {
    desc: '',
    run: (_a, raw) => {
      printLines([
        S('visitor is not in the sudoers file. This incident will be reported.', 't-red'),
        S(`(试图执行: ${raw})`, 't-dim'),
      ]);
    },
  },
  rm: {
    desc: '',
    run: () => printLine(S('rm: 拒绝执行:这个文件系统是只读的 🙂', 't-red')),
  },
  vim: { desc: '', run: () => printLine(S('放弃吧,在这里你也退不出 vim。好吧其实根本没有 vim。', 't-yellow')) },
  nano: { desc: '', run: () => printLine(S('nano: 本站内容只读,去博客页面看吧。', 't-yellow')) },
  emacs: { desc: '', run: () => printLine(S('emacs: 一个伟大的操作系统,可惜这里只是个主页。', 't-yellow')) },
  man: { desc: '', run: () => printLine(S('没有 man 手册,输入 help 吧。', 't-yellow')) },
};

/* ================= 命令执行 ================= */

function runCommand(raw: string) {
  const trimmed = raw.trim();
  echoCommand(raw);
  if (trimmed !== '') {
    history.push(raw);
    hIdx = history.length;
  }
  if (trimmed === '') {
    scrollDown();
    return;
  }
  const [name, ...args] = trimmed.split(/\s+/);
  const cmd = CMDS[name];
  if (!cmd) {
    printLine(S(`bash: ${name}: command not found`, 't-red'));
    printLine(S('输入 help 查看可用命令。', 't-dim'));
  } else {
    cmd.run(args, trimmed);
  }
  scrollDown();
}

/* ================= Tab 补全 ================= */

function complete() {
  const buf = inputEl.value;
  const tokens = buf.split(/\s+/);
  const endsWithSpace = buf.endsWith(' ');
  const completingIdx = endsWithSpace ? tokens.length : tokens.length - 1;
  const partial = endsWithSpace ? '' : tokens[tokens.length - 1];

  if (completingIdx === 0) {
    // 补全命令名(只补全有描述的正式命令)
    const candidates = Object.keys(CMDS)
      .filter((c) => CMDS[c].desc !== '' && c.startsWith(partial))
      .sort();
    if (candidates.length === 1) {
      replaceToken(completingIdx, candidates[0] + ' ');
    } else if (candidates.length > 1) {
      const cp = commonPrefix(candidates);
      if (cp.length > partial.length) replaceToken(completingIdx, cp);
      printLine(candidates.map((c): Seg => ({ t: c, c: 't-green' })));
      scrollDown();
    }
    return;
  }

  // 补全路径
  const cmdName = tokens[0];
  if (!['ls', 'cd', 'cat', 'open'].includes(cmdName)) return;
  const slashIdx = partial.lastIndexOf('/');
  const dirPart = slashIdx >= 0 ? partial.slice(0, slashIdx + 1) : '';
  const namePart = slashIdx >= 0 ? partial.slice(slashIdx + 1) : partial;
  const dirParts = resolvePath(dirPart === '' ? '.' : dirPart, cwd);
  const dirNode = dirParts ? getNode(dirParts) : null;
  if (!dirNode || dirNode.kind !== 'dir') return;

  const candidates: string[] = [];
  for (const [name, node] of dirNode.children) {
    if (name.startsWith(namePart)) {
      candidates.push(dirPart + name + (node.kind === 'dir' ? '/' : ''));
    }
  }
  candidates.sort();
  if (candidates.length === 1) {
    replaceToken(completingIdx, candidates[0] + (candidates[0].endsWith('/') ? '' : ' '));
  } else if (candidates.length > 1) {
    const cp = commonPrefix(candidates);
    if (cp.length > partial.length) replaceToken(completingIdx, cp);
    printLine(candidates.map((c): Seg => ({ t: c, c: 't-cyan' })));
    scrollDown();
  }
}

function replaceToken(idx: number, value: string) {
  const tokens = inputEl.value.split(/\s+/);
  tokens[idx] = value;
  inputEl.value = tokens.join(' ');
}

function commonPrefix(arr: string[]): string {
  if (arr.length === 0) return '';
  let p = arr[0];
  for (const s of arr.slice(1)) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
  }
  return p;
}

/* ================= 开机动画与欢迎 ================= */

const BOOT_LINES: [string, number][] = [
  ['[    0.000000] Linux version 6.9.0 (charienustc@github-pages) #1 SMP', 60],
  ['[    0.004201] Command line: BOOT_IMAGE=/vmlinuz-homepage root=/dev/portfolio rw', 50],
  ['[    0.013370] Memory: 131072K available', 40],
  ['[    0.021000] Mounting /home/visitor ... OK', 45],
  ['[    0.034000] Starting homepage.service ... OK', 55],
  ['[    0.042069] Reached target: Personal Homepage', 70],
];

let bootSkipped = false;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function boot() {
  const booted = sessionStorage.getItem('web-sh-booted') === '1';
  if (!booted) {
    const skip = () => {
      bootSkipped = true;
    };
    screen.addEventListener('click', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    for (const [line, delay] of BOOT_LINES) {
      if (bootSkipped) break;
      printLine(line, 't-dim');
      scrollDown();
      await wait(delay);
    }
    sessionStorage.setItem('web-sh-booted', '1');
    if (!bootSkipped) printLine('');
  }

  /* 欢迎信息 */
  printLines([
    S(`${DATA.author} OS 7.1 tty1 — visitor 已自动登录`, 't-bold'),
    TXT(''),
    S('欢迎来到我的主页。', 't-green'),
    TXT(''),
    TXT("输入 'help' 查看可用命令。"),
    TXT(''),
  ]);
  printChips(['help']);
  printLine('');

  rowEl.classList.remove('hidden');
  rowEl.classList.add('flex');
  setPrompt();
  scrollDown();
  /* 桌面端自动聚焦,移动端不弹键盘 */
  if (window.matchMedia('(pointer: fine)').matches) {
    inputEl.focus();
  }
}

/* ================= 事件绑定 ================= */

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = inputEl.value;
    inputEl.value = '';
    runCommand(value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (history.length === 0) return;
    if (hIdx === history.length) hStash = inputEl.value;
    if (hIdx > 0) {
      hIdx--;
      inputEl.value = history[hIdx];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (hIdx < history.length - 1) {
      hIdx++;
      inputEl.value = history[hIdx];
    } else {
      hIdx = history.length;
      inputEl.value = hStash;
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    complete();
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    outEl.innerHTML = '';
  } else if (e.key === 'c' && e.ctrlKey) {
    e.preventDefault();
    echoCommand(inputEl.value + '^C');
    inputEl.value = '';
    hIdx = history.length;
    scrollDown();
  }
});

/* 点击屏幕聚焦输入框(选中文本时不打断) */
screen.addEventListener('click', () => {
  const sel = window.getSelection();
  if (sel && sel.toString().length > 0) return;
  inputEl.focus();
});

/* chips 点击执行 */
outEl.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-cmd]') as HTMLElement | null;
  if (!target) return;
  const cmd = target.dataset.cmd!;
  runCommand(cmd);
});

/* 启动 */
boot();
