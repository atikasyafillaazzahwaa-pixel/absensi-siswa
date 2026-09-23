const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwc4W8NucU2FmqzhXwPznr-nLsHA0fPFdlMb_jIeGRmrv7N7VTjH4rVdNnZVggI7Uuw/exec";

let masterSiswa = [];
let scanning = false;
let isProcessing = false;
let isAdmin = false;

const video = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvas = canvasElement.getContext("2d");
const resultBox = document.getElementById("result-box");

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("filter-date").valueAsDate = new Date();
  loadKategoriKelas();
});

// Memuat daftar unik kelas dari Spreadsheet ke Dropdown
function loadKategoriKelas() {
  fetch(`${SCRIPT_URL}?action=getKategoriKelas`)
    .then(res => res.json())
    .then(res => {
      if (res.status === "success") {
        const selectKelas = document.getElementById("filter-kelas");
        selectKelas.innerHTML = `<option value="ALL">Semua Kelas</option>`;
        res.data.forEach(kelas => {
          const opt = document.createElement("option");
          opt.value = kelas;
          opt.textContent = kelas;
          selectKelas.appendChild(opt);
        });
      }
    })
    .catch(err => console.error("Gagal memuat kategori kelas:", err));
}

// Navigasi Tab
function switchTab(tab) {
  document.getElementById("tab-scan").classList.remove("active");
  document.getElementById("tab-admin").classList.remove("active");

  document.getElementById("section-scan").classList.add("hidden");
  document.getElementById("section-login").classList.add("hidden");
  document.getElementById("section-dashboard").classList.add("hidden");

  if (tab === 'scan') {
    document.getElementById("tab-scan").classList.add("active");
    document.getElementById("section-scan").classList.remove("hidden");
  } else {
    document.getElementById("tab-admin").classList.add("active");
    if (isAdmin) {
      document.getElementById("section-dashboard").classList.remove("hidden");
      renderAttendanceTable();
    } else {
      document.getElementById("section-login").classList.remove("hidden");
    }
  }
}

// Fitur Kamera & Scanner QR
async function startCamera() {
  const videoContainer = document.getElementById("video-container");
  videoContainer.style.display = "block";

  const constraints = { video: { facingMode: { ideal: "environment" } } };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      scanning = true;
      requestAnimationFrame(tick);
    };
  } catch (err) {
    alert("Akses kamera gagal: " + err.message);
  }
}

function tick() {
  if (video.readyState === video.HAVE_ENOUGH_DATA && scanning) {
    canvasElement.height = video.videoHeight;
    canvasElement.width = video.videoWidth;
    canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
    var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
    var code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data && !isProcessing) {
      kirimData(code.data);
    }
  }
  if (scanning) requestAnimationFrame(tick);
}

function kirimData(scannedResult) {
  isProcessing = true;
  resultBox.style.display = "block";
  resultBox.className = "";
  resultBox.style.background = "#f3e5f5";
  resultBox.style.color = "#4a148c";
  resultBox.style.borderLeft = "5px solid #ab47bc";
  resultBox.innerHTML = "⏳ Memproses data...";

  let nisn = scannedResult;
  if (nisn.includes("nisn=")) {
    nisn = nisn.split("nisn=")[1];
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const clientTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  fetch(`${SCRIPT_URL}?nisn=${encodeURIComponent(nisn)}&clientTime=${encodeURIComponent(clientTime)}`)
    .then(res => res.json())
    .then(data => {
      tampilkanHasil(data);
      setTimeout(() => { isProcessing = false; }, 3000);
    })
    .catch(() => {
      tampilkanHasil({ status: "error", message: "Gagal terhubung ke server!" });
      setTimeout(() => { isProcessing = false; }, 3000);
    });
}

function tampilkanHasil(res) {
  resultBox.style.display = "block";
  if (res.status === "success") {
    const isWarning = res.isWarning || (res.keterangan && res.keterangan.toLowerCase().includes("terlambat"));
    resultBox.style.background = isWarning ? "#ffe6e6" : "#e8f5e9";
    resultBox.style.color = isWarning ? "#990000" : "#1b5e20";
    resultBox.style.borderLeft = isWarning ? "5px solid #d9534f" : "5px solid #4caf50";

    resultBox.innerHTML = `
      <strong>STATUS: ${res.tipe || 'PRESENSI'}</strong><br>
      <b>NISN:</b> ${res.nisn}<br>
      <b>Nama:</b> ${res.nama}<br>
      <b>Kelas:</b> ${res.kelas}<br>
      <b>Waktu:</b> ${res.waktu}<br>
      <b>Keterangan:</b> ${res.keterangan}
    `;
  } else {
    resultBox.style.background = "#ffe6e6";
    resultBox.style.color = "#990000";
    resultBox.style.borderLeft = "5px solid #d9534f";
    resultBox.innerHTML = `<strong>GAGAL</strong><br>${res.message}`;
  }
}

// Authentikasi Admin
function handleLogin(e) {
  e.preventDefault();
  const pass = document.getElementById("admin-pass").value;
  if (pass === "SMKN1GUNUNGSINDUR") {
    isAdmin = true;
    switchTab('admin');
  } else {
    alert("Password Admin Salah!");
  }
}

function logoutAdmin() {
  isAdmin = false;
  document.getElementById("admin-pass").value = "";
  switchTab('scan');
}

// Memuat data presensi & statistik ke Dashboard
function renderAttendanceTable() {
  const selectedDate = document.getElementById("filter-date").value;
  const selectedKelas = document.getElementById("filter-kelas").value;
  const tbody = document.getElementById("table-body");
  
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">⏳ Mengambil data presensi...</td></tr>`;

  fetch(`${SCRIPT_URL}?action=readData&tanggal=${selectedDate}&kelas=${encodeURIComponent(selectedKelas)}`)
    .then(res => res.json())
    .then(response => {
      tbody.innerHTML = "";

      if (response.status === "success") {
        document.getElementById("statTotal").innerText = response.summary.total;
        document.getElementById("statHadir").innerText = response.summary.hadir;
        document.getElementById("statSakit").innerText = response.summary.sakit;
        document.getElementById("statIzin").innerText = response.summary.izin;
        document.getElementById("statAlpa").innerText = response.summary.alpa;

        if (response.data.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Tidak ada data siswa untuk kelas ini.</td></tr>`;
          return;
        }

        response.data.forEach(student => {
          const status = student.status;
          const ket = student.keterangan || "-";

          let badgeClass = "badge-alpa";
          if (status === "Hadir") badgeClass = "badge-hadir";
          if (status === "Sakit") badgeClass = "badge-sakit";
          if (status === "Izin") badgeClass = "badge-izin";

          const tr = document.createElement("tr");
          tr.innerHTML = `
  <td>${student.nisn}</td>
  <td><b>${student.nama}</b></td>
  <td>${student.kelas}</td>
  <td style="text-align:center; color: ${ket === 'Terlambat' ? '#d9534f' : 'inherit'}; font-weight: ${ket === 'Terlambat' ? 'bold' : 'normal'};">${student.jamMasuk}</td>
  <td style="text-align:center;">${student.jamKeluar}</td>
  <td style="text-align:center;"><span class="badge ${badgeClass}">${status}</span></td>
  <td style="text-align:center;"><b style="color: ${ket === 'Terlambat' ? '#d9534f' : '#2e7d32'}">${ket}</b></td>
  <td style="text-align:center;">
    <select onchange="setManualStatus('${student.nisn}', this.value)">
      <option value="Hadir" ${status === 'Hadir' ? 'selected' : ''}>Hadir</option>
      <option value="Sakit" ${status === 'Sakit' ? 'selected' : ''}>Sakit</option>
      <option value="Izin" ${status === 'Izin' ? 'selected' : ''}>Izin</option>
      <option value="Alpa" ${status === 'Alpa' ? 'selected' : ''}>Alpa</option>
    </select>
  </td>
`;
          tbody.appendChild(tr);
        });
      }
    })
    .catch(err => {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Gagal memuat data dari Spreadsheet.</td></tr>`;
      console.error(err);
    });
}

// Update Status Presensi Manual oleh Guru
function setManualStatus(nisn, status) {
  const selectedDate = document.getElementById("filter-date").value;
  
  fetch(`${SCRIPT_URL}?action=updateStatus&nisn=${encodeURIComponent(nisn)}&status=${encodeURIComponent(status)}&tanggal=${selectedDate}`)
    .then(res => res.json())
    .then(res => {
      if (res.status === "success") {
        renderAttendanceTable();
      }
    })
    .catch(err => console.error("Gagal mengupdate status:", err));
}