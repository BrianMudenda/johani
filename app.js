// app.js

// ================= CONFIGURATION =================
const SUPABASE_URL = 'https://xdpkcrwqpubrwbfffvru.supabase.co';   // <-- REPLACE WITH YOUR URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcGtjcndxcHVicndiZmZmdnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTQ5OTQsImV4cCI6MjA4NzA3MDk5NH0.ZPaIOz8SN-iM94J0WujfiNh7s5Ym_V1cTFe9hiC5n7U';                     // <-- REPLACE WITH YOUR KEY

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ================= AUTHENTICATION =================

// Get the auth section element
const authSection = document.getElementById('auth-section');

// Function to render the auth UI based on user state
async function renderAuth() {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // User is signed in: show email and logout button
    authSection.innerHTML = `
      <span style="margin-right:10px;">👤 ${user.email}</span>
      <button id="logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);
  } else {
    // No user: show login and signup inputs
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

// Sign up function
async function signup() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    alert('Sign up error: ' + error.message);
  } else {
    alert('Check your email for confirmation!');
  }
}

// Login function
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login error: ' + error.message);
  } else {
    renderAuth();    // update UI
    loadVerses();    // reload verses (to possibly show notes indicator)
  }
}

// Logout function
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) alert('Logout error: ' + error.message);
  renderAuth();
  loadVerses();      // reload verses (notes will disappear)
}

// Listen for auth state changes (like when user logs in from another tab)
supabase.auth.onAuthStateChange(() => {
  renderAuth();
  loadVerses();
});

// Call renderAuth when the page loads
renderAuth();
// ================= VERSES =================

const versesList = document.getElementById('verses-list');

async function loadVerses() {
  versesList.innerHTML = '<p class="loading">Loading verses...</p>';

  // Fetch verses, ordered by verse number
  const { data: verses, error } = await supabase
    .from('verses')
    .select('*')
    .order('verse', { ascending: true });

  if (error) {
    versesList.innerHTML = `<p style="color:red;">Error loading verses: ${error.message}</p>`;
    return;
  }

  // If user is logged in, also fetch their notes for these verses
  const { data: { user } } = await supabase.auth.getUser();
  let notesMap = new Map(); // verse_id -> note text

  if (user) {
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('verse_id, note')
      .eq('user_id', user.id);

    if (!notesError && notes) {
      notes.forEach(n => notesMap.set(n.verse_id, n.note));
    }
  }

  // Build HTML for each verse
  let html = '';
  verses.forEach(verse => {
    const hasNote = notesMap.has(verse.id);
    // Add a small 📝 emoji if there's a note
    const noteIndicator = hasNote ? ' <span style="font-size:0.8rem;">📝</span>' : '';
    html += `
      <div class="verse-card" data-verse-id="${verse.id}" data-verse-num="${verse.verse}">
        <div class="verse-ref">John 1:${verse.verse}${noteIndicator}</div>
        <div class="verse-text">${verse.text}</div>
      </div>
    `;
  });

  versesList.innerHTML = html;

  // Attach click event to each verse card
  document.querySelectorAll('.verse-card').forEach(card => {
    card.addEventListener('click', () => openNoteModal(card.dataset.verseId, card.dataset.verseNum));
  });
}

// Load verses when page starts
loadVerses();
// ================= NOTES MODAL =================

const modal = document.getElementById('note-modal');
const modalVerseNum = document.getElementById('modal-verse-num');
const noteText = document.getElementById('note-text');
const saveNoteBtn = document.getElementById('save-note');
const closeBtn = document.querySelector('.close');

let currentVerseId = null;   // which verse is open in the modal

// Open modal when a verse is clicked
async function openNoteModal(verseId, verseNum) {
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Please log in to write notes.');
    return;
  }

  currentVerseId = verseId;
  modalVerseNum.textContent = verseNum;
  noteText.value = ''; // clear previous

  // Load existing note for this verse and user
  const { data, error } = await supabase
    .from('notes')
    .select('note')
    .eq('verse_id', verseId)
    .eq('user_id', user.id)
    .maybeSingle();  // returns one or null

  if (data) {
    noteText.value = data.note;
  }

  modal.style.display = 'block';
}

// Save note
async function saveNote() {
  const note = noteText.value.trim();
  if (!note) {
    alert('Please write something before saving.');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('You must be logged in.');
    modal.style.display = 'none';
    return;
  }

  // Upsert (insert or update) the note
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
    loadVerses(); // refresh to show/hide note indicator
  }
}

// Close modal when X is clicked
closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

// Close modal when clicking outside the modal content
window.addEventListener('click', (event) => {
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});

// Save button click
saveNoteBtn.addEventListener('click', saveNote);
