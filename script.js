class ReminderSystem {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.reminders = this.loadReminders();
        this.notificationIntervals = new Map();
        this.audioContext = null;
        this.init();
    }

    async init() {
        console.log('🚀 Iniciando sistema...');
        this.renderCalendar();
        this.bindEvents();
        this.renderRemindersList();
        this.setDefaultDate();
        await this.requestNotificationPermission();
        await this.initServiceWorker();
        this.startNotificationSystem();
        console.log('✅ Sistema iniciado!');
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            console.log('🔔 Status atual das notificações:', Notification.permission);
            
            if (Notification.permission === 'default') {
                console.log('📋 Solicitando permissão...');
                
                try {
                    const permission = await Notification.requestPermission();
                    console.log('🔔 Resposta da permissão:', permission);
                    
                    if (permission === 'granted') {
                        console.log('✅ Permissão concedida!');
                        this.showBrowserNotification('🔔 Notificações Ativadas!', {
                            body: 'Você receberá lembretes automáticos a cada 45 minutos.',
                            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232196f3"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'
                        });
                    } else {
                        console.warn('❌ Permissão negada pelo usuário');
                    }
                } catch (error) {
                    console.error('❌ Erro ao solicitar permissão:', error);
                }
            } else if (Notification.permission === 'granted') {
                console.log('✅ Notificações já permitidas');
            } else {
                console.warn('❌ Notificações bloqueadas pelo usuário');
            }
        } else {
            console.warn('❌ Notificações não suportadas neste navegador');
        }
    }

    async initServiceWorker() {
        // Verifica se está rodando via file:// protocol
        if (location.protocol === 'file:') {
            console.warn('⚠️ Service Worker não disponível no protocolo file://. Usando sistema de notificações alternativo.');
            this.useAlternativeNotifications = true;
            return null;
        }
        
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('✅ Service Worker registrado:', registration);
                
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
                this.useAlternativeNotifications = false;
                return registration;
            } catch (error) {
                console.error('❌ Erro ao registrar Service Worker:', error);
                console.warn('⚠️ Usando sistema de notificações alternativo.');
                this.useAlternativeNotifications = true;
                return null;
            }
        } else {
            console.warn('⚠️ Service Worker não suportado. Usando sistema de notificações alternativo.');
            this.useAlternativeNotifications = true;
            return null;
        }
    }

    startNotificationSystem() {
        setInterval(() => {
            this.checkActiveReminders();
        }, 60000);
        
        this.checkActiveReminders();
    }

    checkActiveReminders() {
        const now = new Date();
        const activeReminders = this.reminders.filter(reminder => {
            if (reminder.completed) return false;
            
            const reminderDateTime = new Date(`${reminder.date}T${reminder.time}`);
            const timeDiff = now - reminderDateTime;
            
            return timeDiff >= 0;
        });

        activeReminders.forEach(reminder => {
            if (!this.notificationIntervals.has(reminder.id)) {
                this.startReminderNotifications(reminder);
            }
        });
    }

    startReminderNotifications(reminder) {
        console.log(`🔔 Iniciando notificações para: ${reminder.title}`);
        
        this.showReminderNotification(reminder);
        
        const intervalId = setInterval(() => {
            if (!reminder.completed) {
                this.showReminderNotification(reminder);
            } else {
                this.stopReminderNotifications(reminder.id);
            }
        }, 45 * 60 * 1000);
        
        this.notificationIntervals.set(reminder.id, intervalId);
    }

    stopReminderNotifications(reminderId) {
        const intervalId = this.notificationIntervals.get(reminderId);
        if (intervalId) {
            clearInterval(intervalId);
            this.notificationIntervals.delete(reminderId);
            console.log(`⏹️ Notificações paradas para lembrete: ${reminderId}`);
        }
    }

    showReminderNotification(reminder) {
        this.playNotificationSound();
        
        this.showBrowserNotification(`⏰ ${reminder.title}`, {
            body: `${reminder.description}\n\n📅 ${new Date(reminder.date).toLocaleDateString('pt-BR')} às ${reminder.time}`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff9800"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
            tag: `reminder-${reminder.id}`,
            requireInteraction: true,
            data: { reminderId: reminder.id }
        });
        
        this.showNotificationModal(reminder);
    }

    showBrowserNotification(title, options = {}) {
        if (Notification.permission === 'granted') {
            try {
                const notification = new Notification(title, {
                    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232196f3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
                    ...options
                });
                
                if (!options.requireInteraction) {
                    setTimeout(() => notification.close(), 10000);
                }
                
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    if (options.data && options.data.reminderId) {
                        this.highlightReminder(options.data.reminderId);
                    }
                };
                
                return notification;
            } catch (error) {
                console.error('❌ Erro ao criar notificação:', error);
            }
        }
    }

    playNotificationSound() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('⚠️ Não foi possível reproduzir som:', error);
        }
    }

    showNotificationModal(reminder) {
        const modal = document.getElementById('notificationModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalDescription = document.getElementById('modalDescription');
        const modalDateTime = document.getElementById('modalDateTime');
        const completeBtn = document.getElementById('completeBtn');
        const snoozeBtn = document.getElementById('snoozeBtn');
        const closeModal = document.getElementById('closeModal');
        
        modalTitle.textContent = `🔔 ${reminder.title}`;
        modalDescription.textContent = reminder.description;
        modalDateTime.textContent = `📅 ${new Date(reminder.date).toLocaleDateString('pt-BR')} às ${reminder.time}`;
        
        modal.classList.add('show');
        
        const handleComplete = () => {
            this.completeFromNotification(reminder.id);
            modal.classList.remove('show');
            cleanup();
        };
        
        const handleSnooze = () => {
            this.snoozeFromNotification(reminder.id);
            modal.classList.remove('show');
            cleanup();
        };
        
        const handleClose = () => {
            modal.classList.remove('show');
            cleanup();
        };
        
        const cleanup = () => {
            completeBtn.removeEventListener('click', handleComplete);
            snoozeBtn.removeEventListener('click', handleSnooze);
            closeModal.removeEventListener('click', handleClose);
            modal.removeEventListener('click', handleModalClick);
        };
        
        const handleModalClick = (e) => {
            if (e.target === modal) {
                handleClose();
            }
        };
        
        completeBtn.addEventListener('click', handleComplete);
        snoozeBtn.addEventListener('click', handleSnooze);
        closeModal.addEventListener('click', handleClose);
        modal.addEventListener('click', handleModalClick);
    }

    completeFromNotification(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (reminder) {
            reminder.completed = true;
            this.saveReminders();
            this.renderRemindersList();
            this.renderCalendar();
            this.stopReminderNotifications(reminderId);
            console.log(`✅ Lembrete concluído: ${reminder.title}`);
        }
    }

    snoozeFromNotification(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (reminder) {
            const currentDateTime = new Date(`${reminder.date}T${reminder.time}`);
            const newDateTime = new Date(currentDateTime.getTime() + 45 * 60 * 1000);
            
            reminder.date = newDateTime.toISOString().split('T')[0];
            reminder.time = newDateTime.toTimeString().slice(0, 5);
            
            this.saveReminders();
            this.renderRemindersList();
            this.renderCalendar();
            this.stopReminderNotifications(reminderId);
            
            console.log(`⏰ Lembrete adiado para: ${reminder.date} às ${reminder.time}`);
        }
    }

    highlightReminder(reminderId) {
        const reminderElement = document.querySelector(`[data-reminder-id="${reminderId}"]`);
        if (reminderElement) {
            reminderElement.classList.add('highlighted');
            setTimeout(() => {
                reminderElement.classList.remove('highlighted');
            }, 3000);
        }
    }

    handleServiceWorkerMessage(data) {
        if (data.type === 'REMINDER_ACTION') {
            if (data.action === 'complete') {
                this.completeFromNotification(data.reminderId);
            } else if (data.action === 'snooze') {
                this.snoozeFromNotification(data.reminderId);
            }
        }
    }

    renderCalendar() {
        console.log('📅 Renderizando calendário...');
        const calendar = document.getElementById('calendar');
        const currentMonthElement = document.getElementById('currentMonth');
        
        const existingDays = calendar.querySelectorAll('.calendar-day');
        existingDays.forEach(day => day.remove());
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        currentMonthElement.textContent = new Intl.DateTimeFormat('pt-BR', {
            month: 'long',
            year: 'numeric'
        }).format(this.currentDate);
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = date.getDate();
            
            if (date.getMonth() !== month) {
                dayElement.style.opacity = '0.3';
            }
            
            if (this.isToday(date)) {
                dayElement.classList.add('today');
            }
            
            if (this.selectedDate && date.toDateString() === this.selectedDate.toDateString()) {
                dayElement.classList.add('selected');
            }
            
            if (this.hasReminders(date)) {
                dayElement.classList.add('has-reminder');
            }
            
            dayElement.addEventListener('click', () => {
                this.selectDate(date);
            });
            
            calendar.appendChild(dayElement);
        }
        
        console.log('✅ Calendário renderizado com 42 dias');
    }

    bindEvents() {
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });
        
        document.getElementById('reminderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addReminder();
        });
    }

    selectDate(date) {
        this.selectedDate = date;
        this.updateDateInput(date);
        this.renderCalendar();
    }

    updateDateInput(date) {
        const dateInput = document.getElementById('reminderDate');
        dateInput.value = date.toISOString().split('T')[0];
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    hasReminders(date) {
        const dateString = date.toISOString().split('T')[0];
        return this.reminders.some(reminder => 
            reminder.date === dateString && !reminder.completed
        );
    }

    setDefaultDate() {
        const today = new Date();
        this.selectDate(today);
        
        const timeInput = document.getElementById('reminderTime');
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        timeInput.value = now.toTimeString().slice(0, 5);
    }

    addReminder() {
        const date = document.getElementById('reminderDate').value;
        const time = document.getElementById('reminderTime').value;
        const title = document.getElementById('reminderTitle').value;
        const description = document.getElementById('reminderDescription').value;
        
        if (!date || !time || !title) {
            alert('Por favor, preencha todos os campos obrigatórios!');
            return;
        }
        
        const reminder = {
            id: Date.now().toString(),
            date,
            time,
            title,
            description,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        this.reminders.push(reminder);
        this.saveReminders();
        this.renderRemindersList();
        this.renderCalendar();
        this.clearForm();
        
        console.log('✅ Lembrete adicionado:', reminder);
    }

    clearForm() {
        document.getElementById('reminderTitle').value = '';
        document.getElementById('reminderDescription').value = '';
    }

    renderRemindersList() {
        const container = document.getElementById('remindersList');
        
        if (this.reminders.length === 0) {
            container.innerHTML = '<p class="no-reminders">Nenhum lembrete cadastrado ainda.</p>';
            return;
        }
        
        const sortedReminders = [...this.reminders].sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA - dateB;
        });
        
        container.innerHTML = sortedReminders.map(reminder => `
            <div class="reminder-item ${reminder.completed ? 'completed' : ''}" data-reminder-id="${reminder.id}">
                <div class="reminder-header">
                    <h4 class="reminder-title">${reminder.title}</h4>
                    <span class="reminder-datetime">
                        📅 ${new Date(reminder.date).toLocaleDateString('pt-BR')} às ${reminder.time}
                    </span>
                </div>
                <p class="reminder-description">${reminder.description}</p>
                <div class="reminder-actions">
                    <button class="action-btn ${reminder.completed ? 'reactivate' : 'complete'}" 
                            onclick="reminderSystem.toggleComplete('${reminder.id}')">
                        ${reminder.completed ? '🔄 Reativar' : '✅ Concluir'}
                    </button>
                    <button class="action-btn delete" onclick="reminderSystem.deleteReminder('${reminder.id}')">
                        🗑️ Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    toggleComplete(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            reminder.completed = !reminder.completed;
            
            if (reminder.completed) {
                this.stopReminderNotifications(id);
            }
            
            this.saveReminders();
            this.renderRemindersList();
            this.renderCalendar();
        }
    }

    deleteReminder(id) {
        if (confirm('Tem certeza que deseja excluir este lembrete?')) {
            this.reminders = this.reminders.filter(r => r.id !== id);
            this.stopReminderNotifications(id);
            this.saveReminders();
            this.renderRemindersList();
            this.renderCalendar();
        }
    }

    saveReminders() {
        localStorage.setItem('reminders', JSON.stringify(this.reminders));
    }

    loadReminders() {
        const saved = localStorage.getItem('reminders');
        return saved ? JSON.parse(saved) : [];
    }
}

let reminderSystem;

document.addEventListener('DOMContentLoaded', () => {
    reminderSystem = new ReminderSystem();
});