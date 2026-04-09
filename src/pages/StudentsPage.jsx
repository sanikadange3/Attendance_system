import React, { useEffect, useState, useRef } from 'react';
import {
  Search, Plus, Trash2, Upload, X, Loader2, UserCircle2,
  TrendingUp, CheckCircle2, AlertTriangle, FileSpreadsheet, Edit2
} from 'lucide-react';
import { subscribeStudents, addStudent, deleteStudent, updateStudent, getStudentAttendance } from '../services/firestore';
import { parseExcel } from '../services/excel';
import { format } from 'date-fns';
import { loadModels, computeDescriptorFromElement } from '../services/faceRecognition';

/* ─── Required Excel columns ─── */
const REQUIRED_COLS = ['name', 'roll_no', 'photo'];
const OPTIONAL_COLS = ['class', 'division', 'gender'];
const ALL_COLS      = [...REQUIRED_COLS, ...OPTIONAL_COLS];

export default function StudentsPage() {
  const [students, setStudents]             = useState([]);
  const [search, setSearch]                 = useState('');
  const [showAdd, setShowAdd]               = useState(false);
  const [editStudent, setEditStudent]       = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importing, setImporting]           = useState(false);
  const [importLog, setImportLog]           = useState(null); // { total, success, errors }
  const [importProgress, setImportProgress] = useState('');
  const excelRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeStudents(setStudents);
    loadModels().catch(() => {});
    return unsub;
  }, []);

  const openHistory = async (student) => {
    setHistoryLoading(true);
    const logs = await getStudentAttendance(student.id);
    setSelectedHistory({ student, logs });
    setHistoryLoading(false);
  };

  /* ─── Excel Import with Validation ─── */
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (e.target) e.target.value = '';   // allow re-upload
    if (!file) return;

    setImporting(true);
    setImportLog(null);
    setImportProgress('');

    try {
      const rows = await parseExcel(file);

      if (!rows.length) {
        setImportProgress('❌ The file is empty.');
        setImporting(false);
        return;
      }

      // Normalise column names (lowercase + trim)
      const normalised = rows.map(row => {
        const normRow = {};
        Object.keys(row).forEach(k => { normRow[k.toLowerCase().replace(/\s+/g, '_')] = row[k]; });
        return normRow;
      });

      // Check required columns
      const firstRow  = normalised[0];
      const missingCols = REQUIRED_COLS.filter(c => !(c in firstRow));
      if (missingCols.length) {
        setImportProgress(`❌ Missing required columns: ${missingCols.join(', ')}. Expected: ${ALL_COLS.join(', ')}`);
        setImporting(false);
        return;
      }

      await loadModels();

      let success = 0;
      const errors = [];

      for (let i = 0; i < normalised.length; i++) {
        const row = normalised[i];
        const name    = String(row.name || '').trim();
        const rollNo  = String(row.roll_no || '').trim();

        if (!name || !rollNo) {
          errors.push(`Row ${i + 2}: Missing name or roll_no — skipped`);
          continue;
        }

        setImportProgress(`Processing ${i + 1}/${normalised.length}: ${name}`);

        const photoUrl  = String(row.photo || '').trim();

        if (!photoUrl) {
          errors.push(`Row ${i + 2}: Missing photo URL (Required) — skipped`);
          continue;
        }

        const result = await extractDescriptorFromUrl(photoUrl);

        if (!result.success) {
          errors.push(`Row ${i + 2}: ${result.error} — skipped`);
          continue;
        }

        const descriptor = result.descriptor;

        try {
          await addStudent({
            name,
            rollNo,
            className:  String(row.class    || '').trim(),
            division:   String(row.division || '').trim(),
            gender:     String(row.gender   || '').trim(),
            image_url:  photoUrl,
            descriptor,
          });
          success++;
        } catch (err) {
          errors.push(`Row ${i + 2}: ${err.message}`);
        }
      }

      setImportLog({ total: normalised.length, success, errors });
      setImportProgress('');
    } catch (err) {
      setImportProgress(`❌ Failed to read file: ${err.message}`);
    }

    setImporting(false);
  };

  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNo?.toLowerCase().includes(search.toLowerCase()) ||
    s.className?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Student Directory</h1>
          <p className="text-surface-500 text-sm mt-0.5">{students.length} registered students</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => excelRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {importing ? 'Importing...' : 'Import Excel'}
          </button>
          <input type="file" ref={excelRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImport} />
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold shadow-md shadow-primary-500/20 transition-all"
          >
            <Plus size={14} /> Add Student
          </button>
        </div>
      </div>

      {/* Excel format hint */}
      <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl px-5 py-4 text-xs text-surface-600 dark:text-surface-300">
        <p className="font-bold text-primary-600 dark:text-primary-400 mb-1 flex items-center gap-1.5">
          <FileSpreadsheet size={13} /> Excel Format Guide
        </p>
        <p>Required columns: <code className="bg-black/10 dark:bg-white/10 px-1 rounded">name</code>, <code className="bg-black/10 dark:bg-white/10 px-1 rounded">roll_no</code>, <code className="bg-black/10 dark:bg-white/10 px-1 rounded">photo</code> (URL)</p>
        <p className="mt-0.5">Optional: <code className="bg-black/10 dark:bg-white/10 px-1 rounded">class</code>, <code className="bg-black/10 dark:bg-white/10 px-1 rounded">division</code>, <code className="bg-black/10 dark:bg-white/10 px-1 rounded">gender</code></p>
      </div>

      {/* Import progress */}
      {importProgress && (
        <div className="flex items-center gap-3 bg-primary-500/10 border border-primary-500/20 text-primary-500 px-4 py-3 rounded-xl text-xs font-bold animate-pulse">
          <Loader2 size={14} className="animate-spin" /> {importProgress}
        </div>
      )}

      {/* Import log */}
      {importLog && (
        <div className={`rounded-2xl border p-4 text-sm ${importLog.errors.length ? 'bg-warning-500/5 border-warning-500/20' : 'bg-success-500/5 border-success-500/20'}`}>
          <div className="flex items-center gap-2 font-bold mb-2">
            {importLog.errors.length ? <AlertTriangle size={15} className="text-warning-500" /> : <CheckCircle2 size={15} className="text-success-500" />}
            <span className={importLog.errors.length ? 'text-warning-500' : 'text-success-500'}>
              Import complete: {importLog.success}/{importLog.total} students added
            </span>
          </div>
          {importLog.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {importLog.errors.map((e, i) => (
                <li key={i} className="text-xs text-danger-500 bg-danger-500/10 px-3 py-1.5 rounded-lg">{e}</li>
              ))}
            </ul>
          )}
          <button onClick={() => setImportLog(null)} className="mt-2 text-xs text-surface-400 hover:text-surface-600 underline">Dismiss</button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
        <input
          type="text"
          placeholder="Search by name, roll no or class..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm shadow-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-surface-400">
            <UserCircle2 size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest italic">No students found</p>
          </div>
        ) : filtered.map((s, i) => (
          <StudentCard
            key={s.id}
            student={s}
            index={i}
            onDelete={() => { if (confirm(`Delete ${s.name}?`)) deleteStudent(s.id); }}
            onEdit={() => setEditStudent(s)}
            onHistory={() => openHistory(s)}
          />
        ))}
      </div>

      {/* Add / Edit Modal */}
      {(showAdd || editStudent) && (
        <StudentModal
          student={editStudent}
          onClose={() => { setShowAdd(false); setEditStudent(null); }}
        />
      )}

      {/* History Modal */}
      {selectedHistory && (
        <HistoryModal data={selectedHistory} loading={historyLoading} onClose={() => setSelectedHistory(null)} />
      )}
    </div>
  );
}

/* ─── Student Card ─── */
function StudentCard({ student, onDelete, onEdit, onHistory, index }) {
  return (
    <div
      className="bg-white dark:bg-surface-800 rounded-3xl border border-surface-100 dark:border-surface-700/50 p-5 shadow-sm group hover:-translate-y-1 transition-all duration-300"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 flex items-center justify-center">
          {student.image_url ? (
            <img src={student.image_url} alt={student.name} className="w-full h-full object-cover" crossOrigin="anonymous"
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <UserCircle2 size={24} className="text-surface-400" />
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-xl text-surface-400 hover:text-primary-500 hover:bg-primary-500/10 transition-all" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-xl text-surface-400 hover:text-danger-500 hover:bg-danger-500/10 transition-all" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="font-bold text-surface-900 dark:text-white leading-tight truncate">{student.name}</h3>
      <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mt-0.5 mb-3">
        Roll: {student.rollNo || '—'} {student.className ? `· ${student.className}` : ''} {student.division ? `${student.division}` : ''}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-700/50">
        <span className={`text-[10px] font-black py-1 px-2.5 rounded-lg uppercase tracking-wider
          ${student.descriptor ? 'bg-success-500/10 text-success-500' : 'bg-warning-500/10 text-warning-500'}`}>
          {student.descriptor ? '✓ AI Ready' : '⚠ No Face'}
        </span>
        <button onClick={onHistory} className="p-1.5 rounded-xl bg-surface-50 dark:bg-surface-900 hover:bg-primary-500/10 hover:text-primary-500 transition-all" title="View attendance history">
          <TrendingUp size={15} />
        </button>
      </div>
    </div>
  );
}

/* ─── Add / Edit Modal ─── */
function StudentModal({ student, onClose }) {
  const isEdit = !!student;
  const [form, setForm]     = useState({
    name:      student?.name      || '',
    rollNo:    student?.rollNo    || '',
    className: student?.className || '',
    division:  student?.division  || '',
    gender:    student?.gender    || '',
  });
  const [preview, setPreview] = useState(student?.image_url || '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const imgRef = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.rollNo.trim()) { setError('Roll No is required.'); return; }
    if (!preview) { setError('A student photo is required.'); return; }

    setSaving(true);
    try {
      let descriptor = student?.descriptor || null;
      if (preview && imgRef.current && (!isEdit || preview !== student?.image_url)) {
        const desc = await computeDescriptorFromElement(imgRef.current);
        if (desc) {
          descriptor = Array.from(desc);
        } else {
          setError('Could not detect a clear face in the photo. Please use a different image.');
          setSaving(false);
          return;
        }
      }
      const data = { ...form, image_url: preview, descriptor };
      if (isEdit) await updateStudent(student.id, data);
      else        await addStudent(data);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-800 rounded-3xl border border-surface-200 dark:border-surface-700 shadow-2xl p-8 w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">{isEdit ? 'Edit Student' : 'Add Student'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"><X size={18} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm px-3 py-2 rounded-xl mb-4">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-surface-50 dark:bg-surface-900 border-2 border-dashed border-surface-300 dark:border-surface-600 overflow-hidden flex items-center justify-center">
              {preview ? (
                <img ref={imgRef} src={preview} alt="preview" className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : <UserCircle2 size={36} className="text-surface-300" />}
            </div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-primary-500 cursor-pointer hover:underline">
              {preview ? 'Change Photo' : 'Upload Photo'}
              <input type="file" className="hidden" accept="image/*" onChange={e => {
                const f = e.target.files[0];
                if (f) setPreview(URL.createObjectURL(f));
              }} />
            </label>
          </div>

          {[
            { k: 'name',      l: 'Full Name *',    p: 'e.g. Rahul Sharma',  r: true  },
            { k: 'rollNo',    l: 'Roll No *',       p: 'e.g. 101',           r: true  },
            { k: 'className', l: 'Class',           p: 'e.g. 10th',          r: false },
            { k: 'division',  l: 'Division',        p: 'e.g. A',             r: false },
            { k: 'gender',    l: 'Gender',          p: 'Male / Female',      r: false },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-1">{f.l}</label>
              <input
                required={f.r}
                value={form[f.k]}
                onChange={e => set(f.k, e.target.value)}
                placeholder={f.p}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary-500/20 transition-colors"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Attendance History Modal ─── */
function HistoryModal({ data, loading, onClose }) {
  const { student, logs } = data;
  const uniqueDays = new Set(logs.map(l => l.date)).size;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-surface-200 dark:border-surface-700 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white text-lg font-bold">
              {student.name[0]}
            </div>
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">{student.name}</h3>
              <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                Roll: {student.rollNo || '—'} · {student.className || 'N/A'} {student.division || ''}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-900"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-500" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Total Days" value={logs.length} color="text-primary-500" />
              <StatBox label="Unique Days" value={uniqueDays} color="text-success-500" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-surface-400">Recent Logs</h4>
            {logs.length === 0 ? (
              <p className="text-xs text-center py-4 italic text-surface-400">No attendance history found.</p>
            ) : logs.slice(0, 15).map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-surface-100 dark:border-surface-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-success-500" />
                  <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">{l.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-primary-500">{l.confidence ? `${l.confidence}%` : ''}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full
                    ${l.status === 'Present' ? 'bg-success-500/10 text-success-500' : 'bg-danger-500/10 text-danger-400'}`}>{l.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-5 pt-0">
          <button onClick={onClose} className="w-full py-3 bg-primary-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary-600/20">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-900/50 p-3 rounded-2xl border border-surface-100 dark:border-surface-700">
      <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
    </div>
  );
}

async function extractDescriptorFromUrl(url) {
  return new Promise(resolve => {
    let finalUrl = String(url || '').trim();

    // Auto-convert Google Drive viewer links to direct download links
    if (finalUrl.includes('drive.google.com')) {
      let fileId = null;
      const matchPath = finalUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const matchQuery = finalUrl.match(/id=([a-zA-Z0-9_-]+)/);
      
      if (matchPath) fileId = matchPath[1];
      else if (matchQuery) fileId = matchQuery[1];

      if (fileId) {
        // Use Google's native direct media host which automatically provides CORS headers.
        // Note: The file MUST STILL be set to "Anyone with the link can view" in Drive.
        finalUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = async () => {
      try {
        const desc = await computeDescriptorFromElement(img);
        if (desc) {
          resolve({ success: true, descriptor: Array.from(desc) });
        } else {
          resolve({ success: false, error: 'No face detected in image' });
        }
      } catch { 
        resolve({ success: false, error: 'AI computation failed for image' }); 
      }
    };
    img.onerror = () => resolve({ success: false, error: 'Image file not found or blocked by host' });
    img.src = finalUrl;
  });
}
