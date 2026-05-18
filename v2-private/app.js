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

const IMGBB = "e4cecebb229f451e3322c126e3d09399";

let currentUser = null;
let currentName = "";
let currentChat = null;
let replyTo = null;

const appDiv = document.getElementById("app");

function loginUI() {
  appDiv.innerHTML = `
    <div class="h-screen flex items-center justify-center bg-black text-white">
      <div class="p-5 bg-[#202c33] rounded w-80">
        <h2 class="text-xl mb-4 text-center">DOIRA CHAT</h2>
        <input id="name" class="w-full p-2 text-black rounded" placeholder="Ismingiz">
        <button id="join" class="w-full mt-3 bg-green-500 p-2 rounded">Kirish</button>
      </div>
    </div>
  `;
  document.getElementById("join").onclick = async () => {
    const name = document.getElementById("name").value;
    if (!name) return;
    localStorage.setItem("name", name);
    await signInAnonymously(auth);
  };
}

function chatUI() {
  appDiv.innerHTML = `
    <div class="flex h-screen bg-[#111b21] text-white">
      
      <div class="w-64 bg-[#202c33] p-2 overflow-auto" id="users"></div>

      <div class="flex-1 flex flex-col">

        <div class="p-3 bg-[#202c33] font-bold">Chat</div>

        <div id="messages" class="flex-1 overflow-auto p-3"></div>

        <div class="p-2 bg-[#202c33]">
          <div id="replyBox" class="text-xs text-green-400 mb-1"></div>

          <div class="flex gap-2">
            <input id="msg" class="flex-1 p-2 text-black rounded" placeholder="Xabar...">
            <input type="file" id="file" class="hidden">
            <button id="imgBtn">📷</button>
            <button id="send" class="bg-green-500 px-3 rounded">➤</button>
          </div>
        </div>

      </div>

    </div>
  `;

  document.getElementById("send").onclick = send;
  document.getElementById("imgBtn").onclick = () => document.getElementById("file").click();
  document.getElementById("file").onchange = uploadImage;
}

function openChat(uid) {
  currentChat = uid;
  loadMessages();
}

function send() {
  const input = document.getElementById("msg");
  const text = input.value;
  if (!text || !currentChat) return;

  push(ref(db, "chats/" + currentChat), {
    text,
    sender: currentUser.uid,
    name: currentName,
    time: serverTimestamp(),
    reply: replyTo || null
  });

  replyTo = null;
  document.getElementById("replyBox").innerText = "";
  input.value = "";
}

function loadMessages() {
  const box = document.getElementById("messages");

  onValue(ref(db, "chats/" + currentChat), (snap) => {
    const data = snap.val() || {};
    box.innerHTML = "";

    Object.entries(data).forEach(([id, msg]) => {
      const div = document.createElement("div");
      div.className = "mb-2";

      let content = "";

      if (msg.reply) {
        content += `<div class="text-xs text-gray-400 border-l-2 pl-2">${msg.reply.text}</div>`;
      }

      if (msg.text) content += msg.text;
      if (msg.image) content += `<img src="${msg.image}" width="150">`;

      div.innerHTML = `
        <div class="bg-[#202c33] p-2 rounded max-w-xs">
          <b>${msg.name}</b><br>
          ${content}
          <div class="text-xs text-gray-400 mt-1">
            <button onclick="replyMsg('${id}','${msg.text || ""}')">↩</button>
          </div>
        </div>
      `;

      box.appendChild(div);
    });
  });
}

window.replyMsg = (id, text) => {
  replyTo = { id, text };
  document.getElementById("replyBox").innerText = "Reply: " + text;
};

async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file || !currentChat) return;

  const fd = new FormData();
  fd.append("image", file);

  const res = await fetch(
    "https://api.imgbb.com/1/upload?key=" + IMGBB,
    { method: "POST", body: fd }
  );

  const data = await res.json();

  push(ref(db, "chats/" + currentChat), {
    image: data.data.url,
    sender: currentUser.uid,
    name: currentName,
    time: serverTimestamp()
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    currentName = localStorage.getItem("name");

    set(ref(db, "users/" + user.uid), {
      name: currentName,
      online: true
    });

    chatUI();
  } else {
    loginUI();
  }
});
