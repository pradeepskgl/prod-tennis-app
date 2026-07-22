const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'New Tournament' },
  dateRange: { type: String, default: '' },
  matchType: { type: String, enum: ['fast4', 'regular'], default: 'fast4' },
  thirdSetFormat: { type: String, enum: ['match_tiebreak', 'regular_set'], default: 'match_tiebreak' },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  isLegacy: { type: Boolean, default: false },
  hiddenFromUI: { type: Boolean, default: false },
  matchNumberOffset: { type: Number, default: 1000 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
