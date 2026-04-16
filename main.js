/**
 * Hauptlogik für den Schuldienstplan
 * Enthält Konfiguration, Rotationslogik, UI-Rendering und Admin-Funktionen.
 */

// ==========================================
// 1. KONFIGURATION & DATEN
// ==========================================

const CONFIG = {
    startDate: "2026-01-12", // Startdatum (Montag)
    endDate: "2026-07-02",   // Enddatum
    adminHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // "password" (SHA-256)
    duties: [
        { 
            id: "tafel", 
            name: "Tafel", 
            icon: "🧽", 
            rule: "Nach jeder Stunde & am Ende des Tages wischen." 
        },
        { 
            id: "fegen", 
            name: "Fegen", 
            icon: "🧹", 
            rule: "Klassenraum am Ende des Tages fegen." 
        },
        { 
            id: "austeilen", 
            name: "Austeilen", 
            icon: "📄", 
            rule: "Arbeitsblätter & Materialien verteilen." 
        },
        { 
            id: "supervisor", 
            name: "Supervisor", 
            icon: "🦅", 
            rule: "Kontrolle aller Dienste auf Sauberkeit.",
            hasCheck: true // Zeigt Checkbox an
        },
        { 
            id: "handy", 
            name: "Handy Hotel", 
            icon: "📱", 
            rule: "Handys morgens einsammeln & wegschließen.",
            dailyCheck: true // Zeigt 5 Checkboxen (Mo-Fr) an
        },
        { 
            id: "muell", 
            name: "Müll", 
            icon: "🗑️", 
            rule: "Müll trennen & Eimer rausbringen." 
        }
    ],
    // 24 Realistische Namen für "Beispiel laden"
    defaultStudents: [
        "Mia Müller", "Ben Schmidt", "Emma Schneider", "Lukas Fischer",
        "Sofia Weber", "Leon Meyer", "Hannah Wagner", "Finn Becker",
        "Anna Schulz", "Elias Hoffmann", "Emilia Schäfer", "Jonas Koch",
        "Lina Bauer", "Noah Richter", "Marie Klein", "Paul Wolf",
        "Lena Schröder", "Luis Neumann", "Lea Schwarz", "Felix Zimmermann",
        "Amelie Braun", "Maximilian Krüger", "Clara Hofman", "Julian Hartmann"
    ]
};

// Globaler Status
let state = {
    students: [], // Liste der Schüler-Objekte
    sickLog: {},  // { "YYYY-WW": [ {name: "Max", replacement: "Moritz"} ] }
    checklist: {}, // { "YYYY-WW-dutyID": true/false }
    currentWeekOffset: 0
};

// ==========================================
// 2. INITIALISIERUNG
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    loadState();
    
    // Wenn keine Schüler vorhanden sind, Setup starten
    if (state.students.length === 0) {
        showSetupModal();
    } else {
        initApp();
    }
});

function initApp() {
    // Startwoche berechnen (basierend auf heutigem Datum)
    jumpToToday();
    setupEventListeners();
}

// ==========================================
// 3. LOGIK & ROTATION
// ==========================================

/**
 * Berechnet die Dienst-Paare für eine spezifische Woche.
 * Rotation: Alle 2 Positionen schieben pro Woche.
 */
function getRosterForWeek(weekOffset) {
    const totalStudents = state.students.length;
    if (totalStudents === 0) return { assignments: [], pauseGroup: [] };

    // Verschiebung: 2 Positionen pro Woche
    // Modulo sorgt dafür, dass es im Kreis läuft
    const shift = (weekOffset * 2) % totalStudents;

    // Wir erstellen ein temporäres Array, das die rotierten Schüler enthält
    // Logik: Der Index im 'rotatedStudents' entspricht der Dienst-Position
    let rotatedStudents = new Array(totalStudents);

    for (let i = 0; i < totalStudents; i++) {
        // Berechne, wer an Position i steht
        // Wenn shift 2 ist: Position 0 wird von Schüler Index 2 besetzt
        let studentIndex = (i + shift) % totalStudents;
        rotatedStudents[i] = state.students[studentIndex];
    }

    // Zuweisung zu Diensten
    const assignments = [];
    let currentIndex = 0;

    // 1. Aktive Dienste (6 Dienste * 2 Schüler = 12 Schüler)
    CONFIG.duties.forEach(duty => {
        // Sicherstellen, dass genügend Schüler da sind
        if (currentIndex + 1 < rotatedStudents.length) {
            const pair = [rotatedStudents[currentIndex], rotatedStudents[currentIndex + 1]];
            assignments.push({
                type: 'active',
                duty: duty,
                pair: pair
            });
            currentIndex += 2;
        }
    });

    // 2. Pause (Restliche Schüler)
    const pauseGroup = [];
    while (currentIndex < totalStudents) {
        pauseGroup.push(rotatedStudents[currentIndex]);
        currentIndex++;
    }

    return { assignments, pauseGroup };
}

function getWeekId(date) {
    // Eindeutige ID für die Woche (z.B. "2026-W3")
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}

// ==========================================
// 4. UI RENDERING
// ==========================================

function renderRoster() {
    if (state.students.length === 0) return;

    const startDate = new Date(CONFIG.startDate);
    // Berechne das Datum der angezeigten Woche
    const currentDisplayDate = new Date(startDate);
    currentDisplayDate.setDate(startDate.getDate() + (state.currentWeekOffset * 7));

    const endDate = new Date(CONFIG.endDate);
    
    // Bounds Check für Navigation
    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');
    
    // Datum anzeigen (Mo - Fr)
    const monday = new Date(currentDisplayDate);
    const friday = new Date(currentDisplayDate);
    friday.setDate(monday.getDate() + 4);
    
    const dateStr = `${formatDate(monday)} - ${formatDate(friday)}`;
    document.getElementById('date-display').textContent = dateStr;
    document.getElementById('date-display').dataset.weekId = getWeekId(monday); // Für Admin/Checklist

    // Buttons deaktivieren wenn außerhalb des Zeitraums
    if (prevBtn) prevBtn.disabled = monday <= startDate;
    if (nextBtn) nextBtn.disabled = friday >= endDate;

    // Wenn Dienstplan vorbei ist
    if (monday > endDate) {
        document.getElementById('roster-grid').innerHTML = '<div class="duty-card"><h3>Dienstplan beendet! 🎉</h3></div>';
        document.getElementById('pause-section').style.display = 'none';
        return;
    } else {
        document.getElementById('pause-section').style.display = 'block';
    }

    // Daten berechnen
    const roster = getRosterForWeek(state.currentWeekOffset);
    const weekId = getWeekId(monday);

    // Grid rendern
    const grid = document.getElementById('roster-grid');
    grid.innerHTML = '';

    roster.assignments.forEach(assign => {
        const card = document.createElement('div');
        card.className = 'duty-card animate-in';
        card.dataset.duty = assign.duty.name;

        // Namen formatieren (Check auf Krankheit)
        const p1 = formatStudentHTML(assign.pair[0], weekId);
        const p2 = formatStudentHTML(assign.pair[1], weekId);

        let checkHtml = '';
        
        // Supervisor Checkbox
        if (assign.duty.hasCheck) {
            const isChecked = state.checklist[`${weekId}-${assign.duty.id}`] || false;
            checkHtml = `
                <label class="task-check ${isChecked ? 'completed' : ''}">
                    <input type="checkbox" onchange="toggleCheck('${weekId}', '${assign.duty.id}', this)" ${isChecked ? 'checked' : ''}>
                    ${isChecked ? 'Dienste kontrolliert' : 'Kontrolle bestätigen'}
                </label>
            `;
        }

        // Handy Hotel Daily Checks
        if (assign.duty.dailyCheck) {
            const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
            checkHtml += '<div style="display:flex; gap:5px; margin-top:10px; justify-content:center;">';
            days.forEach((day, idx) => {
                const key = `${weekId}-${assign.duty.id}-${idx}`;
                const isChecked = state.checklist[key] || false;
                checkHtml += `
                    <label style="display:flex; flex-direction:column; font-size:0.7rem; align-items:center;">
                        ${day}
                        <input type="checkbox" onchange="toggleCheck('${weekId}', '${assign.duty.id}-${idx}', this)" ${isChecked ? 'checked' : ''}>
                    </label>
                `;
            });
            checkHtml += '</div>';
        }

        card.innerHTML = `
            <div class="duty-icon">${assign.duty.icon}</div>
            <div class="duty-title">${assign.duty.name}</div>
            <div class="duty-rule">${assign.duty.rule}</div>
            <div class="student-pair">
                <span class="student-name">${p1}</span>
                <span class="student-name">${p2}</span>
            </div>
            ${checkHtml}
        `;
        
        // Klick für Details (optional)
        card.onclick = (e) => {
            if(e.target.type !== 'checkbox') {
                // Platzhalter für Karten-Klick
            }
        };

        grid.appendChild(card);
    });

    // Pause Liste rendern
    const pauseList = document.getElementById('pause-list');
    pauseList.innerHTML = '';
    
    // Sortierung: Die ersten 2 der Pause-Gruppe sind nächste Woche Tafel-Dienst
    roster.pauseGroup.forEach((student, index) => {
        const span = document.createElement('span');
        span.className = 'pause-name';
        
        // Prüfen ob krank
        const sickEntry = getSickEntry(student.name, weekId);
        if (sickEntry) {
            span.classList.add('sick-student');
        }
        
        span.textContent = student.name;
        // Hinweis: Die ersten beiden sind nächste Woche dran
        if (index < 2) span.title = "Nächste Woche: Tafel";
        
        pauseList.appendChild(span);
    });
}

function formatStudentHTML(studentObj, weekId) {
    if (!studentObj) return "???";
    
    const sickEntry = getSickEntry(studentObj.name, weekId);
    if (sickEntry) {
        let html = `<span class="sick-student">${studentObj.name}</span>`;
        if (sickEntry.replacement) {
            html += `<span class="sick-replacement">↳ Ersatz: ${sickEntry.replacement}</span>`;
        }
        return html;
    }
    return studentObj.name;
}

function formatDate(date) {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==========================================
// 5. INTERAKTIONEN & EVENTS
// ==========================================

function setupEventListeners() {
    // Navigation
    const nextBtn = document.getElementById('next-week-btn');
    const prevBtn = document.getElementById('prev-week-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => changeWeek(1));
    if (prevBtn) prevBtn.addEventListener('click', () => changeWeek(-1));
    document.getElementById('today-btn')?.addEventListener('click', jumpToToday);

    // Admin Modal
    const adminModal = document.getElementById('admin-modal');
    document.getElementById('admin-toggle-btn').addEventListener('click', () => {
        adminModal.classList.remove('hidden');
        document.getElementById('admin-login').style.display = 'block';
        document.getElementById('admin-panel').classList.add('hidden');
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        adminModal.classList.add('hidden');
    });

    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);

    // Admin Funktionen
    document.getElementById('mark-sick-btn').addEventListener('click', markStudentSick);
    document.getElementById('edit-students-btn').addEventListener('click', () => {
        adminModal.classList.add('hidden');
        showSetupModal(true); // true = edit mode
    });
    document.getElementById('reset-app-btn').addEventListener('click', resetApp);
    
    // Backup
    document.getElementById('download-backup-btn').addEventListener('click', downloadBackup);
    document.getElementById('upload-backup-input').addEventListener('change', uploadBackup);

    // Setup Modal: BEISPIEL LADEN FIX
    document.getElementById('load-default-btn').addEventListener('click', () => {
        // Lädt die echten deutschen Beispielnamen in die Textarea
        document.getElementById('student-input-area').value = CONFIG.defaultStudents.join('\n');
    });
    
    document.getElementById('save-students-btn').addEventListener('click', saveStudentsFromInput);
}

function changeWeek(offset) {
    state.currentWeekOffset += offset;
    renderRoster();
}

function jumpToToday() {
    const start = new Date(CONFIG.startDate);
    const now = new Date();
    
    // Differenz in Wochen berechnen
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const diffWeeks = Math.floor(diffDays / 7);

    // Wenn Datum vor Start, dann 0
    if (now < start) {
        state.currentWeekOffset = 0;
    } else {
        state.currentWeekOffset = diffWeeks;
    }
    renderRoster();
}

// Global verfügbar machen für HTML onclick
window.toggleCheck = function(weekId, taskId, checkbox) {
    const key = `${weekId}-${taskId}`;
    state.checklist[key] = checkbox.checked;
    saveState();
    
    // UI Update für Text
    const label = checkbox.parentElement;
    if (label.classList.contains('task-check')) {
        if (checkbox.checked) {
            label.classList.add('completed');
            label.childNodes[2].textContent = " Dienste kontrolliert"; 
        } else {
            label.classList.remove('completed');
            label.childNodes[2].textContent = " Kontrolle bestätigen";
        }
    }
};

// ==========================================
// 6. ADMIN & DATENVERWALTUNG
// ==========================================

async function handleLogin() {
    const pwd = document.getElementById('admin-password').value;
    const hash = await sha256(pwd);
    
    // Simpler Hash-Check (In echter App salt verwenden)
    // Für Client-only ist dieser Hash: "password"
    if (hash === CONFIG.adminHash) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        populateStudentSelector();
    } else {
        alert("Falsches Passwort!");
    }
}

function populateStudentSelector() {
    const select = document.getElementById('student-selector');
    select.innerHTML = '<option value="">Schüler auswählen...</option>';
    
    // Sortieren alphabetisch
    const sorted = [...state.students].sort((a,b) => a.name.localeCompare(b.name));
    
    sorted.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

function markStudentSick() {
    const name = document.getElementById('student-selector').value;
    if (!name) return;

    // Aktuelle Woche ermitteln
    const weekId = document.getElementById('date-display').dataset.weekId;
    
    // Ersatz finden (einfache Logik: nimm ersten aus der Pause)
    const roster = getRosterForWeek(state.currentWeekOffset);
    const replacement = roster.pauseGroup.length > 0 ? roster.pauseGroup[0].name : "Lehrer fragen";

    // Eintrag erstellen
    if (!state.sickLog[weekId]) state.sickLog[weekId] = [];
    
    // Prüfen ob schon vorhanden
    const exists = state.sickLog[weekId].find(e => e.name === name);
    if (!exists) {
        state.sickLog[weekId].push({
            name: name,
            replacement: replacement,
            date: new Date().toISOString()
        });
        saveState();
        alert(`${name} als krank gemeldet. Ersatz: ${replacement}`);
        renderRoster(); // UI aktualisieren
    } else {
        alert("Schüler ist für diese Woche bereits als krank gemeldet.");
    }
}

function getSickEntry(name, weekId) {
    if (!state.sickLog[weekId]) return null;
    return state.sickLog[weekId].find(e => e.name === name);
}

// Setup Modal Funktionen
function showSetupModal(isEdit = false) {
    const modal = document.getElementById('setup-modal');
    modal.classList.remove('hidden');
    
    if (isEdit) {
        const names = state.students.map(s => s.name).join('\n');
        document.getElementById('student-input-area').value = names;
    }
}

function saveStudentsFromInput() {
    const text = document.getElementById('student-input-area').value;
    // Split nach Zeilenumbruch oder Komma und entferne leere Einträge
    const lines = text.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

    if (lines.length !== 24) {
        if (!confirm(`Du hast ${lines.length} Namen eingegeben. Das System ist für exakt 24 Schüler optimiert. Fortfahren? (Dies kann die Rotation verzerren)`)) {
            return;
        }
    }

    state.students = lines.map((name, index) => ({ id: index, name: name }));
    state.currentWeekOffset = 0; // Reset auf Start
    state.sickLog = {}; // Reset Logs bei neuer Klasse
    state.checklist = {};
    
    saveState();
    document.getElementById('setup-modal').classList.add('hidden');
    initApp();
}

// Backup Funktionen
function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "dienstplan_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function uploadBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (json.students && json.checklist) {
                state = json;
                saveState();
                renderRoster();
                alert("Backup erfolgreich geladen!");
            } else {
                alert("Ungültige Backup-Datei.");
            }
        } catch (err) {
            alert("Fehler beim Lesen der Datei.");
        }
        // FIX: Value resetten, damit man gleiche Datei erneut laden kann
        event.target.value = '';
    };
    reader.readAsText(file);
}

function resetApp() {
    if (confirm("Wirklich alles löschen? Dies kann nicht rückgängig gemacht werden.")) {
        localStorage.removeItem('dienstplanState');
        location.reload();
    }
}

// ==========================================
// 7. HELPER & STORAGE
// ==========================================

function saveState() {
    localStorage.setItem('dienstplanState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('dienstplanState');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Speicherfehler", e);
        }
    }
}

// Hilfsfunktion für Hashing (Web Crypto API)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}