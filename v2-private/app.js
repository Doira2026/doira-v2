import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, set, onValue, push, onDisconnect, serverTimestamp, remove, onChildAdded, update, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyAksQf3rkeG998TmJj-YuA3WpTDLLZ1ais",
  authDomain: "doira-chat-v2.firebaseapp.com",
  databaseURL: "https://doira-chat-v2-default-rtdb.firebaseio.com",
  projectId: "doira-chat-v2",
  storageBucket: "doira-chat-v2.firebasestorage.app",
  messagingSenderId: "885552294238",
  appId: "1:885552294238:web:8a5d288d1eb57e11b687cf"
};

const IMGBB_API_KEY = 'e4cecebb229f451e3322c126e3d09399';
const STICKERS = ['😀','😂','😍','😘','😎','😭','😡','👍','🔥','❤','💯','🎉','🤔','🙏','👏','😴','💀','🤡','🥳','😇','😈','🤪','🥺','😱'];
const REACTIONS = ['❤️','😂','👍','😮','😢','🙏'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let currentUserName = '';
let currentChatId = null;
let currentChatUser = null;
let currentChatUid = null;
let isGroupChat = false;
let messagesUnsubscribe = null;
let mediaRecorder = null;
let audioChunks = [];
let allUsers = {};
let friendsList = {};
let unreadCounts = {};
let editingMsgKey = null;
let groupsList = {};
let typingTimeout = null;
let isDarkMode = localStorage.getItem('doira_theme')!== 'light';
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let currentCallId = null;

const appDiv = document.getElementById('app');
const notifSound = document.getElementById('notifSound');
const ringSound = document.getElementById('ringSound');

function applyTheme() {
  document.body.className = isDarkMode? '' : 'light';
}

async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function showLogin() {
  applyTheme();
  appDiv.innerHTML = `
    <div class="flex items-center justify-center h-screen p-4" style="background: var(--bg);">
      <div class="p-8 rounded-lg w-full max-w-sm" style="background: var(--bg-secondary);">
        <h1 class="text-3xl font-bold text-center mb-6">DOIRA V3 PRO</h1>
        <input id="nameInput" type="text" placeholder="Исмингизни киритинг"
          class="w-full p-3 rounded mb-4 outline-none" style="background: var(--bg-input); color: var(--text);">
        <button id="joinBtn" class="w-full bg-[#00a884] p-3 rounded font-bold text-white">Кириш</button>
      </div>
    </div>
  `;
  document.getElementById('joinBtn').onclick = join;
  document.getElementById('nameInput').onkeyup = e => e.key === 'Enter' && join();
}

async function join() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) return;
  localStorage.setItem('doira_name', name);
  await requestNotificationPermission();
  await signInAnonymously(auth);
}

function showChat() {
  applyTheme();
  appDiv.innerHTML = `
    <div class="overlay" id="overlay"></div>
    <div class="flex h-screen">
      <div class="sidebar w-1/3" id="sidebar">
        <div class="header-bar p-3">
          <div class="flex justify-between items-center mb-2">
            <h1 class="text-lg font-bold">DOIRA V3</h1>
            <div class="flex gap-1">
              <button id="themeBtn" class="px-2 py-1 rounded text-xs" style="background: var(--bg-input);">${isDarkMode? '☀️' : '🌙'}</button>
              <button id="newGroupBtn" class="bg-[#00a884] px-2 py-1 rounded text-xs text-white">+ Гуруҳ</button>
              <button id="logoutBtn" class="bg-red-600 px-2 py-1 rounded text-xs text-white">Чиқиш</button>
            </div>
          </div>
          <div id="myProfile" class="p-2 rounded flex items-center gap-2 cursor-pointer" style="background: var(--bg-input);">
            <div class="w-8 h-8 bg-[#00a884] rounded-full flex items-center justify-center text-sm font-bold">👤</div>
            <div class="flex-1">
              <div class="text-xs" style="color: var(--text-secondary);">Сен:</div>
              <div id="myName" class="text-sm font-bold"></div>
            </div>
            <div class="text-xs">✏</div>
          </div>
          <input id="searchInput" type="text" placeholder="🔍 Қидириш..."
            class="w-full p-2 rounded mt-2 outline-none text-sm" style="background: var(--bg-input); color: var(--text);">
        </div>
        <div id="usersList" class="overflow-y-auto" style="height: calc(100vh - 190px); height: calc(100dvh - 190px);"></div>
      </div>
      <div class="flex-1 main-wrap w-full chat-bg">
        <div id="chatHeader" class="header-bar p-3 flex items-center gap-3">
          <button id="menuBtn" class="md:hidden text-2xl">☰</button>
          <div class="flex-1 cursor-pointer" id="chatInfoBtn">
            <div id="chatHeaderText" class="font-bold text-sm">Суҳбатдошни танланг</div>
            <div id="chatSubText" class="text-xs" style="color: var(--text-secondary);"></div>
          </div>
          <button id="callBtn" class="hidden text-xl px-2">📞</button>
        </div>
        <div id="pinnedMsg" class="hidden"></div>
        <div id="messages" class="messages-box p-2"></div>
        <div id="typingIndicator" class="typing-indicator hidden"></div>
        <div id="stickerPanel" class="p-2 hidden grid grid-cols-8 gap-1 max-h-28 overflow-y-auto input-bar"></div>
        <div id="reactionPanel" class="p-2 hidden flex justify-around input-bar"></div>
        <div id="editBanner" class="p-2 hidden flex justify-between items-center text-sm input-bar" style="background: var(--bg-input);">
          <span>✏️ Хабарни таҳрирлаш</span>
          <button id="cancelEditBtn" class="text-red-400">Бекор қилиш</button>
        </div>
        <div id="inputArea" class="input-bar p-2 hidden">
          <div class="flex gap-1 items-center">
            <button id="attachBtn" class="btn-icon text-lg px-1">📎</button>
            <button id="stickerBtn" class="btn-icon text-lg px-1">😊</button>
            <input id="msgInput" type="text" placeholder="Хабар..."
              class="flex-1 p-2 rounded outline-none text-sm" style="background: var(--bg-input); color: var(--text);">
            <button id="micBtn" class="btn-icon text-lg px-1">🎤</button>
            <button id="sendBtn" class="bg-[#00a884] px-3 py-2 rounded text-xs text-white">Юбор</button>
          </div>
          <input type="file" id="fileInput" accept="image/*" class="hidden">
        </div>
      </div>
    </div>
    <div id="groupModal" class="fixed inset-0 bg-black/70 hidden items-center justify-center z-50">
      <div class="p-6 rounded-lg w-11/12 max-w-md" style="background: var(--bg-secondary);">
        <h2 class="text-xl font-bold mb-4">Янги гуруҳ</h2>
        <input id="groupNameInput" type="text" placeholder="Гуруҳ номи" class="w-full p-2 rounded mb-3 outline-none" style="background: var(--bg-input); color: var(--text);">
        <div id="groupUsersList" class="max-h-60 overflow-y-auto mb-3"></div>
        <div class="flex gap-2">
          <button id="createGroupBtn" class="flex-1 bg-[#00a884] p-2 rounded font-bold text-white">Яратиш</button>
          <button id="cancelGroupBtn" class="flex-1 bg-gray-600 p-2 rounded font-bold text-white">Бекор</button>
        </div>
      </div>
    </div>
    <div id="groupInfoModal" class="fixed inset-0 bg-black/70 hidden items-center justify-center z-50">
      <div class="p-6 rounded-lg w-11/12 max-w-md" style="background: var(--bg-secondary);">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold" id="groupInfoName"></h2>
          <button id="closeGroupInfo" class="text-2xl">×</button>
        </div>
        <div class="text-sm mb-2" style="color: var(--text-secondary);">Аъзолар:</div>
        <div id="groupMembersList" class="member-list"></div>
      </div>
    </div>
    <div id="callModal" class="call-modal hidden">
      <div class="text-center">
        <div id="callStatus" class="text-2xl mb-4 text-white"></div>
        <div id="callName" class="text-xl mb-8 text-white"></div>
        <div class="flex gap-4 justify-center">
          <button id="acceptCallBtn" class="bg-green-600 px-8 py-4 rounded-full text-2xl hidden">📞</button>
          <button id="endCallBtn" class="bg-red-600 px-8 py-4 rounded-full text-2xl">📞</button>
        </div>
        <audio id="remoteAudio" autoplay></audio>
      </div>
    </div>
  `;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('attachBtn').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('stickerBtn').onclick = toggleStickers;
  document.getElementById('micBtn').onclick = toggleRecording;
  document.getElementById('fileInput').onchange = uploadFile;
  document.getElementById('menuBtn').onclick = toggleSidebar;
  document.getElementById('overlay').onclick = toggleSidebar;
  document.getElementById('searchInput').oninput = renderUsers;
  document.getElementById('myProfile').onclick = changeName;
  document.getElementById('myName').textContent = currentUserName;
  document.getElementById('newGroupBtn').onclick = showGroupModal;
  document.getElementById('cancelGroupBtn').onclick = hideGroupModal;
  document.getElementById('createGroupBtn').onclick = createGroup;
  document.getElementById('cancelEditBtn').onclick = cancelEdit;
  document.getElementById('msgInput').oninput = handleTyping;
  document.getElementById('callBtn').onclick = startCall;
  document.getElementById('acceptCallBtn').onclick = acceptCall;
  document.getElementById('endCallBtn').onclick = endCall;
  document.getElementById('chatInfoBtn').onclick = showGroupInfo;
  document.getElementById('closeGroupInfo').onclick = hideGroupInfo;
  loadStickers();
  loadReactions();
  loadUsers();
  loadGroups();
  loadUnreadCounts();
  listenForCalls();
}

function toggleTheme() {
  isDarkMode =!isDarkMode;
  localStorage.setItem('doira_theme', isDarkMode? 'dark' : 'light');
  applyTheme();
  document.getElementById('themeBtn').textContent = isDarkMode? '☀️' : '🌙';
}

window.changeName = async () => {
  const newName = prompt('Янги исм киритинг:', currentUserName);
  if (!newName || newName.trim() === '' || newName === currentUserName) return;
  const name = newName.trim();
  localStorage.setItem('doira_name', name);
  currentUserName = name;
  currentUser.displayName = name;
  document.getElementById('myName').textContent = name;
  await update(ref(db, `users/${currentUser.uid}`), { name });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function loadStickers() {
  const panel = document.getElementById('stickerPanel');
  panel.innerHTML = STICKERS.map(s =>
    `<div class="text-2xl cursor-pointer hover:bg-[#2a3942] rounded p-1 text-center" onclick="sendSticker('${s}')">${s}</div>`
  ).join('');
}

function loadReactions() {
  const panel = document.getElementById('reactionPanel');
  panel.innerHTML = REACTIONS.map(r =>
    `<div class="text-2xl cursor-pointer hover:bg-[#2a3942] rounded p-2" onclick="addReaction('${r}')">${r}</div>`
  ).join('');
}

function toggleStickers() {
  document.getElementById('stickerPanel').classList.toggle('hidden');
  document.getElementById('reactionPanel').classList.add('hidden');
}

function toggleReactions() {
  document.getElementById('reactionPanel').classList.toggle('hidden');
  document.getElementById('stickerPanel').classList.add('hidden');
}

window.sendSticker = async (sticker) => {
  if (!currentChatId) return;
  toggleStickers();
  await push(ref(db, `chats/${currentChatId}`), {
    text: sticker, sender: currentUser.uid, senderName: currentUserName, time: serverTimestamp(), type: 'sticker', status: 'sent'
  });
}

let reactingMsgKey = null;
window.showReactionPanel = (key) => {
  reactingMsgKey = key;
  toggleReactions();
}

window.addReaction = async (emoji) => {
  if (!reactingMsgKey ||!currentChatId) return;
  const reactRef = ref(db, `chats/${currentChatId}/${reactingMsgKey}/reactions/${currentUser.uid}`);
  const snap = await get(reactRef);
  if (snap.val() === emoji) {
    await remove(reactRef);
  } else {
    await set(reactRef, emoji);
  }
  toggleReactions();
  reactingMsgKey = null;
}

function loadUnreadCounts() {
  const unreadRef = ref(db, `unread/${currentUser.uid}`);
  onValue(unreadRef, snap => {
    unreadCounts = snap.val() || {};
    renderUsers();
  });
}

function loadUsers() {
  const usersRef = ref(db, 'users');
  onValue(usersRef, snap => {
    allUsers = snap.val() || {};
    renderUsers();
  });
  const friendsRef = ref(db, `friends/${currentUser.uid}`);
  onValue(friendsRef, snap => {
    friendsList = snap.val() || {};
    renderUsers();
  });
}

function loadGroups() {
  const groupsRef = ref(db, 'groups');
  onValue(groupsRef, snap => {
    groupsList = snap.val() || {};
    renderUsers();
  });
}

function renderUsers() {
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const list = document.getElementById('usersList');
  if (!list) return;
  list.innerHTML = '';
  const items = [];
  Object.entries(groupsList).forEach(([gid, group]) => {
    if (group.members && group.members[currentUser.uid]) {
      if (searchQuery &&!group.name.toLowerCase().includes(searchQuery)) return;
      items.push({ id: gid, name: group.name, type: 'group', unread: unreadCounts[gid] || 0 });
    }
  });
  Object.entries(allUsers).forEach(([uid, user]) => {
    if (uid === currentUser.uid) return;
    if (searchQuery &&!user.name.toLowerCase().includes(searchQuery)) return;
    items.push({ id: uid,...user, type: 'user', isFriend:!!friendsList[uid], unread: unreadCounts[uid] || 0 });
  });
  items.sort((a, b) => {
    if (a.unread &&!b.unread) return -1;
    if (!a.unread && b.unread) return 1;
    if (a.type === 'group' && b.type!== 'group') return -1;
    if (a.type!== 'group' && b.type === 'group') return 1;
    if (a.isFriend &&!b.isFriend) return -1;
    if (!a.isFriend && b.isFriend) return 1;
    return (b.lastSeen || 0) - (a.lastSeen || 0);
  });
  if (items.length === 0) {
    list.innerHTML = '<div class="p-4 text-center text-sm" style="color: var(--text-secondary);">Ҳеч ким топилмади</div>';
    return;
  }
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'p-3 cursor-pointer flex items-center gap-3';
    div.style.borderBottom = '1px solid var(--border)';
    if (item.type === 'group') {
      div.innerHTML = `
        <div class="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-lg">👥</div>
        <div class="flex-1" onclick="openGroup('${item.id}', '${item.name}')">
          <div class="font-bold text-sm">${item.name}</div>
          <div class="text-xs" style="color: var(--text-secondary);">Гуруҳ</div>
        </div>
        ${item.unread? `<div class="unread-badge">${item.unread}</div>` : ''}
      `;
    } else {
      div.innerHTML = `
        <div class="w-2.5 h-2.5 rounded-full ${item.online? 'bg-green-500' : 'bg-gray-500'}"></div>
        <div class="flex-1" onclick="openChatUser('${item.id}', '${item.name}')">
          <div class="font-bold text-sm flex items-center gap-1">${item.name}</div>
          <div class="text-xs" style="color: var(--text-secondary);">${item.online? 'онлайн' : 'оффлайн'}</div>
        </div>
        <button onclick="event.stopPropagation(); toggleFriend('${item.id}', ${item.isFriend})" class="text-lg px-2">
          ${item.isFriend? '⭐' : '☆'}
        </button>
        ${item.unread? `<div class="unread-badge">${item.unread}</div>` : ''}
      `;
    }
    list.appendChild(div);
  });
}

window.openChatUser = (uid, name) => {
  openChat(uid, name, false);
  if (window.innerWidth < 768) toggleSidebar();
}

window.openGroup = (gid, name) => {
  openChat(gid, name, true);
  if (window.innerWidth < 768) toggleSidebar();
}

window.toggleFriend = async (uid, isFriend) => {
  if (isFriend) {
    await remove(ref(db, `friends/${currentUser.uid}/${uid}`));
  } else {
    await set(ref(db, `friends/${currentUser.uid}/${uid}`), true);
  }
}

function showGroupModal() {
  const modal = document.getElementById('groupModal');
  const list = document.getElementById('groupUsersList');
  list.innerHTML = '';
  Object.entries(allUsers).forEach(([uid, user]) => {
    if (uid === currentUser.uid) return;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-2 rounded';
    div.style.background = 'var(--bg-input)';
    div.innerHTML = `<input type="checkbox" value="${uid}" class="group-user-cb"><span>${user.name}</span>`;
    list.appendChild(div);
  });
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function hideGroupModal() {
  document.getElementById('groupModal').classList.add('hidden');
  document.getElementById('groupModal').classList.remove('flex');
  document.getElementById('groupNameInput').value = '';
}

async function createGroup() {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) return alert('Гуруҳ номини киритинг');
  const checkboxes = document.querySelectorAll('.group-user-cb:checked');
  if (checkboxes.length === 0) return alert('Камида 1 та одам танланг');
  const members = { [currentUser.uid]: true };
  checkboxes.forEach(cb => members[cb.value] = true);
  const groupRef = push(ref(db, 'groups'));
  await set(groupRef, { name, creator: currentUser.uid, members, created: serverTimestamp() });
  hideGroupModal();
}

function showGroupInfo() {
  if (!isGroupChat ||!currentChatId) return;
  const group = groupsList[currentChatId];
  if (!group) return;
  document.getElementById('groupInfoName').textContent = group.name;
  const membersList = document.getElementById('groupMembersList');
  membersList.innerHTML = '';
  Object.keys(group.members || {}).forEach(uid => {
    const user = allUsers[uid];
    if (user) {
      const div = document.createElement('div');
      div.className = 'p-2 rounded mb-1 flex items-center gap-2';
      div.style.background = 'var(--bg-input)';
      div.innerHTML = `
        <div class="w-2 h-2 rounded-full ${user.online? 'bg-green-500' : 'bg-gray-500'}"></div>
        <span>${user.name}</span>
        ${uid === group.creator? '<span class="text-xs text-[#00a884] ml-auto">Админ</span>' : ''}
      `;
      membersList.appendChild(div);
    }
  });
  document.getElementById('groupInfoModal').classList.remove('hidden');
  document.getElementById('groupInfoModal').classList.add('flex');
}

function hideGroupInfo() {
  document.getElementById('groupInfoModal').classList.add('hidden');
  document.getElementById('groupInfoModal').classList.remove('flex');
}

function openChat(id, name, isGroup = false) {
  isGroupChat = isGroup;
  if (isGroup) {
    currentChatId = id;
    currentChatUser = name;
    currentChatUid = null;
    document.getElementById('callBtn').classList.add('hidden');
    document.getElementById('chatSubText').textContent = `${Object.keys(groupsList[id]?.members || {}).length} аъзо`;
  } else {
    currentChatId = [currentUser.uid, id].sort().join('_');
    currentChatUser = name;
    currentChatUid = id;
    document.getElementById('callBtn').classList.remove('hidden');
    document.getElementById('chatSubText').textContent = allUsers[id]?.online? 'онлайн' : 'оффлайн';
  }
  document.getElementById('chatHeaderText').textContent = name;
  document.getElementById('inputArea').classList.remove('hidden');
  document.getElementById('sendBtn').onclick = sendMsg;
  document.getElementById('msgInput').onkeyup = e => e.key === 'Enter' && sendMsg();
  remove(ref(db, `unread/${currentUser.uid}/${id}`));
  loadMessages();
  listenTyping();
  loadPinnedMessage();
}

function listenTyping() {
  if (isGroupChat) return;
  const typingRef = ref(db, `typing/${currentChatId}/${currentChatUid}`);
  onValue(typingRef, snap => {
    const isTyping = snap.val();
    document.getElementById('typingIndicator').classList.toggle('hidden',!isTyping);
    if (isTyping) document.getElementById('typingIndicator').textContent = `${currentChatUser} ёзяпти...`;
  });
}

function handleTyping() {
  if (!currentChatId || isGroupChat) return;
  const typingRef = ref(db, `typing/${currentChatId}/${currentUser.uid}`);
  set(typingRef, true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => set(typingRef, false), 2000);
}

function loadPinnedMessage() {
  const pinnedRef = ref(db, `pinned/${currentChatId}`);
  onValue(pinnedRef, snap => {
    const pinned = snap.val();
    const pinnedDiv = document.getElementById('pinnedMsg');
    if (pinned) {
      pinnedDiv.innerHTML = `
        <div class="pinned-msg" onclick="scrollToMessage('${pinned.msgId}')">
          <div class="text-xs font-bold text-[#00a884] mb-1">📌 Маҳкамланган хабар</div>
          <div class="text-sm truncate">${pinned.text}</div>
        </div>
      `;
      pinnedDiv.classList.remove('hidden');
    } else {
      pinnedDiv.classList.add('hidden');
    }
  });
}

window.scrollToMessage = (msgId) => {
  const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function loadMessages() {
  if (messagesUnsubscribe) messagesUnsubscribe();
  const msgsRef = ref(db, `chats/${currentChatId}`);
  let isFirstLoad = true;
  onChildAdded(msgsRef, (snapshot) => {
    const msg = snapshot.val();
    if (!isFirstLoad && msg.sender!== currentUser.uid) {
      if (Notification.permission === 'granted' && document.hidden) {
        new Notification(currentChatUser, {
          body: msg.type === 'text'? msg.text : msg.type === 'sticker'? msg.text : msg.type === 'image'? '📷 Расм' : '🎤 Овозли хабар',
          icon: './icon-192.png',
          tag: currentChatId
        });
      }
      notifSound.play().catch(()=>{});
      if (currentChatUid!== msg.sender) {
        const unreadRef = ref(db, `unread/${currentUser.uid}/${msg.sender || currentChatId}`);
        get(unreadRef).then(snap => {
          const count = (snap.val() || 0) + 1;
          set(unreadRef, count);
        });
      }
    }
  });
  messagesUnsubscribe = onValue(msgsRef, snap => {
    const msgs = snap.val() || {};
    const box = document.getElementById('messages');
    box.innerHTML = '';
    Object.entries(msgs).forEach(([key, msg]) => {
      const div = document.createElement('div');
      const isMine = msg.sender === currentUser.uid;
      div.className = `mb-2 flex ${isMine? 'justify-end' : 'justify-start'}`;
      div.setAttribute('data-msg-id', key);
      let content = '';
      if (msg.type === 'image') {
        content = `<img src="${msg.url}" class="msg-img rounded-lg">`;
      } else if (msg.type === 'audio') {
        content = `<audio controls src="${msg.audioData}" class="msg-audio"></audio>`;
      } else if (msg.type === 'sticker') {
        content = `<div class="text-5xl md:text-6xl">${msg.text || ''}</div>`;
      } else {
        content = msg.text || '';
      }
      let reactionsHtml = '';
      if (msg.reactions) {
        const reacts = Object.values(msg.reactions).reduce((acc, r) => {
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        }, {});
        reactionsHtml = `<div class="reaction-bar">${Object.entries(reacts).map(([emoji, count]) => `${emoji}${count > 1? count : ''}`).join(' ')}</div>`;
      }
      const editedHtml = msg.edited? `<span class="edited-label">(таҳрирланган)</span>` : '';
      const statusIcon = isMine? `<span class="seen-status ${msg.status==='seen'? 'seen' : 'delivered'}">${msg.status==='seen'? '✓✓' : '✓'}</span>` : '';
      div.innerHTML = `
        <div class="max-w-[75%] px-3 py-2 rounded-lg text-sm ${isMine? 'msg-out' : 'msg-in'} break-words msg-text" data-msg-id="${key}"
             oncontextmenu="showMsgMenu(event, '${key}', ${isMine}); return false;"
             ontouchstart="startTouch(event, '${key}', ${isMine})"
             ontouchend="endTouch()">
          ${!isMine && msg.senderName? `<div class="text-xs text-[#00a884] font-bold mb-1">${msg.senderName}</div>` : ''}
          ${content}${editedHtml}
          ${reactionsHtml}
          ${statusIcon}
        </div>
      `;
      box.appendChild(div);
      if (isMine && msg.status!=='seen' && currentChatUid) {
        set(ref(db, `chats/${currentChatId}/${key}/status`), 'delivered');
      }
    });
    box.scrollTop = box.scrollHeight;
    isFirstLoad = false;
  });
}

let touchTimer = null;
let touchMsgKey = null;
let touchIsMine = false;
window.startTouch = (e, key, isMine) => {
  touchMsgKey = key;
  touchIsMine = isMine;
  touchTimer = setTimeout(() => showMsgMenu(e, key, isMine), 600);
}
window.endTouch = () => clearTimeout(touchTimer);

window.showMsgMenu = (e, key, isMine) => {
  e.preventDefault();
  document.querySelectorAll('.msg-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'msg-menu';
  let menuHtml = `<button onclick="showReactionPanel('${key}')" class="block px-4 py-2 hover:bg-[#2a3942] rounded text-sm w-full text-left">😊 Реакция</button>`;
  menuHtml += `<button onclick="pinMessage('${key}')" class="block px-4 py-2 hover:bg-[#2a3942] rounded text-sm w-full text-left">📌 Маҳкамлаш</button>`;
  if (isMine) {
    menuHtml += `
      <button onclick="startEdit('${key}')" class="block px-4 py-2 hover:bg-[#2a3942] rounded text-sm w-full text-left">✏️ Таҳрирлаш</button>
      <button onclick="deleteMsg('${key}')" class="block px-4 py-2 hover:bg-[#2a3942] rounded text-sm w-full text-left text-red-400">🗑️ Ўчириш</button>
    `;
  }
  menu.innerHTML = menuHtml;
  menu.style.left = Math.min(e.pageX, window.innerWidth - 150) + 'px';
  menu.style.top = e.pageY + 'px';
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

window.pinMessage = async (key) => {
  const msgRef = ref(db, `chats/${currentChatId}/${key}`);
  const snap = await get(msgRef);
  const msg = snap.val();
  if (msg.type!=='text') return alert('Фақат матнни маҳкамлаш мумкин');
  await set(ref(db, `pinned/${currentChatId}`), { msgId: key, text: msg.text });
}

window.startEdit = async (key) => {
  const msgRef = ref(db, `chats/${currentChatId}/${key}`);
  const snap = await get(msgRef);
  const msg = snap.val();
  if (msg.type!=='text') return alert('Фақат матнни таҳрирлаш мумкин');
  editingMsgKey = key;
  document.getElementById('msgInput').value = msg.text;
  document.getElementById('editBanner').classList.remove('hidden');
  document.getElementById('msgInput').focus();
}

function cancelEdit() {
  editingMsgKey = null;
  document.getElementById('msgInput').value = '';
  document.getElementById('editBanner').classList.add('hidden');
}

window.deleteMsg = async (key) => {
  if (!confirm('Хабарни ўчиришга ишончингиз комилми?')) return;
  await remove(ref(db, `chats/${currentChatId}/${key}`));
}

async function sendMsg() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text ||!currentChatId) return;
  if (editingMsgKey) {
    await update(ref(db, `chats/${currentChatId}/${editingMsgKey}`), {
      text, edited: true, editTime: serverTimestamp()
    });
    cancelEdit();
  } else {
    input.value = '';
    await push(ref(db, `chats/${currentChatId}`), {
      text, sender: currentUser.uid, senderName: currentUserName, time: serverTimestamp(), type: 'text', status: 'sent'
    });
  }
}

async function uploadFile(e) {
  const file = e.target.files[0];
  if (!file ||!currentChatId) return;
  if (!file.type.startsWith('image')) {
    alert('Фақат расм юклаш мумкин');
    return;
  }
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      await push(ref(db, `chats/${currentChatId}`), {
        url: data.data.url, sender: currentUser.uid, senderName: currentUserName, time: serverTimestamp(), type: 'image', status: 'sent'
