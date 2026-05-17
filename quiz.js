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

  // ---- Icons (Inline-SVG, currentColor) ------------------
  // Einheitlicher Stil: 24×24, Strichzeichnung, stroke-width 1.6.
  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
           paths + '</svg>';
  }
  const ICON = {
    efh:         svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5V14h4v5.5"/>'),
    zfh:         svg('<path d="M3 10.5 12 4l9 6.5"/><path d="M5.5 9.5V19.5h13V9.5"/><path d="M9 13h2.2M12.8 13H15M9 16.3h2.2M12.8 16.3H15"/>'),
    mfh:         svg('<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'),
    wohnung:     svg('<rect x="4" y="3" width="16" height="18" rx="1.2"/><rect x="7.5" y="6.5" width="4" height="5" rx=".5"/><path d="M13.5 7.5H17M13.5 10.5H17M7.5 15h3.5M13.5 15H17"/>'),
    grundstueck: svg('<path d="M12 21s6.5-5 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 16 12 21 12 21Z"/><circle cx="12" cy="10.3" r="2.4"/>'),
    sofort:      svg('<path d="M13 2 4.5 13.5H11l-1 8.5L19 10h-6.5L13 2Z"/>'),
    lt3:         svg('<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
    '3to6':      svg('<circle cx="12" cy="12.5" r="8.5"/><path d="M12 7.5v5.5l3.5 2.5"/>'),
    '6to12':     svg('<path d="M6 2.5h12M6 21.5h12M8 2.5v3.8l4 4 4-4V2.5M8 21.5v-3.8l4-4 4 4v3.8"/>'),
    allein:      svg('<circle cx="12" cy="8" r="3.8"/><path d="M5.5 20.5c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/>'),
    partner:     svg('<circle cx="8.5" cy="8.5" r="3.2"/><circle cx="16" cy="9.5" r="2.7"/><path d="M3 20.5c0-3.2 2.5-5.6 5.5-5.6s5.5 2.4 5.5 5.6"/><path d="M14.5 20.5c.2-2.6 1.6-4.6 3.9-4.6 1.7 0 3 1.1 3.6 2.8"/>'),
    erben:       svg('<circle cx="12" cy="7" r="2.9"/><circle cx="5.3" cy="9.2" r="2.3"/><circle cx="18.7" cy="9.2" r="2.3"/><path d="M6.5 19.5c0-3 2.5-5.3 5.5-5.3s5.5 2.3 5.5 5.3"/>'),
    andere:      svg('<circle cx="10" cy="8" r="3.6"/><path d="M4 20.5c0-3.5 2.7-6 6-6"/><path d="M15.2 14.4a2.1 2.1 0 1 1 3.2 1.8c-.8.5-1.2.9-1.2 2M17.2 21v.02"/>')
  };

  // ---- Quiz-Konfiguration --------------------------------
  // Reihenfolge bewusst gewählt: niedrigste Hürde zuerst (1-Klick-Antworten),
  // PLZ als Tipp-Eingabe später, Lead-Daten ganz am Schluss.
  const QUIZ_STEPS = [
    {
      id: 'property_type',
      title: 'Welche Immobilie möchten Sie bewerten lassen?',
      help: 'Wählen Sie die Art der Immobilie.',
      type: 'single',
      options: [
        { value: 'efh', label: 'Einfamilienhaus', icon: ICON.efh },
        { value: 'zfh', label: 'Zweifamilienhaus', icon: ICON.zfh },
        { value: 'mfh', label: 'Mehrfamilienhaus', icon: ICON.mfh },
        { value: 'wohnung', label: 'Eigentumswohnung', icon: ICON.wohnung },
        { value: 'grundstueck', label: 'Grundstück', icon: ICON.grundstueck }
      ]
    },
    {
      id: 'timeline',
      title: 'Wann möchten Sie verkaufen?',
      help: 'Eine ehrliche Antwort hilft uns, den passenden Termin und Aufwand für Sie zu wählen.',
      type: 'single',
      options: [
        { value: 'sofort',  label: 'Sofort / so schnell wie möglich', icon: ICON.sofort },
        { value: 'lt3',     label: 'In den nächsten 3 Monaten', icon: ICON.lt3 },
        { value: '3to6',    label: 'In 3 bis 6 Monaten', icon: ICON['3to6'] },
        { value: '6to12',   label: 'In 6 bis 12 Monaten', icon: ICON['6to12'] }
      ]
    },
    {
      id: 'decider',
      title: 'Wer entscheidet über den Verkauf?',
      help: 'Wir möchten den Termin mit der entscheidungsbefugten Person führen.',
      type: 'single',
      options: [
        { value: 'allein',  label: 'Ich allein', icon: ICON.allein },
        { value: 'partner', label: 'Ich gemeinsam mit Partner / Partnerin', icon: ICON.partner },
        { value: 'erben',   label: 'Erbengemeinschaft', icon: ICON.erben },
        { value: 'andere',  label: 'Andere Person / Vollmacht ungeklärt', icon: ICON.andere }
      ]
    },
    {
      id: 'plz',
      title: 'Wo liegt die Immobilie?',
      help: 'Wir prüfen, ob Ihre Immobilie in unserem Kerngebiet (Radius 50 km um Herford) liegt.',
      type: 'plz'
    },
    {
      id: 'lead',
      title: 'Fast geschafft — wohin dürfen wir Ihre Werteinschätzung schicken?',
      help: 'Ihre Daten werden ausschließlich für Ihre Werteinschätzung verwendet (DSGVO-konform). 100 % unverbindlich.',
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
    leadType: null,
    startedFired: false
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
    const outer = create('div', { class: 'quiz-progress-wrap' });
    const wrap = create('div', { class: 'quiz-progress', 'aria-hidden': 'true' });
    QUIZ_STEPS.forEach((_, i) => {
      const cls = i < state.stepIndex ? 'quiz-progress-step is-done'
                : i === state.stepIndex ? 'quiz-progress-step is-active'
                : 'quiz-progress-step';
      wrap.appendChild(create('span', { class: cls }));
    });
    outer.appendChild(wrap);
    outer.appendChild(create('p', { class: 'quiz-progress-label' }, [
      create('span', { class: 'qpl-num' }, 'Schritt ' + (state.stepIndex + 1) + ' von ' + QUIZ_STEPS.length),
      create('span', { class: 'qpl-pct' }, Math.round((state.stepIndex) / (QUIZ_STEPS.length - 1) * 100) + ' % geschafft')
    ]));
    return outer;
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
        'data-value': opt.value
      }, [
        opt.icon ? create('span', { class: 'opt-icon', 'aria-hidden': 'true', html: opt.icon }) : null,
        create('span', { class: 'opt-label' }, opt.label),
        create('span', { class: 'opt-mark', 'aria-hidden': 'true' })
      ]);
      btn.addEventListener('click', () => selectAndNext(step.id, opt.value, btn));
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
        fireQuizStartedOnce('plz');
        state.stepIndex++;
        push('quiz_step_completed', { step_id: 'plz', step_index: state.stepIndex });
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
      { id: 'name',      label: 'Vor- und Nachname', type: 'text', autocomplete: 'name', pattern: "[-A-Za-zÄÖÜäöüß' .]{2,}.+", placeholder: 'z. B. Maria Musterfrau', errorMsg: 'Bitte geben Sie Vor- und Nachname ein.' },
      { id: 'email',     label: 'E-Mail-Adresse', type: 'email', autocomplete: 'email', placeholder: 'name@beispiel.de', errorMsg: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' },
      { id: 'phone',     label: 'Telefon (optional — für Rückfragen)', type: 'tel', autocomplete: 'tel-national', placeholder: '171 1234567', tel: true, optional: true, errorMsg: 'Bitte geben Sie eine gültige Telefonnummer ein.' }
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
          autocomplete: f.autocomplete,
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

    const submitBtn = create('button', { type: 'submit', class: 'btn-solid btn-solid-compact' }, [
      'Kostenlose Werteinschätzung anfordern ', create('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')
    ]);

    const actions = create('div', { class: 'quiz-actions' });
    actions.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    const microTrust = create('p', { class: 'quiz-micro-trust' },
      '✓ 100 % unverbindlich  ·  ✓ Ihre Daten sind sicher  ·  ✓ DSGVO-konform'
    );
    form.appendChild(microTrust);

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
        else if (f.tel) { const c = val.replace(/^0+/, '').trim(); ok = (f.optional && c.length === 0) || /^[0-9 ]{6,16}$/.test(c); }
        else if (f.id === 'name') ok = /^[-A-Za-zÄÖÜäöüß' .]{2,}\s+[-A-Za-zÄÖÜäöüß' .]{2,}/.test(val);
        else if (f.pattern) ok = new RegExp('^' + f.pattern + '$').test(val);
        if (!ok) { fwrap.classList.add('has-error'); valid = false; }
        else { fwrap.classList.remove('has-error'); state.answers[f.id] = f.tel ? (val.trim() ? '+49 ' + val.replace(/^0+/, '').trim() : '') : val; }
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
        submitBtn.innerHTML = 'Kostenlose Werteinschätzung anfordern <span class="arrow" aria-hidden="true">→</span>';
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
  function fireQuizStartedOnce(stepId) {
    if (state.startedFired) return;
    state.startedFired = true;
    push('quiz_started', { source: 'first_answer', first_step_id: stepId });
  }
  function selectAndNext(stepId, value, btnEl) {
    state.answers[stepId] = value;
    fireQuizStartedOnce(stepId);
    push('quiz_step_completed', { step_id: stepId, value: value, step_index: state.stepIndex });

    // Auswahl sichtbar bestätigen, dann mit kurzer Verzögerung weiterblättern
    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('.quiz-option').forEach(b => {
        b.classList.remove('is-selected');
        b.disabled = true;
      });
      btnEl.classList.add('is-selected', 'just-picked');
    }
    if (state.stepIndex < QUIZ_STEPS.length - 1) {
      setTimeout(() => { state.stepIndex++; render(); }, 300);
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

  // Bereitet User-Daten für Google Ads Enhanced Conversions auf.
  // Google akzeptiert Klartext und hasht intern selbst (SHA-256).
  function splitName(full) {
    const parts = (full || '').toString().trim().split(/\s+/);
    if (parts.length <= 1) return { first: parts[0] || '', last: '' };
    return { first: parts[0], last: parts.slice(1).join(' ') };
  }
  function buildEnhancedConversionData(a) {
    function clean(s) { return (s || '').toString().trim().toLowerCase(); }
    function normalizePhone(p) {
      if (!p) return '';
      var s = ('' + p).replace(/[^\d+]/g, '');
      if (s.indexOf('+') === 0) return s;
      if (s.indexOf('00') === 0) return '+' + s.slice(2);
      if (s.indexOf('0') === 0) return '+49' + s.slice(1);
      return '+49' + s;
    }
    const n = splitName(a.name);
    return {
      email:       clean(a.email),
      phone_number: normalizePhone(a.phone),
      address: {
        first_name:  clean(n.first),
        last_name:   clean(n.last),
        postal_code: clean(a.plz),
        country:     'DE'
      }
    };
  }

  function submitLead() {
    const a = state.answers;
    const leadType = (state.leadType || '').toUpperCase();
    const fullName = (a.name || '').trim();
    const n = splitName(fullName);

    const payload = {
      // Formsubmit.co Steuerfelder
      _subject: 'Holzmann Lead [' + leadType + '] — ' + fullName + ' (PLZ ' + a.plz + ')',
      _replyto: a.email,
      _template: 'table',
      _captcha: 'false',
      _cc: 'holzmann.immobilien.herford@gmail.com,info@kivonti.de',
      _source: 'verkauf.holzmann-immobilien.de',

      // Lead-Daten (im Mail-Body lesbar)
      'Lead-Typ': leadType,
      'Name': fullName,
      'Vorname': n.first,
      'Nachname': n.last,
      'E-Mail': a.email,
      'Telefon': a.phone,
      'Objekt-Typ': labelOf('property_type', a.property_type),
      'PLZ Objekt': a.plz,
      'Verkaufszeitraum': labelOf('timeline', a.timeline),
      'Entscheider': labelOf('decider', a.decider),
      'Quelle': 'verkauf.holzmann-immobilien.de',
      'Zeitstempel': new Date().toISOString()
    };

    // Enhanced Conversions: bereinigte User-Daten für Google Ads bereitstellen
    const userData = buildEnhancedConversionData(a);
    try { localStorage.setItem('holzmann-ec-userdata', JSON.stringify({ data: userData, ts: Date.now() })); } catch(e) {}

    push('quiz_completed_' + state.leadType, {
      lead_type: state.leadType,
      value: state.leadType === 'hot' ? 200 : state.leadType === 'warm' ? 50 : 0,
      currency: 'EUR',
      enhanced_conversion_data: userData
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
      headline = 'Geschafft — Ihre Werteinschätzung ist in Arbeit.';
      message = 'Ihre Angaben sind bei uns. Am schnellsten geht es persönlich: Wählen Sie unten einen 15-Minuten-Telefontermin — Viktor Holzmann ruft Sie pünktlich an und bespricht Ihre Werteinschätzung direkt mit Ihnen.';
      extra = create('div', { class: 'cal-embed', id: 'cal-embed-holzmann' });
      // Cal.com Embed wird nach DOM-Insert initialisiert (siehe initCalEmbed unten)
    } else if (t === 'warm') {
      icon = '✓';
      headline = 'Geschafft — Ihre Werteinschätzung wird vorbereitet.';
      message = 'Wir haben Ihre Angaben erhalten und bereiten Ihre persönliche Werteinschätzung vor. Möchten Sie sie direkt besprechen? Wählen Sie unten einen passenden 15-Minuten-Telefontermin — andernfalls melden wir uns binnen 24 Stunden bei Ihnen.';
      extra = create('div', { class: 'cal-embed', id: 'cal-embed-holzmann' });
      // Cal.com Embed wird nach DOM-Insert initialisiert (siehe initCalEmbed unten)
    } else {
      icon = '✓';
      headline = 'Vielen Dank — wir haben Ihre Anfrage erhalten.';
      message = 'Ihre Immobilie liegt außerhalb unseres Kerngebiets (50 km um Herford) oder die Entscheiderfrage ist noch offen. Wir prüfen Ihre Situation und melden uns persönlich bei Ihnen — telefonisch oder per E-Mail.';
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

    // Cal.com Embed initialisieren (Hot- und Warm-Pfad)
    if (t === 'hot' || t === 'warm') initCalEmbed();

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
      name: (a.name || '').trim(),
      email: a.email || '',
      smsReminderNumber: a.phone || '',
      notes:
        'Objekt: ' + (labelOf('property_type', a.property_type) || '') +
        ' · PLZ ' + (a.plz || '') +
        ' · Verkauf: ' + (labelOf('timeline', a.timeline) || '') +
        ' · Entscheider: ' + (labelOf('decider', a.decider) || '')
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
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    // Prefill direkt im calLink als URL-Parameter — überschreibt zuverlässig
    // gespeicherte Cal.com-Cookies/localStorage des Browsers.
    const params = new URLSearchParams();
    if (prefill.name) params.set('name', prefill.name);
    if (prefill.email) params.set('email', prefill.email);
    if (prefill.smsReminderNumber) params.set('smsReminderNumber', prefill.smsReminderNumber);
    if (prefill.notes) params.set('notes', prefill.notes);
    const calLinkWithPrefill = CONFIG.calLink + (params.toString() ? '?' + params.toString() : '');

    Cal('init', '15min', { origin: 'https://app.cal.com' });
    Cal.ns['15min']('inline', {
      elementOrSelector: '#cal-embed-holzmann',
      config: Object.assign(
        { layout: 'month_view', useSlotsViewOnSmallScreen: 'true' },
        prefill.name ? { name: prefill.name } : {},
        prefill.email ? { email: prefill.email } : {},
        prefill.smsReminderNumber ? { smsReminderNumber: prefill.smsReminderNumber } : {},
        prefill.notes ? { notes: prefill.notes } : {}
      ),
      calLink: calLinkWithPrefill
    });
    Cal.ns['15min']('ui', { hideEventTypeDetails: false, layout: 'month_view' });
    Cal.ns['15min']('prefill', prefill);

    // Nach erfolgreicher Buchung: GTM-Event + Redirect auf Danke-Seite
    Cal.ns['15min']('on', {
      action: 'bookingSuccessful',
      callback: function () {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'cal_booking_successful', lead_type: state.leadType });
        window.location.href = '/danke-seite.html';
      }
    });
  }

  // ---- Tracking ------------------------------------------
  function push(event, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, data || {}));
  }

  // ---- Init ----------------------------------------------
  // CTA-Buttons als Scroll-Trigger zum Quiz (Mikro-Conversion).
  // WICHTIG: feuert NICHT mehr `quiz_started` — das passiert jetzt erst
  // beim tatsächlichen Beantworten der ersten Frage (fireQuizStartedOnce).
  document.querySelectorAll('[data-cta]').forEach(btn => {
    btn.addEventListener('click', () => {
      push('cta_click_to_quiz', { source: btn.getAttribute('data-cta') });
    });
  });

  render();
})();
