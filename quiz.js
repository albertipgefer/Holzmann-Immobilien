/* =========================================================
   Holzmann Immobilien — Verkaufsstrategie Quiz
   Vanilla JS, kein Framework. State-Machine, 5 Fragen +
   Lead-Daten, Routing (Hot/Warm/Cold), Formspree-Submit,
   TidyCal-Embed im Hot-Pfad.
   ========================================================= */

(function () {
  'use strict';

  // ---- Konfiguration ---------------
  // Formsubmit.co — kostenlos, unbegrenzt, kein Account nötig.
  // Beim ersten Submit kommt eine Bestätigungsmail an die Empfänger-Adresse.
  // Den darin enthaltenen Link einmal klicken → ab dann kommen alle Leads an.
  const CONFIG = {
    formEndpoint: 'https://formsubmit.co/ajax/info@wohlstandsmarketing.de',
    calLink: 'holzmann-immobilien/15min',
    contactPhone: '+4952211202810',
    contactPhoneDisplay: '05221 12028-10'
  };

  // ---- PLZ-Whitelist (~50 km um Herford 32049) -----------
  // Pragmatischer Bereich: OWL + Bielefeld + nahes Münster-/Mindener Land.
  // Erweiterbar – jeder Eintrag ist ein 3-stelliges PLZ-Präfix.
  const PLZ_PREFIX_WHITELIST = [
    '320', '321', '322', '323', '324', '325', '326', '327', '328', '329', // Herford, Bad Salzuflen, Bad Oeynhausen, Lemgo, Detmold, Minden, Lübbecke, Bünde, Löhne, Vlotho, Porta Westfalica
    '330', '331', '332', '333', '334', '335',                              // Bielefeld, Gütersloh, Werther, Halle Westf, Steinhagen, Borgholzhausen
    '317'                                                                  // Hameln Grenze (südliches OWL)
  ];

  // ---- Quiz-Konfiguration --------------------------------
  const QUIZ_STEPS = [
    {
      id: 'property_type',
      title: 'Welche Immobilie möchten Sie verkaufen?',
      help: 'Wählen Sie die Art der Immobilie.',
      type: 'single',
      options: [
        { value: 'efh', label: 'Einfamilienhaus' },
        { value: 'zfh', label: 'Zweifamilienhaus' },
        { value: 'mfh', label: 'Mehrfamilienhaus' },
        { value: 'wohnung', label: 'Eigentumswohnung' },
        { value: 'grundstueck', label: 'Grundstück' }
      ]
    },
    {
      id: 'plz',
      title: 'Wo liegt die Immobilie?',
      help: 'Wir prüfen, ob Ihre Immobilie in unserem Kerngebiet (Radius 50 km um Herford) liegt.',
      type: 'plz'
    },
    {
      id: 'timeline',
      title: 'Wann möchten Sie verkaufen?',
      help: 'Eine ehrliche Antwort hilft uns, den passenden Termin und Aufwand für Sie zu wählen.',
      type: 'single',
      options: [
        { value: 'sofort',  label: 'Sofort / so schnell wie möglich' },
        { value: 'lt3',     label: 'In den nächsten 3 Monaten' },
        { value: '3to6',    label: 'In 3 bis 6 Monaten' },
        { value: '6to12',   label: 'In 6 bis 12 Monaten' }
      ]
    },
    {
      id: 'decider',
      title: 'Wer entscheidet über den Verkauf?',
      help: 'Wir möchten den Termin mit der entscheidungsbefugten Person führen.',
      type: 'single',
      options: [
        { value: 'allein',  label: 'Ich allein' },
        { value: 'partner', label: 'Ich gemeinsam mit Partner / Partnerin' },
        { value: 'erben',   label: 'Erbengemeinschaft' },
        { value: 'andere',  label: 'Andere Person / Vollmacht ungeklärt' }
      ]
    },
    {
      id: 'state',
      title: 'Wie ist die Immobilie aktuell genutzt?',
      help: 'Das hilft uns, die Verkaufsstrategie auf Ihre Situation auszurichten.',
      type: 'single',
      options: [
        { value: 'selbst',  label: 'Selbst genutzt' },
        { value: 'vermietet', label: 'Vermietet' },
        { value: 'leer',    label: 'Leerstehend' }
      ]
    },
    {
      id: 'lead',
      title: 'Damit wir Sie pünktlich zurückrufen können.',
      help: 'Ihre Daten werden ausschließlich für dieses Erstgespräch verwendet (DSGVO-konform).',
      type: 'lead'
    }
  ];

  // ---- DOM-Helper ----------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const create = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
    });
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  };

  // ---- State ---------------------------------------------
  const state = {
    stepIndex: 0,
    answers: {},
    leadType: null
  };

  const root = $('#quiz-app');
  if (!root) return;

  // ---- Render --------------------------------------------
  function render() {
    root.innerHTML = '';
    root.appendChild(renderProgress());

    const step = QUIZ_STEPS[state.stepIndex];
    if (step.type === 'single') root.appendChild(renderSingle(step));
    else if (step.type === 'plz') root.appendChild(renderPLZ(step));
    else if (step.type === 'lead') root.appendChild(renderLead(step));
  }

  function renderProgress() {
    const wrap = create('div', { class: 'quiz-progress', 'aria-hidden': 'true' });
    QUIZ_STEPS.forEach((_, i) => {
      const cls = i < state.stepIndex ? 'quiz-progress-step is-done'
                : i === state.stepIndex ? 'quiz-progress-step is-active'
                : 'quiz-progress-step';
      wrap.appendChild(create('span', { class: cls }));
    });
    return wrap;
  }

  function renderSingle(step) {
    const wrap = create('div', { class: 'quiz-step' });
    wrap.appendChild(create('h3', null, step.title));
    if (step.help) wrap.appendChild(create('p', { class: 'quiz-help' }, step.help));

    const optsWrap = create('div', { class: 'quiz-options' });
    step.options.forEach(opt => {
      const isSelected = state.answers[step.id] === opt.value;
      const btn = create('button', {
        type: 'button',
        class: 'quiz-option' + (isSelected ? ' is-selected' : ''),
        'data-value': opt.value,
        onclick: () => selectAndNext(step.id, opt.value)
      }, [
        create('span', { class: 'opt-mark', 'aria-hidden': 'true' }),
        create('span', null, opt.label)
      ]);
      optsWrap.appendChild(btn);
    });
    wrap.appendChild(optsWrap);
    wrap.appendChild(renderActions({ showBack: state.stepIndex > 0, showNext: false }));
    return wrap;
  }

  function renderPLZ(step) {
    const wrap = create('div', { class: 'quiz-step' });
    wrap.appendChild(create('h3', null, step.title));
    if (step.help) wrap.appendChild(create('p', { class: 'quiz-help' }, step.help));

    const field = create('div', { class: 'quiz-field' });
    field.appendChild(create('label', { for: 'q-plz' }, 'Postleitzahl der Immobilie'));
    const input = create('input', {
      type: 'tel', id: 'q-plz', name: 'plz',
      inputmode: 'numeric', pattern: '[0-9]{5}', maxlength: '5', minlength: '5',
      autocomplete: 'postal-code',
      placeholder: 'z. B. 32049',
      value: state.answers.plz || ''
    });
    input.addEventListener('keypress', e => {
      if (!/[0-9]/.test(e.key) && e.key !== 'Enter') e.preventDefault();
    });
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 5);
      field.classList.remove('has-error');
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 5);
      input.value = txt;
    });
    field.appendChild(input);
    field.appendChild(create('p', { class: 'field-error' }, 'Bitte geben Sie eine gültige 5-stellige Postleitzahl ein.'));
    wrap.appendChild(field);

    const next = create('button', {
      type: 'button', class: 'btn-solid',
      onclick: () => {
        const val = input.value.trim();
        if (!/^[0-9]{5}$/.test(val)) { field.classList.add('has-error'); input.focus(); return; }
        state.answers.plz = val;
        state.stepIndex++;
        push('quiz_step_completed', { step_id: 'plz', step_index: 1 });
        render();
      }
    }, ['Weiter ', create('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]);

    const actions = create('div', { class: 'quiz-actions' });
    if (state.stepIndex > 0) actions.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    else actions.appendChild(create('span'));
    actions.appendChild(next);
    wrap.appendChild(actions);
    return wrap;
  }

  function renderLead(step) {
    state.leadType = classifyLead(state.answers);

    const wrap = create('div', { class: 'quiz-step' });
    wrap.appendChild(create('h3', null, step.title));
    if (step.help) wrap.appendChild(create('p', { class: 'quiz-help' }, step.help));

    const form = create('form', { class: 'quiz-form', novalidate: 'true' });

    const fields = [
      { id: 'firstname', label: 'Vorname',  type: 'text',  autocomplete: 'given-name',  pattern: "[-A-Za-zÄÖÜäöüß' .]{2,}", placeholder: 'Vorname',   errorMsg: 'Bitte geben Sie Ihren Vornamen ein.' },
      { id: 'lastname',  label: 'Nachname', type: 'text',  autocomplete: 'family-name', pattern: "[-A-Za-zÄÖÜäöüß' .]{2,}", placeholder: 'Nachname', errorMsg: 'Bitte geben Sie Ihren Nachnamen ein.' },
      { id: 'email',     label: 'E-Mail-Adresse', type: 'email', autocomplete: 'email', placeholder: 'name@beispiel.de', errorMsg: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' },
      { id: 'phone',     label: 'Telefon (für die Bestätigung)', type: 'tel', autocomplete: 'tel-national', placeholder: '171 1234567', tel: true, errorMsg: 'Bitte geben Sie eine gültige Telefonnummer ein.' },
      { id: 'address',   label: 'Adresse der Immobilie (Straße, Hausnummer)', type: 'text', autocomplete: 'street-address', placeholder: 'Musterstraße 12', pattern: '.{4,}', errorMsg: 'Bitte geben Sie Straße und Hausnummer an.' }
    ];

    fields.forEach(f => {
      const fwrap = create('div', { class: 'quiz-field' });
      fwrap.appendChild(create('label', { for: 'q-' + f.id }, f.label));

      if (f.tel) {
        const telWrap = create('div', { class: 'tel-wrap' });
        const flag = create('span', { class: 'tel-flag', 'aria-hidden': 'true' }, [
          create('span', { class: 'tel-flag-de', 'aria-hidden': 'true' }),
          create('span', { class: 'tel-prefix' }, '+49')
        ]);
        const tel = create('input', {
          type: 'tel', id: 'q-' + f.id, name: f.id,
          autocomplete: f.autocomplete, required: 'required',
          inputmode: 'numeric',
          placeholder: f.placeholder,
          value: state.answers[f.id] || ''
        });
        tel.addEventListener('keypress', e => {
          if (!/[0-9 ]/.test(e.key) && e.key !== 'Enter') e.preventDefault();
        });
        tel.addEventListener('input', () => {
          tel.value = tel.value.replace(/[^0-9 ]/g, '');
        });
        telWrap.appendChild(flag);
        telWrap.appendChild(tel);
        fwrap.appendChild(telWrap);
      } else {
        fwrap.appendChild(create('input', {
          type: f.type, id: 'q-' + f.id, name: f.id,
          autocomplete: f.autocomplete, required: 'required',
          pattern: f.pattern || null,
          placeholder: f.placeholder,
          value: state.answers[f.id] || ''
        }));
      }
      fwrap.appendChild(create('p', { class: 'field-error' }, f.errorMsg));
      form.appendChild(fwrap);
    });

    const consentWrap = create('label', { class: 'quiz-checkbox' });
    consentWrap.appendChild(create('input', { type: 'checkbox', id: 'q-consent', name: 'consent', required: 'required' }));
    consentWrap.appendChild(create('span', { html:
      'Ich willige ein, dass meine Daten zur Bearbeitung meiner Anfrage bei Holzmann Immobilien gespeichert werden. Details siehe <a href="https://holzmann-immobilien.de/datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a>.'
    }));
    form.appendChild(consentWrap);

    // Honeypot (Spam-Schutz, unsichtbar)
    const honey = create('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
    honey.style.position = 'absolute';
    honey.style.left = '-10000px';
    honey.style.opacity = '0';
    honey.style.height = '0';
    honey.setAttribute('aria-hidden', 'true');
    form.appendChild(honey);

    const submitBtn = create('button', { type: 'submit', class: 'btn-solid' }, [
      'Erstgespräch sichern ', create('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')
    ]);

    const actions = create('div', { class: 'quiz-actions' });
    actions.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (honey.value) return; // Bot
      let valid = true;
      fields.forEach(f => {
        const inp = $('#q-' + f.id, form);
        const fwrap = inp.parentElement.classList.contains('tel-wrap') ? inp.parentElement.parentElement : inp.parentElement;
        const val = inp.value.trim();
        let ok = val.length > 0;
        if (f.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val);
        else if (f.tel) ok = /^[0-9 ]{6,16}$/.test(val.replace(/^0+/, ''));
        else if (f.pattern) ok = new RegExp('^' + f.pattern + '$').test(val);
        if (!ok) { fwrap.classList.add('has-error'); valid = false; }
        else { fwrap.classList.remove('has-error'); state.answers[f.id] = f.tel ? '+49 ' + val.replace(/^0+/, '').trim() : val; }
      });
      const consent = $('#q-consent', form).checked;
      if (!consent) { valid = false; consentWrap.style.color = '#B33A3A'; }
      else consentWrap.style.color = '';

      if (!valid) {
        const firstErr = form.querySelector('.has-error');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Wird gesendet …';
      submitLead().then(() => renderConfirm()).catch(err => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Erstgespräch sichern <span class="arrow" aria-hidden="true">→</span>';
        alert('Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder rufen Sie uns telefonisch unter ' + CONFIG.contactPhoneDisplay + ' an.');
        // eslint-disable-next-line no-console
        console.error('Lead submit failed', err);
      });
    });

    wrap.appendChild(form);
    return wrap;
  }

  function renderActions(opts) {
    const wrap = create('div', { class: 'quiz-actions' });
    if (opts.showBack) wrap.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    else wrap.appendChild(create('span'));
    if (opts.showNext) wrap.appendChild(create('button', { type: 'button', class: 'btn-solid', onclick: next }, ['Weiter ', create('span', { class: 'arrow' }, '→')]));
    return wrap;
  }

  // ---- Step-Logik ----------------------------------------
  function selectAndNext(stepId, value) {
    state.answers[stepId] = value;
    push('quiz_step_completed', { step_id: stepId, value: value, step_index: state.stepIndex });
    if (state.stepIndex < QUIZ_STEPS.length - 1) {
      state.stepIndex++;
      render();
    }
  }
  function next() { if (state.stepIndex < QUIZ_STEPS.length - 1) { state.stepIndex++; render(); } }
  function back() { if (state.stepIndex > 0) { state.stepIndex--; render(); } }

  // ---- Routing -------------------------------------------
  function isPLZWithin50kmHerford(plz) {
    if (!plz || plz.length !== 5) return false;
    const prefix = plz.slice(0, 3);
    return PLZ_PREFIX_WHITELIST.indexOf(prefix) !== -1;
  }

  function classifyLead(a) {
    const validPLZ = isPLZWithin50kmHerford(a.plz);
    const t = a.timeline;
    const d = a.decider;

    if (!validPLZ || d === 'andere') return 'cold';
    if (d === 'erben' || t === '6to12') return 'warm';
    return 'hot';
  }

  // ---- Submit --------------------------------------------
  function labelOf(stepId, value) {
    const step = QUIZ_STEPS.find(s => s.id === stepId);
    if (!step || !step.options) return value;
    const opt = step.options.find(o => o.value === value);
    return opt ? opt.label : value;
  }

  function submitLead() {
    const a = state.answers;
    const leadType = (state.leadType || '').toUpperCase();
    const fullName = ((a.firstname || '') + ' ' + (a.lastname || '')).trim();

    const payload = {
      // Formsubmit.co Steuerfelder
      _subject: 'Holzmann Lead [' + leadType + '] — ' + fullName + ' (PLZ ' + a.plz + ')',
      _replyto: a.email,
      _template: 'table',
      _captcha: 'false',
      _source: 'strategie.holzmann-immobilien.de',

      // Lead-Daten (im Mail-Body lesbar)
      'Lead-Typ': leadType,
      'Vorname': a.firstname,
      'Nachname': a.lastname,
      'E-Mail': a.email,
      'Telefon': a.phone,
      'Objekt-Adresse': a.address,
      'Objekt-Typ': labelOf('property_type', a.property_type),
      'PLZ Objekt': a.plz,
      'Verkaufszeitraum': labelOf('timeline', a.timeline),
      'Entscheider': labelOf('decider', a.decider),
      'Aktuelle Nutzung': labelOf('state', a.state),
      'Quelle': 'strategie.holzmann-immobilien.de',
      'Zeitstempel': new Date().toISOString()
    };

    push('quiz_completed_' + state.leadType, {
      lead_type: state.leadType,
      value: state.leadType === 'hot' ? 200 : state.leadType === 'warm' ? 50 : 0,
      currency: 'EUR'
    });

    return fetch(CONFIG.formEndpoint, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!res.ok) throw new Error('Form endpoint responded ' + res.status);
      return res.json().catch(() => ({}));
    });
  }

  // ---- Confirmation --------------------------------------
  function renderConfirm() {
    root.setAttribute('data-quiz-state', 'confirm-' + state.leadType);
    const t = state.leadType;
    let icon, headline, message, extra;

    if (t === 'hot') {
      icon = '✓';
      headline = 'Wählen Sie jetzt Ihren 15-Minuten-Anruf mit Viktor Holzmann.';
      message = 'Ihre Daten sind bei uns. Wählen Sie einen passenden Slot im Kalender unten — Viktor ruft Sie zur gewählten Zeit auf der angegebenen Nummer an. Bestätigung kommt per E-Mail.';
      extra = create('div', { class: 'cal-embed', id: 'cal-embed-holzmann' });
      // Cal.com Embed wird nach DOM-Insert initialisiert (siehe initCalEmbed unten)
    } else if (t === 'warm') {
      icon = '✓';
      headline = 'Vielen Dank — wir melden uns binnen 24 Stunden.';
      message = 'Wir haben Ihre Anfrage erhalten. Viktor Holzmann oder ein Mitglied seines Teams ruft Sie persönlich zurück, um einen passenden Slot abzustimmen.';
      extra = create('p', null, ['Falls es eilig ist, erreichen Sie uns direkt unter ',
        create('a', { href: 'tel:' + CONFIG.contactPhone }, CONFIG.contactPhoneDisplay), '.']);
    } else {
      icon = '✓';
      headline = 'Vielen Dank für Ihre Anfrage.';
      message = 'Ihre Immobilie liegt außerhalb unseres Kerngebiets oder die Entscheiderfrage ist noch ungeklärt. Wir melden uns bei Ihnen, sobald wir Ihre Situation eingeordnet haben — telefonisch oder per E-Mail.';
      extra = create('p', null, ['Bei dringenden Fragen erreichen Sie uns unter ',
        create('a', { href: 'tel:' + CONFIG.contactPhone }, CONFIG.contactPhoneDisplay), '.']);
    }

    root.innerHTML = '';
    const wrap = create('div', { class: 'quiz-confirm' }, [
      create('div', { class: 'confirm-icon', 'aria-hidden': 'true' }, icon),
      create('h3', null, headline),
      create('p', null, message),
      extra
    ]);
    root.appendChild(wrap);

    // Cal.com Embed initialisieren (Hot-Pfad)
    if (t === 'hot') initCalEmbed();

    // Scroll zum Quiz, damit Buchung sichtbar ist
    setTimeout(() => {
      const top = root.getBoundingClientRect().top + window.scrollY - 40;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }, 80);
  }

  // ---- Cal.com Inline-Embed -------------------------------
  function initCalEmbed() {
    // Lead-Daten als Prefill an Cal.com übergeben
    const a = state.answers;
    const prefill = {
      name: ((a.firstname || '') + ' ' + (a.lastname || '')).trim(),
      email: a.email || '',
      smsReminderNumber: a.phone || '',
      notes:
        'Objekt: ' + (labelOf('property_type', a.property_type) || '') +
        ' · PLZ ' + (a.plz || '') +
        ' · Adresse: ' + (a.address || '') +
        ' · Verkauf: ' + (labelOf('timeline', a.timeline) || '') +
        ' · Entscheider: ' + (labelOf('decider', a.decider) || '') +
        ' · Nutzung: ' + (labelOf('state', a.state) || '')
    };

    // Cal.com EU Inline-Embed-Loader (offizieller Snippet, einmalig laden)
    (function (C, A, L) {
      let p = function (a, ar) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal; let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {}; cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1]; api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else { p(cal, ar); }
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.eu/embed/embed.js', 'init');

    Cal('init', 'holzmann15', { origin: 'https://app.cal.eu' });
    Cal.ns.holzmann15('inline', {
      elementOrSelector: '#cal-embed-holzmann',
      calLink: CONFIG.calLink,
      config: { layout: 'month_view', theme: 'light', overlayCalendar: 'true' }
    });
    Cal.ns.holzmann15('ui', {
      hideEventTypeDetails: false,
      layout: 'month_view',
      theme: 'light',
      cssVarsPerTheme: {
        light: {
          'cal-brand': '#B8895F',
          'cal-text': '#07071A',
          'cal-bg': '#FFFFFF'
        }
      }
    });
    if (prefill.email) Cal.ns.holzmann15('prefill', prefill);
  }

  // ---- Tracking ------------------------------------------
  function push(event, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, data || {}));
  }

  // ---- Init ----------------------------------------------
  // CTA-Buttons der Seite tracken
  document.querySelectorAll('[data-cta]').forEach(btn => {
    btn.addEventListener('click', () => {
      push('quiz_started', { source: btn.getAttribute('data-cta') });
    });
  });

  render();
})();
