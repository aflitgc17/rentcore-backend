// ✅ 더미 데이터 (나중에 API로 교체)
const equipmentReservations = [
  {
    name: "Sony A7M4",
    period: "2026.01.10 ~ 2026.01.12",
    status: "APPROVED",
    createdAt: "2026.01.08"
  },
  {
    name: "삼각대",
    period: "2026.01.15 ~ 2026.01.16",
    status: "PENDING",
    createdAt: "2026.01.09"
  }
];

const facilityReservations = [
  {
    name: "편집실 A",
    date: "2026.01.20",
    time: "14:00 ~ 16:00",
    status: "APPROVED"
  },
  {
    name: "녹음실 1",
    date: "2026.01.22",
    time: "10:00 ~ 11:00",
    status: "PENDING"
  }
];

// -----------------------------

function renderEquipment() {
  const container = document.getElementById("equipment-list");

  if (equipmentReservations.length === 0) {
    container.innerHTML = `<div class="empty">대여한 장비가 없습니다.</div>`;
    return;
  }

  container.innerHTML = equipmentReservations.map(item => `
    <div class="card">
      <div class="card-title">${item.name}</div>
      <div class="card-info">대여 기간: ${item.period}</div>
      <div class="card-info">신청일: ${item.createdAt}</div>
      <span class="status ${item.status}">${item.status}</span>
    </div>
  `).join("");
}

function renderFacility() {
  const container = document.getElementById("facility-list");

  if (facilityReservations.length === 0) {
    container.innerHTML = `<div class="empty">예약한 시설이 없습니다.</div>`;
    return;
  }

  container.innerHTML = facilityReservations.map(item => `
    <div class="card">
      <div class="card-title">${item.name}</div>
      <div class="card-info">${item.date}</div>
      <div class="card-info">${item.time}</div>
      <span class="status ${item.status}">${item.status}</span>
    </div>
  `).join("");
}

// 초기 렌더
renderEquipment();
renderFacility();
