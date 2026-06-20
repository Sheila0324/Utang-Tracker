// ============================================================
// UTANG TRACKER — SERVICE WORKER
// Handles push notifications from Firebase Cloud Messaging (FCM)
// and shows them in the phone's notification bar.
// ============================================================

// ── STEP 1: Paste your Firebase config here ────────────────
// Get this from: Firebase Console → Project Settings → Your apps → Web app → Config
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD0O3ThM2Indy9DpyEvK88-mR_V7IGzUdM",
  authDomain:        "utang-tracker-ae2cd.firebaseapp.com",
  projectId:         "utang-tracker-ae2cd",
  storageBucket:     "utang-tracker-ae2cd.firebasestorage.app",
  messagingSenderId: "939567910786",
  appId:             "1:939567910786:web:44d79785b0358753fc499b",
};
// ────────────────────────────────────────────────────────────

const CACHE_NAME = 'utang-tracker-v2';
const APP_ICON   = './icon-192.png';

// ── Install & Activate ──────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

// ── Firebase Messaging background handler ───────────────────
// This is automatically called by the Firebase SW SDK
// when a push arrives while the app is in the background/closed.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Handle background push messages (app closed or in background)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background push received:', payload);

  const title = payload.notification?.title || '💸 Utang Tracker';
  const body  = payload.notification?.body  || 'You have an upcoming due date.';
  const data  = payload.data || {};

  const options = {
    body,
    icon:  APP_ICON,
    badge: APP_ICON,
    tag:   data.tag || 'utang-reminder',
    data:  { url: data.url || './' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: '📋 View App' },
      { action: 'dismiss', title: '✕ Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Direct push event (from Supabase Edge Function payload) ─
// Handles the raw push when not using Firebase SDK format
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data?.text() || 'Reminder from Utang Tracker' };
  }

  const title = data.title || '💸 Utang Tracker';
  const body  = data.body  || 'You have an upcoming payment due.';

  const options = {
    body,
    icon:  APP_ICON,
    badge: APP_ICON,
    tag:   data.tag || 'utang-reminder-' + Date.now(),
    data:  { url: data.url || './' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click handler ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('Utang') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Periodic sync (optional — checks reminders every hour when supported) ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotifyReminders());
  }
});

async function checkAndNotifyReminders() {
  // Notify the main page to run its reminder check
  const clientList = await clients.matchAll({ type: 'window' });
  for (const client of clientList) {
    client.postMessage({ type: 'CHECK_REMINDERS' });
  }
}
