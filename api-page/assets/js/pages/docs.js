import { h, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { loadConfig } from '../core/config.js';
import { fetchSystemStatus, buildStatusModel } from '../core/status-data.js';
import { closeDialog, openDialog, rafThrottle, scrollToHash, setupDialog } from '../core/ui.js';
import { mountShell, showFatalError } from '../components/layout.js';
import { DocsHeader, DocsNav, TocRail } from '../components/docs.js';
import { buildDocSections } from '../components/docs-content.js';
import { SearchTrigger } from '../components/search.js';

async function main() {
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    showFatalError(error);
    return;
  }

  const shell = mountShell({ config, active: 'docs' });
  const header = DocsHeader({ config });
  const toc = TocRail();

  // Mobile: the sidebar becomes a left-hand drawer.
  const drawer = setupDialog(h('dialog', { class: 'drawer drawer--left', 'aria-label': 'Documentation menu' }));
  const drawerNav = DocsNav({ config, onNavigate: () => closeDialog(drawer) });
  drawer.append(
    h(
      'div',
      { class: 'drawer__inner' },
      h('div', { class: 'drawer__head' }, h('p', { class: 'drawer__heading' }, 'Documentation'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close documentation menu', onclick: () => closeDialog(drawer) }, icon('x'))),
      drawerNav.el
    )
  );

  const sideNav = DocsNav({ config });
  const sections = buildDocSections(config);

  const layout = h(
    'div',
    { class: 'container docs' },
    h('aside', { class: 'docs-side', 'aria-label': 'Documentation sidebar' }, h('div', { class: 'docs-side__inner' }, SearchTrigger({ config }), sideNav.el)),
    h(
      'div',
      { class: 'docs-main' },
      h(
        'div',
        { class: 'docs-mobilebar' },
        SearchTrigger({ config }),
        h('button', { type: 'button', class: 'btn docs-mobilebar__menu', 'aria-label': 'Sections', 'aria-haspopup': 'dialog', onclick: () => openDialog(drawer) }, icon('menu', { size: 18 }), h('span', { class: 'docs-mobilebar__label' }, 'Sections'))
      ),
      header.el,
      h('div', { class: 'docs-content' }, sections)
    ),
    h('aside', { class: 'docs-toc' }, toc.el)
  );

  shell.main.append(layout, drawer);

  /* ---- scroll-spy: highlights the current section and fills "On this page" ---- */
  const headings = $$('[data-toc]', layout);
  let currentSection = null;

  const spy = rafThrottle(() => {
    const offset = (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60) + 28;
    // Section titles are measured from their <section> (which is what anchor links scroll to).
    const topOf = (heading) => (heading.dataset.toc === '2' ? heading.closest('section') || heading : heading).getBoundingClientRect().top;
    let current = headings[0];
    for (const heading of headings) {
      if (topOf(heading) - offset <= 0) current = heading;
      else break;
    }
    // At the very bottom the last section can never reach the top of the screen, so select it explicitly.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      current = [...headings].reverse().find((heading) => heading.dataset.toc === '2') || current;
    }
    if (!current) return;

    const index = headings.indexOf(current);
    let sectionHeading = current;
    for (let i = index; i >= 0; i--) {
      if (headings[i].dataset.toc === '2') {
        sectionHeading = headings[i];
        break;
      }
    }
    const sectionId = sectionHeading.dataset.section;

    if (sectionId !== currentSection) {
      currentSection = sectionId;
      const items = [];
      for (let i = headings.indexOf(sectionHeading) + 1; i < headings.length && headings[i].dataset.toc !== '2'; i++) {
        const heading = headings[i];
        items.push({ id: heading.id, text: heading.textContent.trim(), level: Number(heading.dataset.toc) });
      }
      toc.setItems(items);
    }

    const subKey = current.dataset.toc === '2' ? null : current.id.replace(/-title$/, '');
    sideNav.setActive(sectionId, subKey);
    drawerNav.setActive(sectionId, subKey);
    header.setActive(sectionId);
    toc.setActive(current.dataset.toc === '2' ? null : current.id);
  });

  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  scrollToHash();
  spy();

  const result = await fetchSystemStatus({ demo: new URLSearchParams(location.search).has('demo') });
  shell.setSystem(buildStatusModel(result, config).overall);
}

main();
