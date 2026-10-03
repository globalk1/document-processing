import { API_URL } from './api.js';

export const OCR_MAX_BYTES = 32 * 1024 * 1024;
export const OCR_MODES = ['local_ocr', 'local_ocr_latex'];
const base = `${API_URL}/pdf/public-ocr/jobs/`;

export function validateOcrFile(file) {
  if (!file) return '請先選擇 PDF 或圖片。';
  if (file.size > OCR_MAX_BYTES) return '免費 OCR 檔案上限為 32 MB，請分批處理。';
  if (!(file.type === 'application/pdf' || file.type?.startsWith('image/') || /\.(pdf|png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i.test(file.name || ''))) {
    return '請選擇 PDF 或圖片檔案。';
  }
  return '';
}

async function request(path, options = {}, { signal, timeout = 25000 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(`${base}${path}`, { ...options, signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok || !data.success) return {
      success: false, status: response.status, code: data.code,
      error: data.error || data.detail || Object.values(data).find(value => Array.isArray(value))?.join('、') || 'OCR 請求失敗，請稍後再試。',
    };
    return data;
  } catch (error) {
    return { success: false, status: 0, cancelled: Boolean(signal?.aborted), error: error.name === 'AbortError'
      ? (signal?.aborted ? '已停止等待 OCR 回應。' : 'OCR 連線逾時，請重新查詢工作或確認停止。')
      : '無法連線至 OCR 服務，請稍後再試。' };
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}

export async function startOcrJob({ file, mode = 'local_ocr_latex', requestId, signal }) {
  const error = validateOcrFile(file);
  if (error || !OCR_MODES.includes(mode) || !requestId) return { success: false, status: 400, error: error || 'OCR 模式或工作編號無效。' };
  const body = new FormData();
  body.append('file', file); body.append('mode', mode); body.append('quality', 'standard');
  body.append('client_request_id', requestId);
  return request('', { method: 'POST', body }, { signal, timeout: 90000 });
}

export function getOcrJob({ jobId, signal }) {
  return request(`${encodeURIComponent(jobId)}/`, {}, { signal });
}

export function cancelOcrJob({ jobId, requestId }) {
  // The receipt can cancel a request whose upload response never reached us.
  if (requestId) return request('cancel/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_request_id: requestId }),
  });
  if (jobId) return request(`${encodeURIComponent(jobId)}/cancel/`, { method: 'POST' });
  return Promise.resolve({ success: false, error: '尚無可停止的 OCR 工作。' });
}
