/* Tangent — a calculus tutor that checks handwritten work line by line.
 * The AI reads handwriting and writes hints. engine.js decides what is correct. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ data
  const KEY = 'tangent.v1';
  const DAY = 86400000;
  const CATS = {
    sign: { name: 'Sign error', advice: 'Slow down wherever a minus meets a bracket. Write the bracket out before you expand it.' },
    algebra: { name: 'Algebra slip', advice: 'The calculus is fine; the simplifying is not. Do one algebraic move per line for a while.' },
    chain: { name: 'Chain rule missed', advice: 'Before differentiating, name the inner function out loud. If there is one, its derivative must appear as a factor.' },
    product_quotient: { name: 'Product or quotient rule', advice: 'Write u, v, u′, v′ as side work first, then assemble. Do not assemble from memory.' },
    basic_derivative: { name: 'Wrong basic derivative', advice: 'One standard derivative is not solid yet. Derive it once from the definition, then drill it.' },
    indeterminate: { name: 'Indeterminate form mishandled', advice: 'Substitute first and name the form (0/0, ∞/∞, ∞−∞…) before choosing a technique.' },
    lhopital: { name: 'L’Hôpital misused', advice: 'Check the form is 0/0 or ∞/∞ every single time, and differentiate top and bottom separately.' },
    limit_law: { name: 'Limit law misapplied', advice: 'A limit law only applies when each separate limit exists. Check that before splitting.' },
    identity: { name: 'Trig, exponential or log identity', advice: 'Keep a short list of the identities you actually use and test each one with a number when unsure.' },
    copying: { name: 'Copying error', advice: 'A term changed between lines without a reason. Tick each term off as you carry it down.' },
    concept: { name: 'Conceptual misunderstanding', advice: 'This is about what the idea means, not the mechanics. Sketch the function and look at what it does.' },
    integration: { name: 'Integration technique', advice: 'Differentiate your answer to test it. If you do not get the integrand back, the technique was applied wrongly.' },
    other: { name: 'Other', advice: '' },
  };

  const blank = () => ({ settings: { key: '', model: 'deepseek-flash' }, exercises: [], concepts: [] });
  let store = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* start fresh */ }
  if (!store.settings.lang) store.settings.lang = (navigator.language || 'en').toLowerCase().startsWith('sv') ? 'sv' : 'en';
  if (!store.settings.theme) store.settings.theme = 'dark';
  if (!store.sketches) store.sketches = [];
  function applyTheme() {
    const light = store.settings.theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    document.documentElement.lang = store.settings.lang;
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => { m.content = light ? '#eef3ff' : '#060a18'; });
  }
  applyTheme();

  // Swedish. Keys are the English strings; "#" stands for any number.
  const SV = {
    "Play": "Spela",
    "Progress": "Framsteg",
    "Sketch": "Skissa",
    "Settings": "Inställningar",
    "English": "English",
    "Svenska": "Svenska",
    "DeepSeek": "DeepSeek",
    "Back": "Tillbaka",
    "Cancel": "Avbryt",
    "Done": "Klar",
    "Delete": "Ta bort",
    "Scanning needs your DeepSeek API key.": "Skanning kräver din API-nyckel från DeepSeek.",
    "Add it in settings.": "Lägg till den i inställningarna.",
    "Your history could not be saved on this device. Export a backup from settings.": "Din historik kunde inte sparas på den här enheten. Exportera en säkerhetskopia i inställningarna.",
    "Scan my work": "Skanna min lösning",
    "Photograph your solution and find the miss": "Fotografera din lösning och hitta felet",
    "Use the math keyboard": "Använd mattetangentbordet",
    "You vs last week": "Du mot förra veckan",
    "Solved": "Lösta",
    "First-try accuracy": "Rätt på första försöket",
    "Clean streak": "Felfri svit",
    "Hints per miss": "Ledtrådar per fel",
    "No data last week": "Inga data från förra veckan",
    "Same as last week": "Samma som förra veckan",
    "▲ +# vs last week": "▲ +# mot förra veckan",
    "▼ −# vs last week": "▼ −# mot förra veckan",
    "▲ +# pts vs last week": "▲ +# procentenheter mot förra veckan",
    "▼ −# pts vs last week": "▼ −# procentenheter mot förra veckan",
    "Your best: #": "Ditt bästa: #",
    "How it works": "Så funkar det",
    "Solve an exercise on paper.": "Lös en uppgift på papper.",
    "Scan it. Every line is checked by calculation.": "Skanna den. Varje rad kontrolleras genom beräkning.",
    "Fix the miss with as few hints as you can to earn more XP.": "Rätta felet med så få ledtrådar som möjligt för att få mer XP.",
    "Bounties: beat your past self": "Revanscher: slå ditt gamla jag",
    "# bounty unlocks in the next few days.": "# revansch låses upp inom några dagar.",
    "# bounties unlock in the next few days.": "# revanscher låses upp inom några dagar.",
    "Your nemesis": "Din ärkefiende",
    "Hit you # times in the last three weeks.": "Har träffat dig # gånger de senaste tre veckorna.",
    "Mission log": "Uppdragslogg",
    "Cleared": "Klarad",
    "Miss": "Miss",
    "line #": "rad #",
    "Open": "Öppen",
    "Today": "Idag",
    "Yesterday": "Igår",
    "# days ago": "# dagar sedan",
    "Level #": "Nivå #",
    "· Level #": "· Nivå #",
    "# to level #": "# till nivå #",
    "Cadet": "Kadett",
    "Rookie": "Rekryt",
    "Operator": "Operatör",
    "Specialist": "Specialist",
    "Sharpshooter": "Prickskytt",
    "Ace": "Ess",
    "Elite": "Elit",
    "Commander": "Befälhavare",
    "Legend": "Legend",
    "Try this one again": "Försök med den här igen",
    "You made a mistake here before. Solve it from scratch on paper without looking at your old work.": "Du gjorde ett fel här förut. Lös uppgiften från början på papper utan att titta på din gamla lösning.",
    "Photograph my new solution": "Fotografera min nya lösning",
    "Remove from the redo list": "Ta bort den här revanschen",
    "New attempt": "Nytt försök",
    "Looks good?": "Ser det bra ut?",
    "Check my work": "Kontrollera min lösning",
    "Hold the phone straight above the page, in good light.": "Håll telefonen rakt ovanför sidan, i bra ljus.",
    "Problem (leave empty if it is in the photo)": "Uppgift (lämna tomt om den finns på bilden)",
    "e.g. differentiate x² sin x": "t.ex. derivera x² sin x",
    "Add another page": "Lägg till en sida",
    "Take a photo": "Ta ett foto",
    "Check it": "Kontrollera",
    "Type the lines instead": "Skriv in raderna istället",
    "Photos are sent to DeepSeek to be read and are not kept in the app.": "Bilderna skickas till DeepSeek för att läsas av och sparas inte i appen.",
    "Reading your handwriting…": "Läser din handstil…",
    "Something went wrong while reading the photo.": "Något gick fel när bilden lästes av.",
    "Page #": "Sida #",
    "Remove page #": "Ta bort sida #",
    "Is this what you wrote?": "Är det här vad du skrev?",
    "Tap any line to correct it. The check is only as good as this transcription.": "Tryck på en rad för att rätta den. Kontrollen blir bara så bra som den här avläsningen.",
    "Unsure about:": "Osäker på:",
    "Problem": "Uppgift",
    "Tap to enter the problem": "Tryck för att skriva in uppgiften",
    "Problem — not in a form I can check. Tap to enter it.": "Uppgiften är inte i en form som kan kontrolleras. Tryck för att skriva in den.",
    "Side work": "Sidoräkning",
    "Add a line": "Lägg till en rad",
    "# line is not in a form that can be checked. Tap to fix, or continue and it will be skipped.": "# rad är inte i en form som kan kontrolleras. Tryck för att rätta, eller fortsätt så hoppas den över.",
    "# lines are not in a form that can be checked. Tap to fix, or continue and it will be skipped.": "# rader är inte i en form som kan kontrolleras. Tryck för att rätta, eller fortsätt så hoppas de över.",
    "The problem": "Uppgiften",
    "Line #": "Rad #",
    "New line": "Ny rad",
    "Function": "Funktion",
    "Start with d/dx, ∫ or lim, then type what goes inside.": "Börja med d/dx, ∫ eller lim och skriv sedan det som ska stå inuti.",
    "Your maths appears here": "Din matematik visas här",
    "Keep typing…": "Fortsätt skriva…",
    "Back to the math keys": "Tillbaka till mattetangenterna",
    "Tap inside the box to move the cursor.": "Tryck i rutan för att flytta markören.",
    "This line is side work": "Den här raden är en sidoräkning",
    "Expression": "Uttryck",
    "Miss on line #": "Miss på rad #",
    "All lines hit": "Alla rader rätt",
    "On target so far": "Rätt hittills",
    "Nothing here could be checked.": "Inget här kunde kontrolleras.",
    "It does not follow from the problem.": "Den följer inte av uppgiften.",
    "Line # is fine. Look at how you got from line # to line #.": "Rad # stämmer. Titta på hur du gick från rad # till rad #.",
    "Lines #–# are fine. Look at how you got from line # to line #.": "Rad #–# stämmer. Titta på hur du gick från rad # till rad #.",
    "# line verified by calculation.": "# rad verifierad genom beräkning.",
    "# lines verified by calculation.": "# rader verifierade genom beräkning.",
    "# line verified by calculation, # could not be checked.": "# rad verifierad genom beräkning, # kunde inte kontrolleras.",
    "# lines verified by calculation, # could not be checked.": "# rader verifierade genom beräkning, # kunde inte kontrolleras.",
    "Combo ×#": "Kombo ×#",
    "Level up!": "Ny nivå!",
    "New best streak: #": "Ny bästa svit: #",
    "Delete this exercise from your history?": "Ta bort den här uppgiften från din historik?",
    "Photograph my corrected work": "Fotografera min rättade lösning",
    "Photograph the rest": "Fotografera resten",
    "Fix it now for bonus XP: the fewer hints you open, the bigger the bonus. It also returns as a bounty in three days.": "Rätta det nu för bonus-XP: ju färre ledtrådar du öppnar, desto större bonus. Uppgiften kommer också tillbaka som en revansch om tre dagar.",
    "ok": "rätt",
    "wrong": "fel",
    "unverified": "inte kontrollerad",
    "Working out what happened on that line…": "Tar reda på vad som hände på den raden…",
    "No explanation yet.": "Ingen förklaring ännu.",
    "Ask for an explanation": "Be om en förklaring",
    "Look here": "Titta här",
    "The idea": "Idén",
    "What happened": "Vad som hände",
    "What it means": "Vad det betyder",
    "Corrected line": "Rättad rad",
    "Verified by calculation.": "Verifierad genom beräkning.",
    "The AI’s correction did not pass the check, so it is not shown. Use the hints above.": "AI:ns rättning klarade inte kontrollen, så den visas inte. Använd ledtrådarna ovan.",
    "Another hint": "En ledtråd till",
    "Show what went wrong": "Visa vad som gick fel",
    "Show the corrected line": "Visa den rättade raden",
    "Try to fix it on paper before asking for more.": "Försök rätta det på papper innan du ber om mer.",
    "Thinking about your next step…": "Funderar på ditt nästa steg…",
    "I’m stuck — give me a nudge": "Jag har kört fast, ge mig en knuff",
    "Notice": "Lägg märke till",
    "Next line": "Nästa rad",
    "The AI’s suggested line did not pass the check, so it is not shown.": "AI:ns föreslagna rad klarade inte kontrollen, så den visas inte.",
    "Show the next line": "Visa nästa rad",
    "Something went wrong while asking for an explanation.": "Något gick fel när förklaringen skulle hämtas.",
    "Something went wrong while asking for a hint.": "Något gick fel när ledtråden skulle hämtas.",
    "No expression to check on this line.": "Inget uttryck att kontrollera på den här raden.",
    "This line could not be read as an expression.": "Raden kunde inte läsas som ett uttryck.",
    "Side work without an equation to test.": "Sidoräkning utan en ekvation att testa.",
    "A definition, not a calculation.": "En definition, inte en beräkning.",
    "The problem itself could not be read as an expression.": "Själva uppgiften kunde inte läsas som ett uttryck.",
    "This kind of problem cannot be checked automatically yet.": "Den här typen av uppgift kan inte kontrolleras automatiskt ännu.",
    "Could not be evaluated reliably at enough test points.": "Kunde inte beräknas tillförlitligt i tillräckligt många testpunkter.",
    "Top rank reached.": "Högsta rangen nådd.",
    "Next rank at level #:": "Nästa rang vid nivå #:",
    "XP per week": "XP per vecka",
    "Now": "Nu",
    "#w ago": "# v sedan",
    "Personal records": "Personliga rekord",
    "Best clean streak": "Bästa felfria svit",
    "Current: #": "Just nu: #",
    "Exercises cleared": "Klarade uppgifter",
    "of # scanned": "av # skannade",
    "Lines verified": "Verifierade rader",
    "# XP each": "# XP styck",
    "Bounties claimed": "Vunna revanscher",
    "Your nemeses": "Dina ärkefiender",
    "# hits": "# träffar",
    "# this month": "# den här månaden",
    "No mistakes recorded yet. The kinds of mistakes you make will be tracked here so you can hunt them down.": "Inga fel registrerade ännu. Här samlas de typer av fel du gör så att du kan jaga ner dem.",
    "of # on average. Lower means you are finding your own errors.": "av # i genomsnitt. Lägre betyder att du hittar dina egna fel.",
    "Sign error": "Teckenfel",
    "Slow down wherever a minus meets a bracket. Write the bracket out before you expand it.": "Sakta ner varje gång ett minustecken möter en parentes. Skriv ut parentesen innan du multiplicerar in.",
    "Algebra slip": "Algebramiss",
    "The calculus is fine; the simplifying is not. Do one algebraic move per line for a while.": "Analysen är rätt, men förenklingen är det inte. Gör ett algebraiskt steg per rad ett tag.",
    "Chain rule missed": "Missad kedjeregel",
    "Before differentiating, name the inner function out loud. If there is one, its derivative must appear as a factor.": "Säg den inre funktionen högt innan du deriverar. Finns det en, måste dess derivata vara med som faktor.",
    "Product or quotient rule": "Produkt- eller kvotregeln",
    "Write u, v, u′, v′ as side work first, then assemble. Do not assemble from memory.": "Skriv u, v, u′ och v′ som sidoräkning först och sätt sedan ihop. Sätt inte ihop ur minnet.",
    "Wrong basic derivative": "Fel standardderivata",
    "One standard derivative is not solid yet. Derive it once from the definition, then drill it.": "En standardderivata sitter inte än. Härled den en gång från definitionen och nöt sedan in den.",
    "Indeterminate form mishandled": "Felhanterat obestämt uttryck",
    "Substitute first and name the form (0/0, ∞/∞, ∞−∞…) before choosing a technique.": "Sätt in värdet först och namnge formen (0/0, ∞/∞, ∞−∞…) innan du väljer metod.",
    "L’Hôpital misused": "Felanvänd l’Hôpital",
    "Check the form is 0/0 or ∞/∞ every single time, and differentiate top and bottom separately.": "Kontrollera varje gång att formen är 0/0 eller ∞/∞, och derivera täljare och nämnare var för sig.",
    "Limit law misapplied": "Felanvänd gränsvärdeslag",
    "A limit law only applies when each separate limit exists. Check that before splitting.": "En gränsvärdeslag gäller bara när varje gränsvärde för sig existerar. Kontrollera det innan du delar upp.",
    "Trig, exponential or log identity": "Trigonometrisk, exponential- eller logaritmidentitet",
    "Keep a short list of the identities you actually use and test each one with a number when unsure.": "Ha en kort lista över de identiteter du faktiskt använder, och testa dem med ett tal när du är osäker.",
    "Copying error": "Avskrivningsfel",
    "A term changed between lines without a reason. Tick each term off as you carry it down.": "En term ändrades mellan raderna utan anledning. Bocka av varje term när du för över den.",
    "Conceptual misunderstanding": "Begreppsligt missförstånd",
    "This is about what the idea means, not the mechanics. Sketch the function and look at what it does.": "Det här handlar om vad begreppet betyder, inte om räknandet. Skissa funktionen och titta på vad den gör.",
    "Integration technique": "Integrationsmetod",
    "Differentiate your answer to test it. If you do not get the integrand back, the technique was applied wrongly.": "Derivera ditt svar för att testa det. Får du inte tillbaka integranden har metoden använts fel.",
    "Other": "Övrigt",
    "Language": "Språk",
    "Appearance": "Utseende",
    "Dark": "Mörkt",
    "Light": "Ljust",
    "API key (from platform.deepseek.com, kept only on this device)": "API-nyckel (från platform.deepseek.com, sparas bara på den här enheten)",
    "Save and test the key": "Spara och testa nyckeln",
    "Testing…": "Testar…",
    "The key works.": "Nyckeln fungerar.",
    "Your data": "Dina data",
    "Your exercises and mistake history are stored only on this device. Export a backup now and then, and before changing phones.": "Dina uppgifter och din felhistorik sparas bara på den här enheten. Exportera en säkerhetskopia då och då, och innan du byter telefon.",
    "Export a backup": "Exportera en säkerhetskopia",
    "Restore from a backup": "Återställ från en säkerhetskopia",
    "Erase history": "Radera historiken",
    "How checking works": "Så fungerar kontrollen",
    "The AI only reads your handwriting and writes hints. Whether a line is right is decided by calculation: each line is evaluated at several test values and compared with the problem itself. A “?” means a line could not be tested, not that it is wrong.": "AI:n läser bara din handstil och skriver ledtrådar. Om en rad är rätt avgörs genom beräkning: varje rad beräknas för flera testvärden och jämförs med själva uppgiften. Ett ”?” betyder att raden inte kunde testas, inte att den är fel.",
    "Backup restored.": "Säkerhetskopian är återställd.",
    "That file is not a Tangent backup.": "Den filen är ingen säkerhetskopia från Tangent.",
    "History erased.": "Historiken är raderad.",
    "Replace the history on this device with the # exercises in this backup?": "Ersätta historiken på den här enheten med de # uppgifterna i säkerhetskopian?",
    "Erase all exercises and progress from this device? This cannot be undone.": "Radera alla uppgifter och alla framsteg från den här enheten? Det går inte att ångra.",
    "Add your DeepSeek API key in Settings first.": "Lägg först till din API-nyckel från DeepSeek i inställningarna.",
    "The AI took too long to answer. Try again.": "AI:n tog för lång tid på sig att svara. Försök igen.",
    "Could not reach DeepSeek. Check your connection.": "Kunde inte nå DeepSeek. Kontrollera din anslutning.",
    "DeepSeek rejected the API key. Check it in Settings.": "DeepSeek godkände inte API-nyckeln. Kontrollera den i inställningarna.",
    "Your DeepSeek balance is empty. Top it up at platform.deepseek.com.": "Ditt saldo hos DeepSeek är slut. Fyll på det på platform.deepseek.com.",
    "DeepSeek is rate-limiting requests. Wait a moment and try again.": "DeepSeek begränsar antalet förfrågningar just nu. Vänta en stund och försök igen.",
    "The AI answered in a form I could not read. Try again.": "AI:n svarade i en form som inte gick att läsa. Försök igen.",
    "That photo could not be opened.": "Det gick inte att öppna bilden.",
    "Function sketcher": "Funktionsskissare",
    "Scan": "Skanna",
    "Type": "Skriv",
    "Enter a function of x to see its curve, or of x and y to see its surface in 3D.": "Skriv in en funktion av x för att se dess kurva, eller av x och y för att se dess yta i 3D.",
    "Use x for a curve, or x and y for a surface.": "Använd x för en kurva, eller x och y för en yta.",
    "Try one": "Prova en",
    "Recent": "Senaste",
    "Reset": "Återställ",
    "Zoom in": "Zooma in",
    "Zoom out": "Zooma ut",
    "Graph of the function": "Funktionens graf",
    "Reading the function…": "Läser av funktionen…",
    "That function could not be read. Tap Type to fix it.": "Funktionen kunde inte läsas. Tryck på Skriv för att rätta den.",
    "Drag to rotate. Pinch or use the buttons to zoom.": "Dra för att rotera. Nyp eller använd knapparna för att zooma.",
    "Drag to move. Pinch or use the buttons to zoom.": "Dra för att flytta. Nyp eller använd knapparna för att zooma."
  };
  const missing = new Set();
  function tr(text) {
    if (store.settings.lang !== 'sv') return text;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(text));
    const core = m[2];
    if (!core) return text;
    const one = (c) => {
      if (SV[c] != null) return SV[c];
      const nums = [];
      const key = c.replace(/\d+(?:[.,]\d+)?/g, (n) => { nums.push(n); return '#'; });
      if (SV[key] == null) return null;
      let i = 0;
      return SV[key].replace(/#/g, () => nums[i++]);
    };
    let out = one(core);
    if (out == null && core.includes(' · ')) {
      out = core.split(' · ').map((p) => { const t = one(p); if (t == null && /[A-Za-z]{3}/.test(p)) missing.add(p); return t == null ? p : t; }).join(' · ');
    }
    if (out == null) { if (/[A-Za-z]{3}/.test(core)) missing.add(core); out = core; }
    return m[1] + out + m[3];
  }
  let storageOk = true;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; }
    catch (e) { storageOk = false; }
  }

  // ------------------------------------------------------------------ dom helpers
  const main = document.getElementById('main');
  const tabsEl = document.getElementById('tabs');
  const sheetRoot = document.getElementById('sheet-root');

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v);
      if (k === 'placeholder' || k === 'aria-label') el.setAttribute(k, tr(v));
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(tr(String(c)))); });
    return el;
  }

  function mathEl(latex, block) {
    const el = h('div', { class: 'mathline' });
    try { katex.render('\\displaystyle ' + (latex || ''), el, { throwOnError: false, displayMode: false, strict: false }); }
    catch (e) { el.textContent = latex || ''; }
    return el;
  }

  // Text with $inline maths$ in it.
  function rich(text) {
    const el = h('span', {});
    String(text || '').split(/\$\$?([^$]+)\$\$?/).forEach((part, i) => {
      if (i % 2 === 0) { el.append(part); return; }
      const s = h('span', {});
      try { katex.render(part, s, { throwOnError: false, strict: false }); } catch (e) { s.textContent = part; }
      el.append(s);
    });
    return el;
  }

  function stepTex(step, variable) {
    if (step.expr) { try { return Engine.tex(step.expr, variable); } catch (e) { /* fall through */ } }
    if (step.latex) return step.latex;
    return '\\text{' + String(step.expr || '(empty line)').replace(/[\\{}$%#&_^~]/g, ' ') + '}';
  }
  const problemTex = (p) => (p.expr || p.latex) ? stepTex(p, p.variable) : null;
  function problemEl(p) { const t = problemTex(p); return t ? mathEl(t) : h('div', {}, p.text || 'Untitled problem'); }

  const fmtDate = (t) => {
    const d = Math.floor((Date.now() - t) / DAY);
    if (d <= 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return d + ' days ago';
    return new Date(t).toLocaleDateString(store.settings.lang === 'sv' ? 'sv-SE' : undefined, { day: 'numeric', month: 'short' });
  };

  // ------------------------------------------------------------------ AI
  class Friendly extends Error {}

  async function ai({ system, user, images, effort }) {
    const key = store.settings.key;
    if (!key) throw new Friendly('Add your DeepSeek API key in Settings first.');
    const content = images && images.length
      ? [{ type: 'text', text: user }].concat(images.map((url) => ({ type: 'image_url', image_url: { url } })))
      : user;
    const base = {
      model: store.settings.model || 'deepseek-flash',
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
    };
    const full = Object.assign({}, base, {
      response_format: { type: 'json_object' }, thinking: { type: 'enabled' }, reasoning_effort: effort || 'low', max_tokens: 16000,
    });
    const call = async (body) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 150000);
      try {
        return await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new Friendly(e.name === 'AbortError' ? 'The AI took too long to answer. Try again.' : 'Could not reach DeepSeek. Check your connection.');
      } finally { clearTimeout(timer); }
    };
    let res = await call(full);
    if (res.status === 400 || res.status === 422) res = await call(base); // retry without optional parameters
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error.message || ''; } catch (e) { /* ignore */ }
      if (res.status === 401) throw new Friendly('DeepSeek rejected the API key. Check it in Settings.');
      if (res.status === 402) throw new Friendly('Your DeepSeek balance is empty. Top it up at platform.deepseek.com.');
      if (res.status === 429) throw new Friendly('DeepSeek is rate-limiting requests. Wait a moment and try again.');
      throw new Friendly('DeepSeek returned an error (' + res.status + '). ' + detail.slice(0, 160));
    }
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    try { return JSON.parse(text.slice(a, b + 1)); }
    catch (e) { throw new Friendly('The AI answered in a form I could not read. Try again.'); }
  }

  const langNote = () => store.settings.lang === 'sv' ? '\nWrite every sentence meant for the student in Swedish.' : '';
  const SYNTAX = `Expression syntax (strict, machine-parsed):
- Plain text maths: + - * / ^ and parentheses. Always put function arguments in parentheses: sin(x)^2, never sin^2 x.
- Functions: sin cos tan sec csc cot asin acos atan sinh cosh tanh sqrt(x) abs(x) exp(x) ln(x) log10(x). Constants: e, pi, Infinity.
- Derivative with respect to the problem variable: D(f). A second derivative is D(D(f)). A prime written by the student, such as (x^2)', is D(x^2).
- Limit as the problem variable goes to a: lim(f, a). One-sided: lim(f, a, 1) from the right, lim(f, a, -1) from the left. Limit in a different variable h: lim(f, h, a).
- Indefinite integral with respect to the problem variable: int(f). Definite integral from a to b: int(f, a, b). Write the constant of integration as + C.
- No LaTeX, no equals sign unless stated, no words.`;

  const TRANSCRIBE = `You transcribe a student's handwritten calculus work so that a separate program can check it.
Do NOT solve, correct, tidy or judge anything. Copy exactly what is written, including every mistake. If you fix an error the student will never find out about it.

Return one JSON object:
{
  "problem": { "text": string, "expr": string|null, "variable": string },
  "steps": [ { "expr": string|null, "latex": string, "role": "main"|"aside" } ],
  "note": string|null
}

problem.text: the task in plain words, e.g. "Differentiate x^2 sin x".
problem.expr: the quantity to be computed, in the syntax below, e.g. "D(x^2*sin(x))" or "lim(sin(3*x)/x, 0)". Use null when the task is not "compute this expression" (word problems, proofs, implicit differentiation, tangent lines, optimisation).
problem.variable: the single-letter variable, usually "x".

steps: the student's lines in order.
- role "main": a line that restates the whole answer so far, so it should be equal to the problem. expr is only the expression: drop prefixes such as "f'(x) =", "y' =", "dy/dx =" and leading equals signs. If one handwritten line is a chain a = b = c, output a separate step for each of a, b, c.
- role "aside": side work such as "u = x^2+1" or "u' = 2x". Where possible write it as one equation entirely in the problem variable using D(), e.g. "D(x^2+1) = 2*x". Otherwise set expr to null.
- latex: the line as written, in LaTeX, for display.
- Skip lines that are only words. If the student restates the problem as their first line, include it as a main step.

note: mention anything you could not read with confidence, otherwise null.

${SYNTAX}`;

  const DIAGNOSE = `You are a calculus tutor looking at one student's work. A deterministic checker has already evaluated every line numerically. Its verdict is final: do not dispute it, and do not re-derive which line is wrong.

Your job is to work out what the student did between the last correct line and the first wrong line, and to help them find it themselves.

Return one JSON object:
{
  "category": one of ${JSON.stringify(Object.keys(CATS))},
  "hint1": string,   // one question that directs their eyes to the right spot WITHOUT naming the rule or the fix
  "hint2": string,   // names the rule or idea involved and how it works in general. Still no corrected expression.
  "what": string,    // one or two sentences stating plainly what they did wrong. Do not write out the corrected line.
  "fix": { "expr": string },  // the corrected version of the first wrong line ONLY, in the syntax below, keeping the student's own form as far as possible
  "conceptual": boolean,      // true only if the error shows they misunderstand what the idea means, not a slip in execution
  "concept": string|null      // if conceptual: two or three sentences on what the idea actually means
}

Category meanings: sign = lost or flipped sign; algebra = expanding, factoring, fractions, exponents; chain = inner derivative missing or wrong; product_quotient = product/quotient rule structure wrong; basic_derivative = a standard derivative remembered wrongly; indeterminate = treated an indeterminate form as a value or substituted too early; lhopital = L'Hôpital applied when not allowed or applied as quotient rule; limit_law = split or combined limits illegitimately, bad arithmetic with infinity; identity = trig/exp/log identity wrong; copying = a term changed or vanished between lines; integration = substitution, integration by parts or an antiderivative applied wrongly; concept = misunderstanding of the idea itself; other = none of these.

Write to the student directly, briefly, in a calm and precise tone. No praise, no exclamation marks. Put any maths inside the strings between single dollar signs as LaTeX, e.g. "$\\\\cos(3x^2)$".

${SYNTAX}`;

  const NUDGE = `You are a calculus tutor. The student is partway through a problem and is stuck. A deterministic checker has confirmed that every line shown is correct so far. Help them take the next step themselves.

Return one JSON object:
{
  "hint1": string,  // one question that points at what to notice next, without naming the technique
  "hint2": string,  // names the technique or rule to use next and why it fits, without carrying it out
  "next": { "expr": string }  // the single next line only (not the final answer unless it is one step away), in the syntax below
}

Write briefly and calmly. No praise. Put maths between single dollar signs as LaTeX.

${SYNTAX}`;

  const READFN = 'You read one mathematical function from a photo so that it can be plotted. Return one JSON object: {"expr": string}. ' +
    'expr is only the right-hand side: for "y = x^2" return "x^2"; for "f(x, y) = x^2 - y^2" or "z = ..." return the expression in x and y. ' +
    'Rename the variables to x, and y for a second variable.\n\n' + SYNTAX;

  // ------------------------------------------------------------------ images
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Friendly('That photo could not be opened.')); };
      img.src = url;
    });
  }

  // ------------------------------------------------------------------ exercise logic
  const lastAttempt = (ex) => ex.attempts[ex.attempts.length - 1];

  function judge(steps, results) {
    if (results.some((r) => r === 'wrong')) return 'wrong';
    let last = -1;
    steps.forEach((s, i) => { if (s.role !== 'aside') last = i; });
    const finished = last >= 0 && results[last] === 'ok' && !/\b(D|lim|int)\s*\(/.test(steps[last].expr || '');
    return finished ? 'correct' : 'open';
  }

  function runCheck(draft) {
    const before = stats();
    const res = Engine.check(draft.problem, draft.steps);
    const attempt = {
      at: Date.now(), steps: draft.steps,
      results: res.results.map((r) => r.status), reasons: res.results.map((r) => r.reason),
      firstWrong: res.firstWrong, diagnosis: null, hintsShown: 0, nudge: null,
    };
    let ex = draft.exId && store.exercises.find((e) => e.id === draft.exId);
    if (!ex) {
      ex = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), attempts: [], redoAt: null };
      store.exercises.unshift(ex);
    }
    ex.problem = draft.problem;
    ex.attempts.push(attempt);
    ex.status = judge(attempt.steps, attempt.results);
    if (ex.status === 'wrong') ex.redoAt = Date.now() + 3 * DAY;
    else if (ex.status === 'correct' && ex.redoAt && Date.now() >= ex.redoAt) { ex.redoAt = null; ex.redoCleared = (ex.redoCleared || 0) + 1; }
    const after = stats();
    attempt.gain = Math.max(0, after.xp - before.xp);
    save();
    go({ name: 'result', exId: ex.id, fresh: { levelUp: after.level > before.level ? after.level : 0, newBest: after.best > before.best ? after.best : 0 } });
    if (ex.status === 'wrong') diagnose(ex, attempt);
  }

  function describe(ex, attempt) {
    const lines = attempt.steps.map((s, i) =>
      (i + 1) + '. [' + (s.role === 'aside' ? 'side work' : 'main') + '] ' + (s.expr || s.latex || '(unreadable)') + '   -> checker: ' + attempt.results[i]);
    return 'Problem: ' + (ex.problem.text || '') + '\nProblem expression: ' + (ex.problem.expr || '(none)') +
      '\nVariable: ' + (ex.problem.variable || 'x') + '\n\nStudent lines:\n' + lines.join('\n');
  }

  async function diagnose(ex, attempt) {
    attempt.diagnosing = true; attempt.diagError = null; refresh();
    try {
      const k = attempt.firstWrong;
      const d = await ai({
        system: DIAGNOSE, effort: 'high',
        user: describe(ex, attempt) + '\n\nThe first wrong line is line ' + (k + 1) + '. ' +
          (k === 0 ? 'It does not follow from the problem itself.' : 'Everything before it is correct.') + langNote(),
      });
      let verified = false;
      const fixExpr = d.fix && d.fix.expr;
      if (fixExpr) {
        const r = Engine.check(ex.problem, [{ role: attempt.steps[k].role, expr: fixExpr }]);
        verified = r.results[0].status === 'ok';
      }
      attempt.diagnosis = {
        category: CATS[d.category] ? d.category : 'other',
        hint1: d.hint1 || '', hint2: d.hint2 || '', what: d.what || '',
        fix: { expr: fixExpr || '', verified },
        conceptual: !!d.conceptual, concept: d.concept || '',
      };
    } catch (e) {
      attempt.diagError = e instanceof Friendly ? e.message : 'Something went wrong while asking for an explanation.';
    }
    attempt.diagnosing = false; save(); refresh();
  }

  async function nudge(ex, attempt) {
    attempt.nudging = true; attempt.nudgeError = null; refresh();
    try {
      const d = await ai({ system: NUDGE, effort: 'high', user: describe(ex, attempt) + '\n\nThe student is stuck after the last line.' + langNote() });
      let verified = false;
      const expr = d.next && d.next.expr;
      if (expr) verified = Engine.check(ex.problem, [{ role: 'main', expr }]).results[0].status === 'ok';
      attempt.nudge = { hint1: d.hint1 || '', hint2: d.hint2 || '', next: { expr: expr || '', verified }, shown: 0 };
    } catch (e) {
      attempt.nudgeError = e instanceof Friendly ? e.message : 'Something went wrong while asking for a hint.';
    }
    attempt.nudging = false; save(); refresh();
  }

  // ------------------------------------------------------------------ progress
  // Everything here is derived from the exercise history; nothing extra is stored.
  const RANKS = ['Cadet', 'Rookie', 'Operator', 'Specialist', 'Sharpshooter', 'Ace', 'Elite', 'Commander', 'Legend'];
  const rankOf = (level) => RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
  const statusOf = (a) => judge(a.steps, a.results);
  const okLines = (a) => a.results.filter((r) => r === 'ok').length;

  function exerciseXp(ex) {
    let xp = 10 * ex.attempts.reduce((best, a) => Math.max(best, okLines(a)), 0);
    let wasWrong = false, done = false;
    ex.attempts.forEach((a, i) => {
      const st = statusOf(a);
      if (st === 'correct' && !done) {
        done = true;
        xp += i === 0 ? 50 : 30;
        const prev = ex.attempts[i - 1];
        if (wasWrong && prev) xp += 10 * (3 - Math.min(3, prev.hintsShown || 0));
      }
      if (st === 'wrong') wasWrong = true;
    });
    return xp + 80 * (ex.redoCleared || 0);
  }

  function stats() {
    const xs = store.exercises;
    const xp = xs.reduce((sum, e) => sum + exerciseXp(e), 0);
    const level = Math.floor((1 + Math.sqrt(1 + 8 * xp / 100)) / 2);
    const base = 50 * level * (level - 1), next = 50 * level * (level + 1);
    const firstTry = (e) => e.attempts[0] && statusOf(e.attempts[0]) === 'correct';
    const solved = (e) => e.attempts.some((a) => statusOf(a) === 'correct');
    const week = (k) => {
      const hi = Date.now() - k * 7 * DAY, lo = hi - 7 * DAY;
      const set = xs.filter((e) => e.created > lo && e.created <= hi);
      const missed = set.flatMap((e) => e.attempts).filter((a) => a.diagnosis);
      return {
        solved: set.filter(solved).length,
        acc: set.length ? Math.round(100 * set.filter(firstTry).length / set.length) : null,
        hints: missed.length ? missed.reduce((sum, a) => sum + (a.hintsShown || 0), 0) / missed.length : null,
        xp: set.reduce((sum, e) => sum + exerciseXp(e), 0),
      };
    };
    const judged = xs.filter((e) => e.status !== 'open');
    let streak = 0;
    for (const e of judged) { if (firstTry(e)) streak++; else break; }
    let best = 0, run = 0;
    for (const e of judged) { if (firstTry(e)) { run++; best = Math.max(best, run); } else run = 0; }
    return {
      xp, level, rank: rankOf(level), into: xp - base, span: next - base, toNext: next - xp, streak, best,
      now: week(0), prev: week(1), weeks: [5, 4, 3, 2, 1, 0].map(week),
      total: xs.length, solved: xs.filter(solved).length,
      lines: xs.reduce((sum, e) => sum + e.attempts.reduce((b, a) => Math.max(b, okLines(a)), 0), 0),
      bounties: xs.reduce((sum, e) => sum + (e.redoCleared || 0), 0),
    };
  }

  function guessVar(expr) {
    const names = (Engine.normalise(expr || '').match(/[a-zA-Zθ]+/g) || []).filter((n) => n.length === 1 && !'eCD'.includes(n));
    for (const p of ['x', 't', 'y', 'u', 's', 'r', 'θ']) if (names.includes(p)) return p;
    return names[0] || 'x';
  }

  // ------------------------------------------------------------------ router
  let view = { name: 'home' };
  const SVG = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const ICONS = {
    home: SVG('<path d="M4 20l1-5L16 4l4 4L9 19l-5 1z"/><path d="M14 6l4 4"/>'),
    patterns: SVG('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
    sketch: SVG('<path d="M4 3v17h17"/><path d="M6 16c3 0 3.5-10 6.5-10S16 13 20 9"/>'),
    settings: SVG('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    progress: SVG('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
    keys: SVG('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>'),
    gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    camera: SVG('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  };
  const icon = (n) => h('span', { innerHTML: ICONS[n], 'aria-hidden': 'true', style: 'display:grid' });
  const ART = '<svg viewBox="0 0 320 96" fill="none" stroke-linecap="round"><path d="M100 82L220 2" stroke="#1d2145" stroke-width="3.5"/><path d="M16 84C90 80 150 60 200 8" stroke="#5b4bff" stroke-width="7"/><circle cx="160.6" cy="41.3" r="9" fill="#fff" stroke="#1d2145" stroke-width="4"/><path d="M262 28v16M254 36h16M290 64v10M285 69h10" stroke="#1d2145" stroke-width="3.5"/><circle cx="44" cy="26" r="7" fill="#ff7a59"/><circle cx="302" cy="22" r="5" fill="#12996a"/></svg>';
  const TABS = [['home', 'Play'], ['progress', 'Progress'], ['sketch', 'Sketch']];
  const FOCUS = new Set(['capture', 'working', 'confirm', 'result', 'redo', 'category', 'settings']);
  const BADGE = (level) => '<svg viewBox="0 0 64 64"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22e3ff"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs>' +
    '<path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill="#0b1230" stroke="url(#bg)" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M32 11l18 10.5v21L32 53 14 42.5v-21z" fill="url(#bg)" opacity="0.22"/>' +
    '<text x="32" y="41" text-anchor="middle" font-size="25" font-weight="800" font-family="system-ui" fill="#fff">' + level + '</text></svg>';
  const RETICLE = '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle class="spin" cx="40" cy="40" r="30" stroke-dasharray="34 13"/><circle cx="40" cy="40" r="17" opacity="0.6"/><path d="M40 2v14M40 64v14M2 40h14M64 40h14"/><circle cx="40" cy="40" r="3.5" fill="currentColor" stroke="none"/></svg>';

  function go(v) { view = v; refresh(); window.scrollTo(0, 0); }
  function refresh() {
    document.body.classList.toggle('focus', FOCUS.has(view.name));
    tabsEl.replaceChildren(...TABS.map(([name, label]) =>
      h('button', { 'aria-current': view.name === name ? 'page' : null, onclick: () => go({ name }) }, icon(name), label)));
    main.replaceChildren(...[].concat(VIEWS[view.name](view)).filter(Boolean));
  }
  const topbar = (label, onBack, right) => h('div', { class: 'topbar' }, h('button', { onclick: onBack }, '‹ ', label), right || h('span', {}));

  // ------------------------------------------------------------------ views
  const VIEWS = {};

  function deltaEl(now, prev, opts) {
    opts = opts || {};
    if (now == null || prev == null) return h('div', { class: 'delta' }, 'No data last week');
    const diff = now - prev;
    if (Math.abs(diff) < 0.05) return h('div', { class: 'delta' }, 'Same as last week');
    const good = opts.lowerBetter ? diff < 0 : diff > 0;
    const shown = (opts.decimals ? Math.abs(diff).toFixed(1) : Math.abs(Math.round(diff))) + (opts.suffix || '');
    return h('div', { class: 'delta ' + (good ? 'good' : 'bad') }, (diff > 0 ? '▲ +' : '▼ −') + shown + ' vs last week');
  }
  const tile = (label, value, extra) => h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value' }, value), extra);

  function hud(st) {
    return h('div', { class: 'hud' },
      h('div', { class: 'badge', innerHTML: BADGE(st.level), role: 'img', 'aria-label': 'Level ' + st.level }),
      h('div', { class: 'hud-main' },
        h('div', { class: 'rank' }, st.rank, h('span', {}, ' · Level ' + st.level)),
        h('div', { class: 'xpbar' }, h('i', { style: 'width:' + Math.max(3, Math.round(100 * st.into / st.span)) + '%' })),
        h('div', { class: 'xpnote' }, st.xp + ' XP · ' + st.toNext + ' to level ' + (st.level + 1))));
  }

  VIEWS.home = () => {
    const now = Date.now();
    const st = stats();
    const due = store.exercises.filter((e) => e.redoAt && e.redoAt <= now);
    const later = store.exercises.filter((e) => e.redoAt && e.redoAt > now).length;
    const focus = topPattern(21);
    const recent = store.exercises.slice(0, 6);
    const typed = () => go({ name: 'confirm', draft: { exId: null, problem: { text: '', expr: '', variable: 'x' }, steps: [], note: null, autoOpen: true } });
    return [
      h('div', { class: 'toprow' }, hud(st),
        h('button', { class: 'gear', 'aria-label': 'Settings', onclick: () => go({ name: 'settings' }) }, icon('gear'))),
      !store.settings.key && h('div', { class: 'notice' }, 'Scanning needs your DeepSeek API key. ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); go({ name: 'settings' }); } }, 'Add it in settings.')),
      !storageOk && h('div', { class: 'notice bad' }, 'Your history could not be saved on this device. Export a backup from settings.'),

      h('button', { class: 'scan', onclick: () => pickPhotos(() => go({ name: 'capture' })) },
        h('span', { class: 'reticle', innerHTML: RETICLE, 'aria-hidden': 'true' }),
        h('span', { class: 'scan-text' }, h('span', { class: 'scan-title' }, 'Scan my work'), h('span', { class: 'scan-sub' }, 'Photograph your solution and find the miss'))),
      h('button', { class: 'btn', style: 'margin-top:10px', onclick: typed }, icon('keys'), 'Use the math keyboard'),

      h('h2', {}, 'You vs last week'),
      h('div', { class: 'grid' },
        tile('Solved', st.now.solved, deltaEl(st.now.solved, st.prev.solved)),
        tile('First-try accuracy', st.now.acc == null ? '—' : st.now.acc + '%', deltaEl(st.now.acc, st.prev.acc, { suffix: ' pts' })),
        tile('Clean streak', st.streak, h('div', { class: 'delta' }, 'Your best: ' + st.best)),
        tile('Hints per miss', st.now.hints == null ? '—' : st.now.hints.toFixed(1), deltaEl(st.now.hints, st.prev.hints, { lowerBetter: true, decimals: true }))),

      !store.exercises.length ? h('h2', {}, 'How it works') : null,
      !store.exercises.length ? h('div', { class: 'list' }, [['1', 'Solve an exercise on paper.'], ['2', 'Scan it. Every line is checked by calculation.'], ['3', 'Fix the miss with as few hints as you can to earn more XP.']].map(([n, text]) =>
        h('div', { class: 'item' }, h('span', { class: 'num' }, n), h('div', { class: 'grow' }, text)))) : null,

      due.length ? h('h2', {}, 'Bounties: beat your past self') : null,
      due.length ? h('div', { class: 'list' }, due.map((ex) =>
        h('button', { class: 'item', onclick: () => go({ name: 'redo', exId: ex.id }) },
          h('div', { class: 'grow' }, problemEl(ex.problem)), h('span', { class: 'pill gold' }, '+80 XP')))) : null,
      later ? h('p', { class: 'muted small', style: 'margin-top:10px' }, later + (later === 1 ? ' bounty unlocks' : ' bounties unlock') + ' in the next few days.') : null,

      focus ? h('h2', {}, 'Your nemesis') : null,
      focus ? h('button', { class: 'card nemesis', onclick: () => go({ name: 'category', id: focus.id }) },
        h('div', { class: 'nemesis-name' }, CATS[focus.id].name), h('div', { class: 'muted' }, 'Hit you ' + focus.n + ' times in the last three weeks.', ' ', CATS[focus.id].advice)) : null,

      recent.length ? h('h2', {}, 'Mission log') : null,
      recent.length ? h('div', { class: 'list' }, recent.map(exerciseItem)) : null,
    ];
  };

  function exerciseItem(ex) {
    const label = { correct: 'Cleared', wrong: 'Miss · line ' + ((lastAttempt(ex).firstWrong | 0) + 1), open: 'Open' }[ex.status] || '';
    return h('button', { class: 'item', onclick: () => go({ name: 'result', exId: ex.id }) },
      h('div', { class: 'grow' }, problemEl(ex.problem), h('div', { class: 'muted small' }, fmtDate(ex.created))),
      h('span', { class: 'pill ' + ex.status }, label));
  }

  VIEWS.redo = (v) => {
    const ex = store.exercises.find((e) => e.id === v.exId);
    if (!ex) return VIEWS.home();
    return [
      topbar('Back', () => go({ name: 'home' })),
      h('h1', {}, 'Try this one again'),
      h('p', { class: 'lede' }, 'You made a mistake here before. Solve it from scratch on paper without looking at your old work.'),
      h('div', { class: 'card' }, problemEl(ex.problem)),
      h('div', { class: 'stack', style: 'margin-top:20px' },
        h('button', { class: 'btn primary', onclick: () => go({ name: 'capture', exId: ex.id }) }, 'Photograph my new solution'),
        h('button', { class: 'btn quiet', onclick: () => { ex.redoAt = null; save(); go({ name: 'home' }); } }, 'Remove from the redo list')),
    ];
  };

  // ---- capture
  let shots = [];
  function pickPhotos(done) {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', onchange: async (e) => {
      for (const file of e.target.files) { try { shots.push(await shrink(file)); } catch (err) { alert(tr(err.message)); } }
      input.remove();
      done();
    } });
    document.body.append(input);
    input.click();
  }
  VIEWS.capture = (v) => {
    const ex = v.exId && store.exercises.find((e) => e.id === v.exId);
    const problemInput = h('input', { type: 'text', placeholder: 'e.g. differentiate x² sin x', value: v.text || '', oninput: (e) => { v.text = e.target.value; } });
    const read = async () => {
      const images = shots.slice();
      go({ name: 'working', message: 'Reading your handwriting…' });
      try {
        const known = ex ? 'The problem is already known: ' + (ex.problem.text || ex.problem.expr) + ' (expression: ' + ex.problem.expr + '). Transcribe the solution lines.' :
          (v.text ? 'The student typed the problem as: ' + v.text : 'The problem statement is in the photo.');
        const t = await ai({ system: TRANSCRIBE, images, effort: 'low', user: known + '\nReturn the JSON transcription.' });
        const p = t.problem || {};
        shots = [];
        go({ name: 'confirm', draft: {
          exId: ex ? ex.id : null,
          problem: ex ? ex.problem : { text: p.text || v.text || '', expr: p.expr || '', variable: (p.variable || 'x').trim().slice(0, 1) || 'x' },
          steps: (t.steps || []).map((s) => ({ expr: s.expr || '', latex: s.latex || '', role: s.role === 'aside' ? 'aside' : 'main' })),
          note: t.note || null,
        } });
      } catch (e) {
        go({ name: 'capture', exId: v.exId, text: v.text, error: e instanceof Friendly ? e.message : 'Something went wrong while reading the photo.' });
      }
    };
    return [
      topbar('Cancel', () => { shots = []; go({ name: 'home' }); }),
      h('h1', {}, ex ? 'New attempt' : (shots.length ? 'Looks good?' : 'Check my work')),
      h('p', { class: 'lede' }, 'Hold the phone straight above the page, in good light.'),
      v.error && h('div', { class: 'notice bad' }, v.error),
      ex ? h('div', { class: 'card' }, problemEl(ex.problem)) : h('label', { class: 'field' }, h('span', {}, 'Problem (leave empty if it is in the photo)'), problemInput),
      shots.length ? h('div', { class: 'thumbs' }, shots.map((src, i) => h('div', { class: 'thumb' }, h('img', { src, alt: 'Page ' + (i + 1) }),
        h('button', { 'aria-label': 'Remove page ' + (i + 1), onclick: () => { shots.splice(i, 1); refresh(); } }, '×')))) : null,
      h('div', { class: 'stack', style: 'margin-top:16px' },
        h('button', { class: 'btn' + (shots.length ? '' : ' primary'), onclick: () => pickPhotos(refresh) }, shots.length ? 'Add another page' : [icon('camera'), 'Take a photo']),
        shots.length ? h('button', { class: 'btn primary big', onclick: read }, 'Check it') : null,
        h('button', { class: 'btn quiet', onclick: () => {
          shots = [];
          go({ name: 'confirm', draft: { exId: ex ? ex.id : null, problem: ex ? ex.problem : { text: v.text || '', expr: '', variable: 'x' }, steps: [], note: null } });
        } }, 'Type the lines instead')),
      h('p', { class: 'muted small', style: 'margin-top:18px' }, 'Photos are sent to DeepSeek to be read and are not kept in the app.'),
    ];
  };

  VIEWS.working = (v) => h('div', { class: 'working' }, h('div', { class: 'dots' }, h('i', {}), h('i', {}), h('i', {})), h('div', {}, v.message));

  // ---- confirm
  VIEWS.confirm = (v) => {
    const d = v.draft, variable = d.problem.variable || 'x';
    if (d.autoOpen) { d.autoOpen = false; setTimeout(() => editProblem(), 0); }
    const editProblem = () => editor({
      title: 'The problem', expr: d.problem.expr, variable, isProblem: true,
      help: 'Start with d/dx, ∫ or lim, then type what goes inside.',
      onSave: (expr) => { d.problem.expr = expr; d.problem.variable = guessVar(expr); refresh(); },
    });
    const editStep = (i) => editor({
      title: 'Line ' + (i + 1), expr: d.steps[i].expr, variable, role: d.steps[i].role,
      onSave: (expr, opts) => { d.steps[i] = { expr, latex: '', role: opts.role }; refresh(); },
      onDelete: () => { d.steps.splice(i, 1); refresh(); },
    });
    const addStep = () => editor({
      title: 'New line', expr: '', variable, role: 'main',
      onSave: (expr, opts) => { if (expr.trim()) { d.steps.push({ expr, latex: '', role: opts.role }); refresh(); } },
    });
    const unreadable = d.steps.filter((s) => { try { Engine.parse(s.expr, variable); return false; } catch (e) { return true; } }).length;
    return [
      topbar('Cancel', () => go({ name: 'home' })),
      h('h1', {}, 'Is this what you wrote?'),
      h('p', { class: 'lede' }, 'Tap any line to correct it. The check is only as good as this transcription.'),
      d.note && h('div', { class: 'notice' }, 'Unsure about:', ' ' + d.note),
      h('div', { class: 'steps' },
        h('button', { class: 'step problem', onclick: d.exId ? null : editProblem, disabled: !!d.exId },
          h('span', { class: 'n' }, ''),
          h('div', { class: 'body' }, d.problem.expr ? problemEl(d.problem) : h('div', { class: 'muted' }, d.problem.text || 'Tap to enter the problem'),
            h('div', { class: 'tag' }, d.problem.expr ? 'Problem' : 'Problem — not in a form I can check. Tap to enter it.'))),
        d.steps.map((s, i) => h('button', { class: 'step', onclick: () => editStep(i) },
          h('span', { class: 'n' }, i + 1),
          h('div', { class: 'body' }, mathEl(stepTex(s, variable)), s.role === 'aside' ? h('div', { class: 'tag' }, 'Side work') : null)))),
      h('div', { class: 'stack', style: 'margin-top:14px' },
        h('button', { class: 'btn', onclick: addStep }, 'Add a line'),
        unreadable ? h('div', { class: 'notice' }, unreadable + (unreadable === 1 ? ' line is' : ' lines are') + ' not in a form that can be checked. Tap to fix, or continue and it will be skipped.') : null,
        h('button', { class: 'btn primary', disabled: !d.steps.length, onclick: () => runCheck(d) }, 'Check it')),
    ];
  };

  // label, text to insert ("|" marks where the cursor lands), style
  const PAD = [
    ['d/dx', 'D(|)', 'fn'], ['∫', 'int(|)', 'fn'], ['lim', 'lim(|, 0)', 'fn'], ['√', 'sqrt(|)', 'fn'], ['xⁿ', '^', 'fn'], ['⌫', '<bs>', 'act'],
    ['sin', 'sin(|)', 'fn'], ['cos', 'cos(|)', 'fn'], ['tan', 'tan(|)', 'fn'], ['ln', 'ln(|)', 'fn'], ['log', 'log10(|)', 'fn'], ['e', 'e', 'fn'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '/', 'op'], ['(', '(', 'op'], [')', ')', 'op'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['×', '*', 'op'], ['x', 'x', 'var'], ['y', 'y', 'var'],
    ['1', '1'], ['2', '2'], ['3', '3'], ['−', '-', 'op'], ['π', 'pi', 'var'], ['∞', 'Infinity', 'var'],
    ['0', '0'], ['.', '.'], [',', ', ', 'op'], ['+', '+', 'op'], ['=', ' = ', 'op'], ['abc', '<abc>', 'act'],
  ];
  const TOKEN = /(Infinity|log10\(|sqrt\(|sin\(|cos\(|tan\(|int\(|lim\(|ln\(|D\(|pi| = |, )$/;

  function editor(o) {
    const preview = h('div', { class: 'preview' });
    const input = h('input', { type: 'text', class: 'mono', value: o.expr || '', inputMode: 'none', autocapitalize: 'off', autocorrect: 'off', spellcheck: false, 'aria-label': 'Expression' });
    const aside = o.role ? h('input', { type: 'checkbox', checked: o.role === 'aside' }) : null;
    const show = () => {
      preview.replaceChildren();
      if (!input.value.trim()) { preview.append(h('span', { class: 'muted' }, 'Your maths appears here')); return; }
      try { preview.append(mathEl(Engine.tex(input.value, o.isProblem ? guessVar(input.value) : o.variable))); }
      catch (e) { preview.append(h('span', { class: 'muted' }, 'Keep typing…')); }
    };
    const caret = (p) => { input.focus(); try { input.setSelectionRange(p, p); } catch (e) { /* not focusable yet */ } };
    const mathKeys = h('button', { class: 'btn quiet', hidden: true, onclick: () => { input.inputMode = 'none'; pad.hidden = false; mathKeys.hidden = true; input.blur(); caret(input.value.length); } }, 'Back to the math keys');
    const press = (ins) => {
      const v = input.value;
      let a = input.selectionStart == null ? v.length : input.selectionStart;
      const b = input.selectionEnd == null ? a : input.selectionEnd;
      if (ins === '<abc>') { input.inputMode = 'text'; pad.hidden = true; mathKeys.hidden = false; input.blur(); caret(a); return; }
      if (ins === '<bs>') {
        if (a === b) { const m = v.slice(0, a).match(TOKEN); a -= m ? m[0].length : Math.min(1, a); }
        input.value = v.slice(0, a) + v.slice(b); caret(a);
      } else {
        const at = ins.indexOf('|'), text = ins.replace('|', '');
        input.value = v.slice(0, a) + text + v.slice(b);
        caret(a + (at < 0 ? text.length : at));
      }
      show();
    };
    const pad = h('div', { class: 'pad' }, PAD.map(([label, ins, kind]) =>
      h('button', { class: 'key ' + (kind || 'num'), type: 'button', onpointerdown: (e) => e.preventDefault(), onclick: () => press(ins) }, label)));
    input.addEventListener('input', show); show();
    const close = () => sheetRoot.replaceChildren();
    const done = () => { close(); o.onSave(input.value.trim(), { role: aside && aside.checked ? 'aside' : 'main' }); };
    sheetRoot.replaceChildren(h('div', { class: 'scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': o.title },
        h('div', { class: 'sheet-head' }, h('h3', {}, o.title), o.onDelete ? h('button', { class: 'linkbtn', onclick: () => { close(); o.onDelete(); } }, 'Delete') : null),
        preview, input,
        h('p', { class: 'muted small', style: 'margin:6px 0 8px' }, o.help || 'Tap inside the box to move the cursor.'),
        mathKeys, pad,
        aside ? h('label', { class: 'check' }, aside, 'This line is side work') : null,
        h('button', { class: 'btn primary', style: 'margin-top:10px', onclick: done }, 'Done'))));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    caret(input.value.length);
  }

  // ---- result
  const MARK = { ok: '✓', wrong: '✕', unverified: '?' };
  VIEWS.result = (v) => {
    const ex = store.exercises.find((e) => e.id === v.exId);
    if (!ex) return VIEWS.home();
    const at = lastAttempt(ex), variable = ex.problem.variable || 'x';
    const k = at.firstWrong;
    const okCount = at.results.filter((r) => r === 'ok').length;
    const unv = at.results.filter((r) => r === 'unverified').length;
    const verdict = ex.status === 'wrong' ? 'Miss on line ' + (k + 1)
      : ex.status === 'correct' ? 'All lines hit'
      : okCount ? 'On target so far' : 'Nothing here could be checked.';
    const sub = ex.status === 'wrong' ? (k === 0 ? 'It does not follow from the problem.' : (k === 1 ? 'Line 1 is fine' : 'Lines 1–' + k + ' are fine') + '. Look at how you got from line ' + k + ' to line ' + (k + 1) + '.')
      : okCount + (okCount === 1 ? ' line' : ' lines') + ' verified by calculation' + (unv ? ', ' + unv + ' could not be checked.' : '.');

    const out = [
      topbar('Done', () => go({ name: 'home' }), h('button', { onclick: () => { if (confirm(tr('Delete this exercise from your history?'))) { store.exercises = store.exercises.filter((e) => e !== ex); save(); go({ name: 'home' }); } } }, 'Delete')),
      h('div', { class: 'banner ' + ex.status }, h('div', { class: 'verdict' }, verdict), h('p', {}, sub),
        (() => {
          let combo = 0, run = 0;
          at.results.forEach((r) => { run = r === 'ok' ? run + 1 : 0; combo = Math.max(combo, run); });
          const fresh = v.fresh || {};
          const rewards = [at.gain ? '+' + at.gain + ' XP' : null, combo >= 2 ? 'Combo ×' + combo : null,
            fresh.levelUp ? 'Level up! · ' + rankOf(fresh.levelUp) + ' · ' + fresh.levelUp : null, fresh.newBest > 1 ? 'New best streak: ' + fresh.newBest : null].filter(Boolean);
          return rewards.length ? h('div', { class: 'rewards' }, rewards.map((r, i) => h('span', { class: 'reward', style: 'animation-delay:' + (i * 0.14) + 's' }, r))) : null;
        })()),
      h('div', { class: 'steps' },
        h('div', { class: 'step problem' }, h('span', { class: 'n' }, ''), h('div', { class: 'body' }, problemEl(ex.problem), h('div', { class: 'tag' }, 'Problem'))),
        at.steps.map((s, i) => h('div', { class: 'step' + (i === k ? ' first-wrong' : '') + (k >= 0 && i > k ? ' after' : '') },
          h('span', { class: 'n' }, i + 1),
          h('div', { class: 'body' }, mathEl(stepTex(s, variable)),
            (s.role === 'aside' || (at.results[i] === 'unverified' && at.reasons && at.reasons[i])) ?
              h('div', { class: 'tag' }, [s.role === 'aside' ? 'Side work' : null, at.results[i] === 'unverified' ? at.reasons[i] : null].filter(Boolean).join(' · ')) : null),
          h('span', { class: 'mark ' + at.results[i], role: 'img', 'aria-label': at.results[i] }, MARK[at.results[i]])))),
    ];

    if (ex.status === 'wrong') out.push(diagPanel(ex, at));
    if (ex.status === 'open' && okCount) out.push(nudgePanel(ex, at));

    out.push(h('div', { class: 'stack', style: 'margin-top:22px' },
      ex.status !== 'correct' ? h('button', { class: 'btn primary', onclick: () => go({ name: 'capture', exId: ex.id }) }, ex.status === 'wrong' ? 'Photograph my corrected work' : 'Photograph the rest') : null,
      ex.status === 'wrong' ? h('p', { class: 'muted small', style: 'text-align:center' }, 'Fix it now for bonus XP: the fewer hints you open, the bigger the bonus. It also returns as a bounty in three days.') : null));
    return out;
  };

  function diagPanel(ex, at) {
    const d = at.diagnosis;
    if (at.diagnosing) return h('div', { class: 'diag' }, h('div', { class: 'dots', style: 'margin-bottom:10px' }, h('i', {}), h('i', {}), h('i', {})), h('div', { style: 'text-align:center' }, 'Working out what happened on that line…'));
    if (!d) return h('div', { class: 'diag' },
      h('p', {}, at.diagError || 'No explanation yet.'),
      h('button', { class: 'btn', onclick: () => diagnose(ex, at) }, 'Ask for an explanation'));
    const lvl = at.hintsShown || 0;
    const variable = ex.problem.variable || 'x';
    const parts = [h('div', { class: 'label' }, 'Look here'), h('div', {}, rich(d.hint1))];
    if (lvl >= 1) parts.push(h('div', { class: 'label' }, 'The idea'), h('div', {}, rich(d.hint2)));
    if (lvl >= 2) {
      parts.push(h('div', { class: 'label' }, 'What happened'), h('div', {}, h('span', { class: 'chip' }, CATS[d.category].name)), h('div', { style: 'margin-top:8px' }, rich(d.what)));
      if (d.conceptual && d.concept) parts.push(h('div', { class: 'label' }, 'What it means'), h('div', {}, rich(d.concept)));
    }
    if (lvl >= 3) {
      parts.push(h('div', { class: 'label' }, 'Corrected line'));
      parts.push(d.fix.verified ? h('div', {}, mathEl(stepTex({ expr: d.fix.expr }, variable)), h('div', { class: 'muted small' }, 'Verified by calculation.'))
        : h('div', { class: 'muted' }, 'The AI’s correction did not pass the check, so it is not shown. Use the hints above.'));
    }
    const next = ['Another hint', 'Show what went wrong', 'Show the corrected line'][lvl];
    return h('div', {},
      h('div', { class: 'diag' }, parts),
      next ? h('button', { class: 'btn', onclick: () => { at.hintsShown = lvl + 1; save(); refresh(); } }, next) : null,
      lvl === 0 ? h('p', { class: 'muted small', style: 'margin-top:10px;text-align:center' }, 'Try to fix it on paper before asking for more.') : null);
  }

  function nudgePanel(ex, at) {
    const n = at.nudge;
    if (at.nudging) return h('div', { class: 'diag calm' }, h('span', { class: 'muted' }, 'Thinking about your next step…'));
    if (!n) return h('div', { style: 'margin-top:18px' },
      at.nudgeError ? h('div', { class: 'notice bad' }, at.nudgeError) : null,
      h('button', { class: 'btn', onclick: () => nudge(ex, at) }, 'I’m stuck — give me a nudge'));
    const parts = [h('div', { class: 'label' }, 'Notice'), h('div', {}, rich(n.hint1))];
    if (n.shown >= 1) parts.push(h('div', { class: 'label' }, 'The idea'), h('div', {}, rich(n.hint2)));
    if (n.shown >= 2) {
      parts.push(h('div', { class: 'label' }, 'Next line'));
      parts.push(n.next.verified ? h('div', {}, mathEl(stepTex({ expr: n.next.expr }, ex.problem.variable || 'x')), h('div', { class: 'muted small' }, 'Verified by calculation.'))
        : h('div', { class: 'muted' }, 'The AI’s suggested line did not pass the check, so it is not shown.'));
    }
    const next = ['Another hint', 'Show the next line'][n.shown];
    return h('div', {}, h('div', { class: 'diag calm' }, parts),
      next ? h('button', { class: 'btn', onclick: () => { n.shown++; save(); refresh(); } }, next) : null);
  }

  // ---- patterns
  function mistakes(sinceDays) {
    const since = sinceDays ? Date.now() - sinceDays * DAY : 0;
    const out = [];
    store.exercises.forEach((ex) => ex.attempts.forEach((a) => {
      if (a.diagnosis && a.at >= since) out.push({ ex, a, id: a.diagnosis.category });
    }));
    return out;
  }
  function topPattern(days) {
    const counts = {};
    mistakes(days).forEach((m) => { if (m.id !== 'other') counts[m.id] = (counts[m.id] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 2 ? { id: top[0], n: top[1] } : null;
  }

  VIEWS.progress = () => {
    const st = stats();
    const all = mistakes(0), recent = mistakes(30);
    const counts = {};
    all.forEach((m) => { (counts[m.id] = counts[m.id] || { all: 0, recent: 0 }).all++; });
    recent.forEach((m) => { counts[m.id].recent++; });
    const rows = Object.entries(counts).sort((a, b) => b[1].recent - a[1].recent || b[1].all - a[1].all);
    const max = Math.max(1, ...rows.map((r) => r[1].all));
    const top = Math.max(1, ...st.weeks.map((w) => w.xp));
    const depth = all.length ? (all.reduce((sum, m) => sum + (m.a.hintsShown || 0), 0) / all.length) : null;
    const nextRankLevel = (Math.floor((st.level - 1) / 2) + 1) * 2 + 1;
    return [
      h('div', { class: 'card levelcard' }, hud(st),
        h('p', { class: 'muted small', style: 'margin:12px 0 0' }, st.rank === RANKS[RANKS.length - 1] ? 'Top rank reached.' : 'Next rank at level ' + nextRankLevel + ':', ' ', rankOf(nextRankLevel))),
      h('h2', {}, 'XP per week'),
      h('div', { class: 'card chart' }, st.weeks.map((w, i) => h('div', { class: 'col' },
        h('div', { class: 'val' }, w.xp || ''),
        h('div', { class: 'colbar' + (i === 5 ? ' now' : ''), style: 'height:' + Math.max(3, Math.round(100 * w.xp / top)) + '%' }),
        h('div', { class: 'lab' }, i === 5 ? 'Now' : (5 - i) + 'w ago')))),
      h('h2', {}, 'Personal records'),
      h('div', { class: 'grid' },
        tile('Best clean streak', st.best, h('div', { class: 'delta' }, 'Current: ' + st.streak)),
        tile('Exercises cleared', st.solved, h('div', { class: 'delta' }, 'of ' + st.total + ' scanned')),
        tile('Lines verified', st.lines, h('div', { class: 'delta' }, '10 XP each')),
        tile('Bounties claimed', st.bounties, h('div', { class: 'delta' }, '80 XP each'))),
      h('h2', {}, 'Your nemeses'),
      rows.length ? h('div', { class: 'list' }, rows.map(([id, c]) =>
        h('button', { class: 'bar-row', onclick: () => go({ name: 'category', id }) },
          h('div', { class: 'head' }, h('span', {}, CATS[id].name), h('span', { class: 'muted small' }, c.all + ' hits · ' + c.recent + ' this month')),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(100 * c.all / max) + '%' })))))
        : h('div', { class: 'card muted' }, 'No mistakes recorded yet. The kinds of mistakes you make will be tracked here so you can hunt them down.'),
      depth != null ? h('h2', {}, 'Hints per miss') : null,
      depth != null ? h('div', { class: 'card' }, h('span', { class: 'tile-value' }, depth.toFixed(1)), h('span', { class: 'muted' }, ' of 3 on average. Lower means you are finding your own errors.')) : null,
    ];
  };

  VIEWS.category = (v) => {
    const list = mistakes(0).filter((m) => m.id === v.id).sort((a, b) => b.a.at - a.a.at);
    return [
      topbar('Progress', () => go({ name: 'progress' })),
      h('h1', {}, CATS[v.id].name),
      h('p', { class: 'lede' }, CATS[v.id].advice),
      h('div', { class: 'list' }, list.map((m) => h('button', { class: 'item', onclick: () => go({ name: 'result', exId: m.ex.id }) },
        h('div', { class: 'grow' }, problemEl(m.ex.problem), h('div', { class: 'muted small' }, rich(m.a.diagnosis.what))),
        h('span', { class: 'meta' }, fmtDate(m.a.at))))),
    ];
  };

  // ---- function sketcher
  const RAMP = [[34, 227, 255], [122, 92, 255], [255, 61, 129]];
  const ramp = (t) => {
    t = Math.max(0, Math.min(1, t)) * 2;
    const i = Math.min(1, Math.floor(t)), u = t - i, a = RAMP[i], b = RAMP[i + 1];
    return 'rgb(' + a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',') + ')';
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const tidy = (n) => String(Number(n.toPrecision(3)));
  function fitCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, hgt = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    return { g, w, H: hgt };
  }

  function draw2d(canvas, f, s) {
    const { g, w, H } = fitCanvas(canvas);
    if (!w) return;
    const X = (x) => w / 2 + (x - s.cx) * s.scale, Y = (y) => H / 2 - (y - s.cy) * s.scale;
    const x0 = s.cx - w / 2 / s.scale, x1 = s.cx + w / 2 / s.scale, y0 = s.cy - H / 2 / s.scale, y1 = s.cy + H / 2 / s.scale;
    const raw = 64 / s.scale, pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].find((k) => k * pow >= raw) * pow;
    g.font = '600 12px system-ui'; g.fillStyle = cssVar('--muted'); g.lineWidth = 1; g.strokeStyle = cssVar('--line');
    const ax = Math.max(4, Math.min(w - 30, X(0) + 5)), ay = Math.max(14, Math.min(H - 6, Y(0) + 15));
    g.beginPath();
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { g.moveTo(X(x), 0); g.lineTo(X(x), H); if (Math.abs(x) > step / 2) g.fillText(tidy(x), X(x) + 3, ay); }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); if (Math.abs(y) > step / 2) g.fillText(tidy(y), ax, Y(y) - 4); }
    g.stroke();
    g.strokeStyle = cssVar('--muted'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
    g.fillText('x', w - 12, Math.max(14, Math.min(H - 6, Y(0) - 6))); g.fillText('y', Math.max(4, Math.min(w - 14, X(0) - 14)), 14);
    g.strokeStyle = cssVar('--cyan'); g.lineWidth = 3; g.lineJoin = 'round'; g.shadowColor = cssVar('--cyan'); g.shadowBlur = 10;
    g.beginPath();
    let pen = false, last = 0;
    for (let px = 0; px <= w; px += 0.5) {
      const y = f(x0 + px / s.scale);
      if (!Number.isFinite(y)) { pen = false; continue; }
      const sy = Math.max(-5000, Math.min(5000, Y(y)));
      if (pen && Math.abs(sy - last) < H) g.lineTo(px, sy); else g.moveTo(px, sy);
      pen = true; last = sy;
    }
    g.stroke(); g.shadowBlur = 0;
  }

  const GRID = 30;
  function sample3d(f, s) {
    const zs = [];
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) zs.push(f(-s.range + 2 * s.range * i / GRID, -s.range + 2 * s.range * j / GRID));
    const finite = zs.filter(Number.isFinite).sort((a, b) => a - b);
    const lo = finite.length ? finite[Math.floor(finite.length * 0.03)] : -1, hi = finite.length ? finite[Math.ceil(finite.length * 0.97) - 1] : 1;
    s.grid = { zs, lo, hi: hi - lo < 1e-9 ? lo + 1 : hi };
  }
  function draw3d(canvas, f, s) {
    const { g, w, H } = fitCanvas(canvas);
    if (!w) return;
    if (!s.grid) sample3d(f, s);
    const { zs, lo, hi } = s.grid, size = Math.min(w, H) * 0.29;
    const ca = Math.cos(s.yaw), sa = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const project = (X, Y, Z) => {
      const xr = X * ca - Y * sa, yr = X * sa + Y * ca;
      return [w / 2 + xr * size, H / 2 + 10 - (Z * cp + yr * sp) * size, yr * cp - Z * sp];
    };
    const zn = (z) => (Math.max(lo, Math.min(hi, z)) - lo) / (hi - lo);
    const pts = zs.map((z, n) => {
      const i = n % (GRID + 1), j = Math.floor(n / (GRID + 1));
      return Number.isFinite(z) ? project(-1 + 2 * i / GRID, -1 + 2 * j / GRID, (zn(z) - 0.5) * 1.1) : null;
    });
    // floor frame and axes behind the surface
    const corner = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => project(x, y, -0.55));
    g.strokeStyle = cssVar('--line'); g.lineWidth = 1.5;
    g.beginPath(); corner.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
    const quads = [];
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const a = pts[j * (GRID + 1) + i], b = pts[j * (GRID + 1) + i + 1], c = pts[(j + 1) * (GRID + 1) + i + 1], d = pts[(j + 1) * (GRID + 1) + i];
      if (!a || !b || !c || !d) continue;
      const z = (zs[j * (GRID + 1) + i] + zs[(j + 1) * (GRID + 1) + i + 1]) / 2;
      quads.push({ a, b, c, d, depth: (a[2] + b[2] + c[2] + d[2]) / 4, t: zn(z) });
    }
    quads.sort((p, q) => q.depth - p.depth);
    g.lineWidth = 0.7; g.strokeStyle = 'rgba(6, 10, 24, 0.55)';
    quads.forEach((q) => {
      g.fillStyle = ramp(q.t); g.globalAlpha = 0.92;
      g.beginPath(); g.moveTo(q.a[0], q.a[1]); g.lineTo(q.b[0], q.b[1]); g.lineTo(q.c[0], q.c[1]); g.lineTo(q.d[0], q.d[1]); g.closePath(); g.fill(); g.stroke();
    });
    g.globalAlpha = 1; g.font = '700 15px system-ui'; g.fillStyle = cssVar('--ink'); g.strokeStyle = cssVar('--muted'); g.lineWidth = 2;
    const o = project(-1, -1, -0.55);
    [['x', project(1.18, -1, -0.55)], ['y', project(-1, 1.18, -0.55)], ['z', project(-1, -1, 0.75)]].forEach(([name, p]) => {
      g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(p[0], p[1]); g.stroke();
      g.fillText(name, p[0] + (p[0] >= o[0] ? 5 : -14), p[1] + 5);
    });
  }

  let sketch = { expr: '', s2: null, s3: null };
  function setSketch(expr) {
    expr = String(expr || '').split('=').pop().trim();
    sketch = { expr, s2: { cx: 0, cy: 0, scale: 40 }, s3: { yaw: 0.75, pitch: 0.55, range: 3, grid: null } };
    try {
      Engine.fn(expr, ['x', 'y'])(0.3, 0.4);
      store.sketches = [expr].concat(store.sketches.filter((e) => e !== expr)).slice(0, 6); save();
    } catch (e) { /* shown as an error in the view */ }
    go({ name: 'sketch' });
  }

  function interact(canvas, mode, s, redraw) {
    const touches = new Map();
    let gap = 0;
    const spread = () => { const p = [...touches.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
    const zoom = (k) => {
      if (mode === '2d') s.scale = Math.max(2, Math.min(4000, s.scale * k));
      else { s.range = Math.max(0.25, Math.min(50, s.range / k)); s.grid = null; }
    };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) gap = spread(); });
    canvas.addEventListener('pointermove', (e) => {
      const p = touches.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (touches.size === 1) {
        if (mode === '2d') { s.cx -= dx / s.scale; s.cy += dy / s.scale; }
        else { s.yaw += dx * 0.012; s.pitch = Math.max(0.1, Math.min(1.5, s.pitch + dy * 0.012)); }
      } else if (touches.size === 2) {
        const now = spread();
        if (gap > 0 && now > 0) zoom(now / gap);
        gap = now;
      }
      redraw();
    });
    const end = (e) => { touches.delete(e.pointerId); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); redraw(); }, { passive: false });
    return zoom;
  }

  const EXAMPLES = ['sin(x)', 'x^3 - 3x', 'e^(-x^2)', '1/x', 'x^2 + y^2', 'x^2 - y^2', 'sin(x)*cos(y)', 'e^(-(x^2+y^2))'];
  VIEWS.sketch = (v) => {
    const expr = sketch.expr;
    let mode = null, f = null, bad = false, shown = null;
    if (expr) {
      try {
        const names = Engine.symbols(expr);
        mode = names.includes('y') && names.includes('x') ? '3d' : '2d';
        const variable = mode === '3d' ? 'x' : guessVar(expr);
        f = Engine.fn(expr, mode === '3d' ? ['x', 'y'] : [variable]);
        shown = (mode === '3d' ? 'z = ' : 'y = ') + Engine.tex(expr, variable);
      } catch (e) { bad = true; }
    }
    const type = () => editor({ title: 'Function', expr, variable: 'x', isProblem: true, help: 'Use x for a curve, or x and y for a surface.', onSave: (e) => { if (e) setSketch(e); } });
    const scan = () => pickPhotos(async () => {
      const images = shots.slice(); shots = [];
      if (!images.length) return;
      go({ name: 'working', message: 'Reading the function…' });
      try { const r = await ai({ system: READFN, images, effort: 'low', user: 'Return the JSON.' }); setSketch(r.expr); }
      catch (e) { go({ name: 'sketch', error: e instanceof Friendly ? e.message : 'Something went wrong while reading the photo.' }); }
    });
    const canvas = f ? h('canvas', { class: 'plot', 'aria-label': 'Graph of the function' }) : null;
    let controls = null;
    if (canvas) {
      const s = mode === '3d' ? sketch.s3 : sketch.s2;
      const redraw = () => (mode === '3d' ? draw3d : draw2d)(canvas, f, s);
      const zoom = interact(canvas, mode, s, redraw);
      requestAnimationFrame(redraw);
      const range = h('span', { class: 'muted small' });
      const note = () => { range.textContent = mode === '3d' ? 'x, y: −' + tidy(s.range) + ' … ' + tidy(s.range) + '   z: ' + tidy(s.grid ? s.grid.lo : 0) + ' … ' + tidy(s.grid ? s.grid.hi : 0) : ''; };
      const press = (k) => () => { zoom(k); redraw(); note(); };
      requestAnimationFrame(note);
      canvas.addEventListener('pointerup', note);
      controls = h('div', {},
        h('div', { class: 'plotbar' },
          h('button', { class: 'key', 'aria-label': 'Zoom out', onclick: press(1 / 1.5) }, '−'),
          h('button', { class: 'key', 'aria-label': 'Zoom in', onclick: press(1.5) }, '+'),
          h('button', { class: 'key act', onclick: () => { const e = sketch.expr; sketch.s2 = { cx: 0, cy: 0, scale: 40 }; sketch.s3 = { yaw: 0.75, pitch: 0.55, range: 3, grid: null }; sketch.expr = e; refresh(); } }, 'Reset')),
        h('p', { class: 'muted small', style: 'margin:8px 0 0' }, mode === '3d' ? 'Drag to rotate. Pinch or use the buttons to zoom.' : 'Drag to move. Pinch or use the buttons to zoom.'),
        range);
    }
    return [
      h('h1', {}, 'Function sketcher'),
      v.error && h('div', { class: 'notice bad' }, v.error),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: scan }, icon('camera'), 'Scan'),
        h('button', { class: 'btn', onclick: type }, icon('keys'), 'Type')),
      bad ? h('div', { class: 'notice bad', style: 'margin-top:12px' }, 'That function could not be read. Tap Type to fix it.') : null,
      shown ? h('button', { class: 'card fx', onclick: type }, mathEl(shown)) : null,
      canvas ? h('div', { class: 'plotwrap' }, canvas) : null,
      controls,
      !expr ? h('p', { class: 'lede', style: 'margin-top:14px' }, 'Enter a function of x to see its curve, or of x and y to see its surface in 3D.') : null,
      h('h2', {}, 'Try one'),
      h('div', { class: 'chips' }, EXAMPLES.map((e) => h('button', { onclick: () => setSketch(e) }, mathEl(Engine.tex(e))))),
      store.sketches.length ? h('h2', {}, 'Recent') : null,
      store.sketches.length ? h('div', { class: 'list' }, store.sketches.map((e) => h('button', { class: 'item', onclick: () => setSketch(e) },
        h('div', { class: 'grow' }, mathEl((() => { try { return Engine.tex(e); } catch (err) { return ''; } })()))))) : null,
    ];
  };

  // ---- settings
  const seg = (options, current, onPick) => h('div', { class: 'seg' }, options.map(([val, label]) =>
    h('button', { class: val === current ? 'on' : '', 'aria-pressed': String(val === current), onclick: () => onPick(val) }, label)));
  VIEWS.settings = (v) => {
    const keyInput = h('input', { type: 'password', value: store.settings.key, placeholder: 'sk-…', autocomplete: 'off', onchange: (e) => { store.settings.key = e.target.value.trim(); save(); } });
    const test = async () => {
      store.settings.key = keyInput.value.trim(); save();
      go({ name: 'settings', status: 'Testing…' });
      try { await ai({ system: 'Reply with the JSON object {"ok": true}.', user: 'Return the json.' }); go({ name: 'settings', status: 'The key works.' }); }
      catch (e) { go({ name: 'settings', status: e.message }); }
    };
    const exportData = async () => {
      const copy = JSON.parse(JSON.stringify(store)); copy.settings.key = '';
      const file = new File([JSON.stringify(copy, null, 1)], 'tangent-backup-' + new Date().toISOString().slice(0, 10) + '.json', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (e) { /* cancelled */ } return; }
      const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove();
    };
    const importer = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: async (e) => {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(data.exercises)) throw new Error();
        if (!confirm(tr('Replace the history on this device with the ' + data.exercises.length + ' exercises in this backup?'))) return;
        const key = store.settings.key;
        store = Object.assign(blank(), data); store.settings.key = store.settings.key || key; save();
        go({ name: 'settings', status: 'Backup restored.' });
      } catch (err) { go({ name: 'settings', status: 'That file is not a Tangent backup.' }); }
    } });
    return [
      topbar('Back', () => go({ name: 'home' })),
      h('h1', {}, 'Settings'),
      h('h2', {}, 'Language'),
      seg([['en', 'English'], ['sv', 'Svenska']], store.settings.lang, (val) => { store.settings.lang = val; save(); applyTheme(); go({ name: 'settings' }); }),
      h('h2', {}, 'Appearance'),
      seg([['dark', 'Dark'], ['light', 'Light']], store.settings.theme, (val) => { store.settings.theme = val; save(); applyTheme(); go({ name: 'settings' }); }),
      h('h2', {}, 'DeepSeek'),
      h('label', { class: 'field' }, h('span', {}, 'API key (from platform.deepseek.com, kept only on this device)'), keyInput),
      h('button', { class: 'btn', onclick: test }, 'Save and test the key'),
      v.status ? h('div', { class: 'notice' }, v.status) : null,
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted' }, 'Your exercises and mistake history are stored only on this device. Export a backup now and then, and before changing phones.'),
      importer,
      h('div', { class: 'stack' },
        h('button', { class: 'btn', onclick: exportData }, 'Export a backup'),
        h('button', { class: 'btn', onclick: () => importer.click() }, 'Restore from a backup'),
        h('button', { class: 'btn quiet', onclick: () => { if (confirm(tr('Erase all exercises and progress from this device? This cannot be undone.'))) { const key = store.settings.key; store = blank(); store.settings.key = key; save(); go({ name: 'settings', status: 'History erased.' }); } } }, 'Erase history')),
      h('h2', {}, 'How checking works'),
      h('p', { class: 'muted' }, 'The AI only reads your handwriting and writes hints. Whether a line is right is decided by calculation: each line is evaluated at several test values and compared with the problem itself. A “?” means a line could not be tested, not that it is wrong.'),
    ];
  };

  // ------------------------------------------------------------------ start
  window.Tangent = { go, missing, get store() { return store; } };
  refresh();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
