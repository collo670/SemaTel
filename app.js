/* ============================================================
   SEMATEL ENGINE v5
   "One message → One intent → One PIN → One result."
   Layers:
     1. NLU        — parse(text) → intent + entities (slots)
     2. SERVICES   — declarative slot specs per service
     3. TX ENGINE  — universal fill → review → PIN → execute
     4. UI         — chat renderer, cards, chips, sheets
     5. VOICE      — Web Speech input (+ iOS standalone relay)
     6. PWA        — service worker, install, offline queue
   ============================================================ */
'use strict';

/* ============================ 0. DATA ============================ */
/* Official TCRA operator allocations — keyed by the 2 digits after the leading 0.
   61/62 Halotel · 65/67/71 Tigo (now Yas) · 77 Zantel (merged into Yas)
   68/69/78 Airtel · 74/75/76 Vodacom · 73 TTCL                        */
const NETWORK_PREFIX2={
  '61':'Halotel','62':'Halotel',
  '65':'Yas (Tigo)','67':'Yas (Tigo)','71':'Yas (Tigo)','77':'Yas (Tigo)',
  '68':'Airtel','69':'Airtel','78':'Airtel',
  '74':'Vodacom','75':'Vodacom','76':'Vodacom',
  '73':'TTCL'
};
const NETWORK_WALLET={'Vodacom':'M-Pesa','Airtel':'Airtel Money','Yas (Tigo)':'Mixx by Yas','Halotel':'HaloPesa','TTCL':'T-Pesa'};
const NETWORK_COLOR={'Vodacom':'#e00','Airtel':'#e53','Yas (Tigo)':'#3B2E8C','Halotel':'#a0c','TTCL':'#c60'};
const WALLET_LIST=['M-Pesa','Airtel Money','Mixx by Yas','HaloPesa','T-Pesa'];

/* Street-Swahili amounts (longest keys matched first) */
const STREET_AMOUNTS={
  'jero':500,'mia tano':500,'nusu elfu':500,'mia moja':100,'mia mbili':200,'mia':100,
  'buku mbili':2000,'mbili buku':2000,'elfu mbili':2000,'buku tatu':3000,'elfu tatu':3000,
  'buku nne':4000,'elfu nne':4000,'buku tano':5000,'elfu tano':5000,
  'buku sita':6000,'elfu sita':6000,'buku saba':7000,'elfu saba':7000,
  'buku nane':8000,'elfu nane':8000,'buku tisa':9000,'elfu tisa':9000,
  'buku kumi':10000,'elfu kumi':10000,'kumi':10000,
  'ishirini':20000,'thelathini':30000,'arobaini':40000,'hamsini':50000,
  'sitini':60000,'sabini':70000,'themanini':80000,'tisini':90000,
  'laki moja':100000,'laki mbili':200000,'laki tatu':300000,'laki nne':400000,'laki tano':500000,'laki':100000,
  'buku':1000,'elfu moja':1000,'elfu':1000,'kibuyu':1000,'tano':5000
};
/* Street products → intent + prefilled slots */
const STREET_PRODUCTS={
  'sms za jero':{intent:'SMS',amount:500},'sms za buku':{intent:'SMS',amount:1000},
  'meseji za jero':{intent:'SMS',amount:500},
  'dakika za jero':{intent:'MINUTES',amount:500},'dakika za buku':{intent:'MINUTES',amount:1000},
  'net ya buku':{intent:'DATA',amount:1000},'net ya jero':{intent:'DATA',amount:500},
  'bando la buku':{intent:'DATA',amount:1000},'bando la jero':{intent:'DATA',amount:500},
  'nusu gb':{intent:'DATA',productMB:512},'nusu giga':{intent:'DATA',productMB:512},
  'gb moja':{intent:'DATA',productMB:1024},'giga moja':{intent:'DATA',productMB:1024},
  'gb mbili':{intent:'DATA',productMB:2048},'gb tatu':{intent:'DATA',productMB:3072},
  'gb tano':{intent:'DATA',productMB:5120},'gb kumi':{intent:'DATA',productMB:10240}
};
/* Swahili GB counting words: "gb mbili" handled above; digits handled in NLU */

const DATA_CATALOGUE=[
  {name:'500MB Kila Siku',gb:.5,price:500, validity:'Masaa 24',period:'daily'},
  {name:'1GB Kila Siku', gb:1, price:1000,validity:'Masaa 24',period:'daily'},
  {name:'1GB Wiki',      gb:1, price:2000,validity:'Siku 7',  period:'weekly'},
  {name:'2GB Wiki',      gb:2, price:2500,validity:'Siku 7',  period:'weekly'},
  {name:'3GB Wiki',      gb:3, price:3000,validity:'Siku 7',  period:'weekly'},
  {name:'5GB Wiki',      gb:5, price:5000,validity:'Siku 7',  period:'weekly'},
  {name:'10GB Mwezi',    gb:10,price:10000,validity:'Siku 30',period:'monthly'},
  {name:'15GB Mwezi',    gb:15,price:15000,validity:'Siku 30',period:'monthly'},
  {name:'20GB Mwezi',    gb:20,price:20000,validity:'Siku 30',period:'monthly'},
  {name:'30GB Mwezi',    gb:30,price:30000,validity:'Siku 30',period:'monthly'}
];
const SMS_CATALOGUE=[
  {name:'100 SMS',count:100,price:500,validity:'Siku 7'},
  {name:'250 SMS',count:250,price:1000,validity:'Siku 14'},
  {name:'500 SMS',count:500,price:2000,validity:'Siku 30'}
];
const MINUTE_CATALOGUE=[
  {name:'50 Dakika', minutes:50, price:500, validity:'Siku 1'},
  {name:'100 Dakika',minutes:100,price:1000,validity:'Siku 7'},
  {name:'250 Dakika',minutes:250,price:2000,validity:'Siku 14'},
  {name:'500 Dakika',minutes:500,price:4000,validity:'Siku 30'}
];
const VOUCHER_CODES={
  'STAIR1000':{type:'AIRTIME',value:1000},'STAIR5000':{type:'AIRTIME',value:5000},
  'STDATA1GB':{type:'DATA',value:1024},'STDATA5GB':{type:'DATA',value:5120},
  'DEMO12345':{type:'AIRTIME',value:1000},'DEMO54321':{type:'DATA',value:2048}
};
const TV_PROVIDERS=[
  {name:'DStv',icon:'📡',keys:['dstv']},
  {name:'Azam TV',icon:'🔵',keys:['azam']},
  {name:'Startimes',icon:'⭐',keys:['startimes','starttime','star times']},
  {name:'DAWASA (Maji)',icon:'💧',keys:['dawasa','dawasco','maji','water']}
];
const GOVT_SERVICES=[
  {name:'TRA — Kodi',icon:'🏛️',code:'TRA',keys:['tra','kodi','tax','vat']},
  {name:'RITA — Usajili',icon:'📋',code:'RITA',keys:['rita','usajili','cheti']},
  {name:'BRELA — Biashara',icon:'🏢',code:'BRELA',keys:['brela','biashara']},
  {name:'NSSF — Mchango',icon:'🛡️',code:'NSSF',keys:['nssf','mchango','pension']}
];
const INTL_DESTINATIONS=[
  {country:'Kenya', flag:'🇰🇪',wallet:'M-Pesa Kenya',   cur:'KES',rate:.031,keys:['kenya','nairobi','ke']},
  {country:'Uganda',flag:'🇺🇬',wallet:'MTN Money',      cur:'UGX',rate:1.43, keys:['uganda','kampala','ug']},
  {country:'Zambia',flag:'🇿🇲',wallet:'Airtel Money ZM',cur:'ZMW',rate:.0104,keys:['zambia','lusaka','zm']},
  {country:'Rwanda',flag:'🇷🇼',wallet:'MTN Rwanda',     cur:'RWF',rate:.54,  keys:['rwanda','kigali','rw']}
];

/* Intent lexicon — phrases matched on word boundaries, longest first */
const LEXICON={
  AIRTIME:['muda wa maongezi','ongeza salio','nunua salio','jaza salio','weka salio','niongezee salio','buy airtime','add airtime','nunua airtime','recharge','airtime','vocha ya salio','credit','salio la kuongea'],
  MINUTES:['dakika za kupiga','nipe dakika','nunua dakika','buy minutes','dakika','miniti','minutes'],
  DATA:['bando la internet','kifurushi cha internet','kifurushi cha data','vifurushi vya data','nunua data','ongeza data','nipe internet','nahitaji gb','nataka data','bando','bundle','vifurushi','kifurushi','neti','net','intaneti','internet','mtandao','paketi','data','mb','gb','giga'],
  SMS:['ujumbe mfupi','kifurushi cha sms','nunua sms','sms bundle','buy sms','meseji','message','sms','msg'],
  BALANCE:['angalia salio','kagua salio','salio langu','salio lililobaki','check balance','check salio','nicheki salio','balansi','balance','salio','baki yangu','check data','baki'],
  VOUCHER:['ingiza vocha','namba ya vocha','voucher code','redeem voucher','use voucher','vocha','voucher'],
  MONEY:['tuma pesa','tuma hela','tuma shilingi','peleka pesa','peleka hela','mtumie','nitumie','mpelekee','hamisha pesa','send money','tuma','peleka','transfer','hela','mpe'],
  LUKU:['nunua luku','nunua umeme','lipa umeme','token ya umeme','buy luku','luku','umeme','tanesco','electricity','token','meta','mita','meter'],
  BILLS:['lipa bili','bili ya maji','bili ya tv','king\'amuzi','dstv','azam tv','startimes','dawasa','dawasco','tv licence','water bill','pay bills','bili','bill'],
  INTL:['tuma pesa nje','pesa nje ya nchi','international transfer','tuma kenya','tuma uganda','tuma zambia','tuma rwanda','tuma nje','international'],
  GOVT:['malipo ya serikali','control number','namba ya malipo','serikali','tra','rita','brela','nssf','kodi','gepg','government','tax'],
  SCHOOL:['ada ya shule','ada ya chuo','lipa karo','school fees','karo','ada'],
  PAYBILL:['lipa namba','paybill','lipa number','till number','till','bill number'],
  HISTORY:['miamala yangu','historia','history','transactions','risiti zangu','miamala'],
  USAGE:['ripoti ya matumizi','matumizi yangu','nimetumia kiasi gani','matumizi','spending','usage report','usage','takwimu','ripoti'],
  REPEAT:['rudia muamala','kama kawaida','rudia tena','ile ile','rudia','repeat','again'],
  ACCOUNT:['akaunti yangu','akaunti','profile','mipangilio','settings','taarifa zangu'],
  HELP:['nahitaji msaada','unaweza kufanya nini','msaada','saidia','help','maswali','faq','support','unaweza nini','unafanya nini'],
  GREET:['habari yako','habari','mambo','hujambo','shikamoo','salama','hello','hi','hey','vipi','niaje','jambo','good morning','asubuhi njema'],
  THANKS:['asante sana','asante','ahsante','nashukuru','thanks','thank you','shukrani','poa'],
  CANCEL:['ghairi','acha','sitaki','cancel','stop','hapana','futa','anza upya','restart','mwanzo','home'],
  YES:['ndio','ndiyo','sawa','yes','ok','okay','oke','endelea','thibitisha','confirm','sawasawa']
};

/* ============================ I18N ============================ */
const I18N={
sw:{
  tag:'Sema. Thibitisha. Maliza.',
  online:'Mtandaoni · AI iko tayari',offline:'Nje ya mtandao',
  wallet:'Wallet',placeholder:'Andika au sema unachotaka…',
  listening:'Nasikiliza… sema sasa',
  welcome_back:n=>`Karibu tena${n?', '+n:''} 👋`,
  welcome:'Mimi ni SemaTel — msaidizi wako wa huduma za simu na pesa, mitandao yote Tanzania.\n\nSema tu unachotaka kwa lugha yako, mfano:\n“Nunua sms za jero” · “Tuma 10,000 kwa 0755…” · “Luku 10000 meta 01234567890”\n\nNikishamjua mtu wako, sema tu “tuma buku kwa mama” 😉',
  clarify:'Samahani, sijaelewa vizuri. 🤔 Jaribu kusema kwa mfano “nunua GB 2” au chagua huduma hapa chini.',
  detected:'Nimegundua',
  svc_all:'Huduma Zote',menu:'Menyu',
  ask_amount:'Kiasi gani? Andika au chagua 👇',
  ask_phone:'Namba ya mpokeaji? (mfano 0712 345 678)',
  ask_meter:'Weka namba ya mita ya LUKU (tarakimu 11–13):',
  ask_code:'Weka namba ya vocha:',
  ask_bundle:'Chagua kifurushi au andika (mfano “GB 2” au “buku”):',
  ask_provider_bill:'Bili ya nani? Chagua 👇',
  ask_account:'Weka namba ya akaunti / kadi:',
  ask_govt:'Chagua taasisi 👇',
  ask_ref:'Weka namba ya kumbukumbu (Control No. / Reg No.):',
  ask_paybill:'Weka Lipa Namba / Paybill:',
  ask_country:'Unatuma nchi gani? 👇',
  confirm:'THIBITISHA',cancel:'Ghairi',pay:'Lipa',buy:'Nunua',later:'Baadaye',
  pin_title:'Weka PIN yako',pin_sub:a=>`Tarakimu 4 · Muamala wa Tsh ${a}`,
  pin_wrong:r=>`PIN si sahihi. Umebakiwa na nafasi ${r}.`,
  pin_locked:m=>`🚫 PIN imefungwa kwa dakika ${m}. Jaribu tena baadaye.`,
  processing:'Inatuma…',success:'IMEFANIKIWA',failed:'IMESHINDIKANA',
  insufficient:(need,src)=>`⚠️ Salio la ${src} halitoshi. Unahitaji Tsh ${need} zaidi.`,
  pay_via:'Lipa kupitia:',
  ext_wallet_note:w=>`Utathibitisha kwa PIN ya ${w}.`,
  bal_after:'Salio Baada',amount:'Kiasi',recipient:'Mpokeaji',network:'Mtandao',
  service:'Huduma',payment:'Malipo',details:'Maelezo',meter_no:'Namba ya Mita',
  token:'Tokeni ya LUKU',ref:'Kumbukumbu',date:'Tarehe',fee:'Ada',total:'Jumla',
  rate:'Kiwango',receives:'Atapokea',account:'Akaunti',
  sending_to:'Unatuma kwa',
  xfer_warn:'Hakikisha namba ni sahihi. Fedha zikishatumwa haziwezi kurudishwa.',
  more_help:'Karibu tena — niambie huduma nyingine wakati wowote. 🙌',
  receipt_share:'Shiriki',receipt_save:'Pakua PDF',receipt_copy:'Nakili',
  copied:'Imenakiliwa ✓',saved:'Risiti imehifadhiwa ✓',
  receipt_service:'Huduma',receipt_method:'Njia ya Malipo',receipt_phone:'Simu Yako',
  receipt_bal_before:'Salio Kabla',receipt_bal_after:'Salio Baada',receipt_reason:'Sababu',
  receipt_total:'JUMLA',receipt_no:'NAMBA YA RISITI',receipt_thanks:'Asante kwa kutumia SemaTel!',
  receipt_keep:'Hifadhi risiti hii kwa ajili ya kumbukumbu.',
  receipt_popup_blocked:'Ruhusu madirisha ibukizi ili kuhifadhi PDF',
  offline_q:'📥 Hakuna intaneti — muamala umewekwa kwenye foleni. Utakamilika mtandao ukirudi.',
  fraud:'⚠️ Muamala umesimamishwa kwa usalama. Subiri kidogo kisha jaribu tena.',
  greet:['Habari! 👋 Nikusaidieje leo?','Mambo vipi! Niambie unachohitaji.','Salama! Niko tayari — sema tu.'],
  thanks:['Karibu sana! 🙌','Asante kwako! Karibu tena.','Furaha yangu! 💚'],
  bye:'Sawa. Ukihitaji chochote, andika tu — au bonyeza ➕ kuona huduma zote.',
  balances:'Salio Zako',airtime:'Airtime',data:'Data',sms_b:'SMS',mins:'Dakika',
  history_t:'Miamala ya Karibuni',no_history:'Bado hakuna miamala. Anza kwa kusema “nunua GB 1”. ',
  voice_unsupported:'Kifaa hiki hakiruhusu sauti hapa. Tumia maandishi au fungua kwenye Chrome/Safari.',
  voice_denied:'Ruhusa ya mikrofoni imekataliwa. Iwashe kwenye mipangilio ya kivinjari.',
  install:'Sakinisha Programu',installed:'Imesakinishwa ✓',
  install_ios:'Kwenye iPhone: gusa Shiriki (⬆️) kisha “Add to Home Screen”.',
  lang_switched:'Language switched to English 🇬🇧',
  acc_name:'Jina',acc_phone:'Namba Yako',acc_pin:'Badilisha PIN',acc_reset:'Futa Data ya Demo',
  new_pin_ok:'PIN mpya imehifadhiwa ✓',reset_ok:'Data imerudishwa mwanzo ✓',
  luku_units:'Uniti',choose_amt_luku:'Kiasi cha umeme?',
  yes_lbl:'NDIYO',no_lbl:'HAPANA',
  data_hdr:'Vifurushi vya Data',sms_hdr:'Vifurushi vya SMS',min_hdr:'Vifurushi vya Dakika',
  best_for:a=>`Vinavyolingana na Tsh ${a}:`,
  own_number:'Namba yako',
  voucher_ok:v=>`Vocha imekubaliwa: ${v}`,voucher_bad:'❌ Namba ya vocha si sahihi. Jaribu tena:',
  usage_t:'Muhtasari wa Matumizi',usage_none:'Bado hakuna matumizi ya kuonyesha. Anza na muamala wa kwanza!',
  usage_total:'Jumla Uliyotumia',usage_count:'Idadi ya Miamala',
  repeat_none:'Hakuna muamala wa kurudia bado. Fanya muamala kwanza 😊',
  ask_contact_name:'Nimhifadhi kwa jina gani? (mfano “Mama”)',
  contact_save:p=>`Unataka kuhifadhi ${p} kwenye anwani zako?`,
  contact_saved:n=>`✓ ${n} amehifadhiwa! Sasa sema tu “tuma buku kwa ${n}”.`,
  save_lbl:'Hifadhi',
  low_bal:b=>`💡 Kumbuka: salio la wallet limebaki Tsh ${b} tu.`,
  yes_hint:'Weka PIN yako hapo juu kukamilisha 👆',
  theme:'Mandhari',theme_auto:'Otomatiki 🌗',theme_light:'Mwanga ☀️',theme_dark:'Giza 🌙',
  chips_home:['💰 Salio','📶 Nunua Data','📱 Airtime','💸 Tuma Pesa','⚡ LUKU','💬 SMS','📞 Dakika','🧾 Miamala'],
  demo_note:'Hii ni DEMO — hakuna pesa halisi inayotumika. PIN ya majaribio: 1234'
},
en:{
  tag:'Say it. Confirm. Done.',
  online:'Online · AI ready',offline:'Offline',
  wallet:'Wallet',placeholder:'Type or say what you need…',
  listening:'Listening… speak now',
  welcome_back:n=>`Welcome back${n?', '+n:''} 👋`,
  welcome:'I\'m SemaTel — your assistant for telecom & money services on every Tanzanian network.\n\nJust say what you want, e.g.:\n“Buy 2GB” · “Send 10,000 to 0755…” · “LUKU 10000 meter 01234567890”\n\nOnce I know your people, just say “send 5000 to mom” 😉',
  clarify:'Sorry, I didn\'t quite get that. 🤔 Try e.g. “buy 2GB”, or pick a service below.',
  detected:'Detected',
  svc_all:'All Services',menu:'Menu',
  ask_amount:'How much? Type or pick 👇',
  ask_phone:'Recipient number? (e.g. 0712 345 678)',
  ask_meter:'Enter LUKU meter number (11–13 digits):',
  ask_code:'Enter voucher code:',
  ask_bundle:'Pick a bundle or type one (e.g. “2GB” or “1000”):',
  ask_provider_bill:'Which bill? Pick 👇',
  ask_account:'Enter account / card number:',
  ask_govt:'Choose institution 👇',
  ask_ref:'Enter reference (Control No. / Reg No.):',
  ask_paybill:'Enter Paybill / Till number:',
  ask_country:'Sending to which country? 👇',
  confirm:'CONFIRM',cancel:'Cancel',pay:'Pay',buy:'Buy',later:'Later',
  pin_title:'Enter your PIN',pin_sub:a=>`4 digits · Transaction of Tsh ${a}`,
  pin_wrong:r=>`Wrong PIN. ${r} attempt(s) left.`,
  pin_locked:m=>`🚫 PIN locked for ${m} min. Try again later.`,
  processing:'Processing…',success:'SUCCESSFUL',failed:'FAILED',
  insufficient:(need,src)=>`⚠️ Insufficient ${src} balance. You need Tsh ${need} more.`,
  pay_via:'Pay via:',
  ext_wallet_note:w=>`You\'ll confirm with your ${w} PIN.`,
  bal_after:'Balance After',amount:'Amount',recipient:'Recipient',network:'Network',
  service:'Service',payment:'Payment',details:'Details',meter_no:'Meter Number',
  token:'LUKU Token',ref:'Reference',date:'Date',fee:'Fee',total:'Total',
  rate:'Rate',receives:'Receives',account:'Account',
  sending_to:'Sending to',
  xfer_warn:'Double-check this number. Money sent cannot be reversed.',
  more_help:'Anytime — tell me the next service whenever you\'re ready. 🙌',
  receipt_share:'Share',receipt_save:'Download PDF',receipt_copy:'Copy',
  copied:'Copied ✓',saved:'Receipt saved ✓',
  receipt_service:'Service',receipt_method:'Payment Method',receipt_phone:'Your Number',
  receipt_bal_before:'Balance Before',receipt_bal_after:'Balance After',receipt_reason:'Reason',
  receipt_total:'TOTAL',receipt_no:'RECEIPT NUMBER',receipt_thanks:'Thank you for using SemaTel!',
  receipt_keep:'Keep this receipt for your records.',
  receipt_popup_blocked:'Allow pop-ups to save the PDF',
  offline_q:'📥 You\'re offline — transaction queued. It will complete when you\'re back online.',
  fraud:'⚠️ Transaction paused for security. Wait a moment and try again.',
  greet:['Hi there! 👋 How can I help?','Hello! Tell me what you need.','Hey! Ready when you are — just say it.'],
  thanks:['You\'re welcome! 🙌','Anytime!','My pleasure! 💚'],
  bye:'Alright. Whenever you need anything, just type — or tap ➕ for all services.',
  balances:'Your Balances',airtime:'Airtime',data:'Data',sms_b:'SMS',mins:'Minutes',
  history_t:'Recent Transactions',no_history:'No transactions yet. Start by saying “buy 1GB”.',
  voice_unsupported:'Voice isn\'t available here. Use text, or open in Chrome/Safari.',
  voice_denied:'Microphone permission denied. Enable it in browser settings.',
  install:'Install App',installed:'Installed ✓',
  install_ios:'On iPhone: tap Share (⬆️) then “Add to Home Screen”.',
  lang_switched:'Lugha imebadilishwa kuwa Kiswahili 🇹🇿',
  acc_name:'Name',acc_phone:'Your Number',acc_pin:'Change PIN',acc_reset:'Reset Demo Data',
  new_pin_ok:'New PIN saved ✓',reset_ok:'Demo data reset ✓',
  luku_units:'Units',choose_amt_luku:'Electricity amount?',
  yes_lbl:'YES',no_lbl:'NO',
  data_hdr:'Data Bundles',sms_hdr:'SMS Bundles',min_hdr:'Minute Bundles',
  best_for:a=>`Best matches for Tsh ${a}:`,
  own_number:'Your number',
  voucher_ok:v=>`Voucher accepted: ${v}`,voucher_bad:'❌ Invalid voucher code. Try again:',
  usage_t:'Spending Summary',usage_none:'No spending to show yet. Make your first transaction!',
  usage_total:'Total Spent',usage_count:'Transactions',
  repeat_none:'No previous transaction to repeat yet 😊',
  ask_contact_name:'What name should I save them as? (e.g. “Mom”)',
  contact_save:p=>`Save ${p} to your contacts?`,
  contact_saved:n=>`✓ ${n} saved! Next time just say “send 5000 to ${n}”.`,
  save_lbl:'Save',
  low_bal:b=>`💡 Heads up: only Tsh ${b} left in your wallet.`,
  yes_hint:'Enter your PIN above to complete 👆',
  theme:'Theme',theme_auto:'Auto 🌗',theme_light:'Light ☀️',theme_dark:'Dark 🌙',
  chips_home:['💰 Balance','📶 Buy Data','📱 Airtime','💸 Send Money','⚡ LUKU','💬 SMS','📞 Minutes','🧾 History'],
  demo_note:'This is a DEMO — no real money moves. Demo PIN: 1234'
}};
function T(key,...args){const v=I18N[Store.s.lang][key];return typeof v==='function'?v(...args):v;}

/* ============================ UTILS ============================ */
const $=id=>document.getElementById(id);
function escapeHTML(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(n){return Number(n||0).toLocaleString('en-US');}
function fmtMB(mb){return mb>=1024?(mb/1024).toFixed(mb%1024?1:0)+' GB':Math.round(mb)+' MB';}
function escapeRe(s){return String(s).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');}
/* Levenshtein distance with early exit — powers typo-tolerant NLU */
function lev(a,b){
  if(a===b)return 0;
  if(Math.abs(a.length-b.length)>2)return 99;
  const m=a.length,n=b.length;
  let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    const cur=[i];
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    prev=cur;
  }
  return prev[n];
}
function ownPhone(){return Store.s.profile.phone.replace(/\D/g,'');}
function isSelfPhone(p){return !p||String(p).replace(/\D/g,'')===ownPhone();}
function detectNetwork(msisdn){
  if(!msisdn)return null;
  const d=String(msisdn).replace(/\D/g,'');
  const local=d.startsWith('255')?'0'+d.slice(3):d;
  return NETWORK_PREFIX2[local.slice(1,3)]||null;
}
function networkWallet(net){return NETWORK_WALLET[net]||'M-Pesa';}
function netBadge(net){
  if(!net)return'';
  return `<span class="net-badge" style="background:${NETWORK_COLOR[net]||'#555'}">📡 ${escapeHTML(net)}</span>`;
}
function genRef(){return 'ST'+Math.floor(10000000+Math.random()*89999999);}
function genToken(){let t=[];for(let i=0;i<5;i++)t.push(String(Math.floor(1000+Math.random()*8999)));return t.join('-');}
function hashPIN(p){let h=5381;const s='sematel:'+p;for(let i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))|0;}return String(h>>>0);}
function nowStamp(){const d=new Date();return{date:d.toLocaleDateString('en-GB'),time:d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};}

/* ============================ STORE ============================ */
const Store={
  KEY:'sematel_v5',
  s:null,
  defaults(){return{
    lang:'sw',
    theme:'auto',
    profile:{name:'',phone:'0754 345 678',pinHash:hashPIN('1234')},
    bal:{wallet:50000,airtime:3200,dataMB:1536,sms:45,minutes:20},
    balHidden:false,
    tts:false,
    history:[],           /* [{ref,type,details,amount,date,time,status}] */
    queue:[],             /* offline queued tx */
    contacts:[],          /* saved beneficiaries [{name,phone}] */
    lastTx:null,          /* replayable slots of last successful tx */
    pin:{attempts:0,lockUntil:0},
    txTimes:[],           /* fraud velocity */
    visited:false
  };},
  load(){
    try{const r=localStorage.getItem(this.KEY);this.s=r?Object.assign(this.defaults(),JSON.parse(r)):this.defaults();}
    catch(e){this.s=this.defaults();}
    /* deep-merge safety */
    const d=this.defaults();
    this.s.profile=Object.assign({},d.profile,this.s.profile);
    this.s.bal=Object.assign({},d.bal,this.s.bal);
    this.s.pin=Object.assign({},d.pin,this.s.pin);
    if(!Array.isArray(this.s.contacts))this.s.contacts=[];
  },
  save(){try{localStorage.setItem(this.KEY,JSON.stringify(this.s));}catch(e){}},
  reset(){this.s=this.defaults();this.s.visited=true;this.save();}
};
Store.load();

/* ============================ 1. NLU ============================ */
/* One pass over the message extracts EVERYTHING it can:
   intent + amount + phone + meter + GB/MB product + provider +
   period + voucher code + bill/govt/country hints.
   The engine then only asks for what is still missing.        */
const LexIndex=(function(){
  const list=[];
  Object.keys(LEXICON).forEach(intent=>LEXICON[intent].forEach(p=>{
    const ph=(p||'').toLowerCase().trim();if(ph)list.push({intent,phrase:ph});
  }));
  list.sort((a,b)=>b.phrase.length-a.phrase.length);
  list.forEach(it=>it.re=new RegExp('(^|[^a-z0-9])'+escapeRe(it.phrase)+'($|[^a-z0-9])','i'));
  return{
    match(text){
      for(const it of list){if(it.re.test(text))return it;}
      return null;
    },
    /* typo tolerance: single-word lexicon entries matched at edit distance
       1 (words 4–6 chars) or 2 (7+ chars) — "bandoo", "salioo", "arti mie"… */
    fuzzy(text){
      const tokens=text.split(/[^a-z0-9]+/).filter(w=>w.length>=4);
      if(!tokens.length)return null;
      let best=null;
      for(const it of list){
        if(it.phrase.length<4||it.phrase.includes(' '))continue;
        const max=it.phrase.length>=7?2:1;
        for(const w of tokens){
          const d=lev(w,it.phrase);
          if(d>0&&d<=max&&(!best||it.phrase.length>best.phrase.length))best=it;
        }
      }
      return best;
    }
  };
})();

function parse(raw){
  const text=String(raw||'').trim();
  const t=text.toLowerCase();
  const r={intent:null,confidence:0,amount:null,phone:null,meter:null,
           productMB:null,provider:null,wallet:null,period:null,code:null,
           bill:null,govt:null,country:null,paybill:null,contactName:null,text};

  /* street product shortcuts — highest confidence */
  for(const k of Object.keys(STREET_PRODUCTS).sort((a,b)=>b.length-a.length)){
    if(t.includes(k)){
      const sp=STREET_PRODUCTS[k];
      r.intent=sp.intent;r.confidence=.99;
      if(sp.amount)r.amount=sp.amount;
      if(sp.productMB)r.productMB=sp.productMB;
      break;
    }
  }
  /* lexicon intent */
  if(!r.intent){const hit=LexIndex.match(t);if(hit){r.intent=hit.intent;r.confidence=.95;}}
  /* typo-tolerant fallback */
  if(!r.intent){const fz=LexIndex.fuzzy(t);if(fz){r.intent=fz.intent;r.confidence=.8;}}

  /* phone (do before meter so an msisdn isn't mistaken for a meter) */
  const pm=t.match(/(\+?255\s?[67]\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[67]\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[67]\d{8})/);
  if(pm){r.phone=pm[0].replace(/[\s-]/g,'');const net=detectNetwork(r.phone);if(net){r.provider=net;r.wallet=networkWallet(net);}}

  /* saved contact by name: “tuma buku kwa mama” */
  if(!r.phone&&Store.s&&Store.s.contacts&&Store.s.contacts.length){
    for(const c of Store.s.contacts){
      const nm=String(c.name||'').toLowerCase().trim();
      if(nm&&new RegExp('(^|[^a-z0-9])'+escapeRe(nm)+'($|[^a-z0-9])','i').test(t)){
        r.phone=c.phone;r.contactName=c.name;
        const net=detectNetwork(c.phone);
        if(net){r.provider=net;r.wallet=networkWallet(net);}
        break;
      }
    }
  }

  /* meter: 11–13 digit group (separators allowed) that isn't the phone */
  const digitRuns=text.match(/\d[\d\s-]{9,20}\d/g)||[];
  for(const run of digitRuns){
    const d=run.replace(/\D/g,'');
    if(d.length>=11&&d.length<=13&&d!==(r.phone||'').replace(/\D/g,'')){
      r.meter=d;if(!r.intent){r.intent='LUKU';r.confidence=.9;}break;
    }
  }

  /* data size: "2gb", "gb 2", "500mb", "mb 500", "1.5 gb" */
  let g=t.match(/(\d+(?:\.\d+)?)\s*gb\b/)||t.match(/\bgb\s*(\d+(?:\.\d+)?)/)||t.match(/(\d+(?:\.\d+)?)\s*giga/);
  let mb=t.match(/(\d+(?:\.\d+)?)\s*mb\b/)||t.match(/\bmb\s*(\d+(?:\.\d+)?)/);
  if(g){r.productMB=parseFloat(g[1])*1024;if(!r.intent||r.intent==='AIRTIME'){r.intent='DATA';r.confidence=.96;}}
  else if(mb){r.productMB=parseFloat(mb[1]);if(!r.intent){r.intent='DATA';r.confidence=.96;}}

  /* period for data */
  if(/\bsiku\b|\bdaily\b|\bleo\b|\bday\b/.test(t))r.period='daily';
  if(/\bwiki\b|\bweek/.test(t))r.period='weekly';
  if(/\bmwezi\b|\bmonth/.test(t))r.period='monthly';

  /* amount: street slang first (longest key), then numeric */
  for(const k of Object.keys(STREET_AMOUNTS).sort((a,b)=>b.length-a.length)){
    if(new RegExp('(^|[^a-z])'+k.replace(/ /g,'\\s+')+'($|[^a-z])','i').test(t)){r.amount=STREET_AMOUNTS[k];break;}
  }
  if(r.amount==null){
    /* numeric amounts — skip the digits already consumed by phone/meter/GB */
    let scrub=t;
    if(r.phone){
      const pd=r.phone.replace(/\D/g,'');
      scrub=scrub.replace(new RegExp(pd.split('').join('[\\s-]?')),' ');
      scrub=scrub.replace(new RegExp('\\+?255[\\s-]?'+pd.slice(1).split('').join('[\\s-]?')),' ');
    }
    if(r.meter)scrub=scrub.replace(new RegExp(r.meter.split('').join('[\\s-]?')),' ');
    scrub=scrub.replace(/\d+(?:\.\d+)?\s*(gb|mb|giga)/g,' ').replace(/(gb|mb)\s*\d+(?:\.\d+)?/g,' ');
    const nm=scrub.match(/(\d[\d,\.]*)\s*(k\b|elfu)?/);
    if(nm&&nm[1]){
      let a=parseInt(nm[1].replace(/[,\.]/g,''),10);
      if((nm[2]||'').trim()&&a<1000)a*=1000;
      if(a>0&&a<=5000000)r.amount=a;
    }
  }

  /* mobile-money provider mention (payment hint) */
  const provMap={'airtel money':'Airtel Money','tigo pesa':'Mixx by Yas','halo pesa':'HaloPesa','tigopesa':'Mixx by Yas','halopesa':'HaloPesa','m-pesa':'M-Pesa','t-pesa':'T-Pesa','t pesa':'T-Pesa','mpesa':'M-Pesa','tpesa':'T-Pesa','mixx':'Mixx by Yas','yas':'Mixx by Yas'};
  for(const k of Object.keys(provMap).sort((a,b)=>b.length-a.length)){
    if(new RegExp('(^|[^a-z0-9])'+escapeRe(k)+'($|[^a-z0-9])','i').test(t)){r.wallet=provMap[k];break;}
  }

  /* voucher code: letters+digits 8-12 chars */
  const vc=text.toUpperCase().match(/\b([A-Z]{2,6}\d{3,8}|[A-Z0-9]{8,12})\b/);
  if(vc&&VOUCHER_CODES[vc[1]])r.code=vc[1];
  else if(r.intent==='VOUCHER'&&vc)r.code=vc[1];

  /* bill / govt / country hints */
  for(const p of TV_PROVIDERS){if(p.keys.some(k=>t.includes(k))){r.bill=p.name;if(!r.intent)r.intent='BILLS';break;}}
  for(const gsvc of GOVT_SERVICES){if(gsvc.keys.some(k=>new RegExp('\\b'+k+'\\b').test(t))){r.govt=gsvc.code;if(!r.intent)r.intent='GOVT';break;}}
  for(const c of INTL_DESTINATIONS){if(c.keys.some(k=>new RegExp('\\b'+k+'\\b').test(t))){r.country=c.country;if(r.intent==='MONEY'||!r.intent)r.intent='INTL';break;}}

  /* paybill number: 4-7 digits after intent PAYBILL */
  if(r.intent==='PAYBILL'){const pb=t.match(/\b(\d{4,7})\b/);if(pb)r.paybill=pb[1];}

  /* disambiguation: "tuma 10000 kwa 0712..." with no lexicon hit */
  if(!r.intent&&r.phone&&r.amount)r.intent='MONEY';
  if(!r.intent&&r.productMB)r.intent='DATA';

  /* "salio" alone but amount present + airtime words → AIRTIME already handled by lexicon order */
  return r;
}

/* ============================ FRAUD GUARD ============================ */
const FraudGuard={
  check(amount){
    const now=Date.now();
    Store.s.txTimes=(Store.s.txTimes||[]).filter(x=>now-x<60000);
    if(Store.s.txTimes.length>=4)return false;          /* >4 tx / min */
    if(amount>500000)return false;                       /* hard cap    */
    return true;
  },
  record(){Store.s.txTimes.push(Date.now());Store.save();}
};

/* ============================ 2. SERVICES ============================ */
/* Each service is declarative:
     icon, name(), slots[] — {key, missing(tx), ask(tx)}   (ask renders prompt UI)
     review(tx)  → rows for the confirmation card
     auth        → 'pin' | 'none'
     execute(tx) → mutates balances, returns extra receipt rows
   The universal engine does everything else.                          */
const SERVICES={

  AIRTIME:{
    icon:'📱',name:()=>Store.s.lang==='sw'?'Nunua Airtime':'Buy Airtime',
    slots:[{
      key:'amount',missing:tx=>!tx.amount,
      ask(){UI.askAmount([500,1000,2000,5000,10000,20000]);}
    }],
    prep(tx){
      tx.phone=tx.phone||Store.s.profile.phone.replace(/\s/g,'');
      tx.provider=tx.provider||detectNetwork(tx.phone);
      tx.details=`Airtime Tsh ${fmt(tx.amount)}`+(isSelfPhone(tx.phone)?'':` → ${tx.contactName||tx.phone}`);
    },
    review(tx){return[
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
      [T('recipient'),(isSelfPhone(tx.phone)?T('own_number')+' · ':(tx.contactName?tx.contactName+' · ':''))+tx.phone],
      [T('network'),tx.provider||'—']
    ];},
    auth:'pin',
    execute(tx){
      if(isSelfPhone(tx.phone)){Store.s.bal.airtime+=tx.amount;return[];}
      return[[T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone]];
    }
  },

  DATA:{
    icon:'📶',name:()=>Store.s.lang==='sw'?'Nunua Data':'Buy Data',
    slots:[{
      key:'bundle',
      missing:tx=>!tx.bundle&&!Engine.resolveBundle(tx),
      ask(tx){UI.showBundles(Engine.candidateBundles(tx),tx);}
    }],
    prep(tx){
      const b=tx.bundle||Engine.resolveBundle(tx);
      tx.bundle=b;tx.amount=b.price;
      tx.details=`Data: ${b.name} (${b.validity})`+(isSelfPhone(tx.phone)?'':` → ${tx.contactName||tx.phone}`);
    },
    review(tx){
      const rows=[
        [T('service'),tx.bundle.name],
        [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
        [T('details'),tx.bundle.validity]
      ];
      if(!isSelfPhone(tx.phone))rows.splice(1,0,[T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone]);
      return rows;
    },
    auth:'pin',
    execute(tx){
      if(isSelfPhone(tx.phone)){Store.s.bal.dataMB+=tx.bundle.gb*1024;return[[T('data'),'+'+fmtMB(tx.bundle.gb*1024)]];}
      return[[T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone],[T('data'),'+'+fmtMB(tx.bundle.gb*1024)]];
    }
  },

  SMS:{
    icon:'💬',name:()=>Store.s.lang==='sw'?'Nunua SMS':'Buy SMS',
    slots:[{
      key:'pack',
      missing:tx=>!tx.pack&&!tx.amount,
      ask(){UI.showPacks(SMS_CATALOGUE,T('sms_hdr'),'💬');}
    }],
    prep(tx){
      const p=tx.pack||SMS_CATALOGUE.reduce((b,s)=>Math.abs(s.price-tx.amount)<Math.abs(b.price-tx.amount)?s:b);
      tx.pack=p;tx.amount=p.price;tx.details=`${p.name} (${p.validity})`;
    },
    review(tx){return[
      [T('service'),tx.pack.name],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
      [T('details'),tx.pack.validity]
    ];},
    auth:'pin',
    execute(tx){
      if(isSelfPhone(tx.phone)){Store.s.bal.sms+=tx.pack.count;return[[T('sms_b'),'+'+tx.pack.count]];}
      return[[T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone],[T('sms_b'),'+'+tx.pack.count]];
    }
  },

  MINUTES:{
    icon:'📞',name:()=>Store.s.lang==='sw'?'Nunua Dakika':'Buy Minutes',
    slots:[{
      key:'pack',
      missing:tx=>!tx.pack&&!tx.amount,
      ask(){UI.showPacks(MINUTE_CATALOGUE,T('min_hdr'),'📞');}
    }],
    prep(tx){
      const p=tx.pack||MINUTE_CATALOGUE.reduce((b,m)=>Math.abs(m.price-tx.amount)<Math.abs(b.price-tx.amount)?m:b);
      tx.pack=p;tx.amount=p.price;tx.details=`${p.name} (${p.validity})`;
    },
    review(tx){return[
      [T('service'),tx.pack.name],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
      [T('details'),tx.pack.validity]
    ];},
    auth:'pin',
    execute(tx){
      if(isSelfPhone(tx.phone)){Store.s.bal.minutes+=tx.pack.minutes;return[[T('mins'),'+'+tx.pack.minutes]];}
      return[[T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone],[T('mins'),'+'+tx.pack.minutes]];
    }
  },

  MONEY:{
    icon:'💸',name:()=>Store.s.lang==='sw'?'Tuma Pesa':'Send Money',
    slots:[
      {key:'phone',missing:tx=>!tx.phone,ask(){UI.askPhone();}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([1000,2000,5000,10000,20000,50000]);}}
    ],
    prep(tx){
      tx.provider=tx.provider||detectNetwork(tx.phone);
      tx.fee=Math.max(100,Math.round(tx.amount*.01));
      tx.total=tx.amount+tx.fee;
      tx.details=`${Store.s.lang==='sw'?'Tuma kwa':'Send to'} ${tx.contactName?tx.contactName+' · ':''}${tx.phone}`;
    },
    review(tx){return[
      [T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone],
      [T('network'),tx.provider?`${tx.provider} · ${networkWallet(tx.provider)}`:'—'],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
      [T('fee'),`Tsh ${fmt(tx.fee)}`],
      [T('total'),`Tsh ${fmt(tx.total)}`]
    ];},
    auth:'pin',cost:tx=>tx.total,peerTransfer:true,
    execute(tx){return[[T('recipient'),(tx.contactName?tx.contactName+' · ':'')+tx.phone]];}
  },

  LUKU:{
    icon:'⚡',name:()=>Store.s.lang==='sw'?'Nunua LUKU':'Buy LUKU',
    slots:[
      {key:'meter',missing:tx=>!tx.meter,ask(){UI.askText(T('ask_meter'),'meter');}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([5000,10000,20000,30000,50000],T('choose_amt_luku'));}}
    ],
    prep(tx){tx.details=`LUKU ${Store.s.lang==='sw'?'Mita':'Meter'} ${tx.meter}`;},
    review(tx){return[
      [T('meter_no'),tx.meter,'mono'],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
      [T('luku_units'),`~${(tx.amount/292).toFixed(1)} kWh`]
    ];},
    auth:'pin',
    execute(tx){
      tx.token=genToken();
      return[[T('token'),tx.token,'mono'],[T('luku_units'),`${(tx.amount/292).toFixed(1)} kWh`]];
    }
  },

  BILLS:{
    icon:'🧾',name:()=>Store.s.lang==='sw'?'Lipa Bili':'Pay Bills',
    slots:[
      {key:'bill',missing:tx=>!tx.bill,ask(){UI.showChoices(TV_PROVIDERS.map(p=>({icon:p.icon,label:p.name,val:p.name})),'bill',T('ask_provider_bill'));}},
      {key:'account',missing:tx=>!tx.account,ask(){UI.askText(T('ask_account'),'account');}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([10000,20000,35000,50000]);}}
    ],
    prep(tx){tx.details=`${tx.bill} · ${tx.account}`;},
    review(tx){return[
      [T('service'),tx.bill],
      [T('account'),tx.account,'mono'],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold']
    ];},
    auth:'pin',
    execute(tx){return[[T('account'),tx.account,'mono']];}
  },

  GOVT:{
    icon:'🏛️',name:()=>Store.s.lang==='sw'?'Malipo ya Serikali':'Government Payment',
    slots:[
      {key:'govt',missing:tx=>!tx.govt,ask(){UI.showChoices(GOVT_SERVICES.map(g=>({icon:g.icon,label:g.name,val:g.code})),'govt',T('ask_govt'));}},
      {key:'ref',missing:tx=>!tx.ref,ask(){UI.askText(T('ask_ref'),'ref');}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([10000,25000,50000,100000]);}}
    ],
    prep(tx){
      const g=GOVT_SERVICES.find(x=>x.code===tx.govt)||GOVT_SERVICES[0];
      tx.details=`${g.name} · ${tx.ref}`;
    },
    review(tx){return[
      [T('service'),tx.govt],
      [T('ref'),tx.ref,'mono'],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold']
    ];},
    auth:'pin',
    execute(tx){return[[T('ref'),tx.ref,'mono']];}
  },

  SCHOOL:{
    icon:'🎓',name:()=>Store.s.lang==='sw'?'Lipa Karo':'School Fees',
    slots:[
      {key:'ref',missing:tx=>!tx.ref,ask(){UI.askText(T('ask_ref'),'ref');}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([50000,100000,250000,500000]);}}
    ],
    prep(tx){tx.details=`${Store.s.lang==='sw'?'Karo':'Fees'} · Ref ${tx.ref}`;},
    review(tx){return[
      [T('ref'),tx.ref,'mono'],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold']
    ];},
    auth:'pin',
    execute(tx){return[[T('ref'),tx.ref,'mono']];}
  },

  PAYBILL:{
    icon:'🔢',name:()=>Store.s.lang==='sw'?'Lipa Namba':'Paybill',
    slots:[
      {key:'paybill',missing:tx=>!tx.paybill,ask(){UI.askText(T('ask_paybill'),'paybill');}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([2000,5000,10000,20000]);}}
    ],
    prep(tx){tx.details=`Paybill ${tx.paybill}`;},
    review(tx){return[
      ['Paybill',tx.paybill,'mono'],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold']
    ];},
    auth:'pin',
    execute(tx){return[['Paybill',tx.paybill,'mono']];}
  },

  INTL:{
    icon:'🌍',name:()=>Store.s.lang==='sw'?'Tuma Nje ya Nchi':'International Transfer',
    slots:[
      {key:'country',missing:tx=>!tx.country,ask(){UI.showChoices(INTL_DESTINATIONS.map(c=>({icon:c.flag,label:c.country,val:c.country})),'country',T('ask_country'));}},
      {key:'phone',missing:tx=>!tx.phone,ask(){UI.askText(T('ask_phone'),'phone');}},
      {key:'amount',missing:tx=>!tx.amount,ask(){UI.askAmount([10000,25000,50000,100000]);}}
    ],
    prep(tx){
      const d=INTL_DESTINATIONS.find(c=>c.country===tx.country)||INTL_DESTINATIONS[0];
      tx.dest=d;tx.fee=Math.round(tx.amount*.03);tx.total=tx.amount+tx.fee;
      tx.details=`${d.flag} ${d.country} · ${tx.phone}`;
    },
    review(tx){return[
      [T('recipient'),`${tx.dest.flag} ${tx.phone}`],
      [T('service'),tx.dest.wallet],
      [T('amount'),`Tsh ${fmt(tx.amount)}`,'gold'],
      [T('fee'),`Tsh ${fmt(tx.fee)} (3%)`],
      [T('receives'),`~${fmt(Math.round(tx.amount*tx.dest.rate))} ${tx.dest.cur}`]
    ];},
    auth:'pin',cost:tx=>tx.total,peerTransfer:true,
    execute(tx){return[[T('receives'),`~${fmt(Math.round(tx.amount*tx.dest.rate))} ${tx.dest.cur}`]];}
  },

  VOUCHER:{
    icon:'🎟️',name:()=>Store.s.lang==='sw'?'Weka Vocha':'Redeem Voucher',
    slots:[{
      key:'code',
      missing:tx=>!tx.code,
      ask(){UI.askText(T('ask_code'),'code');}
    }],
    prep(tx){
      const v=VOUCHER_CODES[String(tx.code).toUpperCase()];
      tx.voucher=v;tx.amount=0;
      tx.details=`Vocha ${String(tx.code).toUpperCase()}`;
    },
    validate(tx){
      if(!VOUCHER_CODES[String(tx.code).toUpperCase()]){tx.code=null;return T('voucher_bad');}
      return null;
    },
    review(tx){
      const v=tx.voucher;
      return[
        ['Code',String(tx.code).toUpperCase(),'mono'],
        [T('service'),v.type==='DATA'?T('data'):T('airtime')],
        [Store.s.lang==='sw'?'Thamani':'Value',v.type==='DATA'?fmtMB(v.value):'Tsh '+fmt(v.value),'gold']
      ];
    },
    auth:'none',free:true,
    execute(tx){
      const v=tx.voucher;
      if(v.type==='DATA'){Store.s.bal.dataMB+=v.value;return[[T('data'),'+'+fmtMB(v.value)]];}
      Store.s.bal.airtime+=v.value;return[[T('airtime'),'+Tsh '+fmt(v.value)]];
    }
  }
};

/* ============================ 3. UNIVERSAL TX ENGINE ============================ */
/* Pipeline for EVERY service:
     message → parse → fill slots → (ask only what's missing)
     → auto balance check → summary + PIN in ONE card → execute → receipt   */
const Engine={
  tx:null,            /* active transaction {service, ...slots} */
  awaitingText:null,  /* which raw-text slot we're waiting for   */
  awaitingContact:null, /* phone we're waiting to name & save    */
  stage:null,         /* 'fill' | 'review' | 'pay'               */
  lastVoice:false,

  /* ---------- entry: every user message lands here ---------- */
  handle(text){
    const clean=text.trim();if(!clean)return;
    const p=parse(clean);

    /* universal commands */
    if(p.intent==='CANCEL'){this.cancel(true);return;}

    /* naming a contact after a transfer */
    if(this.awaitingContact){
      const name=clean.replace(/\s+/g,' ').trim();
      if(!p.intent&&name.length<=24&&!/\d{4,}/.test(name)){
        const phone=this.awaitingContact;this.awaitingContact=null;
        Store.s.contacts.push({name,phone});Store.save();
        UI.typing(()=>{UI.bot(T('contact_saved',name));UI.chips(UI.homeChips());});
        return;
      }
      this.awaitingContact=null;   /* not a name → route normally */
    }

    /* if we're waiting for a raw-text slot (meter, ref, code, account…) */
    if(this.tx&&this.awaitingText){
      if(this.fillTextSlot(clean,p))return;   /* consumed */
    }

    /* strong new intent → start/replace transaction */
    if(p.intent&&SERVICES[p.intent]){
      this.start(p.intent,p);return;
    }
    if(p.intent&&this[('do'+p.intent)]){this['do'+p.intent](p);return;}

    /* mid-transaction: message may fill open slots (amount, phone, bundle…) */
    if(this.tx){
      const before=JSON.stringify(this.tx);
      this.absorb(p);
      if(JSON.stringify(this.tx)!==before){this.advance();return;}
    }

    /* nothing understood */
    UI.typing(()=> {
      UI.bot(T('clarify'));
      UI.chips(UI.homeChips());
    });
  },

  /* ---------- start a service ---------- */
  start(serviceId,entities){
    this.tx={service:serviceId};
    this.awaitingText=null;
    this.stage='fill';
    this.absorb(entities||{});
    UI.chips([]);
    this.advance();
  },

  /* merge parsed entities into open slots */
  absorb(p){
    const tx=this.tx;if(!tx)return;
    if(p.amount!=null&&!tx.amount)tx.amount=p.amount;
    if(p.phone&&!tx.phone){tx.phone=p.phone;tx.provider=p.provider||detectNetwork(p.phone);}
    if(p.contactName&&!tx.contactName)tx.contactName=p.contactName;
    if(p.meter&&!tx.meter)tx.meter=p.meter;
    if(p.productMB&&!tx.productMB)tx.productMB=p.productMB;
    if(p.period&&!tx.period)tx.period=p.period;
    if(p.code&&!tx.code)tx.code=p.code;
    if(p.bill&&!tx.bill)tx.bill=p.bill;
    if(p.govt&&!tx.govt)tx.govt=p.govt;
    if(p.country&&!tx.country)tx.country=p.country;
    if(p.paybill&&!tx.paybill)tx.paybill=p.paybill;
    if(p.wallet)tx.paySource=p.wallet;
  },

  /* raw-text slot filling (meter numbers, refs, codes, accounts, phones) */
  fillTextSlot(text,p){
    const tx=this.tx,slot=this.awaitingText;
    /* free-text slots must not swallow a clearly-typed new request
       ("nunua gb 2" while asked for an account number)            */
    if(p.intent&&SERVICES[p.intent]&&p.confidence>=.9&&(slot==='ref'||slot==='account')&&!/\d{3,}/.test(text))return false;
    const digits=text.replace(/\D/g,'');
    let val=null;
    if(slot==='meter'&&digits.length>=11&&digits.length<=13)val=digits;
    else if(slot==='phone'&&p.phone)val=p.phone;
    else if(slot==='code')val=text.toUpperCase().replace(/\s/g,'');
    else if(slot==='ref'||slot==='account')val=text.replace(/\s+/g,' ').trim();
    else if(slot==='paybill'&&digits.length>=4&&digits.length<=7)val=digits;
    if(val==null)return false;               /* let normal routing try */
    tx[slot]=val;
    if(slot==='phone'){tx.provider=detectNetwork(val);}
    this.awaitingText=null;
    /* per-service validation (e.g. voucher codes) */
    const svc=SERVICES[tx.service];
    if(svc.validate){const err=svc.validate(tx);if(err){UI.bot(err);this.awaitingText=slot;return true;}}
    this.advance();
    return true;
  },

  /* ---------- core loop: ask only what's missing ---------- */
  advance(){
    const tx=this.tx;if(!tx)return;
    const svc=SERVICES[tx.service];
    for(const slot of svc.slots){
      if(slot.missing(tx)){
        this.stage='fill';
        UI.typing(()=>slot.ask(tx));
        if(['meter','ref','code','account','paybill','phone'].includes(slot.key))this.awaitingText=slot.key;
        return;
      }
    }
    /* validation pass */
    if(svc.validate){const err=svc.validate(tx);if(err){UI.bot(err);this.awaitingText=svc.slots[0].key;return;}}
    this.review();
  },

  /* ---------- data-bundle resolution ---------- */
  resolveBundle(tx){
    if(tx.bundle)return tx.bundle;
    if(tx.productMB){
      const gb=tx.productMB/1024;
      let hits=DATA_CATALOGUE.filter(b=>Math.abs(b.gb-gb)<.01);
      if(tx.period)hits=hits.filter(b=>b.period===tx.period).concat(hits.filter(b=>b.period!==tx.period));
      if(hits.length===1)return hits[0];
      if(hits.length>1&&tx.period)return hits.find(b=>b.period===tx.period)||hits[0];
      if(hits.length>1&&tx.amount)return hits.find(b=>b.price===tx.amount)||null;
      if(hits.length>1)return null;   /* ambiguous size → show filtered menu */
      return null;
    }
    if(tx.amount){
      let hits=DATA_CATALOGUE.filter(b=>b.price===tx.amount);
      if(tx.period)hits=hits.filter(b=>b.period===tx.period);
      if(hits.length===1)return hits[0];
      if(hits.length>1)return hits[0];
    }
    if(tx.period){
      const hits=DATA_CATALOGUE.filter(b=>b.period===tx.period);
      if(hits.length===1)return hits[0];
    }
    return null;
  },
  candidateBundles(tx){
    let list=DATA_CATALOGUE;
    if(tx.productMB)list=list.filter(b=>Math.abs(b.gb-tx.productMB/1024)<.01);
    if(!list.length)list=DATA_CATALOGUE;
    if(tx.period){const f=list.filter(b=>b.period===tx.period);if(f.length)list=f;}
    if(tx.amount&&!tx.productMB){
      const near=DATA_CATALOGUE.filter(b=>Math.abs(b.price-tx.amount)<=tx.amount*.5);
      if(near.length)list=near;
    }
    return list;
  },
  pickBundle(idx){
    const list=this._bundleList||DATA_CATALOGUE;
    const b=list[idx];if(!b||!this.tx)return;
    UI.user(`${b.name} — Tsh ${fmt(b.price)}`);
    this.tx.bundle=b;this.advance();
  },
  pickPack(idx){
    const list=this._packList;const p=list&&list[idx];if(!p||!this.tx)return;
    UI.user(`${p.name} — Tsh ${fmt(p.price)}`);
    this.tx.pack=p;this.advance();
  },
  pickAmount(a){
    if(!this.tx)return;
    UI.user('Tsh '+fmt(a));
    this.tx.amount=a;this.advance();
  },
  pickChoice(key,val,label){
    if(!this.tx)return;
    UI.user(label);
    this.tx[key]=val;this.advance();
  },

  /* ---------- review: auto balance check → ONE card (summary + PIN) ---------- */
  review(){
    const tx=this.tx,svc=SERVICES[tx.service];
    svc.prep&&svc.prep(tx);
    const cost=svc.free?0:(svc.cost?svc.cost(tx):tx.amount||0);
    tx._cost=cost;

    if(!FraudGuard.check(cost)){UI.bot(T('fraud'));this.cancel(false);return;}

    /* auto balance check (engine doc: never let the user hit a dead end) */
    if(cost>0&&!tx.paySourceExternal){
      const src=tx.paySource&&tx.paySource!=='wallet'?tx.paySource:networkWallet(detectNetwork(Store.s.profile.phone))||'M-Pesa';
      tx.paySource=tx.paySource||src;
      if(Store.s.bal.wallet<cost&&!tx._extWallet){
        this.stage='pay';
        UI.typing(()=>UI.insufficient(cost-Store.s.bal.wallet,tx.paySource));
        return;
      }
    }
    this.stage='review';
    UI.typing(()=>{
      UI.reviewCard(tx,svc);
      if(svc.auth==='pin'&&cost>0)setTimeout(()=>UI.pinPad(cost),380);
    });
  },

  /* user chose an external mobile-money wallet after "insufficient" */
  useExternalWallet(w){
    if(!this.tx)return;
    UI.user(w);
    this.tx._extWallet=w;this.tx.paySource=w;this.tx.paySourceExternal=true;
    UI.bot(T('ext_wallet_note',w));
    this.review();
  },

  /* ---------- PIN ---------- */
  pinBuffer:'',
  pinKey(d){
    const st=Store.s.pin;
    if(st.lockUntil>Date.now())return;
    if(d==='del'){this.pinBuffer=this.pinBuffer.slice(0,-1);UI.pinDots(this.pinBuffer.length);return;}
    if(this.pinBuffer.length>=4)return;
    this.pinBuffer+=d;UI.pinDots(this.pinBuffer.length);
    if(this.pinBuffer.length===4)setTimeout(()=>this.checkPIN(),180);
  },
  checkPIN(){
    const st=Store.s.pin;
    if(hashPIN(this.pinBuffer)===Store.s.profile.pinHash){
      this.pinBuffer='';st.attempts=0;Store.save();
      UI.removePinPad();
      this.execute();
    }else{
      this.pinBuffer='';st.attempts++;
      if(st.attempts>=3){
        st.lockUntil=Date.now()+5*60000;st.attempts=0;Store.save();
        UI.removePinPad();UI.bot(T('pin_locked',5));this.cancel(false);
      }else{
        Store.save();
        UI.pinError(T('pin_wrong',3-st.attempts));
      }
    }
  },
  confirmNoPin(){UI.removePinPad();this.execute();},

  /* ---------- execute ---------- */
  execute(){
    const tx=this.tx,svc=SERVICES[tx.service];
    if(!tx)return;
    if(!navigator.onLine){
      Store.s.queue.push({service:tx.service,details:tx.details,amount:tx._cost,at:Date.now()});
      Store.save();
      UI.bot(T('offline_q'));
      this.cancel(false);return;
    }
    UI.typing(()=>{
      /* simulated gateway: 94% success */
      const ok=Math.random()>.06;
      const stamp=nowStamp();
      const ref=genRef();
      if(ok){
        if(!tx.paySourceExternal&&tx._cost>0)Store.s.bal.wallet-=tx._cost;
        const extra=svc.execute(tx)||[];
        FraudGuard.record();
        const rec={ref,type:tx.service,details:tx.details,amount:tx._cost,date:stamp.date,time:stamp.time,status:'SUCCESS',token:tx.token||null};
        Store.s.history.unshift(rec);Store.s.history=Store.s.history.slice(0,50);
        /* remember replayable slots → “rudia” / “kama kawaida” */
        if(tx.service!=='VOUCHER'){
          Store.s.lastTx={service:tx.service,slots:{
            amount:tx.bundle?null:(tx.amount||null),
            productMB:tx.bundle?tx.bundle.gb*1024:null,
            period:tx.bundle?tx.bundle.period:null,
            phone:tx.phone||null,contactName:tx.contactName||null,
            meter:tx.meter||null,bill:tx.bill||null,account:tx.account||null,
            govt:tx.govt||null,ref:tx.ref||null,country:tx.country||null,paybill:tx.paybill||null
          }};
        }
        Store.save();UI.refreshBalances();
        UI.receipt(rec,extra,tx,{before:Store.s.bal.wallet+tx._cost,after:Store.s.bal.wallet});
        Voice.say((Store.s.lang==='sw'?'Imefanikiwa. Kumbukumbu ':'Successful. Reference ')+ref);
        if(!tx.paySourceExternal&&tx._cost>0&&Store.s.bal.wallet<5000&&!this._lowWarned){
          this._lowWarned=true;
          setTimeout(()=>UI.bot(T('low_bal',fmt(Store.s.bal.wallet))),1800);
        }
      }else{
        const reasons=Store.s.lang==='sw'
          ?['Mtandao umekwama (timeout)','Huduma haipatikani kwa sasa','Malipo yamekataliwa na mtoa huduma']
          :['Network timeout','Service temporarily unavailable','Payment declined by provider'];
        const reason=reasons[Math.floor(Math.random()*reasons.length)];
        const rec={ref,type:tx.service,details:tx.details,amount:tx._cost,date:stamp.date,time:stamp.time,status:'FAILED',reason};
        Store.s.history.unshift(rec);Store.save();
        UI.failed(rec,tx);
      }
      this.tx=null;this.awaitingText=null;this.stage=null;
    },1400);
  },

  retryLast(){
    const last=this._lastFailed;
    if(last){this.start(last.service,{});}
  },

  cancel(sayIt){
    this.tx=null;this.awaitingText=null;this.awaitingContact=null;this.stage=null;this.pinBuffer='';
    UI.removePinPad();
    if(sayIt){UI.bot(T('bye'));UI.chips(UI.homeChips());}
  },

  /* ---------- contacts ---------- */
  saveContactStart(phone){
    this.awaitingContact=phone;
    UI.bot(T('ask_contact_name'));
    UI.input.focus();
  },
  pickContact(i){
    const c=(Store.s.contacts||[])[i];
    if(!c||!this.tx)return;
    UI.user('👤 '+c.name);
    this.tx.phone=c.phone;this.tx.contactName=c.name;
    this.tx.provider=detectNetwork(c.phone);
    this.awaitingText=null;
    this.advance();
  },

  /* ---------- instant intents (no tx) ---------- */
  doBALANCE(){UI.typing(()=>{UI.balanceCard();UI.chips(UI.homeChips());});},
  doHISTORY(){UI.typing(()=>{UI.historyCard();UI.chips(UI.homeChips());});},
  doUSAGE(){UI.typing(()=>{UI.usageCard();UI.chips(UI.homeChips());});},
  doREPEAT(){
    const lt=Store.s.lastTx;
    if(!lt||!SERVICES[lt.service]){UI.typing(()=>{UI.bot(T('repeat_none'));UI.chips(UI.homeChips());});return;}
    UI.chips([]);
    this.tx={service:lt.service};
    Object.keys(lt.slots||{}).forEach(k=>{if(lt.slots[k]!=null)this.tx[k]=lt.slots[k];});
    if(this.tx.phone)this.tx.provider=detectNetwork(this.tx.phone);
    this.awaitingText=null;this.stage='fill';
    this.advance();
  },
  doHELP(){UI.typing(()=>{UI.bot(T('welcome'));UI.bot('ℹ️ '+T('demo_note'));UI.chips(UI.homeChips());});},
  doGREET(){const g=T('greet');UI.typing(()=>{UI.bot(g[Math.floor(Math.random()*g.length)]);UI.chips(UI.homeChips());});},
  doTHANKS(){const g=T('thanks');UI.typing(()=>UI.bot(g[Math.floor(Math.random()*g.length)]));},
  doYES(){
    /* "ndio/sawa" while a review card is open should move the tx forward */
    if(this.tx&&this.stage==='review'){
      const svc=SERVICES[this.tx.service];
      if(svc.auth!=='pin'||!(this.tx._cost>0)){this.confirmNoPin();return;}
      UI.typing(()=>UI.bot(T('yes_hint')));
      return;
    }
    UI.typing(()=>UI.bot(T('more_help')));
  },
  doACCOUNT(){UI.typing(()=>UI.accountCard());}
};

/* ============================ 4. UI ============================ */
const UI={
  chat:null,input:null,

  init(){
    this.chat=$('chat');this.input=$('userInput');
    $('sendBtn').addEventListener('click',()=>this.send());
    this.input.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.send();}
    });
    this.input.addEventListener('input',()=>{
      this.input.style.height='auto';
      this.input.style.height=Math.min(this.input.scrollHeight,96)+'px';
    });
    $('chips').addEventListener('click',e=>{
      const c=e.target.closest('.chip');if(!c)return;
      this.user(c.textContent.trim());
      Engine.handle(c.dataset.val||c.textContent.replace(/^[^\w]+/,'').trim());
    });
    $('balPill').addEventListener('click',()=>{Store.s.balHidden=!Store.s.balHidden;Store.save();this.refreshBalances();});
    $('langBtn').addEventListener('click',()=>App.toggleLang());
    $('menuBtn').addEventListener('click',()=>Sheets.open('menuSheet'));
    $('plusBtn').addEventListener('click',()=>Sheets.open('svcSheet'));
    $('veil').addEventListener('click',()=>Sheets.close());
    /* physical keyboard on the PIN pad (desktop / bluetooth keyboards) */
    document.addEventListener('keydown',e=>{
      if(!$('pinMsg'))return;
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='TEXTAREA'||ae.tagName==='INPUT'))return;
      if(/^[0-9]$/.test(e.key)){e.preventDefault();Engine.pinKey(e.key);}
      else if(e.key==='Backspace'){e.preventDefault();Engine.pinKey('del');}
      else if(e.key==='Escape'){Engine.cancel(true);}
    });
  },

  send(){
    const v=this.input.value.trim();if(!v)return;
    this.input.value='';this.input.style.height='auto';
    Engine.lastVoice=false;
    this.user(v);
    Engine.handle(v);
  },

  /* ---------- message primitives ---------- */
  scroll(){requestAnimationFrame(()=>{this.chat.scrollTop=this.chat.scrollHeight;});},
  user(text){
    const el=document.createElement('div');
    el.className='msg user';
    el.innerHTML=`<div class="bubble">${escapeHTML(text)}</div>`;
    this.chat.appendChild(el);this.scroll();
  },
  bot(text,html){
    const el=document.createElement('div');
    el.className='msg bot'+(html?' card-msg':'');
    el.innerHTML=html?html:`<div class="bubble">${escapeHTML(text)}</div>`;
    this.chat.appendChild(el);this.scroll();
    if(!html&&text)Voice.say(text);
    return el;
  },
  card(html){return this.bot(null,html);},
  typing(cb,ms){
    const t=document.createElement('div');
    t.className='typing';t.innerHTML='<span></span><span></span><span></span>';
    this.chat.appendChild(t);this.scroll();
    setTimeout(()=>{t.remove();cb&&cb();},ms||520);
  },
  chips(list){
    const box=$('chips');box.innerHTML='';
    (list||[]).forEach((c,i)=>{
      const b=document.createElement('button');
      b.className='chip';b.style.animationDelay=(i*40)+'ms';b.textContent=c;
      box.appendChild(b);
    });
  },
  /* home chips reordered by what THIS user actually does most */
  homeChips(){
    const base=I18N[Store.s.lang].chips_home;
    const keys=['BALANCE','DATA','AIRTIME','MONEY','LUKU','SMS','MINUTES','HISTORY'];
    const counts={};
    (Store.s.history||[]).forEach(r=>{if(r.status==='SUCCESS')counts[r.type]=(counts[r.type]||0)+1;});
    return base.map((c,i)=>({c,n:counts[keys[i]]||0,i}))
      .sort((a,b)=>b.n-a.n||a.i-b.i)
      .map(x=>x.c);
  },
  toast(msg){
    const t=$('toast');t.textContent=msg;t.classList.add('show');
    clearTimeout(this._tt);this._tt=setTimeout(()=>t.classList.remove('show'),2200);
  },

  /* ---------- slot prompts ---------- */
  askAmount(presets,title){
    const svc=Engine.tx?SERVICES[Engine.tx.service]:null;
    let html=`<div class="rcard"><div class="rcard-title">${svc?svc.icon+' '+escapeHTML(svc.name()):''}</div>
      <div style="font-size:13.5px;margin-bottom:9px">${escapeHTML(title||T('ask_amount'))}</div>
      <div class="amt-grid">${presets.map(a=>`<button class="amt-btn" onclick="Engine.pickAmount(${a})">${fmt(a)}</button>`).join('')}</div>
      <div class="hint">${Store.s.lang==='sw'?'Au andika kiasi chochote — hata “buku” au “jero” 😉':'Or type any amount'}</div></div>`;
    this.card(html);
  },
  askPhone(){
    let html=`<div class="rcard"><div class="rcard-title">💸 ${escapeHTML(SERVICES.MONEY.name())}</div>
      <div style="font-size:13.5px">${escapeHTML(T('ask_phone'))}</div>`;
    (Store.s.contacts||[]).slice(0,6).forEach((c,i)=>{
      html+=`<button class="btn-block ghost" style="justify-content:flex-start" onclick="Engine.pickContact(${i})">👤 ${escapeHTML(c.name)} · ${escapeHTML(c.phone)} ${netBadge(detectNetwork(c.phone))}</button>`;
    });
    html+=`<button class="btn-block ghost" onclick="UI.pasteClipboard()">📋 ${Store.s.lang==='sw'?'Bandika kutoka Clipboard':'Paste from clipboard'}</button></div>`;
    this.card(html);
    Engine.awaitingText='phone';
  },
  async pasteClipboard(){
    try{
      const txt=await navigator.clipboard.readText();
      const p=parse(txt);
      if(p.phone){this.user('📋 '+p.phone);Engine.tx.phone=p.phone;Engine.tx.provider=p.provider;Engine.awaitingText=null;Engine.advance();}
      else this.toast(Store.s.lang==='sw'?'Hakuna namba kwenye clipboard':'No number on clipboard');
    }catch(e){this.toast(Store.s.lang==='sw'?'Clipboard haipatikani':'Clipboard unavailable');}
  },
  askText(prompt,slotKey){
    this.bot(prompt);
    Engine.awaitingText=slotKey;
    this.input.focus();
  },
  showChoices(items,key,title){
    let html=`<div class="rcard"><div class="rcard-title">${escapeHTML(title)}</div>`;
    items.forEach(it=>{
      html+=`<div class="prod" onclick="Engine.pickChoice('${key}','${escapeHTML(it.val)}','${escapeHTML(it.label)}')">
        <div class="p-ico">${it.icon}</div><div class="p-body"><div class="p-name">${escapeHTML(it.label)}</div></div>
        <button class="p-buy">${Store.s.lang==='sw'?'Chagua':'Select'}</button></div>`;
    });
    html+='</div>';
    this.card(html);
  },
  showBundles(list,tx){
    Engine._bundleList=list;
    const filtered=list.length<DATA_CATALOGUE.length;
    let html=`<div class="rcard"><div class="rcard-title">📶 ${escapeHTML(T('data_hdr'))}</div>`;
    if(tx&&tx.amount&&filtered)html+=`<div class="hint" style="margin:0 0 8px">${escapeHTML(T('best_for',fmt(tx.amount)))}</div>`;
    let lastPeriod='';
    const periodLbl={daily:Store.s.lang==='sw'?'Kila Siku':'Daily',weekly:Store.s.lang==='sw'?'Wiki':'Weekly',monthly:Store.s.lang==='sw'?'Mwezi':'Monthly'};
    list.forEach((b,i)=>{
      if(!filtered&&b.period!==lastPeriod){html+=`<div class="p-cat">${periodLbl[b.period]}</div>`;lastPeriod=b.period;}
      html+=`<div class="prod">
        <div class="p-ico">📶</div>
        <div class="p-body"><div class="p-name">${escapeHTML(b.name)}</div><div class="p-sub">${escapeHTML(b.validity)}</div></div>
        <div style="text-align:right"><div class="p-price">Tsh ${fmt(b.price)}</div></div>
        <button class="p-buy" onclick="Engine.pickBundle(${i})">${escapeHTML(T('buy'))}</button>
      </div>`;
    });
    html+=`<div class="hint">${escapeHTML(T('ask_bundle'))}</div></div>`;
    this.card(html);
  },
  showPacks(cat,title,icon){
    Engine._packList=cat;
    let html=`<div class="rcard"><div class="rcard-title">${icon} ${escapeHTML(title)}</div>`;
    cat.forEach((p,i)=>{
      html+=`<div class="prod">
        <div class="p-ico">${icon}</div>
        <div class="p-body"><div class="p-name">${escapeHTML(p.name)}</div><div class="p-sub">${escapeHTML(p.validity)}</div></div>
        <div class="p-price">Tsh ${fmt(p.price)}</div>
        <button class="p-buy" onclick="Engine.pickPack(${i})">${escapeHTML(T('buy'))}</button>
      </div>`;
    });
    html+='</div>';
    this.card(html);
  },

  /* ---------- insufficient balance → pay-via options (engine doc flow) ---------- */
  insufficient(shortfall,src){
    let html=`<div class="rcard" style="border-left:4px solid var(--gold)">
      <div class="rcard-title">💳 ${escapeHTML(T('pay_via'))}</div>
      <div style="font-size:13px;margin-bottom:10px">${escapeHTML(T('insufficient',fmt(shortfall),src||'wallet'))}</div>`;
    WALLET_LIST.forEach(w=>{
      html+=`<button class="btn-block ghost" style="justify-content:flex-start" onclick="Engine.useExternalWallet('${w}')">📱 ${w}</button>`;
    });
    html+=`<button class="btn-block red" onclick="Engine.cancel(true)">✕ ${escapeHTML(T('cancel'))}</button></div>`;
    this.card(html);
  },

  /* ---------- SIGNATURE: review card with "detected" strip + rows ---------- */
  reviewCard(tx,svc){
    const rows=svc.review(tx);
    const dchips=[];
    dchips.push(`<span class="d-chip">${svc.icon} <b>${escapeHTML(svc.name())}</b></span>`);
    if(tx.amount)dchips.push(`<span class="d-chip">💰 <b>Tsh ${fmt(tx._cost||tx.amount)}</b></span>`);
    if(tx.provider)dchips.push(`<span class="d-chip">${netBadge(tx.provider)}</span>`);
    if(tx.paySource)dchips.push(`<span class="d-chip">💳 <b>${escapeHTML(tx.paySource)}</b></span>`);
    const balAfter=tx.paySourceExternal?Store.s.bal.wallet:(Store.s.bal.wallet-(tx._cost||0));
    /* peer-to-peer sends (MONEY/INTL) get elevated recipient/amount emphasis — irreversible once PIN is entered */
    const isPeer=!!svc.peerTransfer;
    const recipRow=isPeer?rows.find(r=>r[0]===T('recipient')):null;
    const bodyRows=isPeer&&recipRow?rows.filter(r=>r!==recipRow):rows;
    let html=`<div class="rcard${isPeer?' rcard-xfer':''}" style="border-left:4px solid ${isPeer?'var(--gold-deep)':'var(--gold)'}">
      <div class="detected">
        <span class="d-lbl">✨ ${escapeHTML(T('detected'))}</span>
        ${dchips.join('')}
      </div>`;
    if(recipRow){
      html+=`<div class="xfer-to">
        <span class="x-ava">${svc.icon}</span>
        <span class="x-body">
          <span class="x-lbl">${escapeHTML(T('sending_to'))}</span>
          <span class="x-num">${escapeHTML(String(recipRow[1]))}</span>
        </span>
      </div>`;
    }
    html+=`<div class="rcard-title">${svc.icon} ${escapeHTML(T('confirm'))}</div>`;
    bodyRows.forEach(r=>{
      const big=isPeer&&r[0]===T('amount')?' big':'';
      html+=`<div class="rcard-row"><span class="k">${escapeHTML(r[0])}</span><span class="v ${(r[2]||'')+big}">${r[0]===T('network')&&tx.provider?netBadge(tx.provider)+' '+escapeHTML(networkWallet(tx.provider)):escapeHTML(String(r[1]))}</span></div>`;
    });
    if((tx._cost||0)>0&&!tx.paySourceExternal){
      html+=`<div class="rcard-row"><span class="k">${escapeHTML(T('bal_after'))}</span><span class="v">Tsh ${fmt(balAfter)}</span></div>`;
    }
    if(isPeer){
      html+=`<div class="xfer-warn">⚠️ ${escapeHTML(T('xfer_warn'))}</div>`;
    }
    if(svc.auth!=='pin'||!(tx._cost>0)){
      html+=`<div class="btn-grid" style="margin-top:10px">
        <button class="btn-block" onclick="Engine.confirmNoPin()">✓ ${escapeHTML(T('confirm'))}</button>
        <button class="btn-block red" onclick="Engine.cancel(true)">✕ ${escapeHTML(T('cancel'))}</button></div>`;
    }
    html+='</div>';
    this.card(html);
  },

  /* ---------- PIN pad ---------- */
  pinPad(cost){
    this.removePinPad();
    const el=document.createElement('div');
    el.className='msg bot card-msg';el.id='pinMsg';
    el.innerHTML=`<div class="pin-card">
      <div class="pin-title">🔒 ${escapeHTML(T('pin_title'))}</div>
      <div class="pin-sub" id="pinSub">${escapeHTML(T('pin_sub',fmt(cost)))}</div>
      <div class="pin-dots" id="pinDots">${'<span class="pin-dot"></span>'.repeat(4)}</div>
      <div class="pin-pad">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" onclick="Engine.pinKey('${n}')">${n}</button>`).join('')}
        <button class="pin-key fn" onclick="Engine.cancel(true)">${escapeHTML(T('cancel'))}</button>
        <button class="pin-key" onclick="Engine.pinKey('0')">0</button>
        <button class="pin-key fn" onclick="Engine.pinKey('del')">⌫</button>
      </div>
    </div>`;
    this.chat.appendChild(el);this.scroll();
  },
  pinDots(n){
    const dots=$('pinDots');if(!dots)return;
    dots.classList.remove('err');
    [...dots.children].forEach((d,i)=>d.classList.toggle('on',i<n));
  },
  pinError(msg){
    const dots=$('pinDots'),sub=$('pinSub');
    if(dots){dots.classList.add('err');[...dots.children].forEach(d=>d.classList.remove('on'));}
    if(sub){sub.textContent=msg;sub.style.color='var(--danger)';}
    if(navigator.vibrate)navigator.vibrate(120);
  },
  removePinPad(){const p=$('pinMsg');if(p)p.remove();},

  /* ---------- receipt / failure ---------- */
  receipt(rec,extra,tx,bal){
    Engine._lastReceipt=rec;
    Engine._lastReceiptCtx={rec,extra:extra||[],tx,bal,failed:false};
    let rows='';
    rows+=`<div class="rcard-row"><span class="k">Ref</span><span class="v mono">${escapeHTML(rec.ref)}</span></div>`;
    rows+=`<div class="rcard-row"><span class="k">${escapeHTML(T('date'))}</span><span class="v">${escapeHTML(rec.date)} · ${escapeHTML(rec.time)}</span></div>`;
    if(rec.amount>0)rows+=`<div class="rcard-row"><span class="k">${escapeHTML(T('amount'))}</span><span class="v gold">Tsh ${fmt(rec.amount)}</span></div>`;
    rows+=`<div class="rcard-row"><span class="k">${escapeHTML(T('details'))}</span><span class="v">${escapeHTML(rec.details)}</span></div>`;
    (extra||[]).forEach(r=>{
      rows+=`<div class="rcard-row"><span class="k">${escapeHTML(r[0])}</span><span class="v ${r[2]||''}">${escapeHTML(String(r[1]))}</span></div>`;
    });
    const html=`<div class="rcard" style="border-left:4px solid var(--leaf)">
      <div class="succ-wrap">
        <div class="succ-ring"><svg viewBox="0 0 36 36"><path d="M8 19 l7 7 l13 -15"/></svg></div>
        <div class="succ-t">${escapeHTML(T('success'))}</div>
        <div class="succ-ref">${escapeHTML(rec.ref)}</div>
      </div>
      ${rows}
      <div class="btn-grid" style="margin-top:10px">
        <button class="btn-block ghost" onclick="Receipt.share()">📤 ${escapeHTML(T('receipt_share'))}</button>
        <button class="btn-block ghost" onclick="Receipt.pdf()">📄 ${escapeHTML(T('receipt_save'))}</button>
      </div>
    </div>`;
    this.card(html);
    if(navigator.vibrate)navigator.vibrate([60,40,60]);
    setTimeout(()=>{this.bot(T('more_help'));this.chips(this.homeChips());},900);
    /* offer to save an unknown recipient as a contact */
    if(tx&&tx.phone&&!tx.contactName&&!isSelfPhone(tx.phone)
       &&/^(\+?255|0)\d{9}$/.test(tx.phone)
       &&!(Store.s.contacts||[]).some(c=>c.phone===tx.phone)){
      const ph=tx.phone;
      setTimeout(()=>this.contactSavePrompt(ph),1600);
    }
  },
  contactSavePrompt(phone){
    const html=`<div class="rcard">
      <div class="rcard-title">👤 ${escapeHTML(T('contact_save',phone))}</div>
      <div class="btn-grid">
        <button class="btn-block" onclick="this.closest('.msg').remove();Engine.saveContactStart('${escapeHTML(phone)}')">💾 ${escapeHTML(T('save_lbl'))}</button>
        <button class="btn-block ghost" onclick="this.closest('.msg').remove()">${escapeHTML(T('later'))}</button>
      </div></div>`;
    this.card(html);
  },
  failed(rec,tx){
    Engine._lastFailed=rec;
    Engine._lastReceiptCtx={rec,extra:[],tx,bal:null,failed:true};
    const html=`<div class="rcard" style="border-left:4px solid var(--danger);background:var(--danger-soft)">
      <div class="rcard-title" style="color:var(--danger)">❌ ${escapeHTML(T('failed'))}</div>
      <div class="rcard-row"><span class="k">Ref</span><span class="v mono">${escapeHTML(rec.ref)}</span></div>
      <div class="rcard-row"><span class="k">${escapeHTML(T('details'))}</span><span class="v">${escapeHTML(rec.reason||'')}</span></div>
      <button class="btn-block" onclick="Engine.retryLast()">🔄 ${Store.s.lang==='sw'?'Jaribu Tena':'Retry'}</button>
      <button class="btn-block ghost" style="margin-top:8px" onclick="Receipt.pdf()">📄 ${escapeHTML(T('receipt_save'))}</button>
    </div>`;
    this.card(html);
    setTimeout(()=>this.chips(this.homeChips()),600);
  },

  /* ---------- instant cards ---------- */
  balanceCard(){
    const b=Store.s.bal;
    const html=`<div class="rcard" style="border-left:4px solid var(--gold)">
      <div class="rcard-title">💰 ${escapeHTML(T('balances'))}</div>
      <div class="rcard-row"><span class="k">${escapeHTML(T('wallet'))} (${escapeHTML(networkWallet(detectNetwork(Store.s.profile.phone)))})</span><span class="v gold">Tsh ${fmt(b.wallet)}</span></div>
      <div class="rcard-row"><span class="k">📱 ${escapeHTML(T('airtime'))}</span><span class="v">Tsh ${fmt(b.airtime)}</span></div>
      <div class="rcard-row"><span class="k">📶 ${escapeHTML(T('data'))}</span><span class="v">${fmtMB(b.dataMB)}</span></div>
      <div class="rcard-row"><span class="k">💬 ${escapeHTML(T('sms_b'))}</span><span class="v">${fmt(b.sms)}</span></div>
      <div class="rcard-row"><span class="k">📞 ${escapeHTML(T('mins'))}</span><span class="v">${fmt(b.minutes)}</span></div>
    </div>`;
    this.card(html);
  },
  historyCard(){
    const h=Store.s.history.slice(0,8);
    if(!h.length){this.bot(T('no_history'));return;}
    let rows=h.map(r=>{
      const ic=(SERVICES[r.type]||{}).icon||'🧾';
      const col=r.status==='SUCCESS'?'var(--leaf)':'var(--danger)';
      return`<div class="rcard-row">
        <span class="k">${ic} ${escapeHTML(r.details)}<br><span style="font-size:10.5px">${escapeHTML(r.date)} · ${escapeHTML(r.ref)}</span></span>
        <span class="v" style="color:${col}">${r.amount>0?'Tsh '+fmt(r.amount):'—'}</span></div>`;
    }).join('');
    this.card(`<div class="rcard"><div class="rcard-title">🧾 ${escapeHTML(T('history_t'))}</div>${rows}</div>`);
  },
  usageCard(){
    const succ=(Store.s.history||[]).filter(r=>r.status==='SUCCESS'&&r.amount>0);
    if(!succ.length){this.bot(T('usage_none'));return;}
    const total=succ.reduce((s,r)=>s+r.amount,0);
    const by={};
    succ.forEach(r=>{by[r.type]=(by[r.type]||0)+r.amount;});
    let rows=`<div class="rcard-row"><span class="k">${escapeHTML(T('usage_total'))}</span><span class="v gold">Tsh ${fmt(total)}</span></div>
      <div class="rcard-row"><span class="k">${escapeHTML(T('usage_count'))}</span><span class="v">${succ.length}</span></div>`;
    Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([k,v])=>{
      const svc=SERVICES[k];
      rows+=`<div class="rcard-row"><span class="k">${svc?svc.icon+' '+escapeHTML(svc.name()):escapeHTML(k)}</span><span class="v">Tsh ${fmt(v)} · ${Math.round(v/total*100)}%</span></div>`;
    });
    this.card(`<div class="rcard" style="border-left:4px solid var(--blue)"><div class="rcard-title">📊 ${escapeHTML(T('usage_t'))}</div>${rows}</div>`);
  },
  accountCard(){
    const p=Store.s.profile;
    const net=detectNetwork(p.phone);
    const html=`<div class="rcard">
      <div class="rcard-title">👤 ${Store.s.lang==='sw'?'Akaunti Yangu':'My Account'}</div>
      <div class="rcard-row"><span class="k">${escapeHTML(T('acc_phone'))}</span><span class="v">${escapeHTML(p.phone)} ${netBadge(net)}</span></div>
      <label class="lbl-sm" style="display:block;margin-top:10px">${escapeHTML(T('acc_name'))}</label>
      <input class="txt" id="accName" value="${escapeHTML(p.name)}" placeholder="—">
      <label class="lbl-sm" style="display:block;margin-top:10px">${escapeHTML(T('acc_phone'))}</label>
      <input class="txt" id="accPhone" value="${escapeHTML(p.phone)}" inputmode="tel">
      <label class="lbl-sm" style="display:block;margin-top:10px">${escapeHTML(T('acc_pin'))}</label>
      <input class="txt" id="accPin" placeholder="****" inputmode="numeric" maxlength="4" type="password">
      <button class="btn-block" onclick="App.saveAccount()">💾 ${Store.s.lang==='sw'?'Hifadhi':'Save'}</button>
      <button class="btn-block red" onclick="App.resetDemo()">🗑️ ${escapeHTML(T('acc_reset'))}</button>
    </div>`;
    this.card(html);
  },

  /* ---------- header balances ---------- */
  refreshBalances(){
    const b=Store.s.bal,hid=Store.s.balHidden;
    $('balWallet').textContent=hid?'Tsh ••••••':'Tsh '+fmt(b.wallet);
    $('balMini').textContent=hid?'📱 •••• · 📶 ••••':`📱 Tsh ${fmt(b.airtime)} · 📶 ${fmtMB(b.dataMB)}`;
    $('balEye').textContent=hid?'🙈':'👁️';
    $('balLbl').textContent=networkWallet(detectNetwork(Store.s.profile.phone))||T('wallet');
  }
};

/* ---------- receipt export ---------- */
const Receipt={
  text(){
    const r=Engine._lastReceipt;if(!r)return'';
    const L=[];
    L.push('═══════ SEMATEL ═══════');
    L.push((Store.s.lang==='sw'?'RISITI YA MUAMALA':'TRANSACTION RECEIPT'));
    L.push('');
    L.push('Ref     : '+r.ref);
    L.push((Store.s.lang==='sw'?'Tarehe':'Date')+'  : '+r.date+' '+r.time);
    if(r.amount>0)L.push((Store.s.lang==='sw'?'Kiasi':'Amount')+'   : Tsh '+fmt(r.amount));
    L.push((Store.s.lang==='sw'?'Maelezo':'Details')+' : '+r.details);
    if(r.token)L.push('TOKEN   : '+r.token);
    L.push('Status  : '+r.status);
    L.push('');
    L.push('SemaTel · '+(Store.s.lang==='sw'?'Sema. Thibitisha. Maliza.':'Say it. Confirm. Done.'));
    return L.join('\n');
  },
  async share(){
    const txt=this.text();if(!txt)return;
    if(navigator.share){try{await navigator.share({title:'SemaTel Receipt',text:txt});return;}catch(e){}}
    try{await navigator.clipboard.writeText(txt);UI.toast(T('copied'));}catch(e){}
  },
  /* ---------- styled, printable PDF receipt (opens a tab → user "Save as PDF") ---------- */
  pdf(){
    const ctx=Engine._lastReceiptCtx;
    if(!ctx||!ctx.rec)return;
    const{rec,extra,tx,bal,failed}=ctx;
    const sw=Store.s.lang==='sw';
    const svc=SERVICES[rec.type];
    const rows=[];
    rows.push([T('receipt_service'),svc?svc.name():rec.type]);
    rows.push([T('details'),rec.details]);
    if(tx&&tx.paySource)rows.push([T('receipt_method'),tx.paySource]);
    rows.push([T('date'),rec.date+' · '+rec.time]);
    rows.push([T('receipt_phone'),Store.s.profile.phone]);
    const seen=new Set(rows.map(r=>r[0]));
    (extra||[]).forEach(r=>{if(seen.has(r[0]))return;seen.add(r[0]);rows.push([r[0],String(r[1])]);});
    if(!failed&&bal&&tx&&!tx.paySourceExternal&&rec.amount>0){
      rows.push([T('receipt_bal_before'),'Tsh '+fmt(bal.before)]);
      rows.push([T('receipt_bal_after'),'Tsh '+fmt(bal.after)]);
    }
    if(failed)rows.push([T('receipt_reason'),rec.reason||'']);

    const rowsHtml=rows.map(([k,v])=>`<div class="r-row"><span class="r-k">${escapeHTML(k)}</span><span class="r-v">${escapeHTML(v)}</span></div>`).join('');
    const badge=failed
      ?`<span class="r-badge r-badge-fail">✕ ${escapeHTML(T('failed'))}</span>`
      :`<span class="r-badge">✓ ${escapeHTML(T('success'))}</span>`;
    const total=(!failed&&rec.amount>0)
      ?`<div class="r-total"><span>${escapeHTML(T('receipt_total'))}</span><span class="r-total-amt">Tsh ${fmt(rec.amount)}</span></div>`
      :'';

    const doc=`<!DOCTYPE html><html lang="${sw?'sw':'en'}"><head><meta charset="UTF-8">
<title>SemaTel Receipt ${escapeHTML(rec.ref)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
:root{--forest:#0B4D33;--forest-2:#0F6B45;--gold:#E8B93B;--gold-deep:#B8860B;--ink:#131A16;--muted:#71807A;--line:#DDE3DF;--leaf-soft:rgba(23,160,94,.12);--danger:#D33A2C;--danger-soft:#FDF0EE}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#eef1ef;color:var(--ink);padding:28px 14px;display:flex;justify-content:center}
.r-card{width:100%;max-width:460px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(11,26,18,.12)}
.r-hdr{background:linear-gradient(120deg,#0B4D33 0%,#0F6B45 55%,#B8860B 140%);color:#fff;padding:20px 20px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.r-hdr-l{display:flex;align-items:center;gap:11px}
.r-logo{width:38px;height:38px;border-radius:12px;background:var(--gold);color:var(--forest);display:grid;place-items:center;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;flex:0 0 auto}
.r-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:17px}
.r-name em{font-style:normal;color:var(--gold)}
.r-tag{font-size:10px;letter-spacing:1px;opacity:.85;margin-top:1px}
.r-pill{font-size:10.5px;font-weight:800;letter-spacing:.6px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:4px 11px;flex:0 0 auto;white-space:nowrap}
.r-torn{border-top:2px dashed rgba(232,185,59,.55)}
.r-body{padding:18px 20px 6px}
.r-refline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:14px;border-bottom:1px dashed var(--line);margin-bottom:4px}
.r-lbl{font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
.r-ref{font-family:ui-monospace,monospace;font-weight:700;font-size:15px;margin-top:2px}
.r-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:var(--forest);background:var(--leaf-soft);border-radius:999px;padding:5px 11px;white-space:nowrap}
.r-badge-fail{color:var(--danger);background:var(--danger-soft)}
.r-row{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px dashed var(--line);font-size:12.5px}
.r-row:last-of-type{border-bottom:none}
.r-k{color:var(--muted)}
.r-v{font-weight:700;text-align:right}
.r-total{display:flex;justify-content:space-between;align-items:center;background:#F4F7F3;border-radius:12px;padding:12px 14px;margin:14px 0 4px;font-weight:800;font-size:12.5px;letter-spacing:.5px;color:var(--forest-2)}
.r-total-amt{font-family:'Bricolage Grotesque',sans-serif;font-size:19px;color:var(--forest)}
.r-foot{text-align:center;padding:16px 20px 22px;border-top:1px dashed var(--line);margin-top:10px}
.r-thanks{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;color:var(--forest);font-size:13.5px}
.r-sub{font-size:11px;color:var(--muted);margin-top:3px}
.r-ver{font-size:10px;color:var(--muted);margin-top:8px;opacity:.7}
@media print{
  body{background:#fff;padding:0}
  .r-card{box-shadow:none;border-radius:0;max-width:100%}
}
</style>
</head><body>
<div class="r-card">
  <div class="r-hdr">
    <div class="r-hdr-l">
      <span class="r-logo">S</span>
      <div><div class="r-name">Sema<em>Tel</em></div><div class="r-tag">SEMA · PATA · MALIZA</div></div>
    </div>
    <span class="r-pill">${sw?'RISITI':'RECEIPT'}</span>
  </div>
  <div class="r-torn"></div>
  <div class="r-body">
    <div class="r-refline">
      <div><div class="r-lbl">${escapeHTML(T('receipt_no'))}</div><div class="r-ref">${escapeHTML(rec.ref)}</div></div>
      ${badge}
    </div>
    ${rowsHtml}
    ${total}
  </div>
  <div class="r-foot">
    <div class="r-thanks">${escapeHTML(T('receipt_thanks'))}</div>
    <div class="r-sub">${escapeHTML(T('receipt_keep'))}</div>
    <div class="r-ver">SemaTel v5 · Tanzania · ${escapeHTML(rec.date)} ${escapeHTML(rec.time)}</div>
  </div>
</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});<\/script>
</body></html>`;

    const w=window.open('','_blank');
    if(!w){UI.toast(T('receipt_popup_blocked'));return;}
    w.document.open();w.document.write(doc);w.document.close();
  }
};

/* ============================ SHEETS ============================ */
const Sheets={
  open(id){
    if(id==='svcSheet')this.renderServices();
    if(id==='menuSheet')this.renderMenu();
    $('veil').classList.add('open');$(id).classList.add('open');
    this._open=id;
  },
  close(){
    $('veil').classList.remove('open');
    ['svcSheet','menuSheet'].forEach(i=>$(i).classList.remove('open'));
    this._open=null;
  },
  renderServices(){
    $('svcSheetTitle').textContent=T('svc_all');
    const grid=$('svcGrid');grid.innerHTML='';
    const order=['AIRTIME','DATA','SMS','MINUTES','MONEY','LUKU','BILLS','VOUCHER','GOVT','SCHOOL','PAYBILL','INTL'];
    order.forEach(k=>{
      const s=SERVICES[k];
      const b=document.createElement('button');
      b.className='svc';
      b.innerHTML=`<span class="s-ico">${s.icon}</span><span class="s-lbl">${escapeHTML(s.name())}</span>`;
      b.onclick=()=>{Sheets.close();UI.user(s.icon+' '+s.name());Engine.start(k,{});};
      grid.appendChild(b);
    });
    /* instant items */
    [['BALANCE','💰',Store.s.lang==='sw'?'Salio':'Balance'],
     ['HISTORY','🧾',Store.s.lang==='sw'?'Miamala':'History'],
     ['USAGE','📊',Store.s.lang==='sw'?'Matumizi':'Usage'],
     ['ACCOUNT','👤',Store.s.lang==='sw'?'Akaunti':'Account'],
     ['HELP','❓',Store.s.lang==='sw'?'Msaada':'Help']].forEach(([k,ic,lb])=>{
      const b=document.createElement('button');
      b.className='svc';
      b.innerHTML=`<span class="s-ico">${ic}</span><span class="s-lbl">${escapeHTML(lb)}</span>`;
      b.onclick=()=>{Sheets.close();UI.user(ic+' '+lb);Engine['do'+k]({});};
      grid.appendChild(b);
    });
  },
  renderMenu(){
    $('menuSheetTitle').textContent=T('menu');
    const sw=Store.s.lang==='sw';
    const list=$('menuList');list.innerHTML='';
    const items=[
      {ic:'🧾',t:sw?'Miamala ya Karibuni':'Recent Transactions',sub:sw?'Risiti na historia':'Receipts & history',fn:()=>{Sheets.close();Engine.doHISTORY();}},
      {ic:'👤',t:sw?'Akaunti Yangu':'My Account',sub:sw?'Jina, namba na PIN':'Name, number & PIN',fn:()=>{Sheets.close();Engine.doACCOUNT();}},
      {ic:'🔊',t:sw?'Sauti ya Majibu':'Voice Replies',sub:(Store.s.tts?(sw?'Imewashwa ✓':'On ✓'):(sw?'Imezimwa':'Off')),fn:()=>{Store.s.tts=!Store.s.tts;Store.save();Sheets.renderMenu();}},
      {ic:'🌓',t:T('theme'),sub:T('theme_'+(Store.s.theme||'auto')),fn:()=>{App.cycleTheme();Sheets.renderMenu();}},
      Voice.isStandalone()
        ?{ic:'✅',t:sw?'Imesakinishwa':'Installed',sub:sw?'SemaTel iko kwenye simu yako':'SemaTel is on your device',fn:()=>{Sheets.close();UI.toast(T('installed'));}}
        :{ic:'📲',t:T('install'),sub:sw?'Weka SemaTel kwenye simu yako':'Add SemaTel to your phone',fn:()=>{Sheets.close();App.install();}},
      {ic:'ℹ️',t:sw?'Kuhusu':'About',sub:'SemaTel Engine v5 · Demo',fn:()=>{Sheets.close();UI.bot('SemaTel v5 — '+T('tag')+'\n\n'+T('demo_note'));}}
    ];
    items.forEach(it=>{
      const b=document.createElement('button');
      b.className='menu-item';
      b.innerHTML=`<span class="mi-ico">${it.ic}</span><span>${escapeHTML(it.t)}<span class="mi-sub">${escapeHTML(it.sub)}</span></span>`;
      b.onclick=it.fn;
      list.appendChild(b);
    });
  }
};

/* ============================ 5. VOICE ============================ */
const Voice={
  rec:null,active:false,

  isIOS(){
    return(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  },
  isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;},
  SR(){return window.SpeechRecognition||window.webkitSpeechRecognition;},

  init(){
    $('micBtn').addEventListener('click',()=>this.toggle());
  },

  toggle(){
    if(this.active){this.stop();return;}
    const SR=this.SR();
    if(!SR){
      /* iOS home-screen apps sometimes lack SR → relay via Safari tab */
      if(this.isIOS()&&this.isStandalone()){this.relay();return;}
      UI.toast(T('voice_unsupported'));return;
    }
    try{
      const r=new SR();
      r.lang=Store.s.lang==='sw'?'sw-TZ':'en-US';
      r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
      let finalTxt='';
      r.onstart=()=>{this.setActive(true);};
      r.onresult=e=>{
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          if(e.results[i].isFinal)finalTxt+=e.results[i][0].transcript;
          else interim+=e.results[i][0].transcript;
        }
        $('userInput').value=finalTxt||interim;
      };
      r.onerror=e=>{
        this.setActive(false);
        if(e.error==='not-allowed'||e.error==='service-not-allowed')UI.toast(T('voice_denied'));
        else if(e.error!=='no-speech'&&e.error!=='aborted')UI.toast(T('voice_unsupported'));
      };
      r.onend=()=>{
        this.setActive(false);
        const v=$('userInput').value.trim();
        if(v){
          $('userInput').value='';
          Engine.lastVoice=true;
          UI.user('🎙️ '+v);
          Engine.handle(v);
        }
      };
      this.rec=r;r.start();
    }catch(e){UI.toast(T('voice_unsupported'));}
  },
  stop(){try{this.rec&&this.rec.stop();}catch(e){}this.setActive(false);},
  setActive(on){
    this.active=on;
    $('micBtn').classList.toggle('rec',on);
    $('voiceHint').classList.toggle('show',on);
    $('voiceHintTxt').textContent=T('listening');
  },

  /* --- iOS standalone relay: open Safari tab, capture speech there,
         deliver back via localStorage (polling + storage event) --- */
  relay(){
    const sid='vs_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    const base=location.href.split('?')[0].split('#')[0];
    const url=base+'?voiceMode=1&sid='+sid+'&lang='+Store.s.lang;
    const w=window.open(url,'_blank');
    if(!w){const a=document.createElement('a');a.href=url;a.target='_blank';document.body.appendChild(a);a.click();a.remove();}
    this.setActive(true);
    const started=Date.now();
    const poll=setInterval(()=>{
      const raw=localStorage.getItem('_voiceResult_'+sid);
      if(raw){
        clearInterval(poll);this.setActive(false);
        localStorage.removeItem('_voiceResult_'+sid);
        try{
          const res=JSON.parse(raw);
          if(res.text){Engine.lastVoice=true;UI.user('🎙️ '+res.text);Engine.handle(res.text);}
        }catch(e){}
      }else if(Date.now()-started>45000){clearInterval(poll);this.setActive(false);}
    },600);
  },

  /* text-to-speech replies (optional) */
  say(text){
    if(!Store.s.tts||!Engine.lastVoice||!window.speechSynthesis)return;
    try{
      const u=new SpeechSynthesisUtterance(String(text).replace(/[✅❌⚠️🎙️📱📶💰💬📞⚡🧾]/g,''));
      u.lang=Store.s.lang==='sw'?'sw':'en-US';u.rate=1.02;
      speechSynthesis.cancel();speechSynthesis.speak(u);
    }catch(e){}
  }
};

/* voice relay page (runs INSTEAD of the app when ?voiceMode=1) */
(function voiceModePage(){
  const q=new URLSearchParams(location.search);
  if(q.get('voiceMode')!=='1')return;
  const sid=q.get('sid'),lang=q.get('lang')||'sw';
  document.body.innerHTML=`<div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:linear-gradient(150deg,#0B4D33,#14814F);color:#fff;font-family:sans-serif;text-align:center;padding:24px">
    <div style="width:90px;height:90px;border-radius:50%;background:rgba(232,185,59,.2);display:grid;place-items:center;font-size:40px;animation:pulse 1.4s infinite" id="vIcon">🎙️</div>
    <div style="font-size:20px;font-weight:800" id="vTitle">${lang==='sw'?'Nasikiliza…':'Listening…'}</div>
    <div style="font-size:14px;opacity:.8" id="vSub">${lang==='sw'?'Sema sasa. Ukimaliza, dirisha hili litajifunga.':'Speak now. This tab will close when done.'}</div>
    <style>@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}</style></div>`;
  const done=(text,err)=>{
    if(sid)localStorage.setItem('_voiceResult_'+sid,JSON.stringify({text:text||'',err:!!err,at:Date.now()}));
    $('vTitle')&&($('vTitle').textContent=err?(lang==='sw'?'Imeshindikana':'Failed'):(lang==='sw'?'Imepokelewa ✓':'Got it ✓'));
    $('vIcon')&&($('vIcon').textContent=err?'⚠️':'✅');
    setTimeout(()=>{try{window.close();}catch(e){}},900);
  };
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){done('',true);return;}
  try{
    const r=new SR();
    r.lang=lang==='sw'?'sw-TZ':'en-US';r.interimResults=false;r.continuous=false;
    r.onresult=e=>done(e.results[0][0].transcript,false);
    r.onerror=e=>done('',true);
    r.onend=()=>{};
    r.start();
    setTimeout(()=>{try{r.stop();}catch(e){}},15000);
  }catch(e){done('',true);}
  throw new Error('__voiceModeHalt');  /* stop main app boot in this tab */
})();

/* ============================ 6. APP BOOT / PWA ============================ */
const App={
  deferredInstall:null,

  boot(){
    UI.init();Voice.init();
    this.applyLang();
    this.applyTheme();
    try{
      const mq=window.matchMedia('(prefers-color-scheme: dark)');
      if(mq.addEventListener)mq.addEventListener('change',()=>this.applyTheme());
      else if(mq.addListener)mq.addListener(()=>this.applyTheme());
    }catch(e){}
    UI.refreshBalances();
    this.netWatch();
    this.pwa();

    /* welcome — returning users get a much shorter splash */
    const back=Store.s.visited;
    setTimeout(()=>{
      $('splash').classList.add('hide');
      Store.s.visited=true;Store.save();
      UI.typing(()=>{
        UI.bot(back?T('welcome_back',Store.s.profile.name):T('welcome'));
        if(!back)UI.bot('ℹ️ '+T('demo_note'));
        UI.chips(UI.homeChips());
        /* manifest shortcut deep-links: ./?intent=AIRTIME */
        const q=new URLSearchParams(location.search);
        const it=(q.get('intent')||'').toUpperCase().replace('BUY_','').replace('SEND_','').replace('CHECK_','');
        if(it&&SERVICES[it])Engine.start(it,{});
        else if(it==='BALANCE')Engine.doBALANCE();
      },700);
    },back?1500:3000);

    /* stale voice sessions cleanup */
    try{
      Object.keys(localStorage).forEach(k=>{
        if(!k.startsWith('_voiceResult_'))return;
        const m=k.match(/^_voiceResult_vs_(\d+)_/);
        if(!m||Date.now()-parseInt(m[1],10)>86400000)localStorage.removeItem(k);
      });
    }catch(e){}
  },

  applyLang(){
    const sw=Store.s.lang==='sw';
    $('userInput').placeholder=T('placeholder');
    $('splashTag').textContent=T('tag');
    $('netBanner').textContent=sw?'⚠️ Hakuna intaneti — miamala itasubiri usawazishaji':'⚠️ Offline — transactions will queue until you\'re back';
    document.documentElement.lang=Store.s.lang;
    UI.refreshBalances();
  },
  toggleLang(){
    Store.s.lang=Store.s.lang==='sw'?'en':'sw';
    Store.save();this.applyLang();
    UI.bot(T('lang_switched'));
    UI.chips(UI.homeChips());
  },

  /* ---------- theme ---------- */
  applyTheme(){
    const pref=Store.s.theme||'auto';
    const dark=pref==='dark'||(pref==='auto'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme=dark?'dark':'light';
    const m=document.querySelector('meta[name="theme-color"]');
    if(m)m.content=dark?'#0A140F':'#0B4D33';
  },
  cycleTheme(){
    const order=['auto','dark','light'];
    Store.s.theme=order[(order.indexOf(Store.s.theme||'auto')+1)%order.length];
    Store.save();this.applyTheme();
  },

  saveAccount(){
    const n=$('accName'),p=$('accPhone'),pin=$('accPin');
    if(n)Store.s.profile.name=n.value.trim();
    if(p&&p.value.replace(/\D/g,'').length>=9)Store.s.profile.phone=p.value.trim();
    if(pin&&/^\d{4}$/.test(pin.value)){Store.s.profile.pinHash=hashPIN(pin.value);UI.toast(T('new_pin_ok'));}
    Store.save();UI.refreshBalances();
    UI.toast(Store.s.lang==='sw'?'Imehifadhiwa ✓':'Saved ✓');
  },
  resetDemo(){
    const lang=Store.s.lang,theme=Store.s.theme;
    Store.reset();Store.s.lang=lang;Store.s.theme=theme;Store.save();
    UI.refreshBalances();UI.toast(T('reset_ok'));
    UI.bot(T('welcome'));UI.chips(UI.homeChips());
  },

  netWatch(){
    const upd=()=>{
      const on=navigator.onLine;
      $('statusDot').classList.toggle('off',!on);
      $('netBanner').classList.toggle('show',!on);
      if(on&&Store.s.queue.length){
        const q=Store.s.queue.splice(0);Store.save();
        q.forEach(item=>{
          const stamp=nowStamp();
          const rec={ref:genRef(),type:item.service,details:item.details,amount:item.amount,date:stamp.date,time:stamp.time,status:'SUCCESS'};
          if(item.amount>0)Store.s.bal.wallet-=item.amount;
          Store.s.history.unshift(rec);
        });
        Store.save();UI.refreshBalances();
        UI.bot(Store.s.lang==='sw'?`✅ Miamala ${q.length} iliyokuwa foleni imekamilika.`:`✅ ${q.length} queued transaction(s) completed.`);
      }
    };
    window.addEventListener('online',upd);
    window.addEventListener('offline',upd);
    upd();
  },

  pwa(){
    if('serviceWorker'in navigator){
      navigator.serviceWorker.register('./sw.js').then(reg=>{
        reg.addEventListener('updatefound',()=>{
          const nw=reg.installing;
          nw&&nw.addEventListener('statechange',()=>{
            if(nw.state==='installed'&&navigator.serviceWorker.controller){
              nw.postMessage({type:'SKIP_WAITING'});
            }
          });
        });
      }).catch(()=>{});
    }
    if(window.__installPromptEvent)this.deferredInstall=window.__installPromptEvent;
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();this.deferredInstall=e;window.__installPromptEvent=e;
    });
    window.addEventListener('appinstalled',()=>{this.deferredInstall=null;window.__installPromptEvent=null;UI.toast(T('installed'));});
  },
  async install(){
    if(this.deferredInstall){
      this.deferredInstall.prompt();
      await this.deferredInstall.userChoice;
      this.deferredInstall=null;
    }else if(Voice.isIOS()){
      UI.bot('📲 '+T('install_ios'));
    }else if(Voice.isStandalone()){
      UI.toast(T('installed'));
    }else{
      UI.bot(Store.s.lang==='sw'
        ?'📲 Tumia menyu ya kivinjari (⋮) kisha “Install app / Add to Home screen”.'
        :'📲 Use the browser menu (⋮) then “Install app / Add to Home screen”.');
    }
  }
};

document.addEventListener('DOMContentLoaded',()=>App.boot());
