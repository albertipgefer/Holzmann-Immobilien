/* =========================================================
   Holzmann Immobilien — Werteinschätzungs-Quiz
   Vanilla JS, kein Framework. State-Machine: 8 Fragen +
   Lead-Daten, Routing (Hot/Warm/Cold), Web3Forms-Submit,
   Redirect auf /danke-seite.html (Cal.com-Embed dort).
   ========================================================= */

(function () {
  'use strict';

  // ---- Konfiguration -------------------------------------
  const CONFIG = {
    web3formsEndpoint: 'https://api.web3forms.com/submit',
    web3formsKey: 'f25a575b-8c02-451f-a228-aceceb4a4390',
    submitTimeoutMs: 12000,
    thankYouPath: '/danke-seite.html',
    contactPhone: '+4952211202810',
    contactPhoneDisplay: '05221 12028-10'
  };

  // ---- PLZ-Whitelist (~50 km um Herford 32049) -----------
  const PLZ_PREFIX_WHITELIST = [
    '320', '321', '322', '323', '324', '325', '326', '327', '328', '329',
    '330', '331', '332', '333', '334', '335',
    '317'
  ];

  // ---- Icons (Inline-SVG) --------------------------------
  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
           paths + '</svg>';
  }
  const ICON = {
    familienhaus:   svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5V14h4v5.5"/>'),
    mfh:            svg('<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'),
    wohnung:        svg('<rect x="4" y="3" width="16" height="18" rx="1.2"/><rect x="7.5" y="6.5" width="4" height="5" rx=".5"/><path d="M13.5 7.5H17M13.5 10.5H17M7.5 15h3.5M13.5 15H17"/>'),
    grundstueck:    svg('<path d="M12 21s6.5-5 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 16 12 21 12 21Z"/><circle cx="12" cy="10.3" r="2.4"/>'),
    baugrundstueck: svg('<path d="M3 20.5h18"/><path d="M5 20.5V13l7-5 7 5v7.5"/><path d="M9 20.5v-5h6v5"/><path d="M13 9.5l2-2 2 2"/>')
  };

  // ---- Quiz-Konfiguration --------------------------------
  // skipIf: Function(answers) → bool. true = Step überspringen.
  const isLand = a => a.property_type === 'grundstueck' || a.property_type === 'baugrundstueck';

  const QUIZ_STEPS = [
    {
      id: 'property_type',
      title: 'Welchen Immobilientyp möchten Sie bewerten?',
      help: 'Wählen Sie die Art Ihrer Immobilie.',
      type: 'single',
      options: [
        { value: 'familienhaus',   label: 'Familienhaus',     icon: ICON.familienhaus },
        { value: 'mfh',            label: 'Mehrfamilienhaus', icon: ICON.mfh },
        { value: 'wohnung',        label: 'Eigentumswohnung', icon: ICON.wohnung },
        { value: 'grundstueck',    label: 'Grundstück',       icon: ICON.grundstueck },
        { value: 'baugrundstueck', label: 'Baugrundstück',    icon: ICON.baugrundstueck }
      ]
    },
    {
      id: 'plot_area',
      title: 'Wie groß ist die Grundstücksfläche?',
      help: 'Gesamtfläche in Quadratmetern (m²).',
      type: 'number', unit: 'm²', min: 1, max: 100000, placeholder: 'z. B. 600'
    },
    {
      id: 'living_area',
      title: 'Wie groß ist die Wohnfläche?',
      help: 'Beheizte Wohnfläche in Quadratmetern (m²).',
      type: 'number', unit: 'm²', min: 1, max: 10000, placeholder: 'z. B. 140',
      skipIf: isLand
    },
    {
      id: 'build_year',
      title: 'Wann wurde die Immobilie gebaut?',
      help: 'Baujahr — bei kernsaniertem Bestand das ursprüngliche Jahr.',
      type: 'number', unit: 'Jahr', min: 1800, max: new Date().getFullYear(), placeholder: 'z. B. 1985',
      skipIf: isLand
    },
    {
      id: 'rooms',
      title: 'Wie viele Zimmer gibt es?',
      help: 'Anzahl der Wohnräume (ohne Küche und Bad).',
      type: 'dropdown',
      options: [
        { value: '1',     label: '1 Zimmer' },
        { value: '2',     label: '2 Zimmer' },
        { value: '3',     label: '3 Zimmer' },
        { value: '4',     label: '4 Zimmer' },
        { value: '5plus', label: 'Mehr als 5 Zimmer' }
      ],
      skipIf: isLand
    },
    {
      id: 'rented',
      title: 'Wird die Immobilie aktuell vermietet?',
      help: 'Bei vermieteten Objekten gelten besondere Fristen — relevant für die Einschätzung.',
      type: 'dropdown',
      options: [
        { value: 'nein', label: 'Nein' },
        { value: 'ja',   label: 'Ja' }
      ],
      skipIf: isLand
    },
    {
      id: 'reason',
      title: 'Was ist der Grund für die Bewertung?',
      help: 'Hilft uns, die Werteinschätzung passend für Ihre Situation aufzubereiten.',
      type: 'dropdown',
      options: [
        { value: 'altersgruende', label: 'Altersgründe' },
        { value: 'gesundheit',    label: 'Gesundheitsgründe' },
        { value: 'erbschaft',     label: 'Erbschaft' },
        { value: 'finanziell',    label: 'Finanzielle Gründe' },
        { value: 'familiaer',     label: 'Familiäre Veränderungen' },
        { value: 'beruflich',     label: 'Berufliche Veränderungen' }
      ]
    },
    {
      id: 'address',
      title: 'Wo befindet sich die Immobilie?',
      help: 'Adresse der zu bewertenden Immobilie. Wir nutzen die Daten ausschließlich für Ihre Werteinschätzung.',
      type: 'address'
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

  // ---- Step-Navigation mit Skip-Logik --------------------
  function isStepVisible(step) {
    return !step.skipIf || !step.skipIf(state.answers);
  }
  function visibleSteps() {
    return QUIZ_STEPS.filter(isStepVisible);
  }
  function currentVisibleIndex() {
    const visible = visibleSteps();
    return Math.max(0, visible.indexOf(QUIZ_STEPS[state.stepIndex]));
  }
  function nextStepIndex() {
    for (let i = state.stepIndex + 1; i < QUIZ_STEPS.length; i++) {
      if (isStepVisible(QUIZ_STEPS[i])) return i;
    }
    return state.stepIndex;
  }
  function prevStepIndex() {
    for (let i = state.stepIndex - 1; i >= 0; i--) {
      if (isStepVisible(QUIZ_STEPS[i])) return i;
    }
    return state.stepIndex;
  }

  // ---- Render --------------------------------------------
  function render() {
    root.innerHTML = '';
    root.appendChild(renderProgress());

    const step = QUIZ_STEPS[state.stepIndex];
    if      (step.type === 'single')   root.appendChild(renderSingle(step));
    else if (step.type === 'number')   root.appendChild(renderNumber(step));
    else if (step.type === 'dropdown') root.appendChild(renderDropdown(step));
    else if (step.type === 'address')  root.appendChild(renderAddress(step));
    else if (step.type === 'lead')     root.appendChild(renderLead(step));
  }

  function renderProgress() {
    const visible = visibleSteps();
    const visIdx  = currentVisibleIndex();
    const outer = create('div', { class: 'quiz-progress-wrap' });
    const wrap = create('div', { class: 'quiz-progress', 'aria-hidden': 'true' });
    visible.forEach((_, i) => {
      const cls = i < visIdx ? 'quiz-progress-step is-done'
                : i === visIdx ? 'quiz-progress-step is-active'
                : 'quiz-progress-step';
      wrap.appendChild(create('span', { class: cls }));
    });
    outer.appendChild(wrap);
    outer.appendChild(create('p', { class: 'quiz-progress-label' }, [
      create('span', { class: 'qpl-num' }, 'Schritt ' + (visIdx + 1) + ' von ' + visible.length),
      create('span', { class: 'qpl-pct' }, Math.round((visIdx) / Math.max(1, visible.length - 1) * 100) + ' % geschafft')
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

  function renderNumber(step) {
    const wrap = create('div', { class: 'quiz-step' });
    wrap.appendChild(create('h3', null, step.title));
    if (step.help) wrap.appendChild(create('p', { class: 'quiz-help' }, step.help));

    const field = create('div', { class: 'quiz-field quiz-field-number' });
    field.appendChild(create('label', { for: 'q-' + step.id }, step.title));

    const inputWrap = create('div', { class: 'number-wrap' });
    const input = create('input', {
      type: 'tel', id: 'q-' + step.id, name: step.id,
      inputmode: 'numeric', pattern: '[0-9]*',
      placeholder: step.placeholder || '',
      value: state.answers[step.id] || ''
    });
    input.addEventListener('keypress', e => {
      if (!/[0-9]/.test(e.key) && e.key !== 'Enter') e.preventDefault();
    });
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 7);
      field.classList.remove('has-error');
    });
    inputWrap.appendChild(input);
    if (step.unit) inputWrap.appendChild(create('span', { class: 'number-unit' }, step.unit));
    field.appendChild(inputWrap);

    const errMsg = 'Bitte geben Sie einen Wert zwischen ' + step.min + ' und ' + step.max + ' ein.';
    field.appendChild(create('p', { class: 'field-error' }, errMsg));
    wrap.appendChild(field);

    const nextBtn = create('button', {
      type: 'button', class: 'btn-solid',
      onclick: () => {
        const val = parseInt(input.value, 10);
        if (!val || isNaN(val) || val < step.min || val > step.max) {
          field.classList.add('has-error'); input.focus(); return;
        }
        state.answers[step.id] = String(val);
        fireQuizStartedOnce(step.id);
        push('quiz_step_completed', { step_id: step.id, value: val, step_index: state.stepIndex });
        state.stepIndex = nextStepIndex();
        render();
      }
    }, ['Weiter ', create('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]);

    const actions = create('div', { class: 'quiz-actions' });
    if (state.stepIndex > 0) actions.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    else actions.appendChild(create('span'));
    actions.appendChild(nextBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  function renderDropdown(step) {
    const wrap = create('div', { class: 'quiz-step' });
    wrap.appendChild(create('h3', null, step.title));
    if (step.help) wrap.appendChild(create('p', { class: 'quiz-help' }, step.help));

    const field = create('div', { class: 'quiz-field quiz-field-select' });
    field.appendChild(create('label', { for: 'q-' + step.id }, step.title));

    const select = create('select', { id: 'q-' + step.id, name: step.id, class: 'quiz-select' });
    select.appendChild(create('option', { value: '', disabled: 'disabled', selected: 'selected' }, '— bitte wählen —'));
    step.options.forEach(opt => {
      const o = create('option', { value: opt.value }, opt.label);
      if (state.answers[step.id] === opt.value) o.setAttribute('selected', 'selected');
      select.appendChild(o);
    });
    select.addEventListener('change', () => field.classList.remove('has-error'));
    field.appendChild(select);
    field.appendChild(create('p', { class: 'field-error' }, 'Bitte wählen Sie eine Option aus.'));
    wrap.appendChild(field);

    const nextBtn = create('button', {
      type: 'button', class: 'btn-solid',
      onclick: () => {
        const val = select.value;
        if (!val) { field.classList.add('has-error'); select.focus(); return; }
        state.answers[step.id] = val;
        fireQuizStartedOnce(step.id);
        push('quiz_step_completed', { step_id: step.id, value: val, step_index: state.stepIndex });
        state.stepIndex = nextStepIndex();
        render();
      }
    }, ['Weiter ', create('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]);

    const actions = create('div', { class: 'quiz-actions' });
    if (state.stepIndex > 0) actions.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    else actions.appendChild(create('span'));
    actions.appendChild(nextBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  function renderAddress(step) {
    const wrap = create('div', { class: 'quiz-step' });
    wrap.appendChild(create('h3', null, step.title));
    if (step.help) wrap.appendChild(create('p', { class: 'quiz-help' }, step.help));

    const a = state.answers;
    const fields = [
      { id: 'street',     label: 'Straße',     type: 'text', autocomplete: 'address-line1',  placeholder: 'z. B. Bahnhofstraße',  gridClass: 'addr-street',  errorMsg: 'Bitte geben Sie die Straße ein.' },
      { id: 'house_no',   label: 'Hausnummer', type: 'text', autocomplete: 'address-line2',  placeholder: 'z. B. 12a',            gridClass: 'addr-houseno', errorMsg: 'Bitte geben Sie die Hausnummer ein.' },
      { id: 'plz',        label: 'PLZ',        type: 'tel',  autocomplete: 'postal-code',    placeholder: 'z. B. 32049',          gridClass: 'addr-plz',     errorMsg: 'Bitte geben Sie eine gültige 5-stellige Postleitzahl ein.', plz: true },
      { id: 'city',       label: 'Ort',        type: 'text', autocomplete: 'address-level2', placeholder: 'z. B. Herford',        gridClass: 'addr-city',    errorMsg: 'Bitte geben Sie den Ort ein.' }
    ];

    const grid = create('div', { class: 'address-grid' });
    const inputs = {};
    fields.forEach(f => {
      const fwrap = create('div', { class: 'quiz-field ' + f.gridClass });
      fwrap.appendChild(create('label', { for: 'q-' + f.id }, f.label));
      const input = create('input', {
        type: f.type, id: 'q-' + f.id, name: f.id,
        autocomplete: f.autocomplete,
        placeholder: f.placeholder,
        value: a[f.id] || ''
      });
      if (f.plz) {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]{5}');
        input.setAttribute('maxlength', '5');
        input.addEventListener('keypress', e => {
          if (!/[0-9]/.test(e.key) && e.key !== 'Enter') e.preventDefault();
        });
        input.addEventListener('input', () => {
          input.value = input.value.replace(/[^0-9]/g, '').slice(0, 5);
          fwrap.classList.remove('has-error');
        });
      } else {
        input.addEventListener('input', () => fwrap.classList.remove('has-error'));
      }
      fwrap.appendChild(input);
      fwrap.appendChild(create('p', { class: 'field-error' }, f.errorMsg));
      grid.appendChild(fwrap);
      inputs[f.id] = { input, fwrap, def: f };
    });
    wrap.appendChild(grid);

    const nextBtn = create('button', {
      type: 'button', class: 'btn-solid',
      onclick: () => {
        let valid = true;
        fields.forEach(f => {
          const { input, fwrap } = inputs[f.id];
          const val = input.value.trim();
          let ok = val.length > 0;
          if (f.plz) ok = /^[0-9]{5}$/.test(val);
          if (!ok) { fwrap.classList.add('has-error'); valid = false; }
          else { fwrap.classList.remove('has-error'); state.answers[f.id] = val; }
        });
        if (!valid) {
          const firstErr = wrap.querySelector('.has-error');
          if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        fireQuizStartedOnce('address');
        push('quiz_step_completed', { step_id: 'address', step_index: state.stepIndex });
        state.stepIndex = nextStepIndex();
        render();
      }
    }, ['Weiter ', create('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]);

    const actions = create('div', { class: 'quiz-actions' });
    actions.appendChild(create('button', { type: 'button', class: 'btn-ghost', onclick: back }, '← Zurück'));
    actions.appendChild(nextBtn);
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
      { id: 'name',  label: 'Vor- und Nachname', type: 'text',  autocomplete: 'name',        pattern: "[-A-Za-zÄÖÜäöüß' .]{2,}.+", placeholder: 'z. B. Maria Musterfrau', errorMsg: 'Bitte geben Sie Vor- und Nachname ein.' },
      { id: 'email', label: 'E-Mail-Adresse',    type: 'email', autocomplete: 'email',       placeholder: 'name@beispiel.de',      errorMsg: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' },
      { id: 'phone', label: 'Telefon (für Ihre persönliche Werteinschätzung)', type: 'tel', autocomplete: 'tel-national', placeholder: '171 1234567', tel: true, errorMsg: 'Bitte geben Sie eine gültige Telefonnummer ein.' }
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

    // Honeypot (Spam-Schutz)
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
      submitLead().then(() => {
        // Redirect auf Danke-Seite — Cal-Embed wird dort gerendert
        window.location.href = CONFIG.thankYouPath + '?type=' + state.leadType;
      }).catch(err => {
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

    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('.quiz-option').forEach(b => {
        b.classList.remove('is-selected');
        b.disabled = true;
      });
      btnEl.classList.add('is-selected', 'just-picked');
    }
    setTimeout(() => { state.stepIndex = nextStepIndex(); render(); }, 300);
  }
  function next() { state.stepIndex = nextStepIndex(); render(); }
  function back() { state.stepIndex = prevStepIndex(); render(); }

  // ---- Routing -------------------------------------------
  function isPLZWithin50kmHerford(plz) {
    if (!plz || plz.length !== 5) return false;
    const prefix = plz.slice(0, 3);
    return PLZ_PREFIX_WHITELIST.indexOf(prefix) !== -1;
  }

  // Nur PLZ-basiertes Routing:
  // - innerhalb 50-km-Radius um Herford → HOT (Termin auf Danke-Seite)
  // - außerhalb → COLD (kein Termin, persönliche Rückmeldung)
  function classifyLead(a) {
    return isPLZWithin50kmHerford(a.plz) ? 'hot' : 'cold';
  }

  // ---- Label-Lookup --------------------------------------
  function labelOf(stepId, value) {
    const step = QUIZ_STEPS.find(s => s.id === stepId);
    if (!step || !step.options) return value;
    const opt = step.options.find(o => o.value === value);
    return opt ? opt.label : value;
  }

  // ---- Submit --------------------------------------------
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
      email:        clean(a.email),
      phone_number: normalizePhone(a.phone),
      address: {
        first_name:  clean(n.first),
        last_name:   clean(n.last),
        street:      clean((a.street || '') + ' ' + (a.house_no || '')).trim(),
        postal_code: clean(a.plz),
        city:        clean(a.city),
        country:     'DE'
      }
    };
  }

  function postWithTimeout(url, payload, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json().catch(() => ({}));
      })
      .then(data => {
        if (data && (data.success === false || data.success === 'false')) {
          throw new Error('API-Fehler: ' + (data.message || 'unbekannt'));
        }
        return data;
      })
      .finally(() => clearTimeout(timer));
  }

  function submitLead() {
    const a = state.answers;
    const leadType = (state.leadType || '').toUpperCase();
    const fullName = (a.name || '').trim();
    const n = splitName(fullName);
    const subject = 'Holzmann Lead [' + leadType + '] — ' + fullName + ' (PLZ ' + a.plz + ')';

    const fullAddress = [a.street, a.house_no].filter(Boolean).join(' ') + ', ' + (a.plz || '') + ' ' + (a.city || '');

    const leadFields = {
      'Weiterleiten an': 'holzmann.immobilien.herford@gmail.com, info@kivonti.de',
      'Lead-Typ':        leadType,
      'Name':            fullName,
      'Vorname':         n.first,
      'Nachname':        n.last,
      'E-Mail':          a.email,
      'Telefon':         a.phone,
      'Objekt-Typ':      labelOf('property_type', a.property_type),
      'Grundstücksfläche (m²)': a.plot_area || '',
      'Wohnfläche (m²)': a.living_area || '–',
      'Baujahr':         a.build_year || '–',
      'Zimmer':          a.rooms ? labelOf('rooms', a.rooms) : '–',
      'Vermietet':       a.rented ? labelOf('rented', a.rented) : '–',
      'Grund der Bewertung': labelOf('reason', a.reason),
      'Adresse Objekt':  fullAddress.trim(),
      'Straße':          a.street || '',
      'Hausnummer':      a.house_no || '',
      'PLZ Objekt':      a.plz || '',
      'Ort':             a.city || '',
      'Quelle':          'verkauf.holzmann-immobilien.de',
      'Zeitstempel':     new Date().toISOString()
    };

    const web3formsPayload = Object.assign({
      access_key: CONFIG.web3formsKey,
      subject:    subject,
      from_name:  'Holzmann Landingpage',
      replyto:    a.email
    }, leadFields);

    // Enhanced Conversions: User-Daten für Google Ads bereitstellen
    const userData = buildEnhancedConversionData(a);
    try { localStorage.setItem('holzmann-ec-userdata', JSON.stringify({ data: userData, ts: Date.now() })); } catch(e) {}

    push('quiz_completed_' + state.leadType, {
      lead_type: state.leadType,
      value: state.leadType === 'hot' ? 200 : 0,
      currency: 'EUR',
      enhanced_conversion_data: userData
    });

    return postWithTimeout(CONFIG.web3formsEndpoint, web3formsPayload, CONFIG.submitTimeoutMs)
      .catch(err => {
        // eslint-disable-next-line no-console
        console.warn('Web3Forms-Versand fehlgeschlagen — starte einen Wiederholungsversuch.', err);
        return postWithTimeout(CONFIG.web3formsEndpoint, web3formsPayload, CONFIG.submitTimeoutMs);
      });
  }

  // ---- Tracking ------------------------------------------
  function push(event, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, data || {}));
  }

  // ---- Init ----------------------------------------------
  document.querySelectorAll('[data-cta]').forEach(btn => {
    btn.addEventListener('click', () => {
      push('cta_click_to_quiz', { source: btn.getAttribute('data-cta') });
    });
  });

  render();
})();
