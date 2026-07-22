const express = require('express');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function ensureLegacyTournament() {
  let legacy = await Tournament.findOne({ isLegacy: true }) || await Tournament.findOne({ name: 'Legacy Tournament' });
  if (!legacy) {
    legacy = await Tournament.create({
      name: 'Legacy Tournament',
      dateRange: 'Preserved from prior deployment',
      matchType: 'fast4',
      thirdSetFormat: 'match_tiebreak',
      status: 'completed',
      isLegacy: true
    });
  }
  const legacyMatches = await Match.find({ $or: [{ tournamentId: { $exists: false } }, { tournamentId: null }] });
  if (legacyMatches.length) {
    await Match.updateMany({ $or: [{ tournamentId: { $exists: false } }, { tournamentId: null }] }, {
      $set: { tournamentId: legacy._id, tournamentName: legacy.name }
    });
  }
  return legacy;
}

// GET /api/bracket - full schedule/bracket, public, read-only
router.get('/', async (req, res) => {
  await ensureLegacyTournament();
  const matches = await Match.find().sort({ matchNumber: 1 }).lean();
  res.json(matches);
});

router.get('/tournaments', async (req, res) => {
  const tournaments = await Tournament.find().sort({ createdAt: -1 }).lean();
  res.json(tournaments);
});

router.get('/tournaments/hidden', requireAuth, async (req, res) => {
  const tournaments = await Tournament.find({ hiddenFromUI: true }).sort({ createdAt: -1 }).lean();
  res.json(tournaments);
});

router.post('/tournaments', requireAuth, async (req, res) => {
  const { name, dateRange, matchType, thirdSetFormat } = req.body;
  const tournament = await Tournament.create({
    name: name || 'New Tournament',
    dateRange: dateRange || '',
    matchType: matchType || 'fast4',
    thirdSetFormat: thirdSetFormat || 'match_tiebreak',
    status: 'active'
  });
  res.json({ ok: true, tournament });
});

router.post('/tournaments/:tournamentId/complete', requireAuth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.tournamentId);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
  tournament.status = 'completed';
  await tournament.save();
  res.json({ ok: true, tournament });
});

router.post('/tournaments/:tournamentId/seed', requireAuth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.tournamentId);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });

  const baseMatches = [
    [1, 'Play-In', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '06:30 AM', '07:15 AM', 'Player 1', 'Player 2', null, null, 7, 'player2'],
    [2, 'Play-In', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '07:15 AM', '08:00 AM', 'Player 3', 'Player 4', null, null, 6, 'player2'],
    [3, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '08:00 AM', '08:45 AM', 'Player 5', 'Player 6', null, null, 11, 'player2'],
    [4, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '08:45 AM', '09:30 AM', 'Player 7', 'Player 8', null, null, 12, 'player1'],
    [5, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '09:30 AM', '10:15 AM', 'Player 9', 'Player 10', null, null, 12, 'player2'],
    [6, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '04:00 PM', '04:45 PM', 'Player 11', 'TBD', null, 2, 11, 'player1'],
    [7, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '04:45 PM', '05:30 PM', 'Player 12', 'TBD', null, 1, 13, 'player1'],
    [8, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '05:30 PM', '06:15 PM', 'Player 13', 'Player 14', null, null, 13, 'player2'],
    [9, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '06:15 PM', '07:00 PM', 'Player 15', 'Player 16', null, null, 14, 'player1'],
    [10, 'Round of 16', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '07:00 PM', '07:45 PM', 'Player 17', 'Player 18', null, null, 14, 'player2'],
    [11, 'Quarterfinal', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '06:30 AM', '07:15 AM', 'TBD', 'TBD', 6, 3, 15, 'player1'],
    [12, 'Quarterfinal', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '07:15 AM', '08:00 AM', 'TBD', 'TBD', 4, 5, 15, 'player2'],
    [13, 'Quarterfinal', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '08:00 AM', '08:45 AM', 'TBD', 'TBD', 7, 8, 16, 'player1'],
    [14, 'Quarterfinal', tournament.matchType === 'fast4' ? 1 : 2, 'Morning', '08:45 AM', '09:30 AM', 'TBD', 'TBD', 9, 10, 16, 'player2'],
    [15, 'Semifinal', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '04:00 PM', '05:30 PM', 'TBD', 'TBD', 11, 12, 17, 'player1'],
    [16, 'Semifinal', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '05:30 PM', '07:00 PM', 'TBD', 'TBD', 13, 14, 17, 'player2'],
    [17, 'Final', tournament.matchType === 'fast4' ? 1 : 2, 'Evening', '07:00 PM', '08:30 PM', 'TBD', 'TBD', 15, 16, null, null]
  ];

  for (const row of baseMatches) {
    const [matchNumber, round, phase, session, scheduledStart, scheduledEnd, p1, p2, p1Source, p2Source, nextMatch, nextMatchSlot] = row;
    const exists = await Match.findOne({ matchNumber, tournamentId: tournament._id });
    if (exists) continue;
    await Match.create({
      matchNumber: matchNumber + (tournament.matchNumberOffset || 0),
      round,
      phase,
      session,
      tournamentId: tournament._id,
      tournamentName: tournament.name,
      scheduledStart,
      scheduledEnd,
      player1: { name: p1, sourceMatch: p1Source },
      player2: { name: p2, sourceMatch: p2Source },
      nextMatch: nextMatch ? nextMatch + (tournament.matchNumberOffset || 0) : null,
      nextMatchSlot,
      switchPacing: 'odd_game'
    });
  }

  res.json({ ok: true, tournament, seeded: true });
});

router.post('/tournaments/:tournamentId/hide', requireAuth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.tournamentId);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
  tournament.hiddenFromUI = true;
  await tournament.save();
  res.json({ ok: true, tournament });
});

router.post('/tournaments/:tournamentId/show', requireAuth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.tournamentId);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
  tournament.hiddenFromUI = false;
  await tournament.save();
  res.json({ ok: true, tournament });
});

module.exports = router;
