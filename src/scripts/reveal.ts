// 滚动入场:进入视口的 [data-reveal] 元素加 .is-visible。
// ClientRouter 换页后新节点需要重新挂观察,所以放在 astro:page-load 里跑。
function setupReveal() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)');
  if (els.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.02 }
  );

  els.forEach((el) => io.observe(el));
}

document.addEventListener('astro:page-load', setupReveal);
