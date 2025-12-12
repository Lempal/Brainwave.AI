// =========================================================
//  CONFIGURAÇÃO — coloque sua API key aqui
// =========================================================
const API_KEY = ""; // <----- TROQUE AQUI
const API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4";

// =========================================================
//  ELEMENTOS DO HTML
// =========================================================
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chat = document.getElementById("chatMessages");
const newChatBtn = document.querySelector(".new-chat-btn");
const historyList = document.querySelector(".history-list");
const clearHistoryBtn = document.querySelector(".clear-history-btn");

let currentChatId = null;
let sending = false;

// =========================================================
//  HISTÓRICO
// =========================================================
function loadHistory() {
    const saved = JSON.parse(localStorage.getItem("brainwave_history")) || {};
    historyList.innerHTML = "";

    Object.keys(saved).forEach(id => {
        const btn = document.createElement("button");
        btn.className = "history-item";
        btn.textContent = saved[id].title || "Chat";
        btn.onclick = () => loadChat(id);
        historyList.appendChild(btn);
    });
}

function generateChatTitle(messages) {
    const firstMsg = messages.find(m => m.type === "user")?.text || "Chat";
    return firstMsg.length > 20 ? firstMsg.slice(0, 20) + "..." : firstMsg;
}

function saveChat(id, messages) {
    const history = JSON.parse(localStorage.getItem("brainwave_history")) || {};
    history[id] = {
        title: generateChatTitle(messages),
        messages
    };
    localStorage.setItem("brainwave_history", JSON.stringify(history));
}

function loadChat(id) {
    currentChatId = id;
    const history = JSON.parse(localStorage.getItem("brainwave_history")) || {};
    const chatData = history[id];
    chat.innerHTML = "";

    chatData.messages.forEach(m => addMessage(m.text, m.type, false));
    chat.scrollTop = chat.scrollHeight;
}

// =========================================================
//  CRIA UM CHAT NOVO
// =========================================================
function createNewChat() {
    currentChatId = Date.now();
    chat.innerHTML = "";
    input.value = "";
}

newChatBtn.onclick = () => {
    createNewChat();
    loadHistory();
};

// =========================================================
//  ADICIONAR MENSAGEM NO CHAT
// =========================================================
function addMessage(text, type, save = true) {
    const div = document.createElement("div");
    div.className = "msg " + type;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;

    if (save) saveMessages();
}

function addTyping() {
    const div = document.createElement("div");
    div.className = "msg bot";
    div.innerText = "Digitando…";
    div.id = "typingIndicator";
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById("typingIndicator");
    if (t) t.remove();
}

// =========================================================
//  SALVAR MENSAGENS
// =========================================================
function saveMessages() {
    if (!currentChatId) currentChatId = Date.now();

    const messages = [...document.querySelectorAll(".msg")].map(m => ({
        text: m.innerText,
        type: m.classList.contains("user") ? "user" : "bot"
    }));

    saveChat(currentChatId, messages);
    loadHistory();
}

// =========================================================
//  MONTAR JSON DINÂMICO PARA API (CHATGPT-4)
// =========================================================
function buildJSON() {
    const messages = [...document.querySelectorAll(".msg")].map(m => ({
        role: m.classList.contains("user") ? "user" : "assistant",
        content: m.innerText
    }));

    return {
        model: MODEL,
        messages: [
            { role: "system", content: "Você é um assistente útil e amigável." },
            ...messages
        ],
        stream: true
    };
}

// =========================================================
//  ENVIAR PARA A IA — COM STREAMING
// =========================================================
async function sendToAI(message) {
    try {
        addTyping();

        const jsonBody = buildJSON();

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + API_KEY
            },
            body: JSON.stringify(jsonBody)
        });

        const reader = response.body.getReader();
        let botDiv = document.createElement("div");
        botDiv.className = "msg bot";
        let fullText = "";
        chat.appendChild(botDiv);

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.replace("data: ", "").trim();
                    if (data !== "[DONE]") {
                        try {
                            const json = JSON.parse(data);
                            const token = json.choices?.[0]?.delta?.content;

                            if (token) {
                                fullText += token;
                                botDiv.innerText = fullText;
                                chat.scrollTop = chat.scrollHeight;
                            }
                        } catch {}
                    }
                }
            }
        }

        removeTyping();
        saveMessages();
    } catch (error) {
        removeTyping();
        addMessage("Erro ao conectar com a IA.", "bot");
        console.error(error);
    }
}

// =========================================================
//  ENVIO DE MENSAGENS
// =========================================================
sendBtn.onclick = async () => {
    if (sending) return;
    const text = input.value.trim();
    if (!text) return;

    sending = true;
    addMessage(text, "user");
    input.value = "";

    await sendToAI(text);
    sending = false;
};

// Enter envia
input.addEventListener("keypress", e => {
    if (e.key === "Enter") sendBtn.onclick();
});

// =========================================================
//  BOTÃO LIMPAR HISTÓRICO
// =========================================================
if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
        if (confirm("Deseja realmente apagar todo o histórico?")) {
            localStorage.removeItem("brainwave_history");
            chat.innerHTML = "";
            historyList.innerHTML = "";
            createNewChat();
        }
    };
}

// =========================================================
//  INICIAR SISTEMA
// =========================================================
input.focus();
loadHistory();
createNewChat();
