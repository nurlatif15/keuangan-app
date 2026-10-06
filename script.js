// Ganti dengan URL Web App dari Google Apps Script Anda yang baru
const API_URL = "https://script.google.com/macros/s/AKfycbyYsv4apS0aGEbUkrM1CBmC0eFuZk9YEnU2RYHUqVeYEEuxssGx2nIkD2xWwasIsxhYWQ/exec";

document.addEventListener("DOMContentLoaded", () => {
    console.log("Website dimuat, mulai mengambil data...");
    muatDataKas();

    // Hubungkan tombol Sinkron di pojok kanan atas
    const btnSinkron = document.querySelector('button:has-text("Sinkron")') || document.querySelector('.btn-sinkron');
    if (btnSinkron) {
        btnSinkron.addEventListener('click', (e) => {
            e.preventDefault();
            muatDataKas();
        });
    }
});

async function muatDataKas() {
    const infoMuat = document.querySelector("#rincian-histori") || document.querySelector("body");
    
    try {
        console.log("Mengambil data dari Apps Script...");
        let response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        let dataTransaksi = await response.json();
        console.log("Data berhasil diterima:", dataTransaksi);

        if (dataTransaksi.error) {
            alert("Error dari Spreadsheet: " + dataTransaksi.error);
            return;
        }

        // PANGGIL FUNGSI RENDER UTAMA ANDA DI SINI
        // (Ganti 'tampilkanKeWeb' dengan fungsi yang biasa Anda pakai untuk merender data ke HTML)
        if (typeof renderKeWeb === "function") {
            renderKeWeb(dataTransaksi);
        } else {
            console.warn("Fungsi renderKeWeb belum didefinisikan, data hanya tampil di Console.");
            // Hapus teks "Memuat data..." secara paksa jika elemennya ada
            let elMemuat = [...document.querySelectorAll('*')].find(el => el.textContent.includes('Memuat data...'));
            if (elMemuat) elMemuat.innerHTML = `<p style="color: green; text-align: center;">Data berhasil diambil! (${dataTransaksi.length} transaksi)</p>`;
        }

    } catch (error) {
        console.error("Gagal mengambil data:", error);
        alert("Gagal memuat data kas. Periksa console browser (F12) untuk detail error.");
        
        let elMemuat = [...document.querySelectorAll('*')].find(el => el.textContent.includes('Memuat data...'));
        if (elMemuat) elMemuat.innerHTML = `<p style="color: red; text-align: center;">Gagal memuat data. Cek koneksi / URL API.</p>`;
    }
}
