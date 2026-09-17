const SELECTOR = '.card';

function attach(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((card) => {
    if (card.dataset.glowBound === 'true') return;
    card.dataset.glowBound = 'true';

    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });
}

attach();
document.addEventListener('astro:after-swap', () => attach());
