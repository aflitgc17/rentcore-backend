const dummyEquipments = [
  {
    id: 1,
    name: "카메라",
    code: "camera002",
    status: "대여중",
    imageUrl: "https://placehold.co/80x80"
  },
  {
    id: 2,
    name: "삼각대",
    code: "tripod001",
    status: "대여중",
    imageUrl: "https://placehold.co/80x80"
  },
  {
    id: 3,
    name: "반사판",
    code: "ref1234",
    status: "대여중",
    imageUrl: "https://placehold.co/80x80"
  }
];

const tbody = document.getElementById("equipment-table-body");

function render() {
  tbody.innerHTML = "";

  dummyEquipments.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${item.imageUrl}"></td>
      <td>${item.name}</td>
      <td>${item.code}</td>
      <td>${item.status}</td>
      <td><button class="btn-outline">상세보기</button></td>
      <td><button class="btn-cart">담기</button></td>
    `;
    tbody.appendChild(tr);
  });
}

render();
