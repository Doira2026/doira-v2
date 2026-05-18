import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAksQf3rkeG998TmJj-YuA3WpTDLLZ1ais",
  authDomain: "doira-chat-v2.firebaseapp.com",
  databaseURL: "https://doira-chat-v2-default-rtdb.firebaseio.com",
  projectId: "doira-chat-v2",
  storageBucket: "doira-chat-v2.firebasestorage.app",
  messagingSenderId: "885552294238",
  appId: "1:885552294238:web:8a5d288d1eb57e11b687cf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let currentName = "";
let chatId = "global";

const root = document.getElementById("app");

function loginUI() {
  root.innerHTML = `
  <div style="
    height:100dvh;
    display:flex;
    justify-content:center;
    align-items:center;
    background:#0b141a;
    color:white;
    padding:20px;
  ">
    <div style="width:100%;max-width:320px;background:#111b21;padding:20px;border-radius:12px">
      <h2 style="text-align:center">DOIRA CHAT</h2>
      <input id="name" placeholder="Ism" style="width:100%;padding:10px;margin-top:10px">
      <button id="btn" style="width:100%;margin-top:10px;padding:10px;background:#00a884;color:white;border:none">
        Kirish
      </button>
    </div>
  </div>
  `;

  document.getElementById("btn").onclick = async () => {
    const name = document.getElementById("name").value;
    if (!name) return;
    localStorage.setItem("name", name);
    await signInAnonymously(auth);
  };
}

function chatUI() {
  root.innerHTML = `
  <div style="
    height:100vh;
    display:flex;
    flex-direction:column;
    background:#0b141a;
    color:white;
  ">

    <div style="
      padding:10px;
      background:#202c33;
      text-align:center;
      font-weight:bold;
    ">
      DOIRA CHAT
    </div>

    <div id="msgs" style="
      flex:1;
      overflow-y:auto;
      padding:10px;
    "></div>

    <div style="
      display:flex;
      gap:5px;
      padding:10px;
      background:#202c33;
    ">
      <input id="msg" style="
        flex:1;
        padding:10px;
      ">
      <button id="send" style="
        background:#00a884;
        color:white;
        border:none;
        padding:10px;
      ">➤</button>
    </div>

  </div>
  `;

  document.getElementById("send").onclick = send;
  document.getElementById("msg").onkeyup = e => {
    if (e.key === "Enter") send();
  };

  loadMessages();
}

function send() {
  const input = document.getElementById("msg");
  const text = input.value.trim();
  if (!text) return;

  push(ref(db, "chats/" + chatId), {
    text,
    name: currentName,
    time: serverTimestamp()
  });

  input.value = "";
}

function loadMessages() {
  const box = document.getElementById("msgs");

  onValue(ref(db, "chats/" + chatId), snap => {
    const data = snap.val() || {};
    box.innerHTML = "";

    Object.values(data).forEach(m => {
      const div = document.createElement("div");

      div.style.marginBottom = "8px";
      div.innerHTML = `
        <div style="
          background:#202c33;
          padding:8px;
          border-radius:10px;
          max-width:80%;
        ">
          <b>${m.name}</b><br>
          ${m.text}
        </div>
      `;

      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    currentName = localStorage.getItem("name");
    chatUI();
  } else {
    loginUI();
  }
});
