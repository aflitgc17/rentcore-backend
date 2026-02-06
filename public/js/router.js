const content = document.getElementById("content");

async function loadPage(url) {
  // 루트 접근 방지
  if (url === "/" || url === "/layout.html") {
    url = "/equipments.html";
  }

  const res = await fetch(url);
  const html = await res.text();

  content.innerHTML = html;
  runPageScript(url);
}

function runPageScript(url) {
  if (url.includes("equipments")) {
    loadScript("/js/equipments.js");
  }

  if (url.includes("facility-reserve")) {
    loadScript("/js/facility-reserve.js");
  }

  if (url.includes("my-reservations")) {
    loadScript("/js/my-reserve.js");
  }

  if (url.includes("facility-calendar")) {
  loadScript("/js/facility-calendar.js");
}
}

function loadScript(src) {
  const old = document.querySelector("script[data-page]");
  if (old) old.remove();

  const script = document.createElement("script");
  script.src = src;
  script.dataset.page = "true";
  document.body.appendChild(script);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-link]");
  if (!link) return;

  e.preventDefault();
  const url = link.getAttribute("href");

  history.pushState(null, "", url);
  loadPage(url);
});

window.addEventListener("popstate", () => {
  loadPage(location.pathname);
});

// 최초 로딩
loadPage("/equipments.html");
