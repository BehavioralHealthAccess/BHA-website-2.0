/**
 * Scroll-snap landing: highlight nav links + light section reveal.
 */
(function () {
  const sections = document.querySelectorAll(".site-section");
  const links = document.querySelectorAll('.site-links a[href^="#"]');

  function markSectionsInView() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    sections.forEach((sec) => {
      const r = sec.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) sec.classList.add("is-visible");
    });
  }

  function setActive() {
    const y = window.scrollY + 120;
    let current = "";
    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const h = sec.offsetHeight;
      if (y >= top && y < top + h) current = sec.id;
    });
    links.forEach((a) => {
      const id = a.getAttribute("href");
      if (id && id.startsWith("#") && id.slice(1) === current) {
        a.setAttribute("aria-current", "true");
      } else if (id && id.startsWith("#")) {
        a.removeAttribute("aria-current");
      }
    });
  }

  if ("IntersectionObserver" in window && sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) en.target.classList.add("is-visible");
        });
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    sections.forEach((s) => io.observe(s));
  } else {
    sections.forEach((s) => s.classList.add("is-visible"));
  }

  window.addEventListener("scroll", setActive, { passive: true });
  markSectionsInView();
  setActive();
})();
