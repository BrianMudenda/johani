// app.js - Johani App

// ========== CONFIGURATION ==========
const SUPABASE_URL = 'https://xdpkcrwqpubrwbfffvru.supabase.co';   // <-- REPLACE THIS
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcGtjcndxcHVicndiZmZmdnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTQ5OTQsImV4cCI6MjA4NzA3MDk5NH0.ZPaIOz8SN-iM94J0WujfiNh7s5Ym_V1cTFe9hiC5n7U';                     // <-- REPLACE THIS

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== DOM ELEMENTS ==========
const authSection = document.getElementById('auth-section');
const versesList = document.getElementById('verses-list');
const modal = document.getElementById('note-modal');
const modalVerseNum = document.getElementById('modal-verse-num');
const noteText = document.getElementById('note-text');
const saveNoteBtn = document.getElementById('save-note');
const closeBtn = document.querySelector('.close');

let currentVerseId = null;

// ========== AUTHENTICATION UI ==========
async function renderAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) console.error('Auth error:', error);

  if (user) {
    authSection.innerHTML = `
      <span>👤 ${user.email}</span>
      <button id="logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);
  } else {
    authSection.innerHTML = `
      <input type="email" id="email" placeholder="Email" />
      <input type="password" id="password" placeholder="Password" />
      <button id="login-btn">Login</button>
      <button id="signup-btn">Sign Up</button>
    `;
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('signup-btn').addEventListener('click', signup);
  }
}

async function signup() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) alert('Signup error: ' + error.message);
  else alert('Check your email to confirm!');
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert('Login error: ' + error.message);
  else {
    renderAuth();
    loadVerses();
  }
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) alert('Logout error: ' + error.message);
  renderAuth();
  loadVerses();
}

// Listen to auth changes
supabase.auth.onAuthStateChange(() => {
  renderAuth();
  loadVerses();
});

// ========== LOAD VERSES ==========
async function loadVerses() {
  versesList.innerHTML = '<p class="loading">Loading verses…</p>';

  const { data: verses, error } = await supabase
    .from('verses')
    .select('*')
    .order('verse', { ascending: true });

  if (error) {
    versesList.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
    console.error(error);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  let notesMap = new Map();

  if (user) {
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('verse_id, note')
      .eq('user_id', user.id);

    if (!notesError && notes) {
      notes.forEach(n => notesMap.set(n.verse_id, n.note));
    }
  }

  let html = '';
  verses.forEach(verse => {
    const hasNote = notesMap.has(verse.id);
    const noteIcon = hasNote ? ' 📝' : '';
    html += `
      <div class="verse-card" data-id="${verse.id}" data-verse="${verse.verse}">
        <div class="verse-ref">John 1:${verse.verse}${noteIcon}</div>
        <div class="verse-text">${verse.text}</div>
      </div>
    `;
  });

  versesList.innerHTML = html;

  document.querySelectorAll('.verse-card').forEach(card => {
    card.addEventListener('click', () => {
      openNoteModal(card.dataset.id, card.dataset.verse);
    });
  });
}

// ========== NOTES MODAL ==========
async function openNoteModal(verseId, verseNum) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Please log in to write notes.');
    return;
  }

  currentVerseId = verseId;
  modalVerseNum.textContent = verseNum;
  noteText.value = '';

  const { data, error } = await supabase
    .from('notes')
    .select('note')
    .eq('verse_id', verseId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (data) noteText.value = data.note;
  modal.style.display = 'block';
}

async function saveNote() {
  const note = noteText.value.trim();
  if (!note) {
    alert('Please write something.');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('You must be logged in.');
    modal.style.display = 'none';
    return;
  }

  const { error } = await supabase
    .from('notes')
    .upsert({
      user_id: user.id,
      verse_id: currentVerseId,
      note: note
    }, { onConflict: 'user_id, verse_id' });

  if (error) {
    alert('Error saving note: ' + error.message);
  } else {
    alert('Note saved!');
    modal.style.display = 'none';
    loadVerses();
  }
}

// Close modal events
closeBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
  if (e.target === modal) modal.style.display = 'none';
});
saveNoteBtn.addEventListener('click', saveNote);

// ========== START THE APP ==========
renderAuth();
loadVerses();
