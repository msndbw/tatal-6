/* ==================================================
   جداول التقاعد الاختياري — app.js
   يُحمَّل من index.html
   ================================================== */

(function () {
'use strict';

/* ─────────────────────────────────────
   CONSTANTS
───────────────────────────────────── */
const SAL = {
  1:350000, 2:455000, 3:560000, 4:665000, 5:770000,
  6:875000, 7:980000, 8:1085000, 9:1190000, 10:1295000,
  11:1400000, 12:1505000, 13:1610000, 14:1715000, 15:1750000
};
const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];
const PLAN_ACCENT  = ['ac1','ac2','ac3','ac4','ac5'];
const PLAN_ICON_C  = ['ic1','ic2','ic3','ic4','ic5'];
const PLAN_EMOJI   = ['🎯','📅','💰','⏰','👩‍💼'];
const PLAN_COLOR_H = ['#2a5298','#2d6a4f','#b8943f','#9b3a4e','#5f3a8a'];

/* ─────────────────────────────────────
   STATE
───────────────────────────────────── */
let PLANS = [], USER = null;

/* ─────────────────────────────────────
   RETIREMENT RULES (original – complete)
───────────────────────────────────── */
function reqYears(g, a) {
  if (g === 'male') {
    if (a >= 50 && a <= 59) return 30;
    if (a >= 60 && a <= 62) return 20;
    if (a >= 63) return 15;
  } else {
    if (a >= 50 && a <= 54) return 25;
    if (a >= 55 && a <= 57) return 20;
    if (a >= 58) return 15;
  }
  return 15;
}

/* ─────────────────────────────────────
   DATE UTILS
───────────────────────────────────── */
function ageDiff(birth, from) {
  let y = from.getFullYear() - birth.getFullYear();
  let m = from.getMonth()    - birth.getMonth();
  let d = from.getDate()     - birth.getDate();
  if (d < 0) { m--; d += new Date(from.getFullYear(), from.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  return { years: y, months: m, days: d };
}
function monthsBetween(a, b) {
  let t = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) t--;
  return Math.max(0, t);
}
function dateAtAge(birth, age) {
  // إكمال سن X = يوم ميلاده بعد مرور X سنة كاملة
  // مثال: ولادة 7/1/1979، إكمال 61 = 7/1/2040
  let d = new Date(birth);
  d.setFullYear(d.getFullYear() + age);
  return d;
}
function fmtDate(d) {
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ─────────────────────────────────────
   CATEGORY PLAN BUILDER (original – accurate)
───────────────────────────────────── */
function idealStartCat(sa, ta) {
  let g = (ta - sa) - 5;
  if (g <= 0) return 1;
  return Math.min(Math.max(15 - g, 1), 15);
}

function buildCatPlan(sa, ta, sc) {
  sa = Math.min(Math.max(sa, 0), 100);
  ta = Math.min(Math.max(ta, sa), 100);
  if (ta - sa > 60) ta = sa + 60;

  let rows = [];
  for (let a = sa; a <= ta; a++) rows.push({ age: a, cat: null });
  const total     = rows.length;          // عدد السنوات الكلي شامل سنة التقاعد
  const last5Start= Math.max(total - 5, 0); // أول مؤشر لآخر 5 سنوات

  // ── الفئة القصوى القابلة للوصول في الـ 5 سنوات الأخيرة ──────────────────
  // إذا كان الوقت قبل آخر 5 سنوات = 0 (مدة كلية ≤ 5)،
  // نضع آخر 5 بأعلى فئة يمكن بلوغها بالترقي التدريجي من sc
  const yearsBeforeLast5 = last5Start;      // سنوات متاحة للترقي قبل الـ 5
  const maxReachableAt5  = Math.min(15, sc + yearsBeforeLast5); // أعلى فئة ممكنة عند بداية آخر 5

  if (sc >= 15) {
    // ── الحالة 1: نبدأ من 15 مباشرة ───────────────────────────────────────
    rows.forEach(r => r.cat = 15);

  } else if (yearsBeforeLast5 === 0) {
    // ── الحالة 2: المدة الكلية ≤ 5 سنوات ──────────────────────────────────
    // ترقّ تدريجي بمعدل سنة/درجة طوال المدة، آخر سنة = أعلى فئة
    let cat = sc;
    for (let i = 0; i < total; i++) {
      rows[i].cat = Math.min(15, cat);
      if (i < total - 1) cat = Math.min(15, cat + 1);
    }

  } else if (yearsBeforeLast5 >= (15 - sc)) {
    // ── الحالة 3: وقت كافٍ للوصول لـ 15 ─────────────────────────────────
    // ضع الترقيات في المنتصف، آخر 5 عند 15
    // الإسناد أولاً ثم الترقّي يضمن عرض sc الصحيح في السنة الأولى (rem=0)
    let rem = yearsBeforeLast5 - (15 - sc);
    for (let i = 0; i < total; i++) {
      if      (i < rem)         rows[i].cat = sc;                          // ثابت في البداية
      else if (i < last5Start)  rows[i].cat = Math.min(15, sc + (i - rem)); // ترقّي تدريجي
      else                      rows[i].cat = 15;                          // آخر 5 عند 15
    }

  } else {
    // ── الحالة 4: وقت غير كافٍ — ترقّ سريع من sc، آخر 5 عند maxReachableAt5 ──
    let cat = sc;
    for (let i = 0; i < total; i++) {
      if (i < last5Start) {
        // قبل آخر 5: ترقّ كل سنة
        rows[i].cat = Math.min(15, cat);
        cat = Math.min(15, cat + 1);
      } else {
        // آخر 5 سنوات: ثابت عند أعلى فئة وصلنا إليها
        rows[i].cat = maxReachableAt5;
      }
    }
  }

  // ── تنظيف: لا قفزات بأكثر من درجة واحدة ──────────────────────────────
  for (let i = 1; i < total; i++) {
    if (rows[i].cat - rows[i - 1].cat > 1) rows[i].cat = rows[i - 1].cat + 1;
    if (rows[i].cat > 15) rows[i].cat = 15;
    if (rows[i].cat < 1)  rows[i].cat = 1;
  }
  return rows;
}

/* ─────────────────────────────────────
   PENSION
───────────────────────────────────── */
function avgLast5(plan) {
  if (!plan.length) return 350000;
  const last = plan.slice(-5);          // آخر 5 سنوات (أو أقل إذا كانت الخطة أقصر)
  return last.reduce((a, r) => a + SAL[r.cat], 0) / last.length;
}
function calcPension(avg, mo) {
  let p = avg * 0.025 * mo / 12;
  return Math.min(Math.max(p, 350000), avg * 0.8);
}

/* ─────────────────────────────────────
   PLAN BUILDERS (original – accurate)
───────────────────────────────────── */
function mkResult(svc, birth, sa, ta, buy, useUC, uc, joinDate) {
  // الخدمة الكلية تُحسب من تاريخ الانتساب إلى تاريخ التقاعد مباشرةً
  // هذا أدق من تقسيمها إلى ماضٍ + مستقبل (يتجنب فروق التقريب في الأشهر)
  let fc      = useUC ? Math.min(Math.max(uc, 1), 15) : idealStartCat(sa, ta);
  let plan    = buildCatPlan(sa, ta, fc);
  let retDate = dateAtAge(birth, ta);
  let tot;
  if (joinDate) {
    // انتساب موجود: من الانتساب حتى التقاعد + خدمة سابقة
    tot = Math.max(0, monthsBetween(joinDate, retDate)) + svc;
  } else {
    // بدون انتساب: خدمة سابقة + أشهر من اليوم حتى التقاعد
    tot = svc + Math.max(0, monthsBetween(new Date(), retDate));
  }
  tot += buy;
  let avg = avgLast5(plan);
  return {
    targetAge: ta, purchaseMonths: buy, yearsPlan: plan,
    totalServiceMonths: tot, pension: calcPension(avg, tot),
    purchaseCost: avg * 0.17 * buy, avg,
    retireDate: retDate
  };
}
function planA(svc, birth, sa, useUC, uc, g, joinDate) { // earliest with purchase
  // svc = خدمة سابقة، الخدمة الكلية = من الانتساب حتى عمر التقاعد + svc
  function totalAt(age) {
    const retDate = dateAtAge(birth, age);
    if (joinDate) return Math.max(0, monthsBetween(joinDate, retDate)) + svc;
    return svc + Math.max(0, monthsBetween(new Date(), retDate));
  }
  let best = null, buy = 0, ss = Math.min(Math.max(50, sa), 70);
  for (let age = ss; age <= 70; age++) {
    let req = reqYears(g, age) * 12;
    let tot = totalAt(age);
    if (tot >= req)               { best = age; buy = 0;       break; }
    if (req - tot <= 60)          { best = age; buy = req-tot; break; }
  }
  if (!best) {
    best = 70;
    buy = Math.min(Math.max(reqYears(g, 70) * 12 - totalAt(70), 0), 60);
  }
  return mkResult(svc, birth, sa, best, buy, useUC, uc, joinDate);
}
function planB(svc, birth, sa, useUC, uc, g, joinDate) { // earliest without purchase
  function totalAt(age) {
    const retDate = dateAtAge(birth, age);
    if (joinDate) return Math.max(0, monthsBetween(joinDate, retDate)) + svc;
    return svc + Math.max(0, monthsBetween(new Date(), retDate));
  }
  let best = null, ss = Math.min(Math.max(50, sa), 70);
  for (let age = ss; age <= 70; age++) {
    let req = reqYears(g, age) * 12;
    if (totalAt(age) >= req) { best = age; break; }
  }
  if (!best) best = 70;
  return mkResult(svc, birth, sa, best, 0, useUC, uc, joinDate);
}
function planC(svc, birth, sa, useUC, uc, joinDate) { // max pension 32yr
  const TGT = 384; // 32 سنة × 12
  // نحسب الخدمة الكلية بنفس طريقة mkResult
  function totalAt(age) {
    const retDate = dateAtAge(birth, age);
    if (joinDate) return Math.max(0, monthsBetween(joinDate, retDate)) + svc;
    return svc + Math.max(0, monthsBetween(new Date(), retDate));
  }
  let target = sa;
  let found  = false;
  for (let age = sa; age <= 70; age++) {
    if (totalAt(age) >= TGT) { target = age; found = true; break; }
  }
  if (!found) target = 70;
  let r = mkResult(svc, birth, sa, target, 0, useUC, uc, joinDate);
  r.totalServiceMonths = Math.min(r.totalServiceMonths, TGT);
  r.pension = calcPension(r.avg, r.totalServiceMonths);
  return r;
}
function planFixed(svc, birth, sa, useUC, uc, g, ta, joinDate) { // fixed age
  if (sa >= ta) return planB(svc, birth, sa, useUC, uc, g, joinDate);
  const retDate = dateAtAge(birth, ta);
  let before;
  if (joinDate) {
    before = Math.max(0, monthsBetween(joinDate, retDate)) + svc;
  } else {
    before = svc + Math.max(0, monthsBetween(new Date(), retDate));
  }
  let req = reqYears(g, ta) * 12;
  let buy = before < req ? Math.min(req - before, 60) : 0;
  return mkResult(svc, birth, sa, ta, buy, useUC, uc, joinDate);
}

/* ─────────────────────────────────────
   FORMAT HELPERS
───────────────────────────────────── */
function N(n)  { return Math.round(n).toLocaleString('ar-IQ'); }
function FM(m) {
  let y = Math.floor(m / 12), mo = m % 12;
  if (!y)  return `${mo} شهر`;
  if (!mo) return `${y} سنة`;
  return `${y} سنة و${mo} شهر`;
}

/* ─────────────────────────────────────
   COPY
───────────────────────────────────── */
function copyPlan(plan, user, idx) {
  const t  = copyPlanText(plan, user, idx);
  const fb = () => {
    let ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(() => {}).catch(fb);
  else fb();
}

/* ─────────────────────────────────────
   PDF EXPORT – via print window (Arabic correct)
───────────────────────────────────── */
function exportPDF() { exportPDFPlans(PLANS); }
function exportPDFPlans(chosenPlans) {
  if (!chosenPlans || !chosenPlans.length || !USER) return;
  const PLANS_TO_EXPORT = chosenPlans;

  const nm     = USER.nm || 'مشترك';
  const gender = USER.gender === 'male' ? 'ذكر' : 'أنثى';
  const today  = new Date().toLocaleDateString('ar-IQ',{year:'numeric',month:'long',day:'numeric'});
  const priorStr = (USER.py > 0 || USER.pm > 0) ? FM(USER.py * 12 + USER.pm) : 'لا يوجد';

  // ── CSS للطباعة ────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;500;700&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:'Tajawal',sans-serif;
      direction:rtl; text-align:right;
      color:#1a1208; background:#fff;
      font-size:12px; line-height:1.6;
    }
    /* ── غلاف ── */
    .cover {
      background:linear-gradient(160deg,#0b1b35 0%,#1e3a6e 100%);
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      color:#fff; padding:40px 30px;
      min-height:100vh;
    }
    .cover-logo {
      width:80px;height:80px;border-radius:50%;
      background:linear-gradient(135deg,#8c6d28,#d4af6a);
      display:flex;align-items:center;justify-content:center;
      font-size:36px;margin-bottom:24px;
      box-shadow:0 0 0 4px rgba(184,148,63,.3),0 8px 24px rgba(0,0,0,.4);
    }
    .cover h1 {
      font-family:'Amiri',serif; font-size:28px;
      color:#d4af6a; margin-bottom:8px; text-align:center;
    }
    .cover p { color:#b0c4de; font-size:13px; text-align:center; }
    .cover-divider {
      width:200px;height:2px;
      background:linear-gradient(90deg,transparent,#b8943f,transparent);
      margin:20px 0;
    }
    .cover-card {
      background:rgba(255,255,255,.08);
      border:1px solid rgba(184,148,63,.3);
      border-radius:12px; padding:24px 32px;
      margin-top:16px; width:100%;max-width:500px;
    }
    .cover-row {
      display:flex;justify-content:space-between;
      padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);
      font-size:13px;
    }
    .cover-row:last-child{border-bottom:none}
    .cover-row .lbl{color:#b8943f;font-weight:600}
    .cover-row .val{color:#f0ebe0;font-weight:700}
    .cover-plans { margin-top:20px;width:100%;max-width:500px; }
    .cover-plan-row {
      display:flex;align-items:center;gap:10px;
      padding:7px 12px;margin:4px 0;
      background:rgba(255,255,255,.06);border-radius:6px;
      font-size:12px;color:#d4e0f0;
    }
    .plan-dot { width:12px;height:12px;border-radius:3px;flex-shrink:0; }

    /* ── صفحات الخطط — بدون page-break-before ── */
    .plan-page { padding:18px 22px 14px; }
    /* الفاصل بين الخطط داخل نفس الصفحة */
    .plan-separator {
      border:none; border-top:2px solid #0d1f3c;
      margin:18px 0 16px; opacity:.15;
    }
    /* هيدر الخطة */
    .plan-hdr-bar {
      border-radius:8px;padding:10px 16px;
      margin-bottom:12px;
      display:flex;align-items:center;justify-content:space-between;
    }
    .plan-hdr-bar h2 {
      font-family:'Amiri',serif;font-size:17px;
      color:#fff;font-weight:700;
    }
    .plan-num-badge {
      background:rgba(255,255,255,.25);
      color:#fff;font-size:10px;font-weight:700;
      padding:3px 10px;border-radius:12px;
    }
    /* ملخص الموظف */
    .emp-bar {
      display:flex;gap:0;flex-wrap:wrap;
      background:#eef2f9;border-radius:7px;
      border:1px solid rgba(13,31,60,.12);
      margin-bottom:10px;overflow:hidden;
    }
    .emp-cell {
      flex:1;min-width:90px;padding:7px 10px;
      border-left:1px solid rgba(13,31,60,.1);
      display:flex;flex-direction:column;gap:2px;
    }
    .emp-cell:last-child{border-left:none}
    .emp-lbl{font-size:9px;color:#7a6e5f;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    .emp-val{font-size:11px;color:#0d1f3c;font-weight:700;font-family:'Amiri',serif}
    /* إحصائيات */
    .stats-row { display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap; }
    .stat-box {
      flex:1;min-width:80px;
      border-radius:7px;padding:7px 8px;
      text-align:center; border:1px solid rgba(0,0,0,.08);
    }
    .stat-box .sl{font-size:8px;color:#7a6e5f;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .stat-box .sv{font-size:12px;font-weight:900;font-family:'Amiri',serif;margin-top:2px}
    .sv-good{color:#2d6a4f} .sv-warn{color:#c97a00} .sv-bad{color:#8b2020} .sv-navy{color:#0d1f3c}
    /* تفاصيل */
    .details-grid {
      background:#f8f4ec;border-radius:7px;
      padding:8px 12px;margin-bottom:10px;
      border:1px solid rgba(184,148,63,.15);
    }
    .detail-row {
      display:flex;justify-content:space-between;
      padding:4px 0;border-bottom:1px dashed rgba(13,31,60,.08);
      font-size:10.5px;
    }
    .detail-row:last-child{border-bottom:none}
    .dk{color:#7a6e5f;font-weight:500}
    .dv{font-weight:700;color:#0d1f3c}
    .dv-g{color:#2d6a4f;font-size:11px} .dv-r{color:#8b2020} .dv-a{color:#c97a00}
    /* تنبيه */
    .rpill {
      background:#fff8e6;border:1px solid rgba(201,122,0,.2);
      border-radius:6px;padding:6px 11px;
      font-size:10.5px;color:#c97a00;font-weight:600;
      margin-bottom:10px;
    }
    /* جدول */
    .tbl-title{
      font-size:10px;font-weight:800;color:#1e3a6e;
      text-transform:uppercase;letter-spacing:.06em;
      margin-bottom:5px;
    }
    table { width:100%;border-collapse:collapse;font-size:10px; }
    thead tr { background:#0d1f3c; }
    th {
      padding:6px 9px;color:#f8f4ec;font-weight:700;
      font-size:9.5px;letter-spacing:.03em;text-align:center;
    }
    th:first-child{text-align:right;padding-right:11px}
    td {
      padding:5px 9px;text-align:center;
      border-bottom:1px solid rgba(13,31,60,.05);
    }
    td:first-child{text-align:right;font-weight:600;padding-right:11px}
    tr:nth-child(even) td{background:rgba(248,244,236,.6)}
    .r5 td{background:#fff9e0!important;font-weight:700}
    .rret td{background:#e8f5ee!important;color:#2d6a4f;font-weight:800}
    /* page footer */
    .page-footer{
      margin-top:12px;padding-top:7px;
      border-top:1px solid rgba(184,148,63,.3);
      font-size:9px;color:#7a6e5f;text-align:center;
    }
    @media print {
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cover{min-height:initial; page-break-after:always;}
      .plan-page{page-break-inside:avoid}
    }
  `;

  // ── بناء محتوى HTML ────────────────────────────────────────────────────
  const COLORS = ['#2a5298','#2d6a4f','#b8943f','#9b3a4e','#5f3a8a'];

  // صفحة الغلاف
  let body = `
  <div class="cover">
    <div class="cover-logo">🏛️</div>
    <h1>جداول التقاعد الاختياري</h1>
    <p>النظام الرسمي للتقاعد الاختياري</p>
    <div class="cover-divider"></div>
    <div class="cover-card">
      <div class="cover-row"><span class="lbl">الاسم</span><span class="val">${nm}</span></div>
      <div class="cover-row"><span class="lbl">الجنس</span><span class="val">${gender}</span></div>
      <div class="cover-row"><span class="lbl">العمر الحالي</span><span class="val">${USER.ay} سنة و${USER.am} شهر</span></div>
      <div class="cover-row"><span class="lbl">إجمالي الخدمة الحالية</span><span class="val">${FM(USER.ts)}</span></div>
      <div class="cover-row"><span class="lbl">الخدمة السابقة</span><span class="val">${priorStr}</span></div>
      <div class="cover-row"><span class="lbl">عدد الخطط</span><span class="val">${PLANS_TO_EXPORT.length} خطط</span></div>
      <div class="cover-row"><span class="lbl">تاريخ التقرير</span><span class="val">${today}</span></div>
    </div>
    <div class="cover-plans">
      ${PLANS_TO_EXPORT.map((p,i)=>`
        <div class="cover-plan-row">
          <div class="plan-dot" style="background:${COLORS[i]||'#2a5298'}"></div>
          <span>${p.title} — ${p.desc}</span>
          <span style="margin-right:auto;color:#d4af6a;font-weight:700">${N(p.pension)} د.ع</span>
        </div>`).join('')}
    </div>
  </div>`;

  // صفحة الخطط — جميعها في صفحات متتالية بدون فراغات
  body += `<div class="plans-wrapper">`;
  PLANS_TO_EXPORT.forEach((plan, pi) => {
    const color   = COLORS[pi] || '#2a5298';
    const hasBuy  = plan.purchaseMonths > 0;
    const actual  = plan.totalServiceMonths - plan.purchaseMonths;
    const future  = Math.max(0, actual - USER.ts);
    const lastIdx = plan.yearsPlan.length - 1;

    // صفوف جدول الفئات
    let tRows = '';
    plan.yearsPlan.forEach((r,i)=>{
      const is5   = i >= plan.yearsPlan.length - 5;
      const isRet = i === lastIdx;
      const cls   = isRet ? 'rret' : (is5 ? 'r5' : '');
      tRows += `<tr class="${cls}">
        <td>${r.age} سنة و${USER.sm} شهر</td>
        <td>فئة ${r.cat}</td>
      </tr>`;
    });

    // فاصل بين الخطط (ليس قبل الأولى)
    const sep = pi > 0 ? '<hr class="plan-separator">' : '';

    body += `
    ${sep}
    <div class="plan-page">
      <div class="plan-hdr-bar" style="background:${color}">
        <h2>${plan.title}</h2>
        <div class="plan-num-badge">${plan.desc}</div>
      </div>

      <div class="emp-bar">
        <div class="emp-cell"><div class="emp-lbl">المشترك</div><div class="emp-val">${nm}</div></div>
        <div class="emp-cell"><div class="emp-lbl">الجنس</div><div class="emp-val">${gender}</div></div>
        <div class="emp-cell"><div class="emp-lbl">العمر</div><div class="emp-val">${USER.ay} سنة ${USER.am} شهر</div></div>
        <div class="emp-cell"><div class="emp-lbl">الخدمة الحالية</div><div class="emp-val">${FM(USER.ts)}</div></div>
        ${(USER.py > 0 || USER.pm > 0) ? `<div class="emp-cell"><div class="emp-lbl">الخدمة السابقة</div><div class="emp-val">${priorStr}</div></div>` : ''}
      </div>

      <div class="stats-row">
        <div class="stat-box" style="border-color:${color}20">
          <div class="sl">سن التقاعد</div>
          <div class="sv sv-navy">${plan.targetAge} سنة</div>
        </div>
        <div class="stat-box" style="border-color:${color}20">
          <div class="sl">مدة الخدمة</div>
          <div class="sv sv-navy">${FM(plan.totalServiceMonths)}</div>
        </div>
        <div class="stat-box" style="background:#e8f5ee;border-color:#2d6a4f40">
          <div class="sl">الراتب الشهري</div>
          <div class="sv sv-good">${N(plan.pension)} د.ع</div>
        </div>
        ${hasBuy ? `
        <div class="stat-box" style="background:#fff8e6;border-color:#c97a0040">
          <div class="sl">أشهر الشراء</div>
          <div class="sv sv-warn">${plan.purchaseMonths} شهر</div>
        </div>
        <div class="stat-box" style="background:#fdf0f0;border-color:#8b202040">
          <div class="sl">تكلفة الشراء</div>
          <div class="sv sv-bad">${N(plan.purchaseCost)} د.ع</div>
        </div>` : ''}
      </div>

      <div class="details-grid">
        <div class="detail-row"><span class="dk">📅 تاريخ التقاعد المتوقع</span><span class="dv">${fmtDate(plan.retireDate)}</span></div>
        <div class="detail-row"><span class="dk">⏱️ خدمة فعلية</span><span class="dv">${FM(actual)}</span></div>
        ${future>0?`<div class="detail-row"><span class="dk">🔮 خدمة مستقبلية</span><span class="dv">${FM(future)}</span></div>`:''}
        ${hasBuy?`<div class="detail-row"><span class="dk">🛒 أشهر الشراء</span><span class="dv dv-a">${plan.purchaseMonths} شهر — ${FM(plan.purchaseMonths)}</span></div>`:''}
        <div class="detail-row"><span class="dk">📋 إجمالي الخدمة</span><span class="dv">${FM(plan.totalServiceMonths)}</span></div>
        <div class="detail-row"><span class="dk">💵 متوسط آخر 5 سنوات</span><span class="dv">${N(plan.avg)} د.ع</span></div>
        <div class="detail-row"><span class="dk">💰 الراتب التقاعدي الشهري</span><span class="dv dv-g">${N(plan.pension)} د.ع</span></div>
        ${hasBuy?`
        <div class="detail-row"><span class="dk">💸 سعر الشهر الواحد</span><span class="dv">${N(plan.avg*0.17)} د.ع</span></div>
        <div class="detail-row"><span class="dk">💸 سعر السنة الواحدة</span><span class="dv">${N(plan.avg*0.17*12)} د.ع</span></div>
        <div class="detail-row"><span class="dk">💸 إجمالي مبلغ الشراء</span><span class="dv dv-r">${N(plan.purchaseCost)} د.ع</span></div>`:''}
      </div>

      <div class="rpill">⚠️ يستحق الراتب عند <strong>إكمال</strong> سن ${plan.targetAge} وليس عند مجرد بلوغه</div>

      <div class="tbl-title">📊 جدول تدرج الفئات الوظيفية</div>
      <table>
        <thead><tr><th>السن</th><th>الفئة</th></tr></thead>
        <tbody>${tRows}</tbody>
      </table>

      <div class="page-footer">نظام جداول التقاعد الاختياري — ${today}</div>
    </div>`;
  });
  body += `</div>`; // end plans-wrapper

  // ── فتح النافذة وطباعتها ──────────────────────────────────────────────
  const fullHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقاعد - ${nm}</title>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { showToast('❌ يرجى السماح بفتح النوافذ المنبثقة'); return; }
  win.document.write(fullHTML);
  win.document.close();

  // طباعة تلقائية بعد تحميل الخطوط
  win.onload = function() {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 1400);
  };

  showToast('✅ جاري فتح ملف PDF...');
}

/* ─────────────────────────────────────
   RENDER HTML
───────────────────────────────────── */
function buildSummary(nm, g, age, jat, ts, hasJoin) {
  const items = [
    { l: 'الاسم',          v: nm || '—' },
    { l: 'الجنس',          v: g === 'male' ? 'ذكر' : 'أنثى' },
    { l: 'العمر الحالي',   v: `${age.years} سنة و${age.months} شهر` },
    { l: 'إجمالي الخدمة', v: FM(ts) },
  ];
  if (hasJoin) items.push({ l: 'عمر الانتساب', v: jat });
  return `<div class="sum-bar">
    <div class="sum-bar-title">📊 ملخص بيانات المشترك</div>
    <div class="sum-items">
      ${items.map(it => `
        <div class="sum-item">
          <div class="si-l">${it.l}</div>
          <div class="si-v">${it.v}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

function buildCard(plan, ci, nm, g, age, prevMo) {
  const ac  = PLAN_ACCENT[ci]  || 'ac1';
  const ic  = PLAN_ICON_C[ci]  || 'ic1';
  const em  = PLAN_EMOJI[ci]   || '📋';
  const n   = ci + 1;
  const hasBuy  = plan.purchaseMonths > 0;
  const actual  = plan.totalServiceMonths - plan.purchaseMonths;
  const future  = Math.max(0, actual - USER.ts);

  let tbody = '';
  const last = plan.yearsPlan.length - 1;
  plan.yearsPlan.forEach((r, i) => {
    const is5  = i >= plan.yearsPlan.length - 5;
    const isRet = i === last;
    const cls  = isRet ? 'rret' : (is5 ? 'r5' : '');
    const cp   = `<span class="cpill${r.cat === 15 ? ' c15' : ''}">${r.cat}</span>`;
    tbody += `<tr class="${cls}">
      <td>${r.age} سنة و${USER.sm} شهر</td>
      <td>${cp}</td>
    </tr>`;
  });

  return `
  <div class="plan-card ${ac}" id="plan-card-${n}">
    <div class="plan-hdr">
      <div class="plan-hdr-l">
        <div class="plan-icon ${ic}">${em}</div>
        <div>
          <div class="plan-seq">الخطة ${n}</div>
          <div class="plan-name">${plan.title}</div>
          <div class="plan-desc">${plan.desc}</div>
        </div>
      </div>
      <button class="copy-btn no-print" data-i="${n}">📋 نسخ</button>
    </div>

    <div class="plan-stats">
      <div class="pst">
        <div class="pst-l">سن التقاعد</div>
        <div class="pst-v">${plan.targetAge}</div>
        <div class="pst-s">سنة · ${plan.retireDate.getFullYear()}</div>
      </div>
      <div class="pst">
        <div class="pst-l">مدة الخدمة</div>
        <div class="pst-v">${Math.floor(plan.totalServiceMonths/12)}</div>
        <div class="pst-s">سنة و${plan.totalServiceMonths%12} شهر</div>
      </div>
      <div class="pst">
        <div class="pst-l">الراتب التقاعدي</div>
        <div class="pst-v g">${N(plan.pension)}</div>
        <div class="pst-s">د.ع / شهرياً</div>
      </div>
      ${hasBuy ? `
      <div class="pst">
        <div class="pst-l">أشهر الشراء</div>
        <div class="pst-v w">${plan.purchaseMonths}</div>
        <div class="pst-s">شهر</div>
      </div>
      <div class="pst">
        <div class="pst-l">تكلفة الشراء</div>
        <div class="pst-v b">${N(plan.purchaseCost)}</div>
        <div class="pst-s">دينار</div>
      </div>` : ''}
    </div>

    <div class="plan-body">
      <div class="plan-user-row">
        <span>👤 <b>${nm || '—'}</b></span>
        <span>🎂 <b>${age.years} سنة و${age.months} شهر</b></span>
        <span>⏳ خدمة حالية: <b>${FM(USER.ts)}</b></span>
        ${prevMo > 0 ? `<span>🗂️ خدمة سابقة: <b>${FM(prevMo)}</b></span>` : ''}
      </div>

      <div class="drows">
        <div class="dr"><span class="dk">📅 تاريخ التقاعد المتوقع</span><span class="dv">${fmtDate(plan.retireDate)}</span></div>
        <div class="dr"><span class="dk">⏱️ خدمة فعلية</span><span class="dv">${FM(actual)}</span></div>
        ${future > 0 ? `<div class="dr"><span class="dk">🔮 خدمة مستقبلية</span><span class="dv">${FM(future)}</span></div>` : ''}
        ${hasBuy ? `<div class="dr"><span class="dk">🛒 أشهر الشراء المطلوبة</span><span class="dv w">${plan.purchaseMonths} شهر — ${FM(plan.purchaseMonths)}</span></div>` : ''}
        <div class="dr"><span class="dk">📋 إجمالي الخدمة المحسوبة</span><span class="dv">${FM(plan.totalServiceMonths)}</span></div>
        <div class="dr">
          <span class="dk">💵 متوسط الأجر (آخر 5 سنوات)</span>
          <span class="dv">
            ${N(plan.avg)} د.ع
            <span style="font-size:.71rem;color:var(--muted);font-weight:400;display:block;margin-top:2px">
              ${plan.yearsPlan.slice(-5).map(r=>`ف${r.cat}:${N(SAL[r.cat])}`).join(' + ')}
            </span>
          </span>
        </div>
        <div class="dr">
          <span class="dk">💰 الراتب التقاعدي الشهري</span>
          <span class="dv g">
            ${N(plan.pension)} د.ع
            <span style="font-size:.7rem;color:var(--green);font-weight:400;display:block;margin-top:2px;opacity:.85">
              ${N(plan.avg)} × 2.5% × ${Math.floor(plan.totalServiceMonths/12)} سنة ÷ 12
            </span>
          </span>
        </div>
        ${hasBuy ? `
        <div class="dr"><span class="dk">💸 سعر الشهر الواحد (شراء)</span><span class="dv">${N(plan.avg * 0.17)} د.ع</span></div>
        <div class="dr"><span class="dk">💸 سعر السنة الواحدة (شراء)</span><span class="dv">${N(plan.avg * 0.17 * 12)} د.ع</span></div>
        <div class="dr"><span class="dk">💸 إجمالي مبلغ الشراء</span><span class="dv b">${N(plan.purchaseCost)} د.ع</span></div>` : ''}
      </div>

      <div class="rpill">
        ⚠️ يستحق الراتب عند <b style="margin:0 3px">إكمال</b> سن ${plan.targetAge} وليس عند مجرد بلوغه
      </div>

      <div>
        <div class="tbl-head">
          <h4>📊 جدول تدرج الفئات الوظيفية</h4>
          <div class="tleg">
            <div class="tleg-i"><div class="tdot ldy"></div>آخر 5 سنوات</div>
            <div class="tleg-i"><div class="tdot ldg"></div>سنة التقاعد</div>
          </div>
        </div>
        <div class="tbl-wrap">
          <table class="ctbl">
            <thead>
              <tr><th>السن</th><th>الفئة</th></tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}

/* ─────────────────────────────────────
   GENERATE
───────────────────────────────────── */
function generate() {
  try {
    // Read birth date
    const bD = +document.getElementById('birthDay').value;
    const bM = document.getElementById('birthMonth').value;
    const bY = document.getElementById('birthYear').value;

    if (!bD || !bM || !bY) { showAlert('❌ يرجى إدخال تاريخ الميلاد كاملاً', 'e'); return; }

    const birth = new Date(+bY, +bM - 1, bD);
    if (isNaN(birth.getTime()) || birth > new Date()) {
      showAlert('❌ تاريخ الميلاد غير صحيح', 'e'); return;
    }

    const nm  = document.getElementById('nameInput').value.trim() || 'مشترك';
    const g   = document.getElementById('genderSelect').value;
    const cv  = document.getElementById('currentCategory').value;
    const useUC = cv !== '';
    const uc  = useUC ? +cv : 1;

    // Join date
    const jD = +document.getElementById('joinDay').value;
    const jM = document.getElementById('joinMonth').value;
    const jY = document.getElementById('joinYear').value;
    let jd = null, ja = null;
    if (jD && jM && jY) {
      const j = new Date(+jY, +jM - 1, jD);
      if (!isNaN(j.getTime()) && j <= new Date()) { jd = j; ja = ageDiff(birth, j); }
    }

    // Prior service
    let pY = +document.getElementById('priorYears').value  || 0;
    let pM = +document.getElementById('priorMonths').value || 0;
    if (pM >= 12) { pY += Math.floor(pM / 12); pM %= 12; }
    const prior = pY * 12 + pM;

    const ageNow = ageDiff(birth, new Date());
    let sa = ja ? ja.years  : ageNow.years;
    let sm = ja ? ja.months : ageNow.months;
    sa = Math.min(Math.max(sa, 15), 100);

    const svcJ = jd ? monthsBetween(jd, new Date()) : 0;
    const ts   = svcJ + prior;

    if (ageNow.years >= 50 && !jd && prior === 0) {
      showAlert('⚠️ العمر 50 أو أكثر يتطلب تاريخ انتساب أو خدمة سابقة', 'w'); return;
    }

    const jat = ja
      ? `${ja.years} سنة و${ja.months} أشهر و${ja.days} أيام`
      : 'لم يدخل';

    USER = { gender: g, nm, ay: ageNow.years, am: ageNow.months, ad: ageNow.days,
             jat, py: pY, pm: pM, ts, sa, sm };

    // Build plans
    // svc = خدمة سابقة فقط، joinDate يُمرَّر منفصلاً
    // mkResult يحسب الكلي من الانتساب إلى التقاعد + prior
    const raw = [];

    // الخطة A: أقرب عمر مع شراء (فقط إذا يحتاج شراء)
    const p1 = planA(prior, birth, sa, useUC, uc, g, jd);
    if (p1.purchaseMonths > 0) raw.push({ ...p1, desc: 'أقرب عمر تقاعدي مع شراء' });

    // الخطة B: أقرب عمر بدون شراء
    raw.push({ ...planB(prior, birth, sa, useUC, uc, g, jd), desc: 'أقرب عمر تقاعدي بدون شراء' });

    const TGT_MO = 384; // 32 سنة × 12 شهر = الحد الأقصى للراتب

    // ── الخطة D: عمر 63 ذكور / 58 إناث ────────────────────────────────────
    const p4age = g === 'male' ? 63 : 58;
    if (ageNow.years < p4age) {
      const pD = planFixed(prior, birth, sa, useUC, uc, g, p4age, jd);
      raw.push({ ...pD, desc: `تقاعد عند إكمال ${p4age} سنة` });
    }

    // ── الخطة C: إكمال 32 سنة خدمة — تُضاف دائماً لجميع المشتركين ──────────
    // هي الحد الأقصى للراتب وتُظهر للمشترك الجدول الأمثل مادياً
    const pC = planC(prior, birth, sa, useUC, uc, jd);
    // تُضاف فقط إذا لم تكن مطابقة تماماً لخطة موجودة (نفس العمر والشراء)
    const dupC = raw.some(p =>
      p.targetAge === pC.targetAge && p.purchaseMonths === pC.purchaseMonths
    );
    if (!dupC) {
      raw.push({ ...pC, desc: 'إكمال خدمة 32 سنة (أعلى راتب)' });
    }

    // De-duplicate بالعمر والشراء
    const seen = new Set(), uniq = [];
    for (const p of raw) {
      const k = `${p.targetAge}-${p.purchaseMonths}`;
      if (!seen.has(k)) { seen.add(k); uniq.push(p); }
    }
    uniq.sort((a, b) => a.targetAge - b.targetAge);
    PLANS = uniq.map((p, i) => ({ ...p, title: `الخطة ${i + 1}` }));

    // Render
    let html = buildSummary(nm, g, ageNow, jat, ts, !!jd);
    PLANS.forEach((p, i) => html += buildCard(p, i, nm, g, ageNow, prior));
    document.getElementById('results').innerHTML = html;

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.onclick = function () {
        const idx = +this.dataset.i - 1;
        if (!isNaN(idx) && PLANS[idx] && USER) {
          copyPlan(PLANS[idx], USER, idx + 1);
          this.textContent = '✅ تم النسخ'; this.classList.add('done');
          showToast('✅ تم نسخ الخطة');
          setTimeout(() => { this.textContent = '📋 نسخ'; this.classList.remove('done'); }, 2200);
        }
      };
    });

    document.getElementById('pdfBtn').style.display = 'inline-flex';
    document.getElementById('shareBtn').style.display = 'inline-flex';
    document.getElementById('copyAllBtn').style.display = 'inline-flex';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // ── بناء شريط التنقل السفلي ──────────────────────────────────────────
    buildNavBar();

  } catch (e) { alert('خطأ: ' + e.message); console.error(e); }
}

/* ─────────────────────────────────────
   PLAN NAVIGATION BAR
───────────────────────────────────── */
const PLAN_COLORS_NAV = ['#2a5298','#2d6a4f','#b8943f','#9b3a4e','#5f3a8a'];

function buildNavBar() {
  if (!PLANS.length) return;
  const nav  = document.getElementById('planNav');
  const wrap = document.getElementById('planNavBtns');
  if (!nav || !wrap) return;

  // بناء أزرار التنقل
  wrap.innerHTML = PLANS.map((p, i) => {
    const col = PLAN_COLORS_NAV[i] || '#2a5298';
    return `<button class="pnav-btn" data-plan="${i+1}"
      style="border-color:${col}44"
      onclick="scrollToPlan(${i+1})">
      ${p.title}
      <small>${p.targetAge} سنة · ${N(p.pension)} د.ع</small>
    </button>`;
  }).join('');

  nav.style.display = 'block';
  document.body.classList.add('has-nav');
  updateActiveNav();

  // مراقبة الكروت المرئية لتحديث الزر النشط
  if (window._navObserver) window._navObserver.disconnect();
  window._navObserver = new IntersectionObserver((entries) => {
    // اختر الكرت الأكثر ظهوراً
    let best = null, bestRatio = 0;
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > bestRatio) {
        bestRatio = e.intersectionRatio;
        best = e.target.id;
      }
    });
    if (best) {
      const n = parseInt(best.split('-').pop());
      setActiveNav(n);
    }
  }, { threshold: [0.1, 0.3, 0.5] });

  PLANS.forEach((_, i) => {
    const el = document.getElementById(`plan-card-${i+1}`);
    if (el) window._navObserver.observe(el);
  });
}

function scrollToPlan(n) {
  const el = document.getElementById(`plan-card-${n}`);
  if (!el) return;
  // حساب offset الهيدر الثابت + شريط التنقل السفلي
  const headerH = document.querySelector('header') ? document.querySelector('header').offsetHeight : 0;
  const y = el.getBoundingClientRect().top + window.pageYOffset - headerH - 12;
  window.scrollTo({ top: y, behavior: 'smooth' });
  setActiveNav(n);
}
// نُصدِّر للنطاق العام حتى تعمل الـ onclick المضمّنة
window.scrollToPlan = scrollToPlan;

function setActiveNav(n) {
  document.querySelectorAll('.pnav-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.plan === n);
  });
}
window.setActiveNav = setActiveNav;

function updateActiveNav() {
  // تفعيل أول زر افتراضياً
  setActiveNav(1);
}

/* ─────────────────────────────────────
   ALERTS & TOAST
───────────────────────────────────── */
function showAlert(msg, t) {
  document.getElementById('results').innerHTML =
    `<div class="alert al-${t === 'e' ? 'e' : 'w'}">${msg}</div>`;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ─────────────────────────────────────
   POPULATE DROPDOWNS
───────────────────────────────────── */
function populate() {
  const cy = new Date().getFullYear();
  const monthOpts = '<option value="">الشهر</option>' +
    [1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}">${m}</option>`).join('');
  let yearBirth = '<option value="">السنة</option>';
  for (let y = cy; y >= 1950; y--) yearBirth += `<option value="${y}">${y}</option>`;
  let yearJoin  = '<option value="">السنة</option>';
  for (let y = cy; y >= 1970; y--) yearJoin  += `<option value="${y}">${y}</option>`;

  const dayOpts = '<option value="">اليوم</option>' +
    Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
  document.getElementById('birthDay').innerHTML  = dayOpts;
  document.getElementById('joinDay').innerHTML   = dayOpts;
  document.getElementById('birthMonth').innerHTML = monthOpts;
  document.getElementById('birthYear').innerHTML  = yearBirth;
  document.getElementById('joinMonth').innerHTML  = monthOpts;
  document.getElementById('joinYear').innerHTML   = yearJoin;

  let catHTML = '<option value="">— تلقائي —</option>';
  for (let i = 1; i <= 15; i++)
    catHTML += `<option value="${i}">فئة ${i}  ←  ${SAL[i].toLocaleString()} د.ع</option>`;
  document.getElementById('currentCategory').innerHTML = catHTML;
}

function reset() {
  document.getElementById('nameInput').value  = '';
  document.getElementById('genderSelect').value = 'male';
  document.getElementById('birthDay').value   = '';
  document.getElementById('joinDay').value    = '';
  document.getElementById('priorYears').value = '';
  document.getElementById('priorMonths').value = '';
  document.getElementById('results').innerHTML = '';
  document.getElementById('pdfBtn').style.display = 'none';
  document.getElementById('shareBtn').style.display = 'none';
  document.getElementById('copyAllBtn').style.display = 'none';
  const nav = document.getElementById('planNav');
  if (nav) { nav.style.display = 'none'; }
  document.body.classList.remove('has-nav');
  PLANS = []; USER = null;
  populate();
}

/* ─────────────────────────────────────
   COPY ALL PLANS
   — ينسخ الخطط المُختارة دفعة واحدة
───────────────────────────────────── */
function openCopyAllModal() {
  if (!PLANS.length) return;
  // استخدم نفس الـ modal بوضع 'copy'
  _modalMode = 'copy';
  _selectedPlans = new Set(PLANS.map((_, i) => i));

  const title    = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  const confirm  = document.getElementById('modalConfirmBtn');
  const shareBox = document.getElementById('shareLinkContainer');

  title.textContent    = '📋 نسخ الخطط';
  subtitle.textContent = 'اختر الخطط التي تريد نسخها دفعة واحدة';
  confirm.textContent  = '📋 نسخ المحدد';
  shareBox.style.display = 'none';

  renderModalPlans();
  document.getElementById('planSelectorModal').style.display = 'flex';
}

function copySelectedPlans(chosen) {
  if (!chosen.length || !USER) return;
  let text = '';
  chosen.forEach((plan, i) => {
    text += copyPlanText(plan, USER, PLANS.indexOf(plan) + 1);
    if (i < chosen.length - 1) text += '\n' + '─'.repeat(40) + '\n';
  });
  const fb = () => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => {}).catch(fb);
  else fb();
  showToast(`✅ تم نسخ ${chosen.length} خطة`);
}

// دالة مساعدة: تُرجع النص بدون نسخ (لإعادة الاستخدام)
function copyPlanText(plan, user, idx) {
  const f   = user.gender === 'female';
  const act = plan.totalServiceMonths - plan.purchaseMonths;
  const aY  = Math.floor(act / 12), aM = act % 12;
  const pY  = Math.floor(plan.purchaseMonths / 12), pM = plan.purchaseMonths % 12;
  const tY  = Math.floor(plan.totalServiceMonths / 12), tM = plan.totalServiceMonths % 12;
  let t   = `\n(الجدول ${idx})\n\n${plan.title} - ${plan.desc}\n\n`;
  t += `${f?'عمركِ':'عمرك'} اليوم: ${user.ay} سنة و${user.am} أشهر و${user.ad} أيام.\n`;
  if (user.jat && user.jat !== 'لم يدخل') t += `${f?'عمركِ':'عمرك'} عند الانتساب: ${user.jat}.\n`;
  const ttY = Math.floor(user.ts / 12), ttM = user.ts % 12;
  if (user.py > 0 || user.pm > 0) t += `${f?'لديكِ':'لديك'} خدمة سابقة: ${user.py} سنة و${user.pm} شهر، `;
  t += `إجمالي ${f?'خدمتكِ':'خدمتك'} الحالية: ${ttY} سنة و${ttM} شهر.\n\nالتسلسل:\n\n`;
  plan.yearsPlan.forEach(r => t += `بعمر ${r.age} سنة و${user.sm} شهر ← الفئة ${r.cat}\n`);
  t += `\n🔹 خدمة فعلية: ${aY} سنة و${aM} شهر.\n`;
  if (plan.purchaseMonths > 0)
    t += `🔹 تحتاج شراء ${pY} سنة و${pM} شهر، ليصبح المجموع ${tY} سنة و${tM} شهر.\n`;
  else t += `🔹 إجمالي الخدمة: ${tY} سنة و${tM} شهر.\n`;
  t += `🔹 الراتب التقاعدي: ${Math.round(plan.pension).toLocaleString()} دينار.\n\n`;
  if (plan.purchaseMonths > 0) {
    t += `سعر السنة (شراء): ${Math.round(plan.avg*0.17*12).toLocaleString()} دينار.\n`;
    t += `إجمالي مبلغ الشراء: ${Math.round(plan.purchaseCost).toLocaleString()} دينار.\n`;
  }
  return t;
}

/* ─────────────────────────────────────
   MODAL PLAN SELECTOR
───────────────────────────────────── */
const PLAN_COLORS_M = ['#2a5298','#2d6a4f','#b8943f','#9b3a4e','#5f3a8a'];
let _modalMode = 'pdf'; // 'pdf' | 'share'
let _selectedPlans = new Set();

function openPlanModal(mode) {
  if (!PLANS.length) return;
  _modalMode = mode;
  _selectedPlans = new Set(PLANS.map((_, i) => i)); // تحديد الكل افتراضياً

  const modal   = document.getElementById('planSelectorModal');
  const title   = document.getElementById('modalTitle');
  const subtitle= document.getElementById('modalSubtitle');
  const confirm = document.getElementById('modalConfirmBtn');
  const shareBox= document.getElementById('shareLinkContainer');

  if (mode === 'pdf') {
    title.textContent   = '📄 اختر الخطط للتصدير';
    subtitle.textContent= 'اختر الخطط التي تريد تضمينها في ملف PDF';
    confirm.textContent = '📄 تصدير PDF';
    shareBox.style.display = 'none';
  } else {
    title.textContent   = '🔗 مشاركة الجداول';
    subtitle.textContent= 'اختر الخطط ثم انسخ الرابط لمشاركته';
    confirm.textContent = '🔗 إنشاء رابط';
    shareBox.style.display = 'none';
  }

  renderModalPlans();
  modal.style.display = 'flex';
}

function renderModalPlans() {
  const list = document.getElementById('modalPlansList');
  list.innerHTML = PLANS.map((p, i) => {
    const col = PLAN_COLORS_M[i] || '#2a5298';
    const sel = _selectedPlans.has(i);
    return `<div class="modal-plan-row ${sel ? 'selected' : ''}"
         data-idx="${i}"
         onclick="toggleModalPlan(${i})">
      <div class="modal-plan-chk">${sel ? '✓' : ''}</div>
      <div class="modal-plan-info">
        <div class="modal-plan-name" style="color:${col}">${p.title}</div>
        <div class="modal-plan-meta">${p.desc} · عمر ${p.targetAge} سنة · ${FM(p.totalServiceMonths)} خدمة</div>
      </div>
      <div class="modal-plan-pension">${N(p.pension)} د.ع</div>
    </div>`;
  }).join('');
}

window.toggleModalPlan = function(i) {
  if (_selectedPlans.has(i)) { _selectedPlans.delete(i); }
  else                        { _selectedPlans.add(i); }
  renderModalPlans();
};

function modalSelectAll() {
  if (_selectedPlans.size === PLANS.length) {
    _selectedPlans.clear();
  } else {
    _selectedPlans = new Set(PLANS.map((_, i) => i));
  }
  renderModalPlans();
}

function closeModal() {
  document.getElementById('planSelectorModal').style.display = 'none';
  document.getElementById('shareLinkContainer').style.display = 'none';
}

function modalConfirm() {
  if (_selectedPlans.size === 0) { showToast('⚠️ يرجى اختيار خطة واحدة على الأقل'); return; }
  const chosen = [..._selectedPlans].sort((a,b)=>a-b).map(i => PLANS[i]);
  if (_modalMode === 'pdf') {
    closeModal();
    exportPDFPlans(chosen);
  } else if (_modalMode === 'copy') {
    closeModal();
    copySelectedPlans(chosen);
  } else {
    buildShareLink(chosen);
  }
}

/* ─────────────────────────────────────
   SHARE LINK (URL hash encoding)
   — الرابط يفتح مباشرة ملف PDF
   — لا يُحوَّل المستخدم إلى الحاسبة
───────────────────────────────────── */
function buildShareLink(chosenPlans) {
  if (!USER) return;
  // payload v3 — أقصر نسخة ممكنة:
  // - title/desc مُحذوفان (يُعادان بناؤهما من الترتيب في loadSharedView)
  // - rd مُختصر إلى سنة التقاعد فقط (4 أرقام بدل 10)
  // - أسماء الحقول أحرف مفردة
  const payload = {
    v: 3,
    u: [
      USER.nm,          // 0: الاسم
      USER.gender==='male'?1:0, // 1: الجنس 1=ذكر 0=أنثى
      USER.ay,          // 2: العمر سنوات
      USER.am,          // 3: العمر أشهر
      USER.ts,          // 4: إجمالي الخدمة بالأشهر
      USER.py,          // 5: خدمة سابقة سنوات
      USER.pm,          // 6: خدمة سابقة أشهر
      USER.sa           // 7: عمر الانتساب/البداية
    ],
    p: chosenPlans.map(p => [
      p.targetAge,                                    // 0: عمر التقاعد
      p.totalServiceMonths,                           // 1: خدمة إجمالية
      p.purchaseMonths,                               // 2: أشهر الشراء
      Math.round(p.pension),                          // 3: الراتب
      Math.round(p.avg),                              // 4: متوسط الراتب
      Math.round(p.purchaseCost),                     // 5: تكلفة الشراء
      p.retireDate.getFullYear(),                     // 6: سنة التقاعد فقط
      p.yearsPlan.length > 0 ? p.yearsPlan[0].cat : 1 // 7: فئة البداية
    ])
  };

  const json    = JSON.stringify(payload);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  const url     = window.location.href.split('#')[0] + '#s=' + encoded;

  const linkBox  = document.getElementById('shareLinkBox');
  const copyBtn  = document.getElementById('shareLinkCopyBtn');
  const container= document.getElementById('shareLinkContainer');

  linkBox.textContent = url;
  container.style.display = 'block';

  // زر نسخ الرابط
  copyBtn.onclick = function() {
    const doCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    };
    navigator.clipboard?.writeText(url).then(() => {}).catch(doCopy);
    this.textContent = '✅ تم نسخ الرابط!';
    this.classList.add('copied');
    setTimeout(() => {
      this.textContent = '📋 نسخ الرابط';
      this.classList.remove('copied');
    }, 2500);
    showToast('✅ تم نسخ الرابط');
  };
}

/* ─────────────────────────────────────
   LOAD SHARED VIEW
   — عند فتح رابط المشاركة يُعرَض PDF مباشرة
   — لا يُحوَّل المستخدم إلى الحاسبة
───────────────────────────────────── */
function loadSharedView() {
  const hash  = window.location.hash;
  const isV3  = hash.startsWith('#s=');
  const isOld = hash.startsWith('#share=');
  if (!isV3 && !isOld) return false;
  try {
    const encoded = isV3 ? hash.slice(3) : hash.slice(7);
    const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    if (!payload) return false;

    let u_nm,u_g,u_ay,u_am,u_ts,u_py,u_pm,u_sa, plans;

    if (payload.v === 3) {
      const u=payload.u;
      u_nm=u[0]; u_g=u[1]===1?'male':'female';
      u_ay=u[2]; u_am=u[3]; u_ts=u[4]; u_py=u[5]; u_pm=u[6]; u_sa=u[7]||0;
      const descs=['أقرب عمر تقاعدي مع شراء','أقرب عمر تقاعدي بدون شراء',
                   'تقاعد عند إكمال '+(u_g==='male'?'63':'58')+' سنة',
                   'إكمال خدمة 32 سنة (أعلى راتب)'];
      plans=payload.p.map((p,i)=>({
        title:`الخطة ${i+1}`, desc:descs[i]||'خطة '+(i+1),
        targetAge:p[0], totalServiceMonths:p[1], purchaseMonths:p[2],
        pension:p[3], avg:p[4], purchaseCost:p[5],
        retireDate:new Date(p[6],0,1),
        yearsPlan:buildCatPlan(u_sa,p[0],p[7])
      }));
    } else if (payload.v===2) {
      const u=payload.u;
      u_nm=u.nm;u_g=u.g;u_ay=u.ay;u_am=u.am;u_ts=u.ts;
      u_py=u.py;u_pm=u.pm;u_sa=u.sa||0;
      plans=payload.plans.map(p=>({
        title:p.ti,desc:p.de,targetAge:p.ag,totalServiceMonths:p.mo,
        purchaseMonths:p.bu,pension:p.pe,avg:p.av,purchaseCost:p.co,
        retireDate:new Date(p.rd),yearsPlan:buildCatPlan(u_sa,p.ag,p.sc)
      }));
    } else {
      const u=payload.u;
      u_nm=u.nm;u_g=u.g;u_ay=u.ay;u_am=u.am;u_ts=u.ts;
      u_py=u.py;u_pm=u.pm;u_sa=0;
      plans=payload.plans.map(p=>({
        title:p.title,desc:p.desc,targetAge:p.age,totalServiceMonths:p.mo,
        purchaseMonths:p.buy,pension:p.pension,avg:p.avg,purchaseCost:p.cost,
        retireDate:new Date(p.rd),
        yearsPlan:p.yp?p.yp.map((cat,idx)=>({age:p.age-p.yp.length+1+idx,cat}))
                      :buildCatPlan(0,p.age,1)
      }));
    }

    if (!plans?.length) return false;
    PLANS=plans;
    USER={nm:u_nm,gender:u_g,ay:u_ay,am:u_am,ts:u_ts,
          py:u_py,pm:u_pm,sm:0,ad:0,jat:'مشارَك',sa:u_sa};

    const formEl=document.querySelector('.card.no-print');
    if (formEl) formEl.style.display='none';
    ['calcBtn','shareBtn','printBtn','resetBtn','copyAllBtn'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.style.display='none';
    });

    const toolbar=document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.innerHTML=`
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%">
          <span style="font-size:.85rem;color:var(--navy);background:var(--navy-pale);
                       padding:8px 14px;border-radius:8px;border-right:3px solid var(--navy-md)">
            🔗 جدول مشارَك لـ <b>${u_nm||'مشترك'}</b>
            (${u_g==='male'?'ذكر':'أنثى'} · ${u_ay} سنة)
          </span>
          <button class="btn btn-pdf" id="sharedPdfBtn">📄 فتح PDF</button>
          <button class="btn btn-generate" id="sharedDlBtn">📥 تحميل PDF</button>
        </div>`;
      document.getElementById('sharedPdfBtn').onclick=()=>exportPDFPlans(plans);
      document.getElementById('sharedDlBtn').onclick=()=>{
        exportPDFPlans(plans);
        showToast('✅ استخدم "حفظ كـ PDF" في حوار الطباعة');
      };
    }

    const ageNow={years:u_ay,months:u_am,days:0};
    let html=buildSummary(u_nm,u_g,ageNow,'مشارَك',u_ts,false);
    plans.forEach((p,i)=>html+=buildCard(p,i,u_nm,u_g,ageNow,(u_py||0)*12+(u_pm||0)));
    document.getElementById('results').innerHTML=html;

    document.querySelectorAll('.copy-btn').forEach(btn=>{
      btn.onclick=function(){
        const idx=+this.dataset.i-1;
        if(!isNaN(idx)&&PLANS[idx]&&USER){
          copyPlan(PLANS[idx],USER,idx+1);
          this.textContent='✅ تم النسخ'; this.classList.add('done');
          showToast('✅ تم نسخ الخطة');
          setTimeout(()=>{this.textContent='📋 نسخ';this.classList.remove('done');},2200);
        }
      };
    });

    buildNavBar();
    setTimeout(()=>exportPDFPlans(plans),800);
    return true;
  } catch(e){ console.warn('Share link parse error:',e); return false; }
}

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
window.onload = function () {
  populate();

  // هل هذا رابط مشاركة؟
  if (!loadSharedView()) {
    document.getElementById('calcBtn').onclick  = generate;
  }

  document.getElementById('pdfBtn').onclick    = () => openPlanModal('pdf');
  document.getElementById('shareBtn').onclick  = () => openPlanModal('share');
  document.getElementById('copyAllBtn').onclick = openCopyAllModal;
  document.getElementById('printBtn').onclick  = () => window.print();
  document.getElementById('resetBtn').onclick  = reset;

  // Modal events
  document.getElementById('modalCloseBtn').onclick  = closeModal;
  document.getElementById('modalCancelBtn').onclick = closeModal;
  document.getElementById('modalConfirmBtn').onclick= modalConfirm;
  document.getElementById('modalSelectAll').onclick = modalSelectAll;

  // Close on overlay click
  document.getElementById('planSelectorModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
};

})();
