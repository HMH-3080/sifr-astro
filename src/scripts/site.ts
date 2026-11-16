import { translations, type Lang } from '../i18n/translations';
import './audio';

type Dict = (typeof translations)['en'];
type DictKey = keyof Dict;

declare global {
  interface Window {
    __SIFR_CONFIG__?: { contactEmail: string; formEndpoint: string };
  }
}

const $ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode = document) =>
  ctx.querySelector(sel) as T | null;
const $$ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode = document) =>
  Array.from(ctx.querySelectorAll(sel)) as T[];

const CONFIG = {
  contactEmail: window.__SIFR_CONFIG__?.contactEmail ?? '',
  formEndpoint: window.__SIFR_CONFIG__?.formEndpoint ?? '',
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

const header = $('#header')!;
const menuBtn = $('#menuBtn') as HTMLButtonElement | null;
const toTop = $('#toTop') as HTMLButtonElement | null;
const progressBar = $('#progressBar');

/* ------------------------------------------------------------------ */
/* Language                                                            */
/* ------------------------------------------------------------------ */

let lang: Lang = 'en';

function dict(): Dict {
  return translations[lang] as Dict;
}

function setLanguage(next: Lang) {
  lang = next;
  const t = dict();

  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  document.title = t.meta_title;

  $('meta[name="description"]')?.setAttribute('content', t.meta_desc);
  $('meta[property="og:title"]')?.setAttribute('content', t.meta_title);
  $('meta[property="og:description"]')?.setAttribute('content', t.meta_desc);
  $('meta[name="twitter:title"]')?.setAttribute('content', t.meta_title);
  $('meta[name="twitter:description"]')?.setAttribute('content', t.meta_desc);

  $$('[data-i18n]').forEach((el) => {
    const v = t[el.dataset.i18n as DictKey];
    if (typeof v === 'string') el.textContent = v;
  });

  $$('[data-i18n-placeholder]').forEach((el) => {
    const v = t[el.dataset.i18nPlaceholder as DictKey];
    if (typeof v === 'string') (el as HTMLInputElement).placeholder = v;
  });

  $$('[data-i18n-aria]').forEach((el) => {
    const v = t[el.dataset.i18nAria as DictKey];
    if (typeof v === 'string') el.setAttribute('aria-label', v);
  });

  $$<HTMLButtonElement>('[data-lang]').forEach((btn) => {
    btn.textContent = next === 'ar' ? 'English' : 'العربية';
    btn.setAttribute('aria-label', next === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
  });

  if (menuBtn) menuBtn.setAttribute('aria-label', t[header.classList.contains('menu-open') ? 'menu_close' : 'menu_open']);

  const status = $('#formStatus');
  if (status) status.textContent = '';
  $$('.field.invalid').forEach((f) => f.classList.remove('invalid'));
  $$('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

  try {
    localStorage.setItem('sifr-language', next);
  } catch {
    /* storage unavailable */
  }

  window.dispatchEvent(new Event('sifr:languagechange'));
}

$$<HTMLButtonElement>('[data-lang]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(lang === 'en' ? 'ar' : 'en')),
);

let saved: string | null = null;
try {
  saved = localStorage.getItem('sifr-language');
} catch {
  /* storage unavailable */
}
if (!saved) saved = (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
setLanguage(saved === 'ar' ? 'ar' : 'en');

/* ------------------------------------------------------------------ */
/* Mobile menu (focus-trapped)                                         */
/* ------------------------------------------------------------------ */

function setMenu(open: boolean) {
  header.classList.toggle('menu-open', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  if (menuBtn) menuBtn.setAttribute('aria-label', dict()[open ? 'menu_close' : 'menu_open']);
  if (open) setTimeout(() => $('.mobile-panel a')?.focus(), 60);
}

menuBtn?.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
$$('.mobile-panel a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

document.addEventListener('keydown', (e) => {
  if (!header.classList.contains('menu-open')) return;
  if (e.key === 'Escape') {
    setMenu(false);
    menuBtn?.focus();
    return;
  }
  if (e.key === 'Tab') {
    const items = $$<HTMLElement>('a,button', header).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

document.addEventListener('click', (e) => {
  if (header.classList.contains('menu-open') && !header.contains(e.target as Node)) setMenu(false);
});

window.addEventListener(
  'resize',
  () => {
    if (window.innerWidth > 760 && header.classList.contains('menu-open')) setMenu(false);
  },
  { passive: true },
);

/* ------------------------------------------------------------------ */
/* Reveal on scroll                                                    */
/* ------------------------------------------------------------------ */

// With reduced motion the CSS forces .reveal visible, so observing is wasted
// work and can leave elements stuck at opacity 0 if IntersectionObserver is
// delayed. Mark them visible immediately instead.
const revealTargets = $$('.reveal');
if (reduceMotion) {
  revealTargets.forEach((el) => el.classList.add('visible'));
} else {
  const revealObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver!.unobserve(entry.target);
              }
            }),
          { threshold: 0.12, rootMargin: '0px 0px -35px 0px' },
        )
      : null;

  revealTargets.forEach((el) =>
    revealObserver ? revealObserver.observe(el) : el.classList.add('visible'),
  );
}

/* ------------------------------------------------------------------ */
/* Scroll pipeline (single RAF)                                        */
/* ------------------------------------------------------------------ */

const navLinks = $$('.nav-links a');
const spySections = $$<HTMLElement>('main section[id]');

const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 16);

const updateProgress = () => {
  if (!progressBar) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  progressBar.style.transform = `scaleX(${ratio})`;
};

const setActive = () => {
  if (!navLinks.length || !spySections.length) return;
  const line = window.innerHeight * 0.42;
  let current: HTMLElement = spySections[0];
  spySections.forEach((section) => {
    if (section.getBoundingClientRect().top <= line) current = section;
  });
  navLinks.forEach((a) => {
    const on = a.getAttribute('href') === `#${current.id}`;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
};

const updateToTop = () => toTop?.classList.toggle('show', window.scrollY > 640);

let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    updateHeader();
    updateProgress();
    setActive();
    updateToTop();
  });
};

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
onScroll();

toTop?.addEventListener('click', () =>
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }),
);

/* ------------------------------------------------------------------ */
/* Cursor glare + card tilt                                            */
/* ------------------------------------------------------------------ */

if (finePointer) {
  $$('.glass').forEach((el) => {
    const tilt = !reduceMotion && el.matches('.cap-card,.work-card,.split-card');
    el.addEventListener(
      'pointermove',
      (event) => {
        const e = event as PointerEvent;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
        if (tilt) {
          el.style.setProperty('--ry', `${((x / rect.width - 0.5) * 4).toFixed(2)}deg`);
          el.style.setProperty('--rx', `${((0.5 - y / rect.height) * 4).toFixed(2)}deg`);
        }
      },
      { passive: true },
    );
    if (tilt)
      el.addEventListener(
        'pointerleave',
        () => {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        },
        { passive: true },
      );
  });
}

/* ------------------------------------------------------------------ */
/* Magnetic CTAs                                                       */
/* ------------------------------------------------------------------ */

if (finePointer && !reduceMotion) {
  $$('.btn-solid,.nav-cta').forEach((btn) => {
    btn.addEventListener(
      'pointermove',
      (event) => {
        const e = event as PointerEvent;
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--bx', `${(((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2)}px`);
        btn.style.setProperty('--by', `${(((e.clientY - r.top) / r.height - 0.5) * 4).toFixed(2)}px`);
      },
      { passive: true },
    );
    btn.addEventListener(
      'pointerleave',
      () => {
        btn.style.setProperty('--bx', '0px');
        btn.style.setProperty('--by', '0px');
      },
      { passive: true },
    );
  });
}

/* ------------------------------------------------------------------ */
/* Contact form                                                        */
/* ------------------------------------------------------------------ */

$('#year')!.textContent = String(new Date().getFullYear());

const form = $('#inquiryForm') as HTMLFormElement | null;
const status = $('#formStatus');

function markInvalid(el: HTMLElement, bad: boolean) {
  el.closest('.field')?.classList.toggle('invalid', bad);
  if (bad) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
}

form?.addEventListener('input', (event) => {
  const target = event.target as HTMLElement;
  const field = target.closest('.field');
  if (field) {
    field.classList.remove('invalid');
    target.removeAttribute('aria-invalid');
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const t = dict();
  if (!status) return;
  status.className = 'form-status';
  status.textContent = '';

  // Honeypot: silently accept bots so they do not retry.
  const company = form.elements.namedItem('company') as HTMLInputElement | null;
  if (company && company.value) {
    form.reset();
    status.classList.add('success');
    status.textContent = t.form_sent;
    return;
  }

  const nameEl = $('#name') as HTMLInputElement;
  const emailEl = $('#email') as HTMLInputElement;
  const typeEl = $('#type') as HTMLSelectElement;
  const msgEl = $('#message') as HTMLTextAreaElement;

  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const type = typeEl.value;
  const message = msgEl.value.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const checks: [HTMLElement, boolean][] = [
    [nameEl, Boolean(name)],
    [emailEl, validEmail],
    [typeEl, Boolean(type)],
    [msgEl, message.length >= 8],
  ];

  let firstBad: HTMLElement | null = null;
  checks.forEach(([el, ok]) => {
    markInvalid(el, !ok);
    if (!ok && !firstBad) firstBad = el;
  });

  if (firstBad) {
    status.classList.add('error');
    status.textContent = t.form_error;
    (firstBad as HTMLElement).focus();
    return;
  }

  const typeLabel = typeEl.options[typeEl.selectedIndex]?.textContent ?? '';
  const payload = { name, email, type, message, language: lang };
  const inquiryText = `${t.form_name}: ${name}\n${t.form_email}: ${email}\n${t.inq_type}: ${typeLabel}\n\n${message}`;

  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const btnLabel = button.querySelector<HTMLElement>('[data-i18n="form_submit"]');
  button.disabled = true;
  if (btnLabel) btnLabel.textContent = t.form_sending;

  try {
    if (CONFIG.formEndpoint) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const response = await fetch(CONFIG.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        if (!response.ok) throw new Error('Request failed');
      } finally {
        clearTimeout(timer);
      }
      status.classList.add('success');
      status.textContent = t.form_sent;
      form.reset();
    } else if (CONFIG.contactEmail) {
      const subject = encodeURIComponent(`sifr inquiry — ${typeLabel}`);
      const body = encodeURIComponent(inquiryText);
      window.location.href = `mailto:${CONFIG.contactEmail}?subject=${subject}&body=${body}`;
      status.classList.add('success');
      status.textContent = t.form_mail;
    } else {
      let copied = false;
      try {
        await navigator.clipboard.writeText(inquiryText);
        copied = true;
      } catch {
        /* clipboard blocked */
      }
      status.classList.add(copied ? 'success' : 'error');
      status.textContent = t[copied ? 'form_copied' : 'form_copy_fail'] as string;
      if (!copied) {
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.direction = 'ltr';
        pre.style.userSelect = 'all';
        pre.textContent = inquiryText;
        status.appendChild(pre);
      }
    }
  } catch {
    status.classList.add('error');
    status.textContent = t.form_failed;
  } finally {
    button.disabled = false;
    if (btnLabel) btnLabel.textContent = dict().form_submit;
  }
});