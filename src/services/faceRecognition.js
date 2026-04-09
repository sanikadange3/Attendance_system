import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';

const MODEL_URL = '/models';
let modelsLoaded = false;
let backendInitialized = false;

/* ─── Backend Init ─── */
export async function initFaceEngine() {
  if (backendInitialized) return;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  try {
    if (!gl) {
      await tf.setBackend('cpu');
    } else {
      await tf.setBackend('webgl');
    }
    await tf.ready();
    backendInitialized = true;
    console.log('✅ TensorFlow Backend:', tf.getBackend());
  } catch {
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      backendInitialized = true;
    } catch (e) {
      console.error('Backend init failed:', e);
    }
  }
}

/* ─── Load Models ─── */
export async function loadModels() {
  if (modelsLoaded) return;
  await initFaceEngine();
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('✅ Face-API models loaded');
  } catch (err) {
    console.error('❌ Failed to load models:', err);
    throw err;
  }
}

export function isModelsLoaded() { return modelsLoaded; }
export function getCurrentBackend() { return tf.getBackend() || 'cpu'; }

/* ─── Build Descriptors ───────────────────────────────────────────────
   FIX: Firestore stores arrays as {0:v,1:v,...} objects.
   Object.values() order is NOT guaranteed for numeric keys in all
   engines. We must sort by key number before building Float32Array.
──────────────────────────────────────────────────────────────────── */
export async function buildDescriptors(students) {
  const labeled = [];
  let count = 0;

  for (const student of students) {
    if (!student.descriptor) continue;

    try {
      let desc;

      if (Array.isArray(student.descriptor)) {
        // Already a plain array (e.g. freshly computed, not yet Firestore-round-tripped)
        desc = new Float32Array(student.descriptor);
      } else if (typeof student.descriptor === 'object') {
        // Firestore round-trip: {0: v, 1: v, ...}  — sort keys numerically
        const keys = Object.keys(student.descriptor).sort((a, b) => Number(a) - Number(b));
        desc = new Float32Array(keys.map(k => student.descriptor[k]));
      } else {
        continue;
      }

      if (desc.length !== 128) {
        console.warn(`⚠ Descriptor for ${student.name} has wrong length ${desc.length}, skipping`);
        continue;
      }

      labeled.push(new faceapi.LabeledFaceDescriptors(student.id, [desc]));
      count++;
    } catch (e) {
      console.warn(`⚠ Could not build descriptor for ${student.name}:`, e);
    }
  }

  console.log(`✅ Built ${count} face descriptors from ${students.length} students`);
  return labeled;
}

/* ─── Compute descriptor from an image element ─── */
export async function computeDescriptorFromElement(el) {
  try {
    const detection = await faceapi
      .detectSingleFace(el, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) {
      console.warn('No face detected in supplied image element');
      return null;
    }
    return detection.descriptor;
  } catch (e) {
    console.warn('computeDescriptorFromElement failed:', e);
    return null;
  }
}

/* ─── Real-time detect + match ────────────────────────────────────────
   FIX 1: Run detection ONCE (landmarks + descriptors together).
           The two-phase approach caused desync on CPU.
   FIX 2: Match threshold raised to 0.62 — CPU backend produces
           slightly higher distances than GPU; 0.55 was too strict.
──────────────────────────────────────────────────────────────────── */
export async function detectAndMatch(videoEl, faceMatcher) {
  // Single pass — detect faces, landmarks, and descriptors together
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });

  let detections;
  try {
    detections = await faceapi
      .detectAllFaces(videoEl, options)
      .withFaceLandmarks()
      .withFaceDescriptors();
  } catch (e) {
    console.warn('Detection error:', e);
    return [];
  }

  if (!detections || !detections.length) return [];

  const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight };
  const resized = faceapi.resizeResults(detections, displaySize);

  return resized.map(d => {
    if (!faceMatcher) {
      return { detection: d, label: 'unknown', distance: 1, confidence: 0, recognized: false };
    }

    const best = faceMatcher.findBestMatch(d.descriptor);
    const distance = best.distance;
    const confidence = Math.max(0, Math.round((1 - distance) * 100));

    // Threshold 0.68 allows for more variance on CPU backend
    const MATCH_THRESHOLD = 0.68;
    const recognized = best.label !== 'unknown' && distance < MATCH_THRESHOLD;

    console.debug(`[FaceMatch] label=${best.label} dist=${distance.toFixed(3)} recognized=${recognized}`);

    return {
      detection: d,
      label: best.label,
      distance,
      confidence,
      recognized,
    };
  });
}
