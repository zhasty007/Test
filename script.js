/* =============================================
   ByteDepth — Interactive JS
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- MOBILE NAV ---- */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.querySelector('.nav__links');

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

  /* ---- FILTER TABS ---- */
  const filterTabs = document.querySelectorAll('.filter-tab');
  const postCards  = document.querySelectorAll('.post-card');

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      postCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('post-card--hidden', !match);
      });
    });
  });

  /* ---- SEARCH ---- */
  const searchInput = document.getElementById('searchInput');
  const articles = [
    { title: 'Building Blazing-Fast APIs with Rust and Actix-Web', category: 'Systems', url: 'post.html', date: 'Apr 5, 2026' },
    { title: 'Deep Dive into TypeScript Generics',                 category: 'Web',     url: 'post.html', date: 'Mar 28, 2026' },
    { title: 'Fine-Tuning LLMs on Limited Hardware',               category: 'AI/ML',   url: 'post.html', date: 'Mar 21, 2026' },
    { title: 'Kubernetes Resource Limits Demystified',             category: 'DevOps',  url: 'post.html', date: 'Mar 14, 2026' },
    { title: 'Writing a Linux Kernel Module in C',                 category: 'Systems', url: 'post.html', date: 'Mar 7, 2026'  },
    { title: 'React Server Components: A Practical Guide',         category: 'Web',     url: 'post.html', date: 'Feb 28, 2026' },
    { title: 'Vector Databases Explained: HNSW vs IVF',           category: 'AI/ML',   url: 'post.html', date: 'Feb 20, 2026' },
  ];

  let overlay = null;

  function buildOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.innerHTML = `
      <div class="search-overlay__box">
        <div class="search-overlay__results" id="searchResults"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSearch();
    });
  }

  function openSearch() {
    buildOverlay();
    overlay.classList.add('open');
    document.addEventListener('keydown', handleSearchKey);
  }

  function closeSearch() {
    if (overlay) overlay.classList.remove('open');
    document.removeEventListener('keydown', handleSearchKey);
  }

  function handleSearchKey(e) {
    if (e.key === 'Escape') closeSearch();
  }

  function renderResults(query) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (!query.trim()) {
      container.innerHTML = '<p style="padding:20px;color:var(--text-muted);font-size:0.88rem;">Start typing to search articles…</p>';
      return;
    }

    const q = query.toLowerCase();
    const hits = articles.filter(a => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));

    if (!hits.length) {
      container.innerHTML = '<p style="padding:20px;color:var(--text-muted);font-size:0.88rem;">No articles found.</p>';
      return;
    }

    container.innerHTML = hits.map(a => `
      <a href="${a.url}" class="search-result-item" style="text-decoration:none;">
        <div class="search-result-item__text">
          <span class="search-result-item__title">${a.title}</span>
          <span class="search-result-item__meta">${a.category} · ${a.date}</span>
        </div>
      </a>
    `).join('');
  }

  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      openSearch();
      renderResults(searchInput.value);
    });

    searchInput.addEventListener('input', () => {
      openSearch();
      renderResults(searchInput.value);
    });

    // Also filter the posts grid in real-time
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      postCards.forEach(card => {
        const title = card.dataset.title || '';
        card.classList.toggle('post-card--hidden', q.length > 0 && !title.includes(q));
      });
    });
  }

  /* ---- KEYBOARD SHORTCUT (/) to focus search ---- */
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      searchInput && searchInput.focus();
    }
  });

  /* ---- NEWSLETTER FORM ---- */
  const newsletterForm    = document.getElementById('newsletterForm');
  const newsletterSuccess = document.getElementById('newsletterSuccess');

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      newsletterForm.style.display = 'none';
      if (newsletterSuccess) newsletterSuccess.classList.add('visible');
    });
  }

  /* ---- COPY CODE BUTTONS ---- */
  document.querySelectorAll('.code-block__copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = btn.closest('.code-block').querySelector('pre');
      const text = pre ? pre.textContent : '';
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(() => {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
  });

  /* ---- READING PROGRESS BAR ---- */
  const progressBar = document.getElementById('readingProgress');
  if (progressBar) {
    const updateProgress = () => {
      const article = document.querySelector('.article-body') || document.body;
      const { top, height } = article.getBoundingClientRect();
      const winH = window.innerHeight;
      const scrolled = Math.max(0, -top);
      const total = height - winH;
      const pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
      progressBar.style.width = pct + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
  }

  /* ---- TOC ACTIVE HIGHLIGHT ---- */
  const tocLinks = document.querySelectorAll('.toc__list a');
  if (tocLinks.length) {
    const headings = Array.from(document.querySelectorAll('.article-body section[id]'));

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(l => l.classList.remove('active'));
          const link = document.querySelector(`.toc__list a[href="#${entry.target.id}"]`);
          if (link) link.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    headings.forEach(h => observer.observe(h));
  }

  /* ---- LOAD MORE BUTTON ---- */
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      // Simulate loading more with a visual indicator
      loadMoreBtn.textContent = 'Loading…';
      loadMoreBtn.disabled = true;

      setTimeout(() => {
        const extraPosts = [
          { title: 'Zig for Systems Programming: First Impressions', category: 'systems', tag: 'Systems', color: 'bg--orange', lang: 'Zig', author: 'MN', name: 'Mark Novak', date: 'Feb 14, 2026', time: '14 min read' },
          { title: 'OpenTelemetry: The Definitive Setup Guide',      category: 'devops',  tag: 'DevOps',  color: 'bg--teal',  lang: 'OTel', author: 'AK', name: 'Alex Kim',  date: 'Feb 7, 2026',  time: '11 min read' },
          { title: 'Diffusion Models from Scratch in PyTorch',       category: 'ai',      tag: 'AI/ML',   color: 'bg--purple', lang: 'Py', author: 'SR', name: 'Sara Reyes', date: 'Jan 30, 2026', time: '20 min read' },
        ];

        const grid = document.getElementById('postsGrid');
        extraPosts.forEach(post => {
          const article = document.createElement('article');
          article.className = 'post-card';
          article.dataset.category = post.category;
          article.dataset.title = post.title.toLowerCase();
          article.innerHTML = `
            <div class="post-card__image">
              <div class="post-card__image-bg ${post.color}"></div>
              <div class="post-card__lang">${post.lang}</div>
            </div>
            <div class="post-card__body">
              <div class="post-card__meta">
                <span class="tag tag--sm">${post.tag}</span>
                <span class="post-card__read-time">${post.time}</span>
              </div>
              <h3 class="post-card__title"><a href="post.html">${post.title}</a></h3>
              <div class="post-card__footer">
                <div class="avatar">${post.author}</div>
                <div class="post-card__author-info">
                  <span class="post-card__author">${post.name}</span>
                  <span class="post-card__date">${post.date}</span>
                </div>
              </div>
            </div>
          `;
          grid.appendChild(article);
        });

        loadMoreBtn.textContent = 'All articles loaded';
        loadMoreBtn.disabled = true;
        loadMoreBtn.style.opacity = '0.5';
      }, 800);
    });
  }

  /* ---- SMOOTH SCROLL for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

});
