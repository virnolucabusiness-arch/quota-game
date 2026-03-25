const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ========================
// DATI DI GIOCO
// ========================

const CHARACTERS = [
  { id: 'fondatore',   name: 'Il Fondatore',  category: 'Nucleo',      flavor: 'Era già qui quando Luminèa ha preso il suo nome.',              effect: 'Sei immune alle penalità che colpiscono il giocatore con meno Reputazione.' },
  { id: 'fantasma',    name: 'Il Fantasma',   category: 'Nucleo',      flavor: 'Tu non sei mai dove pensano.',                                   effect: 'Una volta per partita: ignori completamente una penalità che ti colpisce. Annuncialo prima che venga applicata.' },
  { id: 'alchimista',  name: "L'Alchimista",  category: 'Tecnico',     flavor: 'Conosce le proporzioni giuste per far assorbire le risorse.',    effect: 'Una volta per partita (Fase Allocazione): scarti 1 carta e prendi 1 del tipo superiore dal mazzo.' },
  { id: 'calcolatore', name: 'Il Calcolatore',category: 'Tecnico',     flavor: 'Sa esattamente quanta energia assorbe ogni conduttore.',         effect: 'Se contribuisci in ≥3 turni su 5, il tetto di conversione (Rep×5) non si applica a te.' },
  { id: 'raccoglitore',name: 'Il Raccoglitore',category: 'Tecnico',    flavor: 'Segue il Protocollo finché serve. Poi smette.',                  effect: 'Fase B: puoi prendere 2 carte invece di 1. Prima volta −2 Rep, poi −1 Rep.' },
  { id: 'spia',        name: 'La Spia',       category: 'Informatore', flavor: 'Tu sei ciò che il Nucleo non ammette di avere.',                 effect: 'Una volta per turno: guardi 1 carta dalla mano di un avversario (lui sa che hai guardato).' },
  { id: 'notaio',      name: 'Il Notaio',     category: 'Informatore', flavor: 'Sa quanti siamo. Sa anche chi non dovrebbe esserci.',            effect: 'Una volta per turno (dopo reveal): chiedi a un giocatore quante carte ha. Se >5, perde 1 Rep.' },
  { id: 'oratore',     name: "L'Oratore",     category: 'Portavoce',   flavor: 'Le sue parole hanno costruito alleanze e distrutto amicizie.',   effect: 'Il Resoconto dura 90 secondi invece di 60.' },
  { id: 'negoziatore', name: 'Il Negoziatore',category: 'Portavoce',   flavor: 'Conosce il valore di tutto, incluso il prezzo di un accordo.',  effect: 'Una volta per turno (Resoconto): proponi un Patto. Se entrambi contribute nel turno dopo, entrambi +1 Rep.' },
  { id: 'sabotatore',  name: 'Il Sabotatore', category: 'Irregolare',  flavor: 'Qualcuno ha già manomesso il Bramafonte una volta.',             effect: 'Una volta per partita (Fase 1): dichiari Sabotaggio. Soglia +4. Se superata lo stesso, +2 Rep.' },
];

const OBJECTIVES = [
  { id: 'baluardo',       name: 'Il Baluardo',      category: 'Nucleo',       desc: '1 punto per ogni turno in cui sei il top contributor (max 4). Il pareggio conta.' },
  { id: 'sentinella',     name: 'La Sentinella',    category: 'Nucleo',       desc: '5 punti se almeno 3 crisi su 5 sono state superate.' },
  { id: 'costruttore',    name: 'Il Costruttore',   category: 'Nucleo',       desc: '2 punti per ogni crisi superata con soglia ≥6 (≥5 con 3 giocatori).' },
  { id: 'accumulatore',   name: "L'Accumulatore",   category: 'Opportunisti', desc: '6 punti se hai almeno 3 Minerali in mano a fine partita.' },
  { id: 'parassita',      name: 'Il Parassita',     category: 'Opportunisti', desc: '2 punti per ogni turno in cui contribuisci zero senza subire penalità. Max 6.' },
  { id: 'mercante',       name: 'Il Mercante',      category: 'Opportunisti', desc: '6 punti se hai almeno 3 tipi diversi di risorsa in mano a fine partita.' },
  { id: 'sopravvissuto',  name: 'Il Sopravvissuto', category: 'Opportunisti', desc: '4 punti se le penalità totali subite sono ≤2.' },
  { id: 'diplomatico',    name: 'Il Diplomatico',   category: 'Equilibristi', desc: '4 punti se il valore delle tue risorse differisce di max 5 dal giocatore alla tua sinistra.' },
  { id: 'ombra',          name: "L'Ombra",          category: 'Equilibristi', desc: '4 punti se almeno 1 giocatore ha Rep più alta e 1 più bassa della tua.' },
  { id: 'specchio',       name: 'Lo Specchio',      category: 'Equilibristi', desc: '1 punto per ogni turno in cui contribuisci lo stesso numero di carte del giocatore alla tua destra. Max 5.' },
  { id: 'censore',        name: 'Il Censore',       category: 'Equilibristi', desc: '4 punti se hai il punteggio base più alto. 2 punti se sei secondo.' },
  { id: 'fantasma_grigio',name: 'Il Fantasma Grigio',category:'Equilibristi', desc: '3 punti se non sei mai stato il top contributor in nessun turno.' },
];

const CRISES = [
  { id:1,  name:'Fluttuazione del Bramafonte',  fascia:'I',   thresholds:{3:6,4:8,5:9,6:10},  reqType:'any',      penalty:'Il giocatore con meno Rep perde 1 Rep.' },
  { id:2,  name:'Condutture Contaminate',        fascia:'I',   thresholds:{3:3,4:4,5:5,6:5},   reqType:'Organici', penalty:'Tutti perdono 1 Rep.' },
  { id:3,  name:'Spedizione Non Rientrata',      fascia:'I',   thresholds:{3:4,4:5,5:6,6:6},   reqType:'mixed',    reqMinType:'Minerali', reqMin:{3:1,4:2,5:2,6:2}, penalty:'Chi ha più risorse in mano perde 2 Rep.' },
  { id:4,  name:'Il Limite Superato',            fascia:'I',   thresholds:{3:7,4:9,5:11,6:13}, reqType:'any',      penalty:'Chi ha contribuito zero perde 3 Rep.', effectSuccess:'Top contributor +1 Rep.' },
  { id:5,  name:'Oscuramento Parziale',          fascia:'I',   thresholds:{3:3,4:5,5:6,6:7},   reqType:'mixed',    reqMinType:'Acquafonte', reqMin:{3:1,4:2,5:2,6:3}, penalty:'Tutti −1 Rep. Chi ha contribuito zero −2 in più.' },
  { id:6,  name:'Funghi delle Profondità',      fascia:'II',  thresholds:{3:5,4:6,5:7,6:7},   reqType:'Vegetali', penalty:'Chi ha più Vegetali in mano −2 Rep. Chi ha contribuito zero −1 Rep.' },
  { id:7,  name:'Crollo nella Galleria 7',      fascia:'II',  thresholds:{3:4,4:5,5:5,6:6},   reqType:'Minerali', penalty:'Tutti perdono 1 Rep.' },
  { id:8,  name:'Epidemia Silenziosa',          fascia:'II',  thresholds:{3:3,4:4,5:5,6:6},   reqType:'mixed',    reqMinType:'Organici', reqMin:{3:3,4:4,5:5,6:6}, reqExtra:'any', reqExtraMin:{3:2,4:2,5:2,6:2}, penalty:'Chi ha meno risorse in mano −2 Rep. Chi ha contribuito zero −1 Rep.' },
  { id:9,  name:'Ammutinamento dei Raccoglitori',fascia:'II', thresholds:{3:6,4:8,5:10,6:12}, reqType:'any',      penalty:'Se meno della metà ha contribuito: tutti −2 Rep.', effectSuccess:'Tutti +1 Rep.' },
  { id:10, name:'Sabotaggio al Cuore',          fascia:'II',  thresholds:{3:4,4:5,5:5,6:6},   reqType:'mixed',    reqMinType:'Minerali', reqMin:{3:4,4:5,5:5,6:6}, reqExtra:'Acquafonte', reqExtraMin:{3:1,4:2,5:2,6:2}, penalty:'Chi ha contribuito zero perde 4 Rep.', effectSuccess:'Top contributor +2 Rep.' },
  { id:11, name:'Razione Dimezzata',            fascia:'III', thresholds:{3:3,4:4,5:5,6:5},   reqType:'Vegetali', penalty:'Tutti −1 Rep.', effectSuccess:'Chi contribuisce ≥2 carte +1 Rep.' },
  { id:12, name:'I Prosciugati alle Porte',     fascia:'III', thresholds:{3:5,4:6,5:6,6:7},   reqType:'Minerali', penalty:'Tutti perdono 2 Rep.' },
  { id:13, name:'Memoria Perduta',              fascia:'III', thresholds:{3:3,4:4,5:5,6:5},   reqType:'types',    reqMin:{3:3,4:3,5:3,6:4}, penalty:'Chi ha più Rep perde 1 Rep.' },
  { id:14, name:'Gravidanza Non Autorizzata',   fascia:'III', thresholds:{3:7,4:9,5:11,6:13}, reqType:'any',      penalty:'Tutti −1 Rep. Chi ha contribuito meno −2 in più.' },
  { id:15, name:"Siccità dell'Acquafonte",      fascia:'III', thresholds:{3:3,4:4,5:4,6:5},   reqType:'Acquafonte',penalty:'Tutti perdono 3 Rep.' },
];

const RES_VALUES = { Vegetali:1, Organici:1, Minerali:2, Acquafonte:3 };

// ========================
// UTILITY
// ========================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function buildDeck() {
  const deck = [];
  const counts = { Vegetali:20, Organici:16, Minerali:14, Acquafonte:10 };
  let id = 0;
  for (const [type, count] of Object.entries(counts)) {
    for (let i=0; i<count; i++) deck.push({ id: id++, type });
  }
  return shuffle(deck);
}

function selectCrises() {
  const f1 = shuffle(CRISES.filter(c=>c.fascia==='I')).slice(0,2);
  const f2 = shuffle(CRISES.filter(c=>c.fascia==='II')).slice(0,2);
  const f3 = shuffle(CRISES.filter(c=>c.fascia==='III')).slice(0,1);
  return [...f1,...f2,...f3];
}

function drawCard(room) {
  if (room.deck.length === 0) {
    if (room.cityReserve.length === 0) return null;
    room.deck = shuffle([...room.cityReserve]);
    room.cityReserve = [];
    addLog(room, '♻ Mazzo rimescolato dalla Riserva della Città.');
  }
  return room.deck.pop();
}

function changeRep(room, sid, delta) {
  const p = room.players[sid];
  if (!p) return;
  if (delta < 0) p.totalPenalties += Math.abs(delta);
  p.reputation = Math.max(1, p.reputation + delta);
}

function addLog(room, msg) {
  room.log.push(msg);
  if (room.log.length > 20) room.log.shift();
}

function thresholdDesc(crisis, n) {
  const t = crisis.thresholds[n] || crisis.thresholds[4];
  if (crisis.reqType === 'any') return `${t} carte qualsiasi`;
  if (crisis.reqType === 'types') {
    const min = crisis.reqMin?.[n] || 3;
    return `${t} carte di ≥${min} tipi diversi`;
  }
  if (crisis.reqType === 'mixed') {
    const min = crisis.reqMin?.[n] || 1;
    if (crisis.reqExtra) {
      const minE = crisis.reqExtraMin?.[n] || 1;
      return `≥${min} ${crisis.reqMinType} + ≥${minE} ${crisis.reqExtra}`;
    }
    return `${t} carte (≥${min} ${crisis.reqMinType})`;
  }
  return `${t} ${crisis.reqType}`;
}

// ========================
// CRISIS CHECK
// ========================

function checkCrisis(crisis, cards, n) {
  const t = crisis.thresholds[n] || crisis.thresholds[4];
  if (crisis.reqType === 'any') return cards.length >= t;
  if (crisis.reqType === 'types') {
    const types = new Set(cards.map(c=>c.type));
    const min = crisis.reqMin?.[n] || 3;
    return types.size >= min && cards.length >= t;
  }
  if (crisis.reqType === 'mixed') {
    const ofType = cards.filter(c=>c.type===crisis.reqMinType).length;
    const min = crisis.reqMin?.[n] || 1;
    if (crisis.reqExtra) {
      const ofExtra = cards.filter(c=>c.type===crisis.reqExtra).length;
      const minE = crisis.reqExtraMin?.[n] || 1;
      return ofType >= min && ofExtra >= minE;
    }
    return ofType >= min && cards.length >= t;
  }
  return cards.filter(c=>c.type===crisis.reqType).length >= t;
}

// ========================
// PENALTIES & BONUSES
// ========================

function applyPenalty(room, crisis) {
  const counts = {};
  for (const sid of room.playerOrder) counts[sid] = room.contributions[sid]?.length || 0;
  const isFondatore = sid => room.players[sid]?.character?.id === 'fondatore';

  switch (crisis.id) {
    case 1: {
      const minR = Math.min(...room.playerOrder.map(s=>room.players[s].reputation));
      for (const s of room.playerOrder) if (room.players[s].reputation===minR && !isFondatore(s)) changeRep(room,s,-1);
      break;
    }
    case 2: case 7: for (const s of room.playerOrder) changeRep(room,s,-1); break;
    case 12: for (const s of room.playerOrder) changeRep(room,s,-2); break;
    case 3: {
      const maxH = Math.max(...room.playerOrder.map(s=>room.players[s].hand.length));
      for (const s of room.playerOrder) if (room.players[s].hand.length===maxH) changeRep(room,s,-2);
      break;
    }
    case 4: {
      const maxC = Math.max(...Object.values(counts));
      for (const [s,c] of Object.entries(counts)) {
        if (c===0) changeRep(room,s,-3);
        if (c===maxC && maxC>0) changeRep(room,s,1);
      }
      break;
    }
    case 5: {
      for (const [s,c] of Object.entries(counts)) {
        changeRep(room,s,-1);
        if (c===0) changeRep(room,s,-2);
      }
      break;
    }
    case 6: {
      const maxV = Math.max(...room.playerOrder.map(s=>room.players[s].hand.filter(c=>c.type==='Vegetali').length));
      for (const s of room.playerOrder) {
        if (room.players[s].hand.filter(c=>c.type==='Vegetali').length===maxV && maxV>0) changeRep(room,s,-2);
        if (counts[s]===0) changeRep(room,s,-1);
      }
      break;
    }
    case 8: {
      const minH = Math.min(...room.playerOrder.map(s=>room.players[s].hand.length));
      for (const [s,c] of Object.entries(counts)) {
        if (room.players[s].hand.length===minH) changeRep(room,s,-2);
        if (c===0) changeRep(room,s,-1);
      }
      break;
    }
    case 9: {
      const n = room.playerOrder.length;
      const contrib = Object.values(counts).filter(c=>c>0).length;
      if (contrib < Math.ceil(n/2)) for (const s of room.playerOrder) changeRep(room,s,-2);
      break;
    }
    case 10: {
      const maxC = Math.max(...Object.values(counts));
      for (const [s,c] of Object.entries(counts)) {
        if (c===0) changeRep(room,s,-4);
        if (c===maxC && maxC>0) changeRep(room,s,2);
      }
      break;
    }
    case 11: for (const s of room.playerOrder) changeRep(room,s,-1); break;
    case 13: {
      const maxR = Math.max(...room.playerOrder.map(s=>room.players[s].reputation));
      for (const s of room.playerOrder) if (room.players[s].reputation===maxR) changeRep(room,s,-1);
      break;
    }
    case 14: {
      const minC = Math.min(...Object.values(counts));
      for (const [s,c] of Object.entries(counts)) {
        changeRep(room,s,-1);
        if (c===minC) changeRep(room,s,-2);
      }
      break;
    }
    case 15: for (const s of room.playerOrder) changeRep(room,s,-3); break;
    default: for (const s of room.playerOrder) changeRep(room,s,-1);
  }
}

function applySuccessBonus(room, crisis) {
  const counts = {};
  for (const sid of room.playerOrder) counts[sid] = room.contributions[sid]?.length || 0;
  const maxC = Math.max(...Object.values(counts));
  if (crisis.id===4) { for (const [s,c] of Object.entries(counts)) if(c===maxC&&maxC>0) changeRep(room,s,1); }
  if (crisis.id===9) { for (const s of room.playerOrder) changeRep(room,s,1); }
  if (crisis.id===10) { for (const [s,c] of Object.entries(counts)) if(c===maxC&&maxC>0) changeRep(room,s,2); }
  if (crisis.id===11) { for (const [s,c] of Object.entries(counts)) if(c>=2) changeRep(room,s,1); }
}

// ========================
// STATE BROADCAST
// ========================

function buildState(room, socketId) {
  const me = room.players[socketId];
  if (!me) return { phase:'disconnected' };
  const n = room.playerOrder.length;
  const crisis = room.crisisSequence?.[room.currentTurnIndex];

  return {
    phase: room.phase,
    roomCode: room.code,
    isHost: room.playerOrder[0] === socketId,
    turnIndex: room.currentTurnIndex,
    players: room.playerOrder.map(sid => {
      const p = room.players[sid];
      return {
        id: sid, name: p.name, isMe: sid===socketId,
        reputation: p.reputation, handCount: p.hand.length,
        character: p.character, fistDown: !!room.fistDown[sid],
        contributionCount: room.contributions?.[sid]?.length || 0,
        contributions: (room.phase==='resoconto'||room.phase==='scoring') ? (room.contributions?.[sid]||[]) : null,
        score: room.scores?.[sid] || null,
        characterOptions: sid===socketId ? p.characterOptions : null,
      };
    }),
    myHand: me.hand,
    myCharacter: me.character,
    myObjective: me.objective,
    myContributionIds: (room.contributions?.[socketId]||[]).map(c=>c.id),
    myFistDown: !!room.fistDown[socketId],
    crisis: crisis ? { ...crisis, threshold: crisis.thresholds[n]||crisis.thresholds[4], thresholdDesc: thresholdDesc(crisis,n) } : null,
    tableCards: ['collection-secret','collection-free'].includes(room.phase) ? room.tableCards : [],
    mySecretChoice: room.secretChoices?.[socketId],
    secretChoiceCount: Object.keys(room.secretChoices||{}).length,
    freeChoiceCurrentPlayer: room.phase==='collection-free' ? room.freeChoiceOrder?.[room.freeChoiceIndex] : null,
    isMyFreeChoice: room.phase==='collection-free' && room.freeChoiceOrder?.[room.freeChoiceIndex]===socketId,
    allFistsDown: room.playerOrder.every(s=>!!room.fistDown[s]),
    resocontoEnd: room.resocontoEnd || null,
    lastCrisisResolved: room.lastCrisisResolved,
    crisisHistory: room.crisisHistory || [],
    log: [...room.log].reverse().slice(0,10),
    scores: room.scores,
    winner: room.winner ? room.players[room.winner]?.name : null,
  };
}

function broadcast(room) {
  for (const sid of Object.keys(room.players)) {
    io.to(sid).emit('state', buildState(room, sid));
  }
}

// ========================
// STANZE
// ========================

const rooms = {};

function createRoom(code) {
  return {
    code, phase:'lobby',
    players:{}, playerOrder:[],
    deck: buildDeck(), cityReserve:[],
    crisisSequence: selectCrises(),
    currentTurnIndex:0,
    tableCards:[], secretChoices:{}, contributions:{}, fistDown:{},
    freeChoiceOrder:[], freeChoiceIndex:0,
    crisisHistory:[], crisisResolved:[],
    lastCrisisResolved:null, resocontoEnd:null, resocontoTimer:null,
    scores:null, winner:null, log:[],
  };
}

// ========================
// SOCKET EVENTS
// ========================

io.on('connection', socket => {
  let myRoom = null;

  function join(room, name) {
    myRoom = room;
    socket.join(room.code);
    room.players[socket.id] = {
      name, character:null, objective:null, hand:[], reputation:2,
      characterOptions:null,
      turnsContributed:0, totalPenalties:0, topContributorTurns:0,
      zeroContribNoPenaltyTurns:0, specchioPoints:0,
    };
    room.playerOrder.push(socket.id);
    addLog(room, `${name} si è unito.`);
    broadcast(room);
  }

  socket.on('create-room', ({name}) => {
    const code = Math.random().toString(36).slice(2,6).toUpperCase();
    const room = createRoom(code);
    rooms[code] = room;
    join(room, name);
    socket.emit('room-created', {code});
  });

  socket.on('join-room', ({code, name}) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) return socket.emit('error-msg','Stanza non trovata.');
    if (room.phase !== 'lobby') return socket.emit('error-msg','Partita già iniziata.');
    if (Object.keys(room.players).length >= 6) return socket.emit('error-msg','Stanza piena (max 6).');
    join(room, name);
  });

  socket.on('start-game', () => {
    if (!myRoom || myRoom.phase!=='lobby') return;
    if (myRoom.playerOrder[0]!==socket.id) return socket.emit('error-msg','Solo il primo giocatore può avviare.');
    if (myRoom.playerOrder.length<3) return socket.emit('error-msg','Servono almeno 3 giocatori.');
    const n = myRoom.playerOrder.length;
    const charDeck = shuffle([...CHARACTERS]);
    for (const sid of myRoom.playerOrder) {
      myRoom.players[sid].characterOptions = n===6 ? [charDeck.pop()] : [charDeck.pop(), charDeck.pop()];
    }
    myRoom.phase = 'character-selection';
    addLog(myRoom,'Scegli il tuo Personaggio.');
    broadcast(myRoom);
  });

  socket.on('choose-character', ({characterId}) => {
    if (!myRoom || myRoom.phase!=='character-selection') return;
    const p = myRoom.players[socket.id];
    if (!p || p.character) return;
    const chosen = p.characterOptions?.find(c=>c.id===characterId);
    if (!chosen) return;
    p.character = chosen; p.characterOptions = null;
    addLog(myRoom, `${p.name} ha scelto il personaggio.`);
    if (myRoom.playerOrder.every(s=>myRoom.players[s].character)) {
      const objDeck = shuffle([...OBJECTIVES]);
      for (const sid of myRoom.playerOrder) myRoom.players[sid].objective = objDeck.pop();
      for (const sid of myRoom.playerOrder) for(let i=0;i<4;i++) { const c=drawCard(myRoom); if(c) myRoom.players[sid].hand.push(c); }
      addLog(myRoom,'Partita iniziata! Buona fortuna.');
      startTurn(myRoom);
    } else {
      broadcast(myRoom);
    }
  });

  function startTurn(room) {
    room.currentTurnIndex = room.crisisResolved.length;
    if (room.currentTurnIndex >= 5) { endGame(room); return; }
    room.phase = 'crisis';
    room.contributions = {}; room.fistDown = {}; room.secretChoices = {}; room.tableCards = [];
    for (const sid of room.playerOrder) room.contributions[sid] = [];
    const c = room.crisisSequence[room.currentTurnIndex];
    addLog(room, `Turno ${room.currentTurnIndex+1}/5 — ${c.name} [Fascia ${c.fascia}]`);
    broadcast(room);
  }

  socket.on('advance-to-collection', () => {
    if (!myRoom || myRoom.phase!=='crisis') return;
    if (myRoom.playerOrder[0]!==socket.id) return;
    const n = myRoom.playerOrder.length;
    myRoom.tableCards = [];
    for (let i=0; i<n*2; i++) { const c=drawCard(myRoom); if(c) myRoom.tableCards.push(c); }
    myRoom.phase = 'collection-secret'; myRoom.secretChoices = {};
    addLog(myRoom,'Fase A: scegli una carta in silenzio.');
    broadcast(myRoom);
  });

  socket.on('secret-choice', ({cardIndex}) => {
    if (!myRoom || myRoom.phase!=='collection-secret') return;
    if (myRoom.secretChoices[socket.id]!==undefined) return;
    if (cardIndex<0||cardIndex>=myRoom.tableCards.length) return;
    myRoom.secretChoices[socket.id] = cardIndex;
    broadcast(myRoom);
    if (myRoom.playerOrder.every(s=>myRoom.secretChoices[s]!==undefined)) resolveSecret(myRoom);
  });

  function resolveSecret(room) {
    const countByIdx = {};
    for (const idx of Object.values(room.secretChoices)) countByIdx[idx] = (countByIdx[idx]||0)+1;
    for (const [sid, idx] of Object.entries(room.secretChoices)) {
      const p = room.players[sid];
      if (countByIdx[idx]===1) {
        const card = room.tableCards[idx];
        if (card) { p.hand.push(card); room.tableCards[idx] = {...card, taken:true}; }
      } else {
        const c = drawCard(room); if(c) { p.hand.push(c); addLog(room,`${p.name} pesca (conflitto su carta ${idx+1}).`); }
      }
    }
    room.phase = 'collection-free';
    room.freeChoiceOrder = [...room.playerOrder].sort((a,b)=>{
      const rd = room.players[a].reputation-room.players[b].reputation;
      return rd!==0 ? rd : room.players[a].hand.length-room.players[b].hand.length;
    });
    room.freeChoiceIndex = 0;
    advanceFree(room);
  }

  function advanceFree(room) {
    while (room.freeChoiceIndex < room.freeChoiceOrder.length && !room.tableCards.some(c=>!c.taken)) break;
    if (!room.tableCards.some(c=>!c.taken) || room.freeChoiceIndex>=room.freeChoiceOrder.length) {
      for (const c of room.tableCards) if(!c.taken) room.cityReserve.push(c);
      room.tableCards = [];
      startAllocation(room); return;
    }
    const sid = room.freeChoiceOrder[room.freeChoiceIndex];
    addLog(room, `Fase B: scelta libera — ${room.players[sid]?.name}`);
    broadcast(room);
  }

  socket.on('free-choice', ({cardIndex}) => {
    if (!myRoom || myRoom.phase!=='collection-free') return;
    if (myRoom.freeChoiceOrder[myRoom.freeChoiceIndex]!==socket.id) return;
    const card = myRoom.tableCards[cardIndex];
    if (!card||card.taken) return;
    myRoom.players[socket.id].hand.push(card);
    myRoom.tableCards[cardIndex] = {...card, taken:true};
    myRoom.freeChoiceIndex++;
    advanceFree(myRoom);
  });

  socket.on('skip-free-choice', () => {
    if (!myRoom || myRoom.phase!=='collection-free') return;
    if (myRoom.freeChoiceOrder[myRoom.freeChoiceIndex]!==socket.id) return;
    myRoom.freeChoiceIndex++;
    advanceFree(myRoom);
  });

  function startAllocation(room) {
    room.phase = 'allocation'; room.contributions = {}; room.fistDown = {};
    for (const sid of room.playerOrder) room.contributions[sid] = [];
    addLog(room,'Allocazione: decidete in silenzio cosa contribuire alla città.');
    broadcast(room);
  }

  socket.on('update-contribution', ({cardIds}) => {
    if (!myRoom || myRoom.phase!=='allocation') return;
    if (myRoom.fistDown[socket.id]) return;
    const p = myRoom.players[socket.id];
    myRoom.contributions[socket.id] = cardIds.map(id=>p.hand.find(c=>c.id===id)).filter(Boolean);
    broadcast(myRoom);
  });

  socket.on('fist-down', () => {
    if (!myRoom || myRoom.phase!=='allocation') return;
    myRoom.fistDown[socket.id] = true;
    addLog(myRoom, `${myRoom.players[socket.id]?.name} ha deciso.`);
    if (myRoom.playerOrder.every(s=>!!myRoom.fistDown[s])) revealAllocation(myRoom);
    else broadcast(myRoom);
  });

  function revealAllocation(room) {
    for (const [sid, cards] of Object.entries(room.contributions)) {
      const ids = new Set(cards.map(c=>c.id));
      room.players[sid].hand = room.players[sid].hand.filter(c=>!ids.has(c.id));
      room.cityReserve.push(...cards);
    }
    const crisis = room.crisisSequence[room.currentTurnIndex];
    const n = room.playerOrder.length;
    const allCards = Object.values(room.contributions).flat();
    const resolved = checkCrisis(crisis, allCards, n);
    room.crisisResolved.push(resolved); room.lastCrisisResolved = resolved;
    room.crisisHistory.push({name:crisis.name, fascia:crisis.fascia, resolved});

    const counts = {};
    for (const sid of room.playerOrder) counts[sid] = room.contributions[sid]?.length||0;
    const maxC = Math.max(...Object.values(counts));

    if (resolved) {
      addLog(room,'✓ Crisi superata!');
      for (const [s,c] of Object.entries(counts)) {
        if (c===maxC && maxC>0) { changeRep(room,s,3); room.players[s].topContributorTurns++; }
        else if (c>0) changeRep(room,s,1);
        if (c>0) room.players[s].turnsContributed++;
      }
      applySuccessBonus(room, crisis);
    } else {
      addLog(room,'✗ Crisi fallita — penalità in corso.');
      applyPenalty(room, crisis);
      for (const [s,c] of Object.entries(counts)) {
        if (c>0) room.players[s].turnsContributed++;
        else room.players[s].zeroContribNoPenaltyTurns++;
      }
    }

    // Specchio tracking
    for (const sid of room.playerOrder) {
      const idx = room.playerOrder.indexOf(sid);
      const rightSid = room.playerOrder[(idx+1)%n];
      if (counts[sid]===counts[rightSid]) room.players[sid].specchioPoints++;
    }

    const hasOratore = room.playerOrder.some(s=>room.players[s].character?.id==='oratore');
    const dur = hasOratore ? 90 : 60;
    room.resocontoEnd = Date.now() + dur*1000;
    room.phase = 'resoconto';
    addLog(room,`Resoconto: ${dur} secondi.`);
    broadcast(room);
    room.resocontoTimer = setTimeout(()=>endResoconto(room), dur*1000+500);
  }

  socket.on('end-resoconto', () => {
    if (!myRoom||myRoom.phase!=='resoconto') return;
    if (myRoom.playerOrder[0]!==socket.id) return;
    endResoconto(myRoom);
  });

  function endResoconto(room) {
    if (room.resocontoTimer) { clearTimeout(room.resocontoTimer); room.resocontoTimer=null; }
    room.resocontoEnd=null; room.lastCrisisResolved=null;
    if (room.crisisResolved.length>=5) endGame(room); else startTurn(room);
  }

  function endGame(room) {
    room.phase='scoring';
    const n = room.playerOrder.length;
    const scores = {};
    for (const sid of room.playerOrder) {
      const p = room.players[sid];
      const rep = p.reputation;
      const noCap = p.character?.id==='calcolatore' && p.turnsContributed>=3;
      const resV = p.hand.reduce((s,c)=>s+(RES_VALUES[c.type]||1),0);
      const cap = noCap ? resV : Math.min(resV, rep*5);
      const obj = calcObj(room,sid);
      scores[sid] = { name:p.name, reputation:rep, repPoints:rep*2, resourceRaw:resV, converted:cap, capLimit:noCap?'∞':rep*5, objBonus:obj, objective:p.objective?.name, total:rep*2+cap+obj };
    }
    room.scores = scores;
    const sorted = [...room.playerOrder].sort((a,b)=>{
      const d=scores[b].total-scores[a].total; if(d!==0) return d;
      const rd=room.players[b].reputation-room.players[a].reputation; if(rd!==0) return rd;
      return room.players[b].hand.length-room.players[a].hand.length;
    });
    room.winner = sorted[0];
    addLog(room,`🏆 Vincitore: ${room.players[room.winner]?.name}!`);
    broadcast(room);
  }

  function calcObj(room, sid) {
    const p = room.players[sid]; const obj = p.objective; if(!obj) return 0;
    const n = room.playerOrder.length;
    switch(obj.id) {
      case 'baluardo': return Math.min(p.topContributorTurns,4);
      case 'sentinella': return room.crisisResolved.filter(Boolean).length>=3?5:0;
      case 'costruttore': {
        const bigT = n===3?5:6;
        return room.crisisHistory.reduce((acc,h,i)=>{
          if(!h.resolved) return acc;
          const t=room.crisisSequence[i].thresholds[n]||room.crisisSequence[i].thresholds[4];
          return acc+(t>=bigT?2:0);
        },0);
      }
      case 'accumulatore': return p.hand.filter(c=>c.type==='Minerali').length>=3?6:0;
      case 'parassita': return Math.min(p.zeroContribNoPenaltyTurns*2,6);
      case 'mercante': return new Set(p.hand.map(c=>c.type)).size>=3?6:0;
      case 'sopravvissuto': return p.totalPenalties<=2?4:0;
      case 'diplomatico': {
        const idx=room.playerOrder.indexOf(sid);
        const left=room.playerOrder[(idx-1+n)%n];
        const mv=p.hand.reduce((s,c)=>s+(RES_VALUES[c.type]||1),0);
        const tv=room.players[left].hand.reduce((s,c)=>s+(RES_VALUES[c.type]||1),0);
        return Math.abs(mv-tv)<=5?4:0;
      }
      case 'ombra': {
        const r=p.reputation;
        const hi=room.playerOrder.some(s=>s!==sid&&room.players[s].reputation>r);
        const lo=room.playerOrder.some(s=>s!==sid&&room.players[s].reputation<r);
        return hi&&lo?4:0;
      }
      case 'specchio': return Math.min(p.specchioPoints,5);
      case 'censore': {
        const base=room.playerOrder.map(s=>{
          const pl=room.players[s]; const r=pl.reputation;
          const v=Math.min(pl.hand.reduce((a,c)=>a+(RES_VALUES[c.type]||1),0),r*5);
          return {s,score:r*2+v};
        }).sort((a,b)=>b.score-a.score);
        if(base[0].s===sid) return 4;
        if(base[1]?.s===sid) return 2;
        return 0;
      }
      case 'fantasma_grigio': return p.topContributorTurns===0?3:0;
      default: return 0;
    }
  }

  socket.on('disconnect', () => {
    if (!myRoom) return;
    const name = myRoom.players[socket.id]?.name||'?';
    delete myRoom.players[socket.id];
    myRoom.playerOrder = myRoom.playerOrder.filter(id=>id!==socket.id);
    addLog(myRoom,`${name} si è disconnesso.`);
    if (myRoom.playerOrder.length===0) delete rooms[myRoom.code];
    else broadcast(myRoom);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`QUOTA server avviato su porta ${PORT}`));
