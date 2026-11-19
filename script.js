/* Вариант 15. Учебное бронирование мест без сервера и оплаты. */
const localKey = "kadr-sessions-v1";
const selectionKey = "kadr-selection-v1";
const currentSessionKey = "kadr-current-session-v1";
const rows = 10;
const seatsPerRow = 15;
const nameRegex = /^[А-Яа-яЁёA-Za-z]{2,30}$/;
// После +7 или 8 должно идти ровно 10 цифр. Разделители удаляются отдельно.
const phoneRegex = /^(?:\+7|8)\d{10}$/;
const nameInput = document.getElementById("viewerName");
const phoneInput = document.getElementById("viewerPhone");
const bookButton = document.getElementById("bookButton");
const formMessage = document.getElementById("formMessage");
let selectedSeats = [];
let touched = { name: false, phone: false };
let sessions = [];
let currentSessionId = "";

function money(value) {
    return value.toLocaleString("ru-RU") + " ₽";
}
function seatId(seat) {
    return seat.row + "-" + seat.number;
}
function currentSession() {
    return sessions.find(function(session) { return session.id === currentSessionId; });
}
function sessionDate(session) {
    return new Date(session.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });
}
function sessionTime(session) {
    return new Date(session.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
}

// Создаём три сеанса на ближайшие дни. Все 150 мест каждого сеанса независимы.
function createSessions() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
    const base = new Date(today + "T12:00:00+03:00");
    const plans = [{ day: 1, time: "18:30", price: 450 }, { day: 1, time: "21:00", price: 550 }, { day: 2, time: "19:00", price: 500 }];
    return plans.map(function(plan, index) {
        const date = new Date(base);
        date.setUTCDate(date.getUTCDate() + plan.day);
        const day = date.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
        const seats = [];
        for (let row = 1; row <= rows; row++) {
            for (let number = 1; number <= seatsPerRow; number++) {
                const occupied = (row * 7 + number * 3 + index * 5) % 17 === 0 || (row === 6 && number >= 7 && number <= 9);
                seats.push({ row: row, number: number, status: occupied ? "occupied" : "free" });
            }
        }
        return { id: day + "-" + plan.time.replace(":", ""), movie: "За пределами звёзд", date: day + "T" + plan.time + ":00+03:00", price: plan.price, seats: seats };
    });
}

// Проверяем содержимое хранилища перед использованием в интерфейсе.
function validSessions(value) {
    return Array.isArray(value) && value.length > 0 && value.every(function(session) {
        return session && typeof session.id === "string" && typeof session.movie === "string" &&
            Number.isFinite(Date.parse(session.date)) && Number.isFinite(session.price) && session.price > 0 &&
            Array.isArray(session.seats) && session.seats.length === rows * seatsPerRow &&
            new Set(session.seats.map(seatId)).size === rows * seatsPerRow &&
            session.seats.every(function(seat) {
                return Number.isInteger(seat.row) && seat.row >= 1 && seat.row <= rows &&
                    Number.isInteger(seat.number) && seat.number >= 1 && seat.number <= seatsPerRow &&
                    ["free", "booked", "occupied"].includes(seat.status);
            });
    });
}
function readSessions() {
    const text = localStorage.getItem(localKey);
    if (!text) return null;
    const saved = JSON.parse(text);
    if (!validSessions(saved)) throw new Error("Неверный формат сеансов");
    return saved;
}
function saveSelection() {
    try {
        sessionStorage.setItem(currentSessionKey, currentSessionId);
        sessionStorage.setItem(selectionKey, JSON.stringify(selectedSeats));
    } catch {
        document.getElementById("hallNotice").textContent = "Браузер не разрешил сохранить выбор до перезагрузки страницы.";
    }
}
function removeUnavailableSelections() {
    const session = currentSession();
    selectedSeats = [...new Set(selectedSeats)].filter(function(id) {
        return session.seats.some(function(seat) { return seatId(seat) === id && seat.status === "free"; });
    });
}

function renderSessions() {
    const list = document.getElementById("sessionList");
    list.replaceChildren();
    for (const session of sessions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "session-button" + (session.id === currentSessionId ? " active" : "");
        button.setAttribute("aria-pressed", String(session.id === currentSessionId));
        const time = document.createElement("strong");
        time.textContent = sessionTime(session);
        const details = document.createElement("div");
        const date = document.createElement("span");
        date.textContent = sessionDate(session);
        const price = document.createElement("span");
        price.textContent = "2D · " + money(session.price);
        details.append(date, price);
        button.append(time, details);
        button.addEventListener("click", function() {
            if (session.id === currentSessionId) return;
            currentSessionId = session.id;
            selectedSeats = [];
            saveSelection();
            formMessage.textContent = "";
            renderAll();
        });
        list.append(button);
    }
}

// Места создаются через createElement и размещаются CSS Grid по рядам.
function renderSeats() {
    const map = document.getElementById("seatMap");
    const focusedId = document.activeElement && document.activeElement.dataset.seat;
    map.replaceChildren();
    const session = currentSession();
    for (let row = 1; row <= rows; row++) {
        const label = document.createElement("span");
        label.className = "row-number";
        label.textContent = row;
        label.setAttribute("aria-hidden", "true");
        map.append(label);
        for (const seat of session.seats.filter(function(item) { return item.row === row; })) {
            const id = seatId(seat);
            const selected = selectedSeats.includes(id);
            const occupied = seat.status !== "free";
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.seat = id;
            button.className = "seat" + (occupied ? " occupied" : selected ? " selected" : "");
            button.textContent = seat.number;
            button.disabled = occupied;
            button.setAttribute("aria-pressed", String(selected));
            button.setAttribute("aria-label", "Ряд " + row + ", место " + seat.number + ": " + (occupied ? "занято" : selected ? "выбрано" : "свободно"));
            button.title = "Ряд " + row + ", место " + seat.number;
            button.addEventListener("click", function() { toggleSeat(id); });
            map.append(button);
        }
    }
    if (focusedId) {
        const replacement = map.querySelector('[data-seat="' + focusedId + '"]');
        if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
}
function toggleSeat(id) {
    const seat = currentSession().seats.find(function(item) { return seatId(item) === id; });
    if (!seat || seat.status !== "free") return;
    if (selectedSeats.includes(id)) selectedSeats = selectedSeats.filter(function(item) { return item !== id; });
    else selectedSeats.push(id);
    saveSelection();
    renderSeats();
    renderReceipt();
    validateForm();
}
function chosenSeats() {
    return currentSession().seats.filter(function(seat) { return selectedSeats.includes(seatId(seat)); });
}
function renderReceipt() {
    const session = currentSession();
    const dateLabel = sessionDate(session) + " · " + sessionTime(session);
    document.getElementById("receiptSession").textContent = dateLabel + " · Зал 1";
    document.getElementById("hallSession").textContent = dateLabel;
    const list = document.getElementById("selectedList");
    list.replaceChildren();
    for (const seat of chosenSeats()) {
        const item = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = "Ряд " + seat.row + ", место " + seat.number;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-seat";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Убрать: " + name.textContent);
        remove.addEventListener("click", function() { toggleSeat(seatId(seat)); });
        item.append(name, remove);
        list.append(item);
    }
    document.getElementById("seatCount").textContent = selectedSeats.length;
    document.getElementById("emptySelection").hidden = selectedSeats.length > 0;
    document.getElementById("clearSelection").hidden = selectedSeats.length === 0;
    document.getElementById("priceCalculation").textContent = selectedSeats.length ? "Мест: " + selectedSeats.length + " × " + money(session.price) : "Цена за место";
    document.getElementById("unitPrice").textContent = money(session.price);
    document.getElementById("totalPrice").textContent = money(selectedSeats.length * session.price);
}
function normalizePhone(value) {
    return value.replace(/[\s()\-]/g, "");
}
function validateForm() {
    const nameValid = nameRegex.test(nameInput.value.trim());
    const phoneValid = phoneRegex.test(normalizePhone(phoneInput.value.trim()));
    document.getElementById("nameError").textContent = touched.name && !nameValid ? "Введите от 2 до 30 букв без цифр и пробелов." : "";
    document.getElementById("phoneError").textContent = touched.phone && !phoneValid ? "Введите номер: +7 или 8, затем 10 цифр." : "";
    nameInput.classList.toggle("invalid", touched.name && !nameValid);
    phoneInput.classList.toggle("invalid", touched.phone && !phoneValid);
    nameInput.setAttribute("aria-invalid", String(touched.name && !nameValid));
    phoneInput.setAttribute("aria-invalid", String(touched.phone && !phoneValid));
    bookButton.disabled = !nameValid || !phoneValid || selectedSeats.length === 0;
    return nameValid && phoneValid && selectedSeats.length > 0;
}
function renderAll() {
    renderSessions();
    renderSeats();
    renderReceipt();
    validateForm();
}

// Перед подтверждением повторно читаем localStorage: места могла занять другая вкладка.
document.getElementById("bookingForm").addEventListener("submit", function(event) {
    event.preventDefault();
    touched = { name: true, phone: true };
    if (!validateForm()) return;
    try {
        const latest = readSessions();
        if (!latest) throw new Error("Сохранённый сеанс не найден");
        const session = latest.find(function(item) { return item.id === currentSessionId; });
        if (!session) throw new Error("Сеанс не найден");
        const conflict = selectedSeats.some(function(id) {
            return !session.seats.some(function(seat) { return seatId(seat) === id && seat.status === "free"; });
        });
        if (conflict) {
            sessions = latest;
            removeUnavailableSelections();
            saveSelection();
            renderAll();
            formMessage.textContent = "Некоторые места уже заняты в другой вкладке. Выберите свободные места.";
            return;
        }
        const bookedSeats = session.seats.filter(function(seat) { return selectedSeats.includes(seatId(seat)); });
        for (const seat of bookedSeats) seat.status = "occupied";
        // Пишем сначала в хранилище, а затем показываем успешное подтверждение.
        localStorage.setItem(localKey, JSON.stringify(latest));
        const viewer = nameInput.value.trim();
        sessions = latest;
        selectedSeats = [];
        saveSelection();
        renderAll();
        document.getElementById("confirmationGreeting").textContent = viewer + ", ваши места ждут вас.";
        document.getElementById("ticketSession").textContent = sessionDate(session) + " · " + sessionTime(session) + " · Зал 1";
        document.getElementById("ticketSeats").textContent = bookedSeats.map(function(seat) { return "Ряд " + seat.row + ", место " + seat.number; }).join("; ");
        document.getElementById("ticketTotal").textContent = money(bookedSeats.length * session.price);
        document.getElementById("ticketCode").textContent = "Бронь № " + Date.now().toString(36).toUpperCase();
        document.getElementById("confirmation").showModal();
        formMessage.textContent = "Бронирование сохранено. Выбранные места теперь заняты.";
    } catch {
        formMessage.textContent = "Не удалось сохранить бронирование. Проверьте доступ браузера к хранилищу и попробуйте ещё раз.";
    }
});
for (const item of [{ input: nameInput, key: "name" }, { input: phoneInput, key: "phone" }]) {
    item.input.addEventListener("input", function() { touched[item.key] = true; formMessage.textContent = ""; validateForm(); });
    item.input.addEventListener("blur", function() { touched[item.key] = true; validateForm(); });
}
document.getElementById("clearSelection").addEventListener("click", function() {
    selectedSeats = [];
    saveSelection();
    renderAll();
});
for (const id of ["closeDialog", "doneButton"]) {
    document.getElementById(id).addEventListener("click", function() { document.getElementById("confirmation").close(); });
}
window.addEventListener("storage", function(event) {
    if (event.key !== localKey && event.key !== null) return;
    try {
        const updated = readSessions();
        if (!updated) return;
        sessions = updated;
        if (!currentSession()) currentSessionId = sessions[0].id;
        removeUnavailableSelections();
        saveSelection();
        renderAll();
        document.getElementById("hallNotice").textContent = "Данные о местах обновлены из другой вкладки.";
    } catch { document.getElementById("hallNotice").textContent = "Не удалось обновить данные о местах."; }
});

// Восстанавливаем сеансы и выбор пользователя при повторном открытии страницы.
try {
    sessions = readSessions() || createSessions();
    localStorage.setItem(localKey, JSON.stringify(sessions));
} catch {
    sessions = createSessions();
    document.getElementById("hallNotice").textContent = "История недоступна. Для бронирования разрешите сохранение данных в браузере.";
}
currentSessionId = sessions[0].id;
try {
    const savedId = sessionStorage.getItem(currentSessionKey);
    if (sessions.some(function(session) { return session.id === savedId; })) currentSessionId = savedId;
    const savedSeats = JSON.parse(sessionStorage.getItem(selectionKey) || "[]");
    if (Array.isArray(savedSeats)) selectedSeats = savedSeats.filter(function(id) { return typeof id === "string"; });
} catch { selectedSeats = []; }
removeUnavailableSelections();
renderAll();
