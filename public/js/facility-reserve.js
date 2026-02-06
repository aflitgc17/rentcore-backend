const facilitySelect = document.getElementById("facility-select");
const dateInput = document.getElementById("reserve-date");
const timeButtons = document.querySelectorAll(".time-grid button");
const reserveBtn = document.getElementById("reserve-btn");

let selectedTime = null;

timeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    timeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTime = btn.dataset.time;
    validate();
  });
});

facilitySelect.addEventListener("change", validate);
dateInput.addEventListener("change", validate);

function validate() {
  if (
    facilitySelect.value &&
    dateInput.value &&
    selectedTime
  ) {
    reserveBtn.disabled = false;
  }
}

reserveBtn.addEventListener("click", () => {
  alert(`
시설: ${facilitySelect.value}
날짜: ${dateInput.value}
시간: ${selectedTime}
  
(지금은 테스트 단계)
  `);
});
