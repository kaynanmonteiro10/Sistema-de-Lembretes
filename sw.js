const CACHE_NAME = 'reminder-system-v3';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js'
];

self.addEventListener('install', event => {
    console.log('Service Worker instalado');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker ativado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'START_BACKGROUND_SYNC') {
        startBackgroundSync();
    } else if (event.data && event.data.type === 'STOP_BACKGROUND_SYNC') {
        stopBackgroundSync();
    }
});

let reminderCheckInterval;

function startBackgroundSync() {
    if (reminderCheckInterval) {
        clearInterval(reminderCheckInterval);
    }
    
    reminderCheckInterval = setInterval(() => {
        checkRemindersInBackground();
    }, 60000);
    
    checkRemindersInBackground();
}

function stopBackgroundSync() {
    if (reminderCheckInterval) {
        clearInterval(reminderCheckInterval);
        reminderCheckInterval = null;
    }
}

async function checkRemindersInBackground() {
    try {
        const clients = await self.clients.matchAll();
        
        if (clients.length > 0) {
            return;
        }
        
        const reminders = await getRemindersFromCache();
        
        if (reminders && reminders.length > 0) {
            const now = new Date();
            
            reminders.forEach(reminder => {
                if (!reminder.completed) {
                    const reminderTime = new Date(`${reminder.date}T${reminder.time}`);
                    const timeDiff = now.getTime() - reminderTime.getTime();
                    
                    if (timeDiff >= 0 && timeDiff <= 60000) {
                        showBackgroundNotification(reminder);
                    }
                    
                    const minutesSinceReminder = Math.floor(timeDiff / (1000 * 60));
                    if (minutesSinceReminder > 0 && minutesSinceReminder % 45 === 0) {
                        showBackgroundNotification(reminder);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Erro ao verificar lembretes em background:', error);
    }
}

function showBackgroundNotification(reminder) {
    const options = {
        body: reminder.description,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
        tag: reminder.id,
        requireInteraction: true,
        actions: [
            {
                action: 'complete',
                title: 'Marcar como Concluído'
            },
            {
                action: 'snooze',
                title: 'Lembrar em 45min'
            }
        ],
        data: {
            reminderId: reminder.id,
            reminderTitle: reminder.title
        }
    };
    
    self.registration.showNotification(`🔔 ${reminder.title}`, options);
}

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'complete') {
        handleReminderAction('complete', event.notification.data.reminderId);
    } else if (event.action === 'snooze') {
        handleReminderAction('snooze', event.notification.data.reminderId);
    } else {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});

async function handleReminderAction(action, reminderId) {
    const clients = await self.clients.matchAll();
    
    if (clients.length > 0) {
        clients[0].postMessage({
            type: 'REMINDER_ACTION',
            action: action,
            reminderId: reminderId
        });
    }
}

async function getRemindersFromCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match('./reminders-data');
        
        if (response) {
            return await response.json();
        }
        
        return [];
    } catch (error) {
        console.error('Erro ao obter lembretes do cache:', error);
        return [];
    }
}

async function saveRemindersToCache(reminders) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(JSON.stringify(reminders));
        await cache.put('./reminders-data', response);
    } catch (error) {
        console.error('Erro ao salvar lembretes no cache:', error);
    }
}