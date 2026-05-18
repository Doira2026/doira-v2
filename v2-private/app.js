import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  serverTimestamp,
  onDisconnect,
  remove
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

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
let currentName = '';
let currentChatId = null;
let users = {};

const appDiv = document.getElementById('app');

function showLogin() {
  appDiv.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-[#111b21] p-4">
      <div class="bg-[#202c33] p-6 rounded-xl w-full max-w-sm">
        <h1 class="text-white text-3xl font-bold text-center mb-6">
          DOIRA CHAT
        </h1>

        <input
          id="nameInput"
          type="text"
          placeholder="Ismingiz"
          class="w-full p-3 rounded-lg bg-[#2a3942] text-white outline-none mb-4"
        >

        <button
          id="joinBtn"
          class="w-full bg-[#00a884] text-white p-3 rounded-lg font-bold"
        >
          Kirish
        </button>
      </div>
    </div>
  `;

  document.getElementById('joinBtn').onclick = joinChat;
}

async function joinChat() {
  const name = document.getElementById('nameInput').value.trim();

  if (!name) {
    alert('Ism kiriting');
    return;
  }

  localStorage.setItem('doira_name', name);

  await signInAnonymously(auth);
}

function showChat() {
  appDiv.innerHTML = `
    <div class="flex h-screen bg-[#111b21] text-white">

      <div class="w-[320px] bg-[#202c33] border-r border-[#2a3942] flex flex-col">

        <div class="p-4 border-b border-[#2a3942]">
          <div class="text-xl font-bold">DOIRA CHAT</div>
          <div class="text-sm text-gray-400 mt-1">
            ${currentName}
          </div>
        </div>

        <div
          id="usersList"
          class="flex-1 overflow-y-auto"
        ></div>

      </div>

      <div class="flex-1 flex flex-col">

        <div
          id="chatHeader"
          class="h-[70px] border-b border-[#2a3942] flex items-center px-4 text-lg font-bold"
        >
          Chat tanlang
        </div>

        <div
          id="messages"
          class="flex-1 overflow-y-auto p-4 space-y-2"
        ></div>

        <div
          id="inputArea"
          class="p-4 border-t border-[#2a3942] hidden"
        >
          <div class="flex gap-2">
            <input
              id="msgInput"
              type="text"
              placeholder="Xabar..."
              class="flex-1 p-3 rounded-lg bg-[#202c33] outline-none"
            >

            <button
              id="sendBtn"
              class="bg-[#00a884] px-5 rounded-lg font-bold"
            >
              Yubor
            </button>
          </div>
        </div>

      </div>

    </div>
  `;

  loadUsers();
}

function loadUsers() {
  const usersRef = ref(db, 'users');

  onValue(usersRef, snapshot => {
    users = snapshot.val() || {};

    const usersList = document.getElementById('usersList');

    usersList.innerHTML = '';

    Object.entries(users).forEach(([uid, user]) => {

      if (uid === currentUser.uid) return;

      const div = document.createElement('div');

      div.className =
        'p-4 border-b border-[#2a3942] cursor-pointer hover:bg-[#2a3942]';

      div.innerHTML = `
        <div class="flex items-center gap-3">

          <div class="
            w-3 h-3 rounded-full
            ${user.online ? 'bg-green-500' : 'bg-gray-500'}
          "></div>

          <div>
            <div class="font-bold">${user.name}</div>

            <div class="text-sm text-gray-400">
              ${user.online ? 'online' : 'offline'}
            </div>
          </div>

        </div>
      `;

      div.onclick = () => openChat(uid, user.name);

      usersList.appendChild(div);
    });
  });
}

function openChat(uid, name) {

  currentChatId = [currentUser.uid, uid].sort().join('_');

  document.getElementById('chatHeader').textContent = name;

  document.getElementById('inputArea').classList.remove('hidden');

  document.getElementById('sendBtn').onclick = sendMessage;

  document.getElementById('msgInput').onkeyup = e => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  loadMessages();
}

async function sendMessage() {

  const input = document.getElementById('msgInput');

  const text = input.value.trim();

  if (!text) return;

  input.value = '';

  await push(ref(db, `chats/${currentChatId}`), {
    text,
    sender: currentUser.uid,
    senderName: currentName,
    time: serverTimestamp()
  });
}

function loadMessages() {

  const messagesRef = ref(db, `chats/${currentChatId}`);

  onValue(messagesRef, snapshot => {

    const messages = snapshot.val() || {};

    const box = document.getElementById('messages');

    box.innerHTML = '';

    Object.entries(messages).forEach(([key, msg]) => {

      const isMine = msg.sender === currentUser.uid;

      const div = document.createElement('div');

      div.className =
        `flex ${isMine ? 'justify-end' : 'justify-start'}`;

      div.innerHTML = `
        <div class="
          max-w-[70%]
          px-4
          py-2
          rounded-xl
          text-white
          ${isMine ? 'bg-[#00a884]' : 'bg-[#202c33]'}
        ">
          ${msg.text}
        </div>
      `;

      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}

function startPresence() {

  const userRef = ref(db, `users/${currentUser.uid}`);

  set(userRef, {
    name: currentName,
    online: true,
    lastSeen: Date.now()
  });

  onDisconnect(userRef).update({
    online: false,
    lastSeen: Date.now()
  });
}

function logout() {
  remove(ref(db, `users/${currentUser.uid}`));
  location.reload();
}

onAuthStateChanged(auth, async user => {

  if (user) {

    currentUser = user;

    currentName =
      localStorage.getItem('doira_name') || 'User';

    startPresence();

    showChat();

  } else {

    showLogin();
  }
});
