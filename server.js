const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('cors')());

// load or init data
function loadData(){
  try{
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  }catch(e){
    const init = { players: {}, matches: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
}

function saveData(data){
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// compute ranking update
function applyMatchToData(data, match){
  // match: { teamBlack: [ids], teamWhite: [ids], winner: 'Black'|'White', date }
  const { teamBlack, teamWhite, winner } = match;
  const allPlayers = new Set([...teamBlack, ...teamWhite]);

  // ensure players exist
  allPlayers.forEach(id => {
    if(!data.players[id]){
      data.players[id] = { points: 0, wins: 0, losses: 0, streak: 0, id };
    }
  });

  const winners = (winner === 'Black') ? teamBlack : teamWhite;
  const losers  = (winner === 'Black') ? teamWhite : teamBlack;

  winners.forEach(id => {
    const p = data.players[id];
    const prevStreak = p.streak || 0;
    const newStreak = prevStreak + 1;
    // base 3 pontos por vitória; se nova sequência >=3, ganha +1 (interpretação explicada)
    const gained = 3 + (newStreak >= 3 ? 1 : 0);
    p.points += gained;
    p.wins = (p.wins || 0) + 1;
    p.streak = newStreak;
  });

  losers.forEach(id => {
    const p = data.players[id];
    p.points -= 2;
    p.losses = (p.losses || 0) + 1;
    p.streak = 0; 
  });

  const record = {
    id: nanoid(8),
    date: match.date || new Date().toISOString(),
    teamBlack, teamWhite, winner
  };
  data.matches.unshift(record);
  saveData(data);
  return record;
}

// endpoints
app.get('/api/data', (req, res) => {
  res.json(loadData());
});

app.post('/api/match', (req, res) => {
  try{
    const data = loadData();
    const match = req.body;
    if(!match || !Array.isArray(match.teamBlack) || !Array.isArray(match.teamWhite) || !match.winner){
      return res.status(400).json({ error: 'Formato de partida inválido.' });
    }
    const rec = applyMatchToData(data, match);
    res.json({ ok: true, match: rec });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.get('/api/export', (req, res) => {
  res.download(DATA_FILE, 'data.json');
});

app.post('/api/import', (req, res) => {
  try{
    const imported = req.body.data;
    if(!imported || typeof imported !== 'object') return res.status(400).json({ error: 'Formato inválido' });
    fs.writeFileSync(DATA_FILE, JSON.stringify(imported, null, 2));
    res.json({ ok: true });
  }catch(e){
    res.status(500).json({ error: 'Erro ao importar' });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
