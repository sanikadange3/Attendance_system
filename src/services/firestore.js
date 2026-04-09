import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, where,
  serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

// ───── Collections ─────
export const studentsCol   = collection(db, 'students');
export const attendanceCol = collection(db, 'attendance');
export const sessionsCol   = collection(db, 'sessions');

export async function addStudent(data) {
  return addDoc(studentsCol, { ...data, createdAt: serverTimestamp() });
}

export async function updateStudent(id, data) {
  return updateDoc(doc(db, 'students', id), data);
}

export async function deleteStudent(id) {
  return deleteDoc(doc(db, 'students', id));
}

export async function getAllStudents() {
  const snap = await getDocs(query(studentsCol, orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeStudents(cb) {
  // Sort in memory to avoid index requirements
  return onSnapshot(studentsCol, 
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      cb(data);
    },
    err => console.error('Students Subscription Error:', err)
  );
}

// ───── Attendance ─────
export async function logAttendance({ studentId, studentName, status, confidence, sessionId, sessionName }) {
  const today = new Date().toISOString().split('T')[0];
  
  if (sessionId) {
    // Session-based duplicate detection
    const existing = await getDocs(
      query(attendanceCol, where('studentId', '==', studentId), where('sessionId', '==', sessionId))
    );
    if (!existing.empty) return null; // already logged for this session
  } else {
    // Daily duplicate detection (fallback)
    const existing = await getDocs(
      query(attendanceCol, where('studentId', '==', studentId), where('date', '==', today), where('sessionId', '==', null))
    );
    if (!existing.empty) return null; // already logged today
  }

  const data = {
    studentId,
    studentName,
    status: status || 'Present',
    confidence: confidence || 1,
    date: today,
    timestamp: serverTimestamp(),
  };

  if (sessionId) {
    data.sessionId = sessionId;
    data.sessionName = sessionName;
  }

  return addDoc(attendanceCol, data);
}

export async function logManualAttendance({ studentId, studentName, status, date }) {
  const d = date || new Date().toISOString().split('T')[0];
  // delete existing for that day first (manual override)
  const existing = await getDocs(
    query(attendanceCol,
      where('studentId', '==', studentId),
      where('date', '==', d)
    )
  );
  for (const snap of existing.docs) await deleteDoc(snap.ref);
  return addDoc(attendanceCol, {
    studentId,
    studentName,
    status,
    confidence: 1,
    date: d,
    timestamp: serverTimestamp(),
    manual: true,
  });
}

export async function getAttendanceByDate(date) {
  const snap = await getDocs(
    query(attendanceCol, where('date', '==', date), orderBy('timestamp', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllAttendance() {
  const snap = await getDocs(query(attendanceCol, orderBy('timestamp', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudentAttendance(studentId) {
  const snap = await getDocs(
    query(attendanceCol, where('studentId', '==', studentId), orderBy('timestamp', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeAttendance(date, cb) {
  const q = date
    ? query(attendanceCol, where('date', '==', date))
    : query(attendanceCol);

  return onSnapshot(q, 
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // In-memory sort by timestamp DESC
      data.sort((a, b) => {
        const tA = a.timestamp?.seconds || 0;
        const tB = b.timestamp?.seconds || 0;
        return tB - tA;
      });
      cb(data);
    },
    err => {
      console.error('Firestore Subscription Error:', err);
    }
  );
}

// ───── Sessions ─────
export async function createSession(data) {
  return addDoc(sessionsCol, { ...data, createdAt: serverTimestamp() });
}

export async function deleteSession(id) {
  return deleteDoc(doc(db, 'sessions', id));
}

export function subscribeSessions(cb) {
  return onSnapshot(sessionsCol,
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by start time descending
      data.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      cb(data);
    },
    err => console.error('Session Subscription Error:', err)
  );
}
