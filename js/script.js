// Nutripulso — interacciones base de la landing

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initHeaderScrollShadow();
  initScrollAnimations();
  initContactForm();
});

// Menú móvil (abrir/cerrar + cerrar al elegir una opción)
function initMobileMenu() {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('icon-open');
  const iconClose = document.getElementById('icon-close');
  if (!menuBtn || !mobileMenu) return;

  const toggleMenu = () => {
    const isOpen = !mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden');
    iconOpen.classList.toggle('hidden', !isOpen);
    iconClose.classList.toggle('hidden', isOpen);
    menuBtn.setAttribute('aria-expanded', String(!isOpen));
  };

  menuBtn.addEventListener('click', toggleMenu);

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      iconOpen.classList.remove('hidden');
      iconClose.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

// Añade sombra al header cuando el usuario hace scroll
function initHeaderScrollShadow() {
  const header = document.getElementById('header');
  if (!header) return;

  const updateShadow = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };
  updateShadow();
  window.addEventListener('scroll', updateShadow, { passive: true });
}

// Revela los elementos [data-animate] al entrar en el viewport
function initScrollAnimations() {
  const targets = document.querySelectorAll('[data-animate]');
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  targets.forEach((el) => observer.observe(el));
}

// Envío del formulario de contacto (front-end only por ahora; se conectará a un backend en la Fase 3)
function initContactForm() {
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('form-success');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // TODO Fase 3: enviar estos datos a un endpoint/API real.
    successMsg?.classList.remove('hidden');
    form.reset();
  });
}
