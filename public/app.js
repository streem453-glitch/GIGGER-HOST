(() => {
  const $ = id => document.getElementById(id);
  let adminPassword = "";
  let sentCount = 0;
  let toastTimer;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  function toast(message, error = false) {
    const el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (error ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.className = "toast", 3800);
  }
  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", "x-admin-password": adminPassword, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      $("auth-overlay").classList.remove("hidden");
      throw new Error(data.error || "Нужна авторизация.");
    }
    if (!response.ok) throw new Error(data.error || "Ошибка запроса.");
    return data;
  }
  function setConnected(bot) {
    $("bot-status").textContent = bot ? "Подключён" : "Не подключён";
    $("bot-name").textContent = bot ? "@" + bot.username : "Подключи токен ниже";
    $("side-status").textContent = bot ? "@" + bot.username : "Бот не подключён";
    $("connection-pill").textContent = bot ? "ONLINE" : "OFFLINE";
    $("connection-pill").classList.toggle("online", Boolean(bot));
    $("connect-btn").textContent = bot ? "Переподключить" : "Подключить бота";
  }
  async function refreshEvents() {
    const data = await api("/api/events");
    const list = $("events-list");
    $("event-count").textContent = data.events.length;
    if (!data.events.length) {
      list.innerHTML = '<div class="empty">Пока событий нет. Подключи бота или отправь сообщение.</div>';
      return;
    }
    list.innerHTML = data.events.map(ev => `<div class="event"><span class="event-dot ${escapeHtml(ev.type)}"></span><div class="event-main"><p>${escapeHtml(ev.message)}</p><time>${new Date(ev.time).toLocaleString("ru-RU")}</time></div></div>`).join("");
  }
  async function refreshStatus() {
    const data = await api("/api/status");
    setConnected(data.connected ? data.bot : null);
    await refreshEvents();
  }
  $("auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    adminPassword = $("admin-password").value;
    try {
      await refreshStatus();
      $("auth-overlay").classList.add("hidden");
      $("admin-password").value = "";
      toast("Вход выполнен.");
    } catch (err) { toast(err.message, true); }
  });
  $("toggle-token").addEventListener("click", () => {
    $("token").type = $("token").type === "password" ? "text" : "password";
  });
  $("connect-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("connect-btn");
    btn.disabled = true;
    try {
      const data = await api("/api/connect", { method: "POST", body: JSON.stringify({ token: $("token").value.trim() }) });
      setConnected(data.bot);
      $("token").value = "";
      await refreshEvents();
      toast(`Подключён бот @${data.bot.username}`);
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; }
  });
  $("disconnect-btn").addEventListener("click", async () => {
    try {
      await api("/api/disconnect", { method: "POST", body: "{}" });
      setConnected(null);
      await refreshEvents();
      toast("Бот отключён от панели.");
    } catch (err) { toast(err.message, true); }
  });
  $("send-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("send-btn");
    const chatId = $("chat-id").value.trim();
    const text = $("message").value;
    const sticker = $("sticker-id").value.trim();
    const buttonText = $("button-text").value.trim();
    const buttonUrl = $("button-url").value.trim();
    if (!text.trim() && !sticker) return toast("Добавь текст или file_id стикера.", true);
    if (Boolean(buttonText) !== Boolean(buttonUrl)) return toast("Для кнопки заполни и текст, и ссылку.", true);
    if (buttonUrl && !/^https?:\/\//i.test(buttonUrl)) return toast("Ссылка кнопки должна начинаться с https:// или http://.", true);
    btn.disabled = true;
    btn.textContent = "Отправка…";
    try {
      const buttons = buttonText && buttonUrl ? [{ text: buttonText, url: buttonUrl }] : [];
      await api("/api/send", { method: "POST", body: JSON.stringify({ chatId, text, sticker, parseMode: $("parse-mode").value, buttons }) });
      sentCount++;
      $("sent-count").textContent = sentCount;
      await refreshEvents();
      toast("Отправлено! Проверь чат Telegram.");
    } catch (err) { toast(err.message, true); await refreshEvents().catch(() => {}); }
    finally { btn.disabled = false; btn.textContent = "➤ Отправить"; }
  });
  document.querySelectorAll("[data-emoji]").forEach(btn => btn.addEventListener("click", () => {
    const area = $("message");
    const start = area.selectionStart, end = area.selectionEnd;
    area.value = area.value.slice(0, start) + btn.dataset.emoji + area.value.slice(end);
    area.focus();
    area.selectionStart = area.selectionEnd = start + btn.dataset.emoji.length;
  }));
  $("refresh-events").addEventListener("click", () => refreshEvents().then(() => toast("Журнал обновлён.")).catch(err => toast(err.message, true)));
})();
