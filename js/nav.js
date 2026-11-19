// ตัวกลางเรื่องการนำทางและปุ่ม data-act (แยกไฟล์เพื่อไม่ให้ import วนกัน)
export const actions = {};
export const registerActions = (obj) => Object.assign(actions, obj);
export function go(path) { location.hash = '#/' + path; }
export function goBack(fallback = 'home') {
  if (history.length > 1 && sessionStorage.getItem('pv_nav')) history.back(); else go(fallback);
}
