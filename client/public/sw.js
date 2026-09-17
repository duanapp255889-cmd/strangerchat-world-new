self.addEventListener("push", (event) => {
  let data = { title: "Stranger Chat", body: "Phòng chat đã mở cửa. Vào trò chuyện ngay!", url: "https://strangerchat.world/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/og-image.jpg",
    badge: "/og-image.jpg",
    tag: "stranger-chat-open",
    renotify: true,
    data: { url: data.url },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const target = event.notification.data?.url || "https://strangerchat.world/";
    for (const client of windows) if ("focus" in client) { client.navigate(target); return client.focus(); }
    return clients.openWindow(target);
  }));
});
