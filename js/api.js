// เชื่อมต่อ Apps Script API
const K_URL = 'pv_api_url', K_TOKEN = 'pv_token';

export const getConfig = () => ({ url: localStorage.getItem(K_URL) || '', token: localStorage.getItem(K_TOKEN) || '' });
export function setConfig({ url, token }) {
  localStorage.setItem(K_URL, (url || '').trim());
  localStorage.setItem(K_TOKEN, (token || '').trim());
}
export const isConfigured = () => { const c = getConfig(); return !!(c.url && c.token); };
export const isOnline = () => navigator.onLine !== false;

export class ApiError extends Error {
  constructor(msg, { network = false, auth = false } = {}) { super(msg); this.network = network; this.auth = auth; }
}

export async function call(action, payload = {}, { timeout = 90000 } = {}) {
  const { url, token } = getConfig();
  if (!url || !token) throw new ApiError('ยังไม่ได้ตั้งค่าการเชื่อมต่อ (ไปที่ ตั้งค่า)');
  if (!isOnline()) throw new ApiError('ออฟไลน์อยู่', { network: true });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    // ใช้ text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง preflight (Apps Script ไม่รองรับ OPTIONS)
    res = await fetch(url, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, payload })
    });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'เชื่อมต่อนานเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', { network: true });
  } finally { clearTimeout(timer); }

  let json;
  try { json = await res.json(); }
  catch (e) { throw new ApiError('เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (ตรวจว่า Deploy เป็น Web app แบบ Anyone แล้ว)'); }
  if (!json.ok) throw new ApiError(json.error || 'เกิดข้อผิดพลาด', { auth: json.code === 401 });
  return json.data;
}

export const ai = (task, params = {}) => call('ai', { task, ...params });
