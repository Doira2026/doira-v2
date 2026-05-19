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
      });
    }
  } catch (err) {
    alert('Расм юклашда хатолик');
  }
  e.target.value = '';
}

async function toggleRecording() {
  const btn = document.getElementById('micBtn');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btn.textContent = '🎤';
    btn.classList.remove('recording');
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result;
          await push(ref(db, `chats/${currentChatId}`), {
            audioData: base64, sender: currentUser.uid, senderName: currentUserName, time: serverTimestamp(), type: 'audio', status: 'sent'
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      btn.textContent = '⏹️';
      btn.classList.add('recording');
    } catch (err) {
      alert('Микрофонга рухсат беринг');
    }
  }
}

async function startCall() {
  if (!currentChatUid) return;
  currentCallId = `${currentUser.uid}_${Date.now()}`;
  const callRef = ref(db, `calls/${currentCallId}`);
  await set(callRef, {
    from: currentUser.uid,
    fromName: currentUserName,
    to: currentChatUid,
    status: 'calling',
    time: serverTimestamp()
  });
  showCallModal('Қўнғироқ қилинмоқда...', currentChatUser, false);
  ringSound.play().catch(()=>{});
  listenCallResponse(callRef);
}

function listenCallResponse(callRef) {
  onValue(callRef, async snap => {
    const call = snap.val();
    if (!call) return;
    if (call.status === 'accepted') {
      ringSound.pause();
      document.getElementById('callStatus').textContent = 'Уланди';
      document.getElementById('acceptCallBtn').classList.add('hidden');
      await setupWebRTC(callRef, true);
    } else if (call.status === 'rejected' || call.status === 'ended') {
      endCall();
    }
  });
}

async function acceptCall() {
  if (!currentCallId) return;
  const callRef = ref(db, `calls/${currentCallId}`);
  await update(callRef, { status: 'accepted' });
  ringSound.pause();
  document.getElementById('callStatus').textContent = 'Уланди';
  document.getElementById('acceptCallBtn').classList.add('hidden');
  await setupWebRTC(callRef, false);
}

async function setupWebRTC(callRef, isCaller) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = event => {
      remoteStream = event.streams[0];
      document.getElementById('remoteAudio').srcObject = remoteStream;
    };
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        push(ref(db, `calls/${currentCallId}/candidates/${isCaller? 'caller' : 'callee'}`), event.candidate.toJSON());
      }
    };
    const candidatesRef = ref(db, `calls/${currentCallId}/candidates/${isCaller? 'callee' : 'caller'}`);
    onChildAdded(candidatesRef, snap => {
      const candidate = new RTCIceCandidate(snap.val());
      peerConnection.addIceCandidate(candidate);
    });
    if (isCaller) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await update(callRef, { offer: { type: offer.type, sdp: offer.sdp } });
      onValue(ref(db, `calls/${currentCallId}/answer`), async snap => {
        const answer = snap.val();
        if (answer &&!peerConnection.currentRemoteDescription) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });
    } else {
      const offerSnap = await get(ref(db, `calls/${currentCallId}/offer`));
      const offer = offerSnap.val();
      if (offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await update(callRef, { answer: { type: answer.type, sdp: answer.sdp } });
      }
    }
  } catch (err) {
    console.error('WebRTC error:', err);
    endCall();
  }
}

function showCallModal(status, name, showAccept) {
  document.getElementById('callStatus').textContent = status;
  document.getElementById('callName').textContent = name;
  document.getElementById('acceptCallBtn').classList.toggle('hidden',!showAccept);
  document.getElementById('callModal').classList.remove('hidden');
}

function endCall() {
  if (currentCallId) {
    update(ref(db, `calls/${currentCallId}`), { status: 'ended' });
    setTimeout(() => remove(ref(db, `calls/${currentCallId}`)), 1000);
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  remoteStream = null;
  document.getElementById('remoteAudio').srcObject = null;
  document.getElementById('callModal').classList.add('hidden');
  ringSound.pause();
  ringSound.currentTime = 0;
  currentCallId = null;
}

function listenForCalls() {
  const callsRef = ref(db, 'calls');
  onChildAdded(callsRef, snap => {
    const call = snap.val();
    const callId = snap.key;
    if (call.to === currentUser.uid && call.status === 'calling') {
      currentCallId = callId;
      showCallModal('Кирувчи қўнғироқ', call.fromName, true);
      ringSound.play().catch(()=>{});
      onValue(ref(db, `calls/${callId}`), callSnap => {
        if (!callSnap.val() || callSnap.val().status === 'ended') {
          endCall();
        }
      });
    }
  });
}

async function logout() {
  if (currentUser) {
    await update(ref(db, `users/${currentUser.uid}`), { online: false, lastSeen: serverTimestamp() });
  }
  await auth.signOut();
  location.reload();
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    currentUserName = localStorage.getItem('doira_name') || user.displayName || 'Фойдаланувчи';
    const userRef = ref(db, `users/${user.uid}`);
    await set(userRef, {
      name: currentUserName,
      online: true,
      lastSeen: serverTimestamp()
    });
    onDisconnect(userRef).update({ online: false, lastSeen: serverTimestamp() });
    showChat();
  } else {
    showLogin();
  }
});
