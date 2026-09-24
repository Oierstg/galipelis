document.addEventListener('DOMContentLoaded', () => {
    const BASE_PROXY = typeof Utilidades !== 'undefined' && Utilidades.obtenerUrlBackend ? Utilidades.obtenerUrlBackend() : window.location.origin;

    const adminLoginModal = document.getElementById('admin-login-modal');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminUser = document.getElementById('admin-user');
    const adminPass = document.getElementById('admin-pass');
    const loginError = document.getElementById('login-error');
    const adminDashboard = document.getElementById('admin-dashboard');
    const currentAdminName = document.getElementById('current-admin-name');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const createUserForm = document.getElementById('create-user-form');
    const newUsername = document.getElementById('new-username');
    const newPassword = document.getElementById('new-password');
    const newIsAdmin = document.getElementById('new-is-admin');
    const createUserMsg = document.getElementById('create-user-msg');
    const usersTableBody = document.getElementById('users-table-body');

    const refreshStatsBtn = document.getElementById('refresh-stats-btn');
    const statsTableBody = document.getElementById('stats-table-body');
    const statsSearch = document.getElementById('stats-search');

    const kpiLiveCount = document.getElementById('kpi-live-count');
    const kpiLiveUsers = document.getElementById('kpi-live-users');
    const kpiTotalTime = document.getElementById('kpi-total-time');
    const kpiTotalSessions = document.getElementById('kpi-total-sessions');

    // Chart Controls
    const chartScrollBox = document.getElementById('chart-scroll-box');
    const btnChartPanLeft = document.getElementById('btn-chart-pan-left');
    const btnChartPanRight = document.getElementById('btn-chart-pan-right');
    const btnChartZoomIn = document.getElementById('btn-chart-zoom-in');
    const btnChartZoomOut = document.getElementById('btn-chart-zoom-out');
    const btnChartReset = document.getElementById('btn-chart-reset');

    // User Detail Inspector Modal
    const userDetailModal = document.getElementById('user-detail-modal');
    const closeUserDetailBtn = document.getElementById('close-user-detail-btn');
    const detailUserAvatar = document.getElementById('detail-user-avatar');
    const detailUserName = document.getElementById('detail-user-name');
    const detailUserRole = document.getElementById('detail-user-role');
    const detailUserCreated = document.getElementById('detail-user-created');
    const detailUserTime = document.getElementById('detail-user-time');
    const detailFavCount = document.getElementById('detail-fav-count');
    const detailHistoryCount = document.getElementById('detail-history-count');
    const detailFavoritesList = document.getElementById('detail-favorites-list');
    const detailHistoryBody = document.getElementById('detail-history-body');
    const detailTabBtns = document.querySelectorAll('.detail-tab-btn');
    const detailSections = document.querySelectorAll('.detail-section');

    let allStatsData = [];
    let timelineChart = null;
    let chartZoomLevel = 1.0;

    // Validación estricta de sesión de administrador en el backend
    async function checkSession() {
        const token = Utilidades.obtenerToken();
        if (!token) {
            bloquearAccesoAdmin();
            return;
        }

        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/auth/me`);
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated && data.is_admin) {
                    currentAdminName.textContent = data.username;
                    adminLoginModal.classList.add('hidden');
                    adminDashboard.classList.remove('hidden');
                    loadStats();
                    loadUsers();
                    return;
                } else {
                    showError('Acceso denegado: Tu cuenta no dispone de permisos de administrador.');
                }
            } else {
                showError('Sesión expirada o no autorizada.');
            }
        } catch (err) {
            showError('Error al contactar con el servidor para verificar permisos.');
        }

        bloquearAccesoAdmin();
    }

    function bloquearAccesoAdmin() {
        Utilidades.eliminarToken();
        adminLoginModal.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
        currentAdminName.textContent = '';
    }

    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');

        try {
            const res = await fetch(`${BASE_PROXY}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: adminUser.value.trim(),
                    password: adminPass.value.trim()
                })
            });

            const data = await res.json();
            if (res.ok && data.success && data.token) {
                if (!data.is_admin) {
                    showError('Acceso denegado: Solo usuarios con rol administrador pueden ingresar.');
                    return;
                }
                Utilidades.guardarToken(data.token);
                adminUser.value = '';
                adminPass.value = '';
                checkSession();
            } else {
                showError(data.error || 'Credenciales incorrectas.');
            }
        } catch (err) {
            showError('Error de conexión con el servidor.');
        }
    });

    function showError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
    }

    adminLogoutBtn.addEventListener('click', async () => {
        try {
            await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {}
        Utilidades.eliminarToken();
        bloquearAccesoAdmin();
    });

    // Tab Navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            if (targetTab === 'stats') {
                loadStats();
            } else if (targetTab === 'users') {
                loadUsers();
            }
        });
    });

    // Modal Tab Navigation inside User Inspector
    detailTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            detailTabBtns.forEach(b => b.classList.remove('active'));
            detailSections.forEach(s => s.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.getAttribute('data-detail-tab');
            document.getElementById(`detail-tab-${target}`).classList.add('active');
        });
    });

    closeUserDetailBtn.addEventListener('click', () => {
        userDetailModal.classList.add('hidden');
    });

    // User Management & Password Editor
    async function loadUsers() {
        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/users`);
            if (res.status === 401 || res.status === 403) {
                bloquearAccesoAdmin();
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const users = await res.json();
            renderUsersTable(users);
        } catch (err) {
            console.error('Error al cargar usuarios:', err);
        }
    }

    function renderUsersTable(users) {
        usersTableBody.innerHTML = '';
        if (!users || users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay usuarios registrados.</td></tr>';
            return;
        }

        const currentAdmin = currentAdminName.textContent.trim();

        users.forEach(u => {
            const tr = document.createElement('tr');
            const isSelf = u.username === currentAdmin;

            tr.innerHTML = `
                <td><strong>${escapeHtml(u.username)}</strong></td>
                <td>
                    <div class="password-cell-wrap">
                        <input type="text" value="${escapeHtml(u.password || '')}" class="input-pass-edit" id="pass-input-${escapeHtml(u.username)}" autocomplete="off">
                        <button class="btn-save-pass" data-username="${escapeHtml(u.username)}" title="Guardar nueva contraseña">Guardar</button>
                    </div>
                </td>
                <td><span class="role-badge ${u.is_admin ? 'admin' : 'user'}">${u.is_admin ? 'Admin' : 'Usuario'}</span></td>
                <td>${u.created_at || '—'}</td>
                <td>
                    <button class="btn-sm btn-detail" data-username="${escapeHtml(u.username)}">
                        Ver Detalle
                    </button>
                    ${isSelf ? '<span class="text-muted">(Sesión actual)</span>' : `
                        <button class="btn-sm btn-delete" data-username="${escapeHtml(u.username)}">
                            Eliminar
                        </button>
                    `}
                </td>
            `;
            usersTableBody.appendChild(tr);
        });

        // Add Listeners for Password Edit, User Detail, and Delete
        usersTableBody.querySelectorAll('.btn-save-pass').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.getAttribute('data-username');
                const passInput = document.getElementById(`pass-input-${username}`);
                if (passInput) {
                    updateUserPassword(username, passInput.value.trim());
                }
            });
        });

        usersTableBody.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.getAttribute('data-username');
                inspectUserDetail(username);
            });
        });

        usersTableBody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.getAttribute('data-username');
                deleteUser(username);
            });
        });
    }

    async function updateUserPassword(username, newPassword) {
        if (!newPassword) {
            alert('La contraseña no puede estar vacía');
            return;
        }

        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/users/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: newPassword })
            });
            if (res.status === 401 || res.status === 403) {
                bloquearAccesoAdmin();
                return;
            }
            const data = await res.json();
            if (data.success) {
                alert(`Contraseña de ${username} actualizada correctamente.`);
                loadUsers();
            } else {
                alert(data.error || 'Error al cambiar contraseña');
            }
        } catch (err) {
            alert('Error de red al actualizar contraseña');
        }
    }

    async function deleteUser(username) {
        if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"?`)) return;

        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/users/delete?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
            if (res.status === 401 || res.status === 403) {
                bloquearAccesoAdmin();
                return;
            }
            const data = await res.json();
            if (data.success) {
                loadUsers();
            } else {
                alert(data.error || 'Error al eliminar usuario');
            }
        } catch (err) {
            alert('Error de red al eliminar usuario');
        }
    }

    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createUserMsg.classList.add('hidden');

        const username = newUsername.value.trim();
        const password = newPassword.value.trim();
        const isAdmin = newIsAdmin.checked;

        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, is_admin: isAdmin })
            });
            if (res.status === 401 || res.status === 403) {
                bloquearAccesoAdmin();
                return;
            }

            const data = await res.json();
            if (data.success) {
                showMsg('Usuario creado correctamente.', 'success');
                newUsername.value = '';
                newPassword.value = '';
                newIsAdmin.checked = false;
                loadUsers();
            } else {
                showMsg(data.error || 'Error al crear usuario.', 'error');
            }
        } catch (err) {
            showMsg('Error al conectar con el servidor.', 'error');
        }
    });

    function showMsg(msg, type) {
        createUserMsg.textContent = msg;
        createUserMsg.className = `alert-msg ${type === 'error' ? 'alert-error' : 'alert-success'}`;
        createUserMsg.classList.remove('hidden');
    }

    // Inspect User Detail (Favorites + Viewing History)
    async function inspectUserDetail(username) {
        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/admin/user_detail?username=${encodeURIComponent(username)}`);
            if (res.status === 401 || res.status === 403) {
                bloquearAccesoAdmin();
                return;
            }
            const data = await res.json();
            if (data.error) {
                alert(data.error);
                return;
            }

            detailUserAvatar.textContent = username.charAt(0).toUpperCase();
            detailUserName.textContent = username;
            detailUserRole.textContent = data.is_admin ? 'Admin' : 'Usuario';
            detailUserRole.className = `role-badge ${data.is_admin ? 'admin' : 'user'}`;
            detailUserCreated.textContent = `Creado: ${data.created_at || '—'}`;
            detailUserTime.textContent = `Total visto: ${formatDuration(data.total_duration || 0)}`;

            // Render Favorites
            detailFavoritesList.innerHTML = '';
            const favs = data.favorites || [];
            detailFavCount.textContent = favs.length;

            if (favs.length === 0) {
                detailFavoritesList.innerHTML = '<p class="text-muted">El usuario no ha añadido favoritos aún.</p>';
            } else {
                favs.forEach(fav => {
                    const div = document.createElement('div');
                    div.className = 'fav-card-item';
                    div.innerHTML = `<span>${escapeHtml(fav)}</span>`;
                    detailFavoritesList.appendChild(div);
                });
            }

            // Render History
            detailHistoryBody.innerHTML = '';
            const historyList = data.history || [];
            detailHistoryCount.textContent = historyList.length;

            if (historyList.length === 0) {
                detailHistoryBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay registros de visualización para este usuario.</td></tr>';
            } else {
                historyList.forEach(h => {
                    const tr = document.createElement('tr');
                    const typeLabel = h.type === 'Live TV' || h.type === 'canal' ? 'TV en Directo' : (h.type === 'Series' ? 'Serie' : 'Película');

                    tr.innerHTML = `
                        <td><strong>${escapeHtml(h.title || 'Desconocido')}</strong></td>
                        <td><span class="badge-type">${typeLabel}</span></td>
                        <td>${h.start_time || '—'}</td>
                        <td>${h.end_time || '—'}</td>
                        <td><strong class="text-highlight">${formatDuration(h.duration_seconds || 0)}</strong></td>
                    `;
                    detailHistoryBody.appendChild(tr);
                });
            }

            userDetailModal.classList.remove('hidden');
        } catch (err) {
            alert('Error al obtener detalle del usuario.');
        }
    }

    // Statistics & Simultaneous Viewers Chart
    async function loadStats() {
        try {
            // Load stats history
            const resStats = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/stats`);
            if (resStats.status === 401 || resStats.status === 403) {
                bloquearAccesoAdmin();
                return;
            }
            allStatsData = await resStats.json();
            renderStatsTable(allStatsData);
            updateSummaryKPIs(allStatsData);

            // Load active viewers live count
            const resActive = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/stats/active`);
            const activeData = await resActive.json();
            const activeCount = activeData.active_count || 0;
            const activeUsers = activeData.active_users || [];

            kpiLiveCount.textContent = activeCount;
            kpiLiveUsers.textContent = activeUsers.length > 0 ? `Viendo: ${activeUsers.join(', ')}` : 'Ningún usuario reproduciendo';

            // Load timeline data for chart
            const resTimeline = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/admin/timeline`);
            const timelineData = await resTimeline.json();
            renderTimelineChart(timelineData, activeData);

        } catch (err) {
            console.error('Error al cargar estadísticas:', err);
        }
    }

    refreshStatsBtn.addEventListener('click', loadStats);

    statsSearch.addEventListener('input', () => {
        const query = statsSearch.value.toLowerCase().trim();
        const filtered = allStatsData.filter(s => 
            (s.username && s.username.toLowerCase().includes(query)) ||
            (s.title && s.title.toLowerCase().includes(query)) ||
            (s.type && s.type.toLowerCase().includes(query))
        );
        renderStatsTable(filtered);
    });

    function updateSummaryKPIs(stats) {
        let totalSecs = 0;
        stats.forEach(s => {
            totalSecs += (s.duration_seconds || 0);
        });

        kpiTotalTime.textContent = formatDuration(totalSecs);
        kpiTotalSessions.textContent = stats.length;
    }

    function renderStatsTable(stats) {
        statsTableBody.innerHTML = '';
        if (!stats || stats.length === 0) {
            statsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay registros de visualización.</td></tr>';
            return;
        }

        const sorted = [...stats].sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

        sorted.forEach(s => {
            const tr = document.createElement('tr');
            const typeLabel = s.type === 'Live TV' || s.type === 'canal' ? 'TV en Directo' : (s.type === 'Series' ? 'Serie' : 'Película');

            tr.innerHTML = `
                <td><strong>${escapeHtml(s.username || '—')}</strong></td>
                <td>${escapeHtml(s.title || 'Desconocido')}</td>
                <td><span class="badge-type">${typeLabel}</span></td>
                <td>${s.start_time || '—'}</td>
                <td>${s.end_time || '—'}</td>
                <td><strong class="text-highlight">${formatDuration(s.duration_seconds || 0)}</strong></td>
            `;
            statsTableBody.appendChild(tr);
        });
    }

    // Chart.js Timeline Render
    function renderTimelineChart(timeline, activeData) {
        const ctx = document.getElementById('viewersChart').getContext('2d');

        // Build data points from timeline, append current instant if needed
        let points = [...timeline];
        const nowStr = new Date().toLocaleTimeString();

        if (points.length === 0) {
            points = [
                { timestamp: nowStr, count: activeData.active_count || 0, users: activeData.active_users || [] }
            ];
        }

        const labels = points.map(p => p.timestamp || '—');
        const counts = points.map(p => p.count || 0);
        const usersMap = points.map(p => p.users && p.users.length > 0 ? p.users.join(', ') : 'Nadie');

        if (timelineChart) {
            timelineChart.destroy();
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(229, 9, 20, 0.4)');
        gradient.addColorStop(1, 'rgba(229, 9, 20, 0.0)');

        timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Espectadores Simultáneos',
                    data: counts,
                    borderColor: '#e50914',
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#e50914',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 17, 25, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#60a5fa',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                const count = context.parsed.y;
                                const users = usersMap[idx] || 'Nadie';
                                return [
                                    ` Simultáneos: ${count} espectador(es)`,
                                    ` Usuarios: ${users}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        stepSize: 1,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            precision: 0
                        }
                    }
                }
            }
        });

        // Scroll to the end by default (most recent timeline)
        setTimeout(() => {
            if (chartScrollBox) {
                chartScrollBox.scrollLeft = chartScrollBox.scrollWidth;
            }
        }, 100);
    }

    // Chart Scroll / Pan Controls
    if (btnChartPanLeft) {
        btnChartPanLeft.addEventListener('click', () => {
            chartScrollBox.scrollBy({ left: -300, behavior: 'smooth' });
        });
    }

    if (btnChartPanRight) {
        btnChartPanRight.addEventListener('click', () => {
            chartScrollBox.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }

    if (btnChartZoomIn) {
        btnChartZoomIn.addEventListener('click', () => {
            chartZoomLevel = Math.min(chartZoomLevel + 0.3, 3.0);
            applyChartZoom();
        });
    }

    if (btnChartZoomOut) {
        btnChartZoomOut.addEventListener('click', () => {
            chartZoomLevel = Math.max(chartZoomLevel - 0.3, 0.8);
            applyChartZoom();
        });
    }

    if (btnChartReset) {
        btnChartReset.addEventListener('click', () => {
            chartZoomLevel = 1.0;
            applyChartZoom();
            chartScrollBox.scrollLeft = chartScrollBox.scrollWidth;
        });
    }

    function applyChartZoom() {
        const wrap = document.getElementById('chart-inner-wrap');
        if (wrap) {
            const baseWidth = 800;
            wrap.style.minWidth = `${baseWidth * chartZoomLevel}px`;
            if (timelineChart) {
                timelineChart.resize();
            }
        }
    }

    function formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0s';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    checkSession();
});
