import type { Category, Tool } from '../tools';
import { el } from './dom';

export interface Sidebar {
  setActive(toolId: string): void;
}

const MODAL = '(max-width: 839px)';

// Material 3 navigation drawer: persistent on wide screens, modal behind ☰ on narrow ones.
export function mountSidebar(
  nav: HTMLElement,
  menuButton: HTMLElement,
  scrim: HTMLElement,
  background: HTMLElement,
  groups: { category: Category; tools: Tool[] }[],
): Sidebar {
  const links = new Map<string, HTMLAnchorElement>();
  for (const { category, tools } of groups) {
    const items = tools.map((tool) => {
      if (tool.formats.length === 0) {
        return el(
          'li',
          {},
          el('span', { class: 'nav-item soon', role: 'link', 'aria-disabled': 'true' }, tool.title, el('span', { class: 'badge' }, 'скоро')),
        );
      }
      const link = el('a', { class: 'nav-item', href: `#/${tool.id}` }, tool.title);
      link.addEventListener('click', (e) => {
        // Re-clicking the open section would push a history entry that "Back" then silently undoes.
        if (link.getAttribute('aria-current') === 'page') e.preventDefault();
        close();
      });
      links.set(tool.id, link);
      return el('li', {}, link);
    });
    const headingId = `nav-${category.id}`;
    nav.append(
      el('section', { class: 'nav-section', 'aria-labelledby': headingId }, el('h2', { id: headingId }, category.title), el('ul', {}, ...items)),
    );
  }

  const modal = window.matchMedia(MODAL);

  function open(): void {
    document.body.classList.add('drawer-open');
    scrim.hidden = false;
    // Modal: the page behind the scrim is neither focusable nor read by screen readers.
    background.inert = true;
    menuButton.setAttribute('aria-expanded', 'true');
    const target = nav.querySelector<HTMLElement>('[aria-current="page"]') ?? links.values().next().value;
    target?.focus();
  }

  function close(): void {
    if (!document.body.classList.contains('drawer-open')) return;
    document.body.classList.remove('drawer-open');
    scrim.hidden = true;
    background.inert = false;
    menuButton.setAttribute('aria-expanded', 'false');
    if (modal.matches) menuButton.focus();
  }

  menuButton.addEventListener('click', open);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  modal.addEventListener('change', close);

  return {
    setActive(toolId) {
      for (const [id, link] of links) {
        if (id === toolId) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },
  };
}
