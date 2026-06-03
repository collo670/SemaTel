global.window={nlp:(t)=>({normalize:()=>({out:()=>t.toLowerCase()}), people:()=>({out:()=>""})})};

/* ==========================================
   1. CONVERSATION STATE MACHINE & DICTIONARY
   ========================================== */
const ConversationState = {
  HOME: 'HOME',
  CLARIFICATION: 'CLARIFICATION',
  AIRTIME_FLOW: 'AIRTIME_FLOW',
  DATA_FLOW: 'DATA_FLOW',
  MONEY_FLOW: 'MONEY_FLOW',
  BALANCE_FLOW: 'BALANCE_FLOW',
  BALANCE_SELECTION: 'BALANCE_SELECTION',
  VOUCHER_FLOW: 'VOUCHER_FLOW',
  ACCOUNT_FLOW: 'ACCOUNT_FLOW',
  HELP_FLOW: 'HELP_FLOW',
  SECURITY_AUTH: 'SECURITY_AUTH',
  PROCESSING: 'PROCESSING',
  RESULT_SCREEN: 'RESULT_SCREEN'
};

const LANGUAGES = {
  sw: {
    welcome: "Karibu SemaTel 👋\nNaweza kukusaidia kufanya huduma za simu kwa njia ya mazungumzo.\nChagua huduma au andika unachotaka kufanya.",
    clarify: "⚠️ **CLARIFICATION**\nSamahani, sijakuelewa vizuri.\nJe unataka kufanya nini?",
    more_help: "❓ **Je, unahitaji msaada zaidi?**",
    confirm_title: "THIBITISHA MUAMALA",
    cancel: "Ghairi", confirm: "Thibitisha", yes: "NDIYO", no: "HAPANA",
    processing: "⚙️ **INASHUGHULIKIA...**\nInatuma ombi kwenye mifumo ya mtandao na malipo...",
    success: "✅ **TRANSACTION SUCCESSFUL**\nMuamala umekamilika kikamilifu.",
    failed: "❌ **TRANSACTION FAILED**\nMuamala umeshindikana.",
    otp_msg: "🔐 **OTP VERIFICATION**\nTumeandika namba ya uhakiki kwenye skrini yako. Tafadhali weka hapa chini ili kuidhinisha:",
    pin_msg: "🔒 **WEKA PIN**\nWeka namba ya siri ya SemaTel Wallet kulinda usalama wako:",
    retry: "Jaribu Tena", home: "Mwanzo"
  },
  en: {
    welcome: "Welcome to SemaTel 👋\nI can help you perform telecom transactions seamlessly via conversation.\nChoose a service or type what you want to do.",
    clarify: "⚠️ **CLARIFICATION**\nSorry, I didn't quite catch that.\nWhat would you like to do?",
    more_help: "❓ **Do you need any further help?**",
    confirm_title: "CONFIRM TRANSACTION",
    cancel: "Cancel", confirm: "Confirm", yes: "YES", no: "NO",
    processing: "⚙️ **PROCESSING...**\nSending request to core telecom and payment gateway layers...",
    success: "✅ **TRANSACTION SUCCESSFUL**\nYour transaction was completed.",
    failed: "❌ **TRANSACTION FAILED**\nTransaction failed.",
    otp_msg: "🔐 **OTP VERIFICATION**\nAn automated verification code is displayed on your screen. Please enter it below to authorize:",
    pin_msg: "🔒 **ENTER PIN**\nEnter your secure SemaTel Wallet PIN:",
    retry: "Retry", home: "Home"
  }
};

/* ==========================================
   2. MEMORY & DATA SYSTEM (MOCK TELECOM DATABASE)
   ========================================== */
let ChatbotMemory = {
  lang: 'sw',
  theme: 'light',
  walletBalance: 84500,
  airtimeBalance: 12500,
  dataBalance: "5.8 GB",
  phoneNumber: "+255 712 345 678",
  network: "Vodacom",
  recentTransactions: [
    { type: 'DATA', details: 'Kifurushi cha Wiki 1.5GB', amt: 2000, date: '2026-05-28' },
    { type: 'MONEY', details: 'Tuma kwa Mama Anna', amt: 15000, date: '2026-05-29' }
  ],
  frequentContacts: [
    { name: "Mama Anna", phone: "0712345678", provider: "Vodacom M-Pesa" },
    { name: "Baba Juma", phone: "0765987321", provider: "Tigo Pesa" },
    { name: "Kaka Ali", phone: "0784111222", provider: "Airtel Money" }
  ]
};

/* ==========================================
   3. NLP + ML INTENT RECOGNITION ENGINE
   ========================================== */
const MLIntentModel = {
  trained: false,
  intents: [],
  vocabulary: {},
  tokenCounts: {},
  priors: {},

  tokenize: function(text) {
    return (text || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  },

  normalizeText: function(text) {
    if (typeof window !== 'undefined' && window.nlp) {
      try {
        return window.nlp(text).normalize({ punctuation: true, whitespace: true, lowercase: true }).out('text');
      } catch (e) {
        return text.toLowerCase();
      }
    }
    return text.toLowerCase();
  },

  train: function(trainingData) {
    this.trained = false;
    this.intents = [];
    this.vocabulary = {};
    this.tokenCounts = {};
    this.priors = {};
    const dataset = trainingData || [];
    const intentCounts = {};

    dataset.forEach(item => {
      const intent = item.intent;
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      this.tokenCounts[intent] = this.tokenCounts[intent] || {};
      const text = this.normalizeText(item.utterance);
      const tokens = this.tokenize(text);
      tokens.forEach(token => {
        this.vocabulary[token] = (this.vocabulary[token] || 0) + 1;
        this.tokenCounts[intent][token] = (this.tokenCounts[intent][token] || 0) + 1;
      });
    });

    this.intents = Array.from(new Set(dataset.map(item => item.intent)));

    const totalDocs = dataset.length;
    Object.keys(intentCounts).forEach(intent => {
      this.priors[intent] = Math.log((intentCounts[intent] + 1) / (totalDocs + Object.keys(intentCounts).length));
    });
    this.trained = true;
  },

  classify: function(text) {
    const intentFallback = {
      intent: 'UNKNOWN', confidence: 0.30, entities: {}
    };
    if (!this.trained || !text || !text.trim()) {
      return intentFallback;
    }

    const normalizedText = this.normalizeText(text);
    const tokens = this.tokenize(normalizedText);
    if (!tokens.length) {
      return intentFallback;
    }

    const scores = {};
    this.intents.forEach((intent, i) => {
      if (!(intent in scores)) scores[intent] = this.priors[intent] || Math.log(1 / (this.intents.length + 1));
      const totalTokenCount = Object.values(this.tokenCounts[intent]).reduce((sum, v) => sum + v, 0) + Object.keys(this.vocabulary).length;
      tokens.forEach(token => {
        const count = this.tokenCounts[intent][token] || 0;
        scores[intent] += Math.log((count + 1) / totalTokenCount);
      });
    });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const bestIntent = sorted[0][0];
    const scoreValues = sorted.map(([_, score]) => Math.exp(score));
    const confidence = scoreValues[0] / scoreValues.reduce((a, b) => a + b, 0);

    const entities = {
      amount: null,
      recipient: null,
      recipientPhone: null,
      provider: null
    };

    const phoneMatch = text.match(/(\+?255\s?7\d{2}\s?\d{3}\s?\d{3}|\+?2557\d{8}|0\d{9}|07\d{8})/g);
    if (phoneMatch) {
      entities.recipientPhone = phoneMatch[0].replace(/\s+/g, '');
      entities.recipient = entities.recipientPhone;
    }

    const amountMatch = text.match(/(\d+[\d,\.]*)\s*(k|ksh|tsh|elfu)?/i);
    if (amountMatch) {
      let amt = parseInt(amountMatch[1].replace(/[,.]/g, ''));
      const suffix = (amountMatch[2] || '').toLowerCase();
      if (suffix === 'k' || suffix === 'elfu') {
        if (amt < 100) amt *= 1000;
      }
      entities.amount = amt;
    }

    if (window.nlp) {
      try {
        const doc = window.nlp(text);
        const people = doc.people().out('text');
        if (people) {
          entities.recipient = people;
        }
      } catch (e) {
        // ignore
      }
    }

    return {
      intent: bestIntent,
      confidence: Math.max(0.01, Math.min(0.99, confidence)),
      entities
    };
  }
};

const AIIntentEngine = {
  parse: function(text) {
    const normalized = (text || '').toLowerCase().trim();
    const mlResult = MLIntentModel.classify(text);
    const providerKeywords = {
      'm-pesa': 'M-Pesa', 'mpesa': 'M-Pesa', 'm pesa': 'M-Pesa', 'vodacom m-pesa': 'M-Pesa',
      'vodacom m pesa': 'M-Pesa', 'vodacom': 'M-Pesa', 'tigo': 'Tigo Pesa', 'tigo pesa': 'Tigo Pesa',
      'tigo-pesa': 'Tigo Pesa', 'airtel': 'Airtel Money', 'airtel money': 'Airtel Money',
      'airtel-money': 'Airtel Money', 'airtelmoney': 'Airtel Money'
    };
    let provider = null;
    Object.keys(providerKeywords).forEach(key => {
      if (new RegExp('\\b' + key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i').test(normalized)) {
        provider = providerKeywords[key];
      }
    });
    if (provider && !mlResult.entities.provider) {
      mlResult.entities.provider = provider;
    }

    // Use ML model result if it is strong enough, otherwise fallback to keyword mapping
    if (mlResult.confidence >= 0.68 && mlResult.intent !== 'UNKNOWN') {
      return mlResult;
    }

    const Fallback = {
      intent: 'UNKNOWN', confidence: 0.30, entities: mlResult.entities
    };
    const containsAny = (arr) => arr.some(w => new RegExp('\\b' + w.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&') + '\\b', 'i').test(normalized));
    const AIRTIME_KEYS = ['airtime','salio','jaza','ongeza','recharge','credit','weka hela','weka','nunua dakika','nunua','ongeza salio','jaza salio','kadi ya malipo'];
    const DATA_KEYS = ['data','kifurushi','bando','kifurushi cha','intaneti','internet','mtandao','mb','gb','bando','kifurushi cha data','bundle','paketi','pakeji'];
    const MONEY_KEYS = ['tuma','tuma pesa','tumia','peleka','transfer','hamisha','lipa','lipia','tuma','tuma shilingi','tuma tsh','pesa','hela','malipo','toa pesa'];
    const BALANCE_KEYS = ['salio','angalia salio','kagua salio','check','balance','balansi','salio langu','angalia','kagua','angalia salio yangu'];
    const VOUCHER_KEYS = ['vocha','voucher','namba ya vocha','ingiza vocha','kuponi','kod','code ya vocha','pin ya vocha','vocha ya airtime','vocha ya mtandao'];
    const ACCOUNT_KEYS = ['akaunti','akaunti yangu','profile','wasifu','taarifa','mimi','dashboard','settings','mipangilio'];
    const HELP_KEYS = ['msaada','saidia','help','maswali','faq','huduma','agent','mtaalamu'];

    const extractor = (arr, intent, confidence) => {
      if (containsAny(arr)) {
        return { intent, confidence, entities: mlResult.entities };
      }
      return null;
    };

    return extractor(BALANCE_KEYS, 'CHECK_BALANCE', 0.97) ||
      extractor(AIRTIME_KEYS, 'BUY_AIRTIME', 0.96) ||
      extractor(DATA_KEYS, 'BUY_DATA_BUNDLE', 0.95) ||
      extractor(MONEY_KEYS, 'SEND_MONEY', 0.94) ||
      extractor(VOUCHER_KEYS, 'REDEEM_VOUCHER', 0.92) ||
      extractor(ACCOUNT_KEYS, 'MY_ACCOUNT', 0.93) ||
      extractor(HELP_KEYS, 'GET_HELP', 0.98) ||
      Fallback;
  }
};

// Train the intent model with sample Swahili/English utterances for higher accuracy
MLIntentModel.train([
  { intent: 'BUY_AIRTIME', utterance: 'Jaza 2000 kwa M-Pesa' },
  { intent: 'BUY_AIRTIME', utterance: 'Nataka kuongeza salio' },
  { intent: 'BUY_AIRTIME', utterance: 'Recharge airtime' },
  { intent: 'BUY_AIRTIME', utterance: 'Nunua airtime ya 10000' },
  { intent: 'BUY_AIRTIME', utterance: 'Tuma salio kwenye simu yangu' },
  { intent: 'BUY_DATA_BUNDLE', utterance: 'Nunua data 1GB' },
  { intent: 'BUY_DATA_BUNDLE', utterance: 'Nataka kifurushi cha internet' },
  { intent: 'BUY_DATA_BUNDLE', utterance: 'Bundle ya data' },
  { intent: 'BUY_DATA_BUNDLE', utterance: 'Pata mtandao wa 5GB' },
  { intent: 'BUY_DATA_BUNDLE', utterance: 'Kifurushi cha mwishoni' },
  { intent: 'SEND_MONEY', utterance: 'Tuma 5000 kwa Mama Anna' },
  { intent: 'SEND_MONEY', utterance: 'Transfer pesa kwa 0712345678' },
  { intent: 'SEND_MONEY', utterance: 'Lipa kwa Baba Juma' },
  { intent: 'SEND_MONEY', utterance: 'Tumia Tigo Pesa kumtuma pesa' },
  { intent: 'SEND_MONEY', utterance: 'Send money to Ali' },
  { intent: 'CHECK_BALANCE', utterance: 'Angalia salio langu' },
  { intent: 'CHECK_BALANCE', utterance: 'Check my balance' },
  { intent: 'CHECK_BALANCE', utterance: 'Salio' },
  { intent: 'CHECK_BALANCE', utterance: 'Balance yangu' },
  { intent: 'CHECK_BALANCE', utterance: 'Kagua salio' },
  { intent: 'REDEEM_VOUCHER', utterance: 'Ingiza vocha' },
  { intent: 'REDEEM_VOUCHER', utterance: 'Voucher code' },
  { intent: 'REDEEM_VOUCHER', utterance: 'Namba ya vocha' },
  { intent: 'REDEEM_VOUCHER', utterance: 'Redeem voucher' },
  { intent: 'REDEEM_VOUCHER', utterance: 'Use voucher' },
  { intent: 'MY_ACCOUNT', utterance: 'Akaunti yangu' },
  { intent: 'MY_ACCOUNT', utterance: 'Show profile' },
  { intent: 'MY_ACCOUNT', utterance: 'Dashboard' },
  { intent: 'MY_ACCOUNT', utterance: 'Taarifa zangu' },
  { intent: 'MY_ACCOUNT', utterance: 'Profile' },
  { intent: 'GET_HELP', utterance: 'Nahitaji msaada' },
  { intent: 'GET_HELP', utterance: 'Help me' },
  { intent: 'GET_HELP', utterance: 'Maswali yanayoulizwa sana' },
  { intent: 'GET_HELP', utterance: 'Saidia' },
  { intent: 'GET_HELP', utterance: 'Support' }
]);

/* ==========================================
   4. CENTRALIZED TRANSACTION ENGINE
   ========================================== */
const TransactionEngine = {
  process: function(txData, onResult) {
    // Structural simulated response mirroring Flowchart step 7, 7A, 7B
    setTimeout(() => {
      // 15% random failure simulation for production realism
      const isSuccess = Math.random() > 0.15;
      if (isSuccess) {
        // Apply deductions updates in application memory
        if (txData.type === 'AIRTIME') {
          ChatbotMemory.airtimeBalance += txData.amount;
          ChatbotMemory.walletBalance -= txData.amount;
        } else if (txData.type === 'DATA') {
          ChatbotMemory.walletBalance -= txData.price;
        } else if (txData.type === 'MONEY') {
          ChatbotMemory.walletBalance -= txData.amount;
        } else if (txData.type === 'VOUCHER') {
          ChatbotMemory.airtimeBalance += txData.amount;
        }
        
        // Log to recent transactions list
        ChatbotMemory.recentTransactions.unshift({
          type: txData.type,
          details: txData.details || `${txData.type} Transaction`,
          amt: txData.amount || txData.price || 0,
          date: new Date().toISOString().split('T')[0]
        });

        onResult({
          status: 'SUCCESS',
          ref: 'ST' + Math.floor(10000000 + Math.random() * 89999999),
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
      } else {
        const failureReasons = ["Insufficient Funds", "Network Timeout Error", "Core Telecommunication API Offline", "Invalid Security Challenge Response"];
        onResult({
          status: 'FAILED',
          reason: failureReasons[Math.floor(Math.random() * failureReasons.length)]
        });
      }
    }, 2000);
  }
};

/* ==========================================
   5. ENGINE CONTROLLER & CONVERSATION LOGIC
   ========================================== */
const Engine = {
  currentState: ConversationState.HOME,
  currentTx: {},
  
  init: function() {
    this.renderWelcome();
  },
  
  translate: function(key) {
    return LANGUAGES[ChatbotMemory.lang][key] || key;
  },

  toggleLanguage: function() {
    ChatbotMemory.lang = ChatbotMemory.lang === 'sw' ? 'en' : 'sw';
    document.getElementById('btnLang').textContent = ChatbotMemory.lang.toUpperCase();
    this.resetToHome();
  },

  toggleDarkMode: function() {
    document.body.classList.toggle('dark-mode');
    ChatbotMemory.theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  },

  showTyping: function(show) {
    document.getElementById('typingIndicator').classList.toggle('show', show);
    const box = document.getElementById('chatBox');
    box.scrollTop = box.scrollHeight;
  },

  addMessage: function(text, sender, elementHTML = null) {
    const box = document.getElementById('chatBox');
    const row = document.createElement('div');
    row.className = `mrow ${sender}`;
    
    if (sender === 'bot') {
      const av = document.createElement('div');
      av.className = 'mav';
      av.textContent = 'ST';
      row.appendChild(av);
    }
    
    const bub = document.createElement('div');
    bub.className = `bub ${sender}`;
    
    if (elementHTML) {
      bub.innerHTML = elementHTML;
    } else {
      bub.innerText = text;
    }
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 't';
    timeSpan.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    bub.appendChild(timeSpan);
    
    row.appendChild(bub);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  },

  setChips: function(chipsArray) {
    const container = document.getElementById('chipContainer');
    container.innerHTML = '';
    chipsArray.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = label;
      btn.onclick = () => {
        this.addMessage(label, 'user');
        this.processUserInput(label);
      };
      container.appendChild(btn);
    });
  },

  resetToHome: function() {
    this.currentState = ConversationState.HOME;
    this.currentTx = {};
    this.renderWelcome();
  },

  renderWelcome: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      
      const gridHTML = `
        <div>${this.translate('welcome').replace(/\n/g, '<br>')}</div>
        <div class="qa-grid">
          <div class="qa-tile" onclick="Engine.routeIntent('BUY_AIRTIME')"><div class="qa-icon">📱</div>Airtime</div>
          <div class="qa-tile" onclick="Engine.routeIntent('BUY_DATA_BUNDLE')"><div class="qa-icon">📶</div>Data</div>
          <div class="qa-tile" onclick="Engine.routeIntent('SEND_MONEY')"><div class="qa-icon">💸</div>Send Money</div>
          <div class="qa-tile" onclick="Engine.routeIntent('CHECK_BALANCE')"><div class="qa-icon">💰</div>Balance</div>
          <div class="qa-tile" onclick="Engine.routeIntent('REDEEM_VOUCHER')"><div class="qa-icon">🎫</div>Voucher</div>
          <div class="qa-tile" onclick="Engine.routeIntent('MY_ACCOUNT')"><div class="qa-icon">👤</div>Account</div>
        </div>
      `;
      this.addMessage(null, 'bot', gridHTML);
      this.setChips(ChatbotMemory.lang === 'sw' ? ['Msaada', 'Salio Langu'] : ['Help', 'My Balance']);
    }, 400);
  },

  sendMessage: function() {
    const el = document.getElementById('userInput');
    const val = el.value.trim();
    if (!val) return;
    el.value = '';
    this.addMessage(val, 'user');
    this.processUserInput(val);
  },

  processUserInput: function(text) {
    // Dynamic State Routing
    if (this.currentState === 'HOME' || this.currentState === 'CLARIFICATION') {
      const evaluation = AIIntentEngine.parse(text);
      if (evaluation.confidence >= 0.80) {
        this.currentTx.amount = evaluation.entities.amount || null;
        // wire recipient if detected
        if (evaluation.entities && evaluation.entities.recipient) {
          this.currentTx.recipient = evaluation.entities.recipient;
        }
        if (evaluation.entities && evaluation.entities.recipientPhone) {
          this.currentTx.recipient = evaluation.entities.recipientPhone;
        }
        // wire provider/payment method if detected (maps to UI labels)
        if (evaluation.entities && evaluation.entities.provider) {
          this.currentTx.paymentMethod = evaluation.entities.provider;
        }
        this.routeIntent(evaluation.intent);
      } else {
        this.currentState = ConversationState.CLARIFICATION;
        this.showTyping(true);
        setTimeout(() => {
          this.showTyping(false);
          this.addMessage(this.translate('clarify'), 'bot');
          this.setChips(['Buy Airtime', 'Buy Data Bundle', 'Send Money', 'Check Balance', 'Redeem Voucher', 'My Account']);
        }, 500);
      }
      return;
    }

    // Direct routing maps inside specific states
    if (this.currentState === 'AIRTIME_CUSTOM_AMT') {
      const amt = parseInt(text.replace(/\D/g, ''));
      if (amt > 0) {
        this.currentTx.amount = amt;
        this.promptAirtimePayment();
      } else {
        this.addMessage("Weka kiasi halali cha fedha.", "bot");
      }
      return;
    }

    if (this.currentState === 'MONEY_CUSTOM_REC') {
      this.currentTx.recipient = text;
      this.promptMoneyAmount();
      return;
    }

    if (this.currentState === 'MONEY_CUSTOM_AMT') {
      const amt = parseInt(text.replace(/\D/g, ''));
      if (amt > 0) {
        this.currentTx.amount = amt;
        this.promptMoneyPayment();
      } else {
        this.addMessage("Weka kiasi cha kuanzia Tsh 100.", "bot");
      }
      return;
    }

    if (this.currentState === ConversationState.BALANCE_SELECTION || this.currentState === 'BALANCE_SELECTION') {
      const answer = text.toLowerCase();
      if (/airtime|salio|mtandao|data|wallet|wallet balance|wallet saldo|wallet salio/i.test(answer)) {
        if (/airtime|salio/i.test(answer) && !/wallet/i.test(answer)) {
          this.selectBalanceType('AIRTIME');
          return;
        }
        if (/data|mtandao/i.test(answer)) {
          this.selectBalanceType('DATA');
          return;
        }
        if (/wallet|wallet balance|balansi|salio la wallet/i.test(answer)) {
          this.selectBalanceType('WALLET');
          return;
        }
      }
      this.addMessage("Tafadhali chagua moja ya chaguo hapo juu: Airtime, Data, au Wallet.", 'bot');
      return;
    }

    if (this.currentState === 'VOUCHER_CODE_INPUT') {
      if (text.length >= 5) {
        this.currentTx.voucherCode = text.toUpperCase();
        this.triggerSecurityGate('VOUCHER');
      } else {
        this.addMessage("Namba ya vocha haijakamilika.", "bot");
      }
      return;
    }
  },

  routeIntent: function(intent) {
    this.currentTx.type = intent;
    
    switch(intent) {
      case 'BUY_AIRTIME':
        this.currentState = ConversationState.AIRTIME_FLOW;
        this.showAirtimeOptions();
        break;
      case 'BUY_DATA_BUNDLE':
        this.currentState = ConversationState.DATA_FLOW;
        this.showDataCategories();
        break;
      case 'SEND_MONEY':
        this.currentState = ConversationState.MONEY_FLOW;
        if (this.currentTx.recipient) {
          // recipient already detected from text — proceed to amount step
          this.promptMoneyAmount();
        } else {
          this.showMoneyRecipientStep();
        }
        break;
      case 'CHECK_BALANCE':
        this.currentState = ConversationState.BALANCE_FLOW;
        this.showBalanceOptions();
        break;
      case 'REDEEM_VOUCHER':
        this.currentState = ConversationState.VOUCHER_FLOW;
        this.showVoucherFlow();
        break;
      case 'MY_ACCOUNT':
        this.currentState = ConversationState.ACCOUNT_FLOW;
        this.showAccountDashboard();
        break;
      case 'GET_HELP':
        this.showHelpCenter();
        break;
      default:
        this.resetToHome();
    }
  },

  /* ==========================================
     A. BUY AIRTIME FLOW SUB-MODULE
     ========================================== */
  showAirtimeOptions: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      if (this.currentTx.amount) {
        // if a payment method was pre-detected (e.g., M-Pesa), auto-select it
        if (this.currentTx.paymentMethod) {
          this.selectAirtimePay(this.currentTx.paymentMethod);
          return;
        }
        this.promptAirtimePayment();
      } else {
        const html = `
          <div style="font-weight:600;margin-bottom:6px;">A1. Chagua Kiasi cha Airtime:</div>
          <button class="btn-block" onclick="Engine.selectAirtimeAmt(1000)">Tsh 1,000</button>
          <button class="btn-block" onclick="Engine.selectAirtimeAmt(2000)">Tsh 2,000</button>
          <button class="btn-block" onclick="Engine.selectAirtimeAmt(5000)">Tsh 5,000</button>
          <button class="btn-sub" style="margin-top:4px; width:100%;" onclick="Engine.setCustomAirtimeAmt()">Kiasi Kingine</button>
        `;
        this.addMessage(null, 'bot', html);
      }
    }, 400);
  },

  selectAirtimeAmt: function(amt) {
    this.currentTx.amount = amt;
    this.promptAirtimePayment();
  },

  setCustomAirtimeAmt: function() {
    this.currentState = 'AIRTIME_CUSTOM_AMT';
    this.addMessage("Andika kiasi unachotaka kuweka (Mfano: 1500):", "bot");
  },

  promptAirtimePayment: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      const html = `
        <div style="font-weight:600;margin-bottom:6px;">A3. Chagua Njia ya Malipo:</div>
        <button class="btn-block" onclick="Engine.selectAirtimePay('M-Pesa')">Vodacom M-Pesa</button>
        <button class="btn-block" onclick="Engine.selectAirtimePay('Tigo Pesa')">Tigo Pesa</button>
        <button class="btn-block" onclick="Engine.selectAirtimePay('Airtel Money')">Airtel Money</button>
      `;
      this.addMessage(null, 'bot', html);
    }, 400);
  },

  selectAirtimePay: function(method) {
    this.currentTx.paymentMethod = method;
    this.currentTx.details = `Airtime Recharge (${this.currentTx.amount})`;
    this.showConfirmationCard();
  },

  /* ==========================================
     B. DATA BUNDLE FLOW SUB-MODULE
     ========================================== */
  showDataCategories: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      const html = `
        <div style="font-weight:600;margin-bottom:6px;">B1. Chagua Aina ya Kifurushi:</div>
        <button class="btn-block" onclick="Engine.showBundlesList('Daily')">📅 Kifurushi cha Siku (Daily)</button>
        <button class="btn-block" onclick="Engine.showBundlesList('Weekly')">🗓️ Kifurushi cha Wiki (Weekly)</button>
        <button class="btn-block" onclick="Engine.showBundlesList('Monthly')">🚀 Kifurushi cha Mwezi (Monthly)</button>
      `;
      this.addMessage(null, 'bot', html);
    }, 400);
  },

  showBundlesList: function(category) {
    let bundles = [];
    if (category === 'Daily') {
      bundles = [{name: "500MB Shimmer", price: 500, val: "Masaa 24"}, {name: "1GB Max", price: 1000, val: "Masaa 24"}];
    } else if (category === 'Weekly') {
      bundles = [{name: "3GB Wiki", price: 3000, val: "Siku 7"}, {name: "5GB Extreme", price: 5000, val: "Siku 7"}];
    } else {
      bundles = [{name: "15GB Heavyweight", price: 15000, val: "Siku 30"}, {name: "30GB Unlimited", price: 30000, val: "Siku 30"}];
    }

    let listHTML = `<div style="font-weight:600;margin-bottom:6px;">B2. Chagua Bando Lako:</div>`;
    bundles.forEach((b, idx) => {
      listHTML += `
        <div class="rcard" style="cursor:pointer;" onclick="Engine.selectDataBundle('${b.name}', ${b.price}, '${b.val}')">
          <div style="font-weight:700; color:var(--g8);">${b.name}</div>
          <div style="font-size:11px; color:var(--mut);">Gharama: Tsh ${b.price.toLocaleString()} | Muda: ${b.val}</div>
        </div>
      `;
    });
    this.addMessage(null, 'bot', listHTML);
  },

  selectDataBundle: function(name, price, validity) {
    this.currentTx.price = price;
    this.currentTx.details = `Data: ${name} (${validity})`;
    this.currentTx.paymentMethod = "SemaTel Wallet Balance";
    this.showConfirmationCard();
  },

  /* ==========================================
     C. SEND MONEY FLOW SUB-MODULE
     ========================================== */
  showMoneyRecipientStep: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      let html = `<div style="font-weight:600;margin-bottom:6px;">C1. Chagua Mpokeaji wa Fedha:</div>`;
      ChatbotMemory.frequentContacts.forEach(c => {
        html += `
          <div class="rcard" style="cursor:pointer; padding:8px;" onclick="Engine.selectMoneyRecipient('${c.name} - ${c.phone}')">
            <strong>👤 ${c.name}</strong><br><span style="font-size:11px;color:var(--mut);">${c.phone} (${c.provider})</span>
          </div>
        `;
      });
      html += `<button class="btn-sub" style="margin-top:6px;width:100%;" onclick="Engine.setCustomRecipient()">Weka Namba Nyingine</button>`;
      this.addMessage(null, 'bot', html);
    }, 400);
  },

  selectMoneyRecipient: function(rec) {
    this.currentTx.recipient = rec;
    this.promptMoneyAmount();
  },

  setCustomRecipient: function() {
    this.currentState = 'MONEY_CUSTOM_REC';
    this.addMessage("Tafadhali andika namba ya simu ya mpokeaji:", "bot");
  },

  promptMoneyAmount: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      if (this.currentTx.amount) {
        this.promptMoneyPayment();
      } else {
        this.currentState = 'MONEY_CUSTOM_AMT';
        this.addMessage(`Weka kiasi unachotaka kumtumia ${this.currentTx.recipient}:`, 'bot');
        this.setChips(['1000', '5000', '10000', '25000']);
      }
    }, 400);
  },

  promptMoneyPayment: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      if (this.currentTx.paymentMethod) {
        this.selectMoneyPay(this.currentTx.paymentMethod);
        return;
      }
      const html = `
        <div style="font-weight:600;margin-bottom:6px;">C3. Chagua Mkoba wa Kutoa Pesa:</div>
        <button class="btn-block" onclick="Engine.selectMoneyPay('SemaTel Wallet')">SemaTel Wallet Balance</button>
        <button class="btn-block" onclick="Engine.selectMoneyPay('M-Pesa')">Vodacom M-Pesa</button>
        <button class="btn-block" onclick="Engine.selectMoneyPay('Tigo Pesa')">Tigo Pesa</button>
        <button class="btn-block" onclick="Engine.selectMoneyPay('Airtel Money')">Airtel Money</button>
        <button class="btn-block" onclick="Engine.selectMoneyPay('Halotel')">Halotel Money</button>
        <button class="btn-block" onclick="Engine.selectMoneyPay('TTCL')">TTCL Mobile Money</button>
      `;
      this.addMessage(null, 'bot', html);
    }, 400);
  },

  selectMoneyPay: function(method) {
    this.currentTx.paymentMethod = method;
    this.currentTx.details = `Tuma pesa kwenda kwa ${this.currentTx.recipient}`;
    this.showConfirmationCard();
  },

  showBalanceOptions: function() {
    this.currentState = ConversationState.BALANCE_SELECTION;
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      const html = `
        <div style="font-weight:600;margin-bottom:6px;">D1. Chagua Salio Unayotaka Kuangalia:</div>
        <button class="btn-block" onclick="Engine.selectBalanceType('AIRTIME')">Airtime Balance</button>
        <button class="btn-block" onclick="Engine.selectBalanceType('DATA')">Data Remaining</button>
        <button class="btn-block" onclick="Engine.selectBalanceType('WALLET')">Wallet Balance</button>
      `;
      this.addMessage(null, 'bot', html);
    }, 400);
  },

  selectBalanceType: function(type) {
    this.currentTx.balanceType = type;
    this.showSelectedBalance();
  },

  showSelectedBalance: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      let detail = '';
      if (this.currentTx.balanceType === 'AIRTIME') {
        detail = `Airtime Balance: Tsh ${ChatbotMemory.airtimeBalance.toLocaleString()}`;
      } else if (this.currentTx.balanceType === 'DATA') {
        detail = `Data Remaining: ${ChatbotMemory.dataBalance}`;
      } else {
        detail = `Wallet Balance: Tsh ${ChatbotMemory.walletBalance.toLocaleString()}`;
      }
      const html = `
        <div class="rcard">
          <div class="rcard-title">📋 Balance Result</div>
          <div class="rcard-row"><span>${detail}</span></div>
        </div>
      `;
      this.addMessage(null, 'bot', html);
      this.askMoreHelp();
    }, 400);
  },

  /* ==========================================
     D. BALANCE DISPLAY MODULE
     ========================================== */
  showBalanceDashboard: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      const html = `
        <div class="rcard">
          <div class="rcard-title">📋 Dashboard ya Salio</div>
          <div class="rcard-row"><span>Airtime Balance:</span><span>Tsh ${ChatbotMemory.airtimeBalance.toLocaleString()}</span></div>
          <div class="rcard-row"><span>Data Remaining:</span><span>${ChatbotMemory.dataBalance}</span></div>
          <div class="rcard-row"><span>SemaTel Wallet:</span><span>Tsh ${ChatbotMemory.walletBalance.toLocaleString()}</span></div>
        </div>
      `;
      this.addMessage(null, 'bot', html);
      this.askMoreHelp();
    }, 500);
  },

  /* ==========================================
     E. REDEEM VOUCHER SUB-MODULE
     ========================================== */
  showVoucherFlow: function() {
    this.currentState = 'VOUCHER_CODE_INPUT';
    this.addMessage("E1. Tafadhali andika namba ya siri ya vocha yako (digits 12-14):", "bot");
  },

  /* ==========================================
     F. MY ACCOUNT ACCOUNT DASHBOARD WIDGETS
     ========================================== */
  showAccountDashboard: function() {
    this.showTyping(true);
    setTimeout(() => {
      this.showTyping(false);
      let recentHTML = '';
      ChatbotMemory.recentTransactions.slice(0, 2).forEach(t => {
        recentHTML += `<div style="font-size:11px;border-bottom:1px solid var(--bdr);padding:3px 0;">• ${t.details} - Tsh ${t.amt} (${t.date})</div>`;
      });
      
      const html = `
        <div class="rcard">
          <div class="rcard-title">👤 Akaunti Yangu</div>
          <div class="rcard-row"><span>Namba:</span><span>${ChatbotMemory.phoneNumber}</span></div>
          <div class="rcard-row"><span>Mtandao:</span><span>${ChatbotMemory.network}</span></div>
          <div class="rcard-row"><span>Wallet:</span><span>Tsh ${ChatbotMemory.walletBalance.toLocaleString()}</span></div>
          <div style="margin-top:8px;font-weight:600;font-size:11.5px;color:var(--g8);">Miamala ya Hivi Karibuni:</div>
          ${recentHTML}
        </div>
      `;
      this.addMessage(null, 'bot', html);
      this.askMoreHelp();
    }, 500);
  },

  /* ==========================================
     G. HELP CENTER
     ========================================== */
  showHelpCenter: function() {
    const html = `
      <div class="rcard">
        <div class="rcard-title">💡 Msaada & Huduma</div>
        <button class="btn-block" style="font-size:11px;padding:6px;" onclick="alert('FAQs under system updates')">Maswali Yanayoulizwa Sana (FAQs)</button>
        <button class="btn-block" style="font-size:11px;padding:6px;" onclick="alert('Connecting to live agent Adapter...')">Ongea na Muhudumu</button>
        <button class="btn-block" style="font-size:11px;padding:6px;" onclick="Engine.resetToHome()">Rudi Mwanzo</button>
      </div>
    `;
    this.addMessage(null, 'bot', html);
  },

  /* ==========================================
     H. HIGHLY CONFIGURABLE SECURITY GATE (OTP/PIN)
     ========================================== */
  triggerSecurityGate: function(type) {
    this.currentState = ConversationState.SECURITY_AUTH;
    const modal = document.getElementById('securityModal');
    const content = document.getElementById('securityModalContent');
    
    if (type === 'VOUCHER') {
      // Simulate direct automatic Voucher Parsing injection
      this.currentTx.amount = 5000; 
      this.executeCentralizedEngine();
      return;
    }

    // Generating cryptographic random security code
    const generatedOTP = Math.floor(100000 + Math.random() * 899999);
    
    content.innerHTML = `
      <div style="text-align:center;">
        <div>${this.translate('otp_msg')}</div>
        <div style="font-size:24px; font-weight:800; background:var(--g0); padding:10px; margin:12px 0; border-radius:12px; letter-spacing:4px; color:var(--g9);">${generatedOTP}</div>
        <input type="number" id="otpVal" class="btn-block" style="background:var(--bg);color:var(--txt);text-align:center;font-size:18px;" placeholder="******">
        <button class="btn-block" onclick="Engine.verifyOTPCode(${generatedOTP})">${this.translate('confirm')}</button>
        <button class="btn-sub" style="width:100%;margin-top:6px;" onclick="Engine.closeSecurityDialog()">Cancel</button>
      </div>
    `;
    modal.classList.add('show');
  },

  verifyOTPCode: function(correctOTP) {
    const entered = document.getElementById('otpVal').value.trim();
    if (entered == correctOTP) {
      // Elevate security verification clear into secure PIN request mapping
      this.promptWalletSecurePIN();
    } else {
      alert("Verification Code is Incorrect! Please authorize properly.");
    }
  },

  promptWalletSecurePIN: function() {
    const content = document.getElementById('securityModalContent');
    content.innerHTML = `
      <div style="text-align:center;">
        <div>${this.translate('pin_msg')}</div>
        <div style="font-size:24px; font-weight:800; margin:8px 0; letter-spacing:6px;" id="pinStars">****</div>
        <input type="password" id="pinVal" maxlength="4" readonly style="display:none;">
        <div class="pin-grid">
          <div class="pin-btn" onclick="Engine.pressPIN(1)">1</div>
          <div class="pin-btn" onclick="Engine.pressPIN(2)">2</div>
          <div class="pin-btn" onclick="Engine.pressPIN(3)">3</div>
          <div class="pin-btn" onclick="Engine.pressPIN(4)">4</div>
          <div class="pin-btn" onclick="Engine.pressPIN(5)">5</div>
          <div class="pin-btn" onclick="Engine.pressPIN(6)">6</div>
          <div class="pin-btn" onclick="Engine.pressPIN(7)">7</div>
          <div class="pin-btn" onclick="Engine.pressPIN(8)">8</div>
          <div class="pin-btn" onclick="Engine.pressPIN(9)">9</div>
          <div class="pin-btn" style="background:var(--r1);color:var(--r6);" onclick="Engine.closeSecurityDialog()">X</div>
          <div class="pin-btn" onclick="Engine.pressPIN(0)">0</div>
          <div class="pin-btn" style="background:var(--g1);color:var(--g8);" onclick="Engine.submitSecurePIN()">✓</div>
        </div>
      </div>
    `;
    this.enteredPIN = "";
  },

  pressPIN: function(num) {
    if (this.enteredPIN.length < 4) {
      this.enteredPIN += num;
      document.getElementById('pinStars').textContent = "●".repeat(this.enteredPIN.length) + "*".repeat(4 - this.enteredPIN.length);
    }
  },

  submitSecurePIN: function() {
    if (this.enteredPIN.length === 4) {
      this.closeSecurityDialog();
      this.executeCentralizedEngine();
    }
  },

  closeSecurityDialog: function() {
    document.getElementById('securityModal').classList.remove('show');
    this.resetToHome();
  },

  /* ==========================================
     I. ENGINE ACTION HANDLING & SCREEN GENERATION
     ========================================== */
  showConfirmationCard: function() {
    const html = `
      <div class="rcard">
        <div class="rcard-title">⚙️ ${this.translate('confirm_title')}</div>
        <div class="rcard-row"><span>Huduma:</span><span>${this.currentTx.type}</span></div>
        <div class="rcard-row"><span>Maelezo:</span><span>${this.currentTx.details}</span></div>
        <div class="rcard-row"><span>Kiasi/Gharama:</span><span>Tsh ${(this.currentTx.amount || this.currentTx.price || 0).toLocaleString()}</span></div>
        <div class="rcard-row"><span>Njia ya Malipo:</span><span>${this.currentTx.paymentMethod}</span></div>
        <div class="btn-group">
          <button class="btn-sub" onclick="Engine.resetToHome()">${this.translate('cancel')}</button>
          <button class="btn-block" style="margin-top:0;" onclick="Engine.triggerSecurityGate()">${this.translate('confirm')}</button>
        </div>
      </div>
    `;
    this.addMessage(null, 'bot', html);
  },

  executeCentralizedEngine: function() {
    this.currentState = ConversationState.PROCESSING;
    
    // Shimmer placeholder state generation
    const shimID = 'shim_' + Date.now();
    const shimHTML = `
      <div id="${shimID}">
        <div>${this.translate('processing').replace(/\n/g, '<br>')}</div>
        <div class="shimmer" style="height:12px; margin-top:8px; border-radius:6px; width:100%;"></div>
        <div class="shimmer" style="height:12px; margin-top:4px; border-radius:6px; width:75%;"></div>
      </div>
    `;
    this.addMessage(null, 'bot', shimHTML);

    TransactionEngine.process(this.currentTx, (res) => {
      // Safely tear down dynamic runtime skeleton container
      const container = document.getElementById(shimID);
      if (container) container.parentElement.parentElement.remove();

      this.currentState = ConversationState.RESULT_SCREEN;
      if (res.status === 'SUCCESS') {
        const successHTML = `
          <div class="rcard" style="border-left: 4px solid var(--g5);">
            <div style="color:var(--g8);font-weight:700;font-size:14px;margin-bottom:6px;">${this.translate('success')}</div>
            <div class="rcard-row"><span>Ref Number:</span><span>${res.ref}</span></div>
            <div class="rcard-row"><span>Date/Time:</span><span>${res.date} | ${res.time}</span></div>
            <div class="rcard-row"><span>Transaction:</span><span>${this.currentTx.details}</span></div>
          </div>
        `;
        this.addMessage(null, 'bot', successHTML);
      } else {
        const failedHTML = `
          <div class="rcard" style="border-left: 4px solid var(--r6); background: var(--r1);">
            <div style="color:var(--r6);font-weight:700;font-size:14px;margin-bottom:4px;">${this.translate('failed')}</div>
            <div style="font-size:12px;color:var(--txt);">Sababu: [${res.reason}]</div>
            <button class="btn-block" style="background:var(--r6);" onclick="Engine.retryTransaction()">🔄 ${this.translate('retry')}</button>
          </div>
        `;
        this.addMessage(null, 'bot', failedHTML);
      }
      this.askMoreHelp();
    });
  },

  retryTransaction: function() {
    this.showConfirmationCard();
  },

  askMoreHelp: function() {
    setTimeout(() => {
      this.addMessage(this.translate('more_help'), 'bot');
      this.setChips(ChatbotMemory.lang === 'sw' ? ['NDIYO', 'HAPANA, ASANTE'] : ['YES', 'NO, THANK YOU']);
      this.currentState = 'HOME'; // Ready for fresh pipeline loop back context evaluation
    }, 1000);
  }
};

// Start system instantiation mapping
window.onload = () => Engine.init();
