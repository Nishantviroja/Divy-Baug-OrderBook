document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const ITEM_TYPES = [
        { name: 'જામફળ (Guava)', options: ['1.2 KG', '3 KG'], emoji: '🍐', key: 'jamfal' },
        { name: 'ટેટી (Muskmelon)', options: ['5 KG', '10 KG'], emoji: '🍈', key: 'teti' },
        { name: 'Moringa', options: [], emoji: '🌿', key: 'moringa' }
    ];

    // DOM Elements
    const form = document.getElementById('orderForm');
    const openFormBtn = document.getElementById('openFormBtn');
    const closeFormBtn = document.getElementById('closeFormBtn');
    const formOverlay = document.getElementById('formOverlay');
    const formModalTitle = document.getElementById('formModalTitle');
    const addItemBtn = document.getElementById('addItemBtn');
    const itemsList = document.getElementById('itemsList');
    const porterSwitch = document.getElementById('porterSwitch');
    const ordersTableBody = document.getElementById('ordersTableBody');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const whatsappOverlay = document.getElementById('whatsappOverlay');
    const whatsappOutput = document.getElementById('whatsappOutput');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const copyWhatsappBtn = document.getElementById('copyWhatsappBtn');
    const clearBtn = document.getElementById('clearBtn');
    const printBtn = document.getElementById('printBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const modalCopyBtn = document.getElementById('modalCopyBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
    const toast = document.getElementById('toast');

    let orders = JSON.parse(localStorage.getItem('pms_orders')) || [];
    let editingOrderId = null;
    let deletingOrderId = null;

    // --- Core Functions ---

    function saveToLocale() {
        localStorage.setItem('pms_orders', JSON.stringify(orders));
        renderOrders();
    }

    function getAggregatedDisplay(items) {
        const agg = { jamfal: {}, teti: {}, moringa: {} };
        items.forEach(it => {
            const config = ITEM_TYPES.find(c => c.name === it.name);
            if (config) {
                const qKey = it.qty || 'default';
                agg[config.key][qKey] = (agg[config.key][qKey] || 0) + it.unit;
            }
        });

        const format = (obj) => {
            const lines = [];
            for (const qty in obj) {
                if (qty === 'default') {
                    if (obj[qty] > 0) lines.push(obj[qty]);
                } else {
                    if (obj[qty] > 0) lines.push(obj[qty] > 1 ? `${qty} * ${obj[qty]}` : qty);
                }
            }
            return lines.join('\n');
        };

        return {
            jamfal: format(agg.jamfal),
            teti: format(agg.teti),
            moringa: format(agg.moringa)
        };
    }

    function generateOrderId() {
        if (orders.length === 0) return 1;
        return Math.max(...orders.map(o => o.id)) + 1;
    }

    function createItemRow(existingData = null) {
        const row = document.createElement('div');
        row.className = 'item-row';

        row.innerHTML = `
            <div class="input-group">
                <label>Item Name</label>
                <select class="item-name">
                    ${ITEM_TYPES.map(it => `<option value="${it.name}">${it.name}</option>`).join('')}
                </select>
            </div>
            <div class="input-group item-unit-group">
                <label>Unit</label>
                <select class="item-unit">
                    ${[...Array(11).keys()].map(i => `<option value="${i}">${i}</option>`).join('')}
                </select>
            </div>
            <div class="input-group item-qty-group">
                <label>Quantity</label>
                <select class="item-qty"></select>
            </div>
            <button type="button" class="btn-remove"><i class="fa-solid fa-trash-can"></i></button>
        `;

        const nameSelect = row.querySelector('.item-name');
        const unitSelect = row.querySelector('.item-unit');
        const qtySelect = row.querySelector('.item-qty');
        const qtyGroup = row.querySelector('.item-qty-group');
        const removeBtn = row.querySelector('.btn-remove');

        function updateQuantities() {
            const selected = ITEM_TYPES.find(it => it.name === nameSelect.value);
            qtySelect.innerHTML = '';
            if (selected.options.length === 0) {
                qtyGroup.style.display = 'none';
            } else {
                qtyGroup.style.display = 'flex';
                selected.options.forEach(q => {
                    const opt = document.createElement('option');
                    opt.value = q; opt.textContent = q;
                    qtySelect.appendChild(opt);
                });
                if (nameSelect.value === 'ટેટી (Muskmelon)') {
                    qtySelect.selectedIndex = selected.options.length - 1;
                }
            }
        }

        nameSelect.addEventListener('change', updateQuantities);
        removeBtn.onclick = () => row.remove();

        if (existingData) {
            nameSelect.value = existingData.name;
            updateQuantities();
            unitSelect.value = existingData.unit;
            if (existingData.qty) qtySelect.value = existingData.qty;
        } else {
            updateQuantities();
        }

        return row;
    }

    function renderOrders() {
        ordersTableBody.innerHTML = '';

        // Stats aggregation
        let totalOrders = orders.length;
        const itemStats = {};

        // Initialize with all items even if 0
        ITEM_TYPES.forEach(it => {
            const itemName = it.name.split(' (')[0];
            itemStats[itemName] = {
                emoji: it.emoji,
                quantities: {}
            };
            if (it.options.length === 0) {
                itemStats[itemName].quantities['Units'] = 0;
            } else {
                it.options.forEach(opt => {
                    itemStats[itemName].quantities[opt] = 0;
                });
            }
        });

        orders.forEach(order => {
            const tr = document.createElement('tr');
            const agg = getAggregatedDisplay(order.items);

            // Track stats logic for dashboard
            order.items.forEach(it => {
                const config = ITEM_TYPES.find(c => c.name === it.name);
                if (config) {
                    const itemName = it.name.split(' (')[0];
                    const qKey = it.qty || 'Units';
                    itemStats[itemName].quantities[qKey] = (itemStats[itemName].quantities[qKey] || 0) + it.unit;
                }
            });

            tr.style.cursor = 'pointer';
            tr.onclick = (e) => {
                // If the user clicked a button or its icon, don't open WhatsApp
                if (e.target.closest('.action-btn')) return;
                showWhatsapp(order.id);
            };

            tr.innerHTML = `
                <td>${order.id}</td>
                <td>${order.name}</td>
                <td>${order.contact}</td>
                <td style="white-space: pre-wrap">${agg.jamfal || '-'}</td>
                <td style="white-space: pre-wrap">${agg.teti || '-'}</td>
                <td style="white-space: pre-wrap">${agg.moringa || '-'}</td>
                <td>${order.comment || '-'}</td>
                <td>
                    <div class="actions-cell">
                        <button class="action-btn" onclick="event.stopPropagation(); editOrder(${order.id})" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="action-btn" onclick="event.stopPropagation(); openDeleteModal(${order.id})" title="Delete/Copy"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            ordersTableBody.appendChild(tr);
        });

        // Update UI Stats
        const statsList = document.getElementById('itemStatsList');
        statsList.innerHTML = '';

        Object.keys(itemStats).forEach(itemName => {
            const stats = itemStats[itemName];
            const card = document.createElement('div');
            card.className = 'item-stats-card';

            let html = `<h4>${stats.emoji} ${itemName}</h4>`;
            Object.keys(stats.quantities).forEach(qty => {
                html += `
                    <div class="item-stat-row">
                        <span class="qty-label">${qty}</span>
                        <span class="unit-val">${stats.quantities[qty]}</span>
                    </div>
                `;
            });

            card.innerHTML = html;
            statsList.appendChild(card);
        });
    }

    // --- Global Handlers (for onclick) ---
    window.openDeleteModal = (id) => {
        deletingOrderId = id;
        deleteConfirmOverlay.querySelector('p').textContent = 'Are you sure you want to delete this order? This action cannot be undone.';
        modalCopyBtn.style.display = 'flex';
        deleteConfirmOverlay.classList.remove('hidden');
    };

    window.copySingleOrder = (id) => {
        const o = orders.find(x => x.id === id);
        if (!o) return;

        const agg = getAggregatedDisplay(o.items);
        const row = [
            o.id, o.name, o.contact,
            `"${agg.jamfal || '-'}"`,
            `"${agg.teti || '-'}"`,
            `"${agg.moringa || '-'}"`,
            o.comment || ''
        ].join('\t');

        navigator.clipboard.writeText(row).then(() => showToast('Order row copied!'));
    };

    window.editOrder = (id) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        editingOrderId = id;
        document.getElementById('customerName').value = order.name;
        document.getElementById('contactNo').value = order.contact;
        porterSwitch.checked = order.comment === 'Porter';

        itemsList.innerHTML = '';
        order.items.forEach(it => {
            itemsList.appendChild(createItemRow(it));
        });

        document.getElementById('submitBtn').innerHTML = 'Update Order <i class="fa-solid fa-pen-to-square"></i>';
        formModalTitle.textContent = 'Edit Order Details';
        formOverlay.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.showWhatsapp = (id) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const lines = [`*ORDER CONFIRM ✅*`, ``, `Order Id: ${order.id}`];

        // Aggregate items by name and qty
        const aggregated = {};
        order.items.forEach(it => {
            const key = `${it.name}|${it.qty || ''}`;
            if (!aggregated[key]) {
                aggregated[key] = { ...it, unit: 0 };
            }
            aggregated[key].unit += (parseInt(it.unit) || 0);
        });

        // Display aggregated lines
        Object.values(aggregated).forEach(it => {
            if (it.unit <= 0) return;
            const label = it.name.split(' (')[0];
            const emoji = ITEM_TYPES.find(c => c.name === it.name)?.emoji || '📦';
            lines.push(`👉 ${it.qty || ''} ${label} x ${it.unit} ${emoji}`);
        });

        if (order.comment === 'Porter') {
            lines.push(``, `🚚 *Porter Delivery Requested*`);
        } else {
            lines.push(``, `ઓર્ડર લેવા આવો ત્યારે તમારો ઓર્ડર નંબર અને નામ ત્યાં જણાવવું`);
        }

        whatsappOutput.textContent = lines.join('\n');
        whatsappOverlay.classList.remove('hidden');
    };

    // --- Event Listeners ---

    addItemBtn.onclick = () => itemsList.appendChild(createItemRow());

    openFormBtn.onclick = () => {
        editingOrderId = null;
        formModalTitle.textContent = 'New Order Details';
        document.getElementById('submitBtn').innerHTML = 'Save Order <i class="fa-solid fa-cloud-arrow-up"></i>';
        form.reset();
        itemsList.innerHTML = '';
        itemsList.appendChild(createItemRow());
        formOverlay.classList.remove('hidden');
    };

    closeFormBtn.onclick = () => {
        formOverlay.classList.add('hidden');
    };

    clearBtn.onclick = () => {
        form.reset();
        itemsList.innerHTML = '';
        itemsList.appendChild(createItemRow());
        editingOrderId = null;
        document.getElementById('submitBtn').innerHTML = 'Save Order <i class="fa-solid fa-cloud-arrow-up"></i>';
    };

    form.onsubmit = (e) => {
        e.preventDefault();

        const itemRows = itemsList.querySelectorAll('.item-row');
        const items = [];
        itemRows.forEach(row => {
            const unit = parseInt(row.querySelector('.item-unit').value);
            if (unit > 0) {
                items.push({
                    name: row.querySelector('.item-name').value,
                    unit: unit,
                    qty: row.querySelector('.item-qty').value || null
                });
            }
        });

        if (items.length === 0) {
            alert('Please add at least one item with unit > 0');
            return;
        }

        const orderData = {
            id: editingOrderId || generateOrderId(),
            name: document.getElementById('customerName').value,
            contact: document.getElementById('contactNo').value,
            items: items,
            comment: porterSwitch.checked ? 'Porter' : ''
        };

        if (editingOrderId) {
            const index = orders.findIndex(o => o.id === editingOrderId);
            orders[index] = orderData;
            editingOrderId = null;
            document.getElementById('submitBtn').innerHTML = 'Save Order <i class="fa-solid fa-cloud-arrow-up"></i>';
        } else {
            orders.push(orderData);
        }

        saveToLocale();
        clearBtn.click();
        formOverlay.classList.add('hidden');
        showToast('Order saved successfully!');
    };

    exportAllBtn.onclick = () => {
        if (orders.length === 0) return;

        const headers = ['ID', 'Name', 'Contact', 'Jamfal', 'Teti', 'Moringa', 'Comment'].join('\t');
        const rows = orders.map(o => {
            const agg = getAggregatedDisplay(o.items);
            return [
                o.id, o.name, o.contact,
                `"${agg.jamfal || '-'}"`,
                `"${agg.teti || '-'}"`,
                `"${agg.moringa || '-'}"`,
                o.comment || ''
            ].join('\t');
        });

        const fullCopy = headers + '\n' + rows.join('\n');
        navigator.clipboard.writeText(fullCopy).then(() => showToast('All orders copied with headers!'));
    };

    closeModalBtn.onclick = () => whatsappOverlay.classList.add('hidden');
    copyWhatsappBtn.onclick = () => {
        navigator.clipboard.writeText(whatsappOutput.textContent).then(() => {
            showToast('WhatsApp message copied!');
            closeModalBtn.click();
        });
    };

    printBtn.onclick = () => {
        if (orders.length === 0) {
            showToast('No orders to export!');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait');
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];

        // Add Title
        doc.setFontSize(18);
        doc.text(`Order Report - ${dateStr}`, 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);

        // Prepare Table Data
        const headers = [['ID', 'Name', 'Contact', 'Jamfal', 'Teti', 'Moringa', 'Comment']];
        const rows = orders.map(order => {
            const agg = getAggregatedDisplay(order.items);
            return [
                order.id,
                order.name,
                order.contact,
                agg.jamfal || '-',
                agg.teti || '-',
                agg.moringa || '-',
                order.comment || '-'
            ];
        });

        // Generate Table using AutoTable
        doc.autoTable({
            head: headers,
            body: rows,
            startY: 25,
            theme: 'grid',
            styles: {
                fontSize: 8, // Slightly smaller for portrait
                cellPadding: 2,
                valign: 'middle',
                font: 'helvetica'
            },
            headStyles: {
                fillColor: [249, 250, 251],
                textColor: [0, 0, 0],
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 10, fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] },
                1: { cellWidth: 35, fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] },
                2: { cellWidth: 25, fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] },
                3: { cellWidth: 30, fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] },
                4: { cellWidth: 30, fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] },
                5: { cellWidth: 30, fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] },
                6: { cellWidth: 'auto', fontStyle: "semibold", fontSize: 8, textColor: [0, 0, 0] }
            },
            didDrawPage: function (data) {
                // Footer
                const str = 'Page ' + doc.internal.getNumberOfPages();
                doc.setFontSize(10);
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                doc.text(str, data.settings.margin.left, pageHeight - 10);
            }
        });

        // Save the PDF
        doc.save(`${dateStr} - PDF.pdf`);
    };

    confirmDeleteBtn.onclick = () => {
        if (deletingOrderId) {
            orders = orders.filter(o => o.id !== deletingOrderId);
            saveToLocale();
            deletingOrderId = null;
            deleteConfirmOverlay.classList.add('hidden');
            showToast('Order deleted.');
        } else {
            // This case handles the "Delete All" if we were to move that to a modal too, 
            // but for now let's just use it for single deletes.
            orders = [];
            saveToLocale();
            deleteConfirmOverlay.classList.add('hidden');
            showToast('History cleared.');
        }
    };

    cancelDeleteBtn.onclick = closeDeleteModalBtn.onclick = () => {
        deleteConfirmOverlay.classList.add('hidden');
        deletingOrderId = null;
    };

    deleteAllBtn.onclick = () => {
        deletingOrderId = null; // null signals a "delete all" action to confirm button
        deleteConfirmOverlay.querySelector('p').textContent = 'Are you ABSOLUTELY sure you want to delete ALL order history? This cannot be undone.';
        modalCopyBtn.style.display = 'none';
        deleteConfirmOverlay.classList.remove('hidden');
    };

    modalCopyBtn.onclick = () => {
        if (deletingOrderId) {
            copySingleOrder(deletingOrderId);
        }
    };

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Init
    itemsList.appendChild(createItemRow());
    renderOrders();
});
