import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { format } from 'date-fns';
import {
  Camera, CameraOff, Loader2, CheckCircle2, UserX, ScanFace,
  Cpu, Clock, User, BookOpen, Hash, AlertTriangle, PlayCircle, StopCircle
} from 'lucide-react';
import { loadModels, buildDescriptors, detectAndMatch, getCurrentBackend } from '../services/faceRecognition';
import { logAttendance, subscribeStudents, subscribeSessions } from '../services/firestore';

/* ──────────────────────────────────────────────
   STATUS CONFIG
────────────────────────────────────────────── */
const STATUS_CONFIG = {
  idle:        { color: 'surface', icon: null,          label: 'Ready to Start' },
  loading:     { color: 'primary', icon: 'loader',      label: 'Loading AI Models...' },
  starting:    { color: 'primary', icon: 'loader',      label: 'Camera Starting...' },
  detecting:   { color: 'primary', icon: 'scan',        label: 'Detecting Face...' },
  detected:    { color: 'success', icon: 'check',       label: 'Attendance Marked ✅' },
  'no-face':   { color: 'warning', icon: 'alert',       label: 'No Face Detected' },
  'not-matched':{ color: 'danger', icon: 'userx',       label: 'Unknown Student' },
  error:       { color: 'danger', icon: 'alert',        label: 'Error Occurred' },
};

export default function CameraPage() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const isRunning = useRef(false);
  const loggedRecently = useRef(new Set());

  const [modelsReady, setModelsReady]   = useState(false);
  const [cameraOn,    setCameraOn]      = useState(false);
  const [students,    setStudents]      = useState([]);
  const [sessions,    setSessions]      = useState([]);
  const [faceMatcher, setFaceMatcher]   = useState(null);

  const [status,      setStatus]        = useState('idle');
  const [statusMsg,   setStatusMsg]     = useState('Click "Start Detection" to begin');
  const [processing,  setProcessing]    = useState(false);

  // Matched student state for the info card
  const [matchedStudent, setMatchedStudent] = useState(null); // { name, rollNo, className, division, confidence, time }
  const [lastMarked,     setLastMarked]     = useState(null);
  const [recentLogs,     setRecentLogs]     = useState([]);

  /* ── Load AI models silently on mount ── */
  useEffect(() => {
    (async () => {
      try {
        setStatus('loading');
        setStatusMsg('Loading AI models...');
        await loadModels();
        setModelsReady(true);
        setStatus('idle');
        setStatusMsg('Click "Start Detection" to begin');
      } catch {
        setStatus('error');
        setStatusMsg('Failed to load AI models. Retry?');
      }
    })();
  }, []);

  /* ── Subscribe to students & sessions ── */
  useEffect(() => {
    const unsubStu = subscribeStudents(setStudents);
    const unsubSes = subscribeSessions(setSessions);
    return () => { unsubStu(); unsubSes(); };
  }, []);

  /* ── Build face descriptors whenever students/models change ── */
  useEffect(() => {
    if (!modelsReady || students.length === 0) return;
    (async () => {
      const labeled = await buildDescriptors(students);
      if (labeled.length > 0) {
        // 0.68 threshold: more lenient for CPU backend embeddings
        setFaceMatcher(new faceapi.FaceMatcher(labeled, 0.68));
        console.log(`✅ FaceMatcher ready with ${labeled.length} enrolled faces`);
      } else {
        setFaceMatcher(null);
        console.warn('⚠ No face descriptors found — add students with photos first');
        console.warn('⚠ No face descriptors found — add students with photos first');
      }
    })();
  }, [modelsReady, students]);

  /* ── Detection Loop ── */
  const startDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!isRunning.current || !videoRef.current || videoRef.current.paused) return;
      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      setStatus('detecting');
      setStatusMsg('Detecting Face...');
      setProcessing(true);
      const results = await detectAndMatch(videoRef.current, faceMatcher);
      setProcessing(false);

      /* ── Canvas drawing ── */
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvas, dims);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        results.forEach(r => {
          const { x, y, width, height } = r.detection.detection.box;
          const color  = r.recognized ? '#22c55e' : '#ef4444';
          const radius = 8;

          /* Rounded rect bounding box */
          ctx.strokeStyle = color;
          ctx.lineWidth   = 3;
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + width - radius, y);
          ctx.arcTo(x + width, y, x + width, y + radius, radius);
          ctx.lineTo(x + width, y + height - radius);
          ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
          ctx.lineTo(x + radius, y + height);
          ctx.arcTo(x, y + height, x, y + height - radius, radius);
          ctx.lineTo(x, y + radius);
          ctx.arcTo(x, y, x + radius, y, radius);
          ctx.closePath();
          ctx.stroke();

          /* Corner accents */
          const cLen = 18;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x + cLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y + cLen);
          ctx.moveTo(x + width - cLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cLen);
          ctx.moveTo(x, y + height - cLen); ctx.lineTo(x, y + height); ctx.lineTo(x + cLen, y + height);
          ctx.moveTo(x + width - cLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cLen);
          ctx.stroke();

          /* Label pill */
          const student  = students.find(s => s.id === r.label);
          const name     = student ? student.name : 'Unknown Student';
          const labelTxt = `${name} · ${r.confidence}%`;
          ctx.font = 'bold 14px Inter, sans-serif';
          const tw = ctx.measureText(labelTxt).width;
          const px = 10, py = 6, rr = 8;
          const lx = x, ly = y - 36;

          ctx.fillStyle = color + 'cc';
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw + px * 2, 28, rr);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(labelTxt, lx + px, ly + 19);
        });
      }

      /* ── Session check & State updates ── */
      const now = new Date();
      const activeSession = sessions.find(s => new Date(s.startTime) <= now && new Date(s.endTime) >= now);

      if (results.length === 0) {
        setStatus('no-face');
        setStatusMsg('No Face Detected');
        setMatchedStudent(null);
      } else if (!activeSession) {
        setStatus('error'); // use warning styles
        setStatusMsg('No active session. Waiting...');
        setMatchedStudent(null);
      } else {
        const recognized = results.find(r => r.recognized);
        if (recognized) {
          const student = students.find(s => s.id === recognized.label);
          setStatus('detected');
          setStatusMsg(`Attendance Marked ✅`);
          setMatchedStudent({
            name:       student?.name       || 'Unknown',
            rollNo:     student?.rollNo     || '—',
            className:  student?.className  || '—',
            division:   student?.division   || '—',
            gender:     student?.gender     || '—',
            confidence: recognized.confidence,
            time:       new Date(),
          });

          if (!loggedRecently.current.has(recognized.label)) {
            loggedRecently.current.add(recognized.label);
            setTimeout(() => loggedRecently.current.delete(recognized.label), 30000);
            logAttendance({
              studentId:   recognized.label,
              studentName: student?.name || 'Unknown',
              confidence:  recognized.confidence,
              sessionId:   activeSession.id,
              sessionName: activeSession.name,
            }).then(ref => {
              if (ref) {
                setLastMarked(student?.name || 'Unknown');
                setTimeout(() => setLastMarked(null), 3500);
                setRecentLogs(prev =>
                  [{ name: student?.name || 'Unknown', rollNo: student?.rollNo, className: student?.className, time: new Date(), confidence: recognized.confidence, session: activeSession.name }, ...prev].slice(0, 8)
                );
              }
            });
          }
        } else {
          // Pass the nearest unmatched label/distance for debug UI
          const nearestStudent = students.find(s => s.id === results[0].label);
          setStatus('not-matched');
          setStatusMsg('Unknown Student');
          setMatchedStudent({
            name: nearestStudent ? nearestStudent.name : 'Unknown',
            rollNo: nearestStudent ? nearestStudent.rollNo : '—',
            time: new Date(),
            confidence: results[0].confidence,
            distance: results[0].distance,
            _unrecognized: true
          });
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    isRunning.current = true;
    rafRef.current = requestAnimationFrame(detect);
  }, [faceMatcher, students, sessions]);

  /* ── Camera Controls ── */
  const startCamera = async () => {
    try {
      setStatus('starting');
      setStatusMsg('Camera Starting...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraOn(true);
          startDetectionLoop();
        };
      }
    } catch {
      setStatus('error');
      setStatusMsg('Camera access denied. Check browser permissions.');
    }
  };

  const stopCamera = () => {
    isRunning.current = false;
    if (rafRef.current)  cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setCameraOn(false);
    setStatus('idle');
    setStatusMsg('Click "Start Detection" to begin');
    setMatchedStudent(null);
  };

  useEffect(() => () => stopCamera(), []);

  /* ── Derived style tokens ── */
  const cfg   = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const colors = {
    surface: 'bg-surface-100 dark:bg-surface-700/50 border-surface-200 dark:border-surface-600 text-surface-500 dark:text-surface-400',
    primary: 'bg-primary-500/10 border-primary-500/30 text-primary-500',
    success: 'bg-success-500/10 border-success-500/30 text-success-500',
    warning: 'bg-warning-500/10 border-warning-500/30 text-warning-500',
    danger:  'bg-danger-500/10  border-danger-500/30  text-danger-500',
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-4 sm:p-6 lg:p-8 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-surface-900 dark:text-white tracking-tight">
          Face Recognition
          <span className="ml-3 text-primary-500">Attendance</span>
        </h1>
        <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
          AI-powered real-time attendance tracking system
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ══════════════════════════════════════════
            LEFT: Camera Feed
        ══════════════════════════════════════════ */}
        <div className="xl:col-span-2 flex flex-col gap-4">

          {/* Status Bar */}
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-semibold transition-all duration-300 ${colors[cfg.color]}`}>
            {(status === 'loading' || status === 'starting' || processing) && (
              <Loader2 size={16} className="animate-spin flex-shrink-0" />
            )}
            {status === 'detected'     && <CheckCircle2 size={16} className="flex-shrink-0" />}
            {status === 'not-matched'  && <UserX        size={16} className="flex-shrink-0" />}
            {status === 'detecting'    && <ScanFace     size={16} className="flex-shrink-0 animate-pulse" />}
            {status === 'no-face'      && <AlertTriangle size={16} className="flex-shrink-0" />}
            {status === 'error'        && <AlertTriangle size={16} className="flex-shrink-0" />}
            {status === 'idle'         && <Camera       size={16} className="flex-shrink-0" />}

            <span className="tracking-wide">{statusMsg}</span>

            {status === 'error' && (
              <button
                onClick={startCamera}
                className="ml-auto text-xs font-bold bg-danger-500 text-white px-3 py-1 rounded-lg hover:bg-danger-400 transition-colors"
              >
                Retry
              </button>
            )}
          </div>

          {/* Camera Viewport */}
          <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-surface-700/60 aspect-[4/3] w-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* AI badge */}
            {processing && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 text-primary-400 px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md border border-primary-500/30">
                <Cpu size={12} className="animate-pulse" /> AI PROCESSING
              </div>
            )}

            {/* Backend badge */}
            {cameraOn && (
              <div className="absolute top-4 right-4 bg-black/60 text-white/60 px-3 py-1.5 rounded-full text-[10px] font-bold backdrop-blur-md border border-white/10">
                {getCurrentBackend() === 'webgl' ? '⚡ GPU' : '🖥 CPU'}
              </div>
            )}

            {/* Attendance Banner */}
            {lastMarked && (
              <div className="absolute inset-x-4 top-4 flex items-center justify-center z-50 animate-slide-up pointer-events-none">
                <div className="flex items-center gap-3 bg-success-500 px-6 py-3 rounded-2xl text-white shadow-2xl shadow-success-500/40">
                  <CheckCircle2 size={22} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80">Attendance Marked</p>
                    <p className="text-base font-extrabold">{lastMarked}</p>
                  </div>
                  <span className="ml-2 text-success-200 text-xs">{format(new Date(), 'hh:mm a')}</span>
                </div>
              </div>
            )}

            {/* Idle / Standby Overlay */}
            {!cameraOn && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-950/97 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-5">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-surface-800 border-2 border-surface-700 flex items-center justify-center">
                      <Camera size={40} className={status === 'loading' ? 'text-primary-500 animate-pulse' : 'text-surface-500'} />
                    </div>
                    {status === 'loading' && (
                      <div className="absolute inset-0 rounded-full border-2 border-primary-500/40 border-t-primary-500 animate-spin" />
                    )}
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {status === 'loading' ? 'Loading AI Models...' : 'Camera Standby'}
                    </h2>
                    <p className="text-surface-400 text-sm mt-1">
                      {status === 'loading'
                        ? 'Please wait while face-api.js initializes'
                        : 'Press Start Detection to activate face recognition'}
                    </p>
                  </div>
                  {modelsReady && (
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-3 px-8 py-3.5 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl font-bold shadow-xl shadow-primary-600/30 hover:shadow-primary-500/40 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm"
                    >
                      <PlayCircle size={20} />
                      Start Detection
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex gap-3">
            {!cameraOn ? (
              <button
                id="start-detection-btn"
                onClick={startCamera}
                disabled={!modelsReady}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-lg 
                  ${modelsReady
                    ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0'
                    : 'bg-surface-200 dark:bg-surface-700 text-surface-400 cursor-not-allowed'}`}
              >
                {!modelsReady ? (
                  <><Loader2 size={18} className="animate-spin" /> Loading Models...</>
                ) : (
                  <><PlayCircle size={18} /> Start Detection</>
                )}
              </button>
            ) : (
              <button
                id="stop-detection-btn"
                onClick={stopCamera}
                className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-danger-500 hover:bg-danger-400 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-danger-500/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                <StopCircle size={18} /> Stop Detection
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            RIGHT: Info Panels
        ══════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* Matched Student Card */}
          <div className={`bg-white dark:bg-surface-800 rounded-3xl border shadow-sm overflow-hidden transition-all duration-300
            ${matchedStudent
              ? 'border-success-500/30 shadow-success-500/10'
              : status === 'not-matched'
                ? 'border-danger-500/30 shadow-danger-500/10'
                : 'border-surface-100 dark:border-surface-700'}`}
          >
            <div className="px-5 py-3.5 border-b border-surface-100 dark:border-surface-700 flex items-center gap-2">
              <User size={14} className="text-primary-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-surface-500 dark:text-surface-400">
                Detection Result
              </span>
            </div>

            {matchedStudent ? (
              <div className="p-5 animate-scale-in">
                {/* Avatar ring */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-success-500/20 to-primary-500/20 border-2 border-success-500/40 flex items-center justify-center shadow-lg shadow-success-500/20">
                    <span className="text-3xl font-black text-success-500">
                      {matchedStudent.name[0]?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <h3 className="text-center text-lg font-extrabold text-surface-900 dark:text-white tracking-tight mb-0.5">
                  {matchedStudent.name}
                </h3>
                <div className="flex justify-center mb-4">
                  <span className="text-[11px] font-bold text-success-500 bg-success-500/10 px-3 py-0.5 rounded-full border border-success-500/20">
                    ✅ Recognized · {matchedStudent.confidence}%
                  </span>
                </div>

                <div className="space-y-2.5">
                  <InfoRow icon={<Hash size={13} />}      label="Roll No"   value={matchedStudent.rollNo} />
                  <InfoRow icon={<BookOpen size={13} />}  label="Class"     value={matchedStudent.className} />
                  <InfoRow icon={<User size={13} />}      label="Division"  value={matchedStudent.division} />
                  <InfoRow icon={<Clock size={13} />}     label="Marked At" value={format(matchedStudent.time, 'hh:mm:ss a')} />
                </div>
              </div>
            ) : status === 'not-matched' && matchedStudent?._unrecognized ? (
              <div className="p-6 flex flex-col items-center gap-3 animate-scale-in text-center">
                <div className="w-16 h-16 rounded-full bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
                  <UserX size={28} className="text-danger-500" />
                </div>
                <div>
                  <p className="font-bold text-surface-900 dark:text-white">Unknown Student</p>
                  <p className="text-xs text-surface-400 mt-1">Distance score too high to match securely.</p>
                </div>
                <div className="mt-2 text-left w-full bg-surface-50 dark:bg-surface-900/50 p-3 rounded-xl border border-danger-500/20">
                   <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1">Closest Match Attempt:</p>
                   <p className="text-xs font-semibold text-danger-500">{matchedStudent.name}</p>
                   <p className="text-[10px] text-surface-500 mt-0.5">Distance: {matchedStudent.distance?.toFixed(3)} (Must be &lt; 0.68)</p>
                </div>
              </div>
            ) : status === 'not-matched' ? (
              <div className="p-6 flex flex-col items-center gap-3 animate-scale-in">
                <div className="w-16 h-16 rounded-full bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
                  <UserX size={28} className="text-danger-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-surface-900 dark:text-white">Unknown Student</p>
                  <p className="text-xs text-surface-400 mt-1">Face not registered in the system</p>
                </div>
              </div>
            ) : status === 'no-face' ? (
              <div className="p-6 flex flex-col items-center gap-3 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-warning-500/10 border border-warning-500/20 flex items-center justify-center">
                  <AlertTriangle size={28} className="text-warning-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-surface-900 dark:text-white">No Face Detected</p>
                  <p className="text-xs text-surface-400 mt-1">Please look directly at the camera</p>
                </div>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center gap-3 opacity-40">
                <ScanFace size={36} className="text-surface-400" />
                <p className="text-xs font-bold text-surface-400 uppercase tracking-widest">
                  {cameraOn ? 'Scanning...' : 'Awaiting Detection'}
                </p>
              </div>
            )}
          </div>

          {/* Recent Attendance Logs */}
          <div className="flex-1 bg-white dark:bg-surface-800 rounded-3xl border border-surface-100 dark:border-surface-700 shadow-sm overflow-hidden flex flex-col min-h-[220px]">
            <div className="px-5 py-3.5 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success-500" />
                <span className="text-[11px] font-black uppercase tracking-widest text-surface-500 dark:text-surface-400">
                  Today's Log
                </span>
              </div>
              {recentLogs.length > 0 && (
                <span className="text-[10px] bg-success-500/10 text-success-500 border border-success-500/20 rounded-full px-2 py-0.5 font-bold">
                  {recentLogs.length}
                </span>
              )}
            </div>

            <ul className="divide-y divide-surface-100 dark:divide-surface-700 overflow-y-auto flex-1">
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 opacity-30">
                  <Clock size={28} className="mb-2 text-surface-400" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 italic">No logs yet</p>
                </div>
              ) : (
                recentLogs.map((l, i) => (
                  <li key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-success-500/20 to-primary-500/20 flex-shrink-0 flex items-center justify-center text-success-500 text-xs font-black border border-success-500/20">
                      {l.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-surface-800 dark:text-surface-200 truncate">{l.name}</p>
                      <p className="text-[10px] text-surface-400">
                        {l.rollNo && `Roll: ${l.rollNo} · `}{l.className && `${l.className} · `}{format(l.time, 'hh:mm a')}
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-primary-500 flex-shrink-0">{l.confidence}%</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* System Status Card */}
          <div className="bg-white dark:bg-surface-800 rounded-3xl border border-surface-100 dark:border-surface-700 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-surface-400 mb-3">System Info</p>
            <div className="space-y-2">
              <SysRow label="AI Models"  value={modelsReady ? 'Ready ✓' : 'Loading...'} ok={modelsReady} />
              <SysRow label="Camera"     value={cameraOn ? 'Live ✓' : 'Off'}             ok={cameraOn} />
              <SysRow label="Backend"    value={getCurrentBackend() === 'webgl' ? 'GPU (WebGL)' : 'CPU Fallback'} ok={getCurrentBackend() === 'webgl'} />
              <SysRow label="Students DB" value={`${students.length} registered`}           ok={students.length > 0} />
              <SysRow label="Face Data"  value={`${faceMatcher ? faceMatcher.labeledDescriptors.length : 0} faces active`} ok={!!faceMatcher} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-surface-100 dark:border-surface-700/50">
      <span className="text-surface-400 flex-shrink-0">{icon}</span>
      <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wide w-16 flex-shrink-0">{label}</span>
      <span className="text-xs font-bold text-surface-800 dark:text-surface-200 truncate">{value || '—'}</span>
    </div>
  );
}

function SysRow({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-surface-500 dark:text-surface-400">{label}</span>
      <span className={`text-[11px] font-bold ${ok ? 'text-success-500' : 'text-warning-500'}`}>{value}</span>
    </div>
  );
}
