(function () {
  "use strict";

  const TG = window.Telegram && window.Telegram.WebApp;
  if (!TG) {
    document.getElementById("loader").innerHTML = "<p>Откройте приложение из Telegram.</p>";
    return;
  }

  TG.ready();
  TG.expand();

  const BASE = window.__MINIAPP_BASE__ || "";
  const API_BASE = BASE + "/miniapp";

  function parseInitDataFromUrl() {
    try {
      var hash = (window.location.hash || "").replace(/^#/, "");
      var search = (window.location.search || "").replace(/^\?/, "");
      var params = new URLSearchParams(hash || search);
      var fromHash = new URLSearchParams(hash);
      var tgData = params.get("tgWebAppData") || fromHash.get("tgWebAppData");
      if (tgData) return decodeURIComponent(tgData);
      if (hash && hash.indexOf("=") >= 0 && hash.indexOf("hash=") >= 0) return hash;
      return "";
    } catch (e) {
      return "";
    }
  }

  function getInitData() {
    if (TG && TG.initData) return TG.initData;
    return parseInitDataFromUrl();
  }

  function appendInitData(url) {
    const init = getInitData();
    if (!init) return url;
    const sep = url.indexOf("?") >= 0 ? "&" : "?";
    return url + sep + "init_data=" + encodeURIComponent(init);
  }

  const ERROR_MESSAGES = {
    init_data_missing: "Откройте приложение из Telegram: кнопка меню (☰) слева от поля ввода → «Открыть приложение» или нажмите кнопку в сообщении бота (не по прямой ссылке в браузере).",
    init_data_invalid: "Сессия устарела. Закройте приложение и откройте снова из меню бота (☰) или по кнопке в чате.",
    user_not_found: "Пройдите регистрацию в боте и дождитесь одобрения, затем откройте приложение снова.",
  };

  function api(path, options = {}) {
    let url = (path.startsWith("http") ? path : API_BASE + path);
    url = appendInitData(url);
    const headers = {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      "ngrok-skip-browser-warning": "1",
      ...options.headers,
    };
    return fetch(url, { ...options, headers }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = data.detail || data.message || r.statusText || "Ошибка";
        let msg;
        if (typeof detail === "string" && ERROR_MESSAGES[detail]) msg = ERROR_MESSAGES[detail];
        else if (typeof detail === "string") msg = detail;
        else if (Array.isArray(detail) && detail[0] && typeof detail[0].msg === "string") msg = detail[0].msg;
        else if (detail && typeof detail === "object" && (detail.msg || detail.message)) msg = detail.msg || detail.message;
        else msg = "Ошибка запроса";
        throw new Error(msg);
      }
      return data;
    });
  }

  function errorToMessage(err) {
    if (err && typeof err.message === "string") return err.message;
    if (typeof err === "string") return err;
    return "Ошибка";
  }

  const state = {
    user: null,
    screen: "home",
    stack: [],
    tenders: [],
    applications: [],
    supportTickets: [],
    currentTenderId: null,
    currentApplicationId: null,
    currentTicketId: null,
    currentTicket: null,
    supportError: null,
    skills: [],
  };

  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const headerTitle = $("headerTitle");
  const btnBack = $("btnBack");
  const tabbar = $("tabbar");
  const app = $("app");
  const loader = $("loader");
  const errorScreen = $("error-screen");
  const errorText = $("errorText");

  function showLoader() {
    loader.classList.remove("hidden");
    app.classList.add("hidden");
    errorScreen.classList.add("hidden");
  }

  function showApp() {
    loader.classList.add("hidden");
    errorScreen.classList.add("hidden");
    app.classList.remove("hidden");
  }

  function showError(msg) {
    loader.classList.add("hidden");
    app.classList.add("hidden");
    errorScreen.classList.remove("hidden");
    errorText.textContent = msg;
  }

  function setHeader(title, showBack) {
    headerTitle.textContent = title;
    if (showBack) {
      btnBack.classList.remove("hidden");
    } else {
      btnBack.classList.add("hidden");
    }
  }

  function setTabbarActive(screen) {
    tabbar.querySelectorAll(".tabbar-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.screen === screen);
    });
  }

  function navigate(screen, push = true) {
    if (push && state.screen) state.stack.push(state.screen);
    state.screen = screen;
    setTabbarActive(screen);
    if (screen === "tenders") markTendersSeen();
    loadScreenData().then(() => render()).catch((err) => {
      if (TG && TG.showAlert) TG.showAlert(errorToMessage(err) || "Ошибка загрузки");
      render();
    });
    onScreenChange();
  }

  function back() {
    if (state.stack.length) {
      state.screen = state.stack.pop();
      setTabbarActive(state.screen);
      loadScreenData().then(() => render()).catch(() => render());
    } else {
      navigate("home", false);
      return;
    }
    onScreenChange();
  }

  function render() {
    const s = state.screen;
    setHeader(getScreenTitle(s), state.stack.length > 0);

    if (s === "home") main.innerHTML = renderHome();
    else if (s === "tenders") main.innerHTML = renderTendersList();
    else if (s === "tender" && state.currentTenderId) main.innerHTML = renderTenderDetail();
    else if (s === "applications") main.innerHTML = renderApplicationsList();
    else if (s === "application" && state.currentApplicationId) main.innerHTML = renderApplicationDetail();
    else if (s === "support") main.innerHTML = renderSupportList();
    else if (s === "support_chat" && state.currentTicketId) {
      main.innerHTML = renderSupportChat();
      setTimeout(function () {
        const el = main.querySelector("#supportMessages");
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }
    else if (s === "profile") main.innerHTML = renderProfile();
    else if (s === "profile_edit") main.innerHTML = renderProfileEdit();
    else main.innerHTML = "<p>Загрузка...</p>";

    bindEvents();
  }

  function getScreenTitle(s) {
    const titles = {
      home: "TenderBot",
      tenders: "Заказы",
      tender: "Заказ",
      applications: "Мои отклики",
      application: "Отклик",
      support: "Поддержка",
      support_chat: "Чат",
      profile: "Профиль",
      profile_edit: "Редактирование",
    };
    return titles[s] || "TenderBot";
  }

  function ticketStatusLabel(st) {
    const l = { new: "Новый", in_progress: "В работе", closed: "Закрыт" };
    return l[st] || st;
  }

  function renderHome() {
    const u = state.user;
    const statusText = u.status === "active" ? "Активен" : u.status === "pending_moderation" ? "На модерации" : "Заблокирован";
    return `
      <div class="screen">
        <div class="card welcome-card">
          <h2 class="card-title">Привет, ${escapeHtml(u.full_name)}!</h2>
          <p class="card-meta">${escapeHtml(u.city)} · ${statusText}</p>
          <p class="card-desc">Здесь вы можете просматривать заказы, откликаться и следить за своими откликами.</p>
        </div>
        <div class="quick-actions">
          <button type="button" class="btn btn-primary" data-go="tenders">📋 Смотреть заказы</button>
          <button type="button" class="btn btn-secondary" data-go="applications">📩 Мои отклики</button>
          <button type="button" class="btn btn-secondary" data-go="support">💬 Поддержка</button>
          <button type="button" class="btn btn-secondary" data-go="profile">👤 Профиль</button>
        </div>
      </div>
    `;
  }

  function renderTendersList() {
    const list = state.tenders.length
      ? state.tenders
          .map(
            (t) => `
        <div class="card tender-card" data-tender-id="${t.id}">
          <h3 class="card-title">${escapeHtml(t.title)} <span class="badge ${t.has_applied ? "badge-applied" : "badge-open"}">${t.has_applied ? "Отклик отправлен" : "Прием заявок"}</span></h3>
          <p class="card-meta">${escapeHtml(t.city)} · ${escapeHtml(t.category)} ${t.budget ? " · " + escapeHtml(t.budget) : ""}</p>
          <p class="card-desc">${escapeHtml((t.description || "").slice(0, 120))}${(t.description || "").length > 120 ? "…" : ""}</p>
        </div>
      `
          )
          .join("")
      : '<div class="empty-state"><div class="empty-icon">📋</div><p>Нет открытых заказов в вашем городе.</p></div>';
    return `<div class="screen"><h2 class="screen-title">Заказы</h2>${list}</div>`;
  }

  function renderTenderDetail() {
    const t = state.currentTender;
    if (!t) return '<div class="screen"><p>Загрузка...</p></div>';
    const deadlineDate = t.deadline ? new Date(t.deadline) : null;
    const deadlineStr = deadlineDate ? deadlineDate.toLocaleString("ru-RU") : "Не указан";
    const msLeft = deadlineDate ? deadlineDate.getTime() - Date.now() : null;
    const nearDeadline = t.status === "open" && msLeft !== null && msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000;
    const canApply = !t.has_applied && t.status === "open";
    return `
      <div class="screen">
        <div class="card">
          <h2 class="card-title">${escapeHtml(t.title)}</h2>
          <p class="card-meta">${escapeHtml(t.city)} · ${escapeHtml(t.category)}</p>
          <p class="card-meta">💰 ${escapeHtml(t.budget || "По договорённости")} · ⏰ ${deadlineStr}</p>
          ${nearDeadline ? '<p class="app-status applied">⚠️ До окончания приема заявок осталось меньше 24 часов.</p>' : ""}
        </div>
        <div class="detail-section">
          <h3>Описание</h3>
          <p>${escapeHtml(t.description || "")}</p>
        </div>
        ${canApply ? '<button type="button" class="btn btn-primary" id="btnApply">📩 Откликнуться</button>' : t.has_applied ? '<p class="card-meta">✅ Вы уже откликнулись на этот заказ.</p>' : ""}
      </div>
    `;
  }

  function renderApplicationsList() {
    const list = state.applications.length
      ? state.applications
          .map(
            (a) => `
        <div class="card list-item" data-application-id="${a.id}">
          <h3 class="card-title">${escapeHtml(a.tender_title)} <span class="app-status ${a.status}">${statusLabel(a.status)}</span></h3>
          <p class="card-meta">${escapeHtml(a.tender_city)} · ${escapeHtml(a.tender_category)}</p>
        </div>
      `
          )
          .join("")
      : '<div class="empty-state"><div class="empty-icon">📩</div><p>У вас пока нет откликов.</p><p>Выберите заказ и нажмите «Откликнуться».</p></div>';
    return `<div class="screen"><h2 class="screen-title">Мои отклики</h2>${list}</div>`;
  }

  function statusLabel(s) {
    const l = { applied: "Ожидает решения", selected: "Вас выбрали", rejected: "Отклонён" };
    return l[s] || s;
  }

  function statusHint(s) {
    const h = { applied: "Ожидайте решения заказчика.", selected: "Вас выбрали по этому заказу. С вами свяжутся.", rejected: "По этому заказу выбран другой исполнитель." };
    return h[s] || "";
  }

  function renderApplicationDetail() {
    const a = state.currentApplication;
    if (!a) return '<div class="screen"><p>Загрузка...</p></div>';
    const hint = statusHint(a.status);
    return `
      <div class="screen">
        <div class="card">
          <h2 class="card-title">${escapeHtml(a.tender_title)}</h2>
          <p class="card-meta"><span class="app-status ${a.status}">${statusLabel(a.status)}</span></p>
          ${hint ? '<p class="card-desc">' + escapeHtml(hint) + '</p>' : ""}
          <p class="card-meta">${escapeHtml(a.tender_city)} · ${escapeHtml(a.tender_category)} · ${escapeHtml(a.tender_budget || "По договорённости")}</p>
        </div>
        <div class="detail-section">
          <h3>Описание заказа</h3>
          <p>${escapeHtml(a.tender_description || "")}</p>
        </div>
        <p class="card-meta">Дата отклика: ${a.created_at ? new Date(a.created_at).toLocaleString("ru-RU") : "—"}</p>
      </div>
    `;
  }

  function renderSupportList() {
    const tickets = state.supportTickets || [];
    const list = tickets.length
      ? tickets
          .map(
            (t) => `
        <div class="card list-item" data-ticket-id="${t.id}">
          <h3 class="card-title">Обращение #${t.id} <span class="badge ${t.status === "closed" ? "badge-neutral" : "badge-warning"}">${ticketStatusLabel(t.status)}</span></h3>
          <p class="card-meta">${t.created_at ? new Date(t.created_at).toLocaleString("ru-RU") : "—"}${t.last_preview ? " · " + escapeHtml(t.last_preview) : ""}</p>
        </div>
      `
          )
          .join("")
      : "";
    return `
      <div class="screen">
        <h2 class="screen-title">Поддержка</h2>
        <p class="card-desc">Задайте вопрос или опишите проблему. Ответ придёт в этот чат.</p>
        ${list}
        <button type="button" class="btn btn-primary" id="supportNew">💬 Новое обращение</button>
      </div>
    `;
  }

  function supportImageSrc(url) {
    if (!url) return "";
    var base = (BASE ? BASE.replace(/\/$/, "") : (window.location.origin || ""));
    return base + (url.indexOf("/") === 0 ? url : "/" + url);
  }

  function getSupportChatMessagesHtml(ticket) {
    if (!ticket || !ticket.messages) return "";
    return (ticket.messages || [])
      .map((m) => {
        var imgHtml = m.image_url ? '<div class="support-msg-img"><img src="' + escapeHtml(supportImageSrc(m.image_url)) + '" alt="Фото" loading="lazy"></div>' : "";
        var text = (m.text || "").trim();
        if (text === "(изображение)") text = "";
        var textHtml = text ? '<p class="support-msg-text">' + escapeHtml(text) + '</p>' : "";
        return (
          '<div class="support-msg support-msg--' + m.author + '">' +
          '<span class="support-msg-author">' + (m.author === "admin" ? "Поддержка" : "Вы") + '</span>' +
          imgHtml + textHtml +
          '<span class="support-msg-time">' + (m.created_at ? new Date(m.created_at).toLocaleString("ru-RU") : "") + '</span>' +
          '</div>'
        );
      })
      .join("");
  }

  function renderSupportChat() {
    if (state.supportError) {
      return '<div class="screen"><p class="card-meta" style="color: #c33; padding: 1rem;">⚠️ ' + state.supportError + '</p><button type="button" class="btn btn-secondary" data-go="support">← К списку</button></div>';
    }
    const t = state.currentTicket;
    if (!t) return '<div class="screen"><p>Загрузка...</p></div>';
    const closed = t.status === "closed";
    const messages = getSupportChatMessagesHtml(t);
    return `
      <div class="screen support-chat">
        <div class="support-messages" id="supportMessages">${messages}</div>
        ${closed ? '<p class="card-meta">Обращение закрыто.</p>' : `
        <form id="supportForm" class="support-form">
          <textarea name="text" placeholder="Введите сообщение или приложите фото..." rows="2" maxlength="2000"></textarea>
          <div class="support-form-file">
            <label class="btn btn-secondary btn-sm">📷 Фото <input type="file" name="image" id="supportImageInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none"></label>
          </div>
          <button type="submit" class="btn btn-primary">Отправить</button>
        </form>
        <button type="button" class="btn btn-secondary" id="supportClose">Завершить обращение</button>
        `}
      </div>
    `;
  }

  function renderProfile() {
    const u = state.user;
    if (!u) return "";
    const skillsStr = (u.skills && u.skills.length) ? u.skills.join(", ") : "—";
    return `
      <div class="screen">
        <h2 class="screen-title">Профиль</h2>
        <div class="card">
          <div class="profile-row">
            <span class="profile-label">ФИО</span>
            <span class="profile-value">${escapeHtml(u.full_name)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Город</span>
            <span class="profile-value">${escapeHtml(u.city)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Телефон</span>
            <span class="profile-value">${escapeHtml(u.phone)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Навыки</span>
            <span class="profile-value">${escapeHtml(skillsStr)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Статус</span>
            <span class="profile-value">${u.status === "active" ? "Активен" : u.status === "pending_moderation" ? "На модерации" : "Заблокирован"}</span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary" data-go="profile_edit">✏️ Редактировать</button>
      </div>
    `;
  }

  function renderProfileEdit() {
    const u = state.user;
    if (!u) return "";
    const skillsOptions = (state.skills || []).map((sk) => `<option value="${escapeHtml(sk)}" ${(u.skills || []).includes(sk) ? "selected" : ""}>${escapeHtml(sk)}</option>`).join("");
    const citiesOptions = (state.cities || []).map((c) => `<option value="${escapeHtml(c)}" ${u.city === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
    return `
      <div class="screen">
        <h2 class="screen-title">Редактирование профиля</h2>
        <form id="profileForm">
          <div class="form-group">
            <label>ФИО</label>
            <input type="text" name="full_name" value="${escapeHtml(u.full_name)}" required>
          </div>
          <div class="form-group">
            <label>Город</label>
            <select name="city" required>${citiesOptions ? citiesOptions : `<option value="${escapeHtml(u.city)}">${escapeHtml(u.city)}</option>`}</select>
          </div>
          <div class="form-group">
            <label>Телефон</label>
            <input type="text" name="phone" value="${escapeHtml(u.phone)}" required>
          </div>
          <div class="form-group">
            <label>Навыки (через запятую или выберите)</label>
            <input type="text" name="skills_text" placeholder="Например: СКУД, Видеонаблюдение" value="${escapeHtml((u.skills || []).join(", "))}">
          </div>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </form>
      </div>
    `;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function bindEvents() {
    main.querySelectorAll("[data-go]").forEach((el) => {
      el.addEventListener("click", () => navigate(el.dataset.go, true));
    });
    main.querySelectorAll("[data-tender-id]").forEach((el) => {
      el.addEventListener("click", () => {
        state.currentTenderId = parseInt(el.dataset.tenderId, 10);
        state.stack.push(state.screen);
        state.screen = "tender";
        loadTenderDetail().then(() => {
          setHeader("Заказ", true);
          setTabbarActive("tender");
          render();
        });
      });
    });
    main.querySelectorAll("[data-application-id]").forEach((el) => {
      el.addEventListener("click", () => {
        state.currentApplicationId = parseInt(el.dataset.applicationId, 10);
        state.stack.push(state.screen);
        state.screen = "application";
        loadApplicationDetail().then(() => {
          setHeader("Отклик", true);
          setTabbarActive("application");
          render();
        });
      });
    });
    const btnApply = main.querySelector("#btnApply");
    if (btnApply) {
      btnApply.addEventListener("click", () => applyToTender(state.currentTenderId));
    }
    const form = main.querySelector("#profileForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const skillsText = (fd.get("skills_text") || "").toString().trim();
        const skills = skillsText ? skillsText.split(/,\s*/).map((s) => s.trim()).filter(Boolean) : [];
        api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({
            full_name: fd.get("full_name"),
            city: fd.get("city"),
            phone: fd.get("phone"),
            skills: skills.length ? skills : state.user.skills,
          }),
        }).then(() => {
          state.stack.pop();
          return loadMe();
        }).then(() => {
          state.screen = "profile";
          setTabbarActive("profile");
          render();
        }).catch((err) => {
          TG.showAlert(errorToMessage(err) || "Ошибка сохранения");
        });
      });
    }
    main.querySelectorAll("[data-ticket-id]").forEach((el) => {
      el.addEventListener("click", () => {
        state.currentTicketId = parseInt(el.dataset.ticketId, 10);
        state.stack.push(state.screen);
        state.screen = "support_chat";
        state.supportError = null;
        setHeader("Чат", true);
        setTabbarActive("support_chat");
        loadSupportTicketDetail().then(() => {
          onScreenChange();
          render();
        }).catch((err) => {
          TG.showAlert(errorToMessage(err) || "Ошибка загрузки");
          state.screen = state.stack.pop();
          render();
        });
      });
    });
    const supportNew = main.querySelector("#supportNew");
    if (supportNew) {
      supportNew.addEventListener("click", () => {
        supportNew.disabled = true;
        api("/api/support/tickets", { method: "POST", body: JSON.stringify({ text: "" }) })
          .then((data) => {
            state.currentTicketId = data.id;
            state.supportError = null;
            state.stack.push(state.screen);
            state.screen = "support_chat";
            return loadSupportTicketDetail();
          })
          .then(() => {
            setHeader("Чат", true);
            setTabbarActive("support_chat");
            onScreenChange();
            render();
          })
          .catch((err) => {
            TG.showAlert(errorToMessage(err) || "Ошибка");
          })
          .finally(() => { supportNew.disabled = false; });
      });
    }
    const supportForm = main.querySelector("#supportForm");
    if (supportForm) {
      supportForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const textEl = supportForm.querySelector('[name="text"]');
        const fileEl = main.querySelector("#supportImageInput");
        const text = (textEl.value || "").trim();
        const hasFile = fileEl && fileEl.files && fileEl.files.length > 0;
        if (!text && !hasFile) {
          TG.showAlert("Введите сообщение или приложите фото.");
          return;
        }
        const btn = supportForm.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        function sendPayload(payload) {
          if (!state.currentTicketId) {
            TG.showAlert("Тикет не выбран");
            return Promise.reject(new Error("Тикет не выбран"));
          }
          return api("/api/support/tickets/" + state.currentTicketId + "/messages", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        function doSend() {
          if (!hasFile) return sendPayload({ text: text });
          return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () { sendPayload({ text: text, image_base64: fr.result }).then(resolve, reject); };
            fr.onerror = function () { reject(new Error("Не удалось прочитать файл")); };
            fr.readAsDataURL(fileEl.files[0]);
          });
        }
        doSend()
          .then(() => {
            textEl.value = "";
            if (fileEl) fileEl.value = "";
            return loadSupportTicketDetail();
          })
          .then(() => render())
          .catch((err) => TG.showAlert(errorToMessage(err) || "Не удалось отправить"))
          .finally(() => { if (btn) btn.disabled = false; });
      });
    }
    const supportClose = main.querySelector("#supportClose");
    if (supportClose) {
      supportClose.addEventListener("click", () => {
        supportClose.disabled = true;
        api("/api/support/tickets/" + state.currentTicketId + "/close", { method: "POST" })
          .then(() => loadSupportTickets())
          .then(() => {
            state.currentTicketId = null;
            state.currentTicket = null;
            state.supportError = null;
            state.screen = "support";
            state.stack.pop();
            setHeader("Поддержка", false);
            setTabbarActive("support");
            render();
          })
          .catch((err) => TG.showAlert(errorToMessage(err) || "Ошибка"))
          .finally(() => { supportClose.disabled = false; });
      });
    }
  }

  btnBack.addEventListener("click", back);
  tabbar.querySelectorAll(".tabbar-item").forEach((el) => {
    el.addEventListener("click", () => {
      const screen = el.dataset.screen;
      if (screen === state.screen) return;
      state.stack = [];
      navigate(screen, false);
    });
  });

  function loadMe() {
    return api("/api/me").then((data) => {
      state.user = data;
      return data;
    });
  }

  function loadTenders() {
    return api("/api/tenders").then((data) => {
      state.tenders = data.tenders || [];
      updateTendersBadge();
      return data;
    });
  }

  function updateTendersBadge() {
    var badge = document.getElementById("tendersBadge");
    if (!badge) return;
    var lastSeen = localStorage.getItem("lastSeenTenderTs") || "";
    var newCount = 0;
    if (lastSeen) {
      var lastTs = new Date(lastSeen).getTime();
      (state.tenders || []).forEach(function(t) {
        if (t.created_at && new Date(t.created_at).getTime() > lastTs) newCount++;
      });
    } else {
      newCount = (state.tenders || []).length;
    }
    if (newCount > 0 && state.screen !== "tenders") {
      badge.textContent = newCount > 99 ? "99+" : String(newCount);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  function markTendersSeen() {
    var now = new Date().toISOString();
    localStorage.setItem("lastSeenTenderTs", now);
    var badge = document.getElementById("tendersBadge");
    if (badge) badge.classList.add("hidden");
  }

  function loadTenderDetail() {
    return api("/api/tenders/" + state.currentTenderId).then((data) => {
      state.currentTender = data;
      return data;
    });
  }

  function loadApplications() {
    return api("/api/applications").then((data) => {
      state.applications = data.applications || [];
      return data;
    });
  }

  function loadApplicationDetail() {
    return api("/api/applications/" + state.currentApplicationId).then((data) => {
      state.currentApplication = data;
      return data;
    });
  }

  function loadSkills() {
    return api("/api/skills").then((data) => {
      state.skills = data.skills || [];
      return data;
    });
  }
  function loadCities() {
    return api("/api/cities").then((data) => {
      state.cities = data.cities || [];
      return data;
    });
  }

  function applyToTender(tenderId) {
    const btn = main.querySelector("#btnApply");
    if (btn) btn.disabled = true;
    api("/api/tenders/" + tenderId + "/apply", { method: "POST" })
      .then(() => {
        TG.showAlert("Отклик принят. Статус обновится в разделе «Мои отклики».");
        state.currentTender.has_applied = true;
        state.currentTender.application_status = "applied";
        render();
      })
      .catch((err) => {
        TG.showAlert(errorToMessage(err) || "Не удалось отправить отклик");
        if (btn) btn.disabled = false;
      });
  }

  function loadSupportTickets() {
    return api("/api/support/tickets").then((data) => {
      state.supportTickets = data.tickets || [];
      return data;
    });
  }

  function loadSupportTicketDetail() {
    if (!state.currentTicketId) return Promise.resolve();
    return api("/api/support/tickets/" + state.currentTicketId)
      .then((data) => {
        state.currentTicket = data;
        state.supportError = null;
        return data;
      })
      .catch((err) => {
        state.supportError = errorToMessage(err) || "Ошибка загрузки тикета";
        state.currentTicket = null;
        if (TG && TG.showAlert) TG.showAlert(state.supportError);
        throw err;
      });
  }

  function loadScreenData() {
    const s = state.screen;
    if (s === "tenders") return loadTenders();
    if (s === "applications") return loadApplications();
    if (s === "support") return loadSupportTickets();
    if (s === "support_chat") return loadSupportTicketDetail();
    if (s === "profile_edit") return Promise.all([loadSkills(), loadCities()]);
    return Promise.resolve();
  }

  function loadMeWithRetry() {
    return loadMe().catch(function (err) {
      if (getInitData()) throw err;
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          loadMe().then(resolve, reject);
        }, 400);
      });
    });
  }

  showLoader();
  loadMeWithRetry()
    .then(() => {
      showApp();
      state.stack = [];
      setTabbarActive(state.screen);
      return loadScreenData();
    })
    .then(() => render())
    .catch((err) => {
      showError(errorToMessage(err) || "Не удалось загрузить данные. Пройдите регистрацию в боте.");
    });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.user && app.classList.contains("hidden") === false) {
      loadMe().then(() => loadScreenData().then(() => render()));
    }
  });

  // Обновление по мере изменений: лонг-полл без авто-рефреша страницы
  let updatesSince = null;
  let updatesTimer = null;
  let updatesStopped = false;
  function getUpdateScope() {
    const s = state.screen;
    if (s === "support_chat") return "support_chat";
    if (s === "support") return "support";
    if (s === "applications") return "applications";
    if (s === "tenders") return "tenders";
    if (s === "home") return "home";
    return null;
  }
  function scheduleUpdates(delayMs) {
    if (updatesTimer) clearTimeout(updatesTimer);
    updatesTimer = setTimeout(runUpdates, delayMs);
  }
  function runUpdates() {
    if (updatesStopped) return;
    if (!state.user || app.classList.contains("hidden")) {
      scheduleUpdates(1500);
      return;
    }
    const scope = getUpdateScope();
    if (!scope) {
      scheduleUpdates(1500);
      return;
    }
    if (scope === "support_chat") {
      if (!state.currentTicketId) {
        scheduleUpdates(1000);
        return;
      }
      if (!state.currentTicket && !state.supportError) {
        loadSupportTicketDetail().catch(() => {
          stopUpdates();
        });
        scheduleUpdates(1000);
        return;
      }
      if (state.supportError) {
        stopUpdates();
        return;
      }
    }
    let url = "/api/updates?scope=" + encodeURIComponent(scope) + "&timeout=25";
    if (updatesSince) url += "&since=" + encodeURIComponent(updatesSince);
    if (scope === "support_chat" && state.currentTicketId) url += "&ticket_id=" + state.currentTicketId;
    api(url)
      .then((data) => {
        if (data && data.ts) {
          if (updatesSince && data.changed) {
            if (scope === "support_chat") {
              return loadSupportTicketDetail().then(() => {
                var el = main.querySelector("#supportMessages");
                if (el) el.innerHTML = getSupportChatMessagesHtml(state.currentTicket);
              }).then(() => { updatesSince = data.ts; });
            }
            return loadMe().then(() => loadScreenData().then(() => { loadTenders().catch(function(){}); render(); })).then(() => { updatesSince = data.ts; });
          }
          updatesSince = data.ts;
        }
      })
      .catch(() => {})
      .finally(() => scheduleUpdates(500));
  }
  function startUpdates() {
    updatesStopped = false;
    scheduleUpdates(10);
  }
  function stopUpdates() {
    updatesStopped = true;
    if (updatesTimer) {
      clearTimeout(updatesTimer);
      updatesTimer = null;
    }
  }
  function onScreenChange() {
    updatesSince = null;
    if (getUpdateScope()) startUpdates();
    else stopUpdates();
  }
  onScreenChange();
})();
