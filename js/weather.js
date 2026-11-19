// สภาพอากาศจาก Open-Meteo (ฟรี ไม่ต้องใช้คีย์)
const K_LOC = 'pv_loc', K_CACHE = 'pv_weather';
export const CITIES = [
  { name: 'กรุงเทพฯ', lat: 13.7563, lon: 100.5018 }, { name: 'เชียงใหม่', lat: 18.7883, lon: 98.9853 },
  { name: 'ภูเก็ต', lat: 7.8804, lon: 98.3923 }, { name: 'ขอนแก่น', lat: 16.4419, lon: 102.836 },
  { name: 'หาดใหญ่', lat: 7.0084, lon: 100.4747 }, { name: 'พัทยา', lat: 12.9236, lon: 100.8825 },
  { name: 'โตเกียว', lat: 35.6762, lon: 139.6503 }, { name: 'โซล', lat: 37.5665, lon: 126.978 }
];
export const getLocation = () => { try { return JSON.parse(localStorage.getItem(K_LOC)) || CITIES[0]; } catch (e) { return CITIES[0]; } };
export const setLocation = (loc) => { localStorage.setItem(K_LOC, JSON.stringify(loc)); localStorage.removeItem(K_CACHE); };

export function useGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'));
    navigator.geolocation.getCurrentPosition(
      p => { const loc = { name: 'ตำแหน่งปัจจุบัน', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }; setLocation(loc); resolve(loc); },
      () => reject(new Error('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง')), { timeout: 10000 });
  });
}

const CODES = [
  [[0], '☀️', 'ฟ้าใส'], [[1, 2], '🌤️', 'มีเมฆบางส่วน'], [[3], '☁️', 'เมฆมาก'], [[45, 48], '🌫️', 'หมอก'],
  [[51, 53, 55, 56, 57], '🌦️', 'ฝนปรอยๆ'], [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'ฝนตก'],
  [[71, 73, 75, 77, 85, 86], '❄️', 'หิมะ'], [[95, 96, 99], '⛈️', 'พายุฝนฟ้าคะนอง']
];
function describe(code, isDay) {
  const c = CODES.find(x => x[0].includes(code)) || [[], '🌡️', ''];
  return { emoji: !isDay && code <= 2 ? '🌙' : c[1], text: c[2], rainy: code >= 51 };
}

export async function getWeather() {
  try {
    const c = JSON.parse(localStorage.getItem(K_CACHE) || 'null');
    if (c && Date.now() - c.t < 45 * 60000) return c.w;
  } catch (e) {}
  const loc = getLocation();
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const cur = j.current;
    const d = describe(cur.weather_code, cur.is_day);
    const w = { temp: Math.round(cur.temperature_2m), humidity: cur.relative_humidity_2m, ...d, place: loc.name, isDay: !!cur.is_day };
    localStorage.setItem(K_CACHE, JSON.stringify({ t: Date.now(), w }));
    return w;
  } catch (e) {
    try { const c = JSON.parse(localStorage.getItem(K_CACHE) || 'null'); if (c) return { ...c.w, stale: true }; } catch (x) {}
    return null;
  }
}
export const weatherText = (w) => w ? `${w.text} ${w.temp}°C ความชื้น ${w.humidity}% (${w.place})` : 'ไม่ทราบ';
