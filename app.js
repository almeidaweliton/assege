/**
 * Strategic Planning App Logic
 */

const STORAGE_KEY = 'strat_plan_data_v1';
const API_URL = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';

class App {
    constructor() {
        this.data = { objectives: [] };
        this.currentObjectiveId = null;
        this.currentInitiativeId = null;
        this.loading = true;
        this.init();
    }

    async init() {
        await this.loadData();

        // One-time migration: LocalStorage to Server
        const BACKEND_MIGRATED_KEY = 'backend_migrated_v1';
        const localData = localStorage.getItem(STORAGE_KEY);

        if (localData && !localStorage.getItem(BACKEND_MIGRATED_KEY)) {
            console.log('Migrating local data to new hierarchy...');
            const parsedLocal = JSON.parse(localData);

            // Collect initiatives from old structure
            let oldInitiatives = parsedLocal.initiatives || parsedLocal.objectives || [];

            if (oldInitiatives.length > 0 && (!this.data.objectives || this.data.objectives.length === 0)) {
                // Create a default top objective
                const defaultObj = {
                    id: 'obj_default',
                    title: 'Planejamento Geral',
                    description: 'Objetivo padrão para migração de dados antigos.',
                    owner: 'Sistema',
                    dueDate: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString(),
                    initiatives: oldInitiatives.map(ini => ({ ...ini, objectiveId: 'obj_default' }))
                };
                this.data.objectives = [defaultObj];
                await this.save(true);
            }
            localStorage.setItem(BACKEND_MIGRATED_KEY, 'true');
        }

        // Auto-select first objective
        if (!this.currentObjectiveId && this.data.objectives && this.data.objectives.length > 0) {
            this.currentObjectiveId = this.data.objectives[0].id;
        }

        this.renderDashboard();

        // Simple client-side router (handle back button)
        window.onpopstate = () => {
            this.renderDashboard();
        };
    }

    async loadData() {
        try {
            const response = await fetch(`${API_URL}/data`);
            if (response.ok) {
                const fetchedData = await response.json();
                this.data.objectives = fetchedData.objectives || [];
                this.loadFailed = false;
            } else {
                this.loadFailed = true;
            }
        } catch (err) {
            console.error('Failed to load data from server:', err);
            this.loadFailed = true;
        } finally {
            this.loading = false;
        }
    }

    async save(silent = false) {
        if (this.loadFailed) {
            alert('Atenção: Os dados não foram carregados corretamente do servidor. Para evitar perda de dados, o salvamento foi bloqueado. Por favor, recarregue a página.');
            return;
        }
        try {
            // Save to Server
            await fetch(`${API_URL}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ objectives: this.data.objectives })
            });

            if (!silent) {
                this.renderDashboard();
                if (this.currentInitiativeId) {
                    this.renderDetails(this.currentInitiativeId);
                }
            }
        } catch (err) {
            console.error('Failed to save data to server:', err);
            alert('Erro ao salvar no servidor.');
        }
    }

    setupIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // --- Navigation ---

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
            // Re-render icons se o menu abrir e montar ícones novos
            if(sidebar.classList.contains('show')) this.setupIcons();
        }
    }

    closeSidebarIfMobile() {
        if (window.innerWidth <= 1024) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) sidebar.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        }
    }

    closeDetailsMobile() {
        const pane = document.getElementById('objective-details-pane');
        if (pane) pane.classList.remove('active');
    }

    goBack() {
        document.getElementById('view-dashboard').style.display = 'block';
        document.getElementById('view-detail').style.display = 'none';
        this.currentInitiativeId = null;
    }

    goHome() {
        this.currentObjectiveId = null;
        this.currentInitiativeId = null;
        this.closeSidebarIfMobile();
        this.renderDashboard();
    }

    // --- Rendering ---

    renderMobileBreadcrumb() {
        const bc = document.getElementById('mobile-breadcrumb');
        if (!bc) return;
        
        let html = `<a onclick="app.goHome()">Início</a>`;
        
        const topObj = this.data.objectives.find(o => o.id === this.currentObjectiveId);
        if (topObj) {
            html += `<span class="breadcrumb-sep">/</span> <a onclick="app.closeDetailsMobile()" style="color:var(--foreground);">${topObj.title}</a>`;
        }
        
        bc.innerHTML = html;
    }

    renderDashboard() {
        const container = document.getElementById('view-dashboard');
        container.style.display = 'block';
        
        this.renderMobileBreadcrumb();

        // Calculate Stats
        let totalInitiatives = 0;
        let completedInitiatives = 0;
        let expiringInitiatives = 0;
        let expiredInitiatives = 0;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        thirtyDaysFromNow.setHours(0, 0, 0, 0);

        // Filter objectives if one is selected
        const objectivesToStats = this.currentObjectiveId
            ? this.data.objectives.filter(o => o.id === this.currentObjectiveId)
            : this.data.objectives;

        objectivesToStats.forEach(obj => {
            if (!obj.initiatives) return;
            totalInitiatives += obj.initiatives.length;

            obj.initiatives.forEach(ini => {
                const progress = this.calculateProgress(ini);
                const isInitiativeComplete = progress === 100;

                if (isInitiativeComplete) {
                    completedInitiatives++;
                } else {
                    let hasExpiringTask = false;
                    let hasExpiredTask = false;

                    if (ini.tasks) {
                        ini.tasks.forEach(t => {
                            if (t.completed) return;
                            const due = new Date(t.dueDate);
                            due.setHours(0, 0, 0, 0);
                            if (due < now) hasExpiredTask = true;
                            else if (due >= now && due <= thirtyDaysFromNow) hasExpiringTask = true;
                        });
                    }

                    if (hasExpiredTask) expiredInitiatives++;
                    else if (hasExpiringTask) expiringInitiatives++;
                }
            });
        });

        const elTotal = document.getElementById('stat-total');
        const elCompleted = document.getElementById('stat-obj-completed');
        const elExpiring = document.getElementById('stat-expiring');
        const elExpired = document.getElementById('stat-expired');

        if (elTotal) elTotal.innerText = totalInitiatives;
        if (elCompleted) elCompleted.innerText = completedInitiatives;
        if (elExpiring) elExpiring.innerText = expiringInitiatives;
        if (elExpired) elExpired.innerText = expiredInitiatives;

        // Render TOP Objectives Naviagtion in Sidebar
        this.renderObjectivesNav();

        // Render Sidebar List (Initiatives for current objective)
        const listContainer = document.getElementById('objectives-list');
        if (!listContainer) return;

        const currentObj = this.data.objectives.find(o => o.id === this.currentObjectiveId);
        const allInitiatives = currentObj ? (currentObj.initiatives || []) : [];

        // Filtering Logic
        const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('filter-status')?.value || 'all';

        const filteredInitiatives = allInitiatives.filter(ini => {
            const matchesSearch = ini.title.toLowerCase().includes(searchQuery) ||
                (ini.description && ini.description.toLowerCase().includes(searchQuery));
            if (!matchesSearch) return false;

            const progress = this.calculateProgress(ini);
            const isComplete = progress === 100;

            if (statusFilter === 'completed') return isComplete;
            if (statusFilter === 'pending') return !isComplete;

            return true;
        });

        if (filteredInitiatives.length === 0) {
            if (allInitiatives.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state" style="padding: 2rem;">
                        <p>Sem iniciativas.</p>
                        <button class="btn" onclick="app.openNewObjectiveModal()" style="margin-top:1rem; font-size:0.8rem">Criar Nova</button>
                    </div>
                `;
            } else {
                listContainer.innerHTML = `
                    <div class="empty-state" style="padding: 2rem; border-style:dashed">
                        <p>Nenhuma iniciativa encontrada.</p>
                    </div>
                `;
            }
        } else {
            listContainer.innerHTML = filteredInitiatives.map(obj => {
                const progress = this.calculateProgress(obj);
                const isSelected = this.currentInitiativeId === obj.id;
                const totalTasks = obj.tasks ? obj.tasks.length : 0;
                const completedTasks = obj.tasks ? obj.tasks.filter(t => t.completed).length : 0;
                const dateStr = obj.dueDate ? new Date(obj.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';

                const isComplete = totalTasks > 0 && totalTasks === completedTasks;
                const statusClass = isComplete ? 'status-complete' : 'status-incomplete';

                return `
                <div class="objective-card ${isSelected ? 'selected' : ''}" onclick="app.openDetail('${obj.id}')">
                    
                    <div class="obj-header">
                        <div class="obj-icon-container ${isComplete ? 'completed' : ''}">
                            <i data-lucide="target" size="24"></i>
                        </div>
                        <div>
                            <div class="obj-title">${obj.title}</div>
                            <!-- Static tag for design match, or dynamic if we added categories later -->
                            <div style="margin-top:0.25rem;">
                                <span class="badge ${isComplete ? 'badge-success' : 'badge-secondary'}" style="font-weight:600; font-size:0.7rem; text-transform:uppercase">
                                    ${isComplete ? 'Concluído' : 'Estratégico'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="obj-desc">
                        ${obj.description || 'Sem descrição definida para esta iniciativa.'}
                    </div>

                    <div class="progress-section">
                        <div class="progress-label-row">
                            <span>Progresso</span>
                            <span style="color:#111">${Math.round(progress)}%</span>
                        </div>
                        <div class="progress-bar-modern-bg">
                            <div class="progress-bar-modern-fill ${isComplete ? 'completed' : ''}" style="width: ${progress}%"></div>
                        </div>
                        <div class="task-count-text">
                            ${completedTasks} de ${totalTasks} ações concluídas
                        </div>
                    </div>

                    <div class="obj-footer" style="padding-top:0; border-top:none; margin-bottom:0.5rem">
                        <div class="date-badge">
                            <i data-lucide="user" size="14"></i>
                            <span style="font-weight:600; color:#111">${obj.owner || 'Sem responsável'}</span>
                        </div>
                        <div class="date-badge" style="color:var(--primary); font-weight:600">
                            R$ ${this.calculateTotalCost(obj).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div class="obj-footer">
                        <div class="date-badge">
                            <i data-lucide="calendar" size="16"></i>
                            ${dateStr}
                        </div>
                        
                        <div style="display:flex; align-items:center">
                            <span class="status-badge ${isComplete ? '' : 'pending'}">
                                ${isComplete ? 'concluído' : 'ativo'}
                            </span>
                            <span class="action-link" style="margin-left:1rem">
                                Ver ações <i data-lucide="chevron-right" size="16"></i>
                            </span>
                        </div>
                    </div>

                </div>
                `;
            }).join('');
        }

        // If we have a current objective, make sure details are updated.
        // If not, show empty state or maintain state.
        if (this.currentInitiativeId) {
            // Check if selected item is still visible
            const visible = filteredInitiatives.find(o => o.id === this.currentInitiativeId);
            if (!visible) {
                this.renderDetails(this.currentInitiativeId, false);
            } else {
                this.renderDetails(this.currentInitiativeId, false);
            }
        } else {
            this.showDetailsEmptyState();
        }

        // Update active objective title in dashboard if needed
        const headerH2 = document.querySelector('#view-dashboard h2');
        if (headerH2 && currentObj) {
            headerH2.innerText = `Objetivo: ${currentObj.title}`;
        }

        this.setupIcons();
    }

    renderObjectivesNav() {
        const nav = document.getElementById('objectives-nav');
        if (!nav) return;

        nav.innerHTML = this.data.objectives.map(obj => {
            const isActive = obj.id === this.currentObjectiveId;
            return `
                <a class="nav-item ${isActive ? 'active' : ''}" onclick="app.selectObjective('${obj.id}')" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${obj.title}</span>
                </a>
            `;
        }).join('') + `
            <button class="btn-ghost" onclick="app.openTopObjectiveModal()" style="font-size: 0.75rem; margin-top: 0.5rem; justify-content: flex-start; padding: 0.5rem 0.75rem;">
                <i data-lucide="plus" size="14"></i> Adicionar Objetivo
            </button>
        `;
        this.setupIcons();
    }

    selectObjective(id) {
        this.currentObjectiveId = id;
        this.currentInitiativeId = null;
        this.closeSidebarIfMobile();
        this.renderDashboard();
    }

    handleSearch(query) {
        this.renderDashboard();
    }

    handleFilter(status) {
        this.renderDashboard();
    }

    openDetail(id) {
        this.currentInitiativeId = id;
        this.renderDashboard(); // Re-render to update selected state in list
        this.renderDetails(id, true);
        
        // Show details pane on mobile
        const pane = document.getElementById('objective-details-pane');
        if (pane) pane.classList.add('active');
    }

    showDetailsEmptyState() {
        const empty = document.getElementById('details-empty-state');
        if (empty) {
            empty.style.display = 'flex';
            empty.querySelector('p').innerText = 'Selecione uma iniciativa ao lado para ver as ações e detalhes.';
        }
        document.getElementById('details-content').style.display = 'none';
    }

    renderDetails(id, updateList = false) {
        let obj = null;
        for (const top of this.data.objectives) {
            obj = top.initiatives.find(ini => ini.id === id);
            if (obj) break;
        }

        if (!obj) {
            this.currentInitiativeId = null;
            this.showDetailsEmptyState();
            return;
        }

        document.getElementById('details-empty-state').style.display = 'none';
        document.getElementById('details-content').style.display = 'block';

        const dateStr = obj.dueDate ? new Date(obj.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
        const titleEl = document.getElementById('detail-title');
        
        // Find the parent objective for the breadcrumb
        let parentObj = null;
        for (const top of this.data.objectives) {
            if (top.initiatives && top.initiatives.find(i => i.id === obj.id)) {
                parentObj = top;
                break;
            }
        }
        
        titleEl.innerHTML = `
            <div class="mobile-only-breadcrumb">
                <span onclick="app.goHome()" style="cursor:pointer">Início</span>
                <span style="margin:0 0.4rem; opacity:0.5; color:var(--muted-foreground)">/</span>
                <span onclick="app.closeDetailsMobile()" style="cursor:pointer; color:var(--foreground);">${parentObj ? parentObj.title : 'Objetivo'}</span>
            </div>
            <div class="details-title-row">
                <button class="btn-ghost btn-icon mobile-only-inline" onclick="app.closeDetailsMobile()" style="margin-right:0.25rem;">
                    <i data-lucide="arrow-left" size="20"></i>
                </button>
                <h2>${obj.title}</h2>
                <button class="btn-ghost btn-icon" onclick="app.editObjective('${obj.id}')" style="width:1.5rem; height:1.5rem;">
                    <i data-lucide="edit-3" size="16"></i>
                </button>
            </div>
            <div style="font-size:0.8rem; font-weight:400; color:var(--muted-foreground); margin-top:0.25rem; display:flex; align-items:center; gap:1rem">
                <div style="display:flex; align-items:center; gap:0.25rem">
                    <i data-lucide="calendar" size="14"></i> Previsão: ${dateStr}
                </div>
                <div style="display:flex; align-items:center; gap:0.25rem; color:var(--primary); font-weight:600">
                    <i data-lucide="banknote" size="14"></i> Custo Total: R$ ${this.calculateTotalCost(obj).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
            </div>
        `;

        document.getElementById('detail-desc').innerText = obj.description || '';

        const progress = this.calculateProgress(obj);
        document.getElementById('detail-percent').innerText = `${Math.round(progress)}%`;
        document.getElementById('detail-progress-bar').style.width = `${progress}%`;

        const taskList = document.getElementById('task-list');

        if (!obj.tasks || obj.tasks.length === 0) {
            taskList.innerHTML = `<div class="empty-state" style="padding: 2rem; border-style:dashed;">Nenhuma ação cadastrada.</div>`;
        } else {
            taskList.innerHTML = obj.tasks.map(task => {
                const isCompleted = task.completed;
                const priority = (task.priority || 'Normal').toLowerCase();
                const startDateStr = task.startDate ? new Date(task.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
                const deadline = new Date(task.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                const doneDate = task.completedAt ? new Date(task.completedAt).toLocaleDateString('pt-BR') : '';

                return `
                <div class="task-card ${isCompleted ? 'completed' : ''}">
                    <!-- Checkbox Column -->
                    <div class="task-check-wrapper">
                        <div class="task-checkbox-main" onclick="event.stopPropagation(); app.toggleTask('${task.id}')">
                            <i data-lucide="${isCompleted ? 'check' : ''}" size="18"></i>
                        </div>
                    </div>

                    <!-- Content Column -->
                    <div class="task-content-main">
                        <div class="task-title-main">${task.title}</div>
                        
                        ${task.description ? `<div class="task-desc-main">${task.description}</div>` : ''}

                        <div class="task-meta-row">
                            <div class="task-assignee-box">
                                <i data-lucide="user" size="16"></i>
                                ${task.assignee}
                            </div>

                            ${isCompleted ? `
                            <div class="task-done-info">
                                <i data-lucide="check-circle" size="16"></i>
                                Concluída em ${doneDate}
                            </div>
                            ` : ''}

                            <div class="badge-priority ${priority}">
                                ${task.priority || 'Normal'}
                            </div>
                        </div>

                        <div class="task-deadline-muted" style="display:flex; justify-content:space-between">
                            <span>Início: ${startDateStr} &nbsp;&bull;&nbsp; Conclusão: ${deadline}</span>
                            <span style="color:#111; font-weight:600">R$ ${(task.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <!-- Absolute Delete Button -->
                    <button class="btn-ghost btn-icon task-delete-btn-abs" onclick="app.deleteTask('${task.id}')" title="Excluir ação">
                        <i data-lucide="trash-2" size="16"></i>
                    </button>
                </div>
                `;
            }).join('');
        }

        this.setupIcons();
    }

    // --- Logic & Calculations ---

    calculateProgress(obj) {
        if (!obj.tasks || obj.tasks.length === 0) return 0;
        const completed = obj.tasks.filter(t => t.completed).length;
        return (completed / obj.tasks.length) * 100;
    }

    calculateTotalCost(obj) {
        if (!obj.tasks || obj.tasks.length === 0) return 0;
        return obj.tasks.reduce((sum, task) => sum + (parseFloat(task.cost) || 0), 0);
    }

    getTaskStatus(task) {
        if (task.completed) return { type: 'ok', label: 'Concluído' };

        const now = new Date();
        const due = new Date(task.dueDate);
        // Reset hours to compare dates only
        now.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        const diffTime = due - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { type: 'danger', label: 'Vencida' };
        if (diffDays === 0) return { type: 'warning', label: 'Hoje' };
        if (diffDays <= 3) return { type: 'warning', label: `${diffDays} dias` };
        return { type: 'ok', label: 'No prazo' };
    }

    // --- Actions ---

    openObjectiveModal() {
        const modal = document.getElementById('modal-objective');
        modal.classList.add('active');
    }

    openNewObjectiveModal() {
        const modal = document.getElementById('modal-objective');
        const form = modal.querySelector('form');
        form.reset();
        form.querySelector('[name="id"]').value = '';
        modal.querySelector('h3').innerText = 'Criar Nova Iniciativa';
        modal.querySelector('button[type="submit"]').innerText = 'Criar';
        this.openObjectiveModal();
    }

    openTaskModal() {
        const modal = document.getElementById('modal-task');
        modal.querySelector('form').reset();
        modal.classList.add('active');
    }

    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    }

    handleObjectiveSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');

        const parentObj = this.data.objectives.find(o => o.id === this.currentObjectiveId);
        if (!parentObj) return alert('Selecione um Objetivo primeiro.');

        if (id) {
            // Edit existing
            const ini = parentObj.initiatives.find(o => o.id === id);
            if (ini) {
                ini.title = formData.get('title');
                ini.owner = formData.get('owner');
                ini.description = formData.get('description');
                ini.dueDate = formData.get('dueDate');
            }
        } else {
            // Create new
            const newIni = {
                id: Date.now().toString(),
                objectiveId: this.currentObjectiveId,
                title: formData.get('title'),
                owner: formData.get('owner'),
                description: formData.get('description'),
                dueDate: formData.get('dueDate'),
                createdAt: new Date().toISOString(),
                tasks: []
            };
            if (!parentObj.initiatives) parentObj.initiatives = [];
            parentObj.initiatives.push(newIni);
        }

        this.save();
        this.closeModals();
        e.target.reset();
        e.target.querySelector('[name="id"]').value = '';
    }

    // --- Top Objective Methods ---

    openTopObjectiveModal() {
        const modal = document.getElementById('modal-top-objective');
        const form = modal.querySelector('form');
        form.reset();
        form.querySelector('[name="id"]').value = '';
        modal.querySelector('h3').innerText = 'Criar Novo Objetivo';
        modal.classList.add('active');
    }

    handleTopObjectiveSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');

        if (id) {
            const obj = this.data.objectives.find(o => o.id === id);
            if (obj) {
                obj.title = formData.get('title');
                obj.owner = formData.get('owner');
                obj.description = formData.get('description');
                obj.dueDate = formData.get('dueDate');
            }
        } else {
            const newObj = {
                id: Date.now().toString(),
                title: formData.get('title'),
                owner: formData.get('owner'),
                description: formData.get('description'),
                dueDate: formData.get('dueDate'),
                createdAt: new Date().toISOString(),
                initiatives: []
            };
            this.data.objectives.push(newObj);
            this.currentObjectiveId = newObj.id; // Select by default
        }

        this.save();
        this.closeModals();
    }

    editObjective(id) {
        let ini = null;
        for (const top of this.data.objectives) {
            ini = top.initiatives.find(i => i.id === id);
            if (ini) break;
        }
        if (!ini) return;

        const modal = document.getElementById('modal-objective');
        const form = modal.querySelector('form');

        form.querySelector('[name="id"]').value = ini.id;
        form.querySelector('[name="title"]').value = ini.title;
        form.querySelector('[name="owner"]').value = ini.owner || '';
        form.querySelector('[name="dueDate"]').value = ini.dueDate;
        form.querySelector('[name="description"]').value = ini.description || '';

        modal.querySelector('h3').innerText = 'Editar Iniciativa';
        modal.querySelector('button[type="submit"]').innerText = 'Salvar Alterações';

        this.openObjectiveModal();
    }

    openObjectiveModal() {
        const modal = document.getElementById('modal-objective');

        // Reset if opening effectively as "New" (no ID present in form, or clear it if it was left over? 
        // Better to clear it here if calling strictly "openObjectiveModal" usually means new, 
        // but editObjective calls openObjectiveModal too. 
        // So we should rely on "editObjective" to set the values, and if just opening directly, clear them.)

        // However, usually buttons call openObjectiveModal directly. 
        // Let's modify the standard open to clear the form.
        if (!modal.classList.contains('active')) {
            // If we are just opening it and it wasn't triggered by editObjective (checked via empty logic potentially, 
            // but simpler: Reset form if the title is not set or custom flag?)
            // Actually, let's just make sure we reset the UI text to "Criar" if the hidden ID is empty.
            const form = modal.querySelector('form');
            const idVal = form.querySelector('[name="id"]').value;
            if (!idVal) {
                form.reset();
                modal.querySelector('h3').innerText = 'Criar Nova Iniciativa';
                modal.querySelector('button[type="submit"]').innerText = 'Criar';
            }
        }

        modal.classList.add('active');
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        if (!this.currentInitiativeId) return;

        const formData = new FormData(e.target);

        let targetIni = null;
        for (const top of this.data.objectives) {
            targetIni = top.initiatives.find(i => i.id === this.currentInitiativeId);
            if (targetIni) break;
        }

        if (targetIni) {
            const newTask = {
                id: Date.now().toString(),
                initiativeId: this.currentInitiativeId,
                title: formData.get('title'),
                description: formData.get('description'),
                assignee: formData.get('assignee'),
                priority: formData.get('priority'),
                startDate: formData.get('startDate'),
                dueDate: formData.get('dueDate'),
                cost: parseFloat(formData.get('cost')) || 0,
                completed: false,
                completedAt: null
            };

            if (!targetIni.tasks) targetIni.tasks = [];
            targetIni.tasks.push(newTask);
            this.save();
            this.closeModals();
            e.target.reset();
        }
    }

    toggleTask(taskId) {
        let initiative = null;
        for (const top of this.data.objectives) {
            initiative = top.initiatives.find(i => i.id === this.currentInitiativeId);
            if (initiative) break;
        }

        if (initiative) {
            const task = initiative.tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = !task.completed;
                task.completedAt = task.completed ? new Date().toISOString() : null;
                this.save();
                this.renderDetails(this.currentInitiativeId);
            }
        }
    }

    deleteTask(taskId) {
        if (!confirm('Tem certeza que deseja apagar esta ação?')) return;

        let initiative = null;
        for (const top of this.data.objectives) {
            initiative = top.initiatives.find(i => i.id === this.currentInitiativeId);
            if (initiative) break;
        }

        if (initiative) {
            initiative.tasks = initiative.tasks.filter(t => t.id !== taskId);
            this.save();
            this.renderDetails(this.currentInitiativeId);
        }
    }

    downloadBackup() {
        // CSV Header
        const headers = ["Objetivo Estratégico", "Objetivo", "Progresso Objetivo", "Ação", "Responsável", "Prazo", "Custo", "Status"];
        let csvContent = headers.join(",") + "\n";

        this.data.objectives.forEach(top => {
            if (!top.initiatives || top.initiatives.length === 0) {
                const row = [`"${top.title.replace(/"/g, '""')}"`, "", "", "", "", "", ""];
                csvContent += row.join(",") + "\n";
                return;
            }

            top.initiatives.forEach(ini => {
                const progress = Math.round(this.calculateProgress(ini)) + '%';

                if (ini.tasks && ini.tasks.length > 0) {
                    ini.tasks.forEach(task => {
                        const taskStatus = task.completed ? "Concluído" : this.getTaskStatus(task).label;
                        const row = [
                            `"${top.title.replace(/"/g, '""')}"`,
                            `"${ini.title.replace(/"/g, '""')}"`,
                            `"${progress}"`,
                            `"${task.title.replace(/"/g, '""')}"`,
                            `"${task.assignee.replace(/"/g, '""')}"`,
                            `"${task.dueDate}"`,
                            `"${task.cost || 0}"`,
                            `"${taskStatus}"`
                        ];
                        csvContent += row.join(",") + "\n";
                    });
                } else {
                    const row = [
                        `"${top.title.replace(/"/g, '""')}"`,
                        `"${ini.title.replace(/"/g, '""')}"`,
                        `"${progress}"`,
                        "", "", "", ""
                    ];
                    csvContent += row.join(",") + "\n";
                }
            });
        });

        // Add BOM for correct Excel encoding
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const date = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `planejamento_export_${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize App
const app = new App();
