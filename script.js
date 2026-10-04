// ⚠️ MASUKKAN URL WEB APP GOOGLE APPS SCRIPT KAMU DI SINI ⚠️
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzdtWAIlALmldAcTY9LVLsZObDSY7_sGVfuVbIM7Vic0bLA7YBNK8HOMDkyGA2cK4a2VQ/exec";

const today = new Date();
document.getElementById('date').valueAsDate = today;
const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
document.getElementById('filterMonth').value = currentYearMonth;

document.getElementById('filterMonth').addEventListener('change', processAndRender);

// Load data dari LocalStorage secara instan agar aplikasi terbuka tanpa loading
let localData = JSON.parse(localStorage.getItem('kas_db_cache_v9')) || [];

if (localData.length > 0) processAndRender();
// Sinkronisasi data terbaru dari Google Sheets di background secara diam-diam
backgroundSync();

function toggleFormMode() {
    const type = document.getElementById('type').value;
    const targetContainer = document.getElementById('targetAccountContainer');
    const categoryInput = document.getElementById('category');
    const categoryContainer = document.getElementById('categoryContainer');
    const plannedContainer = document.getElementById('plannedContainer');
    const labelAccount = document.getElementById('labelAccount');

    if (type === 'Transfer') {
        targetContainer.classList.remove('hidden');
        categoryContainer.classList.add('hidden');
        plannedContainer.classList.add('hidden');
        categoryInput.required = false;
        categoryInput.value = "Tarik Tunai / Transfer";
        labelAccount.innerText = "Dari Akun Asal";
    } else {
        targetContainer.classList.add('hidden');
        categoryContainer.classList.remove('hidden');
        plannedContainer.classList.remove('hidden');
        categoryInput.required = true;
        categoryInput.value = "";
        labelAccount.innerText = "Sumber Uang (Dari Akun)";
    }
}

// Sinkronisasi background yang tidak mengganggu UI (tidak ada tulisan sync yang bikin lambat)
function backgroundSync() {
    fetch(SCRIPT_URL)
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            localData = data;
            localStorage.setItem('kas_db_cache_v9', JSON.stringify(data));
            processAndRender();
        }
    })
    .catch(err => console.log("Background sync pending..."));
}

document.getElementById('kasForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const type = document.getElementById('type').value;
    const isPlanned = type === 'Transfer' ? false : document.getElementById('isPlanned').checked;
    const deductPlanned = document.getElementById('deductPlanned').checked;
    const categoryInput = document.getElementById('category').value.trim();
    const inputAmount = Number(document.getElementById('amount').value);
    const newId = "TRX-" + Date.now();
    
    if (deductPlanned && type === 'Expense') {
        let foundPlanned = localData.find(item => {
            const c = String(getVal(item, ['Category', 'category'])).trim().toLowerCase();
            const s = String(getVal(item, ['Status', 'status'])).trim().toLowerCase();
            const t = String(getVal(item, ['Type', 'type'])).trim().toLowerCase();
            return c === categoryInput.toLowerCase() && s === 'pending' && t === 'expense';
        });

        if (!foundPlanned) {
            alert("⚠️ Tidak ada dalam transaksi pending untuk kategori '" + categoryInput + "'!");
            return;
        }

        const plannedId = getVal(foundPlanned, ['ID', 'id']);
        const currentPlannedAmt = Number(getVal(foundPlanned, ['Amount', 'amount'])) || 0;
        const updatedPlannedAmt = currentPlannedAmt - inputAmount;

        if (updatedPlannedAmt <= 0) {
            localData = localData.filter(item => String(getVal(item, ['ID', 'id'])) !== String(plannedId));
            navigator.sendBeacon(SCRIPT_URL, new URLSearchParams({ action: 'delete', id: plannedId }));
        } else {
            foundPlanned.Amount = updatedPlannedAmt;
            foundPlanned.amount = updatedPlannedAmt;
            navigator.sendBeacon(SCRIPT_URL, new URLSearchParams({ action: 'reducePlanned', id: plannedId, amount: updatedPlannedAmt }));
        }
    }

    const newData = {
        ID: newId,
        Date: document.getElementById('date').value,
        Type: type,
        Account: document.getElementById('account').value,
        TargetAccount: type === 'Transfer' ? document.getElementById('targetAccount').value : '',
        Category: type === 'Transfer' ? 'Tarik Tunai / Transfer' : categoryInput,
        Amount: inputAmount,
        IsPlanned: isPlanned ? "TRUE" : "FALSE",
        Status: isPlanned ? "Pending" : "Completed",
        Notes: document.getElementById('notes').value
    };

    // 🚀 OPTIMISTIC UI: Langsung masukkan ke local data dan render SEKETIKA tanpa menunggu server
    localData.push(newData);
    localStorage.setItem('kas_db_cache_v9', JSON.stringify(localData));
    
    this.reset();
    document.getElementById('date').valueAsDate = new Date();
    toggleFormMode();
    processAndRender();

    // Kirim data ke Google Sheets di background menggunakan sendBeacon / fetch non-blocking
    const params = new URLSearchParams();
    for (let key in newData) {
        params.append(key, newData[key]);
    }
    params.append('action', 'add');

    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: params
    }).catch(err => console.log("Gagal sync online, data aman di lokal."));
});

function completeTransaction(id) {
    if (!confirm("Selesaikan/tutup transaksi terencana ini? Sisa anggaran tidak akan dihitung sebagai pengeluaran dan pending akan ditutup.")) return;

    localData = localData.filter(item => String(getVal(item, ['ID', 'id'])) !== String(id));
    localStorage.setItem('kas_db_cache_v9', JSON.stringify(localData));
    processAndRender();

    const params = new URLSearchParams();
    params.append('action', 'delete');
    params.append('id', id);

    fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
}

function deleteTransaction(id) {
    if (!confirm("Yakin ingin menghapus transaksi ini?")) return;

    localData = localData.filter(item => String(getVal(item, ['ID', 'id'])) !== String(id));
    localStorage.setItem('kas_db_cache_v9', JSON.stringify(localData));
    processAndRender();

    const params = new URLSearchParams();
    params.append('action', 'delete');
    params.append('id', id);

    fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
}

function getVal(item, keys) {
    for (let k of keys) {
        if (item[k] !== undefined && item[k] !== null && item[k] !== "") return item[k];
    }
    return "";
}

function processAndRender() {
    const selectedMonth = document.getElementById('filterMonth').value;
    const periodElem = document.getElementById('printPeriod');
    if(periodElem) periodElem.innerText = `Periode Bulan: ${selectedMonth}`;
    
    const walletContainer = document.getElementById('walletSummary');
    const accountHistoryContainer = document.getElementById('accountHistoryContainer');
    if(!walletContainer || !accountHistoryContainer) return;

    walletContainer.innerHTML = '';
    accountHistoryContainer.innerHTML = '';

    let totalIncome = 0;
    let totalExpense = 0;
    let totalPlanned = 0;
    const wallets = ["Tunai", "GoPay", "DANA", "Seabank", "BRI", "Mandiri"];
    let walletBalances = { "Tunai": 0, "GoPay": 0, "DANA": 0, "Seabank": 0, "BRI": 0, "Mandiri": 0 };
    let walletMonthlyStats = {};
    wallets.forEach(w => {
        walletMonthlyStats[w] = { income: 0, expense: 0 };
    });
    
    let walletTransactions = {};
    wallets.forEach(w => {
        walletTransactions[w] = { income: [], expense: [] };
    });

    localData.forEach(item => {
        const amt = Number(getVal(item, ['Amount', 'amount', 'AMOUNT'])) || 0;
        const acc = getVal(item, ['Account', 'account', 'ACCOUNT']) || 'Tunai';
        const targetAcc = getVal(item, ['TargetAccount', 'targetAccount', 'TARGETACCOUNT']) || '';
        const type = String(getVal(item, ['Type', 'type', 'TYPE'])).toLowerCase();
        const status = String(getVal(item, ['Status', 'status', 'STATUS'])).toLowerCase();
        const dateStr = String(getVal(item, ['Date', 'date', 'DATE']));
        const itemMonth = dateStr.length >= 7 ? dateStr.substring(0, 7) : "";

        if (status === 'completed') {
            if (type === 'income') {
                if (walletBalances[acc] !== undefined) walletBalances[acc] += amt;
                if (itemMonth === selectedMonth && walletMonthlyStats[acc]) walletMonthlyStats[acc].income += amt;
            } else if (type === 'expense') {
                if (walletBalances[acc] !== undefined) walletBalances[acc] -= amt;
                if (itemMonth === selectedMonth && walletMonthlyStats[acc]) walletMonthlyStats[acc].expense += amt;
            } else if (type === 'transfer') {
                if (walletBalances[acc] !== undefined) walletBalances[acc] -= amt;
                if (walletBalances[targetAcc] !== undefined) walletBalances[targetAcc] += amt;
                if (itemMonth === selectedMonth) {
                    if (walletMonthlyStats[acc]) walletMonthlyStats[acc].expense += amt;
                    if (walletMonthlyStats[targetAcc]) walletMonthlyStats[targetAcc].income += amt;
                }
            }
        }
    });

    localData.forEach(item => {
        const dateStr = String(getVal(item, ['Date', 'date', 'DATE']));
        const itemMonth = dateStr.length >= 7 ? dateStr.substring(0, 7) : "";

        if (itemMonth === selectedMonth) {
            const amt = Number(getVal(item, ['Amount', 'amount'])) || 0;
            const type = String(getVal(item, ['Type', 'type'])).toLowerCase();
            const status = String(getVal(item, ['Status', 'status'])).toLowerCase();
            const acc = getVal(item, ['Account', 'account']) || 'Tunai';
            const targetAcc = getVal(item, ['TargetAccount', 'targetAccount']) || '';

            if (status === 'completed') {
                if (type === 'income') totalIncome += amt;
                else if (type === 'expense') totalExpense += amt;
            } else if (status === 'pending') {
                totalPlanned += amt;
            }

            if (type === 'income') {
                if (walletTransactions[acc]) walletTransactions[acc].income.push(item);
            } else if (type === 'expense') {
                if (walletTransactions[acc]) walletTransactions[acc].expense.push(item);
            } else if (type === 'transfer') {
                if (walletTransactions[acc]) {
                    let cloneOut = Object.assign({}, item);
                    cloneOut.transferLabel = `Kirim ke ${targetAcc}`;
                    walletTransactions[acc].expense.push(cloneOut);
                }
                if (walletTransactions[targetAcc]) {
                    let cloneIn = Object.assign({}, item);
                    cloneIn.transferLabel = `Terima dari ${acc}`;
                    walletTransactions[targetAcc].income.push(cloneIn);
                }
            }
        }
    });

    document.getElementById('repIncome').innerText = 'Rp ' + totalIncome.toLocaleString('id-ID');
    document.getElementById('repExpense').innerText = 'Rp ' + totalExpense.toLocaleString('id-ID');
    document.getElementById('repPlanned').innerText = 'Rp ' + totalPlanned.toLocaleString('id-ID');
    const netBalance = totalIncome - totalExpense;
    document.getElementById('repBalance').innerText = 'Rp ' + netBalance.toLocaleString('id-ID');

    wallets.forEach(wallet => {
        const bal = walletBalances[wallet];
        const stats = walletMonthlyStats[wallet] || { income: 0, expense: 0 };
        const div = document.createElement('div');
        div.className = "bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5 text-xs";
        div.innerHTML = `
            <div class="flex justify-between items-center font-bold">
                <span class="text-slate-700">${wallet}</span>
                <span class="${bal < 0 ? 'text-rose-600' : 'text-slate-900'}">Rp ${bal.toLocaleString('id-ID')}</span>
            </div>
            <div class="grid grid-cols-2 gap-1 text-[10px] pt-1 border-t border-slate-200/50">
                <div class="text-emerald-600">Masuk: +Rp ${stats.income.toLocaleString('id-ID')}</div>
                <div class="text-rose-600 text-right">Keluar: -Rp ${stats.expense.toLocaleString('id-ID')}</div>
            </div>
        `;
        walletContainer.appendChild(div);
    });

    wallets.forEach(wallet => {
        const dataInc = walletTransactions[wallet].income;
        const dataExp = walletTransactions[wallet].expense;

        if (dataInc.length === 0 && dataExp.length === 0) return;

        const accountCard = document.createElement('div');
        accountCard.className = "bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/60 space-y-3";
        
        let htmlContent = `
            <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 class="text-xs font-bold uppercase text-slate-800">👛 Akun: ${wallet}</h3>
                <span class="text-[11px] font-semibold text-slate-500">Saldo: <span class="font-bold text-slate-800">Rp ${walletBalances[wallet].toLocaleString('id-ID')}</span></span>
            </div>
        `;

        htmlContent += `
            <div>
                <h4 class="text-[11px] font-bold text-emerald-600 mb-1.5 flex items-center space-x-1">
                    <span>🟢 Pemasukan (${dataInc.length})</span>
                </h4>
        `;
        if (dataInc.length === 0) {
            htmlContent += `<p class="text-[10px] text-slate-400 italic py-1">Tidak ada pemasukan.</p>`;
        } else {
            htmlContent += `<div class="space-y-1.5">`;
            dataInc.slice().reverse().forEach(item => {
                const id = getVal(item, ['ID', 'id']);
                const category = getVal(item, ['Category', 'category']);
                const amount = Number(getVal(item, ['Amount', 'amount'])) || 0;
                const date = getVal(item, ['Date', 'date']);
                const notes = getVal(item, ['Notes', 'notes']);
                const tLabel = item.transferLabel || category;

                htmlContent += `
                    <div class="flex justify-between items-center p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs">
                        <div>
                            <div class="font-bold text-slate-800">${tLabel}</div>
                            <div class="text-[10px] text-slate-400">${date} ${notes ? '• ' + notes : ''}</div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <div class="font-black text-emerald-600">+ Rp ${amount.toLocaleString('id-ID')}</div>
                            <button onclick="deleteTransaction('${id}')" class="text-rose-500 hover:text-rose-700 bg-white p-1 rounded active:scale-95 no-print" title="Hapus">🗑️</button>
                        </div>
                    </div>
                `;
            });
            htmlContent += `</div>`;
        }
        htmlContent += `</div>`;

        htmlContent += `
            <div class="pt-2 border-t border-slate-100">
                <h4 class="text-[11px] font-bold text-rose-600 mb-1.5 flex items-center space-x-1">
                    <span>🔴 Pengeluaran (${dataExp.length})</span>
                </h4>
        `;
        if (dataExp.length === 0) {
            htmlContent += `<p class="text-[10px] text-slate-400 italic py-1">Tidak ada pengeluaran.</p>`;
        } else {
            htmlContent += `<div class="space-y-1.5">`;
            dataExp.slice().reverse().forEach(item => {
                const id = getVal(item, ['ID', 'id']);
                const category = getVal(item, ['Category', 'category']);
                const amount = Number(getVal(item, ['Amount', 'amount'])) || 0;
                const status = String(getVal(item, ['Status', 'status'])).toLowerCase();
                const date = getVal(item, ['Date', 'date']);
                const notes = getVal(item, ['Notes', 'notes']);
                const isPending = status === 'pending';
                const tLabel = item.transferLabel || category;

                htmlContent += `
                    <div class="flex justify-between items-center p-2 rounded-xl bg-rose-50/50 border border-rose-100 text-xs">
                        <div>
                            <div class="font-bold text-slate-800">
                                ${tLabel} ${isPending ? '<span class="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Pending</span>' : ''}
                            </div>
                            <div class="text-[10px] text-slate-400">${date} ${notes ? '• ' + notes : ''}</div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <div class="font-black text-rose-600">- Rp ${amount.toLocaleString('id-ID')}</div>
                            <div class="flex space-x-1 no-print">
                                ${isPending ? `<button onclick="completeTransaction('${id}')" class="text-emerald-600 hover:text-emerald-700 bg-white p-1 rounded active:scale-95" title="Selesaikan / Tutup Pending">✅</button>` : ''}
                                <button onclick="deleteTransaction('${id}')" class="text-rose-500 hover:text-rose-700 bg-white p-1 rounded active:scale-95" title="Hapus">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            htmlContent += `</div>`;
        }
        htmlContent += `</div>`;

        accountCard.innerHTML = htmlContent;
        accountHistoryContainer.appendChild(accountCard);
    });

    if (accountHistoryContainer.children.length === 0) {
        accountHistoryContainer.innerHTML = '<div class="text-xs text-slate-400 text-center py-4 bg-white rounded-2xl border border-slate-200/60">Tidak ada transaksi pada bulan ini.</div>';
    }
}