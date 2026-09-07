const root = document.documentElement;
const menuButton = document.querySelector('.menu-toggle');
const navList = document.querySelector('.nav-list');
const themeButton = document.querySelector('.theme-toggle');
const themeIcon = document.querySelector('.theme-icon');
const navLinks = [...document.querySelectorAll('.nav-list a')];
const sectionLinks = navLinks.filter((link) => link.getAttribute('href').startsWith('#'));
const sections = [...document.querySelectorAll('main section[id]')];

function setTheme(theme) {
  root.dataset.theme = theme;
  const isDark = theme === 'dark';
  themeIcon.textContent = isDark ? '☀' : '☾';
  themeButton.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
}

const savedTheme = localStorage.getItem('profile-theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
setTheme(savedTheme || preferredTheme);

themeButton.addEventListener('click', () => {
  const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
  localStorage.setItem('profile-theme', nextTheme);
});

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.querySelector('.sr-only').textContent = isOpen ? '메뉴 열기' : '메뉴 닫기';
  navList.classList.toggle('is-open', !isOpen);
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.querySelector('.sr-only').textContent = '메뉴 열기';
    navList.classList.remove('is-open');
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navList.classList.contains('is-open')) {
    menuButton.click();
    menuButton.focus();
  }
});

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    sectionLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${entry.target.id}`;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-30% 0px -60%', threshold: 0 });

sections.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
document.querySelector('#current-year').textContent = new Date().getFullYear();
