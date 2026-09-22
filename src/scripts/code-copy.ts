// 代码块复制按钮:把 .prose-custom pre 包进 .code-window 定位容器并注入按钮。
// ClientRouter 换页后新 pre 节点需要重新处理,所以放在 astro:page-load 里跑。
function setupCodeCopy() {
  const blocks = document.querySelectorAll<HTMLElement>('.prose-custom pre');
  for (const pre of blocks) {
    if (pre.parentElement?.classList.contains('code-window')) continue;

    const wrap = document.createElement('div');
    wrap.className = 'code-window';
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      const text = pre.querySelector('code')?.innerText ?? pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // 剪贴板 API 不可用(非安全上下文)时的回退
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.dataset.copied = 'true';
      btn.textContent = '已复制';
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.dataset.copied = 'false';
        btn.textContent = 'Copy';
      }, 1600);
    });
    wrap.appendChild(btn);
  }
}

document.addEventListener('astro:page-load', setupCodeCopy);
