// Ganti dengan URL Web App dari Google Apps Script Anda yang baru
const API_URL = "https://script.google.com/macros/s/AKfycbyYsv4apS0aGEbUkrM1CBmC0eFuZk9YEnU2RYHUqVeYEEuxssGx2nIkD2xWwasIsxhYWQ/exec";

document.addEventListener("DOMContentLoaded", () => {
    // Jalankan sinkronisasi otomatis saat halaman pertama dibuka
    ambilDanTampilkanData();

    // Hubungkan tombol "Sinkron" di pojok kanan atas website Anda
    // (Sesuaikan selector class/id tombol sinkron di HTML Anda jika berbeda, misal: '#btn-sinkron' atau '.btn-sinkron')
    const btnSinkron = document.querySelector('button:has-text("Sinkron")') || document.querySelector('.btn-sinkron');
    if (btnSinkron) {
        btnSinkron.addEventListener('click', (e) => {
            e.preventDefault();
            ambilDanTampilkanData(true);
        });
    }
});

async function ambilDanTampilkanData(isManual = false) {
    if (isManual) alert("Menyinkronkan data dengan Google Spreadsheet...");

    try {
        let response = await fetch(API_URL);
        if (!response.ok) throw new Error("Gagal terhubung ke server API.");
        
        let dataTransaksi = await response.json();
        
        if (dataTransaksi.error) {
            alert("Error dari Spreadsheet: " + dataTransaksi.error);
            return;
        }

        console.log("Data Berhasil Disinkronkan:", dataTransaksi);

        // Render atau tampilkan data ke elemen HTML website kas Anda
        renderDataKeHTML(dataTransaksi);

        if (isManual) alert("Sinkronisasi Berhasil!");

    } catch (error) {
        console.error("Kesalahan Sinkronisasi:", error);
        if (isManual) alert("Gagal menyinkronkan data. Periksa koneksi internet Anda.");
    }
}

function renderDataKeHTML(transactions) {
    // CONTOH LOGIKA RENDER KE WEB KAS ANDA:
    // transactions berisi array objek dari spreadsheet (ID, Date, Type, Category, Amount, IsPlanned, Status, Notes, Account)
    
    // 1. Hitung Saldo / Tampilkan list per akun (Tunai, Seabank, BRI, dll)
    // 2. Masukkan ke dalam DOM HTML (tabel atau card rincian transaksi)
    
    // Contoh sederhana debugging di console:
    transactions.forEach(trx => {
        console.log(`[${trx.Account}] ${trx.Type}: ${trx.Category} - Rp ${trx.Amount} (${trx.Date})`);
    });

    // SILAKAN SESUAIKAN kode manipulasi DOM di bawah ini dengan struktur HTML website Anda yang sudah ada
}
