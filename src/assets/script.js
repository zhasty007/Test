/* =============================================
   Find a Great CT Attorney: site JS
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- MOBILE NAV ---- */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
      }
    });
  }

  /* ---- ACTIVE NAV LINK ---- */
  document.querySelectorAll('.nav__links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href !== '/' && location.pathname.startsWith(href)) a.classList.add('active');
  });

});
