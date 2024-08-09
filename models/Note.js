const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  pdfId: { type: mongoose.Schema.Types.ObjectId, ref: 'PDF', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);

module.exports = Note;
