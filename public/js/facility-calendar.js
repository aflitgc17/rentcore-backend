// SPA 전용: 즉시 실행
(function () {
  const el = document.getElementById("calendar");
  if (!el) return;

  if (typeof FullCalendar === "undefined") {
    console.error("❌ FullCalendar가 로드되지 않았습니다.");
    return;
  }

  const calendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    locale: "ko",
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    events: fetchEvents,
    eventClick(info) {
      const e = info.event;
      alert(
        `장비: ${e.title}\n기간: ${e.startStr} ~ ${e.endStr ?? e.startStr}`
      );
    },
  });

  calendar.render();

  async function fetchEvents(fetchInfo, success, failure) {
    try {
      const res = await fetch("/admin/calendar/reservations", {
        headers: {
          "x-admin": "true", // 지금 단계용
        },
      });
      const data = await res.json();

      const events = data.map((r) => ({
        title: r.title,
        start: r.start,
        end: r.end,
      }));

      success(events);
    } catch (err) {
      console.error(err);
      failure(err);
    }
  }
})();
