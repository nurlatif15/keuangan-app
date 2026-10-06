
// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbwchMXWh0taQupnBpPaxZLSDXKLnQGY8nWWXEFDF5NKOOjzWxc9xD9EA-8RnuY5RYQ/exec";

let globalData = [];

document.addEventListener("DOMContentLoaded", () => {
    // Set default tanggal hari ini
    const dateInput = document.getElementById("date");
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Set default filter bulan ke bulan aktif saat ini (YYYY-MM)
    const filterMonth = document.getElementById("filterMonth");
    if (filterMonth) {
        filterMonth.value = new Date().toISOString().slice(0, 7);
        filterMonth.addEventListener("change", renderApp);
    }

    // Event listener form submit
    const kasForm = document.getElementById("kasForm");
    if (kasForm) {
        kasForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await handleSubmitTransaction();
        });
    }

    // Ambil data pertama kali
    refreshData();
});

// Fungsi toggle tampilan form mode (Income, Expense, Transfer)
function toggleFormMode() {
    const type = document.getElementById("type").value;
    const targetContainer = document.getElementById("targetAccountContainer");
    const plannedContainer = document.getElementById("plannedContainer");
    const labelAccount = document.getElementById("labelAccount");

    if (type === "Transfer") {
        targetContainer.classList.remove("hidden");
        plannedContainer.classList.add("hidden");
        labelAccount.textContent = "Sumber Uang (Dari Akun Pengirim)";
    } else {
        targetContainer.classList.add("hidden");
        plannedContainer.classList.remove("hidden");
        labelAccount.textContent = "Sumber Uang (Dari Akun)";
    }
}

// Fungsi Ambil Data dari Google Apps Script
async function refreshData() {
    const syncBtn = document.getElementById("syncBtn");
    if (syncBtn) syncBtn.textContent = "⏳ Memuat...";

    try {
        let response = await fetch(API_URL);
        if (!response.ok) throw new Error("Gagal terhubung ke database.");
        
        let result = await response.json();
        if (result.error) throw new Error(result.error);

        globalData = result.transactions || [];
        renderApp();

        if (syncBtn) syncBtn.textContent = "🔄 Sinkron";
    } catch (error) {
        console.error("Error:", error);
        if (syncBtn) syncBtn.textContent = "❌ Gagal";
        document.getElementById("accountHistoryContainer").innerHTML = `
            <div class="text-xs text-rose-500 text-center py-4 bg-white rounded-xl border border-rose-100">
                Gagal memuat data. Cek koneksi atau URL API Anda.
            </div>`;
    }
}

// Fungsi Utama Render UI berdasarkan Filter Bulan
function renderApp() {
    const selectedMonth = document.getElementById("filterMonth") ? document.getElementById("filterMonth").value : "";
    
    let filteredTransactions = globalData;
    if (selectedMonth) {
        filteredTransactions = globalData.filter(item => item.Date && String(item.Date).startsWith(selectedMonth));
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let totalPlanned = 0;
    let walletBalances = {};
    let walletMonthlyStats = {}; // Statistik masuk/keluar per akun sesuai bulan yang dipilih

    // 1. Hitung saldo keseluruhan dompet dari SEMUA data (akumulasi saldo real)
    globalData.forEach(item => {
        let amt = parseFloat(item.Amount) || 0;
        let type = String(item.Type).toLowerCase();
        let acc = item.Account ? String(item.Account).trim() : "Tunai";
        let targetAcc = item.TargetAccount ? String(item.TargetAccount).trim() : "";
        let isPlanned = String(item.IsPlanned).toUpperCase() === "TRUE";

        if (!walletBalances[acc]) walletBalances[acc] = 0;
        if (targetAcc && !walletBalances[targetAcc]) walletBalances[targetAcc] = 0;

        if (type.includes("income")) {
            walletBalances[acc] += amt;
        } else if (type.includes("expense")) {
            if (!isPlanned) walletBalances[acc] -= amt;
        } else if (type.includes("transfer")) {
            walletBalances[acc] -= amt;
            if (targetAcc) walletBalances[targetAcc] += amt;
        }
    });

    // 2. Hitung statistik Masuk & Keluar per Akun HANYA untuk bulan yang sedang dipilih
    filteredTransactions.forEach(item => {
        let amt = parseFloat(item.Amount) || 0;
        let type = String(item.Type).toLowerCase();
        let acc = item.Account ? String(item.Account).trim() : "Tunai";
        let targetAcc = item.TargetAccount ? String(item.TargetAccount).trim() : "";
        let isPlanned = String(item.IsPlanned).toUpperCase() === "TRUE";

        if (!walletMonthlyStats[acc]) walletMonthlyStats[acc] = { income: 0, expense: 0 };
        if (targetAcc && !walletMonthlyStats[targetAcc]) walletMonthlyStats[targetAcc] = { income: 0, expense: 0 };

        if (type.includes("income")) {
            walletMonthlyStats[acc].income += amt;
        } else if (type.includes("expense")) {
            if (!isPlanned) {
                walletMonthlyStats[acc].expense += amt;
            }
        } else if (type.includes("transfer")) {
            // Transfer keluar dari akun sumber dihitung sebagai mutasi keluar bulan ini
            walletMonthlyStats[acc].expense += amt;
            // Transfer masuk ke akun tujuan dihitung sebagai mutasi masuk bulan ini
            if (targetAcc) {
                walletMonthlyStats[targetAcc].income += amt;
            }
        }

        // Hitung total laporan bulanan utama
        if (type.includes("income")) {
            totalIncome += amt;
        } else if (type.includes("expense")) {
            if (isPlanned) {
                totalPlanned += amt;
            } else {
                totalExpense += amt;
            }
        }
    });

    let netBalance = totalIncome - totalExpense;

    // Tampilkan ke kartu laporan utama
    document.getElementById("repIncome").textContent = `Rp ${totalIncome.toLocaleString('id-ID')}`;
    document.getElementById("repExpense").textContent = `Rp ${totalExpense.toLocaleString('id-ID')}`;
    document.getElementById("repPlanned").textContent = `Rp ${totalPlanned.toLocaleString('id-ID')}`;
    document.getElementById("repBalance").textContent = `Rp ${netBalance.toLocaleString('id-ID')}`;
    
    const printPeriod = document.getElementById("printPeriod");
    if (printPeriod) printPeriod.textContent = `Periode: ${selectedMonth || 'Semua Waktu'}`;

    // 3. Render Kartu Saldo & Rincian Bulanan Per Dompet / Akun
    const walletContainer = document.getElementById("walletSummary");
    walletContainer.innerHTML = "";
    
    let allWallets = [...new Set([...Object.keys(walletBalances), ...Object.keys(walletMonthlyStats)])];

    if (allWallets.length === 0) {
        walletContainer.innerHTML = `<div class="text-xs text-slate-400 col-span-2">Belum ada data dompet.</div>`;
    } else {
        allWallets.forEach(dompet => {
            let saldo = walletBalances[dompet] || 0;
            let mStats = walletMonthlyStats[dompet] || { income: 0, expense: 0 };
            
            walletContainer.innerHTML += `
                <div class="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex flex-col space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-[11px] font-bold text-slate-700 uppercase">${dompet}</span>
                        <span class="text-[10px] text-slate-400">Saldo: <b class="${saldo >= 0 ? 'text-slate-900' : 'text-rose-600'}">Rp ${saldo.toLocaleString('id-ID')}</b></span>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200/70 text-[10px]">
                        <div class="bg-emerald-50/80 text-emerald-800 p-1.5 rounded-lg border border-emerald-100">
                            <span class="block text-[9px] opacity-75 font-medium">Masuk (Bulan Ini)</span>
                            <span class="font-bold">+Rp ${mStats.income.toLocaleString('id-ID')}</span>
                        </div>
                        <div class="bg-rose-50/80 text-rose-800 p-1.5 rounded-lg border border-rose-100">
                            <span class="block text-[9px] opacity-75 font-medium">Keluar (Bulan Ini)</span>
                            <span class="font-bold">-Rp ${mStats.expense.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // 4. Render Histori Per Akun
    renderAccountHistory(filteredTransactions);
}

// Render Rincian Histori Berdasarkan Akun
function renderAccountHistory(transactions) {
    const container = document.getElementById("accountHistoryContainer");
    container.innerHTML = "";

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-400 text-center py-4 bg-white rounded-xl">Tidak ada transaksi pada periode ini.</div>`;
        return;
    }

    let grouped = {};
    transactions.forEach(item => {
        let acc = item.Account ? String(item.Account).trim() : "Tunai";
        if (!grouped[acc]) grouped[acc] = [];
        grouped[acc].push(item);
    });

    for (let accName in grouped) {
        let items = grouped[accName];
        items.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        let htmlCard = `
            <div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/60 space-y-2">
                <div class="font-bold text-xs text-blue-900 border-b pb-1.5 flex justify-between items-center">
                    <span>📁 Akun: ${accName.toUpperCase()}</span>
                    <span class="text-[10px] text-slate-400 font-normal">${items.length} Transaksi</span>
                </div>
                <div class="space-y-1.5">
        `;

        items.forEach(item => {
            let cleanDate = item.Date ? String(item.Date).split('T')[0] : '';
            let type = String(item.Type).toLowerCase();
            let amt = parseFloat(item.Amount) || 0;
            let isIncome = type.includes("income");
            let isTransfer = type.includes("transfer");
            let target = item.TargetAccount ? ` ➡️ ${item.TargetAccount}` : "";
            
            let sign = isIncome ? "+" : (isTransfer ? "🔄" : "-");
            let colorClass = isIncome ? "text-emerald-600 bg-emerald-50" : (isTransfer ? "text-blue-600 bg-blue-50" : "text-rose-600 bg-rose-50");

            htmlCard += `
                <div class="flex justify-between items-center p-2 rounded-xl bg-slate-50/70 text-xs">
                    <div>
                        <div class="font-semibold text-slate-800">${item.Category || item.Notes || 'Transaksi'} ${target}</div>
                        <div class="text-[10px] text-slate-400">${cleanDate} ${item.Notes ? '• ' + item.Notes : ''}</div>
                    </div>
                    <div class="font-bold ${colorClass} px-2 py-1 rounded-lg">
                        ${sign} Rp ${amt.toLocaleString('id-ID')}
                    </div>
                </div>
            `;
        });

        htmlCard += `</div></div>`;
        container.innerHTML += htmlCard;
    }
}

// Fungsi Kirim Form Transaksi Baru ke Backend
async function handleSubmitTransaction() {
    const btnSubmit = document.getElementById("btnSubmit");
    btnSubmit.textContent = "Menyimpan...";
    btnSubmit.disabled = true;

    let payload = {
        type: document.getElementById("type").value,
        date: document.getElementById("date").value,
        account: document.getElementById("account").value,
        targetAccount: document.getElementById("targetAccount").value,
        category: document.getElementById("category").value.trim(),
        amount: parseFloat(document.getElementById("amount").value) || 0,
        isPlanned: document.getElementById("isPlanned").checked,
        notes: document.getElementById("notes").value.trim()
    };

    try {
        let response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        let result = await response.json();
        if (result.status === "success") {
            alert("Berhasil menyimpan transaksi!");
            document.getElementById("kasForm").reset();
            document.getElementById("date").value = new Date().toISOString().split('T')[0];
            toggleFormMode();
            await refreshData();
        } else {
            throw new Error(result.message || "Gagal menyimpan.");
        }
    } catch (error) {
        console.error("Gagal simpan:", error);
        alert("Terjadi kesalahan: " + error.message);
    } finally {
        btnSubmit.textContent = "Simpan Transaksi ⚡";
        btnSubmit.disabled = false;
    }
}
