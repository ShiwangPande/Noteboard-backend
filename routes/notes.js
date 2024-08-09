const express = require('express');
const router = express.Router();
const Note = require('../models/Note');

// Create a new note
router.post('/', async (req, res) => {
    try {
        const newNote = new Note({
            pdfId: req.body.pdfId,
            content: req.body.content,
        });
        const savedNote = await newNote.save();
        res.json(savedNote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get notes for a specific PDF
router.get('/:pdfId', async (req, res) => {
    try {
        const notes = await Note.find({ pdfId: req.params.pdfId });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
